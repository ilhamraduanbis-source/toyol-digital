/**
 * Toyol USD5M procurement skills, read-only.
 * Live source checks do not turn leads into qualification or bid permission.
 * No external submissions, spending, credentials, or invented vendor references.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname} from 'node:path';

export const LEADS=Object.freeze([
 {id:'FSAI-2026-009',area:'IE',subject:'Software application development and support',estimatedValue:6500000,currency:'EUR',source:'https://www.etenders.gov.ie/epps/cft/prepareViewCfTWS.do?resourceId=9517554',deadline:'2026-12-22',type:'live-notice',selectionCriteriaVerified:false,eligibilityVerified:false,subcontractAllowedVerified:false,resourcesVerified:false},
 {id:'TED-809589-2026',area:'IT',subject:'National transport information system',estimatedValue:142650779,currency:'EUR',source:'https://ted.europa.eu/en/notice/-/detail/809589-2026',deadline:'2027-01-11',type:'live-notice',selectionCriteriaVerified:false,eligibilityVerified:false,subcontractAllowedVerified:false,resourcesVerified:false},
 {id:'TED-810787-2026',area:'NL',subject:'Utrecht meeting service platform',estimatedValue:9240000,currency:'EUR',source:'https://ted.europa.eu/en/notice/-/detail/810787-2026',deadline:'2027-01-13',type:'live-notice',selectionCriteriaVerified:false,eligibilityVerified:false,subcontractAllowedVerified:false,resourcesVerified:false},
 {id:'HUD-APP-T-2027-117',area:'US',subject:'Enterprise AI Services Platform Delivery',estimatedValue:5000000,currency:'USD',source:'https://www.hud.gov/sites/default/files/SDB/documents/HUD-Forecast-FY27-28.pdf',deadline:null,type:'forecast-only',selectionCriteriaVerified:false,eligibilityVerified:false,subcontractAllowedVerified:false,resourcesVerified:false}
]);
export const REQUIRED_GATES=Object.freeze(['selectionCriteriaVerified','eligibilityVerified','subcontractAllowedVerified','resourcesVerified']);
export function evaluateLead(lead,asOf='2026-11-20'){
 if(!lead||typeof lead!=='object'||typeof lead.source!=='string'||!lead.source.startsWith('https://'))throw Error('INVALID_LEAD');
 const missing=REQUIRED_GATES.filter(x=>lead[x]!==true);
 const expired=Boolean(lead.deadline&&lead.deadline<asOf);
 const noticesReady=lead.type==='live-notice'&&!expired;
 const bidReady=noticesReady&&missing.length===0;
 return {id:lead.id,type:lead.type,source:lead.source,estimatedValue:lead.estimatedValue,currency:lead.currency,deadline:lead.deadline,
  deadlineTimeVerified:false,missingGates:missing,expired,bidReady,reason:bidReady?'REQUIRES_HUMAN_APPROVAL':'NOT_QUALIFIED_FOR_DIRECT_BID',committedRevenue:0};
}
const USDC='0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
export function reconcileTransfer(receipt,claim){
 if(!receipt||!claim)throw Error('INVALID_EVIDENCE');
 const required=['chainId','token','to','amountAtomic','txHash','finalized'];
 for(const key of required)if(receipt[key]===undefined)throw Error('MISSING_'+key);
 if(!/^[0-9]+$/.test(String(receipt.amountAtomic))||BigInt(receipt.amountAtomic)<=0n)throw Error('AMOUNT_INVALID');
 if(!/^0x[a-f0-9]{64}$/i.test(receipt.txHash))throw Error('TX_HASH_INVALID');
 const checks={
  chain:receipt.chainId===8453&&receipt.chainId===claim.chainId,
  token:receipt.token.toLowerCase()===USDC&&receipt.token.toLowerCase()===String(claim.token).toLowerCase(),
  wallet:receipt.to.toLowerCase()===String(claim.to).toLowerCase(),
  amount:BigInt(receipt.amountAtomic)===BigInt(claim.amountAtomic),
  transaction:receipt.txHash.toLowerCase()===String(claim.txHash).toLowerCase(),
  finalized:receipt.finalized===true
 };
 return {matched:Object.values(checks).every(Boolean),checks,classification:'SYNTHETIC_VALIDATION_NOT_PAYMENT_PROOF'};
}
async function statusOf(url){
 try{
  const u=new URL(url);if(u.protocol!=='https:')throw Error('SCHEME_BLOCKED');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  try{
   const r=await fetch(url,{redirect:'error',headers:{Accept:'text/html,application/json,application/pdf'},signal:controller.signal});
   const kind=r.headers.get('content-type')||'';
   return {url,http:r.status,reachable:r.ok,contentType:kind.slice(0,75),sourceReadAt:new Date().toISOString(),
    qualifiesVendor:false,selectionCriteriaChecked:false};
  }finally{clearTimeout(timer);}
 }catch(e){return {url,reachable:false,error:String(e?.message??e).slice(0,140),qualifiesVendor:false,selectionCriteriaChecked:false};}
}
export async function runTask(clone,task){
 const legal=new Set(['eu-eligibility','uk-qualification','partner-route','technical-qa','commercial','us-subcontract']);
 if(!/^[a-z0-9-]{1,70}$/.test(clone)||!legal.has(task))throw Error('UNAPPROVED_ASSIGNMENT');
 const results={clone,task,at:new Date().toISOString(),ownerSpendUsd:0,bidsSubmitted:0,outreachSent:0,contractsAwarded:0,incomeVerifiedUsd:0,
  delivery:'BOUNDED_LOCAL_CAPABILITY_EXERCISE',capabilityCertified:false};
 if(task==='eu-eligibility'){
  results.leads=LEADS.filter(x=>x.area==='IE'||x.area==='IT'||x.area==='NL').map(x=>evaluateLead(x));
  results.check=await statusOf(LEADS[0].source);
  results.next='Read ORIGINAL selection/financial/ESPD and subcontract clauses; document supplier-specific evidence. UNKNOWN remains blocking.';
 }
 if(task==='uk-qualification'){
  results.check=await statusOf('https://www.find-tender.service.gov.uk/Search');
  results.leads=[];results.next='Validate official UK OCDS endpoint independently, inspect exact tender and accessibility of full selection requirements; no UK bid identified by this exercise.';
 }
 if(task==='partner-route'){
  results.leads=LEADS.map(x=>({id:x.id,route:'PRIME_PARTNER_RESEARCH_ONLY',primePartnerIdentified:false,permissionToContact:false,
   possibleNarrowDeliverables:['test automation','reproducible reconciliation checks','data-quality audits'],
   gates:['real client references','contractor eligibility','scope confirmation','vendor insurance','data handling','owner outreach approval']}));
  results.next='Research prime contractors from public award records; verify partner fit before preparing an unsent, truthful capability statement.';
 }
 if(task==='technical-qa'){
  const receipt={chainId:8453,token:USDC,to:'0x0000000000000000000000000000000000000001',amountAtomic:'1250000',txHash:'0x'+'a'.repeat(64),finalized:true};
  const positive=reconcileTransfer(receipt,{...receipt});
  const negative=reconcileTransfer({...receipt,amountAtomic:'1249999'},receipt);
  if(!positive.matched||negative.matched)throw Error('VALIDATION_INVARIANT_FAILED');
  results.evidence={positive,negative,syntheticOnly:true,hash:createHash('sha256').update(JSON.stringify({receipt,positive,negative})).digest('hex')};
  results.next='Extend to signed transaction input, independent RPC verification, multi-source receipts and replay protection. No real payment verified.';
 }
 if(task==='commercial'){
  const hypothetical={days:80,engineers:4,dayRateUsd:400,overheadPercent:20,contingencyPercent:25};
  const direct=hypothetical.days*hypothetical.engineers*hypothetical.dayRateUsd;
  const gross=direct*(1+hypothetical.overheadPercent/100)*(1+hypothetical.contingencyPercent/100);
  results.model={assumptions:hypothetical,directCostUsd:direct,grossScenarioUsd:gross,
    verifiedCapacity:false,quotedPrice:false,insurerVerified:false,bondVerified:false};
  results.next='Obtain truthful resources, taxes, insurance, bonds, access conditions and actual scope before any client-facing price.';
 }
 if(task==='us-subcontract'){
  results.forecast=evaluateLead(LEADS[3]);
  results.check=await statusOf('https://www.gsa.gov/small-business/find-opportunities');
  results.next='Search published federal prime contractor history and SBA SUBNet; forecast is not a live solicitation, and Malaysian business eligibility is unverified.';
 }
 return results;
}
if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const [clone,task,out]=process.argv.slice(2);
 try{
  const r=await runTask(clone,task);
  if(out){mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(r,null,2)+'\n');}
  console.log('PROCUREMENT_SKILL_RECEIPT '+JSON.stringify(r).slice(0,12000));
 }catch(e){console.error('PROCUREMENT_SKILL_FAILED '+String(e));process.exitCode=1;}
}
