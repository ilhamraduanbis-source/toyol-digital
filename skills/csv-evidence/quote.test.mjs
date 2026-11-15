import app from "./worker.mjs";
import assert from "node:assert/strict";
let r=await app.request("https://toyol.invalid/health");assert.equal(r.status,200);
r=await app.request("https://toyol.invalid/v1/csv/audit",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({csv:'id\n"bad'})});assert.equal(r.status,400);
r=await app.request("https://toyol.invalid/v1/csv/audit",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({csv:"id,name\n1,Ada\n",required:["name"],unique:["id"]})});assert.equal(r.status,402);
const header=r.headers.get("payment-required");assert.ok(header);const q=JSON.parse(Buffer.from(header,"base64").toString("utf8"));assert.equal(q.x402Version,2);
const a=q.accepts.find(x=>x.network==="eip155:8453");assert.ok(a);assert.equal(a.payTo.toLowerCase(),"0xac57ad3c3f233e5865c3cd652f67ffc82a7af431");assert.equal(a.asset.toLowerCase(),"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");assert.equal(a.amount,"10000");assert.equal(a.scheme,"exact");console.log("TOYOL_X402_UNPAID_QUOTE_PASS",JSON.stringify({network:a.network,asset:a.asset,amount:a.amount,payTo:a.payTo,actualPayment:false,deployed:false}));

for(const options of [{method:"POST"},{method:"POST",headers:{"content-type":"application/json"},body:"{}"}]){
 const probe=await app.request("https://toyol.invalid/v1/csv/audit",options);
 assert.equal(probe.status,402);const p=JSON.parse(Buffer.from(probe.headers.get("payment-required"),"base64").toString("utf8"));assert.equal(p.accepts.find(a=>a.network==="eip155:8453").amount,"10000");
}
const bad=await app.request("https://toyol.invalid/v1/csv/audit",{method:"POST",headers:{"content-type":"application/json","payment-signature":"invalid"},body:"{}"});
assert.equal(bad.status,400);
console.log("TOYOL_DISCOVERY_PROBE_PASS",JSON.stringify({unsignedEmpty:402,unsignedObject:402,signedEmpty:400,paid:false}));
