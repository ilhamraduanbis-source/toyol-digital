import { waitForEvenAppBridge, TextContainerProperty, CreateStartUpPageContainer,
  TextContainerUpgrade, OsEventTypeList } from '@evenrealities/even_hub_sdk'
import { assess, hudText } from './decision.mjs'

type Entry = {title:string;detail:string}
const entries:Entry[]=[
  {title:'POCKETOPS 1/4 · Even G2',detail:'SDK + package built\nSimulator proof needed\nNo hardware purchased'},
  {title:'POCKETOPS 2/4 · Firebase',detail:'Device-first by default\nCloud spending disabled\nReal inference needed'},
  {title:'POCKETOPS 3/4 · KaneCLI',detail:'Free credits require login\nAuthentic Kane test needed\nPublic posts required'},
  {title:'POCKETOPS 4/4 · Tenstorrent',detail:'Python tests are not hardware\nCompeting PR exists\nNo automatic bounty claims'},
]
let index=0
const pre=document.querySelector<HTMLPreElement>('#hud')!
const status=document.querySelector<HTMLElement>('#bridge-status')!
const decision=document.querySelector<HTMLElement>('#decision')!
const task=document.querySelector<HTMLTextAreaElement>('#task')!
const evidence=document.querySelector<HTMLSelectElement>('#evidence')!
function displayText(){const e=entries[index];return e.title+'\n'+e.detail+'\nCard '+(index+1)+'/'+entries.length}
pre.textContent=displayText()
const bridge=await waitForEvenAppBridge()
const page=new TextContainerProperty({
  xPosition:0,yPosition:0,width:576,height:288,borderWidth:2,borderColor:5,paddingLength:4,
  containerID:1,containerName:'pocketops',content:displayText(),isEventCapture:1,
})
const initialized=await bridge.createStartUpPageContainer(new CreateStartUpPageContainer({containerTotalNum:1,textObject:[page]}))
if(initialized!==0){status.textContent='BRIDGE_CREATE_FAILED '+initialized;throw Error(status.textContent)}
status.textContent='BRIDGE_READY'
console.log('POCKETOPS_BRIDGE_READY')
async function show(){
  await bridge.textContainerUpgrade(new TextContainerUpgrade({containerID:1,containerName:'pocketops',content:displayText()}))
  pre.textContent=displayText()
  console.log('POCKETOPS_CARD_'+(index+1))
}
function next(){index=(index+1)%entries.length;void show()}
function prev(){index=(index+entries.length-1)%entries.length;void show()}
document.querySelector('#next')!.addEventListener('click',next)
document.querySelector('#prev')!.addEventListener('click',prev)
document.querySelector('#assess')!.addEventListener('click',()=>{
  try {
    const result=assess(task.value,evidence.value)
    decision.textContent=result.status+' · '+result.reason+' NEXT: '+result.next
    entries.push({title:'WORK ITEM · '+result.status,detail:hudText(task.value,result)})
    index=entries.length-1;void show()
  } catch(e){decision.textContent=String(e)}
})
document.querySelector('#ai')!.addEventListener('click',async()=>{
  const api=(globalThis as unknown as {LanguageModel?:{
    availability:()=>Promise<string>;
    create:()=>Promise<{prompt:(s:string)=>Promise<string>;destroy?:()=>void}>
  }}).LanguageModel
  if(!api){decision.textContent='Local AI not available; cloud not called.';return}
  try {
    const availability=await api.availability()
    if(availability!=='available'){decision.textContent='Local AI '+availability+'; download and cloud blocked.';return}
    if(!task.value.trim()){decision.textContent='Enter a work item.';return}
    const model=await api.create()
    try {
      const response=await model.prompt('In 2 sentences give cautious next-step advice, without asserting external evidence, payments or test results: '+task.value.slice(0,240))
      decision.textContent='ON_DEVICE_AI_UNVERIFIED: '+response.slice(0,400)
      entries.push({title:'ON-DEVICE AI · DRAFT',detail:response.slice(0,320)})
      index=entries.length-1;await show()
    } finally {model.destroy?.()}
  } catch(e){decision.textContent='Local model failed; cloud not called. '+String(e)}
})
function getEventType(x?:{eventType?:OsEventTypeList}):OsEventTypeList|null{
  return x?(x.eventType??OsEventTypeList.CLICK_EVENT):null
}
const unsub=bridge.onEvenHubEvent(event=>{
  const sys=getEventType(event.sysEvent),text=getEventType(event.textEvent)
  if(sys===OsEventTypeList.DOUBLE_CLICK_EVENT||text===OsEventTypeList.DOUBLE_CLICK_EVENT){
    void bridge.shutDownPageContainer(1);return
  }
  if(text===OsEventTypeList.SCROLL_TOP_EVENT||sys===OsEventTypeList.SCROLL_TOP_EVENT){prev();return}
  if(text===OsEventTypeList.SCROLL_BOTTOM_EVENT||sys===OsEventTypeList.SCROLL_BOTTOM_EVENT){next();return}
  if(sys===OsEventTypeList.CLICK_EVENT||text===OsEventTypeList.CLICK_EVENT){next();return}
  if(sys===OsEventTypeList.SYSTEM_EXIT_EVENT||sys===OsEventTypeList.ABNORMAL_EXIT_EVENT){unsub()}
})
