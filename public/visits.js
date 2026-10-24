const storageKey='field-view-window-v1';
const number=new Intl.NumberFormat('zh-TW');
let pending=false,lastRead=0;
function eventId(){
 const now=Date.now();
 try{const old=JSON.parse(localStorage.getItem(storageKey));if(old?.id&&now>=old.at&&now-old.at<30_000)return old.id;}catch{}
 const id=crypto.randomUUID();
 try{localStorage.setItem(storageKey,JSON.stringify({id,at:now}));}catch{}
 return id;
}
function render(data){
 if(!Number.isSafeInteger(data.total)||!Number.isSafeInteger(data.today))throw new Error('Invalid stats');
 document.querySelector('#visits-total').textContent=number.format(data.total);
 document.querySelector('#visits-today').textContent=number.format(data.today);
 const since=data.startedAt?new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(data.startedAt)):null;
 document.querySelector('#visits-status').textContent=since?`自 ${since} 起記錄 · 台北時間`:'等待第一筆瀏覽';
 lastRead=Date.now();
}
async function request(options){
 const response=await fetch('/api/visits',{cache:'no-store',signal:AbortSignal.timeout(12_000),...options});
 if(!response.ok)throw new Error('Stats unavailable');
 render(await response.json());
}
export async function refreshVisits(){
 if(pending||Date.now()-lastRead<60_000)return;
 pending=true;
 try{await request();}catch{document.querySelector('#visits-status').textContent='統計暫時無法讀取';}finally{pending=false;}
}
export async function initVisits(){
 // One document load = one view. SPA tab changes and photo switches are not views.
 pending=true;
 try{
  const optOut=navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true;
  await request(optOut?undefined:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:eventId()})});
 }catch{try{await request();}catch{document.querySelector('#visits-status').textContent='統計暫時無法讀取';}}
 finally{pending=false;}
}
window.addEventListener('hashchange',()=>{if(location.hash==='#about')void refreshVisits();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&location.hash==='#about')void refreshVisits();});
