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
 const record=JSON.parse(readFileSync(STATE,'utf8'));
 need(record.status==='pushed'&&record.task===TASK&&record.handle===HANDLE&&record.commit==='ea6767ec7f1804761ecdfb744b42ce02ad286292','PUSH_RECORD_MISMATCH');
 const key=createPrivateKey(readFileSync(join(DIR,'agent.pem')));
 const {crv,kty,x}=createPublicKey(key).export({format:'jwk'});
 const keyid=createHash('sha256').update(JSON.stringify({crv,kty,x})).digest('base64url');
 const wallet='0xac57ad3c3f233e5865c3cd652f67ffc82a7af431';
 const idem='45d1fdd5-99b9-41d4-9973-6be374216919';
 const path='/v1/repos/mech-market/tasks/'+TASK;
 const saved=join(DIR,'budget-market-entry.json');
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
  const p=await signed(path+'/delivery',{commit:record.commit,market_submission:id},key,keyid);
  const d=p.data??p;
  store({status:d.confirmed===true?'confirmed':'submitted',task:TASK,commit:record.commit,idempotency_key:idem,submissionId:id,confirmation_code:d.code??null});
  console.log('TASKMARKET ENTRY ID:',id);
  console.log('FORGE CONFIRMED:',d.confirmed===true);
  console.log('FORGE CODE:',String(d.code??'UNKNOWN'));
  if(d.confirmed!==true)console.log('Entry recorded. Do not submit again; only resume Forge confirmation.');
  else console.log('DELIVERY COMPLETE; awaiting requester decision, not yet paid.');
 }
 if(existsSync(saved)){
  const prior=JSON.parse(readFileSync(saved,'utf8'));
  need(prior.task===TASK&&prior.commit===record.commit&&prior.idempotency_key===idem,'EXISTING_ENTRY_STATE_MISMATCH');
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
 need(d.ready===true&&d.commit===record.commit&&d.task===TASK&&d.entry?.text===record.commit&&d.idempotency_key===idem,'FORGE_ENTRY_NOT_READY_OR_CHANGED');
 await live();
 const tmp=mkdtempSync(join(DIR,'budget-entry-'));
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
main().catch(e=>{console.error('TOYOL STOPPED:',String(e.message).slice(0,180));process.exitCode=1;});
