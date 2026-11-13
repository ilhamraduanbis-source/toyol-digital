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
 const a=await json('https://api.taskmarket.dev/api/tasks/'+TASK),t=a.task??a;
 need((t.id??t.taskId)===TASK&&t.status==='open'&&t.mode==='bounty'&&Number(t.chainId)===4217&&String(t.reward)==='220000'&&t.stakeRequired===false,'TASK_CHANGED_OR_CLOSED');
 need(Number.isInteger(t.submissionCount)&&t.submissionCount<50,'FREE_ALLOWANCE_NOT_CONFIRMED');
 const submit=(t.pendingActions??[]).find(x=>x.role==='worker'&&x.action==='submit');
 need(submit?.requiresPayment===false&&(!submit.dueAt||Date.parse(submit.dueAt)>Date.now()+120000),'SUBMISSION_NOT_FREE_OR_DEADLINE');
 const c=await json(HOST+'/v1/repos/mech-market/checks/chk_B0KbSomyy07_SUuI');
 need(c.status==='passed'&&c.task===TASK&&c.agent?.handle===HANDLE&&c.done===true,'FORGE_CHECK_NOT_PASSED');
 const p=await signed('/v1/repos/mech-market/tasks/'+TASK+'/delivery',{commit:record.commit},key,keyid);
 const target=join(DIR,'budget-delivery-preparation.json');
 writeFileSync(target,JSON.stringify(p,null,2)+'\n',{mode:0o600});
 const d=p.data??p;
 console.log('FORGE DELIVERY PREPARATION');
 for(const [k,v] of Object.entries(d)){
  if(/^(ready|confirmed|status|code|reason|message|commit|task|task_id|check|idempotency_key|marketplace|entry|entry_text|submission|delivery|next|action|command|instructions|market_submission|marketplace_entry)$/i.test(k)){
   const clean=JSON.stringify(v,(key,value)=>/private|secret|token|authorization|credential|cookie|password/i.test(key)?undefined:value);
   if(clean!==undefined)console.log(k+': '+clean.slice(0,2500));
  }
 }
 console.log('RESPONSE KEYS:',Object.keys(d).join(', '));
 console.log('No Taskmarket submission or payment made in this step.');
}
main().catch(e=>{console.error('TOYOL STOPPED:',String(e.message).slice(0,180));process.exitCode=1;});
