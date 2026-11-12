// Notify only for a settled Frantic payout independently confirmed on Base.
const repo='ilhamraduanbis-source/toyol-digital';
const wallet='0xac57ad3c3f233e5865c3cd652f67ffc82a7af431';
const usdc='0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const transfer='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const token=process.env.GITHUB_TOKEN;
async function json(url,options={}){
 const r=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('HTTP '+r.status);
 return r.json();
}
async function rpc(method,params){
 const r=await json('https://mainnet.base.org',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
 if(r.error||r.result==null)throw Error('RPC evidence unavailable');
 return r.result;
}
const headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json'};
const issue='https://api.github.com/repos/'+repo+'/issues/5/comments';
async function alreadyNotified(marker){
 for(let page=1;page<=20;page++){
  const rows=await json(issue+'?per_page=100&page='+page,{headers});
  if(!Array.isArray(rows))throw Error('Unexpected issue comments');
  if(rows.some(c=>c.user?.login==='github-actions[bot]'&&String(c.body).includes(marker)))return true;
  if(rows.length<100)return false;
 }
 throw Error('Cannot establish notification deduplication');
}
async function main(){
 if(!token||process.env.GITHUB_REPOSITORY!==repo)return;
 const s=await json('https://gofrantic.com/v1/agents/agent-65c3b0/status');
 if(s.ok!==true||s.agent?.kid!=='agent-65c3b0')throw Error('Unexpected agent');
 for(const w of s.work?.settled||[]){
  if(w.stage!=='paid'||!w.sealed||!w.payout?.receiptCode||!w.payout?.settledAt)continue;
  const ref=String(w.payout.paymentRef||'');
  // Never guess the transaction from a receipt code or advertised price.
  const tx=ref.match(/^(0x[a-fA-F0-9]{64})$/)?.[1]||
   ref.match(/^https:\/\/basescan\.org\/tx\/(0x[a-fA-F0-9]{64})$/)?.[1];
  if(!tx)continue;
  const receipt=await rpc('eth_getTransactionReceipt',[tx]);
  if(receipt.status!=='0x1'||receipt.transactionHash?.toLowerCase()!==tx.toLowerCase())continue;
  if(BigInt(await rpc('eth_blockNumber',[]))-BigInt(receipt.blockNumber)<12n)continue;
  const recipient='0x'+wallet.slice(2).padStart(64,'0');
  const amount=(receipt.logs||[]).filter(l=>l.address?.toLowerCase()===usdc&&l.topics?.[0]?.toLowerCase()===transfer&&l.topics?.[2]?.toLowerCase()===recipient&&/^0x[0-9a-f]{64}$/i.test(l.data)).reduce((a,l)=>a+BigInt(l.data),0n);
  if(amount<=0n)continue;
  const marker='<!-- toyol-verified-payout:'+tx.toLowerCase()+' -->';
  if(await alreadyNotified(marker))continue;
  const value=(amount/1000000n).toString()+'.'+(amount%1000000n).toString().padStart(6,'0');
  await json(issue,{method:'POST',headers,body:JSON.stringify({body:marker+'\n## Toyol: bayaran sebenar disahkan\n\n'+value+' USDC diterima di Base, Frantic bounty #'+Number(w.bounty?.number||0)+'.\n\nTransaksi: https://basescan.org/tx/'+tx+'\n\nBayaran ini belum ditukar kepada MYR.'})});
 }
}
main().catch(e=>{console.log('No verified payout notification: '+String(e.message).slice(0,160));});
