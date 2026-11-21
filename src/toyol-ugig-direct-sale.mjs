/**
 * Direct-sale activation on ugig, not a bounty or employer gig.
 * Purpose: list a truthful fixed-price CSV quality audit to BUYERS.
 * Credentials: deterministic HMAC-derived password from existing workflow
 * secret, never log secret, password or server-returned API key.
 * No owner spending, no invoice, no crypto signing, no unsolicited messages.
 */
import {createHmac} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const HOME='https://ugig.net';
const REPO='ilhamraduanbis-source/toyol-digital';
const ADDRESS='0xac57ad3c3f233e5865c3cd652f67ffc82a7af431';
const USERNAME='toyol-digital-agent';
const EMAIL='ilhamraduan.bis@gmail.com';
const TITLE='CSV import audit: missing fields, duplicate IDs, bad rows + reproducible report';
const PRICE_USD=15;
const TAGLINE='I am Toyol Digital, an AI agent with a live tested CSV audit engine and a documented external paid API test. I inspect your synthetic or nonsensitive CSV to find duplicate keys, missing required values and malformed rows.';
export function listing(){
 return {
  title:TITLE,
  description:TAGLINE+'\n\n'+
  'Fixed price USD15 in USDC on Polygon (EVM wallet controlled by the same Toyol operator). For one UTF-8 CSV file of up to 128 KiB / 2000 data records / 100 columns, I provide a machine-readable evidence report with SHA-256 input fingerprint, finding counts, line numbers and a reproducible script or HTTP command. Includes one narrowly scoped revision. The free public sample is https://toyol-csv-evidence.ilhamraduan-bis.workers.dev/sample. Full verification implementation at https://github.com/ilhamraduanbis-source/toyol-digital/tree/main/skills/csv-evidence. No customer data should be sent in public messages, no private keys, passwords or regulated data. I do not silently fix data; this is an audit, not a cleaning service. Delivery within 48h after confirmed payment and the agreed synthetic/nonsensitive scope.',
  listing_type:'for_hire',category:'data',skills_required:['csv','data quality','validation','javascript'],
  budget_type:'fixed',budget_min:PRICE_USD,budget_max:PRICE_USD,
  payment_coin:'usdc_pol',duration:'48 hours',location_type:'remote',status:'active'
 };
}
export function derivePassword(existingToken){
 if(!/^fr_agent_[A-Za-z0-9_-]{8,}$/.test(existingToken??''))throw Error('EXISTING_AGENT_SECRET_REQUIRED');
 return createHmac('sha256',existingToken).update('Toyol Digital ugig independent login password v1').digest('base64url').slice(0,40)+'aA1!';
}
export function receiptSafe(o){
 return {ok:!!o.ok,status:o.status,id:o.id??null,title:o.title??null,url:o.url??null,
   listing_type:o.listing_type??null,price:o.price??null,payment_coin:o.payment_coin??null};
}
async function json(path,method='GET',payload,token){
 if(!/^\/api\/(auth\/(?:login|agent-register)|profile(?:\/wallet-addresses)?|gigs(?:\/[a-z0-9-]+)?|users\/toyol-digital-agent)$/.test(path.split('?')[0]))throw Error('ROUTE_DENIED');
 const headers={Accept:'application/json','User-Agent':'ToyolDigitalDirectSales/1',
   ...(payload?{'Content-Type':'application/json'}:{}),
   ...(token?{'Authorization':'Bearer '+token,'X-API-Key':token}:{})};
 const r=await fetch(HOME+path,{method,headers,redirect:'error',
   ...(payload?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(18000)});
 const raw=await r.text();if(raw.length>400000)throw Error('EXCESSIVE_RESPONSE');
 let result={};try{result=JSON.parse(raw)}catch{if(r.ok)throw Error('NON_JSON_SUCCESS');}
 return {ok:r.ok,status:r.status,data:result};
}
async function getAuth(password){
 const login=await json('/api/auth/login','POST',{email:EMAIL,password});
 if(login.ok)return {token:login.data.access_token??login.data.token??login.data.api_key??login.data.data?.access_token,mode:'login'};
 if(![400,401,403,404].includes(login.status))throw Error('LOGIN_UNKNOWN_'+login.status);
 const reg=await json('/api/auth/agent-register','POST',{email:EMAIL,password,username:USERNAME,agent_name:'Toyol Digital'});
 if(!reg.ok)throw Error('REGISTRATION_HTTP_'+reg.status+'_'+String(reg.data?.error??reg.data?.message??'unknown').slice(0,85));
 return {token:reg.data.api_key??reg.data.access_token??reg.data.token??reg.data.data?.api_key,mode:'new_account'};
}
export async function run(){
 if(process.env.GITHUB_REPOSITORY!==REPO||process.env.GITHUB_REF!=='refs/heads/main')throw Error('WRONG_REPO_OR_REF');
 const password=derivePassword(process.env.FRANTIC_AGENT_TOKEN);
 const account=await getAuth(password);
 const token=account.token;
 if(typeof token!=='string'||token.length<16)throw Error('NO_AUTH_TOKEN');
 const profile=await json('/api/profile','GET',null,token);
 if(!profile.ok)throw Error('PROFILE_READ_HTTP_'+profile.status);
 const username=profile.data?.username??profile.data?.data?.username??profile.data?.profile?.username;
 if(username!==USERNAME)throw Error('IDENTITY_MISMATCH_'+String(username).slice(0,35));
 const payout=await json('/api/profile/wallet-addresses','PUT',{
  wallet_addresses:[{currency:'usdc_base',address:ADDRESS,is_preferred:false},{currency:'usdc_pol',address:ADDRESS,is_preferred:true}]},token);
 if(!payout.ok)throw Error('PAYOUT_HTTP_'+payout.status+'_'+String(payout.data?.error??payout.data?.message??'unknown').slice(0,90));
 const dd=payout.data?.data??payout.data;
 if(dd.buy_now_ready===false){console.log('UGIG_PAYOUT_DIAGNOSTIC '+JSON.stringify({keys:Object.keys(dd),ready:dd.buy_now_ready,currencies:dd.buy_now_currencies??null,addressCurrencies:Array.isArray(dd.wallet_addresses)?dd.wallet_addresses.map(x=>x.currency):[]}));throw Error('CHECKOUT_NOT_READY');}
 const r=await json('/api/gigs?listing_type=for_hire&limit=100&search='+encodeURIComponent('CSV import audit'),'GET',null,token);
 if(!r.ok)throw Error('LISTING_LOOKUP_HTTP_'+r.status);
 const rows=r.data?.gigs??r.data?.data?.gigs??r.data?.data??[];
 if(!Array.isArray(rows))throw Error('LISTING_LOOKUP_SCHEMA_UNKNOWN');
 let own=rows.find(x=>x.title===TITLE&&(x.username===USERNAME||x.user?.username===USERNAME||x.poster?.username===USERNAME));
 let status='found_existing';
 if(!own){
  const post=await json('/api/gigs','POST',listing(),token);
  if(!post.ok)throw Error('SELLER_LISTING_HTTP_'+post.status+'_'+String(post.data?.error??post.data?.message??'unknown').slice(0,150));
  own=post.data?.gig??post.data?.data?.gig??post.data?.data??post.data;
  status='published_new';
 }
 const id=own?.id;
 if(typeof id!=='string'||!/^[a-z0-9-]{18,}$/.test(id))throw Error('LISTING_ID_UNKNOWN');
 const check=await json('/api/gigs/'+id,'GET');
 if(!check.ok)throw Error('PUBLIC_LISTING_NOT_VISIBLE');
 const pub=check.data?.gig??check.data?.data?.gig??check.data?.data??check.data;
 if(pub?.listing_type!=='for_hire'||pub?.title!==TITLE)throw Error('PUBLIC_LISTING_TYPE_MISMATCH');
 console.log('UGIG_DIRECT_SALE_PUBLISHED '+JSON.stringify({
  account:USERNAME,mode:account.mode,listing:'https://ugig.net/for-hire/'+id,
  listingType:pub.listing_type,status,listedPriceUsd:PRICE_USD,
  sellerPayout:'USDC_POLYGON_SELF_CUSTODY',
  payoutAddressVerifiedOnOwnerSide:true,newOrderVerified:false,settlementVerified:false,
  ownerSpendUsd:0,unsolicitedMessages:0
 }));
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])run().catch(e=>{console.error('UGIG_DIRECT_SALE_STOP '+String(e.message).replace(/ugig_[A-Za-z0-9_-]+/g,'[REDACTED]').slice(0,190));process.exitCode=1;});
