.
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
  const options={
   hostname: ip,
   port: url.port || (url.protocol==='https:'?443:80),
   path: url.pathname + url.search,
   headers: {
    'Host': url.hostname,
    'User-Agent': 'ToyolPaidTasks/1.0 (+https://github.com/toyol/paid-tasks)'
   },
   method:'GET',
   agent: false,
   autoSelectFamily: false
  };
  if(url.protocol==='https:'){
   options.servername = url.hostname;
  }
  const req=client.request(options,(res)=>{
   let data=[];
   let length=0;
   res.on('data',(chunk)=>{
    length+=chunk.length;
    if(length>MAX_HTML){
     req.destroy(failure('too_large','Response exceeded size limit'));
     return;
    }
    data.push(chunk);
   });
   res.on('end',()=>{
    if(res.statusCode<200||res.statusCode>=300){
     reject(failure('http_error',`HTTP Status ${res.statusCode}`));
     return;
    }
    resolve(Buffer.concat(data).toString('utf8'));
   });
  });
  req.on('error',reject);
  req.end();
 });
}

export async function captureArticle(rawUrl, resolveHost=defaultResolve) {
 const {url,ip}=await resolved(rawUrl,resolveHost);
 const content=await pinnedFetch(url,ip);
 return {
  id: randomUUID(),
  type: 'article',
  url: url.href,
  content,
  createdAt: new Date().toISOString()
 };
}