/**
 * Toyol rolling operations supervisor, independently hosted per GitHub Actions run.
 * A single supervisor stays active across multiple checks and hands off to the
 * next runner using workflow_dispatch. The 5-minute cron is outage recovery.
 * Only read-only, allowlisted scouting/academic workers can be dispatched.
 *
 * Limits: GitHub-hosted workers are ephemeral; handoffs may have gaps and may
 * be throttled. This is continuous supervision, not 14 permanent paid jobs.
 */
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import assert from 'node:assert/strict';

const exec=promisify(execFile);
const REPO='ilhamraduanbis-source/toyol-digital';
const WORKFLOW='toyol-rolling-supervisor.yml';
const token=process.env.GH_TOKEN;
const api='https://api.github.com/repos/'+REPO;
const header={Authorization:'Bearer '+String(token||''),Accept:'application/vnd.github+json',
  'X-GitHub-Api-Version':'2022-11-28','User-Agent':'ToyolRollingSupervisor/1'};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const bootstrap=process.env.GITHUB_EVENT_NAME==='push';
const DURATION_MS=bootstrap?105000:15*60000;
const CHECK_INTERVAL_MS=bootstrap?52000:4*60000;
const SELF_RELAY=process.env.TOYOL_NO_RELAY!=='1';
const maxFails=2;

async function gh(path,method='GET',payload){
  const r=await fetch(api+path,{method,headers:{...header,...(payload?{'Content-Type':'application/json'}:{})},
    redirect:'error',signal:AbortSignal.timeout(16000),...(payload?{body:JSON.stringify(payload)}:{})});
  if(!r.ok)throw Error('GITHUB_'+method+'_HTTP_'+r.status);
  if(r.status===204)return null;
  return r.json();
}
async function verifyRuntime(){
  assert.ok(token&&process.env.GITHUB_REPOSITORY===REPO&&process.env.GITHUB_REF==='refs/heads/main','OWNER_CONTEXT');
  const repo=await gh('');
  assert.equal(repo.full_name,REPO);
  // Public-repo Actions are expected to have no charge for standard runners.
  // Stop relay if visibility changes; do not silently consume paid compute.
  assert.equal(repo.private,false,'NO_FREE_RUNNER_PROOF_STOP');
  assert.equal(repo.archived,false,'ARCHIVED_REPO');
  console.log('ROLLING_PUBLIC_REPO_GUARD_OK');
}
async function observeCycle(tick){
  const result=await exec('node',['src/toyol-idle-alternative.mjs'],{
    cwd:process.cwd(),env:{...process.env,GH_TOKEN:token},
    timeout:180000,maxBuffer:3_000_000});
  const rows=result.stdout.split('\n');
  const line=rows.findLast(x=>x.startsWith('ALTERNATIVE_WORK_CYCLE '));
  if(!line)throw Error('NO_DISPATCH_AUDIT');
  const report=JSON.parse(line.slice('ALTERNATIVE_WORK_CYCLE '.length));
  assert.equal(report.ownerSpendUsd,0);
  assert.equal(report.creditClaimed,false);
  assert.equal(report.verifiedPayment,false);
  assert.equal(report.clones,14);
  assert.ok(Array.isArray(report.dispatched)&&report.dispatched.length<=4);
  console.log('ROLLING_TICK '+JSON.stringify({
    tick,dispatched:report.dispatched,
    candidates:report.idleWithEligibleAlternative,paidEvidence:false,
    note:'Read-only alternative work, not 14 simultaneous paid assignments'}));
}
function selfTest(){
  assert.equal(REPO,'ilhamraduanbis-source/toyol-digital');
  assert.ok(CHECK_INTERVAL_MS>=30000&&DURATION_MS>=90000&&DURATION_MS<20*60000);
  assert.ok(DURATION_MS<CHECK_INTERVAL_MS*5);
  console.log('ROLLING_SUPERVISOR_INVARIANTS_PASS');
}
if(process.argv.includes('--self-test')){selfTest();process.exit(0);}
selfTest();
await verifyRuntime();
const start=Date.now(),deadline=start+DURATION_MS;
let cycles=0,fails=0,dispatched=0;
while(Date.now()<deadline){
  const at=Date.now();
  try{
    await observeCycle(++cycles);
    fails=0;
    dispatched++;
  }catch(e){
    fails++;
    console.log('ROLLING_CYCLE_UNAVAILABLE '+JSON.stringify({cycle:cycles,reason:String(e.message).slice(0,140),consecutiveFailures:fails}));
    if(fails>=maxFails)break;
  }
  const remaining=deadline-Date.now();
  if(remaining<=0)break;
  await sleep(Math.min(CHECK_INTERVAL_MS,remaining));
}
// Do not relaunch into a sustained API failure or after owner disabled relay.
// Cron continues as safety net. 1 relay per bounded 2-15 minute run, never
// a tight recursion. workflow_dispatch is supported with GITHUB_TOKEN.
if(SELF_RELAY&&fails<maxFails){
  try{
    await verifyRuntime();
    const r=await gh('/actions/workflows/'+WORKFLOW);
    assert.equal(r.state,'active','SUPERVISOR_DISABLED_STOP');
    await gh('/actions/workflows/'+WORKFLOW+'/dispatches','POST',{ref:'main'});
    console.log('ROLLING_NEXT_RUN_REQUESTED '+JSON.stringify({
      lastRun:process.env.GITHUB_RUN_ID,cycles,
      reason:'CONTINUITY_HANDOFF',gapNotGuaranteed:true,paidEvidence:false}));
  }catch(e){
    console.error('ROLLING_HANDOFF_FAILED '+String(e.message).slice(0,150));
    process.exitCode=1;
  }
}
console.log('ROLLING_FINISHED '+JSON.stringify({
  cycles,successes:dispatched,consecutiveFailures:fails,
  relayAttempted:SELF_RELAY&&fails<maxFails,earningClaimed:false,
  note:'No payments implied, next run must be independently observed'}));
