import test from 'node:test';
import assert from 'node:assert/strict';
import {qualifies,compose,SIGNATURE} from '../src/toyol-csv-inbound.mjs';
const issue={state:'open',title:'[CSV Audit Inquiry] Check my import',body:'### What problem are you trying to solve?\nMissing required fields\n\n- [x] I will not include confidential or personal data in this public issue. [CSV_INQUIRY_V1]',
 user:{type:'User'}};
test('only opted-in buyer issues qualify',()=>{
 assert.equal(qualifies(issue),true);
 for(const update of [{title:'Can you review this'}, {body:'Missing required fields'}, {state:'closed'}, {user:{type:'Bot'}},{pull_request:{}}])
  assert.equal(qualifies({...issue,...update}),false);
});
test('inbound reply is actionable but never a payment or custom delivery claim',()=>{
 const r=compose(issue);
 assert.ok(r.includes(SIGNATURE));assert.match(r,/required/);assert.match(r,/free fixed example/);
 assert.match(r,/0\.01 USDC/);assert.match(r,/not a promise of a custom solution or a completed sale/);
 assert.doesNotMatch(r,/seed phrase|send your password/i);
});
