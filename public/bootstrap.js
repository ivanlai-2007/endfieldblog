import '/motion.js';
import {entry} from '/entry.js';
const status=document.querySelector('#site-load-status');
document.querySelector('#retry-site').addEventListener('click',()=>location.reload());
try {
 const response=await fetch('/api/content',{cache:'no-store',signal:AbortSignal.timeout(15_000)});const data=await response.json();
 if(!response.ok)throw new Error(data.error||'暫時無法取得內容。');
 window.siteContent=data;entry.contentReady();await import('/app.js');
 await entry.prepare();entry.unlockMain();await entry.finish();
 document.body.removeAttribute('data-loading');document.querySelector('#main').removeAttribute('inert');document.querySelector('#main').hidden=false;document.querySelector('#server-preview')?.remove();document.querySelector('#main').removeAttribute('aria-busy');status.hidden=true;
 void import('/visits.js').then(({initVisits})=>initVisits()).catch(()=>{});
}catch(error){await entry.fail();status.querySelector('p').textContent=error.name==='TimeoutError'?'載入時間較久，請稍後重新載入。':error.message;document.querySelector('#retry-site').hidden=false;}
