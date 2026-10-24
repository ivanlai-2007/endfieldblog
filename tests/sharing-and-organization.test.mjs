import {test} from 'node:test';
import assert from 'node:assert/strict';
import seed from './helpers/content-fixture.mjs';
import {renderItemPage,sitemap} from '../server/pages.mjs';
import {itemPath,parseRoute} from '../public/routes.js';
import {batchPhotos,reorderPhotos,movePhotoGroup} from '../public/photo-organization.js';
import {swipeDirection} from '../public/photo-gestures.js';
function fixture(){const content=structuredClone(seed);content.photos[0].status='published';content.photos[0].title='Trees <&> "Light"';content.notes=[{id:'published-note',title:'文章 <&>',summary:'摘要 "hello"',status:'published',publishedAt:'2026-10-24',category:'攝影',markdown:'## 內文\n\n故事與照片。\n\n![拍攝](/assets/photos/01.webp)\n<script>bad()</script>'},{id:'private-note',title:'PRIVATE SECRET',status:'draft',markdown:'private'}];return content;}
test('新網址與舊 hash 均能定位，損壞編碼不會拋例外',()=>{
 assert.equal(itemPath('photos','photo-123'),'/photos/photo-123');
 for(const [pathname,hash] of [['/photos/photo-123',''],['/','#photos/photo-123']])assert.deepEqual(parseRoute({pathname,hash}),{screen:'photos',id:'photo-123'});
 assert.equal(parseRoute({pathname:'/',hash:'#notes/%ZZ'}).id,undefined);
});
test('獨立作品頁伺服器提供預覽資訊與可讀圖片，不執行 JS 也有內容',async()=>{
 const c=fixture(),response=await renderItemPage(c,'photos',c.photos[0].id),html=await response.text();assert.equal(response.status,200);
 assert.match(html,/<link rel="canonical" href="https:\/\/example\.com\/photos\//);assert.match(html,/<meta property="og:image"/);assert.match(html,/summary_large_image/);assert.match(html,/id="server-preview"/);assert.match(html,/Trees &lt;&amp;&gt; &quot;Light&quot;/);assert.match(html,/"@type":"ImageObject"/);assert.match(html,/href="\/style.css"/);
});
test('文章 SSR 內文經過清理；草稿、封存與不存在內容回404且不洩漏',async()=>{
 const c=fixture(),html=await (await renderItemPage(c,'notes','published-note')).text();assert.match(html,/<h2>內文<\/h2>/);assert.ok(!html.includes('bad()'));assert.match(html,/"@type":"BlogPosting"/);
 for(const id of ['private-note','does-not-exist']){const response=await renderItemPage(c,'notes',id);assert.equal(response.status,404);const text=await response.text();assert.ok(!text.includes('PRIVATE SECRET'));assert.match(text,/noindex, follow/);}
 c.photos[0].status='archived';assert.equal((await renderItemPage(c,'photos',c.photos[0].id)).status,404);
});
test('動態 sitemap 僅列出正式公開作品與文章',async()=>{const c=fixture(),xml=await sitemap(c).text();assert.ok(xml.includes('/notes/published-note'));assert.ok(!xml.includes('/notes/private-note'));assert.ok(xml.includes('/photos/'+c.photos[0].id));});
test('批次修改只改選取欄位，保留 EXIF 和來源；無效選取不套用',()=>{
 const p=[{id:'a',status:'draft',en:'old',credit:'old',exif:{iso:'100'},file:'a'},{id:'b',status:'published',en:'b'},{id:'c',status:'deleted'}];
 const next=batchPhotos(p,['a'],{en:'LANDSCAPE',credit:'FIELD',status:'published'},'now');assert.equal(next[0].en,'LANDSCAPE');assert.deepEqual(next[0].exif,p[0].exif);assert.equal(next[0].file,'a');assert.equal(next[1],p[1]);assert.equal(p[0].en,'old');
 assert.throws(()=>batchPhotos(p,['a','missing'],{status:'draft'}));assert.throws(()=>batchPhotos(p,['c'],{status:'published'}));assert.throws(()=>batchPhotos(p,['a'],{status:'deleted'}));assert.throws(()=>batchPhotos(p,['a'],{}));
});
test('單張拖曳與群組排序保留完整內容和群組原有順序',()=>{
 const p=['a','b','c','d'].map(id=>({id,status:'published'}));assert.deepEqual(reorderPhotos(p,'d','b').map(p=>p.id),['a','d','b','c']);assert.deepEqual(reorderPhotos(p,'a','d').map(p=>p.id),['b','c','a','d']);assert.deepEqual(movePhotoGroup(p,['d','b']).map(p=>p.id),['b','d','a','c']);assert.deepEqual(movePhotoGroup(p,['a','c'],true).map(p=>p.id),['b','d','a','c']);assert.deepEqual(p.map(p=>p.id),['a','b','c','d']);
});
test('觸控只接受明確快速橫滑；縱向、輕觸、慢拖與原尺寸不切換',()=>{
 assert.equal(swipeDirection({dx:-90,dy:5,elapsed:200,zoomed:false}),1);assert.equal(swipeDirection({dx:90,dy:5,elapsed:200,zoomed:false}),-1);
 for(const args of [{dx:20,dy:1,elapsed:100},{dx:70,dy:90,elapsed:200},{dx:-100,dy:2,elapsed:1200},{dx:-100,dy:0,elapsed:200,zoomed:true}])assert.equal(swipeDirection(args),0);
});
