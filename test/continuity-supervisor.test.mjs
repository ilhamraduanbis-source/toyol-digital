import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {alive,readPid} from '../scripts/toyol-keepalive.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=20000){const end=Date.now()+ms;while(Date.now()<end){if(fn())return;await wait(100);}throw Error('FIXTURE_TIMEOUT');}
test('supervisor recovers a dead known process, restarts it and honors stop', {timeout:55000},async()=>{
 const home=mkdtempSync(join(tmpdir(),'toyol-supervisor-test-')),d=join(home,'.toyol','forge');
 mkdirSync(d,{recursive:true});writeFileSync(join(d,'agent.pem'),'fixture, not a key');
 const file=join(d,'local-runner.mjs'),marker=join(d,'starts'),pidfile=join(d,'runner.pid');
 writeFileSync(file,[
  "import {mkdirSync,appendFileSync,existsSync,rmdirSync} from 'node:fs';",
  "import {join} from 'node:path';",
  "const d=join(process.env.HOME,'.toyol','forge');",
  "if(process.argv.includes('--check')){console.log('RUNNER_READY 0 queued');process.exit(0);}",
  "mkdirSync(join(d,'runner.lock'));appendFileSync(join(d,'starts'),String(process.pid)+'\\n');",
  "setInterval(()=>{if(existsSync(join(d,'runner.stop'))){rmdirSync(join(d,'runner.lock'));process.exit(0);}},100);"
 ].join('\n'));
 // A deliberately stale empty lock with a known, nonexistent prior PID.
 mkdirSync(join(d,'runner.lock'));writeFileSync(pidfile,'2147483647\n');
 const supervisor=fileURLToPath(new URL('../scripts/toyol-keepalive.mjs',import.meta.url));
 const p=spawn(process.execPath,[supervisor],{env:{...process.env,HOME:home},stdio:['ignore','pipe','pipe']});
 let output='';p.stdout.on('data',x=>output+=String(x));p.stderr.on('data',x=>output+=String(x));
 const ended=new Promise(resolve=>p.once('exit',resolve));
 try{
  await until(()=>existsSync(marker)&&readFileSync(marker,'utf8').trim().length>0,8000);
  const first=readPid(pidfile);assert.ok(alive(first));process.kill(first,'SIGKILL');
  await until(()=>readFileSync(marker,'utf8').trim().split('\n').length>=2,22000);
  const next=readPid(pidfile);assert.notEqual(next,first);assert.ok(alive(next));
  writeFileSync(join(d,'runner.stop'),'stop\n');
  const result=await Promise.race([ended,wait(20000).then(()=>null)]);
  assert.equal(result,0);assert.match(output,/STALE_EMPTY_LOCK_RECOVERED/);assert.match(output,/RUNNER_RESTARTED/);assert.match(output,/SUPERVISOR_STOPPED/);
  await until(()=>!alive(next),3000);
 }finally{
  if(alive(p.pid))p.kill('SIGKILL');
  const last=readPid(pidfile);if(last&&alive(last)&&last!==2147483647)try{process.kill(last,'SIGKILL');}catch{}
  rmSync(home,{recursive:true,force:true});
 }
});
