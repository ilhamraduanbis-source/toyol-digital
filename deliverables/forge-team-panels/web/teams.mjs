// Mech Market spectator team cards. Render public data only, using text nodes.
import {formatMicros} from '../src/core/money.mjs';
import {TEAMS} from '../src/core/roster.mjs';
const policyFields=[
 ['preferredRange','Preferred range'],['aggression','Aggression'],['retreatHull','Retreat hull'],
 ['shieldThreshold','Shield threshold'],['energyReserve','Energy reserve'],['focusWeakness','Focus weakness'],
 ['strafeBias','Strafe bias'],['aimLead','Aim lead'],['burstThreshold','Burst threshold'],['coverWeight','Cover weight']
];
const known=new Map(TEAMS.map(t=>[t.id,t]));
const num=v=>Number.isSafeInteger(v)?String(v):'—';
const money=v=>Number.isSafeInteger(v)&&v>=0?formatMicros(v)+' OUSD':'—';
function element(doc,tag,text,cls){
 const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;
}
function pair(doc,parent,label){
 const dt=element(doc,'dt',label),dd=element(doc,'dd','—');
 parent.append(dt,dd);return dd;
}
function makeCard(view,id){
 const doc=view.container.ownerDocument,meta=known.get(id);
 const card=element(doc,'article',undefined,'team-card');
 const title=element(doc,'h3',meta.name,'team-name');
 card.setAttribute('aria-label',meta.name);
 card.style.borderInlineStart='4px solid '+meta.color;
 const stats=element(doc,'dl',undefined,'team-stats');
 const points=pair(doc,stats,'Points'),hull=pair(doc,stats,'Hull'),energy=pair(doc,stats,'Energy');
 const treasuryTitle=element(doc,'h4','Treasury');
 const budget=element(doc,'dl',undefined,'team-budget');
 const available=pair(doc,budget,'Available'),committed=pair(doc,budget,'Committed'),spent=pair(doc,budget,'Spent');
 const policyTitle=element(doc,'h4','Current policy');
 const policy=element(doc,'dl',undefined,'team-policy');
 const values=new Map(policyFields.map(([k,label])=>[k,pair(doc,policy,label)]));
 card.append(title,stats,treasuryTitle,budget,policyTitle,policy);
 view.container.append(card);
 return {card,title,points,hull,energy,available,committed,spent,values};
}
export function mountTeams(root){
 if(!root||typeof root.append!=='function')throw new Error('invalid_team_root');
 const container=element(root.ownerDocument,'section',undefined,'team-panels');
 container.setAttribute('aria-label','Teams');
 root.append(container);
 const view={container,cards:new Map(),disposed:false};
 for(const t of TEAMS)view.cards.set(t.id,makeCard(view,t.id));
 return view;
}
export function renderTeams(view,teams){
 if(!view||view.disposed)return;
 const incoming=new Map();
 if(Array.isArray(teams))for(const t of teams)if(t&&known.has(t.id)&&!incoming.has(t.id))incoming.set(t.id,t);
 for(const [id,ui] of view.cards){
  const t=incoming.get(id),meta=known.get(id);
  ui.card.hidden=!t;
  const name=typeof t?.name==='string'&&t.name.length?t.name:meta.name;
  ui.title.textContent=name;ui.card.setAttribute('aria-label',name);
  ui.points.textContent=num(t?.points);ui.hull.textContent=num(t?.hull);ui.energy.textContent=num(t?.energy);
  const b=t?.budget;
  ui.committed.textContent=money(b?.committedMicros);
  ui.spent.textContent=money(b?.spentMicros);
  let available;
  if([b?.capMicros,b?.committedMicros,b?.spentMicros].every(v=>Number.isSafeInteger(v)&&v>=0)&&b.committedMicros<=b.capMicros&&b.spentMicros<=b.capMicros-b.committedMicros)available=b.capMicros-b.committedMicros-b.spentMicros;
  ui.available.textContent=money(available);
  for(const [k,node] of ui.values)node.textContent=num(t?.policy?.[k]);
 }
}
export function disposeTeams(view){
 if(!view||view.disposed)return;
 view.disposed=true;view.cards.clear();view.container.remove();
}
