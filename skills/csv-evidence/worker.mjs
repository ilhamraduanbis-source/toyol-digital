import { Hono } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { declareDiscoveryExtension, bazaarResourceServerExtension } from "@x402/extensions/bazaar";
import { auditCsv, MAX_BYTES } from "./audit.mjs";
const app = new Hono();
const PAY_TO="0xac57ad3c3f233e5865c3cd652f67ffc82a7af431";
const network="eip155:8453";
const description="Audit a supplied UTF-8 CSV for malformed records, duplicate headers and rows, missing required values and duplicate unique keys. Returns counts, record locations and SHA-256 input fingerprint; no external data or stored rows.";
const route={"POST /v1/csv/audit":{accepts:{scheme:"exact",price:"$0.01",network,payTo:PAY_TO},description,mimeType:"application/json",extensions:declareDiscoveryExtension({bodyType:"json",input:{csv:"id,name\n1,Ada\n",required:["name"],unique:["id"]},inputSchema:{properties:{csv:{type:"string",description:"UTF-8 CSV, maximum 128 KiB, header required"},required:{type:"array",items:{type:"string"}},unique:{type:"array",items:{type:"string"}}},required:["csv"]},output:{example:{schema:"toyol.csv-evidence.v1",records:1,columns:2,pass:true,totalFindings:0},schema:{type:"object",properties:{schema:{type:"string"},records:{type:"integer"},columns:{type:"integer"},pass:{type:"boolean"},totalFindings:{type:"integer"},sha256:{type:"string"},findings:{type:"array",items:{type:"object"}}}}}})}};
app.get("/",c=>c.json({service:"Toyol CSV Evidence",version:"1.0",description,route:"POST /v1/csv/audit",price:"0.01 USDC",network,payTo:PAY_TO,privacy:"No persistent storage or request logging by application. Do not submit sensitive personal data."}));
app.get("/health",c=>c.json({ok:true}));

const origin="https://toyol-csv-evidence.ilhamraduan-bis.workers.dev";
const paidUrl=origin+"/v1/csv/audit";
const sampleInput={csv:"id,name\n1,Ada\n1,Ada\n2,\n",required:["name"],unique:["id"]};
const inputSchema={type:"object",required:["csv"],additionalProperties:false,properties:{csv:{type:"string",description:"UTF-8 CSV with header; max 128 KiB, 2000 data records, 100 columns"},required:{type:"array",items:{type:"string"},description:"Column names that must contain values"},unique:{type:"array",items:{type:"string"},description:"Column names whose nonempty values must be unique"}}};
app.get("/.well-known/x402",c=>c.json({version:1,x402Version:2,name:"Toyol CSV Evidence",description,resources:[paidUrl],tools:[{name:"csv_audit",url:paidUrl,method:"POST",description,price:0.01,currency:"USDC",network,payTo:PAY_TO,inputSchema,example:sampleInput}],instructions:"POST JSON with csv, optional required and unique. An unsigned empty POST returns a 402. Valid requests are audited before settlement. See /openapi.json and /sample."},200,{"Cache-Control":"public, max-age=300","Access-Control-Allow-Origin":"*"}));
app.get("/openapi.json",c=>c.json({openapi:"3.1.0",info:{title:"Toyol CSV Evidence",version:"1.0.0",description},servers:[{url:origin}],paths:{"/v1/csv/audit":{post:{operationId:"auditCsv",summary:"Audit CSV data quality and produce evidence",description,"x-payment-info":{protocols:["x402"],price:{mode:"fixed",currency:"USD",amount:"0.01"}},security:[{x402:[]}],requestBody:{required:true,content:{"application/json":{schema:inputSchema,example:sampleInput}}},responses:{"200":{description:"Deterministic audit result",content:{"application/json":{schema:{type:"object",required:["schema","sha256","records","columns","pass","totalFindings","counts","findings"],properties:{schema:{type:"string"},sha256:{type:"string"},records:{type:"integer"},columns:{type:"integer"},pass:{type:"boolean"},totalFindings:{type:"integer"},counts:{type:"object"},findings:{type:"array",items:{type:"object"}}}}}}},"400":{description:"Invalid CSV or rules; not charged"},"402":{description:"Payment Required",headers:{"PAYMENT-REQUIRED":{schema:{type:"string"},description:"Base64-encoded x402 v2 challenge"}}}}}}},components:{securitySchemes:{x402:{type:"apiKey",in:"header",name:"PAYMENT-SIGNATURE",description:"x402 v2 purchaser payment authorization"}}}},200,{"Cache-Control":"public, max-age=300","Access-Control-Allow-Origin":"*"}));
app.get("/sample",async c=>c.json({input:sampleInput,result:await auditCsv(sampleInput.csv,{required:sampleInput.required,unique:sampleInput.unique}),note:"Fixed demonstration only. Customer-provided CSV audits require 0.01 USDC."}));

app.use("/v1/csv/audit",async(c,next)=>{
 if(c.req.method!=="POST")return c.json({error:"Method not allowed"},405);
 const unsigned=!c.req.header("payment-signature")&&!c.req.header("x-payment");
 // An empty unsigned POST is a discovery probe: return the real 402 quote.
 // Never accept a paid request without a valid CSV.
 if(unsigned&&!c.req.raw.body)return next();
 if(!c.req.header("content-type")?.toLowerCase().startsWith("application/json"))return c.json({error:"application/json required"},415);
 const limit=MAX_BYTES*6+65536;
 const length=c.req.header("content-length");
 if(length&&(!/^\d+$/.test(length)||Number(length)>limit))return c.json({error:"Body too large"},413);
 try{
   const reader=c.req.raw.clone().body?.getReader();if(!reader)return c.json({error:"Body required"},400);
   const chunks=[];let size=0;
   while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();return c.json({error:"Body too large"},413);}chunks.push(value);}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   if(unsigned&&size===0)return next();
   const body=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
   if(unsigned&&body&&typeof body==="object"&&!Array.isArray(body)&&Object.keys(body).length===0)return next();
   if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).some(k=>!["csv","required","unique"].includes(k)))return c.json({error:"Invalid request fields"},400);
   const result=await auditCsv(body.csv,{required:body.required??[],unique:body.unique??[]});
   c.set("report",result);
 }catch(e){return c.json({error:"Invalid CSV or request rules"},400);}
 await next();
});
// Worker networking must start inside a request, never module initialization.
// A request-scoped server also avoids sharing pending I/O across Worker requests.
app.use("/v1/csv/audit",async(c,next)=>{
 const facilitator = new HTTPFacilitatorClient({url:"https://facilitator.payai.network"});
 const server = new x402ResourceServer(facilitator).register(network,new ExactEvmScheme()).registerExtension(bazaarResourceServerExtension);
 return paymentMiddleware(route,server)(c,next);
});
app.post("/v1/csv/audit",c=>c.get("report")?c.json(c.get("report")):c.json({error:"CSV required for paid audit"},400));
export default app;
