import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyTransaction,checkPayment,micros,MINT,TOKEN} from './verify.mjs';
const key=n=>'1'.repeat(31)+String(n);
const sig='1'.repeat(63)+'2',owner=key(2),sender=key(3),src=key(4),dst=key(5);
const input={signature:sig,recipient:owner,amount:'5'};
const balance=(index,owner,n,mint=MINT)=>({accountIndex:index,owner,mint,programId:TOKEN,uiTokenAmount:{amount:String(n),decimals:6}});
const transfer=(n='5000000')=>({programId:TOKEN,parsed:{type:'transferChecked',info:{source:src,destination:dst,mint:MINT,tokenAmount:{amount:n,decimals:6}}}});
function fixture(){
 return {slot:123,transaction:{signatures:[sig],message:{accountKeys:[{pubkey:src},{pubkey:dst}],instructions:[transfer()]}},
 meta:{err:null,preTokenBalances:[balance(0,sender,9000000),balance(1,owner,1000000)],postTokenBalances:[balance(0,sender,4000000),balance(1,owner,6000000)],innerInstructions:[]}};
}
test('amount parsing uses exact integer units',()=>{assert.equal(micros('0.000001'),1n);assert.equal(micros('5.000001'),5000001n);for(const x of ['0','1e2','-1','0.0000001','1.2345678','01','NaN'])assert.throws(()=>micros(x));});
test('exact transfer to wallet owner',()=>{const r=verifyTransaction(fixture(),input);assert.equal(r.status,'pass');assert.equal(r.receivedMicros,'5000000');assert.equal(r.accounts[0].address,dst);});
test('explicit destination token account',()=>assert.equal(verifyTransaction(fixture(),{...input,recipient:dst,recipientMode:'account'}).status,'pass'));
test('wrong recipient fails',()=>assert.equal(verifyTransaction(fixture(),{...input,recipient:key(6)}).reason,'NO_MATCHING_USDC_RECIPIENT'));
test('wrong amount fails',()=>assert.equal(verifyTransaction(fixture(),{...input,amount:'4'}).reason,'AMOUNT_MISMATCH'));
test('failed transaction never counts',()=>{const t=fixture();t.meta.err={InstructionError:[0,'Custom']};assert.equal(verifyTransaction(t,input).reason,'TRANSACTION_FAILED');});
test('missing or different signature not verified',()=>{const t=fixture();t.transaction.signatures=['1'.repeat(64)];assert.equal(verifyTransaction(t,input).reason,'SIGNATURE_MISMATCH');assert.equal(verifyTransaction(null,input).reason,'TRANSACTION_NOT_FOUND');});
test('lookalike token does not count',()=>{const t=fixture();for(const b of [...t.meta.preTokenBalances,...t.meta.postTokenBalances])b.mint=key(6);assert.equal(verifyTransaction(t,input).status,'fail');});
test('mint mismatch refuses ambiguous transfer',()=>{const t=fixture();t.transaction.message.instructions[0].parsed.info.mint=key(6);assert.equal(verifyTransaction(t,input).reason,'TRANSFER_MINT_OR_DECIMALS_MISMATCH');});
test('missing metadata cannot pass',()=>{const t=fixture();delete t.meta.postTokenBalances;assert.equal(verifyTransaction(t,input).reason,'MISSING_BALANCES');});
test('recipient owner change refuses',()=>{const t=fixture();t.meta.preTokenBalances[1].owner=sender;assert.equal(verifyTransaction(t,input).reason,'OWNER_CHANGED');});
test('new destination account with post owner can pass',()=>{const t=fixture();t.meta.preTokenBalances.pop();t.meta.postTokenBalances[1].uiTokenAmount.amount='5000000';assert.equal(verifyTransaction(t,input).status,'pass');});
test('CPI transfer evidence is included',()=>{const t=fixture();t.transaction.message.instructions=[{programId:key(6)}];t.meta.innerInstructions=[{index:0,instructions:[transfer()]}];assert.equal(verifyTransaction(t,input).status,'pass');});
test('unchecked transfer grounded in token balances',()=>{const t=fixture();t.transaction.message.instructions=[{programId:TOKEN,parsed:{type:'transfer',info:{source:src,destination:dst,amount:'5000000'}}}];assert.equal(verifyTransaction(t,input).status,'pass');});
test('minting without transfer is not payment',()=>{const t=fixture();t.transaction.message.instructions=[{programId:TOKEN,parsed:{type:'mintTo',info:{account:dst,amount:'5000000'}}}];assert.equal(verifyTransaction(t,input).reason,'NET_AND_TRANSFER_EVIDENCE_DIFFER');});
test('balance increase insufficient if transfer evidence disagrees',()=>{const t=fixture();t.meta.postTokenBalances[1].uiTokenAmount.amount='7000000';assert.equal(verifyTransaction(t,input).status,'indeterminate');});
test('same-owner transfers not external payment',()=>{const t=fixture();t.meta.preTokenBalances[0].owner=owner;t.meta.postTokenBalances[0].owner=owner;assert.equal(verifyTransaction(t,input).reason,'INTERNAL_RECIPIENT_TRANSFER');});
test('unparsed token instruction fails closed',()=>{const t=fixture();t.transaction.message.instructions.push({programId:TOKEN,data:'abc'});assert.equal(verifyTransaction(t,input).reason,'UNPARSED_TOKEN_INSTRUCTION');});
test('duplicate balance rows fail closed',()=>{const t=fixture();t.meta.postTokenBalances.push(t.meta.postTokenBalances[1]);assert.equal(verifyTransaction(t,input).reason,'DUPLICATE_BALANCE');});
function rpc(status='finalized',tx=fixture()){
 const calls=[];
 return {calls,fetcher:async(url,opt)=>{
  assert.equal(url,'https://api.mainnet-beta.solana.com');
  assert.equal(opt.method,'POST');assert.equal(opt.redirect,'error');
  const q=JSON.parse(opt.body);calls.push(q);
  const result=q.method==='getSignatureStatuses'?{value:[{confirmationStatus:status,err:null,slot:123}]}:tx;
  return new Response(JSON.stringify({jsonrpc:'2.0',id:1,result}));
 }};
}
test('RPC path requires finalized status and requests finalized parsed transaction',async()=>{const f=rpc();assert.equal((await checkPayment(input,f)).status,'pass');assert.equal(f.calls.length,2);assert.deepEqual(f.calls[1].params[1],{commitment:'finalized',encoding:'jsonParsed',maxSupportedTransactionVersion:0});});
test('nonfinalized status stops before transaction query',async()=>{const f=rpc('confirmed');assert.equal((await checkPayment(input,f)).reason,'NOT_FINALIZED');assert.equal(f.calls.length,1);});
test('inconsistent slots do not count',async()=>{const t=fixture();t.slot=124;assert.equal((await checkPayment(input,rpc('finalized',t))).reason,'SLOT_MISMATCH');});
test('RPC failure is indeterminate',async()=>assert.equal((await checkPayment(input,{fetcher:async()=>new Response('',{status:429})})).reason,'RPC_HTTP_429'));
