// Deterministic planning only. Never funds, accepts, or links market tasks.
const units=n=>Number.isSafeInteger(n)&&n>=0;
export function planCaptain({team,jobs,budget,maxJobs=10}={}){
 if(typeof team!=='string'||!team||!Array.isArray(jobs)||!budget||
    ![budget.capMicros,budget.committedMicros,budget.spentMicros,maxJobs].every(units))return [];
 const {capMicros,committedMicros,spentMicros}=budget;
 if(spentMicros>capMicros||committedMicros>capMicros-spentMicros)return [];
 let available=capMicros-spentMicros-committedMicros;
 const seen=new Set(),out=[];
 for(const j of jobs){
  if(out.length>=maxJobs)break;
  if(!j||j.team!==team||j.status!=='open'||j.taskId!=null||typeof j.id!=='string'||!j.id||seen.has(j.id)||typeof j.field!=='string'||!j.field||!units(j.rewardMicros)||j.rewardMicros===0||j.rewardMicros>available)continue;
  if(!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(j.field))continue;
  seen.add(j.id);
  out.push({jobId:j.id,rewardMicros:j.rewardMicros,intention:'Improve '+j.field+' for the next round.'});
  available-=j.rewardMicros;
 }
 return out;
}
