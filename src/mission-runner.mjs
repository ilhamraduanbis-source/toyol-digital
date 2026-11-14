import {readFileSync,appendFileSync} from 'node:fs';
import {MISSIONS,chooseMissions,recordCycle} from './mission-engine.mjs';
const REPO='ilhamraduanbis-source/toyol-digital',ROOT='https://api.github.com/repos/'+REPO,ISSUE=8;
const START='<!-- TOYOL_MISSION_STATE_V1',END='TOYOL_MISSION_STATE_V1 -->';
const token=process.env.GH_TOKEN;
const need=(x,m)=>{if(!x)throw Error(m);};
async function read(url,auth,method='GET',body){
 const r=await fetch(url,{method,headers:{Accept:'application/json','User-Agent':'ToyolMissionEngine/1.0',...(auth?{Authorization:'Bearer '+auth}:{}),...(body?{'Content-Type':'application/json'}:{})},redirect:'error',signal:AbortSignal.timeout(12000),...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok)throw Error('HTTP_'+r.status);
 if(r.status===204)return null;
 const s=await r.text();need(s.length<4000000,'RESPONSE_SIZE');return JSON.parse(s);
}
const gh=(path,method='GET',body)=>read(ROOT+path,token,method,body);
async function workflow(m){
 const meta=await gh('/actions/workflows/'+m.workflow);
 if(meta.state!=='active')return {state:meta.state,runs:[]};
 const data=await gh('/actions/workflows/'+m.workflow+'/runs?branch=main&per_page=20');
 need(Array.isArray(data.workflow_runs),'RUN_SCHEMA');
 return {state:meta.state,runs:data.workflow_runs};
}
function priorState(body){
 const a=body.indexOf(START),b=body.indexOf(END,a+START.length);
 need(a>=0&&b>a&&body.indexOf(START,a+1)<0,'STATE_MARKER');
 const s=JSON.parse(body.slice(a+START.length,b).trim());
 need(s.version===1&&s.missions&&typeof s.missions==='object'&&Array.isArray(s.history),'STATE_SCHEMA');
 // Only recognized IDs and valid dispatch timestamps influence cooldown.
 const missions={};
 for(const m of MISSIONS){const d=s.missions[m.id];if(d&&Number.isFinite(Date.parse(d.lastDispatch)))missions[m.id]={lastDispatch:d.lastDispatch};}
 return {version:1,missions,history:s.history.slice(-20).filter(x=>x&&typeof x.at==='string').map(x=>({at:x.at,requested:(Array.isArray(x.requested)?x.requested:[]).filter(id=>MISSIONS.some(m=>m.id===id)),uncertain:(Array.isArray(x.uncertain)?x.uncertain:[]).filter(id=>MISSIONS.some(m=>m.id===id)),active:(Array.isArray(x.active)?x.active:[]).filter(id=>MISSIONS.some(m=>m.id===id))}))};
}
async function liveGate(){
 const live={openTask:'UNKNOWN',contracts:null,frantic:'UNKNOWN',preparedDelivery:false,franticActive:null};
 try{
  const key=process.env.TOYOL_OPENTASK_TOKEN;need(key,'TOKEN_MISSING');
  const root='https://opentask.ai/api/agent',me=await read(root+'/me',key);need(me.profile?.id==='cmwebq871016a08jtv7b35au1','IDENTITY');
  const c=await read(root+'/contracts?limit=30',key),rows=Array.isArray(c)?c:c.contracts;
  need(Array.isArray(rows),'CONTRACT_SCHEMA');live.contracts=rows.length;
  const status=(me.paymentReadiness??me.profile.paymentReadiness)?.status;
  live.openTask=['ready','blocked','pending'].includes(status)?status:'UNKNOWN';
  live.moreContracts=!!(c.nextCursor??c.pagination?.nextCursor);
 }catch(e){console.log('CONTRACT_GATE_UNAVAILABLE '+e.message);}
 try{
  const key=process.env.FRANTIC_AGENT_TOKEN;need(key,'TOKEN_MISSING');
  const s=await read('https://gofrantic.com/v1/agents/agent-65c3b0/status',key);
  need(s.agent?.kid==='agent-65c3b0','IDENTITY');
  const open=s.work?.open,settled=s.work?.settled;
  need(Array.isArray(open)&&Array.isArray(settled),'STATUS_SCHEMA');
  live.franticActive=open.length;
  live.franticSettled=settled.length;
  live.frantic=s.agent?.claimEligibility?.eligible===true&&s.verification?.sworn===true&&s.agent?.onboarding?.payout?.set===true?'READY':'BLOCKED';
  const queue=JSON.parse(readFileSync('frantic-ready.json','utf8'));need(Array.isArray(queue),'QUEUE_SCHEMA');
  live.preparedDelivery=live.frantic==='READY'&&queue.some(q=>q.reviewed===true&&q.work_complete===true&&q.owner_cost_cents===0&&!settled.some(x=>x.bounty?.number===q.bounty)&&(!open.some(x=>x.bounty?.number===q.bounty)||open.some(x=>x.bounty?.number===q.bounty&&x.stage==='delivery_due')));
 }catch(e){console.log('FRANTIC_GATE_UNAVAILABLE '+e.message);}
 return live;
}
async function skillChange(observations){
 const latest=observations['skill-readiness']?.runs?.find(r=>r.conclusion==='success');
 if(!latest)return false; // first proof pack already has a dedicated push trigger
 const paths=['skills','test/openapi-preparation.test.mjs','test/password-login.test.mjs'];
 const checks=await Promise.all(paths.map(p=>gh('/commits?sha=main&path='+encodeURIComponent(p)+'&per_page=1').catch(()=>null)));
 return checks.some(x=>Array.isArray(x)&&x[0]?.commit?.committer?.date&&Date.parse(x[0].commit.committer.date)>Date.parse(latest.created_at));
}
async function main(){
 need(process.env.GITHUB_REPOSITORY===REPO&&process.env.GITHUB_REF==='refs/heads/main'&&token,'OWNER_CONTEXT_REQUIRED');
 const issue=await gh('/issues/'+ISSUE);need(issue.number===ISSUE&&issue.state==='open'&&issue.title==='Toyol Mission Engine — persistent mission queue and heartbeat','STATE_ISSUE_MISMATCH');
 const previous=priorState(issue.body??'');
 const observations={};
 await Promise.all(MISSIONS.map(async m=>{try{observations[m.id]=await workflow(m);}catch(e){console.log('WORKFLOW_UNAVAILABLE '+m.id+' '+e.message);}}));
 const live=await liveGate(),changed=await skillChange(observations),now=Date.now();
 const plan=chooseMissions({now,observations,previous:previous.missions,preparedDelivery:live.preparedDelivery,skillsChanged:changed});
 // Revenue recovery mode: a wake-up must spend its limited dispatch budget on useful work,
 // rather than use the first two slots on accounts with no contracts or new receipts.
 // Provider cooldowns and duplicate-run guards are unchanged. Never loop indefinitely.
 const priority={
  'frantic-delivery':120,
  'contract-watch':live.contracts>0?115:40,
  'cash-priority':110,
  'paid-market':105,
  'fiat-hunt':100,
  'bounded-worker':95,
  'payment-watch':80,
  'skill-readiness':20
 };
 const selected=plan.decisions.filter(x=>x.status==='READY').sort((a,b)=>(priority[b.id]??0)-(priority[a.id]??0)).slice(0,4).map(x=>x.id);
 console.log('REVENUE_PRIORITY '+JSON.stringify({selected,limit:4,contracts:live.contracts,preparedDelivery:live.preparedDelivery}));
 const dispatches=[];
 // Recheck immediately before dispatch. Existing workflow concurrency and provider gates remain authoritative.
 for(const id of selected){
  const m=MISSIONS.find(x=>x.id===id);
  try{
   const fresh=await workflow(m);
   const recheck=chooseMissions({now:Date.now(),observations:{[id]:fresh},previous:previous.missions,preparedDelivery:live.preparedDelivery,skillsChanged:changed});
   if(!recheck.selected.includes(id)){console.log('MISSION_RECHECK_STOP '+id);continue;}
   await gh('/actions/workflows/'+m.workflow+'/dispatches','POST',{ref:'main'});
   dispatches.push({id,ok:true});
  }catch(e){dispatches.push({id,ok:false});console.log('MISSION_DISPATCH_UNCERTAIN '+id+' '+e.message);}
 }
 const state=recordCycle({now,previous,decisions:plan.decisions,dispatches,live});
 const lines=['Public machine-maintained mission queue. This is operational telemetry, not payment evidence. No customer data or secrets.','', 'Last cycle: '+state.lastCycle,'','| Mission | Status | Last observed run |','|---|---|---|',...Object.values(state.missions).map(m=>'| '+m.title+' | '+m.status+' | '+(m.lastRunAt??'Unknown')+' |'),'','Contract count: '+(live.contracts??'unknown')+'; payout: '+live.openTask+'. Frantic active work: '+(live.franticActive??'unknown')+'.','', 'Dispatch requests are not proof of execution. Waiting and cooldowns are intentional. Payment receipts are kept separately.','',START,JSON.stringify(state),END];
 await gh('/issues/'+ISSUE,'PATCH',{body:lines.join('\n')});
 console.log('MISSION_CYCLE '+JSON.stringify({at:state.lastCycle,requested:dispatches.filter(x=>x.ok).map(x=>x.id),uncertain:dispatches.filter(x=>!x.ok).map(x=>x.id),live,decisions:plan.decisions.map(x=>({id:x.id,status:x.status,reason:x.reason}))}));
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.slice(0,-3).join('\n')+'\n');
}
main().catch(e=>{console.error('MISSION_SAFE_STOP '+String(e.message).slice(0,150));process.exitCode=1;});
