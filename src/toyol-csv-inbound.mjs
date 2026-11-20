/**
 * One-time response to an inbound GitHub Issue created by a prospective CSV buyer.
 * No unsolicited messages, no customer datasets, no wallet actions or payments.
 */
import {fileURLToPath} from 'node:url';
const REPO='ilhamraduanbis-source/toyol-digital';
export const SIGNATURE='<!-- toyol-csv-inbound-reply-v1 -->';
export function qualifies(issue){
 return Boolean(issue&&issue.state==='open'&&!issue.pull_request&&
  /^\[CSV Audit Inquiry\] /i.test(String(issue.title??''))&&
  String(issue.body??'').includes('[CSV_INQUIRY_V1]')&&
  (issue.user?.type??'User')!=='Bot');
}
export function compose(issue){
 if(!qualifies(issue))throw Error('NOT_CONSENTED_CUSTOMER_INQUIRY');
 const body=String(issue.body??'');
 const problem=/Duplicate keys or records/i.test(body)?'To find duplicated identifiers, pass the relevant CSV header in the unique array.':
  /Missing required fields/i.test(body)?'To locate missing fields, pass the CSV header names in the required array.':
  /Incorrect number of columns/i.test(body)?'The audit reports ROW_WIDTH findings when record field counts differ from the header.':
  /Duplicate or empty headers/i.test(body)?'The audit reports DUPLICATE_HEADER and EMPTY_HEADER findings.':
  'The public service handles CSV data-quality auditing and structured evidence. Custom features need a separate scope review.';
 return SIGNATURE+'\n'+
 'Thanks for outlining the CSV problem. '+problem+'\n\n'+
 '**First, try the free fixed example** at https://toyol-csv-evidence.ilhamraduan-bis.workers.dev/sample. '+
 'Check the API contract at https://toyol-csv-evidence.ilhamraduan-bis.workers.dev/openapi.json.\n\n'+
 'If the problem fits, the [Toyol CSV Evidence listing](https://payapi.market/api/toyol-csv-evidence-data-quality-audit) '+
 'offers a buyer-authorized x402 audit at **0.01 USDC per request on Base**. Inspect the HTTP 402 quote before any payment. '+
 'No purchase is necessary to ask a question.\n\n'+
 '**Privacy:** Please do not share a real dataset, secrets or personal information in this public issue. '+
 'For a different requirement, reply with a synthetic example and the expected findings. This automatic response is not a promise of a custom solution or a completed sale.';
}
async function api(path,method='GET',body){
 const token=process.env.GH_TOKEN;
 if(!token)throw Error('MISSING_WORKFLOW_TOKEN');
 const r=await fetch('https://api.github.com/repos/'+REPO+path,{
  method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',
   ...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(13000)
 });
 if(!r.ok)throw Error('GITHUB_'+method+'_HTTP_'+r.status);
 return r.json();
}
export async function respond(){
 if(process.env.GITHUB_REPOSITORY!==REPO||process.env.GITHUB_EVENT_NAME!=='issues'||process.env.TOYOL_ISSUE_ACTION!=='opened')throw Error('NOT_INBOUND_EVENT');
 const n=Number(process.env.TOYOL_ISSUE_NUMBER);
 if(!Number.isSafeInteger(n)||n<=0)throw Error('BAD_ISSUE_NUMBER');
 const meta=await api('');
 if(meta.private||meta.archived||meta.full_name!==REPO)throw Error('REPO_CONTEXT');
 const issue=await api('/issues/'+n);
 if(!qualifies(issue)){console.log('INBOUND_SKIPPED_NOT_OPTED_IN');return;}
 const previous=await api('/issues/'+n+'/comments?per_page=100');
 if(!Array.isArray(previous)||previous.length>=100)throw Error('CANNOT_VERIFY_IDEMPOTENCY');
 if(previous.some(x=>String(x.body??'').includes(SIGNATURE))){console.log('INBOUND_ALREADY_REPLIED');return;}
 await api('/issues/'+n+'/comments','POST',{body:compose(issue)});
 console.log('INBOUND_RESPONSE_POSTED '+JSON.stringify({issue:n,posted:true,spendUsd:0,orderClaimed:false,paidCustomerVerified:false}));
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])respond().catch(e=>{console.error('INBOUND_SAFE_STOP '+String(e.message));process.exitCode=1;});
