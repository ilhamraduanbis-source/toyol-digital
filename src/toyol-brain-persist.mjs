/**
 * Preserve per-clone AI state after verified local inference.
 * A single separate file is updated; no original worker workflow is modified.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const REPO='ilhamraduanbis-source/toyol-digital';
const PATH='runner/brains/latest.json';
const token=process.env.GH_TOKEN;
if(!token)throw Error('NO_WRITE_TOKEN');
const next=JSON.parse(readFileSync('out/brains/latest.json','utf8'));
const registry=JSON.parse(readFileSync('runner/clone-missions.json','utf8'));
const ids=registry.missions.map(x=>x.id);
assert.equal(next.version,1);
assert.equal(next.lastRunId,process.env.GITHUB_RUN_ID);
assert.deepEqual(Object.keys(next.agents).sort(),ids.slice().sort());
for(const [id,x] of Object.entries(next.agents)){
  assert.equal(x.model,'Qwen/Qwen2.5-0.5B-Instruct');
  assert.equal(x.status,'MODEL_DRAFT_NO_PAYMENT_OR_EXTERNAL_AUTHORIZATION');
  assert.equal(x.lastRunId,next.lastRunId);
  assert.ok(x.generatedTokens>0&&x.proposal.length<=2400&&x.proposal.length>0);
}
const url='https://api.github.com/repos/'+REPO+'/contents/'+PATH;
const headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json',
  'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json','User-Agent':'ToyolCloneBrainPersist'};
async function api(method,body){
  const r=await fetch(url,{method,headers,redirect:'error',signal:AbortSignal.timeout(18000),
    ...(body?{body:JSON.stringify(body)}:{})});
  if(!r.ok)throw Error('BRAIN_SAVE_'+method+'_HTTP_'+r.status);
  return r.json();
}
const current=await api('GET'),prior=JSON.parse(Buffer.from(current.content.replace(/\s/g,''),'base64').toString('utf8'));
assert.equal(prior.version,1);
if(prior.lastRunId===next.lastRunId){console.log('AI_BRAIN_CYCLE_ALREADY_SAVED');process.exit(0);}
for(const id of ids){
  const cycles=prior.agents?.[id]?.cycles??0;
  assert.equal(next.agents[id].cycles,cycles+1,'CONCURRENT_BRAIN_REVISION_STOP');
}
const content=Buffer.from(JSON.stringify(next,null,2)+'\n').toString('base64');
const saved=await api('PUT',{message:'Refresh separate Toyol per-clone Qwen brain memory (no claims, no wallet access)',
  content,sha:current.sha,branch:'main'});
assert.ok(saved.commit?.sha&&saved.content?.sha);
console.log('PER_CLONE_AI_MEMORY_SAVED '+JSON.stringify({count:ids.length,commit:saved.commit.sha,model:'Qwen/Qwen2.5-0.5B-Instruct',authorizedActions:0}));
