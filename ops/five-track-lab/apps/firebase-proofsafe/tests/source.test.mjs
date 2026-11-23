import {test} from 'node:test'
import assert from 'node:assert/strict'
import {classifySource,canExportEvidence,createLocalEvidence} from '../src/source.mjs'
test('Actual source labels always come from returned SDK value',()=>{
 assert.equal(classifySource('ON_DEVICE'),'ON_DEVICE')
 assert.equal(classifySource('IN_CLOUD'),'IN_CLOUD')
 assert.equal(classifySource('PREFER_ON_DEVICE'),'UNKNOWN')
 assert.equal(classifySource(undefined),'UNKNOWN')
})
test('Do not export evidence for unproven attempts',()=>{
 assert.equal(canExportEvidence({completed:false,inferenceSource:'ON_DEVICE'}),false)
 assert.equal(canExportEvidence({completed:true,inferenceSource:'UNKNOWN'}),false)
 assert.equal(canExportEvidence({completed:true,inferenceSource:'IN_CLOUD'}),true)
 assert.throws(()=>createLocalEvidence({modelMode:'ONLY_ON_DEVICE',inferenceSource:undefined,responseLength:12}))
})
test('Evidence export contains no user prompt or model response',()=>{
 const data=createLocalEvidence({modelMode:'ONLY_ON_DEVICE',inferenceSource:'ON_DEVICE',responseLength:42})
 assert.equal(data.inferenceSource,'ON_DEVICE')
 assert.equal(data.responseLength,42)
 assert.equal(Object.keys(data).includes('prompt'),false)
 assert.equal(Object.keys(data).includes('answer'),false)
})
