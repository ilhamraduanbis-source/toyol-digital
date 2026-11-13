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
const ITEM='stream-replay';
const TASK='0xd0339fc83b4591024b407fa2a91fb28b0ff35178d4f2b3166b9e51adc96a59d5';
const HANDLE='self.toyol-digital-2c74870116';
const FILE='src/server/stream.mjs';
const CHECK='.plan/checks/stream-replay.test.mjs';
const CANDIDATE='https://raw.githubusercontent.com/ilhamraduanbis-source/toyol-digital/777d55c8537088c60e72f6b159d4d1e0b4ead4c7/deliverables/forge-stream-replay/src/server/stream.mjs';
const STATE=join(DIR,'stream-replay-push.json');
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
 need(typeof t.description==='string'&&t.description.startsWith('Stream Replay ($0.22)')&&t.description.includes('src/server/stream.mjs'),'TASK_SCOPE_CHANGED');
 const submit=(t.pendingActions??[]).find(x=>x.role==='worker'&&x.action==='submit');
 need(submit?.requiresPayment===false&&(!submit.dueAt||Date.parse(submit.dueAt)>Date.now()+120000),'SUBMISSION_NOT_FREE_OR_DEADLINE');
 const p=await json(HOST+'/v1/repos/mech-market/packets/'+ITEM);
 need(p.repo==='mech-market'&&p.item===ITEM&&p.git===REMOTE&&/^[a-f0-9]{40}$/.test(p.main),'FORGE_PACKET_CHANGED');
 return p;
}
async function pushCandidate(){
 need(HOME&&process.env.PREFIX,'TERMUX_REQUIRED');
 need(!existsSync(STATE),'EXISTING_PUSH_RECORD_DO_NOT_REPEAT');
 const key=createPrivateKey(readFileSync(join(DIR,'agent.pem')));
 need(key.asymmetricKeyType==='ed25519','WRONG_KEY_TYPE');
 const {crv,kty,x}=createPublicKey(key).export({format:'jwk'});
 const keyid=createHash('sha256').update(JSON.stringify({crv,kty,x})).digest('base64url');
 const p=await gate();
 console.log('LIVE TASK OPEN; ZERO STAKE; SUBMISSION FREE');
 const tmp=mkdtempSync(join(DIR,'stream-work-'));
 try{
  const repo=join(tmp,'repo');
  run('git',['-c','credential.helper=','clone','--no-checkout','--single-branch','--branch','main',REMOTE,repo],tmp);
  const current=run('git',['rev-parse','refs/remotes/origin/main'],repo);
  need(current===p.main,'MAIN_MOVED_TRY_LATER');
  run('git',['-c','core.hooksPath=/dev/null','checkout','--detach',current],repo);
  need(!existsSync(join(repo,FILE)),'MODULE_ALREADY_EXISTS');
  const candidate=await request(CANDIDATE);
  need(blob(candidate)==='bace0285c183a751f3ac79bb0499da3304fb9d6a','CANDIDATE_INTEGRITY_FAILED');
  const frozen=readFileSync(join(repo,CHECK));
  need(blob(frozen)==='4e902315ee394272ee1a9e0942e2a8c91b6b9cd7','CUSTOMER_CHECK_CHANGED');
  mkdirSync(join(repo,'src','server'),{recursive:true});
  writeFileSync(join(repo,FILE),candidate);
  run(process.execPath,['--test',CHECK],repo);
  console.log('CUSTOMER ORIGINAL TESTS PASSED');
  run('git',['add','--',FILE],repo);
  need(run('git',['diff','--cached','--name-only'],repo)===FILE,'UNEXPECTED_CHANGED_FILES');
  run('git',['-c','user.name=Toyol Digital','-c','user.email=toyol-digital@invalid.example','-c','commit.gpgsign=false','-c','core.hooksPath=/dev/null','commit','-m','Implement ordered SSE replay'],repo);
  const commit=run('git',['rev-parse','HEAD'],repo);
  need(/^[a-f0-9]{40}$/.test(commit),'INVALID_COMMIT');
  const again=await gate();
  need(again.main===current,'MAIN_MOVED_BEFORE_PUSH');
  await signed('/v1/repos/mech-market/work',{item:ITEM,base:current,status:'working',paths:[FILE],note:'Toyol Digital: ordered SSE replay candidate, original check passed.'},key,keyid);
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

async function finishEntry(){
 const record=JSON.parse(readFileSync(STATE,'utf8'));
 need(record.status==='pushed'&&record.task===TASK&&record.handle===HANDLE&&/^[a-f0-9]{40}$/.test(record.commit),'PUSH_RECORD_MISMATCH');
 const key=createPrivateKey(readFileSync(join(DIR,'agent.pem')));
 const {crv,kty,x}=createPublicKey(key).export({format:'jwk'});
 const keyid=createHash('sha256').update(JSON.stringify({crv,kty,x})).digest('base64url');
 const wallet='0xac57ad3c3f233e5865c3cd652f67ffc82a7af431';
 let idem=null;
 const path='/v1/repos/mech-market/tasks/'+TASK;
 const saved=join(DIR,'stream-market-entry.json');
 const cliEnv={...process.env,TASKMARKET_API_URL:'https://api.taskmarket.dev'};
 function cli(args,env=cliEnv){
  const p=spawnSync('taskmarket',['--network','tempo',...args],{env,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
  need(!p.error&&p.status===0,'TASKMARKET_COMMAND_FAILED_DO_NOT_RETRY_BLINDLY');
  const q=JSON.parse(p.stdout.trim());need(q.ok===true,'TASKMARKET_RESPONSE_NOT_CONFIRMED');return q;
 }
 const me=cli(['whoami']).data;
 need(me.wallet?.toLowerCase()===wallet&&me.network==='tempo'&&me.chains?.some(z=>z.chainId===4217&&String(z.agentId)==='834'),'TASKMARKET_IDENTITY_MISMATCH');
 async function live(){
  const a=await json('https://api.taskmarket.dev/api/tasks/'+TASK),t=a.task??a;
  need((t.id??t.taskId)===TASK&&t.status==='open'&&t.mode==='bounty'&&Number(t.chainId)===4217&&String(t.reward)==='220000'&&t.stakeRequired===false,'TASK_CHANGED_OR_CLOSED');
  need(t.submissionWindowOpen!==false&&Number.isInteger(t.submissionCount)&&t.submissionCount<50,'FREE_ALLOWANCE_NOT_CONFIRMED');
  const submit=(t.pendingActions??[]).find(x=>x.role==='worker'&&x.action==='submit');
  need(submit?.requiresPayment===false&&(!submit.dueAt||Date.parse(submit.dueAt)>Date.now()+120000),'SUBMISSION_NOT_FREE_OR_DEADLINE');
 }
 function store(obj,first=false){writeFileSync(saved,JSON.stringify(obj,null,2)+'\n',{mode:0o600,...(first?{flag:'wx'}:{})});}
 async function confirm(id){
  let p=await signed(path+'/delivery',{commit:record.commit,market_submission:id},key,keyid);
  let d=p.data??p;
  const retryable=['check_stale','check_missing','check_required','checking'];
  if(d.confirmed!==true&&retryable.includes(d.code)){
   if(d.code!=='checking')await signed(path+'/checks',{commit:record.commit},key,keyid);
   for(let i=0;i<12;i++){await new Promise(resolve=>setTimeout(resolve,5000));p=await signed(path+'/delivery',{commit:record.commit,market_submission:id},key,keyid);d=p.data??p;if(d.confirmed===true||!retryable.includes(d.code))break;}
  }
  store({status:d.confirmed===true?'confirmed':'submitted',task:TASK,commit:record.commit,idempotency_key:idem,submissionId:id,confirmation_code:d.code??null});
  console.log('TASKMARKET ENTRY ID:',id);
  console.log('FORGE CONFIRMED:',d.confirmed===true);
  console.log('FORGE CODE:',String(d.code??'UNKNOWN'));
  if(d.confirmed!==true)console.log('Entry recorded. Do not submit again; only resume Forge confirmation.');
  else console.log('DELIVERY COMPLETE; awaiting requester decision, not yet paid.');
 }
 if(existsSync(saved)){
  const prior=JSON.parse(readFileSync(saved,'utf8'));
  need(prior.task===TASK&&prior.commit===record.commit&&typeof prior.idempotency_key==='string','EXISTING_ENTRY_STATE_MISMATCH');
  idem=prior.idempotency_key;
  if(prior.status==='confirmed'){console.log('ALREADY CONFIRMED:',prior.submissionId);return;}
  if(prior.status==='submitted'&&typeof prior.submissionId==='string'){await confirm(prior.submissionId);return;}
  throw Error('PREVIOUS_ATTEMPT_UNCERTAIN_DO_NOT_RESUBMIT');
 }
 await live();
 const rows=cli(['task','submissions',TASK]).data;
 need(Array.isArray(rows)&&rows.length<50,'SUBMISSION_LIST_UNVERIFIED');
 need(!rows.some(z=>String(z.workerAddress??'').toLowerCase()===wallet),'EXISTING_WORKER_ENTRY_DO_NOT_REPEAT');
 let p=await signed(path+'/delivery',{commit:record.commit},key,keyid),d=p.data??p;
 if(d.ready!==true){
  need(['check_stale','check_missing','check_required','checking'].includes(d.code),'DELIVERY_BLOCKED_'+String(d.code??'UNKNOWN'));
  if(d.code!=='checking')await signed(path+'/checks',{commit:record.commit},key,keyid);
  for(let i=0;i<10;i++){await new Promise(resolve=>setTimeout(resolve,6000));p=await signed(path+'/delivery',{commit:record.commit},key,keyid);d=p.data??p;if(d.ready===true)break;need(['checking','check_stale','check_missing','check_required'].includes(d.code),'DELIVERY_BLOCKED_'+String(d.code??'UNKNOWN'));}
 }
 need(d.ready===true&&d.commit===record.commit&&d.task===TASK&&d.entry?.text===record.commit&&typeof d.idempotency_key==='string'&&/^[0-9a-f-]{36}$/i.test(d.idempotency_key),'FORGE_ENTRY_NOT_READY_OR_CHANGED');
 idem=d.idempotency_key;
 await live();
 const tmp=mkdtempSync(join(DIR,'stream-entry-'));
 try{
  const file=join(tmp,'proof-'+TASK.slice(2,10)+'-'+record.commit.slice(0,10)+'.txt');
  writeFileSync(file,d.entry.text,{mode:0o600});
  const policy=join(tmp,'zero-fee-policy.json');
  // Documented fail-closed policy: any fee must read this file; free submissions do not.
  // Intentionally invalid JSON to prohibit signing a fee even if the free allowance changes.
  // This is isolated to this child process and never modifies the owner's normal policy.
  writeFileSync(policy,'TOYOL_DENY_ALL_FEES',{mode:0o600});
  store({status:'attempted',task:TASK,commit:record.commit,idempotency_key:idem},true);
  const q=cli(['task','submit',TASK,'--file',file,'--role','final'],{...cliEnv,TASKMARKET_IDEMPOTENCY_KEY:idem,TASKMARKET_X402_POLICY_PATH:policy});
  const id=q.data?.submissionId;
  need(typeof id==='string'&&/^[a-zA-Z0-9_-]{8,150}$/.test(id),'ENTRY_ID_UNKNOWN_DO_NOT_RESUBMIT');
  store({status:'submitted',task:TASK,commit:record.commit,idempotency_key:idem,submissionId:id});
  console.log('TASKMARKET SUBMITTED:',id);
  if(Array.isArray(q.warnings))for(const w of q.warnings)console.log('WARNING:',String(w.code??'UNKNOWN'));
  await confirm(id);
 }finally{rmSync(tmp,{recursive:true,force:true});}
}

async function main(){if(!existsSync(STATE))await pushCandidate();await finishEntry();}
main().catch(e=>{console.error('TOYOL STOPPED:',String(e.message).slice(0,180));process.exitCode=1;});
