/**
 * Toyol Paid Tasks v1 — discover work intended for autonomous agents, not
 * employee vacancies. No untrusted task text executes commands.
 *
 * Listings are not earnings. Money is not ours merely because it is unclaimed.
 * No fees, stakes, claims, transfers, paid signups or third-party submissions.
 * Direct provider APIs complement the independent Jobbi index.
 */
import {mkdirSync,writeFileSync,appendFileSync} from 'node:fs';
import {validateOriginalIssues} from './original-issue-gate.mjs';

const REPO='ilhamraduanbis-source/toyol-digital';
const ISSUE=4;
const START='<!-- toyol-paid-tasks-v1 -->';
const END='<!-- /toyol-paid-tasks-v1 -->';
const SOURCES=[
 {name:'Jobbi agent gigs',url:'https://jobbi.org/gigs.json?lane=agent&limit=1000'},
 {name:'Taskmarket open',url:'https://api.taskmarket.dev/api/tasks?status=open&sort=newest&limit=100'},
 {name:'BasedAgents tasks',url:'https://api.basedagents.ai/v1/tasks?status=open'},
 {name:'Frantic funded bounties',url:'https://gofrantic.com/v1/board?status=open&limit=50'}
];
const skillText=/(code|bug|fix|program|script|api|json|csv|data|documentation|readme|test|research|content|translate|summari|article|report|spreadsheet|analysis|markdown|python|javascript|typescript|extract|parse|validate|audit|design|write)/i;
const danger=/(?:\bpay (?:a |the )?(?:fee|deposit)\b|\bupfront (?:fee|payment|deposit)\b|\bstaking required\b|\bstake required\b|\btransfer funds\b|\bwallet seed\b|\bprivate key\b|\bsecret token\b|\bpassword\b|\bdeanonymize\b|\bhack (?:into|an account)\b|\baccount takeover\b|\breferral (?:scheme|chain)\b)/i;
// No owner-funded shopping, NFT purchases, or pay-to-review work.
// Conservative filter: task prose is untrusted and a free bounty must not require an outlay.
const purchaseRequired=/(?:\b(?:buy|purchase|order)\s+(?:the|an?|any|some|one)\s+\S+|\b(?:make|complete)\s+(?:a|the)\s+purchase\b|\b(?:entrants?|participants?|workers?)\s+pay\s+(?:their|own)\b|\b(?:purchase|network)\s+costs?\b)/i;
const clean=(s,n=240)=>String(s??'').replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const money=n=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=1_000_000;
function safeUrl(value){
 try{const u=new URL(String(value||''));return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}
}
export function fromJobbi(item){
 const x=item?._jobbi||{},r=x.reward||{},amount=Number(r.amount);
 if(x.lane!=='agent'||x.claims_open===false||!money(amount))return null;
 const url=safeUrl(item.url);
 if(!url)return null;
 return {id:'jobbi:'+clean(item.id||url,220),source:'Jobbi / '+clean(x.source,30),
  url,title:clean(item.title,140),brief:clean(item.content_text||item.summary,380),
  reward_amount:amount,reward_currency:clean(r.currency,16).toUpperCase(),
  payout_rail:clean(r.rail,50)||'UNKNOWN',
  source_grade:clean(x.payout_grade,12)||'UNKNOWN',
  funding_signal:clean(x.payment_state,45)||'UNKNOWN',
  acceptance:clean(x.acceptance_type||x.acceptance,70)||'UNKNOWN',
  competition:'UNKNOWN',deadline:clean(x.expires,36)||null,
  stake_required:false,stake_terms_unverified:true,
  task_status:'OPEN_INDEX_CLAIM',requires_registration:'UNKNOWN',
  source_primary_verified:false};
}
export function fromTaskmarket(task){
 if(task?.status!=='open'||task?.stakeRequired===true||task?.depositRequired===true||
   !['bounty','benchmark'].includes(String(task?.mode||'bounty').toLowerCase())||
   !/^0x[a-f\d]{64}$/i.test(task?.id||''))return null;
 const raw=String(task.reward||'');
 if(!/^\d{1,18}$/.test(raw))return null;
 const amount=Number(raw)/1e6;
 if(!money(amount))return null;
 const chain=String(task.chainId??task.chain??'');
 const code=/(^|[^0-9])8453([^0-9]|$)|\bbase\b/i.test(chain)?'USDC':'TOKEN_UNVERIFIED';
 if(code!=='USDC')return null; // Base is the only activated Toyol payout rail.
 return {id:'taskmarket:'+task.id,source:'Taskmarket',
  url:'https://api.taskmarket.dev/api/tasks/'+task.id,
  title:clean(String(task.description||'').split('\n')[0],140),
  brief:clean(task.description,380),
  reward_amount:amount,reward_currency:code,
  payout_rail:'ONCHAIN_IDENTITY_REQUIRED',funding_signal:clean(task.escrowTxHash?'ESCROW_TX_LISTED':'UNKNOWN'),
  acceptance:'TASKMARKET_REVIEW',competition:'OPEN_BOUNTY',deadline:clean(task.expiryTime,36)||null,
  off_platform_token_only:/\b(?:FLAPJAX only|no per-worker USDC release|USDC (?:reward|listing deposit).{0,120}(?:listing deposit|not a per-worker payout)|paid off-platform.{0,100}not by Taskmarket)\b/i.test(String(task.description||'')),
  submission_count:Number.isInteger(task.submissionCount)&&task.submissionCount>=0?task.submissionCount:null,
  free_task_quota:50,
  delivery_open:task.submissionWindowOpen===false?false:task.submissionWindowOpen===true?true:null,
  stake_required:false,stake_terms_unverified:false,task_status:'OPEN_DIRECT_API',
  requires_registration:'WALLET_SIGNATURE',source_primary_verified:true};
}
export function fromFrantic(b){
 if(b?.visibility!=='public'||b?.funded!==true||b?.work_status!=='open'||!(b.claim_slots?.available>0)||!money(b.price_usd)||!Number.isInteger(b.number))return null;
 if(/cashback|first bounty is on the house|reddit|citation|affiliate|social media|twitter|promot/i.test(b.title||''))return null;
 return {id:'frantic:'+b.number,source:'Frantic',url:'https://gofrantic.com/bounties/'+b.number,
  title:clean(b.title,140),brief:'Read original bounty contract before claim. Public funded work; availability can change.',
  reward_amount:b.price_usd,reward_currency:'USDC',payout_rail:'FRANTIC_X402_BASE',
  source_grade:'PRIMARY',funding_signal:'PROVIDER_FUNDED',acceptance:'FRANTIC_VERIFIER_AND_REVIEW',
  competition:'AVAILABLE_SLOTS_'+b.claim_slots.available,deadline:null,stake_required:false,
  stake_terms_unverified:false,task_status:'OPEN_DIRECT_API',requires_registration:'REGISTERED_AGENT_TOKEN',
  source_primary_verified:true};
}
export function fromBasedAgents(task){
 const id=String(task?.id||task?.task_id||'');
 const raw=task?.bounty_amount??task?.bountyAmount??task?.reward??task?.bounty;
 const amount=Number(raw);
 const status=String(task?.status||'').toLowerCase();
 if(!/^[a-zA-Z0-9_-]{5,90}$/.test(id)||status!=='open'||!money(amount))return null;
 return {id:'basedagents:'+id,source:'BasedAgents',
  url:'https://basedagents.ai/tasks/'+encodeURIComponent(id),
  title:clean(task?.title||task?.description,140),
  brief:clean(task?.description,380),
  reward_amount:amount,reward_currency:'USDC',
  payout_rail:'USDC_BASE_WALLET_REQUIRED',
  funding_signal:((task?.escrow && (task.escrow.status==='funded'||task.escrow.state==='funded'||task.escrow.deposit_tx_hash||task.escrow.depositTxHash)) || ['escrowed','funded'].includes(String(task?.payment_status||'').toLowerCase()))?'FUNDED_CLAIM_FROM_PROVIDER_NEEDS_ONCHAIN_CHECK':'NO_FUNDED_ESCROW_EVIDENCE',
  acceptance:'BUYER_OR_PLATFORM',competition:'UNKNOWN',deadline:clean(task?.deadline,36)||null,
  stake_required:false,stake_terms_unverified:true,task_status:'OPEN_DIRECT_API',
  requires_registration:'AGENT_IDENTITY_AND_WALLET',source_primary_verified:true};
}
export function analyzeTask(item){
 if(!item?.url||!item.title||!money(item.reward_amount))return null;
 const content=item.title+'\n'+item.brief;
 const blocked=[];
 if(danger.test(content))blocked.push('REQUESTS_UNSAFE_PAYMENT_OR_SECRETS');
 if(purchaseRequired.test(content))blocked.push('REQUIRES_PURCHASE_OR_OUTLAY');
 if(item.stake_required)blocked.push('REQUIRES_STAKE');
 // Provider reference: https://docs.taskmarket.dev/reference/competing
 // Free only for the first 5 per worker AND fewer than 50 total task submissions.
 // Count missing or stale is not authorization to submit; a live read is required.
 if(item.source==='Taskmarket'){
  if(item.off_platform_token_only)blocked.push('ADVERTISED_USDC_NOT_WORKER_PAYOUT');
  if(item.delivery_open===false)blocked.push('SUBMISSION_WINDOW_CLOSED');
  if(item.deadline&&Number.isFinite(Date.parse(item.deadline))&&Date.parse(item.deadline)<=Date.now())blocked.push('TASK_EXPIRED');
  if(!Number.isInteger(item.submission_count))blocked.push('FREE_QUOTA_UNVERIFIED');
  else if(item.submission_count>=50)blocked.push('TASK_FREE_SUBMISSIONS_EXHAUSTED');
 }
 if(item.source==='BasedAgents'){
  blocked.push('PAID_CLAIM_REQUIRES_REFUNDABLE_USDC_BOND');
  if(item.funding_signal==='NO_FUNDED_ESCROW_EVIDENCE')blocked.push('UNFUNDED_OR_UNVERIFIED_ESCROW');
 }
 const execution=skillText.test(content)?'POTENTIAL_FIELD_TASK':'NEEDS_CAPABILITY_DIAGNOSIS';
 if(/(?:medical advice|licensed therapy|firearm|explicit content|casino)/i.test(content))blocked.push('RESTRICTED_DOMAIN');
 const escrowVerified=false; // Require actual primary transaction or receipt, never infer from index.
 const MYRPayoutVerified=false;
 let priority=25;
 priority+=execution==='POTENTIAL_FIELD_TASK'?27:0;
 priority+=Math.min(18,Math.round(Math.log10(1+item.reward_amount)*8));
 priority+=item.source_primary_verified?9:0;
 priority-=item.reward_currency.includes('UNVERIFIED')?10:0;
 priority-=item.payout_rail.includes('WALLET')?8:0;
 if(['C','C-','D','D-'].includes(item.source_grade))priority-=18;
 if(item.funding_signal==='promised')priority-=12;
 if(item.source==='Taskmarket'||item.source==='Frantic')priority+=12;
 if(item.source==='BasedAgents')priority+=10;
 if(item.reward_amount<=10)priority+=5; // Micro gigs are allowed, not discarded.
 if(blocked.length)priority=0;
 return {...item,
  eligibility:blockeds(blocked),suitable_for_draft:blocked.length===0,
  execution_path:execution,
  funding_from_primary_verified:escrowVerified,
  MYR_cashout_verified:MYRPayoutVerified,
  earned_myr_verified:0,
  review_score:Math.max(0,Math.min(100,priority)),
  next_action:blocked.length?'REJECT_UNSAFE':'VERIFY_ORIGINAL_TASK_AND_PRODUCE_LOCAL_DELIVERABLE',
  note:'Amount advertised is never an owned asset. No automated claims or payment authorization.'
 };
}
function blockeds(x){return x.length?{status:'REJECT',reasons:x}:{status:'REVIEW',reasons:[]};}
export function shortlist(records,limit=14){
 const seen=new Set(),list=[];
 for(const r of records){
  const x=analyzeTask(r);
  if(!x||seen.has(x.url)||!x.suitable_for_draft)continue;
  seen.add(x.url);list.push(x);
 }
 list.sort((a,b)=>b.review_score-a.review_score||a.reward_amount-b.reward_amount);
 const cap=Math.max(1,Math.min(20,Math.floor(limit)||1));
 const small=list.filter(x=>x.reward_amount<=10).slice(0,Math.min(4,cap));
 const medium=list.filter(x=>x.reward_amount>10&&x.reward_amount<200).slice(0,Math.min(6,cap));
 const high=list.filter(x=>x.reward_amount>=200).slice(0,Math.min(4,cap));
 const picked=[...small,...medium,...high];
 for(const x of list){if(picked.length>=cap)break;if(!picked.includes(x))picked.push(x);}
 // A weak index must not crowd out the direct provider whose terms we can inspect.
 const selected=picked.slice(0,cap);
 const direct=list.filter(x=>x.source==='Taskmarket'||x.source==='BasedAgents');
 if(selected.length>=3&&direct.length){
  const choices=['Taskmarket','BasedAgents'].map(name=>direct.find(x=>x.source===name)).filter(Boolean);
  for(const x of choices){
   if(selected.some(y=>y.url===x.url))continue;
   let idx=selected.findLastIndex(y=>y.source.startsWith('Jobbi')&&
     !choices.some(k=>k.url===y.url));
   if(idx<0)idx=selected.length-1;
   selected[idx]=x;
  }
 }
 return [...new Map(selected.map(x=>[x.url,x])).values()];
}
export function report(data){
 const lines=[
 '# 🧟 Toyol — Paid Tasks (not job vacancies)','',
 '**REAL MONEY RECEIVED: RM0. ADVERTISED REWARDS ARE NOT EARNINGS.**','',
 'Source API: [Jobbi](https://jobbi.org/gigs), [Taskmarket](https://docs.taskmarket.dev/api/reference), [BasedAgents](https://basedagents.ai/docs/agents), [Frantic](https://gofrantic.com).',
 'No owner cash, deposits, stakes, platform fees, wallet spending, or other people’s unclaimed money.','',
 'Only public work explicitly open to a participant may be attempted. Payment and Malaysia cashout must be verified before reporting profit.',''
 ];
 for(const s of data.sources)lines.push('- '+s.name+': '+s.status+' ('+s.count+' tasks inspected)'+(s.error?' — '+clean(s.error,90):''));
 lines.push('','## Original issue verification','',
  '- GitHub issue sources checked: '+(data.original_github_issues_checked??'not run')+
  '; closed source issues excluded: '+(data.source_closed_rejections?.length??0),
  '- An open issue is NOT proof that its bounty is still payable; assignee, competition and payment need review.','',
  '## Tasks to investigate / attempt','');
 if(!data.tasks.length)lines.push('No eligible task in the sampled sources. No inference about the whole internet.','');
 for(const t of data.tasks)lines.push(
  '- **'+clean(t.title,100).replace(/[\[\]*]/g,'')+'** — '+t.reward_amount+' '+t.reward_currency+
  ' ([original]('+t.url+'))',
  '  - '+t.source+' | payout: '+t.payout_rail+' | funding: '+t.funding_signal+
  (t.source==='Taskmarket'?' | task submissions: '+t.submission_count+'/50 free total (recheck before submit)':'')+
  ' | local solve: '+t.execution_path+' | original: '+(t.original_issue?.status??'UNVERIFIED')+
  ' | warnings: '+(t.original_issue?.warnings?.join(',')||'none')+' | MYR payout: UNVERIFIED'
 );
 lines.push('','**Operational gate:** Read original requirements → solve and verify → lawful claim/submit with an authorized account → maintainer acceptance → verified settlement → confirmed MYR receipts.','');
 return lines.join('\n');
}
async function getJSON(url){
 const u=new URL(url);
 if(!['jobbi.org','api.taskmarket.dev','api.basedagents.ai','gofrantic.com'].includes(u.hostname))throw Error('unapproved API host');
 const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),15000);
 try{
  const res=await fetch(url,{signal:ac.signal,headers:{Accept:'application/json','User-Agent':'ToyolPaidTasks/1.0 (+public agent tasks; once daily)'}});
  if(!res.ok)throw Error('HTTP '+res.status);
  const body=await res.text();
  if(body.length>5_000_000)throw Error('provider response too large');
  return JSON.parse(body);
 }finally{clearTimeout(timer);}
}
export async function scan(fetchJSON=getJSON){
 const sources=[],all=[];
 for(const s of SOURCES){
  try{
   const x=await fetchJSON(s.url);
   const rows=s.name.startsWith('Jobbi')?(Array.isArray(x.items)?x.items:[]):
    s.name==='Taskmarket open'?(Array.isArray(x.tasks)?x.tasks:[]):
    s.name.startsWith('Frantic')?(Array.isArray(x.board?.bounties)?x.board.bounties:[]):
    Array.isArray(x)?x:Array.isArray(x.tasks)?x.tasks:Array.isArray(x.data)?x.data:[];
   const mapped=rows.slice(0,1000).map(s.name.startsWith('Jobbi')?fromJobbi:
    s.name==='Taskmarket open'?fromTaskmarket:s.name.startsWith('Frantic')?fromFrantic:fromBasedAgents).filter(Boolean);
   sources.push({name:s.name,status:'OK',count:rows.length,normalized:mapped.length,
    examples:mapped.slice(0,8).map(t=>({title:t.title,url:t.url,amount:t.reward_amount,currency:t.reward_currency,brief:t.brief.slice(0,160)}))});
   all.push(...mapped);
  }catch(e){sources.push({name:s.name,status:'ERROR',count:0,error:clean(e?.message,110)});}
 }
 return {scanned_at:new Date().toISOString(),sources,normalized_count:all.length,
  tasks:shortlist(all),accepted_paid_tasks:0,verified_myr_received:0};
}
async function publish(content,token){
 if(!token||process.env.GITHUB_REPOSITORY!==REPO)return {saved:false,reason:'NO_GITHUB_AUTH'};
 const url='https://api.github.com/repos/'+REPO+'/issues/'+ISSUE;
 const headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json'};
 const res=await fetch(url,{headers});
 if(!res.ok)throw Error('read own issue HTTP '+res.status);
 const issue=await res.json();
 if(!String(issue.title||'').startsWith('💰 Toyol Paid Tasks'))throw Error('unexpected own issue');
 const old=String(issue.body||'');
 const start=old.indexOf(START),end=old.indexOf(END,start+START.length);
 const fragment=START+'\n'+content+'\n'+END;
 const next=start>=0&&end>start?old.slice(0,start)+fragment+old.slice(end+END.length):old+'\n'+fragment;
 const done=await fetch(url,{method:'PATCH',headers,body:JSON.stringify({body:next})});
 if(!done.ok)throw Error('update own issue HTTP '+done.status);
 return {saved:true,url:'https://github.com/'+REPO+'/issues/'+ISSUE};
}
export async function main({discover=scan,writeIssue=publish}={}){
 const data=await discover();
 const verified=await validateOriginalIssues(data.tasks||[]);
 data.tasks=verified.active;
 data.source_closed_rejections=verified.rejected.map(x=>({title:x.title,url:x.url,reason:x.next_action}));
 data.original_github_issues_checked=verified.checked_github;
 mkdirSync('out/paid-tasks',{recursive:true});
 writeFileSync('out/paid-tasks/lead-evidence.json',JSON.stringify(data,null,2));
 const md=report(data);
 writeFileSync('out/paid-tasks/report.md',md);
 console.log(md);
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,md+'\n');
 try{data.publication=await writeIssue(md,process.env.GITHUB_TOKEN);}
 catch(e){data.publication={saved:false,error:clean(e?.message,100)};}
 writeFileSync('out/paid-tasks/lead-evidence.json',JSON.stringify(data,null,2));
 return data;
}
if(process.argv[1]?.endsWith('paid-task-radar.mjs'))main().catch(e=>{console.error(e);process.exitCode=1;});
