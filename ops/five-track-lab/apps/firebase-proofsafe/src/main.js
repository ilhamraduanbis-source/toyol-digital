import {initializeApp} from 'firebase/app'
import {getAI,getGenerativeModel,GoogleAIBackend,InferenceMode} from 'firebase/ai'
import {initializeAppCheck,ReCaptchaEnterpriseProvider} from 'firebase/app-check'
import {hasFirebaseConfig,safePrompt,chooseMode} from './policy.mjs'
import {classifySource,createLocalEvidence} from './source.mjs'

const result=document.querySelector('#result')
const configLabel=document.querySelector('#config')
const routeLabel=document.querySelector('#route')
const download=document.querySelector('#download')
const generate=document.querySelector('#generate')
const config={
 apiKey:import.meta.env.VITE_FIREBASE_API_KEY||'',
 authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN||'',
 projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID||'',
 appId:import.meta.env.VITE_FIREBASE_APP_ID||'',
}
const quotaVerified=import.meta.env.VITE_FREE_QUOTA_VERIFIED==='true'
const billingDisabledConfirmed=import.meta.env.VITE_BILLING_DISABLED_CONFIRMED==='true'
const cloudFeatureEnabled=import.meta.env.VITE_ALLOW_CLOUD==='true'
const appCheckSiteKey=import.meta.env.VITE_APP_CHECK_SITE_KEY||''
const ready=hasFirebaseConfig(config)
configLabel.textContent=ready
  ? 'Project config present. Actual Firebase access and free-tier quota are NOT remotely verified.'
  : 'No Firebase project configured. This public preview cannot send inference requests.'
let ai=null
if(ready) {
 const app=initializeApp(config)
 if(appCheckSiteKey) {
   initializeAppCheck(app,{
     provider:new ReCaptchaEnterpriseProvider(appCheckSiteKey),
     isTokenAutoRefreshEnabled:true
   })
 } else {
   configLabel.textContent+=' App Check production site key missing.'
 }
 ai=getAI(app,{backend:new GoogleAIBackend()})
}
let lastEvidence=null
download.disabled=true
generate.addEventListener('click',async()=>{
 lastEvidence=null
 download.disabled=true
 generate.disabled=true
 try {
  const prompt=safePrompt(document.querySelector('#prompt').value)
  if(!ai) throw Error('No Firebase project configured; zero SDK inference calls made.')
  if(!appCheckSiteKey) throw Error('No App Check site key configured. Aborting remote inference.')
  const mode=chooseMode({
   userConsent:document.querySelector('#consent').checked,
   quotaVerified,billingDisabledConfirmed,cloudFeatureEnabled
  })
  const sdkMode=mode==='PREFER_ON_DEVICE'
    ? InferenceMode.PREFER_ON_DEVICE : InferenceMode.ONLY_ON_DEVICE
  const model=getGenerativeModel(ai,{mode:sdkMode})
  routeLabel.textContent='Requested mode: '+mode+' | Actual source: pending'
  result.textContent='Initializing device model... no fabricated response.'
  const preparation=model.initializeDeviceModel((fraction)=>{
    const percentage=Math.round(fraction*100)
    result.textContent='Device preparation '+percentage+'% (not proof of inference)'
  })
  // Firebase docs: waiting for the model to download before PREFER mode
  // would prevent the intended cloud fallback. Cloud route is guarded above.
  if(mode==='ONLY_ON_DEVICE') {
    await preparation
  } else {
    void preparation.catch((error)=>console.warn('Local preparation failed',String(error)))
  }
  const response=await model.generateContent(prompt)
  const answer=response.response.text()
  const source=classifySource(response.response.inferenceSource)
  routeLabel.textContent='Requested mode: '+mode+' | Actual SDK source: '+source
  result.textContent=answer
  if(source!=='UNKNOWN') {
    lastEvidence=createLocalEvidence({
      modelMode:mode,inferenceSource:source,responseLength:answer.length
    })
    download.disabled=false
  } else {
    result.textContent+='\n[SDK did not report an inferencing source; not claiming local or cloud proof]'
  }
 } catch(error) {
  routeLabel.textContent='No successful, verifiable Firebase inference'
  result.textContent='REQUEST NOT CONFIRMED: '+String(error)
 } finally {
  generate.disabled=false
 }
})
download.addEventListener('click',()=>{
 if(!lastEvidence) return
 const link=document.createElement('a')
 const objectUrl=URL.createObjectURL(new Blob(
  [JSON.stringify(lastEvidence,null,2)],{type:'application/json'}
 ))
 link.href=objectUrl
 link.download='proofsafe-firebase-client-observation.json'
 link.click()
 setTimeout(()=>URL.revokeObjectURL(objectUrl),1000)
})
