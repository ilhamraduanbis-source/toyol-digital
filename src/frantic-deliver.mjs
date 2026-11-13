/** Toyol: trusted, prepared Frantic delivery queue. No fee, wallet signing,
 * untrusted code execution or automatic acceptance of arbitrary task text.
 * Only a reviewed, complete public deliverable in the owner's repo can enter.
 * A submission is not earnings; payout watcher is separate.
 */
import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const ROOT='https://gofrantic.com';
export const KID='agent-65c3b0';
const OWN='ilhamraduanbis-source/toyol-digital';
const QUEUE='frantic-ready.json';
const sortObject=x=>Array.isArray(x)?x.map(sortObject):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sortObject(x[k])])):x;
export function contractHash(b){
 return createHash('sha256').update(JSON.stringify(sortObject({number:b.number,price_cents:b.price_cents,title:b.title,description:b.description,criteria:b.criteria,delivery_contract:b.delivery_contract}))).digest('hex');
}
function need(condition,reason){if(!condition)throw Error(reason);}
export function validateJob(j){
 need(j&&Number.isSafeInteger(j.bounty)&&j.bounty>0,'INVALID_BOUNTY');
 need(Number.isSafeInteger(j.price_cents)&&j.price_cents>0,'INVALID_PRICE');
 need(/^[a-f0-9]{64}$/.test(j.contract_sha256||''),'MISSING_REVIEWED_CONTRACT');
 need(j.reviewed===true&&j.owner_cost_cents===0&&j.work_complete===true,'UNREVIEWED_OR_COST');
 need(Array.isArray(j.artifact_refs)&&j.artifact_refs.length>=1&&j.artifact_refs.length<=20,'INVALID_ARTIFACTS');
 for(const a of j.artifact_refs){
  need(typeof a==='string'&&a.length<=1000&&/^[a-zA-Z][a-zA-Z0-9_]*=/.test(a),'UNNAMED_ARTIFACT');
  const v=a.slice(a.indexOf('=')+1);
  need(!/(?:fr_agent_|fr_op_|fr_post_|[?&](?:token|key|secret|password)=)/i.test(v),'SECRET_IN_ARTIFACT');
  if(v.startsWith('https://')){
   const u=new URL(v);need(!u.username&&!u.password,'UNSAFE_ARTIFACT');
   if(u.hostname==='raw.githubusercontent.com'){
    need(new RegExp('^/'+OWN+'/[a-f0-9]{40}/deliverables/').test(u.pathname),'OWN_ARTIFACT_MUST_BE_PINNED');
   }
  }else need(/^runx:receipt:sha256:[a-f0-9]{64}$/.test(v),'INVALID_ARTIFACT_REF');
 }
 return j;
}
export function validateBounty(b,j){
 need(b&&b.number===j.bounty&&b.visibility==='public','NOT_PUBLIC');
 need(b.funded===true&&typeof b.funded_receipt_ref==='string'&&b.funded_receipt_ref.length>0,'NOT_FUNDED');
 need(b.price_cents===j.price_cents,'PRICE_CHANGED');
 need(contractHash(b)===j.contract_sha256,'CONTRACT_CHANGED '+contractHash(b));
 need(!/cashback|rebate|first bounty is on the house|affiliate|reddit|twitter|social media/i.test(b.title||''),'EXCLUDED_REWARD');
 const names=new Set(j.artifact_refs.map(a=>a.split('=')[0]));
 for(const a of b.delivery_contract?.artifacts||[])if(a.required)need(names.has(a.name),'MISSING_ARTIFACT_'+a.name);
 return b;
}
export async function execute(job,api){
 const j=validateJob(job);
 const status=await api('/v1/agents/'+KID+'/status');
 need(status.agent?.kid===KID&&status.verification?.sworn===true&&status.agent?.claimEligibility?.eligible===true,'AGENT_NOT_ELIGIBLE');
 need(status.agent?.onboarding?.payout?.set===true,'PAYOUT_NOT_SET');
 const settled=(status.work?.settled||[]).find(x=>x.bounty?.number===j.bounty);
 if(settled)return {result:'ALREADY_SETTLED_OR_CLOSED',bounty:j.bounty,stage:settled.stage};
 const open=(status.work?.open||[]);
 const current=open.find(x=>x.bounty?.number===j.bounty);
 if(current&&current.stage!=='delivery_due')return {result:'EXISTING_CLAIM_DO_NOT_RESUBMIT',bounty:j.bounty,stage:current.stage};
 need(!open.some(x=>x.bounty?.number!==j.bounty&&['delivery_due','revision_required'].includes(x.stage)),'OTHER_ACTIVE_CLAIM');
 const b=validateBounty((await api('/v1/bounties/'+j.bounty)).bounty,j);
 let id=current?.claimId;
 if(!id){
  need(b.work_status==='open'&&b.claim_progress?.available>0,'NO_SLOT');
  await api('/v1/deliveries/preflight','POST',{bounty:j.bounty,artifact_refs:j.artifact_refs});
  const claimed=await api('/v1/claims','POST',{bounty:j.bounty,agent_kid:KID});
  id=claimed.claim_id;
  need(typeof id==='string'&&/^[a-f0-9-]{36}$/i.test(id),'CLAIM_ID_INVALID');
 }
 const c=await api('/v1/claims/'+id);
 need(c.claim_id===id&&c.agent_kid===KID&&c.bounty_number===j.bounty&&c.visibility==='public','CLAIM_IDENTITY_MISMATCH');
 need(c.access?.pending===false&&!c.delivery,'CLAIM_NOT_READY_OR_ALREADY_DELIVERED');
 need(Number.isFinite(Date.parse(c.deliver_deadline_at))&&Date.parse(c.deliver_deadline_at)>Date.now()+30000,'CLAIM_DEADLINE');
 need(Array.isArray(c.eligibility)&&c.eligibility.every(e=>['pass','passed','met','satisfied','eligible','ok','verified'].includes(e.status)),'HIDDEN_ELIGIBILITY_NOT_MET '+JSON.stringify((c.eligibility||[]).map(x=>({check:x.check,status:x.status}))).slice(0,500));
 await api('/v1/deliveries/preflight','POST',{claim_id:id,artifact_refs:j.artifact_refs});
 const d=await api('/v1/deliveries','POST',{claim_id:id,agent_kid:KID,artifact_refs:j.artifact_refs});
 return {result:'DELIVERY_SUBMITTED',bounty:j.bounty,claim_id:id,delivery_id:d.delivery_id||null,receipt_ref:d.receipt_ref||null};
}
export function client(token,fetchFn=fetch){
 need(typeof token==='string'&&/^fr_agent_[A-Za-z0-9_-]+$/.test(token),'FRANTIC_SECRET_REQUIRED');
 return async(path,method='GET',body)=>{
  need(/^\/v1\/(?:agents\/agent-65c3b0\/status|bounties\/\d+|claims(?:\/[a-f0-9-]{36})?|deliveries(?:\/preflight)?)$/.test(path),'UNAPPROVED_ROUTE');
  const r=await fetchFn(ROOT+path,{method,redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','User-Agent':'ToyolDigital/1.0'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  const j=await r.json();
  need(r.ok&&j.ok===true,'FRANTIC_'+method+'_'+path.split('/').slice(2,3)[0]+'_HTTP_'+r.status);
  return j;
 };
}
async function main(){
 const api=client(process.env.FRANTIC_AGENT_TOKEN);
 const status=await api('/v1/agents/'+KID+'/status');
 need(status.agent?.kid===KID&&status.verification?.sworn===true&&status.agent?.claimEligibility?.eligible===true&&status.agent?.onboarding?.payout?.set===true,'AGENT_NOT_READY');
 console.log('FRANTIC_ACCOUNT_READY');
 if(!existsSync(QUEUE)){console.log('NO_PREPARED_DELIVERY');return;}
 const jobs=JSON.parse(readFileSync(QUEUE,'utf8'));
 need(Array.isArray(jobs)&&jobs.length<=20,'INVALID_QUEUE');
 if(!jobs.length){console.log('NO_PREPARED_DELIVERY');return;}
 for(const job of jobs){
  try{console.log(JSON.stringify(await execute(job,api)));}
  catch(e){console.log('DELIVERY_STOPPED: '+String(e.message).slice(0,100));}
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(String(e.message).slice(0,100));process.exitCode=1;});
