// Local, deterministic search over library records. No network or mutation.
const norm=x=>String(x??'').normalize('NFKC').toLocaleLowerCase('en-US');
const array=x=>Array.isArray(x)?x:[];
function fields(item){
 return [item.title,item.body,...array(item.tags),...array(item.collections),
  item.source_url,item.source_title,item.source_author,item.source_attribution,item.author,
  typeof item.source==='string'?item.source:undefined,
  ...(item.source&&typeof item.source==='object'?Object.values(item.source).filter(x=>typeof x==='string'):[])
 ].filter(x=>typeof x==='string'&&x.length);
}
function context(value,query){
 if(!query)return value.slice(0,200);
 // Unicode normalization can change positions. Find exact lower-case match first.
 let i=value.toLocaleLowerCase('en-US').indexOf(query.toLocaleLowerCase('en-US'));
 if(i<0){const v=value.normalize('NFKC');i=norm(v).indexOf(norm(query));value=v;}
 if(i<0)return value.slice(0,200);
 const start=Math.max(0,i-75),end=Math.min(value.length,i+query.length+105);
 return (start?'…':'')+value.slice(start,end)+(end<value.length?'…':'');
}
export function searchItems(records,query='',filters={}){
 if(!Array.isArray(records))throw new TypeError('INVALID_RECORDS');
 const q=norm(query).trim(),raw=String(query??'').trim();
 const out=[];
 for(const record of records){
  const i=record?.item;
  if(!i||typeof i.id!=='string')continue;
  if(filters.type&&norm(i.type)!==norm(filters.type))continue;
  if(filters.tag&&!array(i.tags).some(t=>norm(t)===norm(filters.tag)))continue;
  if(filters.collection&&!array(i.collections).some(t=>norm(t)===norm(filters.collection)))continue;
  const f=fields(i),matched=q?f.find(v=>norm(v).includes(q)):undefined;
  if(q&&matched===undefined)continue;
  out.push({id:i.id,title:i.title??'',type:i.type??'',snippet:context(matched??i.body??i.title??'',raw),tags:[...array(i.tags)],collections:[...array(i.collections)]});
 }
 return out;
}
