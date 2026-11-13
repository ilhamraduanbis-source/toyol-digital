// One-time local upgrade. No wallet keys read, no task submission or signing here.
import {readFileSync,writeFileSync,existsSync,mkdirSync,rmdirSync,unlinkSync,renameSync,readdirSync,openSync,closeSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
const d=join(process.env.HOME,'.toyol','forge');
const runner=join(d,'local-runner.mjs'),supervisor=join(d,'keepalive.mjs'),next=join(d,'local-runner.next.mjs');
const stop=join(d,'runner.stop'),lock=join(d,'runner.lock'),guard=join(d,'upgrade.lock');
const marker='TOYOL_UPGRADE_STOP_V1\n';
const pinned='https://raw.githubusercontent.com/ilhamraduanbis-source/toyol-digital/c2983e4ebd858837619ed9cdb1aee7b9a7475084/scripts/toyol-local-runner.mjs';
const blob='cdf743450dcaa6d5912e3ca3af3ea2ece1738f8c';
const need=(x,m)=>{if(!x)throw Error(m);};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const say=(...x)=>console.log(new Date().toISOString(),...x);
function pid(path){try{const s=readFileSync(path,'utf8').trim();return /^\d+$/.test(s)&&Number(s)>1?Number(s):null;}catch{return null;}}
function inspect(p,file){
 if(!p)return {active:false,state:'absent'};
 try{process.kill(p,0);}catch(e){if(e.code==='ESRCH')return {active:false,state:'dead'};throw e;}
 let state,cmd;
 try{
  const s=readFileSync('/proc/'+p+'/stat','utf8');state=s.slice(s.lastIndexOf(')')+2).split(' ')[0];
  cmd=readFileSync('/proc/'+p+'/cmdline','utf8').split('\0');
 }catch(e){if(e.code==='ENOENT')return {active:false,state:'dead'};throw Error('PROCESS_IDENTITY_UNREADABLE');}
 if(state==='Z'||state==='X')return {active:false,state};
 need(cmd.includes(file),'PID_IDENTITY_MISMATCH');
 return {active:true,state};
}
function scan(file){
 const hits=[];
 for(const v of readdirSync('/proc')){
  if(!/^\d+$/.test(v)||Number(v)<=1)continue;
  try{if(readFileSync('/proc/'+v+'/cmdline','utf8').split('\0').includes(file))hits.push(Number(v));}catch{}
 }
 return hits;
}
function checkedProcess(pidfile,file){
 const p=pid(pidfile),hits=scan(file),st=inspect(p,file);
 need(hits.every(x=>x===p),'UNTRACKED_OR_MULTIPLE_PROCESSES');
 return {p,...st};
}
async function main(){
 process.umask(0o077);
 need(process.env.PREFIX&&existsSync(runner)&&existsSync(supervisor)&&existsSync(join(d,'agent.pem')),'EXISTING_INSTALL_REQUIRED');
 try{mkdirSync(guard,{mode:0o700});}catch{throw Error('UPGRADE_ALREADY_RUNNING_OR_LOCKED');}
 try{
  // Never overwrite a user-requested stop.
  if(existsSync(stop))need(readFileSync(stop,'utf8')===marker,'OWNER_STOP_PRESENT');
  const result=await fetch(pinned,{redirect:'error',signal:AbortSignal.timeout(25000)});
  need(result.ok,'UPGRADE_DOWNLOAD_FAILED');
  const b=Buffer.from(await result.arrayBuffer());
  need(b.length<100000&&createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex')===blob,'UPGRADE_HASH_MISMATCH');
  writeFileSync(next,b,{mode:0o600});
  let check=spawnSync(process.execPath,['--check',next],{encoding:'utf8',timeout:15000});
  need(!check.error&&check.status===0,'UPGRADE_SYNTAX_FAILED');
  check=spawnSync(process.execPath,[next,'--check'],{encoding:'utf8',timeout:90000,stdio:['ignore','pipe','pipe']});
  need(!check.error&&check.status===0&&check.stdout.includes('RUNNER_READY'),'UPGRADE_PREFLIGHT_FAILED');
  say('NEW_RUNNER_CHECK_OK',check.stdout.trim().split('\n').at(-1));
  const rp=join(d,'runner.pid'),sp=join(d,'supervisor.pid');
  const oldR=checkedProcess(rp,runner),oldS=checkedProcess(sp,supervisor);
  say('OLD_RUNNER_STATE',oldR.state,'OLD_SUPERVISOR_STATE',oldS.state);
  if(!existsSync(stop))writeFileSync(stop,marker,{flag:'wx',mode:0o600});
  // Resume only a positively identified stopped process so it can observe stop.
  for(const p of [oldR,oldS])if(p.active&&['T','t'].includes(p.state))process.kill(p.p,'SIGCONT');
  say('GRACEFUL_STOP_REQUESTED');
  let stopped=false;
  for(let i=0;i<100;i++){
   const a=inspect(oldR.p,runner),c=inspect(oldS.p,supervisor);
   if(!a.active&&!c.active&&scan(runner).length===0&&scan(supervisor).length===0){stopped=true;break;}
   await delay(1000);
  }
  need(stopped,'STOP_PENDING_RETRY_LATER_NO_NEW_PROCESS');
  need(!existsSync(lock),'OLD_RUNNER_LOCK_REMAINS_NO_RESTART');
  // Only known recorded dead identities are removed. State and wallet keys are untouched.
  for(const [p,f,old] of [[rp,runner,oldR],[sp,supervisor,oldS]]){
   if(existsSync(p)){
    const v=pid(p);need(v===old.p&&!inspect(v,f).active,'PID_CHANGED_NO_RESTART');unlinkSync(p);
   }
  }
  const backup=join(d,'local-runner.pre-network-upgrade.mjs');
  if(!existsSync(backup))writeFileSync(backup,readFileSync(runner),{flag:'wx',mode:0o600});
  renameSync(next,runner);
  need(readFileSync(stop,'utf8')===marker,'STOP_OWNERSHIP_CHANGED');
  unlinkSync(stop);
  const log=join(d,'supervisor.log'),fd=openSync(log,'a',0o600);
  try{
   const child=spawn(process.execPath,[supervisor],{detached:true,stdio:['ignore',fd,fd]});
   child.on('error',e=>say('SUPERVISOR_SPAWN_FAILED',e.code??'ERROR'));
   child.unref();
  }finally{closeSync(fd);}
  for(let i=0;i<10;i++){
   const p=pid(sp);if(p&&inspect(p,supervisor).active){say('UPGRADE_OK_SUPERVISOR_STARTED',p);say('STATE_PRESERVED_NO_DUPLICATE_RETRY');return;}
   await delay(1000);
  }
  throw Error('UPGRADE_INSTALLED_SUPERVISOR_NOT_CONFIRMED');
 }finally{
  if(existsSync(next))unlinkSync(next);
  rmdirSync(guard);
 }
}
main().catch(e=>{say('UPGRADE_STOPPED',String(e.message).slice(0,160));process.exitCode=1;});
