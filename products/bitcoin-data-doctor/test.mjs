import test from "node:test";
import assert from "node:assert/strict";
import { createApp, answer, validateQuestion, PRICE, MODEL } from "./src/server.mjs";
const recipient="ST000000000000000000002AMW42H";
// This public test fixture is the protocol burn address, NEVER a live payout destination.
// No payment is created, sent or settled by these tests.
let calls=0;
const ai={run:async(model,args)=>{calls++;assert.equal(model,MODEL);assert.equal(args.max_tokens,384);return {response:"Validate the schema."};}};
const env={STACKS_NETWORK:"testnet",PAY_TO:recipient,AI:ai};
test("input validation",()=>{assert.equal(validateQuestion("  x "), "x");assert.equal(validateQuestion(""),null);assert.equal(validateQuestion("x".repeat(2001)),null);});
test("model adapter runs bounded request",async()=>{assert.equal(await answer(ai,"invalid CSV"),"Validate the schema.");});
test("model errors do not masquerade as answer",async()=>{await assert.rejects(answer({run:async()=>({})},"x"),/INVALID_MODEL_RESPONSE/);});
test("missing or wrong-network recipient fails closed",async()=>{assert.equal((await createApp({...env,PAY_TO:""}).request("/ask?question=x")).status,503);assert.equal((await createApp({...env,STACKS_NETWORK:"mainnet"}).request("/")).status,503);});
test("invalid question rejected before payment",async()=>{assert.equal((await createApp(env).request("/ask")).status,400);});
test("unpaid request receives authentic SDK payment requirements and no AI execution",async()=>{const before=calls;const r=await createApp(env).request("/ask?question=x");assert.equal(r.status,402);const j=await r.json();assert.equal(j.accepts[0].amount,String(PRICE));assert.equal(j.accepts[0].payTo,recipient);assert.equal(j.accepts[0].network,"stacks:2147483648");assert.deepEqual(JSON.parse(atob(r.headers.get("payment-required"))),j);assert.equal(calls,before);});
test("HEAD cannot bypass payment",async()=>{const before=calls;const r=await createApp(env).request("/ask?question=x",{method:"HEAD"});assert.equal(r.status,402);assert.equal(calls,before);});
test("free health and discovery; no spending routes",async()=>{const a=createApp(env);assert.equal((await a.request("/health")).status,200);assert.equal((await a.request("/")).status,200);assert.equal((await a.request("/agent/alice/fetch",{method:"POST"})).status,404);});
