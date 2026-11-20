import test from 'node:test';
import assert from 'node:assert/strict';
import {URLS,classifyRequest,generateDemos} from '../src/toyol-csv-growth.mjs';
const NOW=Date.parse('2026-11-21T00:00:00Z');
function issue(other={}){
 return {title:'CSV import duplicate values and validation request',
  body:'I need CSV data quality checks for duplicate IDs before an import.',
  html_url:'https://github.com/example/example/issues/123',
  repository_url:'https://api.github.com/repos/example/example',
  state:'open',created_at:'2026-11-10T00:00:00Z',updated_at:'2026-11-20T00:00:00Z',
  comments:2,...other};
}
test('only current open public customer-needs signals are considered',()=>{
 const r=classifyRequest(issue(),NOW);assert.equal(r.stage,'PUBLIC_NEED_NOT_CONFIRMED_BUYER');
 assert.equal(r.paymentCommitted,false);assert.equal(r.outreachSent,false);
 for(const other of [{state:'closed'},{pull_request:{}},{updated_at:'2026-01-01T00:00:00Z'},{body:'this is a medical patient CSV issue'},
  {title:'Something unrelated',body:'No data import or cleaning here'}])assert.equal(classifyRequest(issue(other),NOW),null);
});
test('three actual synthetic buyer problems produce reproducible QA evidence',async()=>{
 const cases=await generateDemos();assert.equal(cases.length,4);
 for(const c of cases){assert.equal(c.verifiedByLocalEngine,true);assert.equal(c.result.pass,false);}
 for(const c of cases.slice(0,3))assert.ok(c.result.sha256.length===64);
 assert.ok(cases[0].result.counts.DUPLICATE_VALUE>0);
 assert.ok(cases[1].result.counts.MISSING_REQUIRED>0);
 assert.ok(cases[2].result.counts.ROW_WIDTH>0);
 assert.equal(cases[3].result.reason,'INVALID_CSV_CONTENT');
 assert.equal(cases[3].result.paymentNotAttempted,true);
});
test('buyers have an unpaid first action and a real independently discoverable listing',()=>{
 assert.ok(URLS.sample.endsWith('/sample'));assert.ok(URLS.marketplace.includes('payapi.market/api/'));
});

test('not a buyer when CSV is incidental mention in a different issue',()=>{
 const item=issue({title:'Fix report sorting UI bug',body:'This dashboard handles a CSV export and has a data quality validator; I need the CSS fixed.'});
 assert.equal(classifyRequest(item,NOW),null);
});
