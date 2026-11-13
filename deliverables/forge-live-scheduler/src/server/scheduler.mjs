// One deterministic transition per step. The service owns durable dispatch.
// battleTick is the service-level transition; transitionEpisode handles the
// lock, finishBattle and nextRound domain commands.
import {lockRound} from '../market/lock.mjs';
import {stepBattle} from '../combat/tick.mjs';
import {decideRobot} from '../agents/robot.mjs';

export function createScheduler({getState,dispatch,now,setTimer=setInterval,clearTimer=clearInterval,tickMs=100}){
  if(!Number.isSafeInteger(tickMs)||tickMs<=0||typeof getState!=='function'||typeof dispatch!=='function'||typeof now!=='function')throw Object.assign(new Error('invalid_scheduler'),{code:'invalid_scheduler'});
  let running=false,timer,inFlight=null;
  async function advance(){
    const state=await getState(),at=now();
    if(!state||!Number.isSafeInteger(at)||at<0)throw Object.assign(new Error('invalid_scheduler_state'),{code:'invalid_scheduler_state'});
    if(state.phase==='market'){
      if(at<state.cutoff)return;
      const baselines=Object.fromEntries(state.teams.map(t=>[t.id,t.policy]));
      const baseRevisions=Object.fromEntries(state.teams.map(t=>[t.id,t.baseRevision]));
      const locked=lockRound({episode:state.id,round:state.round,now:at,cutoff:state.cutoff,baselines,baseRevisions,entries:state.upgrades?.entries??[]});
      return dispatch({type:'lock',now:at,policies:locked.policies});
    }
    if(state.phase==='battle'){
      const battle=state.battle;
      if(!battle)throw Object.assign(new Error('missing_battle'),{code:'missing_battle'});
      if(battle.ended)return dispatch({type:'finishBattle',now:at,result:battle});
      const actions=Object.fromEntries(battle.robots.map(self=>[self.id,decideRobot(structuredClone({arena:battle.arena,tick:battle.tick,self,opponents:battle.robots.filter(r=>r.id!==self.id&&r.hull>0),recentEvents:battle.events.slice(-20),policy:self.policy}))]));
      const next=stepBattle(battle,actions);
      return dispatch({type:'battleTick',now:at,episode:state.id,round:state.round,expectedTick:battle.tick,actions,battle:next});
    }
    if(state.phase==='results')return dispatch({type:'nextRound',now:at});
  }
  function step(){
    if(inFlight)return inFlight;
    inFlight=Promise.resolve().then(advance).finally(()=>{inFlight=null;});
    return inFlight;
  }
  function start(){
    if(running)return;
    running=true;
    try{timer=setTimer(()=>{if(running)void step().catch(()=>stop());},tickMs);}
    catch(e){running=false;throw e;}
  }
  function stop(){
    if(!running)return;
    running=false;
    const handle=timer;timer=undefined;clearTimer(handle);
  }
  return {start,step,stop};
}
