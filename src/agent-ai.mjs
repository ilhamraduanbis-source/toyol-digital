/** Shared text-model gateway for the existing Toyol identities.
 * Model output is an untrusted proposal, never executable code or an authorization.
 * Local inference only: no provider keys, paid fallback, wallet or external actions.
 */
import {agentContext} from './shared-skill-cloud.mjs';
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
export const MODEL=Object.freeze({id:'Qwen/Qwen2.5-0.5B-Instruct',revision:'c89bee90d9f811437d9735454613c35b4a3c4dc8',license:'Apache-2.0',runtime:'local-cpu',apiCostUsd:0});
export const purposes=Object.freeze({
 plan:'Propose one concrete next step, evidence required and stop condition.',
 research:'Identify what facts and authoritative sources must be checked; do not invent findings.',
 code:'Propose a minimal implementation and executable test strategy; do not claim it ran.',
 debug:'Propose a reproducer, probable causes and tests; distinguish inference from evidence.',
 review:'Identify correctness, security and acceptance risks and how to verify them.',
 write:'Draft concise text for review, without sending or publishing it.',
 learn:'Describe a reusable skill, a practice task and a test of competence.',
 coordinate:'Suggest a division of work using existing registered capabilities.'
});
const roster=()=>JSON.parse(readFileSync(resolve(root,'runner/clone-missions.json'),'utf8')).missions;
export function prepareRequest(worker,purpose,task){
 if(!Object.hasOwn(purposes,purpose))throw Error('UNSUPPORTED_PURPOSE');
 if(typeof task!=='string'||!task.trim()||task.length>2400)throw Error('INVALID_TASK');
 // Free/local inference is not a reason to expose account data; keep context bounded.
 if(/(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16})\b)/.test(task))throw Error('SECRET_LIKE_INPUT');
 const c=agentContext(worker,task);
 const observations=c.ownObservations.slice(-2).map(x=>({conclusion:x.conclusion,lesson:x.lesson,runId:x.runId}));
 const shared=c.memory.observations.slice(-4).map(x=>({worker:x.worker,conclusion:x.conclusion,lesson:x.lesson,runId:x.runId}));
 const context={mission:c.mission,pendingDecision:c.decision.next,skills:c.skills.map(x=>({id:x.id,tags:x.tags,scope:x.scope})),observations,shared};
 return {worker,purpose,task,context,instruction:purposes[purpose],model:MODEL};
}
export function runBatch(requests,{modelDir,python='python3',runner=spawnSync}={}){
 if(!Array.isArray(requests)||requests.length<1||requests.length>11)throw Error('INVALID_BATCH_SIZE');
 if(typeof modelDir!=='string'||!modelDir)throw Error('LOCAL_MODEL_NOT_PROVISIONED');
 // Rebuild from registered mission and validated inputs; ignore caller-supplied context/model.
 const jobs=requests.map(x=>prepareRequest(x.worker,x.purpose,x.task));
 const env={PATH:process.env.PATH||'/usr/bin:/bin',HOME:process.env.HOME||'/tmp',LANG:'C.UTF-8',HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1',TOKENIZERS_PARALLELISM:'false',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2'};
 const result=runner(python,[resolve(root,'src/local-model-inference.py'),modelDir],{input:JSON.stringify(jobs),encoding:'utf8',env,cwd:root,timeout:240000,maxBuffer:2_000_000});
 if(result.error||result.status!==0)throw Error('LOCAL_INFERENCE_UNAVAILABLE');
 let rows;try{rows=JSON.parse(result.stdout)}catch{throw Error('INVALID_MODEL_RESPONSE')}
 if(!Array.isArray(rows)||rows.length!==jobs.length)throw Error('INCOMPLETE_MODEL_RESPONSE');
 return rows.map((row,i)=>{
  const j=jobs[i];
  if(row.worker!==j.worker||row.purpose!==j.purpose||typeof row.text!=='string'||!row.text.trim()||row.text.length>16000||!Number.isInteger(row.generatedTokens)||row.generatedTokens<1||row.generatedTokens>192)throw Error('INVALID_MODEL_RESULT');
  return {worker:j.worker,purpose:j.purpose,model:MODEL.id,revision:MODEL.revision,proposal:row.text,generatedTokens:row.generatedTokens,status:'UNTRUSTED_DRAFT_REQUIRES_VALIDATION',liveExecutionAuthorized:false,ownerSpend:0,incomeInferred:false};
 });
}
export function allAgentRequests(){return roster().map(m=>({worker:m.id,purpose:'plan',task:'Given your current mission and shared skills, propose one useful development or verification step that requires no external transaction or payment. State a concrete test.'}));}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [op,worker,purpose,...words]=process.argv.slice(2);
 const modelDir=process.env.TOYOL_LOCAL_MODEL_DIR;
 if(op==='all')console.log(JSON.stringify(runBatch(allAgentRequests(),{modelDir}),null,2));
 else if(op==='ask')console.log(JSON.stringify(runBatch([{worker,purpose,task:words.join(' ')}],{modelDir})[0],null,2));
 else if(op==='context')console.log(JSON.stringify(prepareRequest(worker,purpose,words.join(' ')),null,2));
 else throw Error('Use all | ask <agent> <purpose> <task> | context <agent> <purpose> <task>');
}
