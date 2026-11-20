/**
 * Live USD50+ cash work audit for registered Toyol clone.
 * Public listings are untrusted. This script does not claim jobs, contact
 * anyone, move funds, send payments, or count advertised value as income.
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const CURRENCIES=new Set(['USD','USDC','USDT']);
const rejectWords=/\b(buy|purchase|deposit|pay|swap|stake|join our telegram|boost social|like\s+(?:on|our)|register multiple|referral|spam|adult|weapon|surveillance|malware)\b/i;
const scores={A:5,'A-':4,B:3,'B-':2,C:1,'C+':1,'C-':0,D:-2};
const clean=x=>String(x??'').replace(/[\x00-\x1f\x7f]/g,' ').slice(0,300);
function ageDays(date,now){const x=Date.parse(date);return Number.isFinite(x)?(now-x)/86400000:Infinity;}
export function pick(list,now=Date.now()){
 if(!Array.isArray(list))throw Error('BAD_FEED');
 const denied={};
 const rows=[];
 for(const v of list){
  const m=v._jobbi||{},price=m.reward||{},n=Number(price.amount);
  let why;
  if(m.lane!=='agent')why='HUMAN_ONLY';
  else if(!CURRENCIES.has(price.currency))why='UNPRICED_OR_TOKEN_NOT_USD';
  else if(!Number.isFinite(n)||n<50)why='BELOW_50';
  else if(m.payment_state!=='escrowed')why='NOT_ESCROWED';
  else if(!['algora','bountyhub','agentbounties','opire','bountybook','issuehunt'].includes(m.source))why='UNSUPPORTED_VENUE';
  else if(m.expires&&Date.parse(m.expires)<now)why='EXPIRED';
  else if(rejectWords.test(v.title||'')||rejectWords.test(v.content_text||''))why='SPEND_OR_UNSAFE_REQUIREMENT';
  else if(ageDays(v.date_published,now)>120)why='STALE_OR_VERY_OLD';
  else if(!/^https:\/\//.test(v.url||''))why='INVALID_URL';
  if(why){denied[why]=(denied[why]||0)+1;continue;}
  const commentCount=Number(m.extra?.comments??0),fresh=ageDays(v.date_published,now);
  const severity=(commentCount>=50?1000:commentCount>=15?400:0);
  let score=Math.min(25,Math.log2(n+1)*2)+((scores[m.payout_grade]??-5)*4)+Math.max(0,25-fresh/2)-severity;
  rows.push({id:clean(v.id),title:clean(v.title),url:v.url,source:m.source,amount:n,currency:price.currency,rail:price.rail,
   published:v.date_published,modified:v.date_modified,ageDays:Math.round(fresh),payoutGrade:m.payout_grade,reportedComments:commentCount,score,
   status:'INDEX_CANDIDATE_REQUIRE_ORIGINAL_VALIDATION',sourceOfPayment:'UNCONFIRMED_REWARD_INDEPENDENTLY',confirmedEarnedUsd:0});
 }
 return {rows:rows.sort((a,b)=>b.score-a.score).slice(0,25),denied,totalSeen:list.length};
}
async function get(url){
 const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Toyol-PayableBounty-Audit/1.0',...(url.startsWith('https://api.github.com/')&&process.env.GH_TOKEN?{Authorization:'Bearer '+process.env.GH_TOKEN}:{})},redirect:'error',signal:AbortSignal.timeout(18000)});
 if(!r.ok)throw Error('HTTP_'+r.status);
 return r.json();
}
/**
 * A gig index may republish a six-year-old issue as a fresh bounty.
 * Distinguish live, independently evidenced paid work from an old
 * feature request whose GitHub issue carries no bounty confirmation.
 */
export function originalIssueGate(issue, indexedAmount, asOf=Date.now()){
 const labels=(issue.labels??[]).map(x=>String(typeof x==='string'?x:x.name??''));
 const issueText=String(issue.body??'');
 const officialBounty=labels.some(x=>/bounty|reward|\$\s*\d+/i.test(x))||/\/bounty\s+\$?\d+/i.test(issueText);
 const age=ageDays(issue.created_at,asOf);
 const stale=age>365;
 const claimed=Array.isArray(issue.assignees)&&issue.assignees.length>0;
 const crowded=(Number(issue.comments)||0)>=20;
 const reject=issue.state!=='open'||claimed||(stale&&!officialBounty)||(crowded&&!officialBounty);
 return {actionableForImmediateWork:!reject&&officialBounty&&!crowded,
  payoutIndependentlyVerified:false,
  issueAgeDays:Math.round(age),originalBountyEvidence:officialBounty,assigned:claimed,crowded,
  reason:issue.state!=='open'?'CLOSED':claimed?'ALREADY_ASSIGNED':stale&&!officialBounty?'STALE_ORIGINAL_WITHOUT_BOUNTY_PROOF':crowded&&!officialBounty?'CROWDED_WITHOUT_BOUNTY_PROOF':!officialBounty?'BOUNTY_NOT_VERIFIED_ON_ORIGINAL':crowded?'HIGH_COMPETITION':'NEEDS_PRIMARY_PAYOUT_PROOF'};
}
async function githubValidate(row){
 const m=row.url.match(/^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/issues\/(\d+)(?:[?#].*)?$/);
 if(!m)return {...row,admission:'BOARD_ONLY_NEEDS_ORIGINAL'};
 try{
  const j=await get('https://api.github.com/repos/'+m[1]+'/'+m[2]+'/issues/'+m[3]);
  if(j.pull_request||j.state!=='open')return {...row,admission:'CLOSED_OR_NOT_ISSUE',originalState:j.state};
  const days=Math.round(ageDays(j.created_at));
  const comments=j.comments??null;
  const labels=(j.labels??[]).map(x=>x.name);
  const gate=originalIssueGate(j,row.amount);
  return {...row,original:{createdAt:j.created_at,updatedAt:j.updated_at,comments,labels,officialUrl:j.html_url,issuesState:j.state},
    originalGate:gate,admission:gate.reason,claimMade:false,paymentVerified:false};
 }catch(e){return {...row,admission:'ORIGINAL_CHECK_UNAVAILABLE',checkError:String(e.message).slice(0,90)};}
}
export async function execute(){
 const api='https://jobbi.org/gigs.json?lane=agent&min_reward=50&limit=250';
 const j=await get(api),items=j.items??[];
 const s=pick(items);
 const shortlisted=s.rows.slice(0,14);
 const verified=[];
 for(const x of shortlisted){verified.push(await githubValidate(x));}
 const out={date:new Date().toISOString(),feed:api,totalSeen:s.totalSeen,filtered:s.denied,shortlisted:verified,ownerSpentUsd:0,claimsSubmitted:0,verifiedNewPayouts:0,
  note:'Index candidates only. Even escrowed board listings need independent award/payout confirmation, seller eligibility and a merge/delivery before any revenue claim.'};
 mkdirSync('out',{recursive:true});writeFileSync('out/real-cash50.json',JSON.stringify(out,null,2)+'\n');
 console.log('CASH50_FILTER '+JSON.stringify({date:out.date,totalSeen:out.totalSeen,filter:s.denied,shortlisted:verified.length,actionableForImmediateWork:actionable.length}));
 for(const x of verified)console.log('CASH50_CANDIDATE '+JSON.stringify(x).slice(0,1700));
 return out;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])execute().catch(e=>{console.error('CASH50_SCAN_FAILED '+String(e));process.exitCode=1;});
