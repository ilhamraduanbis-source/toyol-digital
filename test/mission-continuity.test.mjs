import test from 'node:test';
import assert from 'node:assert/strict';
import {routeCandidates} from '../src/mission-continuity.mjs';
const cfg={missions:[{id:'a',purpose:'finish A',workflow:'a.yml'},{id:'b',purpose:'finish B',workflow:'b.yml'},{id:'atlas-mega-contracts',purpose:'5m',workflow:'atlas.yml'}],continuityPolicy:{preserveExistingWork:true}};
const t=(url,reward,extra={})=>({url:'https://example.org/'+url,title:url,reward_amount:reward,reward_currency:'USD',suitable_for_draft:true,eligibility:{status:'REVIEW'},stake_required:false,stake_terms_unverified:false,source:'test',...extra});
test('diverse reward values, unique candidates, no disruption or inferred claims',()=>{
 const x=routeCandidates(cfg,{tasks:[t('small',1),t('large',500),t('large',500),t('blocked',10000,{stake_required:true}),t('expired',999,{deadline:'2000-01-01T00:00:00Z'})]},Date.parse('2026-11-16T00:00:00Z'));
 assert.equal(x.distinctCandidates,2);
 assert.equal(x.agents[0].nextCandidate.advertisedReward,500);
 assert.equal(x.agents[1].nextCandidate.advertisedReward,1);
 assert.equal(x.agents[2].nextCandidate,null);
 assert.ok(x.agents.every(a=>a.claimAuthorized===false&&a.noFixedRewardCeiling&&a.currentWorkStatus.startsWith('PRESERVE')));
 assert.equal(x.incomeInferred,false);
});
test('empty radar preserves every original mission',()=>{
 const x=routeCandidates(cfg,{tasks:[]});
 assert.equal(x.distinctCandidates,0);assert.equal(x.agents.length,3);
 assert.ok(x.agents.every(a=>a.nextCandidate===null));
});
