/** Shared, versioned, offline capability interface. Same API for every worker.
 * Registry contains only trusted repository paths; learned events are data, never commands.
 * No wallet access, external code execution, API keys or paid inference.
 */
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
export const catalog=Object.freeze([
 {id:'protocol-analysis',version:1,entry:'src/protocol-analysis-skill.mjs',runtime:'node',test:['--self-test'],tags:['research','defi','valuation','data'],scope:'Offline conditional valuation and peer validation; not a trading or prediction service.'},
 {id:'tabular-conversion',version:1,entry:'skills/tabular-conversion/data_convert.py',runtime:'python3',testFile:'skills/tabular-conversion/test_data_convert.py',tags:['csv','json','python','data'],scope:'Flat tabular conversion; no nested JSON or streaming guarantee.'},
 {id:'csv-evidence',version:1,entry:'skills/csv-evidence/audit.mjs',runtime:'node',testFile:'skills/csv-evidence/audit.test.mjs',tags:['csv','qa','audit','data'],scope:'CSV evidence and validation; local library, not customer acceptance.'},
 {id:'documentation-audit',version:1,entry:'skills/documentation-audit/audit.py',runtime:'python3',test:['selftest'],tags:['documentation','audit','research','git'],scope:'Immutable source evidence; semantic human or agent review remains necessary.'}
].map(x=>Object.freeze({...x,tags:Object.freeze(x.tags),...(x.test?{test:Object.freeze(x.test)}:{})})));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
function trustedPath(path){
 const p=resolve(root,path);
 if(relative(root,p).startsWith('..'+sep)||!existsSync(p))throw Error('SKILL_SOURCE_UNAVAILABLE');
 return p;
}
export function inventory(){
 return catalog.map(s=>({...s,sha256:hash(trustedPath(s.entry)),source:s.entry}));
}
export function match(query){
 const q=String(query||'').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
 return inventory().map(s=>({...s,match:s.tags.reduce((n,t)=>n+Number(q.includes(t)),0)})).filter(s=>s.match>0).sort((a,b)=>b.match-a.match||a.id.localeCompare(b.id));
}
export function readMemory(){
 const path=resolve(root,'runner/shared-memory.json');
 if(!existsSync(path))return {version:1,observations:[]};
 const j=JSON.parse(readFileSync(path,'utf8'));
 if(j.version!==1||!Array.isArray(j.observations))throw Error('INVALID_SHARED_MEMORY');
 return j;
}
export function workerContext(worker,query){
 if(!/^[a-z0-9-]{1,70}$/.test(worker))throw Error('INVALID_WORKER');
 return {worker,skills:inventory(),matches:match(query),memory:readMemory(),note:'Shared evidence and code are reusable. Work-specific validation and permission remain mandatory.'};
}
export function runSkill(id,args=[]){
 const s=catalog.find(x=>x.id===id);
 if(!s||!Array.isArray(args)||args.length>20||args.some(x=>typeof x!=='string'||x.length>4096))throw Error('INVALID_SKILL_CALL');
 // Only the fixed local catalog can supply executable paths. Args never enter a shell.
 if(id==='csv-evidence')throw Error('LIBRARY_ONLY_IMPORT_AUDIT_MODULE');
 const env={PATH:process.env.PATH||'/usr/bin:/bin',LANG:'C.UTF-8',HOME:process.env.HOME||'/tmp'};
 const result=spawnSync(s.runtime,[trustedPath(s.entry),...args],{cwd:root,env,stdio:'inherit',timeout:120000});
 if(result.error)throw result.error;
 return result.status??1;
}
function selfTest(){
 const a=workerContext('clone-a','research csv'),b=workerContext('clone-b','research csv'),c=workerContext('parent','research csv');
 assert.deepEqual(a.skills,b.skills);assert.deepEqual(b.skills,c.skills);
 assert.deepEqual(a.matches,c.matches);assert.deepEqual(a.memory,b.memory);
 assert.ok(a.skills.length===4&&a.skills.every(s=>/^[a-f0-9]{64}$/.test(s.sha256)));
 assert.ok(match('defi valuation').some(x=>x.id==='protocol-analysis'));
 assert.ok(match('csv').some(x=>x.id==='tabular-conversion'));
 assert.throws(()=>runSkill('../evil',[]),/INVALID_SKILL_CALL/);
 assert.throws(()=>workerContext('../bad','csv'));
 console.log('SHARED_CLOUD_TEST_PASS: clone-a, clone-b and parent resolve identical source hashes and shared memory');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [op,...args]=process.argv.slice(2);
 if(op==='list')console.log(JSON.stringify(inventory(),null,2));
 else if(op==='context')console.log(JSON.stringify(workerContext(args[0],args.slice(1).join(' ')),null,2));
 else if(op==='run')process.exitCode=runSkill(args[0],args.slice(1));
 else if(op==='--self-test')selfTest();
 else throw Error('Use list, context <worker> <query>, run <skill> <args>, --self-test');
}
