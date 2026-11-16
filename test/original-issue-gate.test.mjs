import test from 'node:test';
import assert from 'node:assert/strict';
import {locateGitHubIssue,evaluateOriginalIssue,validateOriginalIssues} from '../src/original-issue-gate.mjs';

const task={url:'https://github.com/sample/project/issues/10',title:'Fix bounded bug',source:'Jobbi / algora',
 reward_amount:5,review_score:90,suitable_for_draft:true,next_action:'VERIFY'};
test('only canonical GitHub issue URLs are fetched',()=>{
 assert.deepEqual(locateGitHubIssue(task.url),{owner:'sample',repo:'project',issue:10});
 assert.equal(locateGitHubIssue('https://github.com.evil.net/owner/repo/issues/1'),null);
 assert.equal(locateGitHubIssue('https://github.com/owner/repo/pull/1'),null);
 assert.equal(locateGitHubIssue('http://github.com/owner/repo/issues/1'),null);
});
test('a closed original issue cannot be offered as startable work',()=>{
 const result=evaluateOriginalIssue(task,{state:'closed',comments:0});
 assert.equal(result.suitable_for_draft,false);
 assert.equal(result.next_action,'REJECT_SOURCE_CLOSED');
});
test('assigned and discussed issues are flagged but not rejected solely for competition',()=>{
 const result=evaluateOriginalIssue(task,{state:'open',assignee:{login:'other'},comments:43});
 assert.equal(result.suitable_for_draft,true);
 assert.equal(result.original_issue.status,'OPEN_AT_SOURCE');
 assert.deepEqual(result.original_issue.warnings,['MANY_EXISTING_DISCUSSIONS','ALREADY_ASSIGNED']);
 assert.equal(result.review_score,62);
});
test('original-source verification filters closed issues while retaining unverified evidence',async()=>{
 const items=[task,{...task,url:'https://github.com/example/repo/issues/2'},{...task,url:'https://example.org/gig'}];
 const result=await validateOriginalIssues(items,{fetchIssue:async ({issue})=>{
  if(issue===10)return {state:'closed'};
  throw Error('rate limited');
 }});
 assert.equal(result.rejected.length,1);
 assert.equal(result.active.length,2);
 assert.equal(result.active[0].original_issue.status,'UNVERIFIED');
 assert.equal(result.checked_github,2);
});

test('archived repositories, locked issues and hold labels reject stale bounty leads',()=>{
 for(const issue of [{state:'open',repository_archived:true},{state:'open',repository_disabled:true},{state:'open',locked:true},{state:'open',labels:[{name:'⏸️ Hold'}]}]){
  const result=evaluateOriginalIssue(task,issue);
  assert.equal(result.suitable_for_draft,false);
 }
});
test('official reward restrictions are hard gates but random comments are not',()=>{
 const restriction={body:'External contributors are not eligible for rewards at this time.',html_url:'https://github.com/sample/project/issues/10#issuecomment-1',author_association:'MEMBER'};
 const result=evaluateOriginalIssue(task,{state:'open',eligibility_comments:[restriction]});
 assert.equal(result.next_action,'REJECT_REWARD_RESTRICTED');
 assert.equal(result.original_issue.evidence_url,restriction.html_url);
 assert.equal(evaluateOriginalIssue(task,{state:'open',eligibility_comments:[{...restriction,author_association:'NONE'}]}).suitable_for_draft,true);
 const bot={user:{login:'ubiquity-os[bot]'},body:'You must be a core team member, or an administrator to start this task'};
 assert.equal(evaluateOriginalIssue(task,{state:'open',eligibility_comments:[bot]}).next_action,'REJECT_REWARD_RESTRICTED');
});

test('expired explicitly labelled UTC deadline rejects a still-open indexed issue',()=>{
 const issue={state:'open',body:'## Submission deadline: March 31, 2026 (UTC)\nPayout within 72h of merge verification.'};
 const result=evaluateOriginalIssue(task,issue,Date.parse('2026-11-16T02:00:00Z'));
 assert.equal(result.suitable_for_draft,false);
 assert.equal(result.next_action,'REJECT_EXPIRED_DEADLINE');
 assert.equal(result.original_issue.deadline_utc,'2026-03-31T23:59:59.000Z');
});
test('future explicit deadline and arbitrary historical dates do not disqualify an issue',()=>{
 const now=Date.parse('2026-11-16T02:00:00Z');
 for(const body of ['## Submission deadline: December 31, 2026 (UTC)','Earlier work started March 31, 2026 (UTC).','Submission deadline: March 31, 2026 (local time)']){
  assert.equal(evaluateOriginalIssue(task,{state:'open',body},now).suitable_for_draft,true);
 }
});

test('rewarded label beats stale index funding',()=>{
 const result=evaluateOriginalIssue(task,{state:'open',labels:[{name:'💰 Rewarded'}]});
 assert.equal(result.suitable_for_draft,false);
 assert.equal(result.next_action,'REJECT_ALREADY_REWARDED');
 assert.equal(evaluateOriginalIssue(task,{state:'open',labels:[{name:'Bounty'}]}).suitable_for_draft,true);
});
test('Tenstorrent terms gate autonomous participation without suppressing unrelated projects',()=>{
 for(const issue of [{state:'open',assignees:[{login:'someone'}]},{state:'open',assignees:[]}]){
  const result=evaluateOriginalIssue({...task,url:'https://github.com/tenstorrent/tt-metal/issues/62681'},issue);
  assert.equal(result.suitable_for_draft,false);
  assert.equal(result.next_action,'REJECT_AUTONOMOUS_PARTICIPATION_GATE');
 }
 assert.equal(evaluateOriginalIssue({...task,url:'https://github.com/example/tenstorrent/issues/1'},{state:'open'}).suitable_for_draft,true);
});
