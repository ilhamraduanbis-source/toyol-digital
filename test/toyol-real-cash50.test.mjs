import test from 'node:test';
import assert from 'node:assert/strict';
import {pick} from '../src/toyol-real-cash50.mjs';
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
