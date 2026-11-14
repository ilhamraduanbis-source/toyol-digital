import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MISSIONS,chooseMissions,recordCycle} from '../src/mission-engine.mjs';
const now=Date.parse('2026-11-14T10:00:00Z');
const run=(age,event='schedule',status='completed',conclusion='success')=>({id:100+age,event,status,conclusion,created_at:new Date(now-age*60000).toISOString()});
const obs=()=>Object.fromEntries(MISSIONS.map(m=>[m.id,{state:'active',runs:[run(200)]}]));
const plan=(opts={})=>chooseMissions({now,observations:obs(),...opts});
test('priority chooses contracts and prepared work, never more than two',()=>{
 assert.deepEqual(plan({preparedDelivery:true}).selected,['contract-watch','frantic-delivery']);
 assert.deepEqual(plan().selected,['contract-watch','payment-watch']);
});
test('active or queued work is never dispatched again',()=>{
 const o=obs();o['contract-watch'].runs=[run(2,'schedule','in_progress',null)];
 o['payment-watch'].runs=[run(1,'schedule','queued',null)];
 const p=plan({observations:o});assert(!p.selected.includes('contract-watch'));assert(!p.selected.includes('payment-watch'));
 assert.equal(p.decisions.find(x=>x.id==='contract-watch').status,'ACTIVE');
});
test('recent runs and recorded dispatch attempts enforce cooldowns',()=>{
 const o=obs();o['contract-watch'].runs=[run(30)];
 const p=plan({observations:o,previous:{'payment-watch':{lastDispatch:new Date(now-1000).toISOString()}}});
 assert(!p.selected.includes('contract-watch'));assert(!p.selected.includes('payment-watch'));
});
test('unknown, disabled and unreviewed work never execute',()=>{
 const o=obs();delete o['contract-watch'];o['payment-watch'].state='disabled_manually';
 const p=plan({observations:o});assert(!p.selected.includes('contract-watch'));assert(!p.selected.includes('payment-watch'));assert(!p.selected.includes('frantic-delivery'));
});
test('skill tests require a change; push tests do not count as Jobbi scans',()=>{
 const o=obs();o['bounded-worker'].runs=[run(2,'push'),run(180)];
 const p=plan({observations:o});assert.equal(p.decisions.find(x=>x.id==='bounded-worker').status,'READY');
 assert.equal(p.decisions.find(x=>x.id==='skill-readiness').status,'WAITING_FOR_CHANGE');
 assert.equal(plan({skillsChanged:true}).decisions.find(x=>x.id==='skill-readiness').status,'READY');
});
test('failed workflow backs off for at least three hours',()=>{
 const o=obs();o['contract-watch'].runs=[run(120,'schedule','completed','failure')];
 assert.equal(plan({observations:o}).decisions.find(x=>x.id==='contract-watch').status,'COOLDOWN');
});
test('persistent cycle history records requests, not successful jobs or revenue',()=>{
 const p=plan(),state=recordCycle({now,previous:{history:[]},decisions:p.decisions,dispatches:[{id:'contract-watch',ok:true},{id:'payment-watch',ok:false}],live:{}});
 assert.equal(state.missions['contract-watch'].status,'DISPATCH_REQUESTED');
 assert.equal(state.missions['payment-watch'].status,'DISPATCH_UNCERTAIN');
 assert.equal(state.history.length,1);assert.deepEqual(state.history[0].requested,['contract-watch']);
 assert(!('earnings' in state));
});
