import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const skill=readFileSync(new URL('./SKILL.md',import.meta.url),'utf8');
test('public agent skill is discoverable by standard directory and matching frontmatter',()=>{
 assert.match(skill,/^---\nname: csv-evidence\ndescription: /);
 assert.match(skill,/\n---\n\n# Toyol CSV Evidence/);
 assert.ok(skill.split('\n').length<500);
});
test('live x402 purchase terms and ownership are explicitly documented',()=>{
 for(const value of [
   'https://payapi.market/api/toyol-csv-evidence-data-quality-audit',
   'https://toyol-csv-evidence.ilhamraduan-bis.workers.dev/sample',
   '/v1/csv/audit','0.01 USDC','eip155:8453','10000',
   '0xac57ad3c3f233e5865c3cd652f67ffc82a7af431'
 ])assert.ok(skill.includes(value),'Missing '+value);
});
test('buyer skill never authorizes implicit payment, secret disclosure or sensitive uploads',()=>{
 assert.match(skill,/explicit approval/);
 assert.match(skill,/Never request a seed phrase or private key/);
 assert.match(skill,/Do not submit passwords/);
 assert.match(skill,/not proof of a successful payment/);
});
