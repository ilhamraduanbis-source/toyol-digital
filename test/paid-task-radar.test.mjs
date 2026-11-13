import test from 'node:test';
import assert from 'node:assert/strict';
import {fromJobbi,fromTaskmarket,fromBasedAgents,fromFrantic,fromSwarmMemo,analyzeTask,shortlist,scan} from '../src/paid-task-radar.mjs';
const source={id:'algora:1',title:'Fix a Python data parser',url:'https://github.com/example/example/issues/4',
  content_text:'Write test and fix parser',_jobbi:{lane:'agent',reward:{amount:0.01,currency:'USD',rail:'stripe'},
  payment_state:'escrowed',acceptance_type:'review',source:'algora',claims_open:true}};
test('legal one cent work is not excluded by size, nor called income',()=>{
 const t=analyzeTask(fromJobbi(source));
 assert.equal(t.reward_amount,0.01);
 assert.equal(t.earned_myr_verified,0);
 assert.equal(t.funding_from_primary_verified,false);
 assert.equal(t.suitable_for_draft,true);
});
test('open unrelated human job cannot enter paid task radar',()=>{
 assert.equal(fromJobbi({...source,_jobbi:{...source._jobbi,lane:'human'}}),null);
});
test('unclaimed other people funds are not an opportunity class',()=>{
 const t=analyzeTask(fromJobbi({...source,title:'Take another persons wallet private key and transfer funds'}));
 assert.equal(t.eligibility.status,'REJECT');
 assert.equal(t.suitable_for_draft,false);
});
test('Taskmarket 6-decimal units are not mistaken for millions of USD',()=>{
 const id='0x'+'a'.repeat(64);
 const t=analyzeTask(fromTaskmarket({id,status:'open',reward:'1200000',description:'Create a CSV parser',stakeRequired:false,
   chainId:8453,escrowTxHash:'0x'+ 'b'.repeat(64)}));
 assert.equal(t.reward_amount,1.2);
 assert.equal(t.reward_currency,'USDC');
 assert.equal(t.funding_from_primary_verified,false);
 assert.equal(t.MYR_cashout_verified,false);
});
test("Taskmarket stake requirement is not allowed with owner money",()=>{
 const id='0x'+'a'.repeat(64);
 assert.equal(fromTaskmarket({id,status:'open',reward:'2000000',description:'Fix code',stakeRequired:true}),null);
});
test('BasedAgents tasks are not assumed escrowed based on brand',()=>{
 const t=analyzeTask(fromBasedAgents({id:'task_abcdef',status:'open',bounty_amount:3,title:'Write markdown docs'}));
 assert.equal(t.reward_amount,3);
 assert.equal(t.funding_signal,'NO_FUNDED_ESCROW_EVIDENCE');
 assert.equal(t.suitable_for_draft,false);
 assert.ok(t.eligibility.reasons.includes('UNFUNDED_OR_UNVERIFIED_ESCROW'));
 assert.equal(shortlist([fromBasedAgents({id:'task_abcdef',status:'open',bounty_amount:3,title:'Write markdown docs'})]).length,0);
 assert.equal(t.earned_myr_verified,0);
});
test('shortlist includes micro, middle and high values without min bounty gate',()=>{
 const values=[0.01,0.3,5,20,50,180,200,700].map((reward_amount,i)=>({
  id:String(i),source:'Fixture',url:'https://example.org/task/'+i,title:'Fix JSON '+i,
  brief:'Write JSON parsing test',reward_amount,reward_currency:'USD',payout_rail:'BANK',
  stake_required:false,source_primary_verified:false}));
 const chosen=shortlist(values);
 assert.ok(chosen.some(x=>x.reward_amount<1));
 assert.ok(chosen.some(x=>x.reward_amount>=200));
 assert.ok(chosen.some(x=>x.reward_amount>10&&x.reward_amount<200));
});
test('partial API outages are not silently presented as a healthy zero',async()=>{
 const x=await scan(async url=>{
  if(url.includes('taskmarket'))throw Error('HTTP 429');
  if(url.includes('basedagents'))return {tasks:[]};
  return {items:[source]};
 });
 assert.equal(x.sources.length,5);
 assert.equal(x.sources.filter(y=>y.status==='ERROR').length,1);
 assert.equal(x.tasks.length,1);
 assert.equal(x.verified_myr_received,0);
});

test('purchase-required Taskmarket bounty is rejected under RM0 policy',()=>{
 const id='0x'+'a'.repeat(64);
 const listing=fromTaskmarket({id,status:'open',reward:'15000000',chainId:8453,mode:'bounty',
   description:'Shop Lumen House and tell us how it went. Buy the Manifest Kit. Buy an Interface Check. Buy any NFT. Entrants pay their own purchases and network costs.'});
 const candidate=analyzeTask(listing);
 assert.equal(candidate.eligibility.status,'REJECT');
 assert.ok(candidate.eligibility.reasons.includes('REQUIRES_PURCHASE_OR_OUTLAY'));
 assert.equal(candidate.suitable_for_draft,false);
 assert.equal(shortlist([listing]).length,0);
});

test('Tempo or unverified Taskmarket token cannot be offered to Base-only Toyol wallet',()=>{
 const id='0x'+'a'.repeat(64);
 assert.equal(fromTaskmarket({id,status:'open',chainId:4217,reward:'100000000',mode:'bounty',description:'Produce video'}),null);
 assert.ok(fromTaskmarket({id,status:'open',chainId:8453,reward:'100000000',mode:'bounty',description:'Produce code'}));
});

test('BasedAgents escrow claim is lead-only pending verification of actual deposit',()=>{
 const t=analyzeTask(fromBasedAgents({id:'task_funded123',status:'open',bounty_amount:2,title:'Write short report',
   payment_status:'funded',escrow:{status:'funded'}}));
 assert.equal(t.funding_signal,'FUNDED_CLAIM_FROM_PROVIDER_NEEDS_ONCHAIN_CHECK');
 assert.equal(t.funding_from_primary_verified,false);
 assert.equal(t.earned_myr_verified,0);
});

test('Taskmarket global free quota blocks paid submissions even for a new wallet',()=>{
 const base={id:'0x'+'c'.repeat(64),status:'open',chainId:8453,reward:'500000',description:'Write report',mode:'bounty',submissionWindowOpen:true};
 assert.equal(analyzeTask(fromTaskmarket({...base,submissionCount:49})).suitable_for_draft,true);
 for(const count of [50,58,65]){
  const t=analyzeTask(fromTaskmarket({...base,submissionCount:count}));
  assert.equal(t.suitable_for_draft,false);
  assert.ok(t.eligibility.reasons.includes('TASK_FREE_SUBMISSIONS_EXHAUSTED'));
 }
 assert.ok(analyzeTask(fromTaskmarket(base)).eligibility.reasons.includes('FREE_QUOTA_UNVERIFIED'));
 assert.ok(analyzeTask(fromTaskmarket({...base,submissionCount:0,submissionWindowOpen:false})).eligibility.reasons.includes('SUBMISSION_WINDOW_CLOSED'));
});

test('Frantic excludes private invitations and purchase cashback, accepts funded public work',()=>{
 const b={number:150,title:'Write a Python parser',visibility:'public',funded:true,work_status:'open',price_usd:3,claim_slots:{available:1}};
 assert.equal(fromFrantic(b).reward_amount,3);
 assert.equal(fromFrantic({...b,visibility:'private'}),null);
 assert.equal(fromFrantic({...b,title:'Your first bounty is on the house'}),null);
 assert.equal(fromFrantic({...b,claim_slots:{available:0}}),null);
});

test('SwarmMemo reports minimum cash tier, never treats credit as cash or promised USDC as escrow',()=>{
 const w={id:'a'.repeat(32),state:'open',claimable:true,title:'Audit documentation',standing:{open:1,results:4,results_max:5,tiers:[{name:'minor',credits:10,usdc:'0.01'},{name:'serious',credits:150,usdc:'1'}]}};
 const t=fromSwarmMemo(w);
 assert.equal(t.reward_amount,0.01);
 assert.equal(t.funding_signal,'USDC_PROMISED_NOT_ESCROWED');
 assert.equal(fromSwarmMemo({...w,standing:{...w.standing,results:5}}),null);
 assert.equal(fromSwarmMemo({...w,standing:{...w.standing,tiers:[{credits:50}]}}),null);
});
test('scheduled direct scan leaves Jobbi to its separate hourly workflow',async()=>{
 const urls=[];
 const x=await scan(async url=>{urls.push(url);return {tasks:[],data:{works:[]},board:{open_bounties:[]}};},{directOnly:true});
 assert.equal(x.sources.length,4);
 assert.ok(!urls.some(u=>u.includes('jobbi.org')));
 assert.ok(urls.some(u=>u.includes('swarmmemo.com')));
});
