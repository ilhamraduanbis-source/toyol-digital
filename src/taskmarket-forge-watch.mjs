// Public read-only observer for confirmed Forge/Taskmarket entries.
// Platform awards are not independently verified settlement; never report as cash.
import {readFileSync} from 'node:fs';
const JOBS=[
 {TASK:'0xa114b9accc85b6b110b1e8ac3a9b1434cfc34874c818dd2645b59abe05fd7d2d',ENTRY:'c4e99302-4645-433c-b46a-35c8c64a4c98',COMMIT:'ea6767ec7f1804761ecdfb744b42ce02ad286292',title:'Budget Ledger',reward:'220000'},
 {TASK:'0xd0339fc83b4591024b407fa2a91fb28b0ff35178d4f2b3166b9e51adc96a59d5',ENTRY:'4a7f0236-76ad-4fc3-915e-fb7e63c410b1',COMMIT:'444ad5a6de0aab1f37116e13d707b521a3c349f8',title:'Stream Replay',reward:'220000'},
 {TASK:'0x92919ff998afa6eb4d919457567e93d930d011dc98783840c7e0915e789a4b6b',ENTRY:'0302d62c-2d7e-4122-b4ad-1cb2d1fedf10',COMMIT:'e0e4ff8b57afa4be61acfeabd6fbc9b7ed8d4a31',title:'Capture & Search',reward:'4000000'},
 {TASK:'0x94013e835f1b58aab608d8bc17b8faf18f73ee0ec7a39a253e036edf3afd537c',ENTRY:'96632608-15a3-4aac-bce7-a6563cfbb1a3',COMMIT:'890d3cf37de6937f282496b7f9a7b184a0fca35a',title:'Connected Workspace',reward:'6000000'}
];
const WALLET='0xac57ad3c3f233e5865c3cd652f67ffc82a7af431';
const HANDLE='self.toyol-digital-2c74870116';
const ROOT='https://api.taskmarket.dev';
const safe=v=>typeof v==='string'&&/^[a-zA-Z0-9_:-]{1,150}$/.test(v)?v:null;
const lower=v=>typeof v==='string'?v.toLowerCase():'';
async function get(path){
 const r=await fetch(ROOT+path,{headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('HTTP_'+r.status);
 const text=await r.text();if(text.length>3000000)throw Error('TOO_LARGE');
 return JSON.parse(text);
}
async function inspect({TASK,ENTRY,COMMIT,title,reward}){
 const j=await get('/api/tasks/'+TASK),t=j.task??j;
 if((t.id??t.taskId)!==TASK||Number(t.chainId)!==4217)throw Error('TASK_IDENTITY_MISMATCH');
 const awards=Array.isArray(t.awards)?t.awards:[];
 const own=awards.filter(a=>String(a.submissionId??a.submission_id??'')===ENTRY&&lower(a.workerAddress??a.worker??a.worker_address)===WALLET);
 const out={title,task:TASK,entry:ENTRY,commit:COMMIT,forge_handle:HANDLE,
  delivery:'FORGE_CONFIRMED_BY_OWNER_SCREENSHOT_2026_11_13',
  task_status:safe(t.status),phase:safe(t.phase),submission_count:Number.isInteger(t.submissionCount)?t.submissionCount:null,
  award_count:Number.isInteger(t.awardCount)?t.awardCount:null,
  matching_public_awards:own.length,
  possible_award_evidence:own.map(a=>({status:safe(a.status),worker_payment_micros:String(a.workerPayment??'').match(/^\d+$/)?.[0]??null,settlement_tx:/^0x[a-fA-F0-9]{64}$/.test(a.settlementTxHash??'')?a.settlementTxHash:null})),
  currency:'OUSD',advertised_reward_micros:reward,
  payment:'NOT_INDEPENDENTLY_VERIFIED'};
 console.log('TASKMARKET_TRACKED '+JSON.stringify(out));
 // A matching award still requires canonical token, successful receipt, transfer recipient,
 // amount, and finality validation on Tempo. No payout notification or income inference here.
}
async function observeQueue(){
 const q=JSON.parse(readFileSync(new URL('../runner/queue.json',import.meta.url),'utf8'));
 if(q.version!==1||!Array.isArray(q.jobs)||q.jobs.length>8)throw Error('QUEUE_INVALID');
 for(const j of q.jobs){
  if(!/^0x[a-f0-9]{64}$/.test(j.task)||!/^[-a-z0-9]{1,64}$/.test(j.item)||!['mech-market','hobby-hub'].includes(j.repo)||JOBS.some(x=>x.TASK===j.task))continue;
  try{
   const a=await get('/api/tasks/'+j.task),t=a.task??a;
   if((t.id??t.taskId)!==j.task||Number(t.chainId)!==4217)throw Error('TASK_IDENTITY_MISMATCH');
   const rows=await get('/api/tasks/'+j.task+'/submissions?chainId=4217');
   if(!Array.isArray(rows))throw Error('SUBMISSIONS_SCHEMA');
   const own=rows.filter(z=>z.taskId===j.task&&lower(z.workerAddress)===WALLET&&typeof z.id==='string'&&/^[a-zA-Z0-9_-]{8,150}$/.test(z.id));
   const awards=(Array.isArray(t.awards)?t.awards:[]).filter(a=>own.some(z=>z.id===a.submissionId)&&lower(a.workerAddress??a.worker)===WALLET);
   console.log('RUNNER_QUEUE_OBSERVED '+JSON.stringify({item:j.item,task:j.task,source_commit:j.sourceCommit,task_status:safe(t.status),own_submissions:own.map(z=>({id:z.id,rejected:Boolean(z.rejectedAt)})),matching_awards:awards.length,forge_confirmation:'NOT_ESTABLISHED_BY_SUBMISSION_LIST',payment:'NOT_INDEPENDENTLY_VERIFIED'}));
  }catch(e){console.log('RUNNER_QUEUE_UNAVAILABLE '+j.item+' '+safe(e.message));}
 }
}
async function main(){
 await observeQueue();
 for(const job of JOBS){
  try{await inspect(job);}catch(e){console.log('TASKMARKET_STATUS_UNAVAILABLE '+job.title+' '+safe(e.message));process.exitCode=1;}
 }
}
main().catch(e=>{console.log('TASKMARKET_STATUS_UNAVAILABLE '+safe(e.message));process.exitCode=1;});
