/**
 * Reusable offline protocol research skill, not a contest entry.
 * No network, no credentials, no wallet operations. Input: normalized snapshot.
 * Values are scenarios conditional on a future launch, never token price predictions.
 * Run: node src/protocol-analysis-skill.mjs --self-test
 * Run: node src/protocol-analysis-skill.mjs snapshot.json > analysis.json
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const pos=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const med=a=>{const b=[...a].sort((x,y)=>x-y);if(!b.length)return null;const n=b.length;return n%2?b[n>>1]:(b[n/2-1]+b[n/2])/2;};
const quant=(a,p)=>{const b=[...a].sort((x,y)=>x-y);const q=(b.length-1)*p,i=Math.floor(q);return b[i]+(b[Math.ceil(q)]-b[i])*(q-i);};
const blocked=new Set(['bridge','canonical bridge','liquid staking','liquid restaking','restaked btc','cex']);
const product=p=>blocked.has(String(p.category??'').toLowerCase())||/\b(?:wrapped|staked|staking)\b/i.test(p.name)||/^(?:Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i.test(p.name)||/\s(?:v\d+(?:\.\d+)?|\d+\.\d+)$/i.test(p.name)||Boolean(p.parentProtocol);
const hasToken=p=>Boolean(p.gecko_id||p.symbol||pos(p.mcap_usd));
export function analyze(snapshot,{maxRows=200,minRows=100}={}){
  if(!snapshot||!Array.isArray(snapshot.protocols)||!Array.isArray(snapshot.watchlist)||!/^\d{4}-\d{2}-\d{2}$/.test(snapshot.as_of)||!Number.isFinite(Date.parse(snapshot.as_of)))throw Error('INVALID_SNAPSHOT');
  if(!Number.isInteger(maxRows)||!Number.isInteger(minRows)||maxRows<minRows||minRows<0)throw Error('INVALID_ROW_LIMITS');
  const ids=new Set(),watch=new Set(snapshot.watchlist);
  if(watch.size!==snapshot.watchlist.length)throw Error('DUPLICATE_WATCHLIST');
  for(const p of snapshot.protocols){
    if(!p||typeof p.slug!=='string'||!p.slug||typeof p.name!=='string'||!p.name||!pos(p.tvl_usd)||ids.has(p.slug))throw Error('INVALID_OR_DUPLICATE_PROTOCOL');
    ids.add(p.slug);
  }
  const eligible=snapshot.protocols.filter(p=>!hasToken(p)&&!product(p));
  const eligibleIds=new Set(eligible.map(p=>p.slug));
  for(const slug of watch)if(!eligibleIds.has(slug))throw Error('WATCHLIST_CONTRADICTION '+slug);
  const comps=snapshot.protocols.filter(p=>pos(p.mcap_usd)&&!product(p)&&Boolean(p.gecko_id||p.symbol)).map(p=>({...p,ratio:p.mcap_usd/p.tvl_usd})).filter(p=>p.ratio>=.01&&p.ratio<=100);
  const globalRatios=comps.map(p=>p.ratio);
  if(globalRatios.length<3)throw Error('INSUFFICIENT_COMPARABLES');
  function model(p,pool=comps){
    const category=pool.filter(q=>q.category!==null&&q.category===p.category);
    const base=category.length>=5?category:pool;
    const nearest=base.map(q=>({q,d:Math.abs(Math.log(q.tvl_usd/p.tvl_usd))})).sort((a,b)=>a.d-b.d||a.q.slug.localeCompare(b.q.slug)).slice(0,12).map(x=>x.q);
    if(nearest.length<3)throw Error('INSUFFICIENT_PEERS');
    const rr=nearest.map(q=>q.ratio), prior=med(pool.map(q=>q.ratio)), w=nearest.length/(nearest.length+6);
    const central=Math.exp(w*Math.log(med(rr))+(1-w)*Math.log(prior));
    const growth=finite(p.change_7d)?clamp(p.change_7d/100,-.25,.25):0;
    const days=p.listed_at?Math.floor((Date.parse(snapshot.as_of)-Date.parse(p.listed_at))/86400000):null;
    const age=Number.isFinite(days)&&days>=0?days:null;
    const maturity=age===null?1:clamp(.85+Math.log1p(age/90)*.10,.85,1.20);
    const factor=(1+growth)*maturity;
    const middle=p.tvl_usd*central*factor;
    const low=p.tvl_usd*Math.min(central*.65,quant(rr,.25))*factor;
    const high=p.tvl_usd*Math.max(central*1.5,quant(rr,.75))*factor;
    return {slug:p.slug,name:p.name,category:p.category??null,chains:p.chains??[],tvl_usd:p.tvl_usd,change_7d:finite(p.change_7d)?p.change_7d:null,listed_age_days:age,watchlist:watch.has(p.slug),token_status:'no_token_recorded',conditional_mcap_usd:{low:Math.round(low),base:Math.round(middle),high:Math.round(high)},peer_scope:category.length>=5?'category':'cross_category',peers:nearest.map(q=>({slug:q.slug,ratio:q.ratio,tvl_usd:q.tvl_usd})),confidence:category.length>=5&&age!==null&&finite(p.change_7d)?'moderate':'low',limitations:['Snapshot absence does not prove a token is absent today.','Market-cap scenarios are not FDV, airdrop value, or launch probability.','Growth and maturity adjustments are heuristic, not causal estimates.','Parent-protocol data may be absent; non-watchlist candidates need independent verification.']};
  }
  const rows=eligible.map(p=>model(p)).sort((a,b)=>b.conditional_mcap_usd.base-a.conditional_mcap_usd.base||a.slug.localeCompare(b.slug));
  if(watch.size>maxRows)throw Error('WATCHLIST_EXCEEDS_LIMIT');
  const selected=rows.filter(x=>x.watchlist);
  for(const row of rows)if(!row.watchlist&&selected.length<maxRows)selected.push(row);
  if(selected.length<minRows)throw Error('INSUFFICIENT_ELIGIBLE_ROWS');
  selected.sort((a,b)=>b.conditional_mcap_usd.base-a.conditional_mcap_usd.base||a.slug.localeCompare(b.slug));
  const errs=[];
  if(comps.length>=4)for(const p of comps){
    const est=model(p,comps.filter(q=>q.slug!==p.slug)).conditional_mcap_usd.base;
    if(est>0)errs.push(Math.abs(Math.log(est/p.mcap_usd)));
  }
  return {schema:'toyol/protocol-research/v1',as_of:snapshot.as_of,source:snapshot.source??null,method:'peer-multiple median with global shrinkage and bounded growth and age adjustments',validation:{peer_count:comps.length,leave_one_out_count:errs.length,median_absolute_log_error:med(errs),median_error_factor:errs.length?Math.exp(med(errs)):null,watchlist_covered:selected.filter(x=>x.watchlist).length,watchlist_required:watch.size},rows:selected.map((p,i)=>({...p,rank:i+1}))};
}
export function selfTest(){
  const row=(slug,opts={})=>({slug,name:slug,category:'Lending',chains:['Base'],tvl_usd:20e6,change_7d:5,listed_at:'2025-01-01',gecko_id:null,symbol:null,mcap_usd:null,...opts});
  const p=[...Array.from({length:8},(_,i)=>row('peer'+i,{gecko_id:'token'+i,symbol:'T'+i,mcap_usd:20e6*(i+1)})),row('watch',{tvl_usd:60e6}),row('candidate'),row('Wrapped ETH'),row('known',{symbol:'KNOWN'}),row('v2',{name:'Project V2'})];
  const snap={as_of:'2026-11-15',source:'synthetic test fixture',watchlist:['watch'],protocols:p};
  const a=analyze(snap,{minRows:2,maxRows:2});assert.equal(a.rows.length,2);assert.equal(a.validation.watchlist_covered,1);assert.equal(a.validation.leave_one_out_count,8);assert.ok(a.validation.median_error_factor>=1);
  for(const x of a.rows){assert.ok(x.conditional_mcap_usd.low<=x.conditional_mcap_usd.base);assert.ok(x.conditional_mcap_usd.base<=x.conditional_mcap_usd.high);assert.equal(x.token_status,'no_token_recorded');}
  assert.deepEqual(a,analyze(snap,{minRows:2,maxRows:2}));assert.deepEqual(a.rows.map(x=>x.slug).sort(),['candidate','watch']);
  assert.throws(()=>analyze({...snap,watchlist:['known']},{minRows:0}),/WATCHLIST_CONTRADICTION/);
  assert.throws(()=>analyze({...snap,protocols:[...p,p[0]]},{minRows:0}),/DUPLICATE/);
  assert.throws(()=>analyze(snap,{minRows:3,maxRows:3}),/INSUFFICIENT_ELIGIBLE_ROWS/);
  const missing=analyze({...snap,protocols:p.map(q=>q.slug==='candidate'?{...q,change_7d:null,listed_at:null}:q)},{minRows:2,maxRows:2});assert.equal(missing.rows.find(q=>q.slug==='candidate').confidence,'low');
  console.log('PROTOCOL_ANALYSIS_SELF_TEST_PASS');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){if(process.argv[2]==='--self-test')selfTest();else if(process.argv[2])console.log(JSON.stringify(analyze(JSON.parse(fs.readFileSync(process.argv[2],'utf8'))),null,2));else throw Error('Supply snapshot.json or --self-test');}
