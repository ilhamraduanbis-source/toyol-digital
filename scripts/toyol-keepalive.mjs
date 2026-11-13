// Local-only supervisor for the already installed, pinned Toyol runner.
// No downloads, no new keys, no network calls, no job code execution beyond the installed runner.
import {readFileSync,writeFileSync,existsSync,readdirSync,rmdirSync,unlinkSync,openSync,closeSync,statSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
export const validPid=p=>Number.isSafeInteger(p)&&p>1;
export function readPid(file){
 try{const t=readFileSync(file,'utf8').trim();return /^\d+$/.test(t)&&validPid(Number(t))?Number(t):null;}catch{return null;}
}
export function alive(pid){
 if(!validPid(pid))return false;
 try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw e;}
}
export function matching(pid,file){
 if(!alive(pid))return false;
 try{return readFileSync('/proc/'+pid+'/cmdline','utf8').split('\0').includes(file);}catch{return null;}
}
export function findRunner(file){
 const hits=[];
 for(const v of readdirSync('/proc')){
  if(!/^\d+$/.test(v)||!validPid(Number(v)))continue;
  const p=Number(v);
  try{if(readFileSync('/proc/'+p+'/cmdline','utf8').split('\0').includes(file))hits.push(p);}catch{}
 }
 return hits;
}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const say=(...x)=>console.log(new Date().toISOString(),...x);
async function main(){
 const d=join(process.env.HOME,'.toyol','forge'),file=join(d,'local-runner.mjs'),
  pidfile=join(d,'runner.pid'),guard=join(d,'supervisor.pid'),lock=join(d,'runner.lock'),
  stop=join(d,'runner.stop'),log=join(d,'runner.log');
 if(!existsSync(file)||!existsSync(join(d,'agent.pem')))throw Error('EXISTING_RUNNER_REQUIRED');
 process.umask(0o077);
 if(existsSync(guard)){
  const old=readPid(guard);
  if(!old||alive(old))throw Error('SUPERVISOR_ALREADY_RUNNING_OR_STATE_UNKNOWN');
  unlinkSync(guard);
 }
 writeFileSync(guard,String(process.pid)+'\n',{flag:'wx',mode:0o600});
 let attempts=[];
 try{
  say('SUPERVISOR_STARTED');
  while(!existsSync(stop)){
   const old=readPid(pidfile);
   if(old&&alive(old)){
    const match=matching(old,file);
    if(match!==true){say('PID_IDENTITY_UNVERIFIED_NO_RESTART');await delay(60000);continue;}
    await delay(15000);continue;
   }
   // A prior known process must be dead and no visible runner may exist before clearing an empty stale lock.
   const hits=findRunner(file);
   if(hits.length===1){writeFileSync(pidfile,String(hits[0])+'\n',{mode:0o600});say('EXISTING_RUNNER_ADOPTED');await delay(15000);continue;}
   if(hits.length>1){say('MULTIPLE_RUNNERS_NO_RESTART');await delay(60000);continue;}
   if(existsSync(lock)){
    if(!old||alive(old)){say('LOCK_OWNER_UNVERIFIED_NO_RESTART');await delay(60000);continue;}
    try{rmdirSync(lock);say('STALE_EMPTY_LOCK_RECOVERED');}catch{say('LOCK_NOT_EMPTY_OR_UNAVAILABLE');await delay(60000);continue;}
   }
   attempts=attempts.filter(t=>Date.now()-t<900000);
   if(attempts.length>=3){say('RESTART_BACKOFF');await delay(60000);continue;}
   attempts.push(Date.now());
   const check=spawnSync(process.execPath,[file,'--check'],{encoding:'utf8',timeout:45000,stdio:['ignore','pipe','pipe']});
   if(check.error||check.status!==0||!check.stdout.includes('RUNNER_READY')){say('RUNNER_CHECK_FAILED_NO_START');await delay(60000);continue;}
   if(existsSync(stop))break;
   if(existsSync(log)&&statSync(log).size>2000000)renameSync(log,log+'.previous');
   const fd=openSync(log,'a',0o600);
   try{
    const child=spawn(process.execPath,[file],{stdio:['ignore',fd,fd],detached:true});
    child.on('error',()=>say('RUNNER_SPAWN_ERROR'));
    if(!validPid(child.pid)){say('RUNNER_PID_UNAVAILABLE');await delay(60000);continue;}
    writeFileSync(pidfile,String(child.pid)+'\n',{mode:0o600});
    child.unref();say('RUNNER_RESTARTED',child.pid);
   }finally{closeSync(fd);}
   await delay(15000);
  }
 }finally{if(readPid(guard)===process.pid)unlinkSync(guard);say('SUPERVISOR_STOPPED');}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{say('SUPERVISOR_ERROR',String(e.message).slice(0,120));process.exitCode=1;});
