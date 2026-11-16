/** Bounded AI-to-action development cycle. Only reviewed local skills may run.
 * No model-generated commands, external actions, account access, spending or income claims.
 */
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import {prepareRequest,allAgentRequests,MODEL} from './agent-ai.mjs';
import {readMemory} from './shared-skill-cloud.mjs';
import {auditCsv} from '../skills/csv-evidence/audit.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const exec=promisify(execFile);
const roster=()=>JSON.parse(readFileSync(resolve(root,'runner/clone-missions.json'),'utf8')).missions;
export const menu=Object.freeze([
 {id:'audit-roster',description:'Check real colony mission registry for unique IDs and required fields.'},
 {id:'audit-memory',description:'Check actual shared observation records for missing evidence and duplicate run IDs.'},
 {id:'test-tabular',description:'Convert actual mission roster CSV to JSON and verify complete lossless results.'},
 {id:'test-protocol',description:'Run the reviewed offline protocol analysis self-tests; use no live trading or funds.'},
 {id:'test-documentation',description:'Run the reviewed documentation evidence audit self-tests.'}
].map(Object.freeze));
const env=()=>({PATH:process.env.PATH||'/usr/bin:/bin',HOME:process.env.HOME||'/tmp',LANG:'C.UTF-8',HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1',OMP_NUM_THREADS:'2'});
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const csv=rows=>rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n')+'\n';
export function selectActions(requests,{modelDir,runner=spawnSync}={}){
 if(!Array.isArray(requests)||requests.length<1||requests.length>11||new Set(requests.map(x=>x.worker)).size!==requests.length)throw Error('INVALID_AGENT_BATCH');
 if(typeof modelDir!=='string'||!modelDir)throw Error('LOCAL_MODEL_NOT_PROVISIONED');
 const jobs=requests.map(x=>({...prepareRequest(x.worker,x.purpose,x.task),choices:menu}));
 const response=runner('python3',[resolve(root,'src/local-model-inference.py'),modelDir,'--select'],{input:JSON.stringify(jobs),encoding:'utf8',env:env(),cwd:root,timeout:180000,maxBuffer:500000});
 if(response.error||response.status!==0)throw Error('ACTION_MODEL_UNAVAILABLE');
 let rows;try{rows=JSON.parse(response.stdout)}catch{throw Error('INVALID_ACTION_RESPONSE')}
 if(!Array.isArray(rows)||rows.length!==jobs.length)throw Error('INCOMPLETE_ACTION_RESPONSE');
 return rows.map((x,i)=>{
  if(x.worker!==jobs[i].worker||x.method!=='constrained-model-logits'||!menu.some(a=>a.id===x.action)||!Array.isArray(x.scores)||x.scores.length!==menu.length||!x.scores.every(Number.isFinite))throw Error('INVALID_MODEL_ACTION');
  const idx=x.scores.indexOf(Math.max(...x.scores));
  if(menu[idx].id!==x.action)throw Error('ACTION_SCORE_MISMATCH');
  return {worker:x.worker,action:x.action,method:x.method,scores:x.scores,model:MODEL.id,revision:MODEL.revision};
 });
}
export async function executeAction(selection){
 const {worker,action}=selection;
 if(!roster().some(m=>m.id===worker)||!menu.some(m=>m.id===action))throw Error('ACTION_NOT_PERMITTED');
 let evidence;
 if(action==='audit-roster'){
  const rows=roster().map(m=>[m.id,m.workflow,m.mode]);
  const result=await auditCsv(csv([['id','workflow','mode'],...rows]),{required:['id','workflow','mode'],unique:['id']});
  assert.equal(result.pass,true);assert.equal(result.records,rows.length);
  evidence={records:result.records,sha256:result.sha256,findings:result.totalFindings};
 }else if(action==='audit-memory'){
  const rows=readMemory().observations.map(o=>[o.worker,o.runId,o.sourceCommit,o.conclusion]);
  const result=await auditCsv(csv([['worker','runId','sourceCommit','conclusion'],...rows]),{required:['worker','runId','sourceCommit','conclusion'],unique:['runId']});
  assert.equal(result.pass,true);assert.equal(result.records,rows.length);
  evidence={records:result.records,sha256:result.sha256,findings:result.totalFindings};
 }else if(action==='test-tabular'){
  const dir=mkdtempSync(join(tmpdir(),'toyol-agent-'));
  try{
   const rows=roster().map(m=>({id:m.id,mode:m.mode}));
   const input=join(dir,'in.csv'),output=join(dir,'out.json');
   writeFileSync(input,csv([['id','mode'],...rows.map(x=>[x.id,x.mode])]));
   await exec('python3',[resolve(root,'skills/tabular-conversion/data_convert.py'),'csv-to-json',input,output],{cwd:root,env:env(),timeout:30000,maxBuffer:100000});
   const result=JSON.parse(readFileSync(output,'utf8'));assert.deepEqual(result,rows);
   evidence={records:result.length,sha256:sha(result),lossless:true};
  }finally{rmSync(dir,{recursive:true,force:true});}
 }else{
  const cmd=action==='test-protocol'?process.execPath:'python3';
  const args=action==='test-protocol'?[resolve(root,'src/protocol-analysis-skill.mjs'),'--self-test']:[resolve(root,'skills/documentation-audit/audit.py'),'selftest'];
  const result=await exec(cmd,args,{cwd:root,env:env(),timeout:60000,maxBuffer:150000});
  evidence={exitCode:0,outputSha256:sha([result.stdout,result.stderr]),outputBytes:Buffer.byteLength(result.stdout+result.stderr)};
 }
 return {worker,action,status:'VERIFIED_LOCAL_ACTION',evidence,externalAction:false,ownerSpend:0,incomeInferred:false};
}
export async function runCycle({modelDir}={}){
 const selected=selectActions(allAgentRequests(),{modelDir});
 const results=await Promise.allSettled(selected.map(async s=>({...await executeAction(s),selection:s})));
 return results.map((v,i)=>v.status==='fulfilled'?v.value:{worker:selected[i].worker,action:selected[i].action,status:'LOCAL_ACTION_FAILED',error:String(v.reason?.message||'failure').slice(0,250),selection:selected[i],externalAction:false,ownerSpend:0,incomeInferred:false});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const results=await runCycle({modelDir:process.env.TOYOL_LOCAL_MODEL_DIR});
 console.log(JSON.stringify(results,null,2));
 if(results.some(x=>x.status!=='VERIFIED_LOCAL_ACTION'))process.exitCode=1;
}
