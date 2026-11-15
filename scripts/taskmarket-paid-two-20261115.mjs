// Run inside the already initialized Termux Taskmarket installation.
// Operator-authorized 2026-11-15: at most 0.002 USDC for these two entries.
// No key export, no deposits, no bridge, no account creation, no retries after uncertainty.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const API='https://api.taskmarket.dev';
const ADDRESS='0xac57ad3c3f233e5865c3cd652f67ffc82a7af431';
const TOKEN='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const REQUESTER='0xc5eede604aa6df03957903f2888280e3630f1ea9';
const raw='https://raw.githubusercontent.com/ilhamraduanbis-source/toyol-digital/';
const jobs=[
 {name:'Sales',id:'0x2d6c97c911c6dd928ced4a6cc1754ffff99dbd6de1cdba3132ba3e64b375f6ce',prefix:'Sales data storytelling.',expiry:'2026-11-15T06:54:38.730Z',escrow:'0xc624e91df3c68db93b2646d8e2156f7bbbb6a7a5b14629485ef954146af995e3',idem:'0acb9340-9f45-41c8-8ce2-659a4ba94c82',files:[['039f9231dde2aa33e4ff89f9a7bb6ec7ca4d3efe/deliverables/taskmarket-sales-20261115/report.md','a376ab27a9d17ebc88819643e66747633481a235']]},
 {name:'Markdown',id:'0xb9e4a1326704af63008ad7298351d2a6143be6de9371652ae1f85cc001d3ba88',prefix:'Markdown table-of-contents tool.',expiry:'2026-11-15T06:55:07.529Z',escrow:'0xeb25239345de88a5e02a6b4d8a2998dc9c9eb5d2cf31d5d31ddc38318d77d047',idem:'6b01b4d5-93da-4eaf-bd99-155f1a271adc',files:[['4b5a6131d2452c9dc724251b80b6ded40f54f1ac/deliverables/taskmarket-toc-20261115/toc.py','b5103be0f821f93ea8dadbe233c9069767fe3833'],['c2ee8baae47ee47aeccced757bb7225ffd08c9e4/deliverables/taskmarket-toc-20261115/notes.md','8977175cb7ec8aeb0bcc97eae2c5a5b4ae6e84c8']]}
];
const need=(v,m)=>{if(!v)throw Error(m)};
const root=path.join(os.homedir(),'.toyol','paid-20261115');
fs.mkdirSync(root,{recursive:true,mode:0o700});
const policy=path.join(root,'marketplace-policy.json');
const policyBody=JSON.stringify({version:2,networks:{'eip155:8453':{rpcUrlEnv:'BASE_RPC_URL'}},rules:[],marketplaceFees:[{network:'eip155:8453',asset:TOKEN,maxPerPayment:'1000',spendWindow:{seconds:86400,max:'2000'}}]},null,2);
if(fs.existsSync(policy))need(fs.readFileSync(policy,'utf8')===policyBody,'LOCAL_POLICY_CHANGED');
else fs.writeFileSync(policy,policyBody,{mode:0o600,flag:'wx'});
const env={...process.env,TASKMARKET_API_URL:API,TASKMARKET_X402_POLICY_PATH:policy};
function cli(args,extra={}){
 const r=spawnSync('taskmarket',['--network','base',...args],{env:{...env,...extra},encoding:'utf8',timeout:90000,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
 if(r.error||r.status!==0)throw Error('CLI_FAILED_'+args.slice(0,2).join('_')+'; inspect local receipts, do not retry paid writes blindly');
 let q;try{q=JSON.parse(r.stdout.trim())}catch{throw Error('CLI_JSON_UNAVAILABLE')}
 need(q.ok===true,'CLI_RESPONSE_NOT_OK');return q.data;
}
async function get(url){
 const r=await fetch(url,{headers:{Accept:'application/json,text/plain,*/*'},redirect:'error',signal:AbortSignal.timeout(20000)});
 need(r.ok,'HTTP_'+r.status);return Buffer.from(await r.arrayBuffer());
}
const json=async u=>JSON.parse((await get(u)).toString('utf8'));
const balance=()=>{
 const b=cli(['wallet','balance']);
 need(b.address?.toLowerCase()===ADDRESS&&b.chainId===8453&&b.tokenSymbol==='USDC'&&/^\d+$/.test(b.balanceBaseUnits),'BALANCE_IDENTITY_NOT_VERIFIED');
 return BigInt(b.balanceBaseUnits);
};
async function main(){
 const a=cli(['address']);need(a.address?.toLowerCase()===ADDRESS,'WRONG_WALLET_STOP');
 const start=balance();
 console.log('BASE_USDC_BALANCE_MICROS',String(start));
 // A public explorer returned zero despite historical receipts. Trust the actual CLI
 // onchain balance only after address/chain/token verification; do not fund if zero.
 need(start>=2000n,'INSUFFICIENT_EXISTING_USDC_NO_TOPUP');
 cli(['x402','policy','validate']);
 for(const j of jobs){
  const state=path.join(root,j.name+'.json');
  if(fs.existsSync(state)){console.log('SKIP_ALREADY_ATTEMPTED',j.name);continue;}
  if(Date.now()>=Date.parse(j.expiry)-120000){console.log('SKIP_DEADLINE',j.name);continue;}
  const d=await json(API+'/api/tasks/'+j.id+'?chainId=8453'),t=d.task??d;
  need(t.id===j.id&&t.chainId===8453&&t.requester?.toLowerCase()===REQUESTER&&t.description?.startsWith(j.prefix)&&t.escrowTxHash===j.escrow&&String(t.reward)==='500000'&&String(t.netReward)==='500000'&&t.status==='open'&&t.mode==='bounty'&&t.submissionWindowOpen===true&&t.stakeRequired===false&&t.submissionVisibility==='public'&&t.taskVisibility==='public'&&Date.parse(t.expiryTime)===Date.parse(j.expiry),'TASK_CHANGED_STOP_'+j.name);
  const own=cli(['task','my-submissions']);
  need(Array.isArray(own),'SUBMISSION_HISTORY_UNAVAILABLE');
  if(own.some(s=>s.taskId===j.id)){console.log('SKIP_ALREADY_ENTERED',j.name);continue;}
  const rows=await json(API+'/api/tasks/'+j.id+'/submissions?chainId=8453');
  need(Array.isArray(rows),'PUBLIC_SUBMISSIONS_UNAVAILABLE');
  if(rows.some(s=>s.workerAddress?.toLowerCase()===ADDRESS)){console.log('SKIP_PUBLIC_EXISTING',j.name);continue;}
  const work=fs.mkdtempSync(path.join(root,'entry-'));
  try{
   const files=[];
   for(const [url,sha] of j.files){
    const bytes=await get(raw+url);
    need(bytes.length>0&&bytes.length<1000000,'ARTIFACT_SIZE');
    const blob=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
    need(blob===sha,'ARTIFACT_HASH_MISMATCH');
    const f=path.join(work,path.basename(url));fs.writeFileSync(f,bytes,{mode:0o600,flag:'wx'});files.push(f);
   }
   need(balance()>=1000n,'INSUFFICIENT_EXISTING_USDC');
   need(Date.now()<Date.parse(j.expiry)-120000,'DEADLINE_TOO_CLOSE');
   fs.writeFileSync(state,JSON.stringify({status:'attempted',task:j.id,idempotencyKey:j.idem}),{mode:0o600,flag:'wx'});
   const result=cli(['task','submit',j.id,...files.flatMap(f=>['--file',f])],{TASKMARKET_IDEMPOTENCY_KEY:j.idem});
   need(typeof result.submissionId==='string'&&/^[a-zA-Z0-9_-]{8,150}$/.test(result.submissionId),'UNKNOWN_ENTRY_DO_NOT_RETRY');
   fs.writeFileSync(state,JSON.stringify({status:'submitted',task:j.id,idempotencyKey:j.idem,submissionId:result.submissionId}),{mode:0o600});
   console.log('TASKMARKET_SUBMITTED',j.name,result.submissionId);
   console.log('BALANCE_AFTER_MICROS',String(balance()));
  }finally{fs.rmSync(work,{recursive:true,force:true});}
 }
 console.log('DONE. Submission is not an award or payment.');
}
main().catch(e=>{console.error('SAFE_STOP',e.message);process.exitCode=1});
