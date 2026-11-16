/** Local persistent runtime adapter; existing marketplace workflows are unchanged. */
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {selectActions,executeAction} from './agent-action.mjs';
import {allAgentRequests} from './agent-ai.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function queueCall(database,operation,payload={}){
 if(typeof database!=='string'||!database||!['seed','claim','finish','fail','status'].includes(operation))throw Error('INVALID_QUEUE_REQUEST');
 return new Promise((ok,no)=>{
  const child=spawn('python3',[resolve(root,'src/agent-queue.py'),database,operation],{cwd:root,env:{PATH:process.env.PATH||'/usr/bin:/bin',LANG:'C.UTF-8'},stdio:['pipe','pipe','pipe']});
  let out='',err='',tooLarge=false;
  const timeout=setTimeout(()=>child.kill('SIGKILL'),30000);
  child.stdout.on('data',b=>{out+=b;if(out.length>500000){tooLarge=true;child.kill('SIGKILL');}});
  child.stderr.on('data',b=>{if(err.length<2000)err+=b;});
  child.stdin.on('error',()=>{});
  child.on('error',e=>{clearTimeout(timeout);no(e);});
  child.on('close',code=>{clearTimeout(timeout);if(code!==0||tooLarge)return no(Error('QUEUE_CALL_FAILED: '+err.slice(0,250)));try{ok(JSON.parse(out));}catch{no(Error('INVALID_QUEUE_RESPONSE'));}});
  child.stdin.end(JSON.stringify(payload));
 });
}
export async function runQueuedCycle({database,scope,modelDir}){
 await queueCall(database,'seed',{scope});
 const ranking=selectActions(allAgentRequests(),{modelDir});
 // Each clone attempts its own atomic claim; competing requests cannot both own the same work.
 const attempts=await Promise.allSettled(ranking.map(async choice=>{
  const claim=await queueCall(database,'claim',{scope,worker:choice.worker,scores:choice.scores});
  if(claim.status!=='LEASED')return {worker:choice.worker,status:claim.status,preferredAction:choice.action};
  const auth={id:claim.id,worker:choice.worker,token:claim.token};
  try{
   const receipt=await executeAction({worker:choice.worker,action:claim.action});
   await queueCall(database,'finish',{...auth,receipt});
   return {worker:choice.worker,status:'VERIFIED_LOCAL_ACTION',preferredAction:choice.action,action:claim.action,taskId:claim.id,receipt,modelScores:choice.scores};
  }catch(e){
   try{await queueCall(database,'fail',auth);}catch{}
   return {worker:choice.worker,status:'LOCAL_ACTION_FAILED',action:claim.action,error:String(e.message).slice(0,160)};
  }
 }));
 const agents=attempts.map((v,i)=>v.status==='fulfilled'?v.value:{worker:ranking[i].worker,status:'QUEUE_WORKER_FAILED',error:String(v.reason?.message||'failure').slice(0,160)});
 const state=await queueCall(database,'status',{scope});
 return {scope,agents,tasks:state.tasks,ownerSpend:0,externalAction:false,incomeInferred:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [database,scope]=process.argv.slice(2);
 const report=await runQueuedCycle({database,scope,modelDir:process.env.TOYOL_LOCAL_MODEL_DIR});
 console.log(JSON.stringify(report,null,2));
 if(report.tasks.some(t=>t.state!=='done')||report.agents.some(a=>a.status.endsWith('FAILED')))process.exitCode=1;
}
