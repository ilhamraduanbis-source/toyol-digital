// Toyol Lantern Line Forge proof commit: signed identity, no wallet access, no funds.
import {createHash,createPublicKey,generateKeyPairSync,randomBytes,sign} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const origin='https://agent-forge-hb.fly.dev',repo='lantern-line',item='ui-timer';
const task='0xcae5b2850ab5e0ceaacd4b11c2f1bacca6028b44301b7e55cb243e87810ad91d';
const base=process.env.FORGE_BASE;
const cwd=process.env.FORGE_CHECKOUT, receipt=process.env.FORGE_RECEIPT;
if(!cwd||!receipt||!base||!/^([a-f0-9]{40})$/.test(base))throw Error('MISSING_WORKDIR_OR_LIVE_BASE');
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const {kty,crv,x}=createPublicKey(privateKey).export({format:'jwk'});
const keyid=createHash('sha256').update(JSON.stringify({crv:'Ed25519',kty:'OKP',x})).digest('base64url');
const emit=(label,data)=>console.log(label+' '+JSON.stringify(data));
const required=(v,err)=>{if(!v)throw Error(err)};
async function read(path){
 const r=await fetch(origin+path,{headers:{accept:'application/json'},signal:AbortSignal.timeout(20000),redirect:'error'});
 if(!r.ok)throw Error('READ_FAILED_'+path+'_'+r.status);
 return r.json();
}
async function signedPost(path,obj){
 const url=new URL(path,origin),body=JSON.stringify(obj),now=Math.floor(Date.now()/1000);
 const digest='sha-256=:'+createHash('sha256').update(body).digest('base64')+':';
 const params='("@method" "@scheme" "@authority" "@path" "@query" "content-digest" "content-type");created='+now+';expires='+(now+60)+';keyid="'+keyid+'";alg="ed25519";nonce="'+randomBytes(32).toString('base64')+'";tag="agent-browser-auth"';
 const baseString=['"@method": POST','"@scheme": https','"@authority": '+url.host,'"@path": '+url.pathname,'"@query": '+(url.search||'?'),'"content-digest": '+digest,'"content-type": application/json','"@signature-params": '+params].join('\n');
 const sig=sign(null,Buffer.from(baseString),privateKey).toString('base64');
 const r=await fetch(url,{method:'POST',body,headers:{'content-type':'application/json','content-digest':digest,'signature-input':'sig2='+params,signature:'sig2=:'+sig+':'},redirect:'error',signal:AbortSignal.timeout(25000)});
 const raw=await r.text();required(raw.length<300000,'RESPONSE_TOO_LONG');
 let j;try{j=JSON.parse(raw)}catch{throw Error('NON_JSON_'+path+'_'+r.status)}
 emit('FORGE_REQUEST',{path,http:r.status,keys:Object.keys(j).filter(k=>!/secret|private|token|password/i.test(k))});
 if(!r.ok)throw Error('FORGE_REJECT_'+path+'_'+r.status+'_'+String(j.detail??j.title??j.error??j.message??'').slice(0,190));
 return j;
}
const packet=await read('/v1/repos/'+repo+'/packets/'+item);
let activeBase=base;
if(packet.main!==base){
  emit('FORGE_MAIN_MOVED',{previous:base,current:packet.main,action:'rebase_onto_live_main'});
  const head=spawnSync('git',['rev-parse','HEAD'],{cwd,encoding:'utf8'});
  required(head.status===0,'LOCAL_COMMIT_UNAVAILABLE');
  const original=head.stdout.trim();
  const fetch=spawnSync('git',['fetch','--quiet','origin','main'],{cwd,encoding:'utf8',timeout:85000});
  if(fetch.status!==0)throw Error('FORGE_FETCH_FAILED_'+String(fetch.stderr||'').slice(0,180));
  const checkout=spawnSync('git',['checkout','--detach',packet.main],{cwd,encoding:'utf8',timeout:15000});
  if(checkout.status!==0)throw Error('FORGE_LIVE_MAIN_NOT_FETCHED_'+String(checkout.stderr||'').slice(0,180));
  const replay=spawnSync('git',['-c','user.name=Toyol Digital Agent','-c','user.email=toyol@users.noreply.github.com','cherry-pick',original],{cwd,encoding:'utf8',timeout:45000});
  if(replay.status!==0)throw Error('FORGE_REBASE_CONFLICT_'+String(replay.stderr||'').slice(0,200));
  activeBase=packet.main;
  emit('FORGE_REBASED',{base:activeBase});
}
const offer=(packet.work||[]).find(t=>t.id===task);
required(offer?.available&&offer.status==='open'&&offer.reward==='500000','JOB_NOT_ACTIVE');
emit('ELIGIBLE',{task,usd:0.5,competition:offer.competition});
const registration=await signedPost('/v1/agents',{public_key:{kty,crv,x},name:'Toyol Digital Lantern Timer Agent'});
const ag=registration.agent??registration.data?.agent??registration;
const handle=ag.handle??registration.handle;
required(typeof handle==='string'&&/^[\w.-]{3,128}$/.test(handle),'IDENTITY_HANDLE_UNKNOWN');
emit('IDENTITY',{handle,id:ag.id??null});
await signedPost('/v1/repos/'+repo+'/onboarding',{role:'contributor',item});
await signedPost('/v1/repos/'+repo+'/work',{item,base:activeBase,status:'working',paths:['game/ui/timer.mjs','game/ui/timer.css']});
const hash=spawnSync('git',['rev-parse','HEAD'],{cwd,encoding:'utf8'});
required(hash.status===0,'GIT_NO_COMMIT');
const commit=hash.stdout.trim();
const session=await signedPost('/v1/session',{});
const token=session.token??session.git_token??session.gitToken??session.push_token??session.pushToken??session.password??session.credentials?.password??session.git?.password??session.git?.token;
if(typeof token!=='string'||token.length<10)throw Error('GIT_SESSION_FIELD_MISSING_'+Object.keys(session).join(',').slice(0,170));
const user=session.username??session.git_username??session.git?.username??handle;
const authorization='Authorization: Basic '+Buffer.from(user+':'+token).toString('base64');
const ref='refs/for/task/'+task+'/'+handle;
const run=spawnSync('git',['push','--porcelain',origin+'/r/'+repo+'.git','HEAD:'+ref],{cwd,encoding:'utf8',timeout:90000,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'http.extraheader',GIT_CONFIG_VALUE_0:authorization}});
if(run.status!==0)throw Error('FORGE_PUSH_FAILED_'+run.status+'_'+String(run.stderr||'').replace(/Basic\s+\S+/gi,'[redacted]').slice(0,200));
emit('FORGE_PUSH_OK',{task,commit,handle});
const gate=await signedPost('/v1/repos/'+repo+'/tasks/'+task+'/delivery',{commit});
const result={task,commit,handle,forgePushed:true,forgeDeliveryReady:gate.ready===true,marketplaceSubmitted:false,paid:false,at:new Date().toISOString()};
writeFileSync(receipt,JSON.stringify(result,null,2)+'\n');
emit('FORGE_RESULT',{...result,gateFields:Object.keys(gate),nextActions:(gate.next_actions??gate.nextActions??[]).map?.(x=>x.action??x.type).slice(0,6)});
// Market TAP registration/payment account requires durable owner-controlled credentials; no throwaway payout wallet.
