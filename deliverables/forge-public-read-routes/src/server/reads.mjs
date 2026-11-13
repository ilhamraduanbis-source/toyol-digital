// Public read-only HTTP boundary for Mech Market.
import {encodeSse} from './stream.mjs';

const fields=(x,names)=>Object.fromEntries(names.filter(k=>Object.hasOwn(x??{},k)).map(k=>[k,x[k]]));
const rows=(x,f)=>Array.isArray(x)?x.map(f):[];
const policyKeys=['preferredRange','aggression','retreatHull','shieldThreshold','energyReserve','focusWeakness','strafeBias','aimLead','burstThreshold','coverWeight'];
const publicPolicy=x=>fields(x,policyKeys);
const publicBudget=x=>fields(x,['capMicros','committedMicros','spentMicros']);
const publicTeam=x=>({...fields(x,['id','name','color','points','hull','energy','baseRevision']),budget:publicBudget(x.budget),policy:publicPolicy(x.policy)});
const publicPatch=x=>fields(x,['episode','round','team','field','value','baseRevision','engineer']);
const publicCandidate=x=>({...fields(x,['submissionId','worker','valid','reason']),...(x.patch?{patch:publicPatch(x.patch)}:{})});
const publicJob=x=>({...fields(x,['id','episode','round','team','field','baseRevision','rewardMicros','status','taskId']),candidates:rows(x.candidates,publicCandidate),winner:typeof x.winner==='string'||x.winner===null?x.winner:x.winner?publicCandidate(x.winner):null});
// Public event/replay records are produced by the domain modules. Drop private
// fields recursively as defense in depth, even if an injected journal is dirty.
const privateName=k=>/private|secret|credential|password|bearer|authorization|signature|nonce|token|api.?key|registry|processedCommands|pendingPayments|reasoning|chain.?of.?thought/i.test(k);
function safe(value){
 if(value===null||['string','number','boolean'].includes(typeof value))return value;
 if(Array.isArray(value))return value.map(safe);
 if(typeof value==='object'){
  return Object.fromEntries(Object.entries(value).filter(([k])=>!privateName(k)&&!['__proto__','constructor','prototype'].includes(k)).map(([k,v])=>[k,safe(v)]));
 }
 return null;
}
const publicEvent=x=>({...fields(x,['seq','type','at']),data:safe(x.data??null)});
const publicBattle=x=>x? safe(fields(x,['rulesVersion','seed','tick','limit','arena','robots','events','ended','result','round','actions','initial','initialState','formatVersion'])):null;
function episode(x){
 return {...fields(x,['id','rulesVersion','seed','round','phase','cutoff','marketMs','mode']),teams:rows(x.teams,publicTeam),jobs:rows(x.jobs,publicJob),battle:publicBattle(x.battle),battles:rows(x.battles,publicBattle),upgrades:{entries:rows(x.upgrades?.entries,safe)},events:rows(x.events,publicEvent)};
}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
function cursor(request,stream=false){
 const url=new URL(request.url),params=url.searchParams;
 if(params.getAll('after').length>1)throw Error('invalid_cursor');
 const v=stream?(request.headers.get('last-event-id')??params.get('after')):params.get('after');
 if(v===null||v==='')return v===null?0:(()=>{throw Error('invalid_cursor')})();
 if(!/^(0|[1-9]\d*)$/.test(v)||!Number.isSafeInteger(Number(v)))throw Error('invalid_cursor');
 return Number(v);
}
export function createReadRoutes({getState,readEvents,getReplay,hub}){
 const state=async()=>await getState();
 const routes=[
  ['/healthz',async()=>json({ok:true})],
  ['/v1/episode',async()=>json(episode(await state()))],
  ['/v1/jobs',async()=>json(rows((await state()).jobs,publicJob))],
  ['/v1/teams',async()=>json(rows((await state()).teams,publicTeam))],
  ['/v1/events',async request=>{let after;try{after=cursor(request)}catch{return json({error:'invalid_cursor'},400);}return json(rows(await readEvents(after),publicEvent).filter(e=>Number.isSafeInteger(e.seq)&&e.seq>after).sort((a,b)=>a.seq-b.seq));}],
  ['/v1/replay',async()=>json(safe(await getReplay()))],
  ['/v1/stream',async request=>{
   let after;try{after=cursor(request,true)}catch{return json({error:'invalid_cursor'},400);}
   const encoder=new TextEncoder();let unsubscribe,controller,closed=false;
   function cleanup(){if(closed)return;closed=true;request.signal.removeEventListener('abort',abort);if(unsubscribe){try{unsubscribe();}catch{}}}
   function abort(){cleanup();try{controller?.close();}catch{}}
   const body=new ReadableStream({
    start(c){
     controller=c;
     if(request.signal.aborted){abort();return;}
     request.signal.addEventListener('abort',abort,{once:true});
     Promise.resolve().then(()=>hub.subscribe({after,onEvent(event){
      if(closed)return;
      try{
       if(typeof event.type!=='string'||/[\r\n]/.test(event.type))throw Error('invalid_event_type');
       c.enqueue(encoder.encode(encodeSse(publicEvent(event))));
      }catch(e){cleanup();try{c.error(e);}catch{}}
     }})).then(off=>{if(typeof off!=='function')throw Error('invalid_unsubscribe');unsubscribe=off;if(closed)off();}).catch(e=>{cleanup();try{c.error(e);}catch{}});
    },
    cancel(){cleanup();}
   });
   return new Response(body,{headers:{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-store','x-accel-buffering':'no'}});
  }]
 ];
 return routes.map(([path,handler])=>({method:'GET',path,handler:async request=>{try{return await handler(request);}catch{return json({error:'public_read_unavailable'},503);}}}));
}
