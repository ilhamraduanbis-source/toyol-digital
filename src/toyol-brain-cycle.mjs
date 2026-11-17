/**
 * One bounded model context and remembered plan for each existing Toyol clone.
 * Runs on its own Actions runner, not in or instead of any income workflow.
 * Real Qwen CPU inference; generated text is advisory, never a signed action.
 */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {runBatch,MODEL} from './agent-ai.mjs';

const path='runner/brains/latest.json';
function roster(){
  const j=JSON.parse(readFileSync('runner/clone-missions.json','utf8'));
  assert.equal(j.version,1);
  assert.ok(Array.isArray(j.missions)&&j.missions.length>=1&&j.missions.length<=20);
  const ids=j.missions.map(x=>x.id);
  assert.equal(new Set(ids).size,ids.length);
  return j.missions;
}
function oldState(ids){
  const j=JSON.parse(readFileSync(path,'utf8'));
  assert.equal(j.version,1);
  assert.ok(j.agents&&typeof j.agents==='object'&&!Array.isArray(j.agents));
  for(const id of Object.keys(j.agents))assert.ok(ids.includes(id));
  return j;
}
function contextRequest(m,previous){
  const academic=m.domain==='academic-development'||m.incomeHunting===false;
  const purpose=academic?'learn':/payment|reconciliation/i.test(m.id)?'review':/contract|awards|hopper|aggregator/i.test(m.id)?'research':'plan';
  const history=previous&&typeof previous.proposal==='string'?
    previous.proposal.replace(/[\r\n\t]+/g,' ').slice(0,250):'No prior independent brain plan.';
  const task=[
    'Current assigned clone purpose: '+String(m.purpose||'').slice(0,950),
    'Previous private-to-this-clone planning excerpt: '+history,
    'Use only vetted shared skill evidence. Give one specific next action, its proof criterion,',
    'one risk and one stop criterion. Preserve existing jobs. Do NOT claim a payment,',
    'accept a contract, access a wallet, spend anything, impersonate anyone,',
    'or request an unreviewed external action.',
    academic?'Focus on a concrete educational practice exercise, not income hunting.':'Focus on a claimable funded opportunity within existing permissions.'
  ].join(' ');
  assert.ok(task.length<=2400);
  return {worker:m.id,purpose,task};
}
function main(){
  const missions=roster(),ids=missions.map(x=>x.id),previous=oldState(ids);
  const requests=missions.map(m=>contextRequest(m,previous.agents[m.id]));
  if(process.argv.includes('--self-test')){
    assert.equal(requests.length,ids.length);
    assert.equal(new Set(requests.map(x=>x.worker)).size,ids.length);
    assert.ok(requests.some(x=>x.worker==='nexus-cross-sector'&&x.purpose==='learn'));
    console.log('CLONE_BRAIN_ROSTER_TEST_OK '+ids.length);
    return;
  }
  const responses=runBatch(requests,{modelDir:process.env.TOYOL_LOCAL_MODEL_DIR});
  assert.equal(responses.length,ids.length);
  const next={version:1,source:'Qwen CPU model; non-executable advisory plan',lastRunId:String(process.env.GITHUB_RUN_ID||'local'),updatedAt:new Date().toISOString(),agents:{}};
  for(const r of responses){
    assert.ok(ids.includes(r.worker)&&!Object.hasOwn(next.agents,r.worker));
    assert.equal(r.model,MODEL.id);
    assert.equal(r.liveExecutionAuthorized,false);
    assert.equal(r.ownerSpend,0);
    assert.equal(r.incomeInferred,false);
    const prev=previous.agents[r.worker]||{};
    next.agents[r.worker]={
      model:MODEL.id,revision:MODEL.revision,
      purpose:r.purpose,proposal:r.proposal.slice(0,2400),
      generatedTokens:r.generatedTokens,lastRunId:next.lastRunId,
      status:'MODEL_DRAFT_NO_PAYMENT_OR_EXTERNAL_AUTHORIZATION',
      cycles:(Number.isSafeInteger(prev.cycles)?prev.cycles:0)+1
    };
    console.log('INDEPENDENT_CLONE_AI '+JSON.stringify({id:r.worker,tokens:r.generatedTokens,
      cycles:next.agents[r.worker].cycles,approvedForExternalAction:false}));
  }
  mkdirSync('out/brains',{recursive:true});
  writeFileSync('out/brains/latest.json',JSON.stringify(next,null,2)+'\n');
  console.log('ISOLATED_AI_BRAINS_COMPLETED '+ids.length+' real model inferences; zero spend and zero income inferred');
}
main();
