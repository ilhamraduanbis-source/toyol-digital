import {auditResponse} from './audit.mjs';
import {checkDelivery} from './delivery.mjs';
export const MAX_REQUEST_BYTES=196608;
// Fetch-compatible handler; no remote fetch, persistence, or payment.
export async function handleRequest(request) {
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
  const path=new URL(request.url).pathname;
  if(!['/v1/audit','/v1/delivery'].includes(path))return reply(404,{error:'NOT_FOUND'});
  if(request.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
  if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return reply(415,{error:'JSON_REQUIRED'});
  const length=request.headers.get('content-length');
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>MAX_REQUEST_BYTES))return reply(413,{error:'REQUEST_TOO_LARGE'});
  if(!request.body)return reply(400,{error:'INVALID_INPUT'});
  const reader=request.body.getReader();const chunks=[];let size=0;
  try{
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_REQUEST_BYTES){await reader.cancel().catch(()=>{});return reply(413,{error:'REQUEST_TOO_LARGE'});}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    const input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    const result=path==='/v1/audit'?auditResponse(input):checkDelivery(input);
    return reply(200,result);
  }catch(e){return reply(400,{error:'INVALID_INPUT'});}finally{reader.releaseLock();}
}
export default {fetch:handleRequest};
