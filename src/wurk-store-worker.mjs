import {createPrivateKey,createPublicKey,sign,verify} from 'node:crypto';
const root='https://api.wurk.fun',path='/solana/siwx/account-create',url=root+path;
const expected='At7TxA4e81Ai8X2TWZq944NSSbP1HaJB9iRug4vD1uQ',chain='solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(b){let n=0n;for(const x of b)n=n*256n+BigInt(x);let s='';while(n){s=alphabet[Number(n%58n)]+s;n/=58n;}for(const x of b){if(x!==0)break;s='1'+s;}return s;}
const emit=(k,v)=>console.log(k+' '+JSON.stringify(v));
async function request(p,opts={}){
  if(!p.startsWith('/')||p.startsWith('//'))throw Error('PATH');
  const r=await fetch(root+p,{...opts,redirect:'error',signal:AbortSignal.timeout(18000),headers:{Accept:'application/json',...(opts.headers??{})}});
  const text=await r.text();if(text.length>3000000)throw Error('LIMIT');
  let j;try{j=JSON.parse(text)}catch{throw Error('NON_JSON_'+r.status);}
  return {r,j};
}
const a=JSON.parse(process.env.TOYOL_SOLANA_KEYPAIR_JSON??'null');
if(!Array.isArray(a)||a.length!==64||!a.every(n=>Number.isInteger(n)&&n>=0&&n<=255))throw Error('KEYPAIR_FORMAT');
const key=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.from(a.slice(0,32))]),format:'der',type:'pkcs8'});
const pub=createPublicKey(key),pk=Buffer.from(pub.export({format:'jwk'}).x,'base64url'),address=b58(pk);
if(address!==expected||!pk.equals(Buffer.from(a.slice(32))))throw Error('WALLET_IDENTITY');
const {r,j}=await request(path,{method:'POST'}),ext=j.extensions?.['sign-in-with-x'],i=ext?.info;
const supported=ext?.supportedChains?.find(x=>x.chainId===chain&&x.type==='ed25519'&&(!x.signatureScheme||x.signatureScheme==='siws'));
if(r.status!==402||j.x402Version!==2||!Array.isArray(j.accepts)||j.accepts.length!==0||!supported||!i)throw Error('NOT_FREE_AUTH');
const now=Date.now(),issued=Date.parse(i.issuedAt),expires=Date.parse(i.expirationTime);
if(i.domain!=='api.wurk.fun'||i.uri!==url||i.version!=='1'||i.statement!=='Sign in to create or access your WURK account and retrieve its API key on Solana'||!Array.isArray(i.resources)||i.resources.length!==1||i.resources[0]!==url||!/^[A-Za-z0-9]{8,128}$/.test(i.nonce??'')||!Number.isFinite(issued)||!Number.isFinite(expires)||issued>now+5000||issued<now-300000||expires<=now||expires-issued>300000||i.notBefore||i.requestId)throw Error('AUTH_INTENT_MISMATCH');
const info={...i,chainId:chain,type:'ed25519',...(supported.signatureScheme?{signatureScheme:supported.signatureScheme}:{})};
const message=[i.domain+' wants you to sign in with your Solana account:',address,'',i.statement,'','URI: '+i.uri,'Version: '+i.version,'Chain ID: '+chain.split(':')[1],'Nonce: '+i.nonce,'Issued At: '+i.issuedAt,'Expiration Time: '+i.expirationTime,'Resources:','- '+url].join('\n');
const sig=sign(null,Buffer.from(message),key);if(!verify(null,Buffer.from(message),pub,sig))throw Error('SIGNATURE');
const proof={...info,address,signature:b58(sig)};
const auth=await request(path,{method:'POST',headers:{'SIGN-IN-WITH-X':Buffer.from(JSON.stringify(proof)).toString('base64url')}});
if(!auth.r.ok){emit('AUTH_FAILED',{status:auth.r.status,code:auth.j.errorCode??null});process.exit(1);}
const u=auth.j;
if(u.ok!==true||u.auth!=='siwx'||u.paid!==false||u.network!=='solana'||u.walletAddress!==address||u.accountType!=='agent'||typeof u.accountId!=='string'||typeof u.apikey!=='string'||!u.apikey)throw Error('ACCOUNT_RESPONSE');
const headers={'X-API-Key':u.apikey};
console.log('::add-mask::'+u.apikey);
emit('WURK_AGENT_ACTIVE',{id:u.accountId,address,created:u.created,paid:false});
async function read(p){
  // Retry only read-only GETs on temporary service/rate-limit errors.
  // Never auto-retry POST writes or crypto authentication signatures.
  const transient=/^(?:HTTP_|NON_JSON_)(?:429|500|502|503|504)(?:_|$)/;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const {r,j}=await request(p,{headers});
      if(!r.ok)throw Error('HTTP_'+r.status+'_'+String(j.errorCode??'UNKNOWN').slice(0,80));
      return j;
    }catch(e){
      if(!transient.test(String(e.message??''))||attempt===2)throw e;
      emit('WURK_READ_RETRY',{path:p,attempt:attempt+1,reason:String(e.message).slice(0,40)});
      await new Promise(resolve=>setTimeout(resolve,[2500,5000][attempt]));
    }
  }
  throw Error('WURK_READ_UNEXPECTED');
}
const profile=await read('/profile');
if(profile.accountId!==u.accountId||profile.accountType!=='agent')throw Error('PROFILE_MISMATCH');

import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const account='46d40f1d-04c6-414c-96a6-84302f7fd77c';
if(u.accountId!==account)throw Error('ACCOUNT_ID_MISMATCH');
const title='Toyol Digital | Small flat JSON to CSV';
const price='0.45';
const terms="Convert a small, non-sensitive flat JSON array into CSV. Paste only the JSON array into your order briefing (maximum 1,600 UTF-8 bytes, 1–20 nonempty objects, up to 8 distinct columns). Values can be text, numbers, booleans or null. No files, nested objects, duplicate keys, control characters, or formula-like text. Receive copyable CSV text in private order chat, with row/column count and round-trip validation. Missing/null cells are blank; first-seen column order is preserved. Delivery within 3 days; no revisions. Please do not include secrets or personal data. This is an automated conversion service; unsupported input is declined, not charged for additional work.";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const safeId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{6,128}$/.test(x);
async function write(p,body,method='POST'){
  const {r,j}=await request(p,{method,headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok){emit('STORE_WRITE_STOP',{status:r.status,code:typeof j.errorCode==='string'?j.errorCode.slice(0,80):null});throw Error('STORE_WRITE_FAILED');}
  if(j.ok!==true)throw Error('STORE_RECEIPT');
  return j;
}
function conversion(raw){
  if(typeof raw!=='string'||raw.includes('```')||Buffer.byteLength(raw)>1600)return null;
  const r=spawnSync('python3',['src/wurk-flat-json.py'],{input:raw,encoding:'utf8',timeout:3000,maxBuffer:16000,env:{PATH:process.env.PATH,LANG:'C.UTF-8'}});
  if(r.status!==0)return null;
  const x=JSON.parse(r.stdout);
  if(typeof x.csv!=='string'||x.csv.includes('```')||Buffer.byteLength(x.csv)>3000||!Number.isInteger(x.rows)||!Number.isInteger(x.columns))return null;
  return x;
}
async function listProducts(){
  const j=await read('/wurker/store/products?status=all&page=1');
  const rows=j.products??j.data?.products;
  if(j.ok!==true||!Array.isArray(rows))throw Error('PRODUCT_LIST_SCHEMA');
  return rows;
}
async function serve(product){
  // Prioritize active paid orders; completed or cancelled history must never occupy the delivery budget.
  const active=[];
  const statusCounts={};
  for(const status of ['invited','accepted','awaiting_customer']){
    if(Object.keys(statusCounts).length)await sleep(11000);
    const j=await read('/wurker/orders?status='+status+'&limit=50');
    if(j.ok!==true||!Array.isArray(j.orders))throw Error('ORDER_LIST_SCHEMA');
    statusCounts[status]={count:j.orders.length,more:!!j.nextUrl};
    for(const row of j.orders){
      const id=row.customId??row.id??row.custom_id;
      if(safeId(id)&&!active.some(v=>(v.customId??v.id??v.custom_id)===id))active.push(row);
    }
  }
  emit('STORE_ORDER_CHECK',{count:active.length,listing:product.id,statusCounts});
  // Three active candidates per run, prioritizing invitations and accepted work.
  for(const row of active.slice(0,3)){
    const id=row.customId??row.id??row.custom_id;
    if(!safeId(id)||!['invited','accepted','awaiting_customer'].includes(row.status??row.state))continue;
    await sleep(11000);
    const d=await read('/wurker/orders/'+id),o=d.order??d.data?.order;
    if(d.ok!==true||!o||!o.product)continue;
    const pid=o.product.id??o.product.productId;
    if(pid!==product.id||o.product.name!==title)continue;
    const status=o.status??o.state, reward=o.reward;
    if(!['invited','accepted','awaiting_customer'].includes(status)||reward?.basis!=='worker_net'||reward.assetId!=='USDC'||reward.status!=='confirmed'||!/^0\.45(?:0+)?$/.test(String(reward.amount)))continue;
    if(!Array.isArray(o.attachments)||o.attachments.length!==0)continue;
    const x=conversion(o.description);
    if(!x){if(status==='invited'){
      await write('/wurker/orders/'+id+'/decision',{decision:'reject',reason:'This service requires a plain non-sensitive flat JSON array within the published limits, without attachments. I cannot safely convert the supplied briefing.'});
      emit('ORDER_DECLINED_UNSUPPORTED',{order:id});
    }else emit('ORDER_REVIEW_REQUIRED',{order:id,reason:'UNSUPPORTED_INPUT'});continue;}
    if(status==='invited'){
      await write('/wurker/orders/'+id+'/decision',{decision:'accept'});
      emit('ORDER_ACCEPTED',{order:id});await sleep(16000);
    }else await sleep(11000);
    // Stable content and idempotency key: retries do not create duplicate chat messages.
    const digest=createHash('sha256').update(id+'\0'+x.csv).digest('hex').slice(0,32);
    const message='CSV conversion complete. Validated '+x.rows+' rows and '+x.columns+' columns by CSV round-trip. Copy the contents below into a UTF-8 .csv file. Missing and null values are empty cells.\n\n```csv\n'+x.csv+'```';
    const reply=await write('/wurker/orders/'+id+'/chat',{message,files:[],idempotencyKey:'toyol-csv-'+digest});
    emit('ORDER_DELIVERY_SENT',{order:id,replayed:reply.replayed??null,payout:'CUSTOMER_APPROVAL_REQUIRED'});
    break; // one bounded delivery per run
  }
}
async function main(){
  const list=await listProducts();
  const matches=list.filter(x=>x.name===title);
  if(matches.length>1)throw Error('DUPLICATE_LISTING');
  let product=matches[0];
  if(product){
    if(!safeId(product.id))throw Error('PRODUCT_ID');
    emit('STORE_LISTING_EXISTS',{id:product.id,visible:product.visible??null,url:product.url??null});
    await serve(product);return;
  }
  if(process.env.GITHUB_EVENT_NAME!=='push'&&process.env.GITHUB_EVENT_NAME!=='workflow_dispatch'){emit('STORE_NOT_PUBLISHED',{});return;}
  if(profile.humanVerified!==true)throw Error('OWNER_NOT_VERIFIED');
  throw Error('EXISTING_LISTING_MISSING_REVIEW_REQUIRED');
  // The published fixed-price service is independent of any prize challenge.
  const own=await read('/wurker/profile');
  if(own.ok!==true||!('profile' in own))throw Error('SELLER_PROFILE_SCHEMA');
  if(own.profile?.nickname&&own.profile.nickname!=='ToyolDigital')throw Error('EXISTING_SELLER_IDENTITY');
  if(!own.profile?.nickname||own.profile.publicProfile!==true){
    await write('/wurker/profile',{nickname:'ToyolDigital',profileBio:'Automated, validated small-data conversion by Toyol Digital.',publicProfile:true});
    await sleep(16000);
  }
  const image=readFileSync('out/wurk-service-cover.png');
  const upload=await write('/wurker/profile/media',{purpose:'portfolio',fileName:'toyol-json-csv.png',fileBase64:image.toString('base64')});
  const thumbnail=upload.media?.url;
  if(typeof thumbnail!=='string'||!thumbnail.startsWith('https://'))throw Error('THUMBNAIL_RECEIPT');
  await sleep(16000);
  const created=await write('/wurker/store/products',{name:title,description:terms,thumbnailUrl:thumbnail,tags:'JSON,CSV,data conversion',priceUsd:price,priceOnRequest:false,revisions:0,expectedDelivery:'3days',idempotencyKey:'toyol-flat-json-csv-listing-v1'});
  product=created.product;
  if(!product||!safeId(product.id)||product.name!==title||product.visible!==true||typeof product.url!=='string'||!product.url.startsWith('https://wurk.fun/'))throw Error('PRODUCT_NOT_PUBLIC');
  emit('STORE_PUBLISHED',{id:product.id,url:product.url,priceSellerNet:price,visible:true});
  // No additional random-prize entries. The previously submitted store challenge remains in history.
  await serve(product);
}
main().catch(e=>{emit('STORE_SAFE_STOP',{reason:/^[A-Z0-9_]+$/.test(e.message)?e.message:'UNEXPECTED_RESPONSE'});process.exitCode=1;});
