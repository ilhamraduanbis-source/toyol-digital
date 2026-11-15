// Toyol Digital original Armor controller. Objective-first, bounded pathfinding.
// No network, timers, model calls, opponent code or external state.
const F=65536,A=4096;
let rules,map,side,points,fields,assignment,blocked,previous;
const clamp=(v,l,h)=>Math.max(l,Math.min(h,v));
const angle=(x,y)=>Math.round(Math.atan2(y,x)*A/(2*Math.PI))&(A-1);
const delta=(a,b)=>((b-a+2048)&4095)-2048;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function tile(x,y){return Math.floor(y/F)*map.width+Math.floor(x/F)}
function open(x,y){
 const i=Math.floor(x/F),j=Math.floor(y/F);
 return i>=0&&j>=0&&i<map.width&&j<map.height&&
 (rules.terrainSpeed?.[map.terrain[j*map.width+i]]??([2,4,6,8].includes(map.terrain[j*map.width+i])?0:1))>0;
}
function field(p){
 const w=map.width,h=map.height,n=w*h,d=new Int32Array(n).fill(-1),q=new Int32Array(n);let a=0,b=0;
 // Start from all passable tiles within the objective, not just its center.
 const cx=Math.floor(p.x/F),cy=Math.floor(p.y/F),r=Math.ceil(p.radius/F);
 for(let y=Math.max(0,cy-r);y<=Math.min(h-1,cy+r);y++)for(let x=Math.max(0,cx-r);x<=Math.min(w-1,cx+r);x++){
  const X=(x+.5)*F,Y=(y+.5)*F;
  if(open(X,Y)&&Math.hypot(X-p.x,Y-p.y)<p.radius*.72){const i=y*w+x;d[i]=0;q[b++]=i}
 }
 if(!b&&open(p.x,p.y)){let i=tile(p.x,p.y);d[i]=0;q[b++]=i}
 while(a<b){const i=q[a++],x=i%w,y=Math.floor(i/w);
  for(let k=0;k<4;k++){let xx=x+(k===0?1:k===1?-1:0),yy=y+(k===2?1:k===3?-1:0);
   if(xx<0||yy<0||xx>=w||yy>=h)continue;let z=yy*w+xx;
   if(d[z]<0&&open((xx+.5)*F,(yy+.5)*F)){d[z]=d[i]+1;q[b++]=z}
  }
 }
 return d;
}
function pathGoal(u,p,idx){
 if(distance(u,p)<p.radius*.72)return null;
 const d=fields[idx],i=tile(u.x,u.y),v=d[i];
 if(v===undefined||v<0)return p;
 const w=map.width,x=i%w,y=Math.floor(i/w);
 let best=null,score=Infinity;
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  if(!dx&&!dy)continue;const xx=x+dx,yy=y+dy,X=(xx+.5)*F,Y=(yy+.5)*F;
  if(!open(X,Y)||dx&&dy&&(!open((x+dx+.5)*F,(y+.5)*F)||!open((x+.5)*F,(y+dy+.5)*F)))continue;
  const n=d[yy*w+xx];if(n<0||n>=v)continue;
  const s=n+Math.abs(delta(u.heading,angle(X-u.x,Y-u.y)))/4096*.35+distance({x:X,y:Y},p)/F*.001;
  if(s<score){score=s;best={x:X,y:Y}}
 }
 return best||p;
}
function chooseTarget(u,contacts,spec){
 let best=null,score=Infinity;
 for(const c of contacts){let d=distance(u,c),range=spec.gun.maxRange;
  if(d>range*1.15||d<(spec.gun.minRange||0))continue;
  // Prefer weak, high-value units, but do not waste shots on unseen direct targets.
  if(spec.gun.mode==="direct"&&!c.seenBy.includes(u.id))continue;
  let s=d/F+(c.hpFrac/F)*7-(c.kind==="apc"?5:c.kind==="mbt"?3:0);
  if(s<score){best=c;score=s}
 }
 return best;
}
function pick(u,o,alive){
 const ps=o.objectives;
 if(!ps?.length)return -1;
 const assigned=assignment[u.id];
 if(assigned!==undefined&&alive.some(x=>x.id===u.id)){
  const p=ps[assigned];
  // APCs retain their assigned objective while alive; other units adapt to coverage.
  if(u.kind==="apc"){
   const here=ps[assigned];
   const other=alive.some(x=>x.kind==='apc'&&x.id!==u.id);
   if(other||here.owner!==side||here.state==='contested')return assigned;
   // A surviving APC can take a more valuable unheld point if it can reach it quickly.
   let best=assigned,utility=0;
   for(let j=0;j<ps.length;j++){const q=ps[j];if(j===assigned||q.owner===side)continue;
    const d=fields[j]?.[tile(u.x,u.y)];if(d<0||d===undefined)continue;
    const v=(q.weight-here.weight)*24-d*.4+(q.state==='empty'?8:0);
    if(v>utility){utility=v;best=j;}
   }return best;
  }
  if(p&&p.state==="contested")return assigned;
 }
 let idx=0,score=-Infinity;
 for(let i=0;i<ps.length;i++){
  const p=ps[i],d=fields[i]?.[tile(u.x,u.y)],travel=d>=0?d:distance(u,p)/F+30;
  const friendly=alive.filter(x=>x.id!==u.id&&distance(x,p)<p.radius*.85);
  const hasAPC=friendly.some(x=>x.kind==="apc");
  let s=p.weight*17-travel*.38-(hasAPC?12:0)+(p.state==="contested"?9:0)+(p.owner!==side?7:0);
  if(assigned===i)s+=7;
  // Tank supports threatened APCs instead of abandoning them for an empty hill.
  if(u.kind==='mbt'){
   const threatened=alive.some(x=>x.kind==='apc'&&distance(x,p)<p.radius*1.4&&o.contacts.some(c=>distance(c,x)<rules.units.mbt.gun.maxRange));
   if(threatened)s+=21;
  }
  if(s>score){score=s;idx=i}
 }
 return idx;
}
globalThis.controller={
 draft(h){const s=["apc","apc","mbt","scout"];return h.draft&&s.every(k=>h.draft.roster.includes(k))&&s.reduce((a,k)=>a+h.draft.costs[k],0)<=h.draft.budget?s:undefined},
 hello(h){
  rules=h.rules;map=h.map;side=h.side;points=h.objectives||[];fields=points.map(field);assignment={};blocked={};previous={};
  const apcs=h.units.filter(u=>u.kind==="apc"),used=new Set();
  for(const u of apcs){let best=-1,score=-Infinity;for(let i=0;i<points.length;i++){
    const p=points[i],d=fields[i][tile(u.x,u.y)],s=p.weight*30-(d>=0?d:distance(u,p)/F+100)-(used.has(i)?1000:0);
    if(s>score){best=i;score=s}}
   if(best>=0){assignment[u.id]=best;used.add(best)}
  }
  for(const u of h.units.filter(u=>u.kind!=="apc")){let best=-1,score=-Infinity;for(let i=0;i<points.length;i++){
   const p=points[i],d=fields[i][tile(u.x,u.y)],s=p.weight*15-(d>=0?d:distance(u,p)/F+60)*.5+(u.kind==="scout"&&!used.has(i)?24:0);
   if(s>score){best=i;score=s}}
   if(best>=0)assignment[u.id]=best;
  }
 },
 tick(o){
  const alive=o.units.filter(u=>u.alive),orders=[];
  for(const u of alive){
   const spec=rules.units[u.kind],order={id:u.id},i=pick(u,o,alive),p=i>=0?o.objectives[i]:{x:map.width*F/2,y:map.height*F/2,radius:F*2};
   let goal=i>=0?pathGoal(u,p,i):p;
   const target=chooseTarget(u,o.contacts,spec);
   if(target){
    // Extrapolate only a short distance, using the observed heading and speed.
    // Use a bounded prediction to avoid aiming far beyond a contact that turns.
    const travel=spec.gun.shellSpeed>0?distance(u,target)/spec.gun.shellSpeed:0;
    const lead=Math.min(8,Math.max(0,travel));
    const h=target.heading*2*Math.PI/A;
    const ax=Math.round(target.x+Math.cos(h)*target.speed*lead),ay=Math.round(target.y+Math.sin(h)*target.speed*lead);
    const aim=[clamp(ax,0,map.width*F-1),clamp(ay,0,map.height*F-1)],aimAngle=angle(aim[0]-u.x,aim[1]-u.y);
    order.aimAt=aim;
    if(spec.gun.mode==="direct"&&u.reload===0&&distance(u,target)<=spec.gun.maxRange&&Math.abs(delta(u.turret,aimAngle))<=spec.gun.aimTolerance)order.fire=aim;
   }
   if(o.canMove){
    // Never drift out of an objective after arrival. Move in from its rim.
    const on=distance(u,p)<p.radius*.72;
    if(on)goal=null;
    // A tank on a point turns its frontal armor toward a visible enemy.
    // Keep APCs inside capture range; move the tank only when its front is threatened.
    if(target&&u.kind==='mbt'&&distance(u,target)<spec.gun.maxRange*.55){
      const d=delta(u.heading,angle(target.x-u.x,target.y-u.y));
      if(Math.abs(d)>700&&on)goal=null;
    }
    // Preserve objective priority; MBT can engage while moving with independent turret.
    if(goal){
     let want=angle(goal.x-u.x,goal.y-u.y);
     const offsets=[0,341,-341,683,-683,1024,-1024];
     for(const off of offsets){const a=(want+off)&4095,rad=a*2*Math.PI/A;
      if(open(u.x+Math.cos(rad)*F*1.1,u.y+Math.sin(rad)*F*1.1)){want=a;break}}
     const d=delta(u.heading,want);
     order.steer=clamp(Math.round(d/spec.turnRate*F),-F,F);
     order.throttle=Math.abs(d)>600?0:Math.abs(d)>300?Math.round(F*.35):F;
     if(u.blocked){blocked[u.id]=(blocked[u.id]||0)+1;order.throttle=-Math.round(F*.6);order.steer=(Math.floor(blocked[u.id]/20)%2?1:-1)*F}
     else blocked[u.id]=0;
    }else{order.throttle=0;order.steer=0;
     if(target&&(u.kind==="scout"||u.kind==="mbt"||u.kind==="apc")){order.steer=clamp(Math.round(delta(u.heading,angle(target.x-u.x,target.y-u.y))/spec.turnRate*F),-F,F)}
    }
   }
   orders.push(order);
  }
  return{units:orders}
 }
};
