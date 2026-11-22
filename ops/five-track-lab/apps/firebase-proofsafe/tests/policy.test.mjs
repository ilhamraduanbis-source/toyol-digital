import {test} from 'node:test'
import assert from 'node:assert/strict'
import {hasFirebaseConfig,cloudAllowed,safePrompt,chooseMode} from '../src/policy.mjs'
test('Cloud blocked without explicit four-factor guard',()=>{
 assert.equal(chooseMode({userConsent:true,quotaVerified:true,billingDisabledConfirmed:false,cloudFeatureEnabled:true}),'ONLY_ON_DEVICE')
 assert.equal(chooseMode({userConsent:false,quotaVerified:true,billingDisabledConfirmed:true,cloudFeatureEnabled:true}),'ONLY_ON_DEVICE')
 assert.equal(chooseMode({userConsent:true,quotaVerified:true,billingDisabledConfirmed:true,cloudFeatureEnabled:true}),'PREFER_ON_DEVICE')
 assert.equal(cloudAllowed({userConsent:false}),false)
})
test('Credentials and empty text rejected locally',()=>{
 assert.throws(()=>safePrompt('  '))
 assert.throws(()=>safePrompt('my private key is ...'))
 assert.throws(()=>safePrompt('A'.repeat(501)))
})
test('No fake Firebase configuration',()=>{
 assert.equal(hasFirebaseConfig({apiKey:'',projectId:'',appId:''}),false)
 assert.equal(hasFirebaseConfig({apiKey:'12345',projectId:'my-project',appId:'12345'}),true)
})
