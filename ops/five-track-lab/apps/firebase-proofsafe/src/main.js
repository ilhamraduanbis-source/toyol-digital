import {initializeApp} from 'firebase/app'
import {getAI,getGenerativeModel,GoogleAIBackend,InferenceMode} from 'firebase/ai'
import {hasFirebaseConfig,safePrompt,chooseMode} from './policy.mjs'

const result=document.querySelector('#result')
const configLabel=document.querySelector('#config')
const config={
 apiKey:import.meta.env.VITE_FIREBASE_API_KEY||'',
 authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN||'',
 projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID||'',
 appId:import.meta.env.VITE_FIREBASE_APP_ID||'',
}
const quotaVerified=import.meta.env.VITE_FREE_QUOTA_VERIFIED==='true'
const billingDisabledConfirmed=import.meta.env.VITE_BILLING_DISABLED_CONFIRMED==='true'
const cloudFeatureEnabled=import.meta.env.VITE_ALLOW_CLOUD==='true'
const ready=hasFirebaseConfig(config)
configLabel.textContent=ready?'Firebase configuration provided (not remotely validated).':'Firebase project configuration required. No SDK inference will run.'
let ai=null
if(ready) {
 const app=initializeApp(config)
 ai=getAI(app,{backend:new GoogleAIBackend()})
}
document.querySelector('#generate').addEventListener('click',async()=>{
 try {
  const prompt=safePrompt(document.querySelector('#prompt').value)
  if(!ai) throw Error("No Firebase project configured; zero calls made.")
  const mode=chooseMode({
   userConsent:document.querySelector('#consent').checked,
   quotaVerified,billingDisabledConfirmed,cloudFeatureEnabled,
  })
  const sdkMode=mode==='PREFER_ON_DEVICE'?InferenceMode.PREFER_ON_DEVICE:InferenceMode.ONLY_ON_DEVICE
  const model=getGenerativeModel(ai,{mode:sdkMode})
  result.textContent='SDK mode: '+mode+' · preparing device model…'
  await model.initializeDeviceModel((fraction)=>{
   result.textContent='Device preparation '+Math.round(fraction*100)+'% · mode '+mode
  })
  const response=await model.generateContent(prompt)
  const text=response.response.text()
  result.textContent='SDK_RESULT · '+mode+' · '+text
 } catch(e) {
  result.textContent='NO CLAIM OF INFERENCE OR CLOUD FALLBACK · '+String(e)
 }
})
