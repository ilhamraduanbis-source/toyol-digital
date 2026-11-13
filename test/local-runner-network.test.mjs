import test from 'node:test';
import assert from 'node:assert/strict';
import {boundedRead} from '../scripts/toyol-local-runner.mjs';
const url='https://api.github.com/fixture';
test('GET retries a temporary transport failure and uses no-store',async()=>{
 let n=0;
 const b=await boundedRead(url,{},100,async(u,o)=>{assert.equal(o.redirect,'error');assert.equal(o.cache,'no-store');assert.ok(o.signal);if(++n===1)throw Object.assign(new TypeError('fetch failed'),{cause:{code:'ECONNRESET'}});return new Response('ok');});
 assert.equal(b.toString(),'ok');assert.equal(n,2);
});
test('signed POST failure is never retried',async()=>{
 let n=0;
 await assert.rejects(boundedRead(url,{method:'POST',body:'{}'},100,async()=>{n++;throw Object.assign(new TypeError('fetch failed'),{cause:{code:'ECONNRESET'}});}),/NETWORK_POST api.github.com\/fixture ECONNRESET/);
 assert.equal(n,1);
});
test('read limit and disallowed hosts fail closed',async()=>{
 await assert.rejects(boundedRead(url,{},2,async()=>new Response('large')),/RESPONSE_TOO_LARGE/);
 await assert.rejects(boundedRead('https://example.com/'),/HOST_BLOCKED/);
});
test('permanent HTTP failure stops without retry',async()=>{
 let n=0;await assert.rejects(boundedRead(url,{},100,async()=>{n++;return new Response('not found',{status:404});}),/HTTP_404/);assert.equal(n,1);
});
