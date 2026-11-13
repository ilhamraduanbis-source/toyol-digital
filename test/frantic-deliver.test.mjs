import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execute,contractHash,validateJob,KID} from '../src/frantic-deliver.mjs';
const id='a1234567-1234-1234-1234-123456789012';
const b={number:1000,title:'Public report',description:'Factual analysis of supplied data',criteria:{},price_cents:100,funded:true,funded_receipt_ref:'receipt:funded',visibility:'public',work_status:'open',claim_progress:{available:1},delivery_contract:{artifacts:[{name:'report',required:true}]}};
const job={bounty:1000,price_cents:100,contract_sha256:contractHash(b),reviewed:true,owner_cost_cents:0,work_complete:true,artifact_refs:['report=https://raw.githubusercontent.com/ilhamraduanbis-source/toyol-digital/'+'a'.repeat(40)+'/deliverables/report.md']};
const agent={agent:{kid:KID,claimEligibility:{eligible:true},onboarding:{payout:{set:true}}},verification:{sworn:true},work:{open:[],settled:[]}};
function mock({bounty=b,work=agent.work,hidden=[],deny=false}={}){
 const calls=[];
 const api=async(p,m='GET',body)=>{
 calls.push([p,m,body]);
 if(p.endsWith('/status'))return {...agent,work};
 if(p.startsWith('/v1/bounties/'))return {bounty};
 if(p==='/v1/deliveries/preflight'){if(deny)throw Error('PREFLIGHT_FAILED');return {ok:true};}
 if(p==='/v1/claims')return {claim_id:id};
 if(p==='/v1/claims/'+id)return {claim_id:id,agent_kid:KID,bounty_number:b.number,visibility:'public',access:{pending:false},delivery:null,deliver_deadline_at:new Date(Date.now()+600000).toISOString(),eligibility:hidden};
 if(p==='/v1/deliveries')return {ok:true,delivery_id:'delivery'};
 throw Error('unexpected route');
 };
 return {api,calls};
}
test('preflight, claim, verify ownership, preflight, deliver',async()=>{
 const {api,calls}=mock();const out=await execute(job,api);
 assert.equal(out.result,'DELIVERY_SUBMITTED');
 assert.deepEqual(calls.filter(x=>x[1]==='POST').map(x=>x[0]),['/v1/deliveries/preflight','/v1/claims','/v1/deliveries/preflight','/v1/deliveries']);
});
test('never claim when preflight fails or contract changed',async()=>{
 for(const cfg of [{deny:true},{bounty:{...b,description:'changed'}},{bounty:{...b,claim_progress:{available:0}}},{bounty:{...b,visibility:'private'}}]){
  const {api,calls}=mock(cfg);await assert.rejects(execute(job,api));assert.equal(calls.some(x=>x[0]==='/v1/claims'),false);
 }
});
test('resume without duplicate claim and do not repeat delivery',async()=>{
 let m=mock({work:{open:[{bounty:{number:1000},claimId:id,stage:'delivery_due'}],settled:[]}});
 assert.equal((await execute(job,m.api)).result,'DELIVERY_SUBMITTED');assert.equal(m.calls.some(x=>x[0]==='/v1/claims'),false);
 m=mock({work:{open:[{bounty:{number:1000},claimId:id,stage:'human_review_pending'}],settled:[]}});
 assert.equal((await execute(job,m.api)).result,'EXISTING_CLAIM_DO_NOT_RESUBMIT');assert.equal(m.calls.length,1);
});
test('zero cost and immutable artifacts required; hidden eligibility stops delivery',async()=>{
 assert.throws(()=>validateJob({...job,owner_cost_cents:1}));
 assert.throws(()=>validateJob({...job,artifact_refs:['report=https://raw.githubusercontent.com/ilhamraduanbis-source/toyol-digital/main/deliverables/report.md']}));
 const {api,calls}=mock({hidden:[{status:'unmet'}]});await assert.rejects(execute(job,api));assert.equal(calls.some(x=>x[0]==='/v1/deliveries'),false);
});
