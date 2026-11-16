import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareRequest,runBatch,allAgentRequests,MODEL,purposes} from '../src/agent-ai.mjs';

test('every registered clone can independently request all eight kinds of AI assistance',()=>{
 const agents=allAgentRequests();
 assert.equal(agents.length,11);
 assert.equal(new Set(agents.map(a=>a.worker)).size,11);
 for(const a of agents)for(const purpose of Object.keys(purposes)){
  const req=prepareRequest(a.worker,purpose,'Plan a bounded local verification.');
  assert.equal(req.worker,a.worker);
  assert.equal(req.context.mission.id,a.worker);
  assert.equal(req.context.skills.length,4);
  assert.equal(req.model.id,MODEL.id);
  assert.ok(req.context.observations.length<=2);
  assert.ok(req.context.shared.length<=4);
 }
});
test('reject unknown identities, task purposes, empty tasks and likely secrets',()=>{
 assert.throws(()=>prepareRequest('unknown-agent','plan','test'));
 assert.throws(()=>prepareRequest('aggregator','transfer','test'),/UNSUPPORTED_PURPOSE/);
 assert.throws(()=>prepareRequest('aggregator','plan',''),/INVALID_TASK/);
 assert.throws(()=>prepareRequest('aggregator','plan','x'.repeat(2401)),/INVALID_TASK/);
 assert.throws(()=>prepareRequest('aggregator','plan','sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'),/SECRET_LIKE_INPUT/);
});
const reply=(python,args,opts)=>{
 assert.equal(python,'python3');
 assert.equal(opts.env.HF_HUB_OFFLINE,'1');
 assert.equal(opts.env.TRANSFORMERS_OFFLINE,'1');
 assert.equal(opts.env.OPENAI_API_KEY,undefined);
 assert.equal(opts.env.GITHUB_TOKEN,undefined);
 const jobs=JSON.parse(opts.input);
 return {status:0,stdout:JSON.stringify(jobs.map(j=>({worker:j.worker,purpose:j.purpose,text:'Draft only: test the local module.',generatedTokens:8})))};
};
test('batch revalidates caller context and marks all model answers as untrusted drafts',()=>{
 const requests=allAgentRequests().map(x=>({...x,context:{secret:'not sent'},model:{id:'paid-model'}}));
 const rows=runBatch(requests,{modelDir:'/mock-model',runner:reply});
 assert.equal(rows.length,11);
 assert.ok(rows.every(x=>x.status==='UNTRUSTED_DRAFT_REQUIRES_VALIDATION'&&x.ownerSpend===0&&x.liveExecutionAuthorized===false&&x.incomeInferred===false));
});
test('fail closed on absent model, inference error, wrong identity, empty output or incomplete output',()=>{
 const req=[{worker:'aggregator',purpose:'plan',task:'Check tests'}];
 assert.throws(()=>runBatch(req),/LOCAL_MODEL_NOT_PROVISIONED/);
 assert.throws(()=>runBatch(req,{modelDir:'/mock',runner:()=>({status:1})}),/LOCAL_INFERENCE_UNAVAILABLE/);
 assert.throws(()=>runBatch(req,{modelDir:'/mock',runner:()=>({status:0,stdout:'[]'})}),/INCOMPLETE_MODEL_RESPONSE/);
 for(const row of [{worker:'frantic-delivery',purpose:'plan',text:'test',generatedTokens:5},{worker:'aggregator',purpose:'plan',text:'',generatedTokens:5},{worker:'aggregator',purpose:'plan',text:'test',generatedTokens:193}]){
  assert.throws(()=>runBatch(req,{modelDir:'/mock',runner:()=>({status:0,stdout:JSON.stringify([row])})}),/INVALID_MODEL_RESULT/);
 }
});
