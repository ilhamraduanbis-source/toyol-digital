// Source-grounded OpenAPI 3.0 preparation skill. No network or secrets.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const methods = new Set(['get','put','post','delete','options','head','patch','trace']);
const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
const copy = x => JSON.parse(JSON.stringify(x));
const placeholders = path => [...path.matchAll(/\{([^{}]+)\}/g)].map(m => m[1]);

export function buildOpenApi(input) {
  requireThat(plain(input) && typeof input.title === 'string' && input.title.trim() && typeof input.version === 'string' && input.version.trim(), 'Explicit API title and version required');
  requireThat(Array.isArray(input.operations) && input.operations.length > 0, 'Explicit operation inventory required');
  const doc = {openapi:'3.0.3',info:{title:input.title,version:input.version},paths:Object.create(null)};
  const evidence = [];
  if (input.components !== undefined) {
    requireThat(plain(input.components),'Components must be an object');
    doc.components=copy(input.components);
  }
  if (input.servers !== undefined) {
    requireThat(Array.isArray(input.servers) && input.servers.every(x=>plain(x)&&typeof x.url==='string'&&x.url.trim()),'Explicit server URLs required');
    doc.servers=copy(input.servers);
  }
  const ids=new Set();
  for (const op of input.operations) {
    requireThat(plain(op) && typeof op.path==='string' && op.path.startsWith('/') && !/[?#]/.test(op.path),'Invalid operation path');
    requireThat(typeof op.method==='string' && methods.has(op.method.toLowerCase()),'Invalid HTTP method');
    const method=op.method.toLowerCase(), key=method+' '+op.path;
    requireThat(typeof op.source==='string' && op.source.trim(),'Missing source evidence for '+key);
    requireThat(typeof op.operationId==='string' && op.operationId.trim() && !ids.has(op.operationId),'Missing or duplicate operationId');
    ids.add(op.operationId);
    requireThat(plain(op.responses)&&Object.keys(op.responses).length>0,'Explicit responses required for '+key);
    for(const [status,response] of Object.entries(op.responses)){
      requireThat(/^(?:[1-5][0-9]{2}|[1-5]XX|default)$/.test(status)&&plain(response)&&typeof response.description==='string'&&response.description.trim(),'Invalid response '+status+' for '+key);
    }
    const params=op.parameters??[];
    requireThat(Array.isArray(params),'Parameters must be an array');
    const seen=new Set();
    for(const p of params){
      requireThat(plain(p)&&typeof p.name==='string'&&['path','query','header','cookie'].includes(p.in)&&plain(p.schema),'Explicit parameter name, location and schema required');
      const id=p.in+':'+(p.in==='header'?p.name.toLowerCase():p.name);
      requireThat(!seen.has(id),'Duplicate parameter '+id); seen.add(id);
      if(p.in==='path') requireThat(p.required===true && placeholders(op.path).includes(p.name),'Invalid path parameter '+p.name);
    }
    for(const name of placeholders(op.path)) requireThat(params.some(p=>p.in==='path'&&p.name===name&&p.required===true),'Missing path parameter '+name);
    const pathItem=doc.paths[op.path]??(doc.paths[op.path]={});
    requireThat(!Object.hasOwn(pathItem,method),'Duplicate operation '+key);
    const entry={operationId:op.operationId,responses:copy(op.responses)};
    for(const field of ['summary','description','tags','parameters','requestBody','security','deprecated']) if(op[field]!==undefined) entry[field]=copy(op[field]);
    pathItem[method]=entry;
    evidence.push({operation:key,source:op.source});
  }
  // Only resolve local references; never fetch remote schemas or execute input.
  function walk(value){
    if(Array.isArray(value)){value.forEach(walk);return;}
    if(!plain(value))return;
    if(Object.hasOwn(value,'$ref')){
      const ref=value.$ref;
      requireThat(typeof ref==='string'&&ref.startsWith('#/'),'Only explicit local references supported');
      let target=doc;
      for(const segment of ref.slice(2).split('/')){
        const k=segment.replace(/~1/g,'/').replace(/~0/g,'~');
        requireThat(target!==null&&typeof target==='object'&&Object.hasOwn(target,k),'Unresolved reference '+ref);
        target=target[k];
      }
    }
    Object.values(value).forEach(walk);
  }
  walk(doc);
  return {document:doc,evidence};
}
export function serializeYamlCompatible(document){
  // JSON is a YAML 1.2 subset. No unsupported syntax or invented operations.
  return JSON.stringify(document,null,2)+'\n';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const [, , input, output, evidenceOutput]=process.argv;
  requireThat(input&&output&&evidenceOutput,'Usage: node prepare.mjs inventory.json openapi.yaml evidence.json');
  const result=buildOpenApi(JSON.parse(readFileSync(input,'utf8')));
  writeFileSync(output,serializeYamlCompatible(result.document));
  writeFileSync(evidenceOutput,JSON.stringify(result.evidence,null,2)+'\n');
}
