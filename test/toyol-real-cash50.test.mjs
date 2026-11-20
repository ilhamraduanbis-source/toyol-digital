import test from 'node:test';
import assert from 'node:assert/strict';
import {pick,originalIssueGate} from '../src/toyol-real-cash50.mjs';
function x(currency,age=0,other={}){return {id:'one',title:'Write API tests',url:'https://github.com/x/y/issues/1',date_published:new Date(Date.now()-age*86400000).toISOString(),_jobbi:{lane:'agent',source:'algora',reward:{amount:100,currency},payment_state:'escrowed',payout_grade:'B',...other}};}
test('only genuine currency and independently escrow-declared listings',()=>{
 let p=pick([x('OPENWORK'),x('USD'),x('USDC',0,{payment_state:'promised'})]);assert.equal(p.rows.length,1);assert.equal(p.rows[0].currency,'USD');
});
test('exclude old and purchase obligations',()=>{
 let p=pick([x('USD',250),{...x('USD'),title:'Buy a token to qualify'},x('USDC')]);assert.equal(p.rows.length,1);assert.equal(p.rows[0].currency,'USDC');
});
test('do not infer money from listing',()=>{
 let p=pick([x('USD')]);assert.equal(p.rows[0].confirmedEarnedUsd,0);
});

test('do not assign a revived ancient issue with no verifiable bounty evidence',()=>{
 const issue={state:'open',created_at:'2020-11-17T15:47:17Z',updated_at:'2026-11-19T14:44:28Z',comments:33,labels:[{name:'enhancement'}],assignees:[],body:'Please add Nearby Share support'};
 const g=originalIssueGate(issue,300,Date.parse('2026-11-20T16:00:00Z'));
 assert.equal(g.actionableForImmediateWork,false);
 assert.equal(g.originalBountyEvidence,false);
 assert.equal(g.reason,'STALE_ORIGINAL_WITHOUT_BOUNTY_PROOF');
});
test('a bounty label needs separate primary payout proof, and an assigned issue is blocked',()=>{
 const now=Date.parse('2026-11-20T16:00:00Z');
 const base={state:'open',created_at:'2026-11-01T00:00:00Z',comments:1,labels:[{name:'bounty'}],assignees:[]};
 assert.equal(originalIssueGate(base,100,now).actionableForImmediateWork,true);
 assert.equal(originalIssueGate(base,100,now).payoutIndependentlyVerified,false);
 assert.equal(originalIssueGate({...base,assignees:[{login:'working'}]},100,now).actionableForImmediateWork,false);
});
