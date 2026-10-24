const overlay=document.querySelector('#site-entry');
const shell=[...document.querySelectorAll('.world-header,.side-nav,.bottom-nav,.world-footer,.workspace,.skip-link')];
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const key='field-entry-seen-v1';
let active=false,skipped=false,started=0,stage=0,saved=[],closing=null,generation=0;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function seen(){try{return sessionStorage.getItem(key)==='1';}catch{return false;}}
function remember(){try{sessionStorage.setItem(key,'1');}catch{}}
function update(step,label){
 stage=step;overlay.dataset.stage=String(step);
 overlay.querySelector('[data-entry-status]').textContent=label;
}
function begin(force=false){
 if(active||reduced()||(!force&&seen()))return false;
 generation++;active=true;skipped=false;closing=null;started=performance.now();
 saved=shell.map(node=>({node,inert:node.inert}));shell.forEach(node=>{node.inert=true;});
 overlay.hidden=false;overlay.classList.remove('is-leaving');
 update(0,'正在載入網站內容');
 return true;
}
function dismiss(token=generation){
 if(!active||token!==generation)return;
 const restoreFocus=overlay.contains(document.activeElement);
 overlay.hidden=true;overlay.classList.remove('is-leaving');
 saved.forEach(({node,inert})=>{node.inert=inert;});active=false;remember();
 if(restoreFocus)document.querySelector('#main')?.focus({preventScroll:true});
}
async function close(){
 if(!active)return;
 if(closing)return closing;
 const token=generation;
 closing=(async()=>{
  if(!skipped&&!reduced()){
   await wait(Math.max(0,550-(performance.now()-started)));
   if(!active||token!==generation)return;
   overlay.classList.add('is-leaving');await wait(380);
  }
  dismiss(token);
 })();
 return closing;
}
overlay.querySelector('[data-entry-skip]').addEventListener('click',()=>{skipped=true;dismiss();});
overlay.addEventListener('keydown',event=>{if(event.key==='Escape'){skipped=true;dismiss();}});
const preference=matchMedia('(prefers-reduced-motion: reduce)');
preference.addEventListener('change',()=>{if(preference.matches){skipped=true;dismiss();}});
document.querySelector('#replay-entry').addEventListener('click',async()=>{
 if(begin(true)){update(3,'影像與想法，持續收錄。');await close();}
});
begin();
export const entry={
 async prepare(){
  if(!active||skipped||reduced())return;
  const image=document.querySelector(document.body.dataset.screen==='photos'?'#gallery-image':'#featured-image');
  await Promise.race([Promise.allSettled([document.fonts.load('650 100px Saira'),image?.decode()]),wait(900)]);
 },
 contentReady(){update(1,'正在準備畫面');const author=window.siteContent?.settings?.author||'FIELD';overlay.querySelector('[data-entry-author]').textContent=author;},
 async finish(){update(3,'影像與想法，持續收錄。');await close();},
 async fail(){skipped=true;await close();},
 // Main is initially inert for data loading. Never restore that stale state after success.
 unlockMain(){const item=saved.find(item=>item.node.id==='main');if(item)item.inert=false;}
};
