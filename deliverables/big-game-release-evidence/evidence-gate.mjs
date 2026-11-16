// Pure, offline release-evidence core. No access to Jira, secrets or external services.
export function auditRelease({commit, required=[], evidence=[]}) {
  if(!/^[0-9a-f]{40}$/i.test(commit)) throw new Error('Invalid release commit');
  if(!Array.isArray(required)||!Array.isArray(evidence)||required.some(x=>typeof x!=='string'||!x.trim())||new Set(required).size!==required.length) throw new Error('Invalid requirements');
  const results=required.map(id=>{
    const rows=evidence.filter(x=>x&&x.id===id&&x.commit===commit);
    const trusted=rows.filter(x=>x.source==='verified-ci'&&typeof x.runId==='string'&&/^\d+$/.test(x.runId)&&['pass','fail'].includes(x.result));
    const distinct=new Map(); let conflict=false;
    for(const x of trusted){if(distinct.has(x.runId)&&distinct.get(x.runId)!==x.result)conflict=true;distinct.set(x.runId,x.result);}
    const outcomes=[...distinct.values()];
    const state=conflict?'conflict':outcomes.includes('fail')?'fail':outcomes.includes('pass')?'pass':'missing';
    return {id,state,runs:[...distinct.keys()].sort()};
  });
  return {commit,verdict:results.length&&results.every(x=>x.state==='pass')?'READY':'BLOCKED',results};
}
