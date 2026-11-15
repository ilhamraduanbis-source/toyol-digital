// One-time recovery for the two explicitly authorized Taskmarket submissions.
// No deposits, no new wallet, no keys exported, no repeated paid writes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root=path.join(os.homedir(),'.toyol','paid-20261115');
const policy=path.join(root,'marketplace-policy.json');
const wallet='0xac57ad3c3f233e5865c3cd652f67ffc82a7af431';
const token='0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const api='https://api.taskmarket.dev';
const raw='https://raw.githubusercontent.com/ilhamraduanbis-source/toyol-digital/';
const jobs=[
 {name:'Sales',id:'0x2d6c97c911c6dd928ced4a6cc1754ffff99dbd6de1cdba3132ba3e64b375f6ce',prefix:'Sales data storytelling.',expiry:'2026-11-15T06:54:38.730Z',files:[['039f9231dde2aa33e4ff89f9a7bb6ec7ca4d3efe/deliverables/taskmarket-sales-20261115/report.md','a376ab27a9d17ebc88819643e66747633481a235']]},
 {name:'Markdown',id:'0xb9e4a1326704af63008ad7298351d2a6143be6de9371652ae1f85cc001d3ba88',prefix:'Markdown table-of-contents tool.',expiry:'2026-11-15T06:55:07.529Z',files:[['4b5a6131d2452c9dc724251b80b6ded40f54f1ac/deliverables/taskmarket-toc-20261115/toc.py','b5103be0f821f93ea8dadbe233c9069767fe3833'],['c2ee8baae47ee47aeccced757bb7225ffd08c9e4/deliverables/taskmarket-toc-20261115/notes.md','8977175cb7ec8aeb0bcc97eae2c5a5b4ae6e84c8']]}
];
const need=(v,m)=>{if(!v)throw Error(m)};
const env={...process.env,TASKMARKET_API_URL:api,TASKMARKET_X402_POLICY_PATH:policy,BASE_RPC_URL:'https://mainnet.base.org'};
delete env.TASKMARKET_IDEMPOTENCY_KEY;
function cli(args){
 const r=spawnSync('taskmarket',['--network','base',...args],{env,encoding:'utf8',timeout:90000,maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']});
 let q;
 try{q=JSON.parse(r.stdout.trim())}catch{}
 if(r.status===0&&q?.ok===true)return q.data;
 try{q=JSON.parse(r.stderr.trim())}catch{}
 const e=q?.error;
 // Only report public error labels and bounded message, never raw headers or keys.
 const msg=typeof e==='string'?e:typeof e?.message==='string'?e.message:typeof q?.message==='string'?q.message:'CLI returned no structured error';
 const code=e?.code??e?.details?.code??q?.code??'UNKNOWN';
 console.log('CLI_ERROR',JSON.stringify({command:args.slice(0,3),code:typeof code==='string'?code.slice(0,100):'UNKNOWN',message:msg.slice(0,900),pending:q?.pending===true||e?.pending===true,exit:r.status}));
 throw Error('COMMAND_FAILED');
}
function balance(){
 const b=cli(['wallet','balance']);
 need(b.address?.toLowerCase()===wallet&&b.chainId===8453&&b.tokenSymbol==='USDC'&&/^\d+$/.test(b.balanceBaseUnits),'WALLET_MISMATCH');
 return BigInt(b.balanceBaseUnits);
}
function payments(){
 const d=cli(['x402','payments','list']);
 need(Array.isArray(d?.payments),'PAYMENT_JOURNAL_SCHEMA');
 return d.payments;
}
function relevant(p,j){
 return p.origin===api&&p.payer?.toLowerCase()===wallet&&p.network==='eip155:8453'&&p.asset?.toLowerCase()===token&&p.ruleId==='taskmarket:first-party'&&typeof p.pathname==='string'&&p.pathname.startsWith('/api/tasks/'+j.id+'/submissions');
}
function submitted(j){
 const s=cli(['task','my-submissions']);
 need(Array.isArray(s),'SUBMISSION_HISTORY_SCHEMA');
 return s.some(v=>v.taskId===j.id);
}
function eligible(j){
 const t=cli(['task','get',j.id]);
 need(t.id===j.id&&t.chainId===8453&&t.status==='open'&&t.mode==='bounty'&&t.submissionWindowOpen===true&&t.stakeRequired===false&&String(t.reward)==='500000'&&t.description?.startsWith(j.prefix)&&Date.parse(t.expiryTime)===Date.parse(j.expiry)&&Date.now()<Date.parse(j.expiry)-120000,'TASK_NOT_ELIGIBLE');
}
async function main(){
 const p=JSON.parse(fs.readFileSync(policy,'utf8'));
 need(p.version===2&&p.rules?.length===0&&p.marketplaceFees?.length===1&&p.networks?.['eip155:8453']?.rpcUrlEnv==='BASE_RPC_URL','POLICY_MISMATCH');
 const f=p.marketplaceFees[0];
 need(f.network==='eip155:8453'&&f.asset?.toLowerCase()===token&&f.maxPerPayment==='1000'&&f.spendWindow?.seconds===86400&&f.spendWindow?.max==='2000','FEE_CAP_MISMATCH');
 cli(['x402','policy','validate']);
 console.log('BALANCE_MICROS',String(balance()));
 for(const j of jobs){
  if(submitted(j)){console.log('ALREADY_SUBMITTED',j.name);continue}
  if(Date.now()>=Date.parse(j.expiry)-120000){console.log('CLOSED_OR_TOO_LATE',j.name);continue}
  // Do not retry an unknown payment until its nonce is reconciled.
  for(const row of payments().filter(p=>relevant(p,j)&&p.state==='unknown')){
   const expires=Date.parse(row.authorizationExpiresAt);
   need(Number.isFinite(expires)&&expires<Date.now()&&/^[a-f0-9-]{36}$/i.test(row.id),'PENDING_AUTHORIZATION_NOT_EXPIRED');
   cli(['x402','payments','reconcile',row.id]);
   const updated=payments().find(p=>p.id===row.id);
   console.log('RECONCILED',j.name,row.id,updated?.state??'MISSING');
   need(updated?.state==='expired_unspent','PREVIOUS_CHARGE_UNRESOLVED_OR_SPENT');
  }
  need(payments().filter(p=>relevant(p,j)).every(p=>p.state==='expired_unspent'),'PREVIOUS_FEE_REQUIRES_REVIEW');
  if(submitted(j)){console.log('ALREADY_SUBMITTED_AFTER_RECONCILE',j.name);continue}
  eligible(j);
  need(balance()>=1000n,'INSUFFICIENT_EXISTING_FUNDS');
  const marker=path.join(root,'recovery-'+j.name+'.json');
  if(fs.existsSync(marker)){console.log('RECOVERY_ALREADY_ATTEMPTED',j.name);continue}
  const work=fs.mkdtempSync(path.join(root,'recovery-files-'));
  try{
   const files=[];
   for(const [url,sha] of j.files){
    const r=await fetch(raw+url,{redirect:'error',signal:AbortSignal.timeout(20000)});
    need(r.ok,'ARTIFACT_HTTP_'+r.status);
    const b=Buffer.from(await r.arrayBuffer());
    need(b.length>0&&b.length<1000000&&createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex')===sha,'ARTIFACT_HASH');
    const file=path.join(work,path.basename(url));fs.writeFileSync(file,b,{mode:0o600,flag:'wx'});files.push(file);
   }
   eligible(j);
   fs.writeFileSync(marker,JSON.stringify({task:j.id,status:'attempted'}),{mode:0o600,flag:'wx'});
   const result=cli(['task','submit',j.id,...files.flatMap(f=>['--file',f])]);
   need(typeof result?.submissionId==='string'&&/^[a-zA-Z0-9_-]{8,150}$/.test(result.submissionId),'SUBMISSION_RECEIPT_UNCERTAIN');
   fs.writeFileSync(marker,JSON.stringify({task:j.id,status:'submitted',submissionId:result.submissionId}),{mode:0o600});
   console.log('SUBMITTED',j.name,result.submissionId);
   console.log('BALANCE_AFTER_MICROS',String(balance()));
  }finally{fs.rmSync(work,{recursive:true,force:true})}
 }
 console.log('RECOVERY_FINISHED. Submission is not income.');
}
main().catch(e=>{console.error('SAFE_STOP',e.message);process.exitCode=1});
