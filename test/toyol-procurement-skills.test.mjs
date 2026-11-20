import test from 'node:test';
import assert from 'node:assert/strict';
import {LEADS,evaluateLead,reconcileTransfer,runTask} from '../src/toyol-procurement-skills.mjs';
test('no headline value alone qualifies a bid',()=>{
 for(const lead of LEADS){const x=evaluateLead(lead);assert.equal(x.bidReady,false);assert.equal(x.committedRevenue,0);}
});
test('expiry and forecast force nonqualification',()=>{
 const x=evaluateLead({...LEADS[0],deadline:'2026-01-01',selectionCriteriaVerified:true,eligibilityVerified:true,subcontractAllowedVerified:true,resourcesVerified:true},'2026-11-20');
 assert.equal(x.bidReady,false);
 const y=evaluateLead({...LEADS[3],selectionCriteriaVerified:true,eligibilityVerified:true,subcontractAllowedVerified:true,resourcesVerified:true});
 assert.equal(y.bidReady,false);
});
test('actual complete and future notice only passes programmatic gate',()=>{
 const x=evaluateLead({...LEADS[0],selectionCriteriaVerified:true,eligibilityVerified:true,subcontractAllowedVerified:true,resourcesVerified:true},'2026-11-20');
 assert.equal(x.bidReady,true);assert.equal(x.reason,'REQUIRES_HUMAN_APPROVAL');
});
test('synthetic settlement must reject amount, wallet and finality mismatches',()=>{
 const original={chainId:8453,token:'0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',to:'0x0011223344556677889900112233445566778899',amountAtomic:'1000000',txHash:'0x'+'c'.repeat(64),finalized:true};
 assert.equal(reconcileTransfer(original,original).matched,true);
 for(const changes of [{amountAtomic:'1000001'},{to:'0x1111223344556677889900112233445566778899'},{finalized:false},{chainId:1}])
  assert.equal(reconcileTransfer({...original,...changes},original).matched,false);
 assert.throws(()=>reconcileTransfer({...original,amountAtomic:'-1'},original),/AMOUNT_INVALID/);
});
test('actual local technical QA and commercial exercise do not claim earnings',async()=>{
 const t=await runTask('tiny-chess-training','technical-qa');
 assert.equal(t.evidence.positive.matched,true);assert.equal(t.evidence.negative.matched,false);
 const c=await runTask('aggregator','commercial');
 assert.equal(c.model.grossScenarioUsd,192000);
 for(const x of [t,c]){assert.equal(x.bidsSubmitted,0);assert.equal(x.incomeVerifiedUsd,0);assert.equal(x.capabilityCertified,false);}
});
test('unsafe task IDs and malformed clone are rejected',async()=>{
 await assert.rejects(runTask('not valid','commercial'),/UNAPPROVED_ASSIGNMENT/);
 await assert.rejects(runTask('atlas-mega-contracts','bid-submit'),/UNAPPROVED_ASSIGNMENT/);
});
