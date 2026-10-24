import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../public/entry.js',import.meta.url),'utf8').replace('export const entry=','globalThis.entry=');
function fixture({reduced=false,seen=false}={}){
 const node=()=>({inert:false,hidden:true,dataset:{},textContent:'',events:{},classList:{add(){},remove(){}},addEventListener(name,fn){this.events[name]=fn;},focus(){}});
 const skip=node(),replay=node(),status=node(),author=node(),overlay=node(),main=node(),nav=node();main.id='main';main.inert=true;overlay.contains=()=>false;overlay.querySelector=s=>s==='[data-entry-skip]'?skip:s==='[data-entry-status]'?status:author;
 const preference={matches:reduced,addEventListener(){}};const timers=[];let marked=seen;
 const context={document:{querySelector:s=>s==='#site-entry'?overlay:s==='#replay-entry'?replay:s==='#main'?main:null,querySelectorAll:()=>[main,nav],fonts:{load:async()=>{}}},window:{siteContent:{settings:{author:'FIELD'}}},matchMedia:()=>preference,sessionStorage:{getItem:()=>marked?'1':null,setItem(){marked=true;}},performance:{now:()=>0},setTimeout:fn=>{timers.push(fn);},console};
 runInNewContext(source,context);
 const tick=async()=>{timers.shift()?.();await Promise.resolve();await Promise.resolve();};
 return {...context,overlay,main,nav,skip,replay,tick,timers};
}
test('首次開場暫停底層互動，完成後恢復主內容與導覽',async()=>{
 const f=fixture();assert.equal(f.overlay.hidden,false);assert.equal(f.nav.inert,true);
 f.entry.unlockMain();const done=f.entry.finish();await f.tick();await f.tick();await done;
 assert.equal(f.overlay.hidden,true);assert.equal(f.main.inert,false);assert.equal(f.nav.inert,false);
});
test('減少動態效果與同分頁再次訪問不阻擋內容',()=>{
 for(const options of [{reduced:true},{seen:true}]){const f=fixture(options);assert.equal(f.overlay.hidden,true);assert.equal(f.nav.inert,false);}
});
test('退場中略過立即移除；上一輪延遲回呼不會關閉新重播',async()=>{
 const f=fixture();f.entry.unlockMain();const first=f.entry.finish();f.skip.events.click();assert.equal(f.overlay.hidden,true);assert.equal(f.nav.inert,false);
 const replay=f.replay.events.click();assert.equal(f.overlay.hidden,false);await f.tick();await first;assert.equal(f.overlay.hidden,false);
 await f.tick();await f.tick();await replay;assert.equal(f.overlay.hidden,true);assert.equal(f.main.inert,false);
});
test('載入失敗會解除開場，保留主區載入鎖供錯誤與重試介面處理',async()=>{
 const f=fixture();await f.entry.fail();assert.equal(f.overlay.hidden,true);assert.equal(f.nav.inert,false);assert.equal(f.main.inert,true);
});
