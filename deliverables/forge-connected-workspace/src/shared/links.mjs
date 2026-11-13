// Resolve local Markdown/wiki links without guessing ambiguous matches.
import path from 'node:path';
const norm=s=>String(s??'').normalize('NFKC').trim().toLowerCase();
const stem=s=>String(s??'').replace(/\.md$/i,'');
const cleanPath=s=>path.posix.normalize(s.replace(/\\/g,'/')).replace(/^\.\//,'');
function add(map,key,id){if(!key)return;const set=map.get(key)??new Set();set.add(id);map.set(key,set);}
function targets(body){
 const out=[];
 // Ignore fenced and inline code: references in examples are not relationships.
 const text=String(body??'').replace(/^\s*(?:\x60{3,}|~{3,})[\s\S]*?^\s*(?:\x60{3,}|~{3,})[^\n]*/gm,'').replace(/\x60[^\x60\n]*\x60/g,'');
 const re=/\[\[([^\]\n]+)\]\]|(?<!!)\[[^\]\n]*\]\(([^)\n]+)\)/g;
 for(const m of text.matchAll(re)){
  if(m[1]){const raw=m[1].split('|')[0].trim();out.push({kind:'wiki',raw,target:raw.split('#')[0].trim()});}
  else{
   let raw=m[2].trim().replace(/^<([^>]+)>.*$/,'$1').replace(/\s+["'][\s\S]*["']$/,'');
   if(/^[a-z][a-z0-9+.-]*:|^\/|^#|^\/\//i.test(raw))continue;
   try{raw=decodeURIComponent(raw);}catch{}
   const target=raw.split('#')[0];if(/\.md$/i.test(target))out.push({kind:'relative',raw:target,target});
  }
 }
 return out;
}
export function buildGraph(records){
 if(!Array.isArray(records))throw new TypeError('Expected records');
 const nodes=[],edges=[],unresolved=[],titles=new Map(),paths=new Map(),seen=new Set(),unseen=new Set(),valid=[];
 for(const r of records){
  const i=r?.item;if(!i||typeof i.id!=='string'||seen.has(i.id))continue;
  seen.add(i.id);valid.push(r);nodes.push({id:i.id,title:String(i.title??''),type:i.type??'note'});
  add(titles,norm(i.title),i.id);
  if(typeof r.path==='string'){const p=cleanPath(r.path);add(paths,norm(stem(p)),i.id);}
 }
 const edgeKeys=new Set();
 for(const r of valid)for(const t of targets(r.item.body)){
  if(!t.target)continue;
  let candidates;
  if(t.kind==='relative'){
   const p=cleanPath(path.posix.join(path.posix.dirname(r.path??''),t.target));
   candidates=paths.get(norm(stem(p)));
  }else if(t.target.includes('/')||/\.md$/i.test(t.target)){
   const p=cleanPath(t.target);candidates=paths.get(norm(stem(p)));
   if(!candidates&&t.target.startsWith('.'))candidates=paths.get(norm(stem(cleanPath(path.posix.join(path.posix.dirname(r.path??''),t.target)))));
  }else candidates=titles.get(norm(t.target));
  const ids=[...(candidates??[])];
  if(ids.length!==1){
   const key=JSON.stringify([r.item.id,t.raw]);
   if(!unseen.has(key)){unseen.add(key);unresolved.push({source:r.item.id,target:t.raw,reason:ids.length?'ambiguous':'missing'});}
   continue;
  }
  const key=JSON.stringify([r.item.id,ids[0]]);
  if(!edgeKeys.has(key)){edgeKeys.add(key);edges.push({source:r.item.id,target:ids[0]});}
 }
 return {nodes,edges,unresolved};
}
export function neighborhood(graph,id,depth=1){
 if(!Number.isSafeInteger(depth)||depth<0)throw new RangeError('Invalid depth');
 if(!graph.nodes.some(n=>n.id===id))return {nodes:[],edges:[],unresolved:[]};
 const included=new Set([id]);let frontier=[id];
 const adjacency=new Map();
 for(const e of graph.edges){for(const [a,b] of [[e.source,e.target],[e.target,e.source]]){const list=adjacency.get(a)??new Set();list.add(b);adjacency.set(a,list);}}
 for(let d=0;d<depth&&frontier.length;d++){const next=[];for(const a of frontier)for(const b of adjacency.get(a)??[]){if(!included.has(b)){included.add(b);next.push(b);}}frontier=next;}
 return {nodes:graph.nodes.filter(n=>included.has(n.id)),edges:graph.edges.filter(e=>included.has(e.source)&&included.has(e.target)),unresolved:(graph.unresolved??[]).filter(e=>included.has(e.source))};
}
