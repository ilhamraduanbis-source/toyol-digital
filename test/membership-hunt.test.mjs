import test from 'node:test';
import assert from 'node:assert/strict';
import {membershipHunt,summary} from '../src/membership-hunt.mjs';
const fixture=async url=>{
 if(url.includes('gofrantic.com'))return {ok:true,agent:{kid:'agent-65c3b0',situation:{open:true},onboarding:{payout:{set:true}},invites:[{number:8,privateBrief:'never publish'}]},work:{summary:{deliveredPendingReview:1}}};
 if(url.includes('swarmmemo.com'))return {ok:true,data:{work:{id:'65ba0fb3af541b65f34cf4bbd2b40c03',results:[{result_id:'6aaba9998e6a4f41ca2872a5eac1b273'}]}}};
 throw Error('unexpected request');
};
test('confirmed Frantic and prior SwarmMemo submission are distinct from new membership',async()=>{
 const x=await membershipHunt({read:fixture,token:'',expectedId:''});
 assert.equal(x.providers[0].status,'REGISTERED_VERIFIED');
 assert.equal(x.providers[0].invitations,1);
 assert.equal(x.providers[1].durable_member_key,false);
 assert.equal(x.providers[2].status,'FREE_JOIN_AVAILABLE_CREDENTIAL_SETUP_REQUIRED');
 assert.equal(x.owner_spend_authorized,false);
 assert.ok(!JSON.stringify(x).includes('never publish'));
});
test('authenticated OpenTask counts are private-data-minimized and do not imply revenue',async()=>{
 const read=async(url,token)=>{
  if(!url.includes('opentask.ai'))return fixture(url);
  assert.equal(token,'test-secret');
  if(url.endsWith('/me'))return {profile:{id:'toyol-profile',bio:'private text'}};
  if(url.includes('onboarding'))return {checkpoint:'activated'};
  if(url.includes('proposals'))return {proposals:[{secret:'private proposal body'}]};
  if(url.includes('recommendations'))return {recommendations:[{}]};
  return {notifications:[{},{}]};
 };
 const x=await membershipHunt({read,token:'test-secret',expectedId:'toyol-profile'});
 assert.equal(x.providers[2].status,'REGISTERED_VERIFIED');
 assert.equal(x.providers[2].proposal_page_count,1);
 assert.equal(x.providers[2].unread_page_count,2);
 assert.ok(!JSON.stringify(x).includes('private proposal body'));
 assert.ok(!summary(x).includes('test-secret'));
});
test('wrong profile fails closed without reading private inbox',async()=>{
 let calls=0;
 const x=await membershipHunt({token:'test-secret',expectedId:'toyol',read:async(url)=>{
  if(!url.includes('opentask.ai'))return fixture(url);
  calls++;return {profile:{id:'other'}};
 }});
 assert.equal(calls,1);
 assert.equal(x.providers[2].status,'UNVERIFIED');
});
test('source failures are not zero invitations and secrets are not echoed',async()=>{
 const x=await membershipHunt({token:'',expectedId:'',read:async()=>{throw Error('private-secret');}});
 assert.equal(x.providers[0].status,'UNVERIFIED');
 assert.equal(x.providers[0].invitations,undefined);
 assert.ok(!JSON.stringify(x).includes('private-secret'));
});
