/**
 * Backup work for idle Toyol clones, distinct from their main workflows.
 * Dispatches ONLY an audited allowlist of read-only scout/audit workflows.
 * No signing, no paid services, no automatic bids, no clone identity creation.
 * Uses GitHub workflow history as the lease/cooldown to avoid endless repeats.
 */
import assert from 'node:assert/strict';
import {readFileSync,appendFileSync} from 'node:fs';

const REPO='ilhamraduanbis-source/toyol-digital';
const API='https://api.github.com/repos/'+REPO;
const TOKEN=process.env.GH_TOKEN;
const MIN_MS=60_000;
const ALLOW=Object.freeze({
  'aggregator':                 {fallback:'toyol-direct-market-discovery.yml',minutes:45,why:'Search replacement paying work after expired Make.fun contest'},
  'frantic-delivery':           {fallback:'toyol-live-earnable.yml',minutes:45,why:'Check new customer-funded listings while existing delivery is preserved'},
  'swarmmemo-qa':              {fallback:'toyol-proven-payer-scan.yml',minutes:45,why:'Read genuine cash seats and previously paying requesters'},
  'swarmmemo-data':            {fallback:'toyol-live-cash-sprint.yml',minutes:45,why:'Screen newly opened real paid tasks across external venues'},
  'payment-reconciliation':    {fallback:'toyol-usdc-receipt-watch.yml',minutes:45,why:'Verify new USDC receipts while wallet push watches separately'},
  'go-hybrid-4488':            {fallback:'toyol-go-hybrid-4488-watch.yml',minutes:60,why:'Check actual adjudication and verified payout'},
  'wurk-markdown-sales':       {fallback:'toyol-fiat-radar.yml',minutes:45,why:'Hunt different buyer jobs while WURK remote orders API is unhealthy'},
  'tiny-chess-training':       {fallback:'toyol-clawlancer-discovery.yml',minutes:45,why:'Hunt alternative funded tasks after completed contest'},
  'multihopper':               {fallback:'toyol-multihopper-watch.yml',minutes:90,why:'Verify current partner instructions and eligible paid work'},
  'leviathan-contracts':       {fallback:'toyol-leviathan-contracts.yml',minutes:90,why:'Screen latest actual enterprise contract requirements'},
  'titan-awards':              {fallback:'toyol-titan-challenges.yml',minutes:90,why:'Check newly published major prize eligibility'},
  'atlas-mega-contracts':      {fallback:'toyol-atlas-mega-contracts.yml',minutes:90,why:'Screen actual payable EU tender lots'},
  'orion-mega-contracts':      {fallback:'toyol-orion-mega-contracts.yml',minutes:90,why:'Screen UK public procurement lots'},
  'nexus-cross-sector':        {fallback:'toyol-nexus-cross-sector.yml',minutes:120,why:'Continue separate academic practice, never income hunt'}
});
function auditRoster(){
  const roster=JSON.parse(readFileSync('runner/clone-missions.json','utf8')).missions;
  assert.equal(roster.length,Object.keys(ALLOW).length);
  assert.deepEqual(roster.map(x=>x.id).sort(),Object.keys(ALLOW).sort());
  const names=new Set();
  for(const m of roster){
    const f=ALLOW[m.id];
    assert.match(f.fallback,/^[a-z0-9-]+\.yml$/);
    assert.ok(!names.has(f.fallback),'No alternative work queue may be shared among clones');
    assert.ok(f.minutes>=40&&f.minutes<=120);
    names.add(f.fallback);
  }
  return roster;
}
function cool(last,minutes,now){
  if(!last)return true;
  const ms=Date.parse(last);
  return Number.isFinite(ms)&&now-ms>=minutes*MIN_MS;
}
function eligible(m,own,backup,now){
  if(own.active||backup.active)return false;
  if(!cool(backup.newest,ALLOW[m.id].minutes,now))return false;
  if(m.workflow!==ALLOW[m.id].fallback&&!cool(own.newest,15,now))return false;
  return true;
}
if(process.argv.includes('--self-test')){
  const m=auditRoster()[0],t=Date.now();
  assert.equal(eligible(m,{active:false,newest:null},{active:false,newest:null},t),true);
  assert.equal(eligible(m,{active:true,newest:null},{active:false,newest:null},t),false);
  assert.equal(eligible(m,{active:false,newest:null},{active:true,newest:null},t),false);
  assert.equal(cool(new Date(t-5*MIN_MS).toISOString(),45,t),false);
  assert.equal(cool(new Date(t-50*MIN_MS).toISOString(),45,t),true);
  console.log('IDLE_ALTERNATIVE_ROSTER_TEST_OK '+Object.keys(ALLOW).length);
  process.exit(0);
}
if(!TOKEN||process.env.GITHUB_REPOSITORY!==REPO||process.env.GITHUB_REF!=='refs/heads/main')
  throw Error('OWNER_CONTEXT');
const roster=auditRoster();
async function gh(path,method='GET',payload){
  const r=await fetch(API+path,{method,redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{Authorization:'Bearer '+TOKEN,Accept:'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28','User-Agent':'ToyolIdleBackfill',
      ...(payload?{'Content-Type':'application/json'}:{})},
    ...(payload?{body:JSON.stringify(payload)}:{})});
  if(!r.ok)throw Error('GH_'+method+'_'+r.status+'_'+path.slice(0,55));
  if(r.status===204)return null;
  return r.json();
}
const cache=new Map();
async function state(name){
  if(cache.has(name))return cache.get(name);
  const [w,data]=await Promise.all([
    gh('/actions/workflows/'+encodeURIComponent(name)),
    gh('/actions/workflows/'+encodeURIComponent(name)+'/runs?branch=main&per_page=5')
  ]);
  assert.equal(w.state,'active');
  assert.ok(Array.isArray(data.workflow_runs));
  const state={newest:data.workflow_runs[0]?.created_at??null,
    active:data.workflow_runs.some(x=>x.status!=='completed'),
    latestConclusion:data.workflow_runs[0]?.conclusion??null,
    latestRun:data.workflow_runs[0]?.id??null};
  cache.set(name,state);
  return state;
}
const now=Date.now(),observed=[];
for(const m of roster){
  const own=await state(m.workflow),backup=await state(ALLOW[m.id].fallback);
  observed.push({id:m.id,primary:m.workflow,alternative:ALLOW[m.id].fallback,
    eligible:eligible(m,own,backup,now),ownActive:own.active,backupActive:backup.active,
    latestAlt:backup.newest,primaryConclusion:own.latestConclusion,
    minutes:ALLOW[m.id].minutes,why:ALLOW[m.id].why});
}
// Start only two different read-only fallback workers per tick.
// Do not retry on an uncertain dispatch or race; next tick re-reads GitHub.
const candidates=observed.filter(x=>x.eligible)
  .sort((a,b)=>(Date.parse(a.latestAlt||0)||0)-(Date.parse(b.latestAlt||0)||0));
const started=[];
for(const x of candidates.slice(0,2)){
  try{
    const fresh=await gh('/actions/workflows/'+x.alternative+'/runs?branch=main&per_page=1');
    if(!Array.isArray(fresh.workflow_runs))throw Error('FRESH_SCHEMA');
    const last=fresh.workflow_runs[0];
    if(last&&(last.status!=='completed'||!cool(last.created_at,x.minutes,Date.now()))){
      x.eligible=false;x.decision='FRESH_COOLDOWN';continue;
    }
    await gh('/actions/workflows/'+x.alternative+'/dispatches','POST',{ref:'main'});
    x.decision='READ_ONLY_FALLBACK_DISPATCH_REQUESTED_NOT_INCOME';
    started.push({clone:x.id,workflow:x.alternative});
  }catch(e){
    x.decision='DISPATCH_UNCERTAIN_NO_RETRY';
    x.error=String(e.message).slice(0,150);
    break;
  }
}
for(const x of observed)console.log('CLONE_ACTIVITY '+JSON.stringify(x));
console.log('ALTERNATIVE_WORK_CYCLE '+JSON.stringify({
  clones:observed.length,idleWithEligibleAlternative:candidates.length,
  dispatched:started,creditClaimed:false,verifiedPayment:false,ownerSpendUsd:0,
  note:'Each worker does evidence-based read-only work; no false claim of a booked paid contract.'
}));
if(process.env.GITHUB_STEP_SUMMARY){
  const summary=['## Toyol active alternative assignments','',
    'Alternatives dispatched: '+started.length+' of '+observed.length+' registered clones.','',
    '| Clone | Alternative | State |','|---|---|---|',
    ...observed.map(x=>'| '+x.id+' | '+x.alternative+' | '+(x.decision??(x.ownActive?'PRIMARY_RUNNING':x.backupActive?'ALTERNATIVE_RUNNING':'COOLDOWN_OR_ELIGIBLE'))+' |'),
    '','No money, contract award or external submission is implied. Existing signing workers were not invoked.'];
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary.join('\n')+'\n');
}
