/** Membership Hunt: read-only checks of known identities and private inbox counts.
 * No signups, key generation, deposits, bid submission, or wallet signing.
 * Public repository: never expose private proposal text, tokens or raw responses.
 */
import {appendFileSync,mkdirSync,writeFileSync} from 'node:fs';

const FRANTIC='agent-65c3b0';
const SWARM_WORK='65ba0fb3af541b65f34cf4bbd2b40c03';
const SWARM_RESULT='6aaba9998e6a4f41ca2872a5eac1b273';
const OPEN_TASK='https://opentask.ai';
// Owner-authorized profile verified by Actions run 43348892555.
const VERIFIED_OPENTASK_PROFILE_ID='cmwebq871016a08jtv7b35au1';
const paths=new Set(['/api/agent/me','/api/agent/onboarding/status?role=seller&intent=monitor','/api/agent/proposals?limit=30','/api/agent/me/task-recommendations?limit=20','/api/agent/notifications?unreadOnly=1&limit=30','/api/agent/bids?status=active']);
const count=x=>Array.isArray(x)?x.length:null;
const safeError=e=>/^HTTP_[0-9]{3}$/.test(String(e?.message))?e.message:'SOURCE_UNAVAILABLE';
async function readJSON(url,token=''){
 const u=new URL(url);
 if(!['gofrantic.com','swarmmemo.com','opentask.ai','basedagents.ai'].includes(u.hostname)||u.protocol!=='https:'||u.username||u.password)throw Error('UNAPPROVED_HOST');
 if(token&&(u.origin!==OPEN_TASK||!paths.has(u.pathname+u.search)))throw Error('UNAPPROVED_AUTH_PATH');
 const headers={Accept:'application/json','User-Agent':'ToyolMembershipHunt/1.0'};
 if(token)headers.Authorization='Bearer '+token;
 const res=await fetch(u,{headers,redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!res.ok)throw Error('HTTP_'+res.status);
 const raw=await res.text();
 if(raw.length>2000000)throw Error('RESPONSE_TOO_LARGE');
 return JSON.parse(raw);
}
export async function membershipHunt({read=readJSON,token=process.env.TOYOL_OPENTASK_TOKEN||'',expectedId=process.env.TOYOL_OPENTASK_PROFILE_ID||VERIFIED_OPENTASK_PROFILE_ID}={}){
 const result={checked_at:new Date().toISOString(),owner_spend_authorized:false,providers:[]};
 try{
  const x=await read('https://gofrantic.com/v1/agents/'+FRANTIC+'/status');
  if(x?.ok!==true||x.agent?.kid!==FRANTIC)throw Error('IDENTITY_MISMATCH');
  result.providers.push({provider:'Frantic',status:'REGISTERED_VERIFIED',agent_id:FRANTIC,
   hire_open:x.agent.situation?.open===true,payout_configured:x.agent.onboarding?.payout?.set===true,
   invitations:count(x.agent.invites),pending_review:Number(x.work?.summary?.deliveredPendingReview)||0,
   next_action:'REVIEW_REAL_INVITATIONS_BEFORE_CLAIM'});
 }catch(e){result.providers.push({provider:'Frantic',status:'UNVERIFIED',reason:safeError(e)});}
 try{
  const x=await read('https://swarmmemo.com/api/work/'+SWARM_WORK);
  const w=x?.data?.work;
  if(x?.ok!==true||w?.id!==SWARM_WORK)throw Error('SOURCE_MISMATCH');
  const matched=(Array.isArray(w.results)?w.results:[]).find(y=>y.result_id===SWARM_RESULT);
  result.providers.push({provider:'SwarmMemo',status:matched?'PRIOR_SUBMISSION_VERIFIED':'PRIOR_SUBMISSION_NOT_FOUND',
   durable_member_key:false,public_result:'https://swarmmemo.com/e/'+SWARM_RESULT,
   next_action:'RECOVER_OR_PROVISION_ONE_DURABLE_SIGNER_BEFORE_PROFILE_AND_INBOX'});
 }catch(e){result.providers.push({provider:'SwarmMemo',status:'UNVERIFIED',reason:safeError(e)});}
 if(!token||!expectedId){
  result.providers.push({provider:'OpenTask',status:'FREE_JOIN_AVAILABLE_CREDENTIAL_SETUP_REQUIRED',
   next_action:'PROVISION_DURABLE_AGENT_CREDENTIAL_AND_CONFIRM_TOYOL_PROFILE_ID',
   signup:'https://opentask.ai/guides/agent-auth-integration'});
 }else{
  try{
   const x=await read(OPEN_TASK+'/api/agent/me',token);
   if(typeof x?.profile?.id!=='string'||x.profile.id!==expectedId)throw Error('IDENTITY_MISMATCH');
   const req=p=>read(OPEN_TASK+p,token);
   const reads=await Promise.allSettled([
    req('/api/agent/onboarding/status?role=seller&intent=monitor'),
    req('/api/agent/proposals?limit=30'),
    req('/api/agent/me/task-recommendations?limit=20'),
    req('/api/agent/notifications?unreadOnly=1&limit=30'),
    req('/api/agent/bids?status=active')]);
   const value=i=>reads[i].status==='fulfilled'?reads[i].value:null;
   result.providers.push({provider:'OpenTask',status:'REGISTERED_VERIFIED',
    onboarding_checkpoint:typeof value(0)?.checkpoint==='string'&&/^[a-z_]{1,80}$/i.test(value(0).checkpoint)?value(0).checkpoint:null,
    proposal_page_count:count(value(1)?.proposals),recommendation_page_count:count(value(2)?.recommendations),
    unread_page_count:count(value(3)?.notifications),
    active_bid_page_count:count(Array.isArray(value(4))?value(4):value(4)?.bids),
    unavailable_reads:reads.filter(v=>v.status==='rejected').length,
    next_action:'INSPECT_PRIVATE_TASK_TERMS_WITH_AUTHORIZED_ACCESS_BEFORE_BID'});
  }catch(e){result.providers.push({provider:'OpenTask',status:'UNVERIFIED',reason:safeError(e)});}
 }
 result.providers.push({provider:'BasedAgents',status:'FREE_REGISTRATION_PAID_WORK_BOND_BLOCKED',
  signup:'https://basedagents.ai/skill.md',next_action:'NO_BOND_NO_PAID_CLAIM; REPUTATION_ONLY_IF_STRATEGIC'});
 return result;
}
export function summary(result){
 return ['# Toyol Membership Hunt (RM0)','',
 'Membership access is not earnings. No funds or new accounts created by this read-only scan.',
 ...result.providers.map(p=>'- '+p.provider+': '+p.status+
  (p.invitations!==undefined?' | invitation count: '+(p.invitations??'unknown'):'')+
  (p.proposal_page_count!==undefined?' | proposals on first page: '+(p.proposal_page_count??'unknown')+' | recommendations on first page: '+(p.recommendation_page_count??'unknown'):'')+
  ' | '+(p.next_action||p.reason||'CHECK_SOURCE')),''].join('\n');
}
async function main(){
 const result=await membershipHunt();
 mkdirSync('out/membership',{recursive:true});
 writeFileSync('out/membership/status.json',JSON.stringify(result,null,2));
 const md=summary(result);
 console.log(md);
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,md+'\n');
}
if(process.argv[1]?.endsWith('membership-hunt.mjs'))main().catch(()=>{console.error('Membership scan failed; no account or payment inferred.');process.exitCode=1;});
