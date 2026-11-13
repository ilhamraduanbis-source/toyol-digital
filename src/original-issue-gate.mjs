/**
 * Read-only original GitHub issue evidence before promoting an indexed bounty.
 * Never claims a task, posts a comment/PR, handles payment, or runs foreign code.
 */
const allowed = /^https:\/\/github\.com\/([^/?#]+)\/([^/?#]+)\/issues\/([1-9]\d*)(?:\/?(?:[?#].*)?)?$/i;

export function locateGitHubIssue(url) {
  const match=allowed.exec(String(url||''));
  if(!match)return null;
  const [,owner,repo,issue]=match;
  if(!/^[a-z\d-]{1,39}$/i.test(owner)||!/^[a-z\d_.-]{1,100}$/i.test(repo))return null;
  return {owner,repo,issue:Number(issue)};
}

export function evaluateOriginalIssue(task, issue) {
  const base={...task};
  if(!issue || !['open','closed'].includes(issue.state)) {
    return {...base,original_issue:{status:'UNVERIFIED'},next_action:'CHECK_ORIGINAL_ISSUE_MANUALLY'};
  }
  if(issue.pull_request || issue.state==='closed') {
    return {...base,original_issue:{status:'CLOSED_AT_SOURCE'},suitable_for_draft:false,
      next_action:'REJECT_SOURCE_CLOSED'};
  }
  if(issue.repository_archived===true || issue.repository_disabled===true) {
    return {...base,original_issue:{status:'REPOSITORY_READ_ONLY'},suitable_for_draft:false,next_action:'REJECT_REPOSITORY_READ_ONLY'};
  }
  const labels=(Array.isArray(issue.labels)?issue.labels:[]).map(x=>String(x?.name??x));
  if(issue.locked===true || labels.some(x=>/^(?:[^a-z]*)(?:on hold|hold)(?:\s|$)/i.test(x))) {
    return {...base,original_issue:{status:'RESTRICTED_OR_ON_HOLD'},suitable_for_draft:false,next_action:'REJECT_RESTRICTED_SOURCE'};
  }
  const official=(Array.isArray(issue.eligibility_comments)?issue.eligibility_comments:[]).filter(c=>['OWNER','MEMBER','COLLABORATOR'].includes(c?.author_association)||['ubiquity-os[bot]','ubiquity-os-beta[bot]'].includes(c?.user?.login));
  const restriction=official.find(c=>/external contributors are not eligible for rewards|must be a core team member, or an administrator to start this task|we stopped the bounty program|we don.t accept any bounty claims/i.test(String(c.body||'').split('<!--')[0]));
  if(restriction) {
    return {...base,original_issue:{status:'REWARD_RESTRICTION_REPORTED',evidence_url:restriction.html_url??null},suitable_for_draft:false,next_action:'REJECT_REWARD_RESTRICTED'};
  }
  const warnings=[];
  const comments=Number.isInteger(issue.comments)&&issue.comments>=0?issue.comments:0;
  if(comments>=20)warnings.push('MANY_EXISTING_DISCUSSIONS');
  const assigned=Boolean(issue.assignee)||(Array.isArray(issue.assignees)&&issue.assignees.length>0);
  if(assigned)warnings.push('ALREADY_ASSIGNED');
  if(issue.updated_at && !Number.isNaN(Date.parse(issue.updated_at)) &&
      Date.now()-Date.parse(issue.updated_at)>90*864e5)warnings.push('NO_RECENT_ACTIVITY_90D');
  const riskPenalty=warnings.includes('ALREADY_ASSIGNED')?18:0;
  const discussionPenalty=warnings.includes('MANY_EXISTING_DISCUSSIONS')?10:0;
  return {...base,
    original_issue:{status:'OPEN_AT_SOURCE',comments,assigned,warnings,
      last_updated:typeof issue.updated_at==='string'?issue.updated_at:null},
    review_score:Math.max(0,(base.review_score??0)-riskPenalty-discussionPenalty),
    next_action:warnings.length?'REVIEW_COMPETITION_AND_SCOPE':'VERIFY_SCOPE_AND_PREPARE_DELIVERABLE'};
}

export async function validateOriginalIssues(tasks,{fetchIssue,token=process.env.GITHUB_TOKEN}={}) {
  const read=fetchIssue||(async loc=>{
    const ac=new AbortController();
    const timer=setTimeout(()=>ac.abort(),9000);
    try {
      const headers={Accept:'application/vnd.github+json','User-Agent':'ToyolOriginVerification/1.0'};
      if(token)headers.Authorization='Bearer '+token;
      const url='https://api.github.com/repos/'+encodeURIComponent(loc.owner)+'/'+encodeURIComponent(loc.repo)+'/issues/'+loc.issue;
      const response=await fetch(url,{headers,signal:ac.signal});
      if(!response.ok)throw Error('GITHUB_HTTP_'+response.status);
      const issue=await response.json();
      // Index state alone is insufficient: archived projects and official reward restrictions matter.
      const repoUrl='https://api.github.com/repos/'+encodeURIComponent(loc.owner)+'/'+encodeURIComponent(loc.repo);
      const repoRes=await fetch(repoUrl,{headers,signal:ac.signal});
      if(!repoRes.ok)throw Error('GITHUB_REPO_HTTP_'+repoRes.status);
      const repo=await repoRes.json();
      issue.repository_archived=repo.archived===true;
      issue.repository_disabled=repo.disabled===true;
      if(issue.state==='open' && !issue.repository_archived && !issue.repository_disabled && !issue.locked && Number(issue.comments)>0){
        const comments=await fetch(url+'/comments?per_page=100&sort=created&direction=desc',{headers,signal:ac.signal});
        if(!comments.ok)throw Error('GITHUB_COMMENTS_HTTP_'+comments.status);
        const rows=await comments.json();
        if(!Array.isArray(rows))throw Error('GITHUB_COMMENTS_BAD_RESPONSE');
        issue.eligibility_comments=rows;
      }
      return issue;
    } finally {clearTimeout(timer);}
  });
  const checked=await Promise.all(tasks.map(async task=>{
    const loc=locateGitHubIssue(task.url);
    if(!loc)return {...task,original_issue:{status:'NOT_GITHUB_ISSUE'}};
    try{return evaluateOriginalIssue(task,await read(loc));}
    catch{return {...task,original_issue:{status:'UNVERIFIED'},next_action:'CHECK_ORIGINAL_ISSUE_MANUALLY'};}
  }));
  return {active:checked.filter(x=>x.suitable_for_draft!==false)
    .sort((a,b)=>(b.review_score??0)-(a.review_score??0)),
    rejected:checked.filter(x=>x.suitable_for_draft===false),
    checked_github:checked.filter(x=>x.original_issue?.status!=='NOT_GITHUB_ISSUE').length};
}
