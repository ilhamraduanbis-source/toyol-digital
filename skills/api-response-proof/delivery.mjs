export function checkDelivery(input) {
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const obj=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
  const scalar=v=>v===null||typeof v==="boolean"||(typeof v==="number"&&Number.isFinite(v))||(typeof v==="string"&&v.length<=1024);
  if(!obj(input)||Object.keys(input).some(k=>!["status","body","policy"].includes(k))||!Number.isInteger(input.status)||input.status<100||input.status>599||!own(input,"body")||!obj(input.policy))throw new TypeError("Invalid delivery");
  const {status,body,policy}=input;
  if(Object.keys(policy).some(k=>!["status","checks"].includes(k))||!Number.isInteger(policy.status)||policy.status<200||policy.status>299||!Array.isArray(policy.checks)||policy.checks.length<1||policy.checks.length>64)throw new TypeError("Invalid policy");
  let nodes=0,size=0;const todo=[[body,0]];
  while(todo.length){const [v,d]=todo.pop();if(++nodes>20000||d>32)throw new TypeError("Body complexity");if(typeof v==="string"){size+=v.length;if(size>131072)throw new TypeError("Body size");continue;}if(v===null||typeof v==="boolean"||(typeof v==="number"&&Number.isFinite(v)))continue;if(!obj(v)&&!Array.isArray(v))throw new TypeError("Invalid JSON value");for(const k of Object.keys(v)){size+=k.length;if(size>131072)throw new TypeError("Body size");todo.push([v[k],d+1]);}}
  const s=JSON.stringify(body);let bytes=0;for(const c of s){const n=c.codePointAt(0);bytes+=n<=127?1:n<=2047?2:n<=65535?3:4;if(bytes>131072)throw new TypeError("Body size");}
  const findings=[];if(status!==policy.status)findings.push({code:"HTTP_STATUS_MISMATCH"});
  const seen=new Set();
  for(let i=0;i<policy.checks.length;i++){
    const r=policy.checks[i];
    if(!obj(r)||Object.keys(r).some(k=>!["pointer","op","value"].includes(k))||typeof r.pointer!=="string"||r.pointer.length>512||(!r.pointer.startsWith("/")&&r.pointer!=="")||/~(?![01])/u.test(r.pointer)||!["equals","nonempty","minItems"].includes(r.op)||seen.has(r.pointer+"\u0000"+r.op)||(r.op==="equals"&&(!own(r,"value")||!scalar(r.value)))||(r.op==="nonempty"&&own(r,"value"))||(r.op==="minItems"&&(!Number.isInteger(r.value)||r.value<1||r.value>20000)))throw new TypeError("Invalid assertion");
    seen.add(r.pointer+"\u0000"+r.op);
    const parts=r.pointer===""?[]:r.pointer.slice(1).split("/").map(x=>x.replace(/~1/g,"/").replace(/~0/g,"~"));if(parts.length>32)throw new TypeError("Pointer depth");
    let v=body,found=true;
    for(const p of parts){if(v===null||typeof v!=="object"||(Array.isArray(v)&&(!/^(0|[1-9][0-9]*)$/.test(p)||Number(p)>=v.length))||!own(v,p)){found=false;break;}v=v[p];}
    if(!found){findings.push({check:i,code:"MISSING_DELIVERABLE"});continue;}
    const pass=r.op==="equals"?v===r.value:r.op==="minItems"?Array.isArray(v)&&v.length>=r.value:typeof v==="string"?v.trim().length>0:Array.isArray(v)?v.length>0:obj(v)?Object.keys(v).length>0:false;
    if(!pass)findings.push({check:i,code:"DELIVERY_ASSERTION_FAILED"});
  }
  return {schema:"toyol.delivery-evidence.v1",verdict:findings.length?"REVIEW":"PASS_DECLARED_CHECKS",checks:policy.checks.length+1,findings,scope:"Caller-supplied status and JSON against caller-defined rules; no authenticity or settlement verification"};
}
