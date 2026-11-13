// One-time Toku onboarding. No deposit, hiring, withdrawal or bank details handled.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
const root='https://www.toku.agency',repo='ilhamraduanbis-source/toyol-digital';
const dir=join(process.env.HOME,'.toyol','toku'),file=join(dir,'identity.json');
const need=(ok,msg)=>{if(!ok)throw Error(msg);};
async function api(path,method='GET',body,key){
 const headers={Accept:'application/json'};
 if(key)headers.Authorization='Bearer '+key;
 if(body!==undefined)headers['Content-Type']='application/json';
 const r=await fetch(root+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('TOKU_HTTP_'+r.status+'_'+path);
 return r.json();
}
async function main(){
 process.umask(0o077);mkdirSync(dir,{recursive:true,mode:0o700});
 let state;
 if(existsSync(file)){
  state=JSON.parse(readFileSync(file,'utf8'));
 }else{
  const rl=createInterface({input:process.stdin,output:process.stdout});
  let email;
  try{email=(await rl.question('Masukkan email sendiri untuk pemilikan akaun Toku: ')).trim();}finally{rl.close();}
  need(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email),'EMAIL_INVALID');
  const out=await api('/api/agents/register','POST',{name:'Toyol Digital',description:'AI-assisted software testing, data conversion, technical documentation and research, operated with human oversight. No paid subcontracting or speculative transactions.',ownerEmail:email});
  const a=out.agent;
  need(a?.name==='Toyol Digital'&&typeof a.id==='string'&&typeof a.apiKey==='string'&&a.apiKey.length>10,'REGISTRATION_NOT_CONFIRMED');
  state={id:a.id,key:a.apiKey};
  writeFileSync(file,JSON.stringify(state),{mode:0o600,flag:'wx'});
 }
 need(typeof state.id==='string'&&typeof state.key==='string'&&state.key.length>10,'LOCAL_IDENTITY_INVALID');
 const p=await api('/api/agents/me','GET',undefined,state.key);
 need(p.agent?.id===state.id&&p.agent?.name==='Toyol Digital','PROFILE_MISMATCH');
 console.log('TOKU_REGISTERED',p.agent.id,p.agent.status??'UNKNOWN');
 const g=spawnSync('gh',['secret','set','TOYOL_TOKU_API_KEY','--repo',repo],{input:state.key,encoding:'utf8',timeout:30000});
 need(!g.error&&g.status===0,'GITHUB_SECRET_NOT_SET_LOCAL_KEY_SAVED');
 console.log('TOKU_GITHUB_SECRET_READY');
 const setup=await api('/api/agents/me/setup','GET',undefined,state.key);
 console.log('TOKU_SETUP',JSON.stringify({score:setup.setupScore??null,ready:setup.ready===true,remaining:(setup.steps??[]).filter(x=>!x.done).map(x=>x.id)}));
 const status=await api('/api/agents/connect','GET',undefined,state.key);
 if(status.payoutsEnabled===true){console.log('TOKU_PAYOUT_ENABLED');return;}
 if(!process.argv.includes('--connect')){console.log('TOKU_PAYOUT_NOT_ENABLED');return;}
 const c=await api('/api/agents/connect','POST',{},state.key);
 const u=new URL(c.onboardingUrl);
 need(u.protocol==='https:'&&u.hostname==='connect.stripe.com'&&!u.username&&!u.password,'ONBOARDING_URL_INVALID');
 const o=spawnSync('termux-open-url',[u.href],{stdio:'ignore',timeout:15000});
 need(!o.error&&o.status===0,'BROWSER_OPEN_FAILED_RUN_CONNECT_AGAIN');
 console.log('TOKU_STRIPE_OPENED_COMPLETE_IN_BROWSER');
}
main().catch(e=>{console.error('TOKU_STOPPED:',String(e.message).slice(0,150));process.exitCode=1;});
