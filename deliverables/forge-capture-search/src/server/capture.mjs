// Hobby Hub capture candidate. Local-only attachments, bounded public HTTP fetches.
import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { spawn } from 'node:child_process';

const MAX_HTML=2*1024*1024, MAX_FILE=32*1024*1024, MAX_TEXT=1024*1024;
const TYPES=new Set(['note','article','quote','image','pdf','video','project']);
const failure=(code,msg=code)=>Object.assign(new Error(msg),{code});
function requireText(value, fallback='') {
 if(value===undefined||value===null)return fallback;
 if(typeof value!=='string')throw failure('invalid_input','Expected text');
 return value;
}
function strings(value){
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.some(x=>typeof x!=='string'))throw failure('invalid_input','Expected string array');
 return [...value];
}
function publicIP(addr){
 const v=isIP(addr);
 if(v===4){
  const [a,b,c]=addr.split('.').map(Number);
  return !(a===0||a===10||a===127||a>=224||
   (a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||
   (a===192&&(b===168||b===0||(b===88&&c===99)))||
   (a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113));
 }
 if(v===6){
  const a=addr.toLowerCase();
  const first=parseInt(a.split(':')[0],16), second=parseInt(a.split(':')[1]||'0',16);
  // Allow global unicast only, excluding transition and special documentation ranges.
  return first>=0x2000&&first<=0x3fff&&!(first===0x2001&&(second<0x200||second===0xdb8))&&
   first!==0x2002&&first!==0x3fff;
 }
 return false;
}
function target(raw){
 if(typeof raw!=='string'||!raw.trim())throw failure('unsafe_url');
 let url;
 try{url=new URL(raw);}catch{throw failure('unsafe_url','Invalid article URL');}
 const host=url.hostname.replace(/^\[|\]$/g,'').replace(/\.$/,'').toLowerCase();
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||
  !host||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal')||
  (!isIP(host)&&!host.includes('.'))||(isIP(host)&&!publicIP(host)))
  throw failure('unsafe_url','Only public HTTP(S) article targets are allowed');
 return {url,host};
}
async function resolved(raw,resolveHost){
 const {url,host}=target(raw);
 let values;
 if(isIP(host))values=[host];
 else {
  try{values=await resolveHost(host);}catch{throw failure('dns_unavailable','Article hostname could not be resolved');}
 }
 if(!Array.isArray(values)||!values.length)throw failure('dns_unavailable');
 const ips=values.map(x=>typeof x==='string'?x:x?.address);
 if(ips.some(x=>!publicIP(x)))throw failure('unsafe_url','Article DNS resolved to a nonpublic address');
 return {url,ip:ips[0]};
}
const defaultResolve=host=>lookup(host,{all:true,verbatim:true});
// Native HTTP(S) pins the validated DNS address to the actual connection.
// This avoids the DNS rebinding race of validating then using an unpinned fetch.
function pinnedFetch(url,ip){
 return new Promise((resolve,reject)=>{
  const client=url.protocol==='https:'?https:http;
  const req=client.request(url,{
   method:'GET',agent:false,autoSelectFamily:false,
   headers:{Accept:'text/html,application/xhtml+xml,text/plain','Accept-Encoding':'identity','User-Agent':'HobbyHub/1.0'},
   lookup:(_host,opts,cb)=>opts?.all?cb(null,[{address:ip,family:isIP(ip)}]):cb(null,ip,isIP(ip))
  },res=>{
   const chunks=[];let size=0;
   res.on('data',chunk=>{size+=chunk.length;if(size>MAX_HTML){req.destroy(failure('article_too_large'));return;}chunks.push(chunk);});
   res.on('error',reject);
   res.on('end',()=>{
    const headers=new Headers();
    for(const [k,v] of Object.entries(res.headers))if(typeof v==='string')headers.set(k,v);
    const body=Buffer.concat(chunks);
    resolve({status:res.statusCode,ok:res.statusCode>=200&&res.statusCode<300,headers,
     text:async()=>body.toString('utf8')});
   });
  });
  const timer=setTimeout(()=>req.destroy(failure('article_timeout')),10000);
  req.on('close',()=>clearTimeout(timer));
  req.on('error',reject);
  req.end();
 });
}
async function boundedText(response){
 const length=Number(response.headers?.get('content-length')??0);
 if(length>MAX_HTML)throw failure('article_too_large');
 if(response.body?.getReader){
  const reader=response.body.getReader(),chunks=[];let total=0;
  try{
   while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;
    if(total>MAX_HTML)throw failure('article_too_large');chunks.push(Buffer.from(value));}
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  return Buffer.concat(chunks).toString('utf8');
 }
 const text=await response.text();
 if(Buffer.byteLength(text)>MAX_HTML)throw failure('article_too_large');
 return text;
}
function decode(text){
 const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
 return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(all,key)=>{
  if(key.startsWith('#')){
   const n=key[1]?.toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));
   return Number.isInteger(n)&&n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):' ';
  }
  return entities[key.toLowerCase()]??all;
 });
}
// Extract plain text without creating a DOM or executing markup.
function strip(text){
 return decode(text.replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<(script|style|noscript|template|iframe|svg|object|head|nav|footer|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
  .replace(/<\/?(?:p|div|h[1-6]|li|br|section|article|main|blockquote|tr)\b[^>]*>/gi,'\n')
  .replace(/<[^>]*>/g,' '))
 .replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
function extract(html,contentType){
 if(contentType.includes('text/plain'))return {title:'',text:html.trim()};
 const title=strip(html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1]??'');
 const article=html.match(/<(article|main)\b[^>]*>([\s\S]*?)<\/\1\s*>/i)?.[2]??html;
 return {title,text:strip(article)};
}
async function article(raw,adapters){
 const resolver=adapters.resolveHost??defaultResolve;
 let dest;
 try{dest=await resolved(raw,resolver);}catch(e){if(e.code==='unsafe_url')throw e;return {warning:'Article DNS unavailable; link and annotation retained.'};}
 for(let i=0;i<6;i++){
  let r;
  try{
   r=adapters.fetchImpl?await adapters.fetchImpl(dest.url.href,{method:'GET',redirect:'manual',credentials:'omit',headers:{Accept:'text/html,application/xhtml+xml,text/plain'},signal:AbortSignal.timeout(10000)}):await pinnedFetch(dest.url,dest.ip);
  }catch{return {warning:'Article fetch failed; link and annotation retained.'};}
  if([301,302,303,307,308].includes(r.status)){
   const loc=r.headers?.get('location');
   if(!loc)return {warning:'Article redirect missing destination; link retained.'};
   // Revalidate every redirect, including DNS. Refuse unsafe destinations.
   try{dest=await resolved(new URL(loc,dest.url).href,resolver);}catch(e){if(e.code==='unsafe_url')throw e;return {warning:'Redirect could not be resolved; link retained.'};}
   continue;
  }
  if(!r.ok)return {warning:'Article unavailable (HTTP '+r.status+'); link retained.'};
  const contentType=(r.headers?.get('content-type')??'text/html').toLowerCase();
  if(!/^(text\/html|application\/xhtml\+xml|text\/plain)(;|$)/.test(contentType))return {warning:'Unsupported article media type; link retained.'};
  try{
   const out=extract(await boundedText(r),contentType);
   if(!out.text)return {warning:'No readable article text; link and annotation retained.'};
   return out;
  }catch{return {warning:'Article extraction failed; link and annotation retained.'};}
 }
 return {warning:'Article redirect limit reached; link retained.'};
}
function fileBytes(file){
 if(!file||typeof file.name!=='string'||!file.name.trim()||/[/\\\0]/.test(file.name)||file.name==='.'||file.name==='..'||file.name.startsWith('.'))throw failure('invalid_attachment_name');
 const b=file.bytes;
 if(!Buffer.isBuffer(b)&&!(b instanceof Uint8Array)&&!(b instanceof ArrayBuffer))throw failure('invalid_attachment_bytes');
 const bytes=Buffer.from(b);
 if(!bytes.length||bytes.length>MAX_FILE)throw failure('attachment_size');
 return {name:file.name,bytes,media_type:requireText(file.media_type,'application/octet-stream')};
}
// Optional local PDF extractor: Poppler pdftotext, no shell, no network, bounded output.
export async function extractLocalPdfText(bytes){
 return new Promise((resolve,reject)=>{
  const p=spawn('pdftotext',['-enc','UTF-8','-','-'],{stdio:['pipe','pipe','ignore']});
  let size=0;const chunks=[];let done=false;
  const finish=(err,text)=>{if(done)return;done=true;clearTimeout(timer);err?reject(err):resolve(text);};
  const timer=setTimeout(()=>{p.kill();finish(failure('pdf_timeout'));},10000);
  p.on('error',e=>finish(e));
  p.stdout.on('data',b=>{size+=b.length;if(size>MAX_TEXT){p.kill();finish(failure('pdf_text_too_large'));}else chunks.push(b);});
  p.stdin.on('error',e=>finish(e));
  p.on('close',code=>code===0?finish(null,Buffer.concat(chunks).toString('utf8').trim()):finish(failure('pdf_extraction_failed')));
  p.stdin.end(bytes);
 });
}
export async function capture(input,adapters={}){
 if(!input||typeof input!=='object'||!TYPES.has(input.type))throw failure('invalid_type');
 const type=input.type,body=requireText(input.body),url=requireText(input.url??input.source_url);
 const date=new Date().toISOString(),warnings=[];
 const suppliedTitle=requireText(input.title);
 let title=suppliedTitle.trim()||input.file?.name||url||type[0].toUpperCase()+type.slice(1);
 const item={id:randomUUID(),title,type,body,tags:strings(input.tags),collections:strings(input.collections),attachments:[],created_at:date,updated_at:date};
 if(url)item.source_url=url;
 for(const field of ['author','publication','source_author','source_title','source_attribution','why_saved','annotation'])if(typeof input[field]==='string')item[field]=input[field];
 if(input.timestamp_seconds!==undefined){
  if(typeof input.timestamp_seconds!=='number'||!Number.isFinite(input.timestamp_seconds)||input.timestamp_seconds<0)throw failure('invalid_timestamp');
  item.timestamp_seconds=input.timestamp_seconds;
 }
 let status='saved',attachment;
 if(type==='article'){
  const a=await article(url,adapters);
  if(a.warning){status='link-only';warnings.push(a.warning);}
  else {if(!suppliedTitle.trim()&&a.title)item.title=a.title;item.body=body?body+'\n\n'+a.text:a.text;}
 }
 if(type==='image'||type==='pdf'){
  attachment=fileBytes(input.file);
  item.source_filename=attachment.name;item.media_type=attachment.media_type;
  if(type==='pdf'){
   try{
    const text=await (adapters.extractPdfText??extractLocalPdfText)(attachment.bytes);
    if(typeof text!=='string'||!text.trim())throw failure('pdf_no_text');
    item.body=body?body+'\n\n'+text:text;
   }catch{warnings.push('PDF kept locally; text extraction unavailable. Install Poppler pdftotext for supported text PDFs.');}
  }
 }
 return {item,status,warnings,...(attachment?{attachment}:{})};
}
