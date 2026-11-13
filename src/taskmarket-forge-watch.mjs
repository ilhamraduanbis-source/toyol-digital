// Public read-only observer for the exact submitted Forge/Taskmarket job.
// Platform awards are not independently verified settlement; never report as cash.
const TASK='0xa114b9accc85b6b110b1e8ac3a9b1434cfc34874c818dd2645b59abe05fd7d2d';
const ENTRY='c4e99302-4645-433c-b46a-35c8c64a4c98';
const WALLET='0xac57ad3c3f233e5865c3cd652f67ffc82a7af431';
const HANDLE='self.toyol-digital-2c74870116';
const COMMIT='ea6767ec7f1804761ecdfb744b42ce02ad286292';
const ROOT='https://api.taskmarket.dev';
const safe=v=>typeof v==='string'&&/^[a-zA-Z0-9_:-]{1,150}$/.test(v)?v:null;
const lower=v=>typeof v==='string'?v.toLowerCase():'';
async function get(path){
 const r=await fetch(ROOT+path,{headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('HTTP_'+r.status);
 const text=await r.text();if(text.length>3000000)throw Error('TOO_LARGE');
 return JSON.parse(text);
}
async function main(){
 const j=await get('/api/tasks/'+TASK),t=j.task??j;
 if((t.id??t.taskId)!==TASK||Number(t.chainId)!==4217)throw Error('TASK_IDENTITY_MISMATCH');
 const awards=Array.isArray(t.awards)?t.awards:[];
 const own=awards.filter(a=>String(a.submissionId??a.submission_id??'')===ENTRY&&lower(a.workerAddress??a.worker??a.worker_address)===WALLET);
 const out={task:TASK,entry:ENTRY,commit:COMMIT,forge_handle:HANDLE,
  delivery:'FORGE_CONFIRMED_BY_OWNER_SCREENSHOT_2026_11_13',
  task_status:safe(t.status),phase:safe(t.phase),submission_count:Number.isInteger(t.submissionCount)?t.submissionCount:null,
  award_count:Number.isInteger(t.awardCount)?t.awardCount:null,
  matching_public_awards:own.length,
  possible_award_evidence:own.map(a=>({status:safe(a.status),worker_payment_micros:String(a.workerPayment??'').match(/^\d+$/)?.[0]??null,settlement_tx:/^0x[a-fA-F0-9]{64}$/.test(a.settlementTxHash??'')?a.settlementTxHash:null})),
  currency:'OUSD',advertised_reward_micros:'220000',
  payment:'NOT_INDEPENDENTLY_VERIFIED'};
 console.log('TASKMARKET_TRACKED '+JSON.stringify(out));
 // A matching award still requires canonical token, successful receipt, transfer recipient,
 // amount, and finality validation on Tempo. No payout notification or income inference here.
}
main().catch(e=>{console.log('TASKMARKET_STATUS_UNAVAILABLE '+safe(e.message));process.exitCode=1;});
