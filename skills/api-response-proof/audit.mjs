export function auditResponse(input) {
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const record=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
  const types=new Set(["object","array","string","number","integer","boolean","null"]);
  if(!record(input)||Object.keys(input).some(k=>!["status","body","contract"].includes(k))||!Number.isInteger(input.status)||input.status<100||input.status>599||!own(input,"body")||!record(input.contract))throw new TypeError("Invalid input");
  const {status,body,contract}=input;
  if(Object.keys(contract).some(k=>!["status","fields"].includes(k))||!Number.isInteger(contract.status)||contract.status<100||contract.status>599||!Array.isArray(contract.fields)||contract.fields.length>64)throw new TypeError("Invalid contract");
  const stack=[[body,0]];let nodes=0;let roughSize=0;
  while(stack.length){const [v,depth]=stack.pop();if(++nodes>20000||depth>32)throw new TypeError("Body complexity exceeds limit");if(typeof v==="string"){roughSize+=v.length;if(roughSize>131072)throw new TypeError("Body exceeds limit");continue;}if(v===null||typeof v==="boolean"||(typeof v==="number"&&Number.isFinite(v)))continue;if(Array.isArray(v)||record(v)){for(const k of Object.keys(v)){roughSize+=k.length;if(roughSize>131072)throw new TypeError("Body exceeds limit");stack.push([v[k],depth+1]);}continue;}throw new TypeError("Non-JSON value");}
  const serialized=JSON.stringify(body);
  if(typeof serialized!=="string")throw new TypeError("Body is not JSON");
  let bytes=0;for(const ch of serialized){const cp=ch.codePointAt(0);bytes+=cp<=127?1:cp<=2047?2:cp<=65535?3:4;if(bytes>131072)throw new TypeError("Body exceeds limit");}
  const issues=[];let checked=0;const seen=new Set();
  if(status!==contract.status)issues.push({code:"STATUS_MISMATCH",expected:contract.status,actual:status});
  for(const f of contract.fields){
    if(!record(f)||Object.keys(f).some(k=>!["pointer","type","required"].includes(k))||typeof f.pointer!=="string"||f.pointer.length>512||(!f.pointer.startsWith("/")&&f.pointer!=="")||/~(?![01])/u.test(f.pointer)||!types.has(f.type)||(own(f,"required")&&typeof f.required!=="boolean")||seen.has(f.pointer))throw new TypeError("Invalid field rule");
    seen.add(f.pointer); const parts=f.pointer===""?[]:f.pointer.slice(1).split("/").map(x=>x.replace(/~1/g,"/").replace(/~0/g,"~"));if(parts.length>32)throw new TypeError("Pointer too deep");
    let v=body,found=true;for(const p of parts){if(v===null||typeof v!=="object"||(Array.isArray(v)&&(!/^(0|[1-9][0-9]*)$/.test(p)||Number(p)>=v.length))||!own(v,p)){found=false;break;}v=v[p];}
    checked++;
    if(!found){if(f.required!==false)issues.push({code:"MISSING_FIELD",pointer:f.pointer});continue;}
    const actual=v===null?"null":Array.isArray(v)?"array":typeof v;
    const match=f.type==="integer"?Number.isInteger(v):actual===f.type;
    if(!match)issues.push({code:"TYPE_MISMATCH",pointer:f.pointer,expected:f.type,actual});
  }
  return {schema:"toyol.api-response-proof.v1",pass:issues.length===0,checked,issueCount:issues.length,issues};
}
