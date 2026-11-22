/**
 * Toyol Agent-Native Revenue Gate
 * Read-only, no wallet signing, registrations, bids, funds or outreach.
 * Index listing is never proof of escrow, job eligibility or payout.
 */
import assert from 'node:assert/strict';
import {appendFileSync} from 'node:fs';

const API='https://api.agentics.page/jobs';
const INVALID_SOURCE=new Set(['agentmesh','basedagents','clawearn','executionMarket','rentahuman','openwork','immunefi','cantina']);
const FEE_WORDS=/\b(?:deposit|upfront|stake|staking|collateral|bond|paid call|x402 payment|purchase token|token purchase|buy a token|pay a fee|gas fee|buy credits|entry fee)\b/i;
const HUMAN_WORDS=/\b(?:human only|record your voice|phone recording|in.person|on.site|physical attendance|real world|live video of yourself|speak to camera)\b/i;
const UNSUPPORTED=/\b(?:affiliate|referral commissions?|insurance|takaful|sales kpi|tiktok comments|bulk comments|growth hacking)\b/i;
const CAPABILITY=/\b(?:api|markdown|csv|json|documentation|validator|test|qa|typescript|javascript|node\.?js|python|bug fix|unit tests|data quality|data audit|openapi|calculator|tokenomics|vesting|web app|research report|error handling)\b/i;
const HOSTS=new Set(['gofrantic.com','opentask.ai','taskmarket.dev','clawlancer.ai','agentics.page','agentmesh.help','github.com','jobforagent.com','dealwork.ai','superteam.fun','agentjobs.ai','openwork.bot','basedagents.ai','www.getly.store','getly.store']);
function str(x){return typeof x==='string'?x:'';}
function safeURL(u){
  try {const p=new URL(u);return p.protocol==='https:'&&!p.username&&!p.password&&HOSTS.has(p.hostname)?p.toString():null;}
  catch{return null;}
}
function assess(j,now=Date.now()){
 if(!j||typeof j!=='object')return {kind:'reject',reason:'INVALID_ROW'};
 const source=str(j.source),lane=str(j.kind).toLowerCase(),currency=str(j.currency).toUpperCase();
 const title=str(j.title),desc=str(j.description),pay=str(j.payModel).toLowerCase();
 const url=safeURL(j.url);
 const amount=Number(j.amount);
 const all=[title,desc,str(j.payNote),str(j.amountNote)].join(' ').slice(0,6000);
 if(lane!=='agent')return {kind:'reject',reason:'NOT_AGENT_WORK'};
 if(INVALID_SOURCE.has(source))return {kind:'reject',reason:'NO_CASH_OR_ZERO_DEPOSIT_NOT_ESTABLISHED'};
 if(!url)return {kind:'reject',reason:'NO_APPROVED_PRIMARY_URL'};
 if(!['USD','USDC','USDT','OUSD'].includes(currency)||!Number.isFinite(amount)||amount<=0)return {kind:'reject',reason:'NO_POSITIVE_CASH_AMOUNT'};
 if(FEE_WORDS.test(all))return {kind:'reject',reason:'UPFRONT_SPEND_SIGNAL'};
 if(HUMAN_WORDS.test(all)||UNSUPPORTED.test(all))return {kind:'reject',reason:'MANUAL_OR_PROHIBITED_SCOPE'};
 if(j.deadline){const d=Date.parse(j.deadline);if(Number.isFinite(d)&&d<now)return{kind:'reject',reason:'EXPIRED'};}
 // Only a shortlist; primary payment and owner eligibility must be checked separately.
 const matched=CAPABILITY.test(all);
 const kind=pay.includes('contest')||/winner.?only|best entry wins/i.test(all)?'CONTEST_NOT_RECEIVABLE':
     /apply|selected|chosen|pitch|bid/i.test(pay+' '+str(j.payNote))?'SELECTION_UNCONFIRMED':
     'POTENTIAL_PAID_WORK_PRIMARY_CHECK_REQUIRED';
 return {kind,reason:matched?'CAPABILITY_MATCH':'NEEDS_CAPABILITY',
   amount,currency,title:title.slice(0,140),url,source,id:str(j.id).slice(0,120)};
}
function selfTest(){
 const base={kind:'agent',source:'frantic',title:'JavaScript CSV validator',amount:125,currency:'USD',payModel:'exclusive',url:'https://gofrantic.com/bounties/99'};
 assert.equal(assess(base).kind,'POTENTIAL_PAID_WORK_PRIMARY_CHECK_REQUIRED');
 assert.equal(assess({...base,kind:'human'}).reason,'NOT_AGENT_WORK');
 assert.equal(assess({...base,source:'basedagents'}).reason,'NO_CASH_OR_ZERO_DEPOSIT_NOT_ESTABLISHED');
 assert.equal(assess({...base,title:'Deposit $1 for JavaScript task'}).reason,'UPFRONT_SPEND_SIGNAL');
 assert.equal(assess({...base,description:'Buy a token first'}).reason,'UPFRONT_SPEND_SIGNAL');
 assert.equal(assess({...base,currency:'credits'}).reason,'NO_POSITIVE_CASH_AMOUNT');
 assert.equal(assess({...base,url:'https://evil.example/steal'}).reason,'NO_APPROVED_PRIMARY_URL');
 assert.equal(assess({...base,deadline:'2026-01-01T00:00:00Z'},Date.parse('2026-11-22T00:00:00Z')).reason,'EXPIRED');
 assert.equal(assess({...base,payModel:'contest'}).kind,'CONTEST_NOT_RECEIVABLE');
 console.log('AGENT_NATIVE_GATE_TEST_PASS 9');
}
if(process.argv.includes('--self-test')){selfTest();process.exit(0);}
selfTest();
const res=await fetch(API,{headers:{accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(18000)});
if(!res.ok)throw Error('SOURCE_HTTP_'+res.status);
const data=await res.json();
if(!Array.isArray(data.jobs)||data.jobs.length>2000)throw Error('INVALID_SOURCE_SCHEMA');
const counts={},seen=new Set(),candidates=[];
for(const j of data.jobs){
 const r=assess(j);counts[r.kind==='reject'?r.reason:r.kind]=(counts[r.kind==='reject'?r.reason:r.kind]||0)+1;
 if(r.kind==='reject')continue;
 if(!r.id||seen.has(r.url+'#'+r.id))continue;
 seen.add(r.url+'#'+r.id);candidates.push(r);
}
candidates.sort((a,b)=>{
 const score=x=>(x.kind==='POTENTIAL_PAID_WORK_PRIMARY_CHECK_REQUIRED'?3:x.kind==='SELECTION_UNCONFIRMED'?2:1)+
 (x.reason==='CAPABILITY_MATCH'?2:0);
 return score(b)-score(a)||b.amount-a.amount;
});
const list=candidates.slice(0,15);
console.log('AGENT_NATIVE_SCAN '+JSON.stringify({source:API,seen:data.jobs.length,
  sourceFetchedAt:data.fetchedAt??null,candidates:candidates.length,
  displayed:list.length,counts,spendUsd:0,submissions:0,verifiedPayments:0,
  advisory:'INDEX DATA ONLY; check provider eligibility and payout before any work'}));
for(const c of list)console.log('AGENT_NATIVE_CANDIDATE '+JSON.stringify(c));
if(process.env.GITHUB_STEP_SUMMARY){
 const lines=['## Toyol Agent-Native Income Gate','',
  'Sources: '+API+' | observed '+data.jobs.length+' rows | shortlisted '+candidates.length,
  '','| Proposed task | Listed amount | Listing type | Primary URL |','|---|---:|---|---|',
  ...list.map(x=>'| '+x.title.replace(/[|<>]/g,' ').slice(0,65)+' | '+
    x.amount+' '+x.currency+' | '+x.kind+' | '+x.url+' |'),
  '','INDEX ONLY. Zero accepted paid jobs, bid submissions or settlement are implied. Human-only, fee/stake, noncash and expired items are filtered.'];
 appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
}