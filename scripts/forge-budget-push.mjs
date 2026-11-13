// Run locally in Termux. No wallet key access, no spending, no Taskmarket entry.
// Push a checked candidate to the contributor-only Forge task ref.
import { createHash, createPrivateKey, createPublicKey, randomBytes, sign } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const HOME=process.env.HOME;
const DIR=join(HOME,'.toyol','forge');
const HOST='https://agent-forge-hb.fly.dev';
const REMOTE=HOST+'/r/mech-market.git';
const ITEM='budget-ledger';
const TASK='0xa114b9accc85b6b110b1e8ac3a9b1434cfc34874c818dd2645b59abe05fd7d2d';
const HANDLE='self.toyol-digital-2c74870116';
const FILE='src/market/budget.mjs';
const CHECK='.plan/checks/budget-ledger.test.mjs';
const CANDIDATE='https://raw.githubusercontent.com/ilhamraduanbis-source/toyol-digital/9ad117a90e74458942d7931cbbc134af6017049e/deliverables/forge-budget-ledger/src/market/budget.mjs';
const STATE=join(DIR,'budget-ledger-push.json');
const need=(v,msg)=>{if(!v)throw Error(msg);};
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
async function request(url,options={}){
 const r=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(30000)});
 need(r.ok,'HTTP_'+r.status+'_'+new URL(url).pathname);
 const b=Buffer.from(await r.arrayBuffer());need(b.length<4000000,'RESPONSE_TOO_LARGE');return b;
}
const json=async(url,options)=>JSON.parse((await request(url,options)).toString('utf8'));
async function signed(path,obj,key,keyid){
 const u=new URL(HOST+path),body=JSON.stringify(obj),digest='sha-256=:'+createHash('sha256').update(body).digest('base64')+':';
 const now=Math.floor(Date.now()/1000);
 const params='("@method" "@scheme" "@authority" "@path" "@query" "content-digest" "content-type");created='+now+';expires='+(now+60)+';keyid="'+keyid+'";alg="ed25519";nonce="'+randomBytes(32).toString('base64')+'";tag="agent-browser-auth"';
 const base=['"@method": POST','"@scheme": https','"@authority": '+u.host,'"@path": '+u.pathname,'"@query": ?','"content-digest": '+digest,'"content-type": application/json','"@signature-params": '+params].join('\n');
 const signature=sign(null,Buffer.from(base),key).toString('base64');
 return json(u.toString(),{method:'POST',body,headers:{'content-type':'application/json','content-digest':digest,'signature-input':'sig2='+params,signature:'sig2=:'+signature+':'}});
}
const baseEnv={...process.env,GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1',GIT_TERMINAL_PROMPT:'0',GIT_TRACE:'0',GIT_TRACE_PACKET:'0',GIT_TRACE_CURL:'0',GIT_CURL_VERBOSE:'0'};
function run(cmd,args,cwd,env=baseEnv){
 const r=spawnSync(cmd,args,{cwd,env,encoding:'utf8',timeout:120000,maxBuffer:2*1024*1024});
 need(!r.error&&r.status===0,'LOCAL_COMMAND_FAILED_'+cmd+'_'+(r.status??'ERROR'));
 return r.stdout.trim();
}
async function gate(){
 const a=await json('https://api.taskmarket.dev/api/tasks/'+TASK),t=a.task??a;
 need((t.id??t.taskId)===TASK&&t.status==='open'&&t.mode==='bounty'&&Number(t.chainId)===4217&&String(t.reward)==='220000'&&t.stakeRequired===false,'TASK_CHANGED_OR_CLOSED');
 need(typeof t.description==='string'&&t.description.startsWith('Budget Ledger ($0.22)')&&t.description.includes('src/market/budget.mjs'),'TASK_SCOPE_CHANGED');
 const submit=(t.pendingActions??[]).find(x=>x.role==='worker'&&x.action==='submit');
 need(submit?.requiresPayment===false&&(!submit.dueAt||Date.parse(submit.dueAt)>Date.now()+120000),'SUBMISSION_NOT_FREE_OR_DEADLINE');
 const p=await json(HOST+'/v1/repos/mech-market/packets/'+ITEM);
 need(p.repo==='mech-market'&&p.item===ITEM&&p.git===REMOTE&&/^[a-f0-9]{40}$/.test(p.main),'FORGE_PACKET_CHANGED');
 return p;
}
async function main(){
 need(HOME&&process.env.PREFIX,'TERMUX_REQUIRED');
 need(!existsSync(STATE),'EXISTING_PUSH_RECORD_DO_NOT_REPEAT');
 const key=createPrivateKey(readFileSync(join(DIR,'agent.pem')));
 need(key.asymmetricKeyType==='ed25519','WRONG_KEY_TYPE');
 const {crv,kty,x}=createPublicKey(key).export({format:'jwk'});
 const keyid=createHash('sha256').update(JSON.stringify({crv,kty,x})).digest('base64url');
 const p=await gate();
 console.log('LIVE TASK OPEN; ZERO STAKE; SUBMISSION FREE');
 const tmp=mkdtempSync(join(DIR,'budget-work-'));
 try{
  const repo=join(tmp,'repo');
  run('git',['-c','credential.helper=','clone','--no-checkout','--single-branch','--branch','main',REMOTE,repo],tmp);
  const current=run('git',['rev-parse','refs/remotes/origin/main'],repo);
  need(current===p.main,'MAIN_MOVED_TRY_LATER');
  run('git',['-c','core.hooksPath=/dev/null','checkout','--detach',current],repo);
  need(!existsSync(join(repo,FILE)),'MODULE_ALREADY_EXISTS');
  const candidate=await request(CANDIDATE);
  need(blob(candidate)==='5d1d6e6d6d45a86e3945d40b288ff3d0283aa07d','CANDIDATE_INTEGRITY_FAILED');
  const frozen=readFileSync(join(repo,CHECK));
  need(blob(frozen)==='4f2319064f716ec3e109bb7171626a905b78cbc6','CUSTOMER_CHECK_CHANGED');
  mkdirSync(join(repo,'src','market'),{recursive:true});
  writeFileSync(join(repo,FILE),candidate);
  run(process.execPath,['--test',CHECK],repo);
  console.log('CUSTOMER ORIGINAL TESTS PASSED');
  run('git',['add','--',FILE],repo);
  need(run('git',['diff','--cached','--name-only'],repo)===FILE,'UNEXPECTED_CHANGED_FILES');
  run('git',['-c','user.name=Toyol Digital','-c','user.email=toyol-digital@invalid.example','-c','commit.gpgsign=false','-c','core.hooksPath=/dev/null','commit','-m','Implement immutable budget ledger'],repo);
  const commit=run('git',['rev-parse','HEAD'],repo);
  need(/^[a-f0-9]{40}$/.test(commit),'INVALID_COMMIT');
  const again=await gate();
  need(again.main===current,'MAIN_MOVED_BEFORE_PUSH');
  await signed('/v1/repos/mech-market/work',{item:ITEM,base:current,status:'working',paths:[FILE],note:'Toyol Digital: immutable ledger candidate, original check passed.'},key,keyid);
  const session=await signed('/v1/session',{},key,keyid);
  const d=session.data??session;
  const handle=d.handle??d.agent?.handle??d.session?.handle;
  const token=d.push_token??d.pushToken??d.token??d.session?.token??d.session?.push_token??d.session?.pushToken;
  need(handle===HANDLE&&typeof token==='string'&&token.length>8&&token.length<4096&&!/[\r\n]/.test(token),'SESSION_SCHEMA_OR_IDENTITY_UNVERIFIED');
  const askpass=join(tmp,'askpass');
  writeFileSync(askpass,'#!'+process.env.PREFIX+'/bin/sh\ncase "$1" in *Username*|*username*) printf "%s\\n" "$TOYOL_FORGE_HANDLE";; *) printf "%s\\n" "$TOYOL_FORGE_PUSH_TOKEN";; esac\n',{mode:0o700});
  const ref='refs/for/task/'+TASK+'/'+HANDLE;
  const record={task:TASK,handle:HANDLE,base:current,commit,ref,status:'push_attempted'};
  writeFileSync(STATE,JSON.stringify(record,null,2)+'\n',{mode:0o600,flag:'wx'});
  const push=spawnSync('git',['-c','credential.helper=','-c','credential.username='+HANDLE,'-c','core.hooksPath=/dev/null','push',REMOTE,'HEAD:'+ref],{cwd:repo,env:{...baseEnv,GIT_ASKPASS:askpass,TOYOL_FORGE_HANDLE:HANDLE,TOYOL_FORGE_PUSH_TOKEN:token},encoding:'utf8',timeout:120000,maxBuffer:2*1024*1024});
  need(!push.error&&push.status===0,'PUSH_NOT_CONFIRMED_DO_NOT_REPEAT_BLINDLY');
  const urls=((push.stdout??'')+'\n'+(push.stderr??'')).match(/https:\/\/agent-forge-hb\.fly\.dev\/v1\/repos\/mech-market\/checks\/[a-zA-Z0-9_-]+/g)??[];
  record.status='pushed';record.check_url=urls[0]??null;
  writeFileSync(STATE,JSON.stringify(record,null,2)+'\n',{mode:0o600});
  console.log('TOYOL FORGE PUSH CONFIRMED');
  console.log('Commit:',commit);
  if(record.check_url)console.log('Check:',record.check_url);
  console.log('Taskmarket entry NOT submitted; no payment claimed.');
 }finally{rmSync(tmp,{recursive:true,force:true});}
}
main().catch(e=>{console.error('TOYOL STOPPED:',String(e.message).slice(0,180));process.exitCode=1;});
