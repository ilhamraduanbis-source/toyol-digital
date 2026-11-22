// Toyol Digital | Self-owned vesting calculation skill | 2026-11-22.
// MIT engine for clone interoperability. Commercial offline interface ships separately.
// No chain access, private keys, approvals, value estimation, transfers or wallets.
export function units(value, decimals=18) {
  if (!Number.isInteger(decimals)||decimals<0||decimals>18)throw Error('decimals 0..18 required');
  const str=String(value??'');
  if(!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(str))throw Error('invalid nonnegative decimal');
  const [whole,fraction='']=str.split('.');
  if(whole.length>30||fraction.length>decimals)throw Error('amount exceeds safe precision policy');
  return BigInt(whole)*10n**BigInt(decimals)+BigInt(fraction.padEnd(decimals,'0')||'0');
}
export function printUnits(amount,decimals=18) {
  const n=BigInt(amount),base=10n**BigInt(decimals),sign=n<0n?'-':'',v=n<0n?-n:n;
  return sign+(v/base)+(decimals?((v%base).toString().padStart(decimals,'0').replace(/0+$/,'')||'')?'.'+(v%base).toString().padStart(decimals,'0').replace(/0+$/,''):'':'');
}
export function utcDay(date) {
  if(!/^\d{4}-\d\d-\d\d$/.test(date))throw Error('YYYY-MM-DD expected');
  const at=Date.parse(date+'T00:00:00Z');
  if(!Number.isFinite(at)||new Date(at).toISOString().slice(0,10)!==date)throw Error('invalid UTC day');
  return at;
}
export function monthsLater(dateMillis,months) {
  if(!Number.isInteger(months)||months<0||months>240)throw Error('months out of range');
  const d=new Date(dateMillis),first=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+months,1));
  const max=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  return Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),Math.min(d.getUTCDate(),max));
}
export function vested({amount,tgePercent='0',cliffMonths=0,durationMonths=12,cadence='monthly',decimals=18},startDay,asOfDay) {
  const start=utcDay(startDay),at=utcDay(asOfDay),total=units(amount,decimals);
  const bps=String(tgePercent).match(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/);
  if(!bps)throw Error('tge percent malformed');
  const [a,b='']=String(tgePercent).split('.');
  const percentage=BigInt(a)*100n+BigInt(b.padEnd(2,'0')||'0');
  if(percentage>10000n)throw Error('TGE over 100%');
  if(!Number.isInteger(durationMonths)||durationMonths<1||durationMonths>240||
     !Number.isInteger(cliffMonths)||cliffMonths<0||cliffMonths>durationMonths)throw Error('invalid duration or cliff');
  if(!['linear','monthly'].includes(cadence))throw Error('cadence must be linear or monthly');
  if(at<start)return 0n;
  const tge=total*percentage/10000n,remaining=total-tge;
  const end=monthsLater(start,durationMonths),cliff=monthsLater(start,cliffMonths);
  if(at>=end)return total;
  if(at<cliff)return tge;
  if(cadence==='linear')return tge+remaining*BigInt(at-start)/BigInt(end-start);
  let elapsed=0;
  for(let i=1;i<=durationMonths;i++)if(at>=monthsLater(start,i))elapsed=i;else break;
  return tge+remaining*BigInt(elapsed)/BigInt(durationMonths);
}
export function summary(group,startDay,asOfDay) {
  const total=units(group.amount,group.decimals??18),unlocked=vested(group,startDay,asOfDay);
  const claimed=units(group.claimed??'0',group.decimals??18);
  if(claimed>total)throw Error('claimed exceeds grant');
  return {name:group.name,total,unlocked,locked:total-unlocked,claimed,
    claimable:claimed>=unlocked?0n:unlocked-claimed,overclaimed:claimed>unlocked};
}
export function validateSupply(groups,supply,decimals=18) {
  const allocated=groups.reduce((a,g)=>a+units(g.amount,decimals),0n);
  const all=units(supply,decimals);
  if(allocated>all)throw Error('allocated exceeds total supply');
  return {allocated,unallocated:all-allocated};
}