import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {recordVisit,publicVisits,skipVisit} from '../server/visits.mjs';
import {AppError} from '../server/content.mjs';
function store(time=Date.parse('2026-10-23T15:59:50Z')){
 let row=null,rev=0;return {now:()=>time,setTime:t=>{time=t;},pause:async()=>{},read:async()=>structuredClone(row),write:async(value,etag)=>{if(etag!==row?.etag)throw new AppError(409,'conflict');row={value:structuredClone(value),etag:String(++rev)};}};
}
test('瀏覽寫入持久總數，重試同一事件不會重複計算，對外不暴露去重資料',async()=>{
 const db=store(),id=randomUUID();assert.equal((await recordVisit(id,db)).total,1);assert.equal((await recordVisit(id,db)).total,1);
 const result=await recordVisit(randomUUID(),db);assert.equal(result.total,2);assert.equal(result.today,2);assert.ok(!('recent' in result));
});
test('台北午夜只重設今日數字，累計與開始日期保留',async()=>{
 const db=store(),id=randomUUID();const first=await recordVisit(id,db);
 db.setTime(Date.parse('2026-10-23T16:00:01Z'));
 assert.equal(publicVisits((await db.read()).value,db.now()).today,0);
 assert.equal((await recordVisit(id,db)).today,0);
 const next=await recordVisit(randomUUID(),db);assert.equal(next.total,2);assert.equal(next.today,1);assert.equal(next.startedAt,first.startedAt);
});
test('同時首次建立及並行更新會重試，不遺失瀏覽次數',async()=>{
 const db=store();await Promise.all(Array.from({length:8},()=>recordVisit(randomUUID(),db)));assert.equal((await db.read()).value.total,8);
});
test('並行重送相同事件及寫入後網路錯誤只記一次',async()=>{
 const db=store(),id=randomUUID();await Promise.all(Array.from({length:4},()=>recordVisit(id,db)));assert.equal((await db.read()).value.total,1);
 const write=db.write;let fail=true;db.write=async(...args)=>{await write(...args);if(fail){fail=false;throw new Error('response lost');}};
 assert.equal((await recordVisit(randomUUID(),db)).total,2);
});
test('清除過期事件、拒絕無效事件，儲存失敗不回傳假的成功數字',async()=>{
 const db=store();await assert.rejects(recordVisit('anything',db),/格式/);await recordVisit(randomUUID(),db);db.setTime(db.now()+121_000);await recordVisit(randomUUID(),db);assert.equal((await db.read()).value.recent.length,1);
 db.write=async()=>{throw new Error('storage offline');};await assert.rejects(recordVisit(randomUUID(),db),/storage offline/);
});
test('已知爬蟲與隱私偏好不計數，無紀錄狀態顯示零',()=>{
 assert.equal(skipVisit(new Request('https://site.test',{headers:{'user-agent':'Googlebot'}})),true);
 assert.equal(skipVisit(new Request('https://site.test',{headers:{dnt:'1'}})),true);
 assert.equal(skipVisit(new Request('https://site.test',{headers:{'sec-gpc':'1'}})),true);
 assert.equal(skipVisit(new Request('https://site.test',{headers:{'user-agent':'Mozilla/5.0 Safari'}})),false);
 assert.deepEqual(publicVisits(null),{total:0,today:0,startedAt:null,timeZone:'Asia/Taipei'});
});
