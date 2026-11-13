// Toyol Digital — conservative, read-only Solana USDC payment verifier.
// Standalone prototype; not a customer's accepted delivery or a settlement ledger.
import {pathToFileURL} from 'node:url';
export const MINT='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const TOKEN='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const RPC='https://api.mainnet-beta.solana.com';
const ALPHABET='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function bytes(s,n){
 if(typeof s!=='string'||s.length>90||!s.length)return false;
 let v=0n;for(const c of s){const i=ALPHABET.indexOf(c);if(i<0)return false;v=v*58n+BigInt(i);}
 let size=0;while(v){size++;v>>=8n;}return size+(s.match(/^1*/)?.[0].length??0)===n;
}
export function micros(s){
 if(typeof s!=='string'||!/^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/.test(s))throw Error('INVALID_DECIMAL_AMOUNT');
 const [whole,frac='']=s.split('.'),n=BigInt(whole)*1000000n+BigInt(frac.padEnd(6,'0'));
 if(n<=0n||n>18446744073709551615n)throw Error('AMOUNT_OUT_OF_RANGE');return n;
}
function units(s){if(typeof s!=='string'||!/^\d{1,20}$/.test(s))throw Error('INVALID_TOKEN_AMOUNT');const n=BigInt(s);if(n>18446744073709551615n)throw Error('INVALID_TOKEN_AMOUNT');return n;}
const reply=(status,reason,extra={})=>({status,reason,mint:MINT,...extra});
export function verifyTransaction(tx,{signature,recipient,amount,recipientMode='owner'}){
 if(!bytes(signature,64)||!bytes(recipient,32)||!['owner','account'].includes(recipientMode))throw Error('INVALID_INPUT');
 const expected=micros(amount);
 if(!tx)return reply('indeterminate','TRANSACTION_NOT_FOUND');
 if(tx.transaction?.signatures?.[0]!==signature)return reply('indeterminate','SIGNATURE_MISMATCH');
 const m=tx.meta;
 if(!m||!Object.hasOwn(m,'err'))return reply('indeterminate','MISSING_META');
 if(m.err!==null)return reply('fail','TRANSACTION_FAILED');
 if(!Array.isArray(m.preTokenBalances)||!Array.isArray(m.postTokenBalances))return reply('indeterminate','MISSING_BALANCES');
 const msg=tx.transaction.message,keys=msg?.accountKeys?.map(k=>typeof k==='string'?k:k.pubkey);
 if(!Array.isArray(keys)||!keys.every(k=>bytes(k,32))||new Set(keys).size!==keys.length||!Array.isArray(msg.instructions)||!Array.isArray(m.innerInstructions))return reply('indeterminate','INCOMPLETE_PARSED_TRANSACTION');
 try{
  function balances(rows){
   const out=new Map();
   for(const b of rows){
    if(b.mint!==MINT)continue;
    if(b.programId!==TOKEN||b.uiTokenAmount?.decimals!==6||!Number.isInteger(b.accountIndex)||!keys[b.accountIndex]||!bytes(b.owner,32))throw Error('INCOMPLETE_USDC_ACCOUNT');
    const addr=keys[b.accountIndex];if(out.has(addr))throw Error('DUPLICATE_BALANCE');
    out.set(addr,{owner:b.owner,n:units(b.uiTokenAmount.amount)});
   }
   return out;
  }
  const pre=balances(m.preTokenBalances),post=balances(m.postTokenBalances);
  const all=new Set([...pre.keys(),...post.keys()]),deltas=new Map();
  const match=(a,b)=>recipientMode==='owner'?b?.owner===recipient:a===recipient;
  for(const a of all){
   const p=pre.get(a),q=post.get(a);
   if(p&&q&&p.owner!==q.owner)throw Error('OWNER_CHANGED');
   if(match(a,p)||match(a,q)){
    // Require final owner evidence; closed destination cannot count as received.
    if(!q)throw Error('RECIPIENT_ACCOUNT_CLOSED');
    deltas.set(a,q.n-(p?.n??0n));
   }
  }
  if(!deltas.size)return reply('fail','NO_MATCHING_USDC_RECIPIENT');
  const incoming=new Map();
  const instructions=[...msg.instructions,...m.innerInstructions.flatMap(x=>{if(!Array.isArray(x.instructions))throw Error('INNER_INSTRUCTIONS_INVALID');return x.instructions;})];
  for(const ix of instructions){
   if(ix.programId!==TOKEN)continue;
   if(!ix.parsed||typeof ix.parsed!=='object')throw Error('UNPARSED_TOKEN_INSTRUCTION');
   const {type,info}=ix.parsed;
   if(!['transfer','transferChecked'].includes(type))continue;
   if(!info||!bytes(info.destination,32)||!bytes(info.source,32))throw Error('INVALID_TRANSFER');
   if(!deltas.has(info.destination))continue;
   if(info.source===info.destination)continue;
   if(type==='transferChecked'&&(info.mint!==MINT||info.tokenAmount?.decimals!==6))throw Error('TRANSFER_MINT_OR_DECIMALS_MISMATCH');
   const n=units(type==='transferChecked'?info.tokenAmount.amount:info.amount);
   const source=pre.get(info.source)??post.get(info.source);
   if(!source)throw Error('SOURCE_MINT_UNVERIFIED');
   if(match(info.source,source))throw Error('INTERNAL_RECIPIENT_TRANSFER');
   incoming.set(info.destination,(incoming.get(info.destination)??0n)+n);
  }
  let total=0n;
  for(const [a,delta] of deltas){
   const gross=incoming.get(a)??0n;
   if(delta<0n||delta!==gross)return reply('indeterminate','NET_AND_TRANSFER_EVIDENCE_DIFFER',{account:a,netMicros:String(delta),incomingMicros:String(gross)});
   total+=delta;
  }
  if(total!==expected)return reply('fail','AMOUNT_MISMATCH',{receivedMicros:String(total),expectedMicros:String(expected)});
  return reply('pass','EXACT_USDC_TRANSFER',{signature,recipient,recipientMode,receivedMicros:String(total),slot:tx.slot,accounts:[...deltas].filter(([,n])=>n>0n).map(([a,n])=>({address:a,receivedMicros:String(n)}))});
 }catch(e){return reply('indeterminate',String(e.message));}
}
export async function checkPayment(input,{fetcher=fetch}={}){
 if(!bytes(input.signature,64)||!bytes(input.recipient,32))throw Error('INVALID_INPUT');
 micros(input.amount);
 const call=async(method,params)=>{
  const r=await fetcher(RPC,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error('RPC_HTTP_'+r.status);
  const s=await r.text();if(s.length>4000000)throw Error('RPC_RESPONSE_TOO_LARGE');
  const j=JSON.parse(s);if(j.error||j.id!==1||!Object.hasOwn(j,'result'))throw Error('RPC_ERROR');return j.result;
 };
 try{
  const state=await call('getSignatureStatuses',[[input.signature],{searchTransactionHistory:true}]);
  const row=state?.value?.[0];
  if(!row||row.confirmationStatus!=='finalized')return reply('indeterminate','NOT_FINALIZED');
  if(row.err!==null)return reply('fail','TRANSACTION_FAILED');
  const tx=await call('getTransaction',[input.signature,{commitment:'finalized',encoding:'jsonParsed',maxSupportedTransactionVersion:0}]);
  if(tx&&row.slot!==tx.slot)return reply('indeterminate','SLOT_MISMATCH');
  return verifyTransaction(tx,input);
 }catch(e){return reply('indeterminate',String(e.message));}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const [signature,recipient,amount,recipientMode='owner']=process.argv.slice(2);
  const result=await checkPayment({signature,recipient,amount,recipientMode});
  console.log(JSON.stringify(result,null,2));process.exitCode=result.status==='pass'?0:result.status==='fail'?1:2;
 }catch(e){console.error(JSON.stringify(reply('indeterminate',e.message)));process.exitCode=2;}
}
