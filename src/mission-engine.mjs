// Persistent mission planner. Pure policy: never interpret remote task prose as commands.
export const MISSIONS=Object.freeze([
 {id:'contract-watch',workflow:'opentask-offer-watch.yml',title:'Check awarded contracts and payout',lane:'contracts',priority:100,minMinutes:90},
 {id:'frantic-delivery',workflow:'frantic-deliver.yml',title:'Deliver approved completed work',lane:'delivery',priority:95,minMinutes:90},
 {id:'payment-watch',workflow:'toyol-usdc-receipt-watch.yml',title:'Verify actual USDC receipts',lane:'payments',priority:90,minMinutes:90},
 {id:'cash-priority',workflow:'toyol-cash-priority.yml',title:'Find cash-paying open work',lane:'micro',priority:80,minMinutes:90},
 {id:'paid-market',workflow:'world-radar.yml',title:'Discover direct agent bounties',lane:'discovery',priority:75,minMinutes:100},
 {id:'fiat-hunt',workflow:'toyol-fiat-radar.yml',title:'Find larger USD opportunities',lane:'big-hunt',priority:72,minMinutes:100},
 {id:'bounded-worker',workflow:'toyol.yml',title:'Investigate and prepare bounded code work',lane:'execution',priority:70,minMinutes:120},
 {id:'skill-readiness',workflow:'toyol-incoming-readiness.yml',title:'Verify prepared skills after changes',lane:'preparation',priority:50,minMinutes:120,changeOnly:true},
]);
const pending=new Set(['queued','in_progress','waiting','requested','pending']);
const parse=x=>typeof x==='string'?Date.parse(x):NaN;
const mins=(now,t)=>Number.isFinite(parse(t))?Math.max(0,(now-parse(t))/60000):Infinity;
export function chooseMissions({now,observations,previous={},preparedDelivery=false,skillsChanged=false,maxDispatch=2}){
 if(!Number.isFinite(now)||!Number.isInteger(maxDispatch)||maxDispatch<0||maxDispatch>2)throw Error('INVALID_CYCLE');
 const decisions=[];
 for(const m of MISSIONS){
  const o=observations?.[m.id],old=previous[m.id]??{};
  const base={id:m.id,title:m.title,lane:m.lane,workflow:m.workflow,priority:m.priority,lastDispatch:old.lastDispatch??null};
  if(!o||o.state!=='active'||!Array.isArray(o.runs)){decisions.push({...base,status:'UNKNOWN_OR_DISABLED',reason:'Cannot establish workflow availability'});continue;}
  const runs=o.runs.filter(r=>r&&Number.isSafeInteger(r.id)&&Number.isFinite(parse(r.created_at))&&['schedule','workflow_dispatch','push'].includes(r.event)).sort((a,b)=>parse(b.created_at)-parse(a.created_at));
  const newest=runs[0],inflight=runs.find(r=>pending.has(r.status));
  const record={...base,lastRun:newest?.id??null,lastRunAt:newest?.created_at??null,lastConclusion:newest?.conclusion??null};
  if(inflight){decisions.push({...record,status:'ACTIVE',reason:inflight.status,activeRun:inflight.id});continue;}
  if(m.id==='frantic-delivery'&&!preparedDelivery){decisions.push({...record,status:'WAITING_FOR_REVIEWED_WORK',reason:'No new approved completed deliverable observed'});continue;}
  if(m.changeOnly&&!skillsChanged){decisions.push({...record,status:'WAITING_FOR_CHANGE',reason:'No untested skill change'});continue;}
  const relevant=runs.find(r=>m.id==='bounded-worker'?r.event!=='push':true);
  const wait=relevant?.conclusion&&relevant.conclusion!=='success'?Math.max(m.minMinutes,180):m.minMinutes;
  const age=Math.min(mins(now,relevant?.created_at),mins(now,old.lastDispatch));
  if(age<wait){decisions.push({...record,status:'COOLDOWN',reason:'Recent attempt; avoid overlapping or excessive polling',nextEligibleAt:new Date(now+(wait-age)*60000).toISOString()});continue;}
  decisions.push({...record,status:'READY',reason:'Eligible bounded action; no recent or active run'});
 }
 const ready=decisions.filter(x=>x.status==='READY').sort((a,b)=>b.priority-a.priority).slice(0,maxDispatch);
 return {decisions,selected:ready.map(x=>x.id)};
}
export function recordCycle({now,previous,decisions,dispatches,live}){
 const stamp=new Date(now).toISOString(),missions={};
 for(const d of decisions){
  const result=dispatches.find(x=>x.id===d.id);
  missions[d.id]={...d,...(result?{status:result.ok?'DISPATCH_REQUESTED':'DISPATCH_UNCERTAIN',reason:result.ok?'Dispatch accepted; actual execution requires run evidence':'Dispatch outcome uncertain; cool down before retry',lastDispatch:stamp}:{} )};
 }
 const history=[...(Array.isArray(previous.history)?previous.history:[]),{at:stamp,requested:dispatches.filter(x=>x.ok).map(x=>x.id),uncertain:dispatches.filter(x=>!x.ok).map(x=>x.id),active:decisions.filter(x=>x.status==='ACTIVE').map(x=>x.id)}].slice(-20);
 return {version:1,lastCycle:stamp,missions,history,live};
}
