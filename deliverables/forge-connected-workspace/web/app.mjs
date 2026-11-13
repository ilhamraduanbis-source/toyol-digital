// Local browser UI. Never inject captured HTML into the DOM.
const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const state={records:[],graph:{nodes:[],edges:[],unresolved:[]},page:'home',editing:null,view:'cards'};
const pages=['home','library','projects','graph','editor'];
const status=s=>$('status').textContent=s;
const csv=s=>String(s??'').split(',').map(x=>x.trim()).filter(Boolean);
const byId=id=>state.records.find(r=>r.item.id===id);
async function api(path,body){
 const r=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),credentials:'omit'});
 if(!r.ok){const e=new Error('Request failed ('+r.status+')');e.status=r.status;throw e;}
 return r.json();
}
function guarded(fn){return async e=>{e?.preventDefault();try{await fn(e);}catch(err){status(err.status===409?'Conflict: your draft remains here. Reload the item before merging changes.':String(err.message??err));}};}
function button(text,fn){const b=el('button',text);b.type='button';b.addEventListener('click',guarded(fn));return b;}
function show(page){
 state.page=page;
 for(const p of pages)$(p).hidden=p!==page;
 for(const b of document.querySelectorAll('[data-page]')){if(b.dataset.page===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
 if(page==='graph')renderGraph();
 $('main').focus();
}
function empty(target,msg){target.replaceChildren(el('p',msg,'quiet'));}
function safeAttachment(p){return typeof p==='string'&&/^attachments\/[^/\\]+$/.test(p)&&!p.includes('..')?'/'+p.split('/').map(encodeURIComponent).join('/'):null;}
function card(record,snippet){
 const i=record.item,c=el('article',undefined,'item');
 if(i.type==='image'&&safeAttachment(i.attachments?.[0])){const img=el('img');img.src=safeAttachment(i.attachments[0]);img.alt=i.title;img.loading='lazy';c.append(img);}
 c.append(el('div',i.type,'kind'));
 const h=el('h3');h.append(button(i.title||'Untitled',()=>openItem(i.id)));c.append(h);
 c.append(el('p',String(snippet??i.body??'').slice(0,180)));
 if(i.tags?.length)c.append(el('p',i.tags.join(' · '),'quiet'));
 return c;
}
function cards(id,records,emptyMessage='Nothing here yet.'){
 const target=$(id);
 if(!records.length){empty(target,emptyMessage);return;}
 target.replaceChildren(...records.map(r=>card(r,r.snippet)));
}
function refreshViews(){
 const sorted=[...state.records].sort((a,b)=>String(b.item.created_at??'').localeCompare(String(a.item.created_at??''))||String(a.item.id).localeCompare(String(b.item.id)));
 cards('recent',sorted.slice(0,5));
 cards('interests',sorted.filter(r=>r.item.type==='project'||r.item.tags?.length).slice(0,5));
 cards('rediscover',sorted.slice(-3).reverse());
 cards('project-list',sorted.filter(r=>r.item.type==='project'),'Create a project note to begin.');
 cards('results',sorted);
 const sel=$('focus-select'),prev=sel.value;
 sel.replaceChildren(...state.graph.nodes.map(n=>{const o=el('option',n.title);o.value=n.id;return o;}));
 if(state.graph.nodes.some(n=>n.id===prev))sel.value=prev;
 renderGraph();
}
async function reload(){
 const [list,g]=await Promise.all([api('items'),api('graph')]);
 if(!Array.isArray(list.items)||!Array.isArray(g.nodes)||!Array.isArray(g.edges))throw Error('Unexpected library response');
 state.records=list.items;state.graph=g;refreshViews();
}
async function search(){
 const f=new FormData($('search-form')),q=new URLSearchParams();
 for(const [k,v] of f)if(v)q.set(k,String(v));
 const data=await api('search?'+q);
 const rows=(data.results??[]).map(x=>{const r=byId(x.id);return r?{...r,snippet:x.snippet}:null;}).filter(Boolean);
 cards('results',rows,'No matching items.');status(rows.length+' matching items.');
}
function inline(parent,text){
 // Minimal safe preview: text, wiki references and local/external Markdown links.
 const re=/\[\[([^\]\n]+)\]\]|\[([^\]\n]+)\]\(([^)\n]+)\)/g;let last=0;
 for(const m of text.matchAll(re)){
  parent.append(document.createTextNode(text.slice(last,m.index)));
  if(m[1]){
   const [target,label]=m[1].split('|'),title=target.split('#')[0];
   const matches=state.records.filter(r=>r.item.title.toLowerCase()===title.toLowerCase());
   if(matches.length===1)parent.append(button(label??title,()=>openItem(matches[0].item.id)));else parent.append(el('span',label??target+' (unresolved)'));
  }else{
   let url;try{url=new URL(m[3]);}catch{}
   if(url&&['https:','http:'].includes(url.protocol)&&!url.username&&!url.password){const a=el('a',m[2]);a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';parent.append(a);}
   else parent.append(document.createTextNode(m[2]+' ('+m[3]+')'));
  }
  last=m.index+m[0].length;
 }
 parent.append(document.createTextNode(text.slice(last)));
}
function preview(){
 const body=$('edit-form').elements.body.value,target=$('preview');target.replaceChildren();
 let list=null;
 for(const line of body.split('\n')){
  const heading=/^(#{1,6})\s+(.*)$/.exec(line),check=/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/.exec(line),bullet=/^\s*[-*]\s+(.*)$/.exec(line);
  if(check||bullet){if(!list){list=el('ul');target.append(list);}const item=el('li');if(check){const c=el('input');c.type='checkbox';c.checked=check[1].toLowerCase()==='x';c.disabled=true;c.style.width='auto';c.setAttribute('aria-label','Checklist item');item.append(c,document.createTextNode(' '));inline(item,check[2]);}else inline(item,bullet[1]);list.append(item);continue;}
  list=null;const p=el(heading?'h'+Math.min(6,heading[1].length+1):'p');inline(p,heading?heading[2]:line);target.append(p);
 }
}
function links(id,ids){
 const node=$(id),unique=[...new Set(ids)];node.replaceChildren();
 if(!unique.length){node.append(el('li','None yet.'));return;}
 for(const itemId of unique){const r=byId(itemId);if(r){const li=el('li');li.append(button(r.item.title,()=>openItem(itemId)));node.append(li);}}
}
async function openItem(id){
 const draft=await api('items/'+encodeURIComponent(id));const r=draft.record??draft;
 if(!r.item||r.item.id!==id||typeof r.revision!=='string')throw Error('Item revision missing');
 state.editing=r;const f=$('edit-form');f.elements.title.value=r.item.title;f.elements.body.value=r.item.body??'';f.elements.tags.value=(r.item.tags??[]).join(', ');f.elements.collections.value=(r.item.collections??[]).join(', ');
 $('editor-heading').textContent=r.item.title;preview();links('backlinks',state.graph.edges.filter(e=>e.target===id).map(e=>e.source));links('related',state.graph.edges.filter(e=>e.source===id).map(e=>e.target));show('editor');
}
function renderGraph(){
 const id=$('focus-select').value,root=$('graph-view');root.replaceChildren();
 const selected=state.graph.nodes.find(n=>n.id===id);
 if(!selected){root.append(el('p','No connections yet.'));$('unresolved').replaceChildren();return;}
 const edges=state.graph.edges.filter(e=>e.source===id||e.target===id);
 const wrap=el('div',undefined,'graph-map'),center=button(selected.title,()=>openItem(id));center.className='focused';wrap.append(center);
 const ids=[...new Set(edges.map(e=>e.source===id?e.target:e.source))].filter(x=>x!==id);
 for(const n of state.graph.nodes.filter(n=>ids.includes(n.id))){wrap.append(el('span','↔'),button(n.title,()=>{$('focus-select').value=n.id;renderGraph();}));}
 root.append(wrap);
 const rel=el('ul');for(const e of edges){const a=state.graph.nodes.find(n=>n.id===e.source),b=state.graph.nodes.find(n=>n.id===e.target);rel.append(el('li',(a?.title??e.source)+' → '+(b?.title??e.target)));}root.append(rel);
 $('unresolved').replaceChildren(...(state.graph.unresolved??[]).map(x=>el('li',(byId(x.source)?.item.title??x.source)+': '+x.target+' ('+(x.reason??'unresolved')+')')));
}
function capturePanel(type){const panel=$('capture-panel');panel.hidden=false;if(type)$('capture-form').elements.type.value=type;$('capture-form').elements.title.focus();}
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.page)));
$('capture-toggle').addEventListener('click',()=>{$('capture-panel').hidden?capturePanel():$('capture-panel').hidden=true;});
$('new-project').addEventListener('click',()=>capturePanel('project'));
$('back').addEventListener('click',()=>show('library'));
$('focus-select').addEventListener('change',renderGraph);
$('edit-form').elements.body.addEventListener('input',preview);
$('search-form').addEventListener('submit',guarded(search));
for(const mode of ['cards','list'])$(mode+'-toggle').addEventListener('click',()=>{
 state.view=mode;$('results').className=mode;$('cards-toggle').setAttribute('aria-pressed',String(mode==='cards'));$('list-toggle').setAttribute('aria-pressed',String(mode==='list'));
});
$('capture-form').addEventListener('submit',guarded(async()=>{
 const f=$('capture-form'),v=new FormData(f),input={type:v.get('type'),title:v.get('title'),body:v.get('body'),tags:csv(v.get('tags')),collections:csv(v.get('collections'))};
 if(v.get('url'))input.url=v.get('url');if(v.get('timestamp_seconds')!=='')input.timestamp_seconds=Number(v.get('timestamp_seconds'));
 const file=v.get('file');
 if(file?.size){if(file.size>32*1024*1024)throw Error('Attachment exceeds 32 MB');const bytes=new Uint8Array(await file.arrayBuffer());input.file={name:file.name,bytes:Array.from(bytes),media_type:file.type||'application/octet-stream'};}
 const res=await api('capture',input);f.reset();$('capture-panel').hidden=true;await reload();status(res.status==='link-only'?'Link saved; offline article text unavailable.':'Saved to your local library.');if(res.warnings?.length)status($('status').textContent+' '+res.warnings.join(' '));
}));
$('edit-form').addEventListener('submit',guarded(async()=>{
 const r=state.editing;if(!r)throw Error('No item selected');const f=$('edit-form'),v=new FormData(f);
 const item={...r.item,title:String(v.get('title')),body:String(v.get('body')),tags:csv(v.get('tags')),collections:csv(v.get('collections')),updated_at:new Date().toISOString()};
 const result=await api('items',{item,expectedRevision:r.revision});const updated=result.record??result;if(!updated.item||!updated.revision)throw Error('Saved revision not returned');
 state.editing=updated;await reload();await openItem(item.id);status('Changes saved.');
}));
reload().then(()=>show('home')).catch(e=>status('Library unavailable: '+e.message));
