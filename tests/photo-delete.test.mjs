import {test} from 'node:test';
import assert from 'node:assert/strict';
import seed from './helpers/content-fixture.mjs';
import {validateContent,publicContent} from '../server/content.mjs';

test('垃圾桶保留照片與 EXIF，公開資料隱藏刪除內容，還原為草稿',()=>{
 const data=structuredClone(seed),photo=data.photos[0];
 Object.assign(photo,{status:'deleted',deletedAt:'2026-10-23T00:00:00.000Z',exif:{camera:'Nikon Z f',iso:'200'}});
 const saved=validateContent(data),deleted=saved.photos[0];
 assert.equal(deleted.file,photo.file);assert.deepEqual(deleted.exif,photo.exif);assert.equal(deleted.deletedAt,photo.deletedAt);
 assert.ok(!publicContent(saved).photos.some(p=>p.id===photo.id));
 deleted.status='draft';
 const restored=validateContent(saved);assert.equal(restored.photos[0].status,'draft');assert.ok(!('deletedAt' in restored.photos[0]));
 assert.ok(!publicContent(restored).photos.some(p=>p.id===photo.id));
});
test('可刪除最後一張公開照片，或完全沒有照片，前台資料保持有效',()=>{
 const data=structuredClone(seed);data.photos.forEach(p=>p.status='deleted');
 assert.deepEqual(publicContent(validateContent(data)).photos,[]);
 data.photos=[];assert.deepEqual(publicContent(validateContent(data)).photos,[]);
});
test('公開、草稿及封存文章引用實際圖片時都阻止刪除，涵蓋內建與上傳圖片',()=>{
 for(const state of ['published','draft','archived'])for(const uploaded of [false,true]){
  const data=structuredClone(seed),photo=data.photos[0];
  if(uploaded)photo.file='/api/media?key=12345678-abcd-1234-abcd-123456789012.webp';
  const src=uploaded?photo.file:'/assets/'+photo.file;
  photo.status='deleted';
  data.notes.push({id:'reference-check',title:'引用測試',summary:'測試',category:'攝影',publishedAt:'2020-01-01',status:state,markdown:`![圖片](${src})`});
  assert.throws(()=>validateContent(data),/仍被文章「引用測試」引用/);
 }
});
test('程式碼範例與一般連結不誤判為文章插圖；其他公開照片自動接替精選',()=>{
 const data=structuredClone(seed),photo=data.photos[0],next=data.photos[1];photo.status='deleted';
 const src='/assets/'+photo.file;
 data.notes.push({id:'code-example',title:'程式碼範例',summary:'測試',category:'計算機',publishedAt:'2020-01-01',status:'published',markdown:`[下載](${src})\n\n\`\`\`md\n![圖片](${src})\n\`\`\``});
 const saved=validateContent(data);assert.equal(publicContent(saved).photos[0].id,next.id);
});
