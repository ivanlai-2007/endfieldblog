import {test} from 'node:test';
import assert from 'node:assert/strict';
import seed from './helpers/content-fixture.mjs';
import {AppError} from '../server/content.mjs';
import {purgePhoto,planPhotoPurge,assertContentWritable} from '../server/photo-purge.mjs';
const file='11111111-1111-1111-1111-111111111111.webp',thumb='22222222-2222-2222-2222-222222222222.webp';
function fixture(){const content=structuredClone(seed);content.photos[0]={...content.photos[0],file:'/api/media?key='+file,thumbnail:'/api/media?key='+thumb,status:'deleted'};let row={value:{content,auth:{version:1},updatedAt:'2020-01-01'},etag:'r1'},sequence=1;const calls=[];return {
 read:async()=>structuredClone(row),
 commit:async(value,etag)=>{if(row.etag!==etag)throw new AppError(409,'conflict');row={value:structuredClone(value),etag:'r'+ ++sequence};return {etag:row.etag};},
 deleteFiles:async keys=>{calls.push([...keys]);},calls,
 input:{id:content.photos[0].id,title:content.photos[0].title,revision:'r1',confirmation:'permanently-delete'}
};}
test('永久刪除呼叫圖檔清除、移除紀錄，舊備份不能恢復已清除圖片',async()=>{
 const store=fixture(),before=await store.read();const result=await purgePhoto(store.input,before,store);
 assert.deepEqual(store.calls,[[file,thumb]]);assert.ok(!result.content.photos.some(p=>p.id===store.input.id));
 assert.equal(result.deletedFiles,2);const after=await store.read();assert.ok(!after.value.photoPurge);
 assert.throws(()=>assertContentWritable(after.value,before.value.content),/永久刪除/);
 const backup=structuredClone(before.value.content);backup.photos[0].id='new-id';assert.throws(()=>assertContentWritable(after.value,backup),/永久刪除/);
 await purgePhoto(store.input,after,store);assert.equal(store.calls.length,1);
});
test('非垃圾桶、舊修訂或未確認的請求不會清除任何圖檔',async()=>{
 const store=fixture(),saved=await store.read();
 await assert.rejects(purgePhoto({...store.input,confirmation:''},saved,store),/確認永久刪除/);
 await assert.rejects(purgePhoto({...store.input,revision:'old'},saved,store),/內容已更新/);
 saved.value.content.photos[0].status='published';await assert.rejects(purgePhoto(store.input,saved,store),/先將照片移到垃圾桶/);
 assert.equal(store.calls.length,0);
});
test('其他照片使用相同檔案時保留共用檔案，只清除未共用的縮圖',async()=>{
 const store=fixture(),saved=await store.read();saved.value.content.photos[1].file=saved.value.content.photos[0].file;
 const plan=planPhotoPurge(saved.value.content,store.input.id);assert.deepEqual(plan.keys,[thumb]);assert.equal(plan.shared,true);
});
test('任何文章仍引用圖片時拒絕永久刪除',()=>{
 const store=fixture();return store.read().then(saved=>{saved.value.content.notes.push({title:'草稿中的插圖',status:'draft',markdown:`![圖](/api/media?key=${file})`});assert.throws(()=>planPhotoPurge(saved.value.content,store.input.id),/草稿中的插圖/);assert.equal(store.calls.length,0);});
});
test('物理清除失敗時保留可重試狀態，禁止還原；重試成功才移除紀錄',async()=>{
 const store=fixture();let fail=true;const original=store.deleteFiles;
 store.deleteFiles=async keys=>{if(fail)throw new Error('network');await original(keys);};
 await assert.rejects(purgePhoto(store.input,await store.read(),store),/尚未完全清除/);
 let pending=await store.read();assert.equal(pending.value.content.photos[0].id,store.input.id);assert.ok(pending.value.photoPurge);
 assert.throws(()=>assertContentWritable(pending.value,pending.value.content),/正在永久清除/);
 fail=false;await purgePhoto(store.input,pending,store);pending=await store.read();assert.ok(!pending.value.photoPurge);assert.ok(pending.value.purgedPhotoIds.includes(store.input.id));
});
test('清除期間更新登入資料或產生修訂衝突，完成時仍保留最新登入資料',async()=>{
 const store=fixture(),commit=store.commit;let finalConflict=true;
 store.deleteFiles=async()=>{const row=await store.read();await commit({...row.value,auth:{version:2}},row.etag);};
 store.commit=async(value,etag)=>{if(!value.photoPurge&&finalConflict){finalConflict=false;const row=await store.read();await commit({...row.value,auth:{version:3}},row.etag);throw new AppError(409,'conflict');}return commit(value,etag);};
 await purgePhoto(store.input,await store.read(),store);assert.equal((await store.read()).value.auth.version,3);
});
