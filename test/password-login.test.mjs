import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLoginHandler} from '../skills/password-login/login.mjs';
const context={rateLimitKey:'trusted-test-key'};
const valid={identity:'sample-user',password:'synthetic-password'};
function fixture(overrides={}){
 const calls={find:[],verify:[],session:[],rate:[]};
 const login=createLoginHandler({dummyPasswordHash:'fixture-dummy-hash',
 findUser:async id=>{calls.find.push(id);return id==='sample-user'?{id:'user-1',passwordHash:'fixture-user-hash'}:null;},
 verifyPassword:async (password,hash)=>{calls.verify.push([password,hash]);return password===valid.password&&hash==='fixture-user-hash';},
 createSession:async data=>{calls.session.push(data);return true;},
 consumeAttempt:async data=>{calls.rate.push(data);return true;},...overrides});
 return {login,calls};
}
test('valid login uses existing verifier and server-side session, no secrets in response',async()=>{
 const {login,calls}=fixture();const r=await login(valid,context);
 assert.deepEqual(r,{status:200,body:{ok:true}});
 assert.equal(calls.session.length,1);assert.equal(calls.session[0].userId,'user-1');
 assert.equal(calls.rate.length,1);
});
test('wrong password and unknown identity return identical generic failure',async()=>{
 const {login,calls}=fixture();
 const wrong=await login({...valid,password:'incorrect'},context);
 const unknown=await login({...valid,identity:'not-found'},context);
 assert.deepEqual(wrong,unknown);assert.equal(wrong.status,401);
 assert.equal(calls.verify[1][1],'fixture-dummy-hash');assert.equal(calls.session.length,0);
});
test('malformed and excessive inputs are rejected before storage lookup',async()=>{
 const {login,calls}=fixture();
 for(const input of [null,[],{}, {identity:'',password:'p'},{identity:'a',password:''},{identity:'x'.repeat(321),password:'p'},{identity:'a',password:'x'.repeat(1025)}]){
  assert.equal((await login(input,context)).status,400);
 }
 assert.equal(calls.find.length,0);
});
test('trusted rate limiter required and denied attempts never reach credential lookup',async()=>{
 const {login,calls}=fixture({consumeAttempt:async()=>false});
 assert.equal((await login(valid,{})).status,503);
 assert.equal((await login(valid,context)).status,429);
 assert.equal(calls.find.length,0);assert.equal(calls.session.length,0);
});
test('disabled account cannot obtain session even with correct password',async()=>{
 const {login,calls}=fixture({findUser:async()=>({id:'user-1',passwordHash:'fixture-user-hash',disabled:true})});
 assert.equal((await login(valid,context)).status,401);assert.equal(calls.session.length,0);
});
test('adapter exceptions and unconfirmed session creation fail closed',async()=>{
 let {login}=fixture({findUser:async()=>{throw Error('private store detail');}});
 assert.deepEqual(await login(valid,context),{status:503,body:{error:'Login unavailable'}});
 ({login}=fixture({createSession:async()=>false}));assert.equal((await login(valid,context)).status,503);
});
test('configuration without verifier, rate limiter or dummy hash is rejected',()=>{
 assert.throws(()=>createLoginHandler(),/adapter required/);
 assert.throws(()=>createLoginHandler({findUser:()=>{},verifyPassword:()=>{},createSession:()=>{},consumeAttempt:()=>{}}),/dummy hash/);
});
test('password is never silently trimmed or lowercased',async()=>{
 const {login,calls}=fixture();await login({...valid,password:'  MixedCase  '},context);
 assert.equal(calls.verify[0][0],'  MixedCase  ');
});
