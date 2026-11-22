/**
 * Toyol verified TaskMarket outcome watcher.
 * Public read only: scans tasks + own existing pitches/submissions.
 * GitHub Issue notification ONLY for own selected/accepted/reported-tx changes.
 * Escrow, submission and award are not wallet settlement.
 * No wallet key, signing, claim, external bid or paid request in this program.
 */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const REPO='ilhamraduanbis-source/toyol-digital';
const WALLET='0xac57ad3c3f233e5865c3cd652f67ffc82a7af431';
const BASE='https://api.taskmarket.dev';
const JOBS=[
  {name:'Lumen House pitch',id:'0x2e4f6c554593a02a9c8cf8ba291db09c863b5fe07a0c4ea96a032ad40eb3b50e',chainId:8453,kind:'pitches',recordId:'9b42b166-d144-4da6-b140-f0eff7df7b7f'},
  {name:'Spanish infographic',id:'0x2b7ccfc7bf4bfd086a8e809082bc4b113ec3310dc65c790791985e5ec9e3409a',chainId:4217,kind:'submissions',recordId:'1625581d-1bcd-40da-a9eb-9138d66c7dea'},
  {name:'Spanish video',id:'0x7974a2831dbe25f693f84420b8534045a4d2f5915dad67dc0eb59702864e574b',chainId:4217,kind:'submissions',recordId:'36730de8-d3ee-46de-a618-98ec0448121f'},
  {name:'Hero illustration',id:'0x83a813516e7796e0281f5c9d9c3fe75482205da76779372f54b09bff6b121b26',chainId:4217,kind:'submissions',recordId:'5bfac545-2c6e-4b8c-a033-f77cc5e94ce5'},
  {name:'Hero 2 — mechanical leverage',id:'0xbbbfba707ab89aa0d3caae8b3e5e47eedabadefc877d87baf5739723dbd7e38e',chainId:4217,kind:'submissions',recordId:'93253245-bc61-4cdb-86fe-e6c149112fd4'}
];
const norm=x=>String(x??'').trim().toLowerCase();
const isOwn=x=>norm(x)===WALLET;
const ownRecord=(records,job)=>Array.isArray(records)?records.find(x=>norm(x.id)===job.recordId&&isOwn(x.workerAddress)):null;
const ownAward=(task)=>Array.isArray(task.awards)?task.awards.find(a=>[a.workerAddress,a.worker,a.payee,a.recipient,a.winner].some(isOwn)):null;
function eventsFor(task,records,job){
 const r=ownRecord(records,job);
 if(!r)return {missingRecord:true,events:[]};
 const events=[];
 const award=ownAward(task);
 const rs=norm(r.status);
 const selected=(job.kind==='pitches'&&['selected','hired','accepted','won'].includes(rs))||
   (job.kind==='pitches'&&(isOwn(task.claimedBy)||isOwn(task.workerAddress)));
 if(selected)events.push({type:'SELECTED',meaning:'Worker selected; work still must be accepted',evidence:'pitch status='+rs});
 const accepted=!!award || ['accepted','awarded','approved','won'].includes(rs) || !!r.acceptedAt;
 if(accepted)events.push({type:'ACCEPTED_CANDIDATE',meaning:'Reported accepted/awarded; NOT proof of transferred funds',evidence:'record status='+rs+(award?'; own award object present':'')});
 const tx=String(r.payoutTxHash||r.paymentTxHash||r.settlementTxHash||award?.payoutTxHash||award?.txHash||'');
 if(/^0x[a-fA-F0-9]{64}$/.test(tx))
   events.push({type:'SETTLEMENT_TX_REPORTED',meaning:'Transaction hash reported, independent on-chain payment verification still required',evidence:tx});
 return {missingRecord:false,recordStatus:rs,events};
}
function test(){
 const job=JOBS[0],r={id:job.recordId,workerAddress:WALLET,status:'pending'};
 assert.equal(eventsFor({awards:[]},[r],job).events.length,0);
 assert.equal(eventsFor({awards:[{workerAddress:'0x9999'}]},[r],job).events.length,0);
 assert.equal(eventsFor({awards:[]},[],job).missingRecord,true);
 assert.equal(eventsFor({awards:[]},[{...r,workerAddress:'0x111'}],job).missingRecord,true);
 assert.equal(eventsFor({awards:[]},[{...r,status:'selected'}],job).events[0].type,'SELECTED');
 assert.equal(eventsFor({awards:[{workerAddress:WALLET}]},[r],job).events[0].type,'ACCEPTED_CANDIDATE');
 assert.equal(eventsFor({awards:[]},[{...r,payoutTxHash:'0x'+'a'.repeat(64)}],job).events[0].type,'SETTLEMENT_TX_REPORTED');
 assert.equal(eventsFor({awards:[]},[{...r,payoutTxHash:'0x123'}],job).events.length,0);
 console.log('TASKMARKET_OUTCOME_TEST_OK 8');
}
if(process.argv.includes('--self-test')){test();process.exit(0);}
test();
const GH_TOKEN=process.env.GH_TOKEN;
if(process.env.GITHUB_REPOSITORY!==REPO||process.env.GITHUB_REF!=='refs/heads/main')throw Error('UNEXPECTED_REPO_CONTEXT');
async function getJson(url,headers={}){
 const res=await fetch(url,{headers:{Accept:'application/json',...headers},redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!res.ok)throw Error('HTTP_'+res.status+' '+new URL(url).hostname);
 return res.json();
}
const GH='https://api.github.com/repos/'+REPO;
let existing=[];
async function notify(job,event){
 if(!GH_TOKEN){console.log('NOTIFY_SKIPPED_NO_TOKEN');return}
 if(!existing.length){
   const z=await getJson(GH+'/issues?state=all&per_page=100',{Authorization:'Bearer '+GH_TOKEN});
   if(!Array.isArray(z))throw Error('GITHUB_ISSUES_NOT_LIST');
   existing=z;
 }
 const marker='TOYOL_TASKMARKET_SIGNAL:'+job.id+':'+event.type;
 if(existing.some(i=>i.body?.includes(marker))){console.log('DUPLICATE_ALERT_SUPPRESSED '+marker);return}
 const title='Toyol TaskMarket '+event.type+' — '+job.name;
 const body=[
 '## Actionable Toyol outcome detected','',
 '**Signal:** '+event.type,'**Meaning:** '+event.meaning,
 '**Task:** '+job.name,'**Existing record:** '+job.recordId,'',
 'Primary source: https://taskmarket.dev/tasks/'+job.id,
 'API: '+BASE+'/api/tasks/'+job.id,
 'Wallet matches the previously recorded Toyol address.','',
 '**Evidence:** '+event.evidence,
 '**Warning:** This issue is NOT confirmation of a wallet transfer or earned income until independently verified on chain. Do not resubmit or incur fees.','',
 '<!-- '+marker+' -->'
 ].join('\n');
 const res=await fetch(GH+'/issues',{method:'POST',headers:{
  Authorization:'Bearer '+GH_TOKEN,Accept:'application/vnd.github+json','Content-Type':'application/json'
 },body:JSON.stringify({title,body}),signal:AbortSignal.timeout(18000)});
 if(!res.ok)throw Error('NOTIFICATION_HTTP_'+res.status);
 const o=await res.json();
 existing.push(o);
 console.log('TOYOL_NEW_OUTCOME_ALERT',o.html_url);
}
const output=[];
for(const job of JOBS){
 try{
   const [task,records]=await Promise.all([
     getJson(BASE+'/api/tasks/'+job.id+'?chainId='+job.chainId),
     getJson(BASE+'/api/tasks/'+job.id+'/'+job.kind+'?chainId='+job.chainId)
   ]);
   if(task.id!==job.id||task.chainId!==job.chainId||!Array.isArray(records))throw Error('PRIMARY_SOURCE_IDENTITY_MISMATCH');
   const res=eventsFor(task,records,job);
   const line={name:job.name,id:job.id,submissionOrPitchId:job.recordId,recordFound:!res.missingRecord,
     status:task.status,recordStatus:res.recordStatus||null,awards:task.awardCount??null,
     candidateSignals:res.events.map(e=>e.type),verifiedIncome:false};
   output.push(line);
   console.log('TASKMARKET_OUTCOME '+JSON.stringify(line));
   for(const ev of res.events)await notify(job,ev);
 }catch(e){output.push({name:job.name,error:String(e.message).slice(0,180),verifiedIncome:false});console.error('TASKMARKET_SOURCE_UNAVAILABLE',job.name,String(e.message).slice(0,180))}
}
mkdirSync('out/taskmarket-watch',{recursive:true});
writeFileSync('out/taskmarket-watch/latest.json',JSON.stringify({checkedAt:new Date().toISOString(),scanned:output.length,verifiedIncome:false,items:output},null,2));
if(process.env.GITHUB_STEP_SUMMARY){
 const {appendFileSync}=await import('node:fs');
 appendFileSync(process.env.GITHUB_STEP_SUMMARY,'## Toyol TaskMarket outcome verification\n\n'+
 output.map(x=>'- '+x.name+': '+(x.error||((x.recordFound?'record verified':'record not found')+'; '+x.status+'; '+x.candidateSignals.join(', ')))+'; **no settlement asserted**').join('\n')+'\n');
}
if(output.every(x=>x.error))process.exitCode=1;