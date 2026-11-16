/** Read-only cross-tier discovery. Never marks a live job completed from CI status. */
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export function routeCandidates(registry,radar,now=Date.now()){
 const rows=Array.isArray(radar?.tasks)?radar.tasks:[];
 const used=new Set();
 const valid=rows.filter(x=>x&&typeof x.url==='string'&&/^https:\/\//.test(x.url)&&x.suitable_for_draft===true&&x.eligibility?.status==='REVIEW'&&['USD','USDC'].includes(x.reward_currency)&&Number.isFinite(x.reward_amount)&&x.reward_amount>0&&!x.stake_required&&!x.stake_terms_unverified&&(!x.deadline||(Number.isFinite(Date.parse(x.deadline))&&Date.parse(x.deadline)>now)));
 const sorted=[...valid].sort((a,b)=>b.reward_amount-a.reward_amount||b.review_score-a.review_score||a.url.localeCompare(b.url));
 const candidates=registry.missions.map(m=>{
  const mega=m.id==='atlas-mega-contracts'||m.id==='orion-mega-contracts';
  // Protect dedicated long-term and high-value missions. Supplement, never replace them.
  const lead=mega?null:sorted.find(x=>!used.has(x.url));
  if(lead)used.add(lead.url);
  return {worker:m.id,originalMission:m.purpose,originalWorkflow:m.workflow,currentWorkStatus:'PRESERVE_EXISTING_MISSION_COMPLETION_NOT_INFERRED',nextCandidate:lead?{url:lead.url,title:lead.title,advertisedReward:lead.reward_amount,currency:lead.reward_currency,source:lead.source,fundingSignal:lead.funding_signal,reviewStatus:'LEAD_ONLY_VERIFY_ELIGIBILITY_AND_FUNDING'}:null,nextAction:mega?'CONTINUE_DEDICATED_5M_SOURCE_HUNT':lead?'REVIEW_DISTINCT_CANDIDATE_WHEN_CAPACITY_FREE':'CONTINUE_ORIGINAL_MISSION_AND_NEXT_RADAR_SCAN',noFixedRewardCeiling:true,claimAuthorized:false};
 });
 return {at:new Date(now).toISOString(),policy:registry.continuityPolicy,agents:candidates,distinctCandidates:used.size,ownerSpend:0,incomeInferred:false,notes:'Candidates are not assigned jobs. Preserve accepted commitments and revisions until verified completion. Use shared skills for all tiers. No duplicate candidate in this snapshot; verify live status before any claim.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const config=JSON.parse(fs.readFileSync('runner/clone-missions.json','utf8'));
 const radar=JSON.parse(fs.readFileSync('out/paid-tasks/lead-evidence.json','utf8'));
 const report=routeCandidates(config,radar);
 fs.writeFileSync('out/paid-tasks/mission-continuity.json',JSON.stringify(report,null,2)+'\n');
 console.log('MISSION_CONTINUITY',JSON.stringify({agents:report.agents.length,distinctCandidates:report.distinctCandidates,ownerSpend:0,incomeInferred:false}));
}
