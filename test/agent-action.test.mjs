import test from 'node:test';
import assert from 'node:assert/strict';
import {selectActions,executeAction,menu} from '../src/agent-action.mjs';
import {allAgentRequests} from '../src/agent-ai.mjs';

const response=(jobs,change={})=>({status:0,stdout:JSON.stringify(jobs.map(j=>({worker:j.worker,action:menu[0].id,method:'constrained-model-logits',scores:[5,4,3,2,1],...change})))});
test('model selection for every identity uses fixed menu and no provider credentials',()=>{
 const rows=selectActions(allAgentRequests(),{modelDir:'/mock',runner:(cmd,args,opts)=>{
  assert.equal(cmd,'python3');assert.equal(args.at(-1),'--select');assert.equal(opts.env.OPENAI_API_KEY,undefined);
  const jobs=JSON.parse(opts.input);assert.equal(jobs.length,allAgentRequests().length);assert.ok(jobs.every(x=>x.choices.length===5));
  return response(jobs);
 }});
 assert.equal(rows.length,allAgentRequests().length);assert.ok(rows.every(x=>x.action==='audit-roster'));
});
test('reject foreign actions, invalid scores, wrong identities and unavailable inference',()=>{
 const req=allAgentRequests().slice(0,1);
 for(const change of [{action:'run-shell'},{action:menu[1].id},{worker:'wrong'},{scores:[1,2]},{scores:[1,2,3,4,null]}]){
  assert.throws(()=>selectActions(req,{modelDir:'/mock',runner:(_c,_a,o)=>response(JSON.parse(o.input),change)}),/INVALID_MODEL_ACTION|ACTION_SCORE_MISMATCH/);
 }
 assert.throws(()=>selectActions(req,{modelDir:'/mock',runner:()=>({status:1})}),/ACTION_MODEL_UNAVAILABLE/);
 assert.throws(()=>selectActions(req.concat(req),{modelDir:'/mock'}),/INVALID_AGENT_BATCH/);
});
test('all five reviewed tools actually execute and independently verify their outputs',async()=>{
 const results=await Promise.all(menu.map(x=>executeAction({worker:'aggregator',action:x.id})));
 assert.equal(results.length,5);
 assert.ok(results.every(x=>x.status==='VERIFIED_LOCAL_ACTION'&&x.ownerSpend===0&&x.externalAction===false&&x.incomeInferred===false));
 assert.equal(results.find(x=>x.action==='audit-roster').evidence.records,allAgentRequests().length);
 assert.equal(results.find(x=>x.action==='test-tabular').evidence.lossless,true);
});
test('unregistered agent and arbitrary actions are rejected',async()=>{
 await assert.rejects(executeAction({worker:'unknown',action:'audit-roster'}),/ACTION_NOT_PERMITTED/);
 await assert.rejects(executeAction({worker:'aggregator',action:'transfer-wallet'}),/ACTION_NOT_PERMITTED/);
});
