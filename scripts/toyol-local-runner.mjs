// Fixed-capability local runner. Queue is data, never executable instructions.
import {createHash,createPrivateKey,createPublicKey,randomBytes,sign} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,existsSync,rmSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {setDefaultResultOrder} from 'node:dns';
setDefaultResultOrder('ipv4first');
const H=process.env.HOME,P=process.env.PREFIX,D=join(H??'/nonexistent','.toyol','forge');
const HOST='https://agent-forge-hb.fly.dev',MARKET='https://api.taskmarket.dev';
const OWNER='ilhamraduanbis-source/toyol-digital',RAW='https://raw.githubusercontent.com/'+OWNER+'/';
const HANDLE='self.toyol-digital-2c74870116',WALLET='0xac57ad3c3f233e5865c3cd652f67ffc82a7af431';
const QUEUE=RAW+'main/runner/queue.json';
const REPOS=new Set(['hobby-hub','mech-market']);
const DONE=new Set(['0xa114b9accc85b6b110b1e8ac3a9b1434cfc34874c818dd2645b59abe05fd7d2d','0xd0339fc83b4591024b407fa2a91fb28b0ff35178d4f2b3166b9e51adc96a59d5','0x92919ff998afa6eb4d919457567e93d930d011dc98783840c7e0915e789a4b6b','0x94013e835f1b58aab608d8bc17b8faf18f73ee0ec7a39a253e036edf3afd537c']);
const need=(v,m)=>{if(!v)throw Error(m);};
const sha=s=>typeof s==='string'&&/^[a-f0-9]{40}$/.test(s);
const taskId=s=>typeof s==='string'&&/^0x[a-f0-9]{64}$/.test(s);
const itemId=s=>typeof s==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(s);
const entryId=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{8,150}$/.test(s);
const idemId=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const plainPath=s=>typeof s==='string'&&s.length<200&&/^(src|web|test)\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(s)&&s.split('/').every(x=>x&&x!=='.'&&x!=='..'&&!x.startsWith('.'));
const log=(...v)=>console.log(new Date().toISOString(),...v);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const cleanEnv={HOME:H,PREFIX:P,PATH:process.env.PATH,TMPDIR:process.env.TMPDIR||join(P??'/tmp','tmp'),LANG:'C.UTF-8',GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1',GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_COUNT:'0',GIT_TRACE:'0',GIT_TRACE_CURL:'0'};
// Retry only read-only requests. Signed requests are never retried here.
export async function boundedRead(url,opts={},limit=2000000,fetcher=fetch){
 const u=new URL(url);need(['raw.githubusercontent.com','api.github.com','api.taskmarket.dev','agent-forge-hb.fly.dev'].includes(u.hostname)&&u.protocol==='https:'&&!u.username&&!u.password,'HOST_BLOCKED');
 const method=String(opts.method??'GET').toUpperCase(),readOnly=method==='GET';
 const location=u.hostname+u.pathname;
 const tries=readOnly?3:1;
 for(let i=0;i<tries;i++){
  let reader;
  try{
   const r=await fetcher(u,{...opts,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});
   if(!r.ok){const e=Error('HTTP_'+r.status);e.retryable=[408,425,429,500,502,503,504].includes(r.status);if(r.body)void r.body.cancel().catch(()=>{});throw e;}
   need(r.body,'EMPTY_RESPONSE_BODY');
   reader=r.body.getReader();const parts=[];let n=0;
   while(true){const {done,value}=await reader.read();if(done)break;n+=value.byteLength;need(n<=limit,'RESPONSE_TOO_LARGE');parts.push(Buffer.from(value));}
   reader.releaseLock();reader=null;
   return Buffer.concat(parts);
  }catch(e){
   // Do not wait for cancellation of a broken response stream.
   if(reader){void reader.cancel().catch(()=>{});}
   const code=String(e.cause?.code??e.code??e.name??'ERROR').replace(/[^A-Za-z0-9_-]/g,'').slice(0,60);
   const detail=/^HTTP_\d+$|^RESPONSE_TOO_LARGE$|^EMPTY_RESPONSE_BODY$/.test(e.message)?e.message:code;
   const retryable=e.retryable===true||e instanceof TypeError||['TimeoutError','AbortError'].includes(e.name);
   if(readOnly&&retryable&&i+1<tries){log('NETWORK_RETRY',location,detail,i+1);await delay(1000*(i+1));continue;}
   throw Error('NETWORK_'+method+' '+location+' '+detail);
  }
 }
}
const bytes=boundedRead;
const json=async(u,o)=>JSON.parse((await bytes(u,o)).toString('utf8'));
function git(cwd,args,input,extra={}){
 const q=spawnSync('git',['-c','core.hooksPath=/dev/null','-c','credential.helper=','-c','protocol.file.allow=never','-c','protocol.ext.allow=never',...args],{cwd,env:{...cleanEnv,...extra},input,encoding:'utf8',timeout:120000,maxBuffer:2000000});
 need(!q.error&&q.status===0,'GIT_FAILED_'+args[0]);return q.stdout.trim();
}
function cli(args,extra={}){
 const q=spawnSync('taskmarket',['--network','tempo',...args],{env:{...cleanEnv,TASKMARKET_API_URL:MARKET,...extra},encoding:'utf8',timeout:120000,maxBuffer:2000000});
 need(!q.error&&q.status===0,'CLI_FAILED_'+args[0]);const v=JSON.parse(q.stdout);need(v.ok===true,'CLI_NOT_OK');return v.data;
}
async function signed(path,obj){
 const key=createPrivateKey(readFileSync(join(D,'agent.pem'))),{crv,kty,x}=createPublicKey(key).export({format:'jwk'});
 need(key.asymmetricKeyType==='ed25519','KEY_TYPE');
 const keyid=createHash('sha256').update(JSON.stringify({crv,kty,x})).digest('base64url'),u=new URL(HOST+path),body=JSON.stringify(obj);
 const digest='sha-256=:'+createHash('sha256').update(body).digest('base64')+':',now=Math.floor(Date.now()/1000);
 const params='("@method" "@scheme" "@authority" "@path" "@query" "content-digest" "content-type");created='+now+';expires='+(now+60)+';keyid="'+keyid+'";alg="ed25519";nonce="'+randomBytes(32).toString('base64')+'";tag="agent-browser-auth"';
 const base=['"@method": POST','"@scheme": https','"@authority": '+u.host,'"@path": '+u.pathname,'"@query": ?','"content-digest": '+digest,'"content-type": application/json','"@signature-params": '+params].join('\n');
 const sig=sign(null,Buffer.from(base),key).toString('base64');
 const v=await json(u.href,{method:'POST',body,headers:{'content-type':'application/json','content-digest':digest,'signature-input':'sig2='+params,signature:'sig2=:'+sig+':'}});
 return v.data??v;
}
function validate(j){
 need(j&&typeof j==='object'&&taskId(j.task)&&REPOS.has(j.repo)&&itemId(j.item)&&sha(j.sourceCommit)&&sha(j.checkSha)&&Number.isSafeInteger(j.ciRun)&&j.ciRun>0,'QUEUE_INVALID');
 need(typeof j.reward==='string'&&/^[1-9]\d{0,9}$/.test(j.reward),'REWARD_INVALID');
 need(Array.isArray(j.files)&&j.files.length>0&&j.files.length<=12&&j.files.every(f=>plainPath(f.path)&&sha(f.sha))&&new Set(j.files.map(f=>f.path)).size===j.files.length,'FILES_INVALID');
 need(Array.isArray(j.workPaths)&&j.workPaths.length>0&&j.workPaths.every(p=>j.files.some(f=>f.path===p)),'WORK_PATHS_INVALID');
 return j;
}
function scopeMatch(p,s){return p===s||(s.endsWith('/**')&&p.startsWith(s.slice(0,-2)));}
async function live(j){
 const q=await json(MARKET+'/api/tasks/'+j.task),t=q.task??q;
 need((t.id??t.taskId)===j.task&&t.status==='open'&&t.mode==='bounty'&&Number(t.chainId)===4217&&String(t.reward)===j.reward&&t.stakeRequired===false&&t.escrow?.tracked===true&&String(t.escrow.booked)===j.reward,'TASK_NOT_ELIGIBLE');
 need(t.submissionWindowOpen!==false&&Number.isInteger(t.submissionCount)&&t.submissionCount<50,'FREE_QUOTA_UNVERIFIED');
 const a=(t.pendingActions??[]).find(x=>x.role==='worker'&&x.action==='submit');
 need(a?.requiresPayment===false&&typeof a.dueAt==='string'&&Date.parse(a.dueAt)>Date.now()+120000,'NOT_FREE_OR_DEADLINE');
 const p=await json(HOST+'/v1/repos/'+j.repo+'/packets/'+j.item);
 const tp=p.task_packet?.find(x=>x.item===j.item),w=p.work?.find(x=>x.id===j.task&&x.item===j.item);
 need(p.repo===j.repo&&p.item===j.item&&p.git===HOST+'/r/'+j.repo+'.git'&&sha(p.main)&&w?.status==='open'&&String(w.reward)===j.reward&&w.available===true&&tp&&Array.isArray(tp.waiting_on)&&tp.waiting_on.length===0,'PACKET_NOT_ELIGIBLE');
 need(Array.isArray(tp.touches)&&j.files.every(f=>tp.touches.some(s=>typeof s==='string'&&scopeMatch(f.path,s)))&&j.workPaths.every(f=>tp.touches.includes(f)),'SCOPE_MISMATCH');
 need(tp.check?.path==='.plan/checks/'+j.item+'.test.mjs','CHECK_SCOPE');
 return p;
}
async function evidence(j){
 const q=await json('https://api.github.com/repos/'+OWNER+'/actions/runs/'+j.ciRun,{headers:{Accept:'application/vnd.github+json','User-Agent':'ToyolLocalRunner'}});
 need(q.id===j.ciRun&&q.head_sha===j.sourceCommit&&q.head_branch==='main'&&q.status==='completed'&&q.conclusion==='success'&&/^\.github\/workflows\/forge-[a-z0-9-]+\.yml$/.test(q.path??''),'CI_NOT_VERIFIED');
}
function save(f,v,first=false){if(first){writeFileSync(f,JSON.stringify(v),{mode:0o600,flag:'wx'});return;}const tmp=f+'.tmp';writeFileSync(tmp,JSON.stringify(v),{mode:0o600});renameSync(tmp,f);}
async function processJob(j){
 validate(j);if(DONE.has(j.task)){log('SKIP_ALREADY_DELIVERED',j.item);return;}
 const f=join(D,'runner-'+j.task+'.json'),path='/v1/repos/'+j.repo+'/tasks/'+j.task;
 let st=existsSync(f)?JSON.parse(readFileSync(f,'utf8')):null;
 if(st){need(st.task===j.task&&st.sourceCommit===j.sourceCommit&&sha(st.commit),'STATE_MISMATCH');if(st.status==='confirmed'||st.status==='push_attempted'||st.status==='submit_attempted'){log('SKIP_'+st.status.toUpperCase(),j.item);return;}}
 const me=cli(['whoami']);need(me.wallet?.toLowerCase()===WALLET&&me.network==='tempo'&&me.chains?.some(x=>x.chainId===4217&&String(x.agentId)==='834'),'WALLET_MISMATCH');
 if(!st){
  log('JOB_STAGE',j.item,'verify_ci_and_live');
  await evidence(j);const p=await live(j);
  const existingEntries=await json(MARKET+'/api/tasks/'+j.task+'/submissions?chainId=4217');
  need(Array.isArray(existingEntries)&&!existingEntries.some(z=>String(z.workerAddress??'').toLowerCase()===WALLET),'EXISTING_PUBLIC_SUBMISSION_RECONCILE');
  log('JOB_STAGE',j.item,'prepare_git_objects');
  const tmp=mkdtempSync(join(D,'runner-work-'));
  try{
   const repo=join(tmp,'repo'),remote=HOST+'/r/'+j.repo+'.git';
   git(tmp,['clone','--bare','--single-branch','--branch','main','--no-tags',remote,repo]);
   need(git(repo,['rev-parse','refs/heads/main'])===p.main,'MAIN_MOVED');
   const check=git(repo,['rev-parse',p.main+':.plan/checks/'+j.item+'.test.mjs']);
   need(check===j.checkSha,'CHECK_CHANGED');
   // Bare repository, private index, Git objects only. Never checkout or execute candidate or customer code.
   const env={GIT_INDEX_FILE:join(tmp,'index')};
   git(repo,['read-tree',p.main],undefined,env);
   const existing=git(repo,['ls-tree','-r','--name-only',p.main]).split('\n');
   for(const file of j.files){
    need(!existing.includes(file.path)&&!existing.some(p=>file.path.startsWith(p+'/')),'PATH_ALREADY_EXISTS');
    const b=await bytes(RAW+j.sourceCommit+'/deliverables/forge-'+j.item+'/'+file.path,{},500000);
    const h=createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');need(h===file.sha,'FILE_HASH_MISMATCH');
    const object=git(repo,['hash-object','-w','--stdin'],b,env);need(object===h,'GIT_HASH_MISMATCH');
    git(repo,['update-index','--add','--cacheinfo','100644,'+h+','+file.path],undefined,env);
   }
   const changed=git(repo,['diff','--cached','--name-only',p.main],undefined,env).split('\n').sort();
   need(JSON.stringify(changed)===JSON.stringify(j.files.map(x=>x.path).sort()),'DIFF_MISMATCH');
   const tree=git(repo,['write-tree'],undefined,env);
   const commit=git(repo,['-c','user.name=Toyol Digital','-c','user.email=toyol-digital@invalid.example','-c','commit.gpgsign=false','commit-tree',tree,'-p',p.main,'-m','Implement '+j.item]);
   need(sha(commit)&&(await live(j)).main===p.main,'MAIN_MOVED');
   log('JOB_STAGE',j.item,'forge_work_session');
   await signed('/v1/repos/'+j.repo+'/work',{item:j.item,base:p.main,status:'working',paths:j.workPaths,note:'Toyol Digital: candidate tested in CI, requesting Forge acceptance.'});
   const s=await signed('/v1/session',{}),handle=s.handle??s.agent?.handle??s.session?.handle,token=s.push_token??s.pushToken??s.token??s.session?.token??s.session?.push_token??s.session?.pushToken;
   need(handle===HANDLE&&typeof token==='string'&&token.length>8&&token.length<4096&&!/[\r\n]/.test(token),'SESSION_INVALID');
   const ask=join(tmp,'askpass');
   writeFileSync(ask,'#!'+P+'/bin/sh\ncase "$1" in *Username*|*username*) printf "%s\\n" "$TOYOL_FORGE_HANDLE";; *) printf "%s\\n" "$TOYOL_FORGE_PUSH_TOKEN";; esac\n',{mode:0o700});
   st={task:j.task,sourceCommit:j.sourceCommit,commit,status:'push_attempted'};
   save(f,st,true);
   log('JOB_STAGE',j.item,'push_attempted');
   git(repo,['-c','credential.username='+HANDLE,'push',remote,commit+':refs/for/task/'+j.task+'/'+HANDLE],undefined,{GIT_ASKPASS:ask,TOYOL_FORGE_HANDLE:HANDLE,TOYOL_FORGE_PUSH_TOKEN:token});
   st.status='pushed';save(f,st);log('PUSH_CONFIRMED',j.item,commit);
  }finally{rmSync(tmp,{recursive:true,force:true});}
 }
 const retry=['check_stale','check_missing','check_required','checking'];
 async function prepare(payload,confirmation=false){
  let d=await signed(path+'/delivery',payload);
  const ok=x=>confirmation?x.confirmed===true:x.ready===true;
  if(ok(d))return d;
  need(retry.includes(d.code),'FORGE_NOT_READY_'+String(d.code??'UNKNOWN').slice(0,50));
  if(d.code!=='checking')await signed(path+'/checks',{commit:st.commit});
  for(let i=0;i<12;i++){await delay(5000);d=await signed(path+'/delivery',payload);if(ok(d))return d;need(retry.includes(d.code),'FORGE_BLOCKED');}
  throw Error('FORGE_CHECK_PENDING');
 }
 if(st.status==='pushed'){
  await live(j);const rows=cli(['task','submissions',j.task]);
  need(Array.isArray(rows)&&rows.length<50&&!rows.some(z=>String(z.workerAddress??'').toLowerCase()===WALLET),'DUPLICATE_OR_QUOTA');
  const d=await prepare({commit:st.commit});
  need(d.task===j.task&&d.commit===st.commit&&d.entry?.text===st.commit&&idemId(d.idempotency_key),'DELIVERY_MISMATCH');
  await live(j);
  const tmp=mkdtempSync(join(D,'runner-entry-'));
  try{
   const proof=join(tmp,'proof.txt'),policy=join(tmp,'deny-fees.json');
   writeFileSync(proof,st.commit,{mode:0o600});writeFileSync(policy,'TOYOL_DENY_ALL_FEES',{mode:0o600});
   st.status='submit_attempted';st.idempotency=d.idempotency_key;save(f,st);
   const q=cli(['task','submit',j.task,'--file',proof,'--role','final'],{TASKMARKET_IDEMPOTENCY_KEY:st.idempotency,TASKMARKET_X402_POLICY_PATH:policy});
   need(entryId(q?.submissionId),'ENTRY_ID_UNKNOWN');
   st.status='submitted';st.entry=q.submissionId;save(f,st);log('TASKMARKET_SUBMITTED',j.item,st.entry);
  }finally{rmSync(tmp,{recursive:true,force:true});}
 }
 need(st.status==='submitted'&&entryId(st.entry),'STATE_NOT_SUBMITTED');
 await prepare({commit:st.commit,market_submission:st.entry},true);
 st.status='confirmed';save(f,st);log('DELIVERY_COMPLETE_NOT_PAID',j.item,st.entry,st.commit);
}
async function cycle(){
 log('SCAN_BEGIN');
 const q=await json(QUEUE);
 need(q.version===1&&Array.isArray(q.jobs)&&q.jobs.length<=8,'QUEUE_SCHEMA');
 if(!q.jobs.length){log('IDLE_NO_NEW_JOB');return;}
 log('SCAN_QUEUE',q.jobs.length);
 for(const j of q.jobs){if(existsSync(join(D,'runner.stop')))break;try{await processJob(j);}catch(e){log('JOB_STOPPED',itemId(j?.item)?j.item:'INVALID',String(e.message).slice(0,240));}}
}
async function main(){
 need(H&&P&&existsSync(join(D,'agent.pem')),'TERMUX_IDENTITY_REQUIRED');
 if(process.argv.includes('--check')){const me=cli(['whoami']);need(me.wallet?.toLowerCase()===WALLET&&me.network==='tempo','WALLET_MISMATCH');const q=await json(QUEUE);need(q.version===1&&Array.isArray(q.jobs)&&q.jobs.length<=8,'QUEUE_SCHEMA');q.jobs.forEach(validate);log('RUNNER_READY',q.jobs.length+' queued');return;}
 const lock=join(D,'runner.lock');try{mkdirSync(lock,{mode:0o700});}catch{throw Error('RUNNER_LOCK_EXISTS');}
 try{log('RUNNER_STARTED');while(!existsSync(join(D,'runner.stop'))){try{await cycle();}catch(e){log('SCAN_STOPPED',String(e.message).slice(0,160));}for(let i=0;i<12&&!existsSync(join(D,'runner.stop'));i++)await delay(5000);}}finally{rmSync(lock,{recursive:true,force:true});log('RUNNER_STOPPED');}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{log('RUNNER_ERROR',String(e.message).slice(0,240));process.exitCode=1;});
