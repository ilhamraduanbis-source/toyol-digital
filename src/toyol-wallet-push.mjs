/**
 * Independent finalized Base USDC wallet push watcher.
 * No signing keys, no claims, no model access, no use of other Toyol runners.
 * Transaction-level alerts are "wallet received USDC", NOT proven customer revenue.
 */
import assert from 'node:assert/strict';

const REPO='ilhamraduanbis-source/toyol-digital';
const WALLET='0xac57ad3c3f233e5865c3cd652f67ffc82a7af431';
const TOKEN='0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const TRANSFER='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const TOPIC='toyol-usdc-588c951f0ffda74fbdafc5129da453';
const ISSUENO=5, STATE_MARKER='TOYOL_WALLET_PUSH_STATE_V1';
const PROVIDERS=['https://mainnet.base.org','https://base-rpc.publicnode.com'];
const TOKEN_HEADER='Bearer '+String(process.env.GH_TOKEN||'');
const addressTopic='0x'+WALLET.slice(2).padStart(64,'0');
const idRe=/^0x[a-f0-9]{64}:0x[a-f0-9]+$/;

function validState(s){
  assert.equal(s.version,1);
  assert.equal(s.wallet,WALLET);
  assert.ok(Number.isSafeInteger(s.cursor)&&s.cursor>=1);
  assert.ok(Array.isArray(s.seen)&&s.seen.length<=300);
  assert.ok(s.seen.every(x=>typeof x==='string'&&idRe.test(x)));
}
function body(s){return '<!-- '+STATE_MARKER+'\n'+JSON.stringify(s)+'\n-->\nWallet push cursor (Base finalized only); not a revenue ledger.';}
function parseBody(x){
  const p=x.match(new RegExp('<!-- '+STATE_MARKER+'\\s*([\\s\\S]+?)\\s*-->'));
  if(!p)return null;
  const s=JSON.parse(p[1]);validState(s);return s;
}
async function gh(p,method='GET',payload){
  if(!process.env.GH_TOKEN)throw Error('GITHUB_TOKEN_UNAVAILABLE');
  const r=await fetch('https://api.github.com/repos/'+REPO+p,{
    method,redirect:'error',signal:AbortSignal.timeout(16000),
    headers:{Authorization:TOKEN_HEADER,Accept:'application/vnd.github+json',
             'X-GitHub-Api-Version':'2022-11-28','User-Agent':'ToyolBaseWalletPush/1.0',
             ...(payload?{'Content-Type':'application/json'}:{})},
    ...(payload?{body:JSON.stringify(payload)}:{})
  });
  if(!r.ok)throw Error('GITHUB_'+method+'_'+r.status);
  return r.status===204?null:r.json();
}
async function rpc(method,params){
  for(const host of PROVIDERS){
    try{
      const r=await fetch(host,{method:'POST',redirect:'error',signal:AbortSignal.timeout(14000),
        headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
      if(!r.ok)continue;
      const j=await r.json();
      if(j.error||j.result===undefined)continue;
      return j.result;
    }catch{}
  }
  throw Error('RPC_UNAVAILABLE_'+method);
}
async function stateComment(){
  for(let page=1;page<=8;page++){
    const rows=await gh('/issues/'+ISSUENO+'/comments?per_page=100&page='+page);
    if(!Array.isArray(rows))throw Error('ISSUE_COMMENT_SCHEMA');
    const matches=rows.filter(x=>x.user?.login==='github-actions[bot]'&&
      typeof x.body==='string'&&x.body.includes(STATE_MARKER));
    if(matches.length>1)throw Error('DUPLICATE_STATE_COMMENT');
    if(matches.length===1)return matches[0];
    if(rows.length<100)return null;
  }
  throw Error('ISSUE_COMMENT_PAGINATION_LIMIT');
}
async function postAlert(title,message,click){
  assert.ok(title.length<120&&message.length<600);
  const r=await fetch('https://ntfy.sh/'+TOPIC,{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{Title:title,Priority:'high',Tags:'money_with_wings',
             Click:click,'Cache':'yes','Content-Type':'text/plain; charset=utf-8'},
    body:message
  });
  if(!r.ok)throw Error('NTFY_'+r.status);
  const j=await r.json();
  if(j.topic!==TOPIC||j.event!=='message'||typeof j.id!=='string')throw Error('NTFY_ACK_INVALID');
  return j.id;
}
const checkedHex=x=>{if(!/^0x[0-9a-f]+$/i.test(String(x)))throw Error('RPC_INVALID_HEX');return BigInt(x);};
async function run(){
  const chain=await rpc('eth_chainId',[]);
  if(chain!=='0x2105')throw Error('CHAIN_ID_MISMATCH');
  const f=await rpc('eth_getBlockByNumber',['finalized',false]);
  const end=Number(checkedHex(f?.number));
  if(!Number.isSafeInteger(end)||end<1)throw Error('FINALIZED_BLOCK_INVALID');
  const current=await stateComment();
  if(!current){
    // First activation starts from an already-finalized block to avoid replaying
    // historical USDC receipts as newly earned money.
    const baseline={version:1,wallet:WALLET,cursor:end,seen:[]};
    const c=await gh('/issues/'+ISSUENO+'/comments','POST',{body:body(baseline)});
    assert.ok(c?.id>0);
    const ack=await postAlert('Toyol Wallet - ujian sambungan',
      'TEST SAHAJA. Pemantauan USDC Base sudah aktif. Ini BUKAN bayaran baharu. Notifikasi sebenar dihantar hanya apabila token USDC masuk ke wallet dan transaksi finalized.',
      'https://basescan.org/address/'+WALLET);
    console.log('WALLET_PUSH_BOOTSTRAP '+JSON.stringify({stateComment:c.id,baseline:end,testPublished:true,ack}));
    return;
  }
  const state=parseBody(current.body);
  if(!state)throw Error('STATE_MISSING');
  if(end<state.cursor)throw Error('FINALIZED_BLOCK_REGRESSION');
  if(end-state.cursor>100000)throw Error('GAP_TOO_LARGE_REQUIRES_REVIEW_NO_SKIP');
  const seen=new Set(state.seen);
  const fromCursor=state.cursor;
  let alerts=0,scanned=0;
  for(let start=state.cursor+1;start<=end;start+=1000){
    const last=Math.min(end,start+999);
    const rows=await rpc('eth_getLogs',[{address:TOKEN,
      fromBlock:'0x'+start.toString(16),toBlock:'0x'+last.toString(16),
      topics:[TRANSFER,null,addressTopic]}]);
    if(!Array.isArray(rows))throw Error('INVALID_LOG_SET');
    for(const x of rows){
      if(x.removed||String(x.address).toLowerCase()!==TOKEN||
         String(x.topics?.[0]).toLowerCase()!==TRANSFER||
         String(x.topics?.[2]).toLowerCase()!==addressTopic)continue;
      const amount=checkedHex(x.data);
      if(amount<=0n)continue;
      const tx=String(x.transactionHash).toLowerCase(),index=String(x.logIndex).toLowerCase();
      const id=tx+':'+index;
      if(!idRe.test(id))throw Error('INVALID_TX_LOG_ID');
      if(seen.has(id))continue;
      if(Number(checkedHex(x.blockNumber))>end)throw Error('UNFINALIZED_LOG');
      const usdc=(amount/1000000n).toString()+'.'+(amount%1000000n).toString().padStart(6,'0');
      const ack=await postAlert('USDC MASUK KE WALLET TOYOL',
        usdc+' USDC diterima pada Base. Sumber transaksi belum disahkan sebagai pendapatan. Tx '+tx.slice(0,12)+'... Klik untuk bukti.',
        'https://basescan.org/tx/'+tx);
      seen.add(id);alerts++;
      // Save each published push before moving the scan cursor. Failed ntfy
      // responses leave the event eligible for a later check (no false success).
      state.seen=[...seen].slice(-300);
      await gh('/issues/comments/'+current.id,'PATCH',{body:body(state)});
      console.log('NEW_WALLET_PUSH '+JSON.stringify({tx,logIndex:index,usdc,ack}));
    }
    scanned++;
  }
  if(state.cursor!==end){
    state.cursor=end;
    state.seen=[...seen].slice(-300);
    await gh('/issues/comments/'+current.id,'PATCH',{body:body(state)});
  }
  console.log('WALLET_PUSH_CHECK '+JSON.stringify({from:fromCursor,to:end,blocks:end-fromCursor,
    chunks:scanned,alerts,notProofOfEarnedIncome:true}));
}
if(process.argv.includes('--self-test')){
  const s={version:1,wallet:WALLET,cursor:58000000,seen:[]};
  validState(s);assert.deepEqual(parseBody(body(s)),s);
  assert.ok(idRe.test('0x'+'1'.repeat(64)+':0xa'));
  assert.equal(TOKEN.length,42);assert.equal(addressTopic.length,66);
  console.log('WALLET_PUSH_LOCAL_TEST_OK');
}else{
  run().catch(e=>{console.error('WALLET_PUSH_SAFE_STOP '+String(e.message).slice(0,130));process.exitCode=1;});
}
