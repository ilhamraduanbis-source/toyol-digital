import {test} from 'node:test'
import assert from 'node:assert/strict'
import {assess,hudText} from '../src/decision.mjs'
test('No proof cannot be a pass',()=>{
 assert.equal(assess('Review code').status,'NEEDS_PROOF')
 assert.equal(assess('Review code','local_test').status,'TESTED_LOCALLY')
})
test('Payment actions held without independent owner review',()=>{
 assert.equal(assess('Deposit requested','none').status,'HOLD')
 assert.equal(assess('Payment due','local_test').status,'HOLD')
 assert.equal(assess('Paid invoice','external_confirmation').status,'HUMAN_REVIEW')
})
test('Credentials blocked',()=>{
 assert.equal(assess('share my private key','external_confirmation').status,'STOP')
})
test('Bad inputs cannot be silently accepted',()=>{
 assert.throws(()=>assess('   '))
 assert.throws(()=>assess('X','fabricated'))
 assert.throws(()=>assess('x'.repeat(241)))
})
test('HUD text bounded and user input not executed',()=>{
 const view=hudText('<script>alert(1)</script>',assess('Test','local_test'))
 assert.ok(view.length<=400)
 assert.match(view,/TESTED_LOCALLY/)
})
