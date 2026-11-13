import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {capture,extractLocalPdfText} from '../../src/server/capture.mjs';
import {searchItems} from '../../src/server/search.mjs';
const resolver=async()=>['93.184.216.34'];
function syntheticPdf(){
 const stream='BT /F1 14 Tf 40 100 Td (Toyol synthetic listening room) Tj ET\n';
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Length '+Buffer.byteLength(stream)+' >>\nstream\n'+stream+'endstream'
 ];
 let pdf='%PDF-1.4\n',offsets=[0];
 for(let i=0;i<objects.length;i++){
  offsets.push(Buffer.byteLength(pdf));pdf+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';
 }
 const start=Buffer.byteLength(pdf);
 pdf+='xref\n0 '+offsets.length+'\n0000000000 65535 f \n';
 for(const n of offsets.slice(1))pdf+=String(n).padStart(10,'0')+' 00000 n \n';
 pdf+='trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF\n';
 return Buffer.from(pdf);
}
test('rejects private DNS, mapped IPv6 and public-to-private redirects',async()=>{
 let calls=0;
 for(const ip of ['10.1.1.1','192.168.1.1','100.64.1.1','::ffff:127.0.0.1','2001:0db8::1','fe80::1']){
  await assert.rejects(capture({type:'article',url:'https://example.com/'},{resolveHost:async()=>[ip],fetchImpl:async()=>{calls++;return new Response('bad');}}));
 }
 assert.equal(calls,0);
 await assert.rejects(capture({type:'article',url:'https://example.com/'},{resolveHost:resolver,fetchImpl:async()=>{calls++;return new Response(null,{status:302,headers:{location:'http://127.0.0.1/'}});}}));
 assert.equal(calls,1);
});
test('redirect validates every hostname and preserves annotations',async()=>{
 const hosts=[],opts=[];
 const r=await capture({type:'article',url:'https://example.com/a',body:'My note',source_author:'Author'},
 {resolveHost:async host=>{hosts.push(host);return ['93.184.216.34'];},fetchImpl:async(url,options)=>{
 opts.push(options);return url.endsWith('/a')?new Response(null,{status:302,headers:{location:'https://example.org/b'}}):
 new Response('<article><p>Hello &amp; goodbye</p><script>alert(1)</script></article>',{headers:{'content-type':'text/html'}});
 }});
 assert.deepEqual(hosts,['example.com','example.org']);
 assert.ok(opts.every(o=>o.redirect==='manual'&&o.credentials==='omit'));
 assert.match(r.item.body,/My note/);assert.match(r.item.body,/Hello & goodbye/);assert.ok(!r.item.body.includes('alert(1)'));
 assert.equal(r.item.source_url,'https://example.com/a');assert.equal(r.item.source_author,'Author');
});
test('PDF original bytes retained even if extractor fails, names safe',async()=>{
 const bytes=syntheticPdf();
 const r=await capture({type:'pdf',file:{name:'example.pdf',bytes,media_type:'application/pdf'}},{extractPdfText:async()=>{throw Error('not available');}});
 assert.deepEqual(r.attachment.bytes,bytes);assert.ok(r.warnings.length);assert.equal(r.status,'saved');
 await assert.rejects(capture({type:'image',file:{name:'../a.png',bytes}}));
});
test('real optional Poppler extractor handles a synthetic PDF',async()=>{
 const check=spawnSync('pdftotext',['-v'],{encoding:'utf8'});
 if(check.error?.code==='ENOENT'){
  if(process.env.REQUIRE_PDF_EXTRACTOR==='1')throw Error('Poppler is required for this demonstration');
  return;
 }
 const bytes=syntheticPdf(),text=await extractLocalPdfText(bytes);
 assert.match(text,/Toyol synthetic listening room/);
 const r=await capture({type:'pdf',file:{name:'room.pdf',bytes,media_type:'application/pdf'}});
 assert.match(r.item.body,/Toyol synthetic listening room/);assert.deepEqual(r.attachment.bytes,bytes);
});
test('search includes source attribution and returns stable filtered snippets',()=>{
 const rows=[{item:{id:'a',title:'Room',type:'article',source_author:'Amina',body:'Local text',tags:['space'],collections:['one']}},{item:{id:'b',title:'Other',type:'note',body:'different'}}];
 const snapshot=JSON.stringify(rows);
 assert.equal(searchItems(rows,'amina')[0].id,'a');
 assert.match(searchItems(rows,'amina')[0].snippet,/Amina/);
 assert.equal(searchItems(rows,'',{tag:'SPACE',collection:'one'}).length,1);
 assert.equal(JSON.stringify(rows),snapshot);
});
