// Toyol MicroEarn: zero-spend WURK paid-job scout and strictly approved task submission.
// Separate from existing WURK store fulfillment. No ads, deposits, swaps or private keys in logs.
import {createPrivateKey,createPublicKey,sign,verify,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const ROOT='https://api.wurk.fun';
const expected='At7TxA4e81Ai8X2TWZq944NSSbP1HaJB9iRug4vD1uQ';
const chain='solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(b){let n=0n;for(const x of b)n=n*256n+BigInt(x);let s='';while(n){s=alphabet[Number(n%58n)]+s;n/=58n;}for(const x of b){if(x!==0)break;s='1'+s;}return s;}
const emit=(label,obj)=>console.log(label+' '+JSON.stringify(obj));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function allowedPath(p){if(typeof p!=='string'||!p.startsWith('/')||p.startsWith('//')||p.includes('://'))throw Error('INVALID_API_PATH');return p;}
async function query(p,opts={}){
  p=allowedPath(p);
  const method=opts.method||'GET';
  const url=ROOT+p;
  let attempt=0;
  while(true){
    const r=await fetch(url,{...opts,redirect:'error',signal:AbortSignal.timeout(17000),headers:{Accept:'application/json',...(opts.headers||{})}});
    const raw=await r.text();if(raw.length>3_000_000)throw Error('BODY_TOO_LARGE');
    let body;try{body=JSON.parse(raw)}catch{throw Error('NON_JSON_'+r.status);}
    if(method==='GET'&&[429,500,502,503,504].includes(r.status)&&attempt<2){attempt++;emit('MICRO_GET_RETRY',{endpoint:p,status:r.status,attempt});await sleep(attempt*2800);continue;}
    return {status:r.status,ok:r.ok,body,headers:r.headers};
  }
}
const raw=JSON.parse(process.env.TOYOL_SOLANA_KEYPAIR_JSON||'null');
if(!Array.isArray(raw)||raw.length!==64||!raw.every(n=>Number.isInteger(n)&&n>=0&&n<=255))throw Error('KEYPAIR_FORMAT');
const key=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.from(raw.slice(0,32))]),format:'der',type:'pkcs8'});
const pub=createPublicKey(key),pk=Buffer.from(pub.export({format:'jwk'}).x,'base64url'),addr=b58(pk);
if(addr!==expected||!pk.equals(Buffer.from(raw.slice(32))))throw Error('WALLET_MISMATCH');

const path='/solana/siwx/account-create',url=ROOT+path;
const challenge=await query(path,{method:'POST'});
const ext=challenge.body.extensions?.['sign-in-with-x'];const i=ext?.info;
const supported=ext?.supportedChains?.find(x=>x.chainId===chain&&x.type==='ed25519');
const now=Date.now();
if(challenge.status!==402||challenge.body.x402Version!==2||challenge.body.accepts?.length!==0||!supported||!i||i.domain!=='api.wurk.fun'||i.uri!==url||i.version!=='1'||i.statement!=='Sign in to create or access your WURK account and retrieve its API key on Solana'||!Array.isArray(i.resources)||i.resources.length!==1||i.resources[0]!==url||!/^[A-Za-z0-9]{8,128}$/.test(i.nonce??'')||Math.abs(Date.parse(i.issuedAt)-now)>300000||Date.parse(i.expirationTime)<=now||i.notBefore||i.requestId)throw Error('UNEXPECTED_FREE_AUTH');
const info={...i,chainId:chain,type:'ed25519',...(supported.signatureScheme?{signatureScheme:supported.signatureScheme}:{})};
const msg=[i.domain+' wants you to sign in with your Solana account:',addr,'',i.statement,'','URI: '+i.uri,'Version: '+i.version,'Chain ID: '+chain.split(':')[1],'Nonce: '+i.nonce,'Issued At: '+i.issuedAt,'Expiration Time: '+i.expirationTime,'Resources:','- '+url].join('\n');
const sig=sign(null,Buffer.from(msg),key);
if(!verify(null,Buffer.from(msg),pub,sig))throw Error('AUTH_SIGNATURE_FAILED');
const proof={...info,address:addr,signature:b58(sig)};
const login=await query(path,{method:'POST',headers:{'SIGN-IN-WITH-X':Buffer.from(JSON.stringify(proof)).toString('base64url')}});
const x=login.body;
if(!login.ok||x.ok!==true||x.auth!=='siwx'||x.paid!==false||x.walletAddress!==addr||x.accountType!=='agent'||typeof x.apikey!=='string'||x.apikey.length<8)throw Error('ACCOUNT_ACCESS_FAILED');
console.log('::add-mask::'+x.apikey);
const headers={'X-API-Key':x.apikey};
emit('MICRO_AGENT',{address:addr,account:x.accountId,payment:'NOT_VERIFIED',onboardingCost:0});

async function read(p){
  const r=await query(p,{headers});
  if(!r.ok)throw Error('READ_HTTP_'+r.status+'_'+String(r.body.errorCode||'UNKNOWN').slice(0,80));
  return r.body;
}
const prof=await read('/profile');
if(prof.accountType&&prof.accountType!=='agent')throw Error('PROFILE_ACCOUNT_TYPE');
emit('MICRO_PROFILE',{humanVerification:prof.humanVerification?.status||prof.humanVerified||null,nickname:prof.profile?.nickname||null});

const safeBalances={};
for(const k of ['balances','balance','walletBalances','financials','wallets']){
  if(prof[k]!==undefined && typeof prof[k]!=='string') safeBalances[k]=prof[k];
}
emit('MICRO_BALANCES',{keys:Object.keys(prof),financialFields:safeBalances});
async function postRead(p,body){
  const res=await query(p,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!res.ok)throw Error('POST_READ_HTTP_'+res.status+'_'+String(res.body.errorCode??'UNKNOWN').slice(0,70));
  return res.body;
}
try{
  const e=await postRead('/earnings',{view:'jobs',page:1,perPage:20});
  const rows=e.rows??e.data?.rows??[];
  emit('MICRO_JOB_EARNINGS',{keys:Object.keys(e),count:Array.isArray(rows)?rows.length:null,rows:Array.isArray(rows)?rows.slice(0,20).map(z=>({id:z.id,job:z.jobId??z.custom_short_id??null,asset:z.assetId??z.asset??null,amount:z.amount??z.amountNet??z.earned??null,status:z.earningsStatus??z.status??null,createdAt:z.createdAt??z.created_at??null,completedAt:z.completedAt??z.completed_at??null})):[]});
}catch(e){emit('MICRO_EARNINGS_UNAVAILABLE',{reason:String(e.message).slice(0,70)})}
try{
 const h=await postRead('/withdraws',{limit:10,offset:0});
 const rows=h.rows??h.withdrawals??h.data?.rows??h.data?.withdrawals??[];
 emit('MICRO_WITHDRAW_HISTORY',{keys:Object.keys(h),count:Array.isArray(rows)?rows.length:null,rows:Array.isArray(rows)?rows.slice(0,8).map(z=>({id:z.id??z.historyId,network:z.network,asset:z.asset,amount:z.amount??z.amountNet,status:z.status,finality:z.finalityStatus,createdAt:z.createdAt??z.created_at})):[]});
}catch(e){emit('MICRO_WITHDRAW_UNAVAILABLE',{reason:String(e.message).slice(0,70)})}


const jobs=[],seen=new Set();
let urlNext='/jobs/available?limit=50';
for(let pageNo=0;pageNo<4&&urlNext;pageNo++){
  if(pageNo)await sleep(11200);
  const feed=await read(urlNext);
  const rows=feed.jobs??feed.data?.jobs??[];
  if(!Array.isArray(rows))throw Error('JOBS_SCHEMA');
  emit('MICRO_JOB_PAGE',{page:pageNo+1,count:rows.length,hasMore:!!feed.hasMore,proofOfHumanOpportunity:feed.proofOfHumanOpportunity?.additionalJobs??0});
  for(const row of rows){
    const id=row.customId??row.custom_id??row.id;
    if(!id||seen.has(id))continue;seen.add(id);jobs.push(row);
  }
  const next=feed.nextUrl??(feed.nextCursor?'/jobs/available?limit=50&cursor='+encodeURIComponent(feed.nextCursor):null);
  if(next){const parsed=new URL(next,ROOT);if(parsed.origin!==ROOT||!parsed.pathname.startsWith('/jobs/available'))throw Error('UNTRUSTED_PAGINATION');urlNext=parsed.pathname+parsed.search;}else urlNext=null;
  if(!feed.hasMore)break;
}
for(const j of jobs){
  const id=j.customId??j.custom_id??j.id;
  const desc=j.descriptionPreview??j.description??'';
  emit('MICRO_JOB',{id,title:String(j.title??j.name??'').slice(0,115),mode:j.mode??null,selectionType:j.selectionType??null,available:j.availableForMe??null,closesAt:j.closesAt??null,reward:j.reward??j.rewardFinancials??null,winners:j.winners??null,detail:j.detailUrl??null,description:String(desc).slice(0,300),imageRequired:j.submissionRequirements?.imageRequired??null});
}
emit('MICRO_AVAILABLE_TOTAL',{jobs:jobs.length,pagesScanned:Math.min(4,Math.ceil(Math.max(1,jobs.length)/50))});

const strictMicroCandidates=jobs.filter(j=>{
  const all=[j.title,j.name,j.descriptionPreview,j.description].map(x=>String(x||'')).join(' ').toLowerCase();
  const feeOrCredential=/buy|pay a fee|deposit|paid api|x followers|twitter followers|purchase|stake |top up|fund wallet|register card/i.test(all);
  return j.availableForMe===true&&!feeOrCredential;
});
emit('MICRO_ZERO_SPEND_SHORTLIST',{
  count:strictMicroCandidates.length,
  candidates:strictMicroCandidates.slice(0,8).map(j=>({id:j.customId??j.id,title:String(j.title||j.name||'').slice(0,100),mode:j.mode,reward:j.reward??j.rewardFinancials}))
});


if(process.env.TOYOL_MICRO_DEEP_SCOUT!=='false'){
  let detailReads=0;
  for(const candidate of jobs.filter(j=>j.availableForMe===true&&j.detailUrl).slice(0,5)){
    if(detailReads)await sleep(11200);
    const link=new URL(candidate.detailUrl,ROOT);
    if(link.origin!==ROOT||!/^\/jobs\/[a-z0-9_-]{6,128}$/i.test(link.pathname))continue;
    try{
      const d=await read(link.pathname);
      const j=d.job??d;
      emit('MICRO_JOB_DETAIL',{id:j.customId??candidate.customId??candidate.id,description:String(j.description??'').slice(0,6500),requirements:j.submissionRequirements??null,mode:j.mode??null,selection:j.selectionType??null,available:j.availableForMe??null,reward:j.reward??j.rewardFinancials??null,closesAt:j.closesAt??null});
    }catch(e){emit('MICRO_JOB_DETAIL_ERROR',{id:candidate.customId??candidate.id,error:String(e.message).slice(0,100)})}
    detailReads++;
  }
}


const target=process.env.TOYOL_MICRO_JOB_ID?.trim()||'';
if(target){
  if(!/^[A-Za-z0-9_-]{6,128}$/.test(target))throw Error('TARGET_ID_INVALID');
  if(!jobs.some(j=>(j.customId??j.custom_id??j.id)===target))throw Error('TARGET_NOT_AVAILABLE_NOW');
  const candidate=jobs.find(j=>(j.customId??j.custom_id??j.id)===target);
  if(candidate.availableForMe!==true)throw Error('TARGET_NOT_ELIGIBLE');
  if(!candidate.detailUrl||!new URL(candidate.detailUrl,ROOT).pathname.startsWith('/jobs/'))throw Error('TARGET_DETAIL_UNAVAILABLE');
  await sleep(11300);
  const detail=await read(new URL(candidate.detailUrl,ROOT).pathname);
  const j=detail.job??detail;
  if(j.availableForMe!==true||j.submissionRequirements?.imageRequired||j.submissionRequirements?.viewFlowRequired||j.descriptionRestricted)throw Error('TARGET_RESTRICTION');
  if(j.mode==='selection'&&j.selectionType==='creator')throw Error('SELECTION_PROPOSAL_REQUIRES_REVIEW');
  if(!['challenge','contest','selection'].includes(j.mode))throw Error('JOB_MODE_UNKNOWN');
  const full=String(j.description||'');
  const pathFile=process.env.TOYOL_MICRO_SUBMISSION_FILE||'';
  if(!/^ops\/micro-earn\/submissions\/[a-z0-9-]{3,72}\.txt$/.test(pathFile))throw Error('SUBMISSION_PATH_INVALID');
  const answer=readFileSync(pathFile,'utf8').trim();
  if(answer.length<10||answer.length>5000||answer.includes('[PLACEHOLDER]'))throw Error('SUBMISSION_CONTENT_INVALID');
  const expectedJob=process.env.TOYOL_MICRO_JOB_MATCH||'';
  if(expectedJob!==target)throw Error('SUBMISSION_JOB_ID_MISMATCH');
  emit('MICRO_TARGET_REVIEW',{id:target,mode:j.mode,selectionType:j.selectionType,brief:full.slice(0,4500),answerSHA256:createHash('sha256').update(answer).digest('hex')});
  if(process.env.TOYOL_MICRO_SUBMIT!=='true')throw Error('MICRO_WRITE_NOT_ENABLED');
  const res=await query('/jobs/'+encodeURIComponent(target)+'/submissions',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({content:answer,attachmentMediaIds:[]})});
  emit('MICRO_SUBMISSION_RECEIPT',{id:target,http:res.status,submitted:res.body.submitted??false,replayed:res.body.replayed??false,status:res.body.status??null,submissionId:res.body.submission?.submission_short_id||res.body.submission?.id||null,nextSteps:res.body.nextSteps?.map?.(z=>z.type||z.action)||null,errorCode:res.body.errorCode||null});
  if(!res.ok)process.exitCode=1;
}

await sleep(11300);
try{
 const r=await read('/wurker/submissions?filter=rewarded&page=1');
 const rows=r.submissions??r.data?.submissions??[];
 emit('MICRO_REWARDED_HISTORY',{count:Array.isArray(rows)?rows.length:null,entries:Array.isArray(rows)?rows.slice(0,6).map(z=>({id:z.submission_short_id,job:z.custom_short_id,reward:z.rewardEarning?.amount,asset:z.rewardEarning?.assetId,status:z.rewardEarning?.status})):[]});
}catch(e){emit('MICRO_REWARDED_HISTORY_UNAVAILABLE',{code:String(e.message).slice(0,80)})}
