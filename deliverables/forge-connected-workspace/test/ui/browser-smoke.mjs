// Actual headless-browser exercise against a synthetic local API, not a release test.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {buildGraph} from '../../src/shared/links.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=new URL('../../web/',import.meta.url);
const stamp='2026-01-01T00:00:00Z';
const rec=(id,title,body,type='note')=>({item:{id,title,body,type,tags:['room'],collections:['hobby'],attachments:[],created_at:stamp,updated_at:stamp},path:'notes/'+id+'.md',revision:'rev-'+id});
const records=[rec('idea','Attention','[[Rooms]]'),rec('rooms','Rooms','Listening room acoustics','article'),rec('project','Corner','[[Attention]]\n- [ ] Rearrange chair','project')];
const json=(res,obj,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(obj));};
async function body(req){let s='';for await(const chunk of req)s+=chunk;return JSON.parse(s);}
const server=createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://127.0.0.1');
  if(req.method==='GET'&&u.pathname==='/api/items')return json(res,{items:records});
  if(req.method==='GET'&&u.pathname==='/api/graph')return json(res,buildGraph(records));
  if(req.method==='GET'&&u.pathname.startsWith('/api/items/'))return json(res,records.find(r=>r.item.id===u.pathname.split('/').at(-1))??{},records.some(r=>r.item.id===u.pathname.split('/').at(-1))?200:404);
  if(req.method==='GET'&&u.pathname==='/api/search'){
   const q=(u.searchParams.get('q')??'').toLowerCase(),tag=u.searchParams.get('tag');
   return json(res,{results:records.filter(r=>(!tag||r.item.tags.includes(tag))&&(r.item.title+' '+r.item.body).toLowerCase().includes(q)).map(r=>({id:r.item.id,snippet:r.item.body}))});
  }
  if(req.method==='POST'&&u.pathname==='/api/capture'){
   const b=await body(req);const r=rec('captured-'+records.length,b.title,b.body,b.type);r.item.tags=b.tags;r.item.collections=b.collections;
   if(b.timestamp_seconds!==undefined)r.item.timestamp_seconds=b.timestamp_seconds;
   if(b.url)r.item.source_url=b.url;
   records.push(r);return json(res,{...r,status:'saved',warnings:[]});
  }
  if(req.method==='POST'&&u.pathname==='/api/items'){
   const b=await body(req),i=records.findIndex(r=>r.item.id===b.item.id);
   if(i<0||records[i].revision!==b.expectedRevision)return json(res,{error:'conflict'},409);
   records[i]={...records[i],item:b.item,revision:'rev-new'};return json(res,records[i]);
  }
  const assets={'/':'index.html','/index.html':'index.html','/app.mjs':'app.mjs','/styles.css':'styles.css'};
  if(assets[u.pathname]){const f=assets[u.pathname];res.writeHead(200,{'Content-Type':f.endsWith('.mjs')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});return res.end(await readFile(new URL(f,root)));}
  res.writeHead(404);res.end();
 }catch(e){json(res,{error:e.message},500);}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1100,height:800}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.locator('#recent .item').first().waitFor();
 await page.getByRole('button',{name:'Library',exact:true}).click();
 await page.locator('#search-form input[name=q]').fill('acoustics');
 await page.locator('#search-form button').click();
 await page.waitForFunction(()=>document.querySelectorAll('#results .item').length===1&&document.querySelector('#results').textContent.includes('Rooms'));
 await page.locator('#list-toggle').click();assert.equal(await page.locator('#results').getAttribute('class'),'list');
 await page.locator('#results').getByRole('button',{name:'Rooms',exact:true}).click();
 await page.locator('#editor').waitFor({state:'visible'});
 await page.waitForFunction(()=>document.querySelector('#backlinks').textContent.includes('Attention'));
 await page.locator('#edit-form textarea').fill('Edited locally\n<script>alert(1)</script>\n[[Attention]]');
 assert.equal(await page.locator('#preview script').count(),0);
 await page.locator('#edit-form button').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent==='Changes saved.');
 assert.match(records.find(r=>r.item.id==='rooms').item.body,/Edited locally/);
 await page.getByRole('button',{name:'Connections',exact:true}).click();
 await page.locator('#focus-select').selectOption('rooms');assert.match(await page.locator('#graph-view').textContent(),/Attention/);
 await page.getByRole('button',{name:'Projects',exact:true}).click();
 await page.locator('#project-list').getByRole('button',{name:'Corner',exact:true}).click();
 await page.locator('#editor').waitFor({state:'visible'});assert.equal(await page.locator('#preview input[type=checkbox]').count(),1);
 await page.locator('#capture-toggle').click();
 await page.locator('#capture-form select[name=type]').selectOption('video');
 await page.locator('#capture-form input[name=title]').fill('Synthetic video');
 await page.locator('#capture-form input[name=url]').fill('https://example.com/watch');
 await page.locator('#capture-form input[name=timestamp_seconds]').fill('83');
 await page.locator('#capture-form button').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Saved to your local library'));
 assert.equal(records.at(-1).item.timestamp_seconds,83);
 await page.setViewportSize({width:375,height:812});
 await page.getByRole('button',{name:'Home',exact:true}).click();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 assert.deepEqual(errors,[]);
 console.log('BROWSER_PASS: search, list, editor, safe preview, backlinks, graph, project checklist, timestamp capture, responsive width');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
