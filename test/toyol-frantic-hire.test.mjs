import test from 'node:test';
import assert from 'node:assert/strict';
import {desiredProfile,isReady} from '../src/toyol-frantic-hire.mjs';
const good={agent:{kid:'agent-65c3b0',claimEligibility:{eligible:true},onboarding:{payout:{set:true}}},verification:{sworn:true},work:{settled:[{stage:'paid',bounty:{number:148}}]}};
test('existing owner identity, previous settlement and wallet necessary',()=>{
 assert.equal(isReady(good),true);
 for(const obj of [{agent:{...good.agent,kid:'someone-else'}},{verification:{sworn:false}},{work:{settled:[]}}]){
  assert.equal(isReady({...good,...obj}),false);
 }
});
test('public hire profile is truthful and $10 floor, without links and without paid claims',()=>{
 const p=desiredProfile();
 assert.equal(p.situation.floor_cents,1000);
 assert.equal(p.situation.open,true);
 assert.equal(p.situation.wants.length,3);
 assert.ok(p.situation.pitch.length<=140);
 assert.doesNotMatch(p.situation.pitch,/http|guarantee|1000 customers/i);
});
