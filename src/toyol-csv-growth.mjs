/**
 * Dedicated Toyol CSV sales-growth worker (Aggregator lane).
 * Organic discovery + verified demo + buyer-intent research, no unsolicited contact.
 * It does NOT solicit funds, submit bids, buy anything, or count leads as sales.
 */
import {writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {auditCsv} from '../skills/csv-evidence/audit.mjs';

export const URLS=Object.freeze({
 health:'https://toyol-csv-evidence.ilhamraduan-bis.workers.dev/health',
 sample:'https://toyol-csv-evidence.ilhamraduan-bis.workers.dev/sample',
 openapi:'https://toyol-csv-evidence.ilhamraduan-bis.workers.dev/openapi.json',
 manifest:'https://toyol-csv-evidence.ilhamraduan-bis.workers.dev/.well-known/x402',
 marketplace:'https://payapi.market/api/toyol-csv-evidence-data-quality-audit'
});
const CLEAN=x=>String(x??'').replace(/[\x00-\x1f\x7f]/g,' ').slice(0,180);
const AGE_MS=24*60*60*1000;
export function classifyRequest(item,now=Date.now()){
 if(!item||item.pull_request||item.state!=='open')return null;
 const created=Date.parse(item.created_at),updated=Date.parse(item.updated_at);
 if(!Number.isFinite(created)||!Number.isFinite(updated)||updated>now+AGE_MS||now-updated>120*AGE_MS)return null;
 const text=String(item.title??'')+' '+String(item.body??'').slice(0,3500);
 if(!/\bcsv\b/i.test(text))return null;
 if(!/(validat|quality|duplicate|missing field|missing value|schema|data clean|consisten|import error|audit)/i.test(text))return null;
 if(/(?:password|secret|keypair|medical|patient|surveillance|scrap(?:e|ing) private|student record|private data)/i.test(text))return null;
 if(/^\[(?:solved|closed|done)\]/i.test(item.title??''))return null;
 const comments=Number(item.comments)||0;
 const grade=Math.max(0,20-Math.floor((now-updated)/AGE_MS)/8)+(comments<=5?6:0)+(created>=now-30*AGE_MS?6:0);
 return {title:CLEAN(item.title),url:item.html_url,repo:item.repository_url?.split('/').slice(-2).join('/')??null,
  updated:item.updated_at,score:grade,stage:'PUBLIC_NEED_NOT_CONFIRMED_BUYER',
  paymentCommitted:false,outreachSent:false,fit:'POSSIBLE_CSV_VALIDATION_NEED'};
}
async function get(url,asJson=true,token){
 const u=new URL(url);
 if(u.protocol!=='https:')throw Error('HTTPS_REQUIRED');
 const headers={Accept:asJson?'application/json':'text/html', 'User-Agent':'ToyolCSVOrganicGrowth/1'};
 if(token&&u.hostname==='api.github.com')headers.Authorization='Bearer '+token;
 const r=await fetch(url,{headers,redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('HTTP_'+r.status);
 const raw=await r.text();
 if(raw.length>1200000)throw Error('SOURCE_TOO_LARGE');
 return asJson?JSON.parse(raw):raw;
}
export async function generateDemos(){
 const scenarios=[
  {id:'duplicate-import-key',question:'Why were rows duplicated on import?',csv:'id,name\nA1,Ada\nA1,Amin\n',options:{unique:['id']},expected:'DUPLICATE_VALUE'},
  {id:'missing-required',question:'Which rows are missing a required value?',csv:'id,email\n01,\n02,user@example.test\n',options:{required:['email']},expected:'MISSING_REQUIRED'},
  {id:'broken-row-width',question:'Which record has too few CSV fields?',csv:'sku,qty\nA1,2\nB2\n',options:{},expected:'ROW_WIDTH'}
 ];
 const demos=[];
 for(const s of scenarios){
  const result=await auditCsv(s.csv,s.options);
  if((result.counts[s.expected]??0)<1||result.pass||!result.sha256)throw Error('DEMO_VALIDATION_FAILED_'+s.id);
  demos.push({id:s.id,question:s.question,input:s.csv,rules:s.options,verifiedByLocalEngine:true,
   result:{schema:result.schema,pass:result.pass,records:result.records,columns:result.columns,
    totalFindings:result.totalFindings,counts:result.counts,findings:result.findings,sha256:result.sha256}});
 }
 return demos;
}
async function collectPublicNeeds(){
 const token=process.env.GH_TOKEN;
 if(!token)return {leads:[],sourceErrors:['NO_GITHUB_API_TOKEN']};
 const cutoff=new Date(Date.now()-90*AGE_MS).toISOString().slice(0,10);
 const queries=[
  'is:issue is:open "CSV" "validation" in:title,body updated:>='+cutoff,
  'is:issue is:open "CSV" "duplicate" in:title,body updated:>='+cutoff,
  'is:issue is:open "CSV" "data quality" in:title,body updated:>='+cutoff
 ];
 const matches=[],sourceErrors=[];
 for(const q of queries){
  try{
   const j=await get('https://api.github.com/search/issues?'+new URLSearchParams({q,per_page:'20',sort:'updated',order:'desc'}),true,token);
   if(!Array.isArray(j.items))throw Error('SEARCH_SCHEMA');
   for(const issue of j.items){const lead=classifyRequest(issue);if(lead&&/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/.test(lead.url))matches.push(lead);}
  }catch(e){sourceErrors.push(String(e.message).slice(0,95));}
 }
 const byUrl=new Map();
 for(const lead of matches)if(!byUrl.has(lead.url))byUrl.set(lead.url,lead);
 return {leads:[...byUrl.values()].sort((a,b)=>b.score-a.score).slice(0,10),sourceErrors,searchQueries:queries.length};
}
async function checkPublishedService(){
 const rows={};
 for(const [kind,url] of Object.entries(URLS)){
  try{
   const j=await get(url,kind!=='marketplace');
   const ok=kind==='health'?j.ok===true:
    kind==='sample'?j.result?.schema==='toyol.csv-evidence.v1':
    kind==='openapi'?j.info?.title==='Toyol CSV Evidence':
    kind==='manifest'?Array.isArray(j.tools)&&j.tools.some(x=>x.name==='csv_audit'):
    /Toyol CSV Evidence/.test(j);
   rows[kind]={reachable:true,contractCheckPassed:ok};
  }catch(e){rows[kind]={reachable:false,contractCheckPassed:false,error:String(e.message).slice(0,95)};}
 }
 return rows;
}
export async function runGrowth(){
 const demos=await generateDemos();
 const [health,demand]=await Promise.all([checkPublishedService(),collectPublicNeeds()]);
 const report={
  recordedAt:new Date().toISOString(),assignedClone:'aggregator',mission:'CSV_CUSTOMER_ACQUISITION',
  product:'Toyol CSV Evidence',pricePerRequestUsdc:'0.01',
  freeTrial:URLS.sample,buyUrl:URLS.marketplace,skillUrl:'https://github.com/ilhamraduanbis-source/toyol-digital/blob/main/skills/csv-evidence/SKILL.md',
  endpoints:health,verifiedSyntheticDemos:demos,publicNeeds:demand,
  nextMarketingAction:'USE_PUBLIC_INBOUND_ISSUE_TEMPLATE_OR_VERIFIED_MARKETPLACE_DISCOVERY_NOT_UNSOLICITED_SPAM',
  submittedBids:0,uninvitedMessagesSent:0,ownerSpendUsd:0,
  paymentsCheckedByThisJob:false,newRevenueClaimedUsd:0,
  caution:'Issues are unmet-needs signals, not customer purchase orders. Public sample and listing are product evidence, not new sales.'
 };
 mkdirSync('out/sales',{recursive:true});writeFileSync('out/sales/csv-growth.json',JSON.stringify(report,null,2)+'\n');
 console.log('TOYOL_CSV_GROWTH '+JSON.stringify({clone:report.assignedClone,
  endpointsReady:Object.values(health).filter(x=>x.contractCheckPassed).length,
  demos:demos.length,publicNeeds:demand.leads.length,sourceErrors:demand.sourceErrors.length,
  externalMessages:0,newRevenueClaimedUsd:0,ownerSpendUsd:0}));
 for(const x of demand.leads)console.log('PUBLIC_CSV_NEED '+JSON.stringify(x));
 return report;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])runGrowth().catch(e=>{console.error('TOYOL_CSV_GROWTH_FAILED '+String(e.message));process.exitCode=1;});
