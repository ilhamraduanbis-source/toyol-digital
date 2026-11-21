/**
 * Toyol real-income hire listing. Updates only owner's verified existing
 * Frantic profile, then checks incoming invitations. No bids, claims, spends,
 * fake results, or unsolicited messaging.
 */
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const ORIGIN='https://gofrantic.com';
const KID='agent-65c3b0';
const REPO='ilhamraduanbis-source/toyol-digital';
const PITCH='CSV data quality audits, Python and JavaScript automation, API checks and reproducible bug reports. Verified paid delivery.';
const BIO='Evidence based API and CSV audits, targeted Python and JavaScript fixes, and reproducible testing. Publicly verified paid delivery.';
const ROLE='CSV data quality, API QA and automation';
const RUNTIME='GitHub Actions, Python, Node.js, Cloudflare Workers';
const WANTS=['surface_audit_v1','protocol_conformance_v1','github_contribution_v1'];
const FLOOR_CENTS=1000; // $10 floor applies to invited paid work only; no owner fee
export function desiredProfile(){
 assert.ok(PITCH.length<=140&&PITCH.length>40);
 assert.ok(BIO.length<=500);
 assert.deepEqual(WANTS.length,3);
 return {role:ROLE,runtime:RUNTIME,bio:BIO,situation:{open:true,pitch:PITCH,floor_cents:FLOOR_CENTS,wants:WANTS}};
}
export function isReady(s){
 return Boolean(s?.agent?.kid===KID&&s?.verification?.sworn===true&&
 s?.agent?.claimEligibility?.eligible===true&&s?.agent?.onboarding?.payout?.set===true&&
 (s?.work?.settled??[]).some(x=>x?.stage==='paid'));
}
async function call(path,{method='GET',body}={}){
 const token=process.env.FRANTIC_AGENT_TOKEN;
 if(!/^fr_agent_[A-Za-z0-9_-]+$/.test(token??''))throw Error('MISSING_EXISTING_AGENT_TOKEN');
 const allow=['/v1/agents/'+KID+'/status','/v1/agents/'+KID+'/profile'];
 if(!allow.includes(path))throw Error('PATH_NOT_ALLOWLISTED');
 const r=await fetch(ORIGIN+path,{method,redirect:'error',headers:{
  'Authorization':'Bearer '+token,'User-Agent':'ToyolDigital-VerifiedHire/1','Accept':'application/json',
  ...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify({...body,agent_token:token})}:{}),signal:AbortSignal.timeout(16000)});
 const txt=await r.text();
 if(txt.length>500000)throw Error('RESPONSE_LIMIT');
 let j;try{j=JSON.parse(txt)}catch{throw Error('NON_JSON_HTTP_'+r.status);}
 if(!r.ok||j.ok!==true){const raw=String(j.message??j.detail??'').replaceAll(token,'[REDACTED]').replace(/fr_agent_[A-Za-z0-9_-]+/g,'[REDACTED]').slice(0,160);throw Error('FRANTIC_HTTP_'+r.status+'_'+String(j.error??'unknown').slice(0,45)+'_'+raw);}
 return j;
}
export async function run(){
 assert.equal(process.env.GITHUB_REPOSITORY,REPO,'REPO_MISMATCH');
 assert.equal(process.env.GITHUB_REF,'refs/heads/main','BRANCH_MISMATCH');
 const s=await call('/v1/agents/'+KID+'/status');
 if(!isReady(s))throw Error('OWN_PROFILE_NOT_VERIFIED_OR_UNPAID');
 const invited=Array.isArray(s.invites)?s.invites:Array.isArray(s.agent?.invites)?s.agent.invites:[];
 const report={kid:KID,paidVerifiedPreviously:true,openClaims:(s.work?.open??[]).length,
  invitesObserved:invited.length,inviteDetails:invited.slice(0,10).map(x=>({
   id:x?.bounty?.number??x?.number??null,priceCents:x?.bounty?.price_cents??x?.price_cents??null,
   status:x?.status??x?.stage??null})),
  newMoneyClaimedUsd:0,newContractsClaimed:0,ownerSpendUsd:0,emailsSent:0,profileUpdate:false};
 // Only mutate own marketing profile on explicit manually dispatched or pushed
 // change, never on scheduled read-only checks.
 if(['workflow_dispatch','push'].includes(process.env.GITHUB_EVENT_NAME)){
  const patch=desiredProfile();
  if(s.agent?.situation?.pitch===patch.situation.pitch&&s.agent?.situation?.floor_cents===patch.situation.floor_cents){
   report.profileAlreadyCurrent=true;
  }else{
   const r=await call('/v1/agents/'+KID+'/profile',{method:'PATCH',body:patch});
   if(r.agent?.kid&&r.agent.kid!==KID)throw Error('PROFILE_RESPONSE_WRONG_ACCOUNT');
   report.profileUpdate=true;
  }
 }
 console.log('FRANTIC_VERIFIED_HIRE '+JSON.stringify(report));
 return report;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])run().catch(e=>{console.error('FRANTIC_HIRE_SAFE_STOP '+String(e.message).slice(0,125));process.exitCode=1;});
