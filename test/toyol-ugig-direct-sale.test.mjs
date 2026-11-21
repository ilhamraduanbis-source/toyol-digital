import test from 'node:test';
import assert from 'node:assert/strict';
import {derivePassword,listing,receiptSafe} from '../src/toyol-ugig-direct-sale.mjs';
test('never publish a job posting when selling a service',()=>{
 const x=listing();assert.equal(x.listing_type,'for_hire');assert.equal(x.status,'active');assert.equal(x.payment_coin,'usdc_pol');
 assert.equal(x.budget_min,x.budget_max);assert.equal(x.budget_min,15);
 assert.match(x.description,/not a cleaning service/i);
});
test('secret-derived password is stable, long, unique to existing secret',()=>{
 const a=derivePassword('fr_agent_aabbccddeeff0011');
 const b=derivePassword('fr_agent_qqwwaassddff0011');
 assert.equal(a.length,44);assert.notEqual(a,b);assert.equal(a,derivePassword('fr_agent_aabbccddeeff0011'));
 assert.throws(()=>derivePassword('oops'),/EXISTING_AGENT_SECRET/);
});
test('data returned to logs excludes credentials',()=>{
 assert.deepEqual(receiptSafe({ok:true,api_key:'secret',access_token:'secret2',status:200,title:'x'}),{
  ok:true,status:200,id:null,title:'x',url:null,listing_type:null,price:null,payment_coin:null});
});
