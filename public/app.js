import {itemPath,parseRoute} from './routes.js';
import {refreshVisits} from './visits.js';
import {exifMarkup} from './photo-meta.js';
import {createPhotoViewer} from './photo-viewer.js';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const num = n => String(n).padStart(2, '0');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const {photos, looks, friends, notes, settings} = window.siteContent;
const siteName = settings.name;
const authorName = settings.author || 'FIELD';
let firstRoute = true;
const published = notes.filter(n => n.status === 'published');
const demos = notes.filter(n => n.status === 'demo');
const visibleNotes = [...published].sort((a,b) => b.publishedAt.localeCompare(a.publishedAt)).concat(demos);
const temporary = photos.filter(p => p.temporary).length;
const sections = {
 home:{label:'OVERVIEW',title:'總覽',hint:'從影像開始，往不同的興趣走。',icon:'home'},
 photos:{label:'PHOTOGRAPHY',title:'影像檔案',hint:'選一張照片，慢慢看。',icon:'grid'},
 lab:{label:'COLOR LAB',title:'色彩實驗',hint:'一張照片，幾種不同的表達。',icon:'aperture'},
 notes:{label:'NOTES',title:'博客',hint:'網站的一個小角落。',icon:'note'},
 links:{label:'FRIENDS',title:'友鏈',hint:'互相分享，也互相發現。',icon:'link'},
 about:{label:'PROFILE',title:'個人檔案',hint:'攝影 / 計算機',icon:'person'}
};
let galleryPhoto = 0, colorPhoto = 0, lookIndex = 2, comparing = false, screen = 'home', article = null;
function announce(text) { $('#announcement').textContent = text; }
function imagePath(p, thumb = false) { const file=thumb ? p.thumbnail || p.file : p.file; return file.startsWith('/api/media?key=') ? file : '/assets/' + file; }
function sourceLabel(p) { return `${p.temporary ? '暫用圖片' : '攝影作品'} / ${p.credit || p.source || '本站'}`; }
function photoButtons(kind) {
 return photos.map((p,i) => `<button data-${kind}-photo="${i}" aria-pressed="${i === 0}" aria-label="${kind === 'gallery' ? '觀看' : '選擇'}${esc(p.title)}"><img src="${esc(imagePath(p,true))}" alt="${esc(p.alt)}" loading="lazy"><span class="thumb-number latin">${num(i+1)}</span>${kind === 'gallery' ? `<span class="thumb-title">${esc(p.title)}</span>` : ''}</button>`).join('');
}
function setGallery(index, {speak = true, route = true} = {}) {
 if(!photos.length)return;
 galleryPhoto = (index + photos.length) % photos.length;
 const p = photos[galleryPhoto];
 $('#photo-share-status').textContent='';
 if(route && screen==='photos')writeRoute('photos',p.id);
 if(screen==='photos')metadata(p,'photos');
 $('#gallery-image').src = imagePath(p); $('#gallery-image').alt = p.alt;
 $('#gallery-title').textContent = p.title; $('#gallery-category').textContent = p.en;
 $('#gallery-source').textContent = sourceLabel(p);
 $('#gallery-exif').innerHTML = exifMarkup(p.exif);
 $('#gallery-index').textContent = `${num(galleryPhoto+1)} / ${num(photos.length)}`;
 $$('[data-gallery-photo]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.galleryPhoto) === galleryPhoto)));
 if(speak)$('#gallery-thumbnails [aria-pressed=true]')?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
 if (speak) announce(`正在觀看${p.title}，${p.temporary ? '暫用圖片，' : ''}第 ${galleryPhoto+1} 張，共 ${photos.length} 張`);
}
function renderLooks() {
 const p = photos[colorPhoto];
 if(!p)return;
 $('#preset-grid').innerHTML = looks.map((l,i) => `<button class="preset" data-look="${i}" aria-pressed="${i === lookIndex}" aria-label="${esc(l.title)}色彩風格"><span class="preset-preview"><img src="${esc(imagePath(p,true))}" alt="" style="filter:${esc(l.filter)}"></span><span class="preset-name"><b>${esc(l.title)}</b><small class="latin">${esc(l.en)}</small></span><span class="preset-mark" aria-hidden="true">${i === lookIndex ? '●' : ''}</span></button>`).join('');
}
function setColorPhoto(index) {
 if(!photos.length)return;
 colorPhoto = index; const p = photos[index];
 $('#color-original').src = imagePath(p); $('#color-original').alt = `原圖：${p.alt}`;
 $('#color-image').src = imagePath(p); $('#color-source-label').textContent = sourceLabel(p);
 $$('[data-color-photo]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.colorPhoto) === index)));
 renderLooks(); updateLook(false); announce('色彩實驗已選擇' + p.title);
}
function updateLook(speak = true) {
 const l = looks[lookIndex], p = photos[colorPhoto];
 if(!p)return;
 $('#look-en').textContent = l.en; $('#look-title').textContent = l.title;
 $('#look-description').textContent = l.description;
 $('#look-position').textContent = `${num(lookIndex+1)} / ${num(looks.length)}`;
 $('#color-image').style.filter = l.filter; $('#color-image').alt = `${l.title}風格：${p.alt}`;
 $('#color-label').textContent = `${l.title} / ${l.en}`;
 $$('[data-look]').forEach((b,i) => { b.setAttribute('aria-pressed', String(i === lookIndex)); b.querySelector('.preset-mark').textContent = i === lookIndex ? '●' : ''; });
 if (speak) announce('已切換至' + l.title + '色彩風格');
}
function setComparison(on) {
 comparing = on; $('#color-stage').classList.toggle('is-comparing',on); $('.original-frame').hidden = !on;
 $('#comparison-toggle').setAttribute('aria-pressed', String(on)); $('#comparison-toggle').textContent = on ? '關閉對照' : '原圖對照';
 announce(on ? '左側為原圖，右側為色彩效果' : '顯示色彩效果');
}
function writeRoute(name,id){
 const path=id&&['photos','notes'].includes(name)?(name==='notes'&&notes.find(n=>n.id===id)?.status==='demo'?'/#notes/'+encodeURIComponent(id):itemPath(name,id)):'/#'+name;
 if(location.pathname+location.hash!==path)history.pushState(null,'',path);
}
function metadata(item,kind){
 const title=item?item.title+' / '+siteName:siteName+' / '+sections[screen].title;
 const description=item?(kind==='photos'?item.alt:item.summary):settings.description;
 document.title=title;
 for(const selector of ['meta[name="description"]','meta[property="og:description"]','meta[name="twitter:description"]']){const node=$(selector);if(node)node.content=description;}
 for(const selector of ['meta[property="og:title"]','meta[name="twitter:title"]']){const node=$(selector);if(node)node.content=title;}
 let canonical=$('link[rel=canonical]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.append(canonical);}
 canonical.href=location.origin+(item?itemPath(kind,item.id):'/');
 const url=$('meta[property="og:url"]');if(url)url.content=canonical.href;
 const setMeta=(property,value)=>{let node=document.querySelector(`meta[property="${property}"]`);if(!node){node=document.createElement('meta');node.setAttribute('property',property);document.head.append(node);}node.content=value;};
 const cover=kind==='photos'&&item?imagePath(item):item?.html?.match(/<img\b[^>]*\bsrc="([^"]+)"/)?.[1]?.replace(/&amp;/g,'&')||(photos[0]?imagePath(photos[0]):null);
 setMeta('og:type',kind==='notes'&&item?'article':'website');if(cover)setMeta('og:image',new URL(cover,location.origin).href);

}
function resetReader() { article = null; $('#notes-index').hidden = false; $('#note-reader').hidden = true; }
async function setScreen(name, {push = false} = {}) {
 const initial = firstRoute; firstRoute = false;
 await window.fieldTransition(() => {
 if (!sections[name]) name = 'home';
 screen = name; const s = sections[name]; resetReader();
 for (const key of Object.keys(sections)) $(`#${key}-screen`).hidden = key !== name;
 document.body.dataset.screen = name;
 $('#workspace-title').textContent = s.title; $('#workspace-label').textContent = '// FIELD / ' + s.label;
 $('#section-hint').textContent = s.hint; $('#section-icon').setAttribute('href','#i-' + s.icon);
 document.title = siteName + ' / ' + s.title;
 $$('nav [data-screen]').forEach(a => { if (a.dataset.screen === name) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
 if (push) writeRoute(name,name==='photos'?photos[galleryPhoto]?.id:undefined);
 $('.workspace-body').scrollTop=0;
 window.scrollTo({top:0,behavior:'instant'}); announce('目前頁面：' + s.title);
 }, {initial});
 metadata(name==='photos'?photos[galleryPhoto]:null,name);
 if(name==='about'&&!initial)void refreshVisits();
}
function renderFriends() {
 $('#friend-list').innerHTML = friends.map((f,i) => `<a class="friend-item" href="${esc(f.url)}" target="_blank" rel="noopener noreferrer"><span class="friend-number latin">${num(i+1)}</span><span class="friend-avatar" aria-hidden="true">${esc(f.name.slice(0,1))}</span><span class="friend-info"><span class="latin">${esc(f.domain)}</span><h3>${esc(f.name)}</h3><p>${esc(f.description)}</p></span><span class="friend-label">${esc(f.label)}</span><span class="friend-arrow" aria-hidden="true">↗</span></a>`).join('');
 $('#friend-count').textContent = num(friends.length);
 const f = friends[0];
 $('#home-friend').innerHTML = f ? `<a class="home-friend-link" href="${esc(f.url)}" target="_blank" rel="noopener noreferrer"><b>${esc(f.name)}</b><span>↗</span><small>${esc(f.domain)}</small></a>` : '<p>還沒有收錄友鏈。</p>';
}
function noteMeta(n) { return n.status === 'demo' ? `示例 / 未發佈 / ${n.category}` : `${n.publishedAt} / ${n.category}`; }
function renderNotes() {
 $('#notes-list').innerHTML = visibleNotes.map((n,i) => `<a class="note-row" href="${n.status==='demo'?'/#notes/'+encodeURIComponent(n.id):itemPath('notes',n.id)}" data-note="${esc(n.id)}"><span class="note-number latin">${num(i+1)}</span><span class="note-info"><small>${esc(noteMeta(n))}</small><h3>${esc(n.title)}</h3><p>${esc(n.summary)}</p></span><span class="note-arrow" aria-hidden="true">↗</span></button>`).join('');
 $('#notes-status').textContent = published.length ? `目前有 ${published.length} 篇正式文章。${demos.length ? '標示為示例的內容僅供預覽版面。' : ''}` : '目前還沒有正式文章。以下是用來預覽版面的示例。';
 if (!visibleNotes.length) $('#notes-status').textContent = '這裡還沒有文章，想法會慢慢寫在這裡。';
 $('#notes-count').textContent = `${published.length} PUBLISHED / ${demos.length} DEMOS`;
 $('#home-note-summary').textContent = published.length ? `最新：${[...published].sort((a,b) => b.publishedAt.localeCompare(a.publishedAt))[0].title}` : '攝影與計算機的想法，會慢慢寫在這裡。';
}
async function showNote(id, {push = true} = {}) {
 const n = visibleNotes.find(n => n.id === id); if (!n) return;
 await window.fieldTransition(() => {
 article = n.id; $('#notes-index').hidden = true; $('#note-reader').hidden = false;
 $('#note-content').innerHTML = `<span class="latin">// ${n.status === 'demo' ? 'DEMO ARTICLE / NOT PUBLISHED' : 'ARTICLE / ' + esc(n.publishedAt)}</span><h2 tabindex="-1">${esc(n.title)}</h2><span class="reader-tag">${esc(noteMeta(n))}</span>${n.status === 'demo' ? '<p class="reader-notice">示例文章，並非站主的正式文章。</p>' : ''}<div class="note-share"><button class="share-item" data-share-note="${esc(n.id)}">複製文章連結 ↗</button><span id="note-share-status" role="status"></span></div><div class="markdown-body">${n.html}</div>`;
 $('#note-reader').scrollTop = 0; $('.workspace-body').scrollTop=0; $('#note-content h2').focus({preventScroll:true});
 document.title = `${n.title} / ${siteName}`;
 if(push)writeRoute('notes',n.id);metadata(n,'notes');
 announce('正在閱讀' + (n.status === 'demo' ? '示例文章：' : '文章：') + n.title);
 });
}
async function closeNote() {
 await window.fieldTransition(() => {
 const previous = article; resetReader(); $('.workspace-body').scrollTop=0; writeRoute('notes'); metadata(null,'notes');
 $$('[data-note]').find(b => b.dataset.note === previous)?.focus({preventScroll:true}); announce('已返回博客列表');
 });
}
async function readRoute() {
 const {screen:name,id}=parseRoute(location);await setScreen(name);
 if(name==='photos' && id){try{const i=photos.findIndex(p=>p.id===id);if(i>=0)setGallery(i,{speak:false,route:false});}catch{}}
 if (name === 'notes' && id) { try { await showNote(id,{push:false}); } catch { /* A malformed URL keeps the list readable. */ } }
}
function hydrateOverview() {
 const counts = {photos:photos.length,looks:looks.length,lab:looks.length,notes:published.length,published:published.length,links:friends.length,temporary};
 $$('[data-count]').forEach(el => { const value = counts[el.dataset.count]; if (value !== undefined) el.textContent = num(value); });
 const p = photos[0];
 if(p){
  $('.ambient>img').src = imagePath(p); $$('.color-swatches>img').forEach(img => img.src = imagePath(photos[photos.length-1],true)); $('#featured-image').src = imagePath(p); $('#featured-image').alt = p.alt;
  $('#featured-title').textContent = p.title; $('#featured-source').textContent = sourceLabel(p);
 }else{
  $('.ambient>img').hidden=true;$('#featured-image').hidden=true;$('#featured-source').hidden=true;
  $$('.color-swatches>img').forEach(img=>img.hidden=true);
  $('.featured').classList.add('is-empty');$('#featured-title').textContent='下一張作品，留在這裡。';
  for(const [id,label,title,description] of [
   ['photos','PHOTOGRAPHY','作品正在整理中。','新的影像，會慢慢放進這裡。'],
   ['lab','COLOR LAB','色彩實驗，等下一張影像。','有新的作品時，再一起看看不同的色彩。']
  ]){
   const section=$('#'+id+'-screen');[...section.children].forEach(child=>child.hidden=true);
   const empty=document.createElement('div');empty.className='archive-empty';
   empty.innerHTML=`<span class="latin">// ${label}</span><h2>${title}</h2><p>${description}</p>`;section.append(empty);
  }
 }
 const status = !photos.length?'目前還沒有公開作品。':temporary ? `${photos.length} 張影像中，${temporary} 張為暫用圖片。` : `目前收錄 ${photos.length} 張攝影作品。`;
 $('#home-content-note').textContent = status; $('#gallery-status').textContent = temporary ? '暫用圖片已標示來源，之後換上自己的作品。' : '選擇縮圖，觀看完整照片。';
 $('#profile-status').textContent = `${status}${demos.length ? '博客示例僅供預覽，並非正式文章。' : ''}`;
 $('#footer-status').textContent = temporary ? `含 ${temporary} 張暫用圖片 / 非站主作品` : '影像檔案 / 色彩實驗 / 個人記錄';
 $('.temporary-status').hidden = temporary === 0;
}
const photoViewer=createPhotoViewer({photos,imagePath,sourceLabel,onSelect:index=>setGallery(index)});
$('#open-photo-viewer').addEventListener('click',()=>photoViewer.open(galleryPhoto));
const searchDialog = $('#search-dialog');
const searchIndex = [
 ...Object.entries(sections).map(([screen,s]) => ({title:s.title,detail:s.hint,label:'頁面',screen})),
 ...photos.map((p,i) => ({title:p.title,detail:p.en + ' ' + p.alt,label:p.temporary ? '暫用圖片' : '攝影作品',screen:'photos',photo:i})),
 ...looks.map((l,i) => ({title:l.title,detail:l.en + ' ' + l.description,label:'色彩預設',screen:'lab',look:i})),
 ...visibleNotes.map(n => ({title:n.title,detail:n.summary + ' ' + n.category,label:n.status === 'demo' ? '博客示例' : '文章',screen:'notes',note:n.id})),
 ...friends.map(f => ({title:f.name,detail:f.domain + ' ' + f.description,label:'友鏈',screen:'links'}))
];
let searchMatches = [];
function searchContent() {
 const q = $('#site-search').value.trim().toLocaleLowerCase();
 searchMatches = q ? searchIndex.filter(item => `${item.title} ${item.detail} ${item.label}`.toLocaleLowerCase().includes(q)) : searchIndex.filter(item => item.label === '頁面');
 $('#search-status').textContent = q ? (searchMatches.length ? `找到 ${searchMatches.length} 個結果` : '沒有符合的內容，試試「山岳」、「色彩」或「計算機」。') : '快速前往，或輸入關鍵字搜尋。';
 $('#search-results').innerHTML = searchMatches.map((r,i) => `<button class="search-result" data-search-result="${i}"><span><small>${esc(r.label)}</small><b>${esc(r.title)}</b><p>${esc(r.detail)}</p></span><span aria-hidden="true">↗</span></button>`).join('');
}
function openSearch() { searchContent(); searchDialog.showModal(); $('#site-search').focus(); }
$('#gallery-thumbnails').innerHTML = photoButtons('gallery'); $('#color-thumbnails').innerHTML = photoButtons('color');
setGallery(0,{speak:false}); setColorPhoto(0); renderFriends(); renderNotes(); hydrateOverview();
$('#site-url').textContent = location.origin;
$('#exchange-name').textContent = settings.name; $('#exchange-description').textContent = settings.description;
const authorWordmark=document.createElement('span');authorWordmark.className='author-wordmark';authorWordmark.textContent=authorName;
const identityCaption=document.createElement('span');identityCaption.className='identity-caption';identityCaption.textContent=settings.title.startsWith(authorName+' / ')?settings.title.slice(authorName.length+3):settings.title;
$('.identity-title').replaceChildren(authorWordmark,identityCaption); $('.identity .latin').textContent='FIELD / PERSONAL ARCHIVE'; $('#profile-name').textContent=authorName; $('.world-footer>span:last-child').textContent=authorName+' / FIELD NOTES'; $('#home-headline').textContent = settings.headline; $('#about-intro').textContent = settings.intro;
document.querySelector('meta[name=description]').content = settings.description;
document.querySelector('meta[property="og:title"]').content=siteName;document.querySelector('meta[property="og:description"]').content=settings.description;
await readRoute();
document.addEventListener('click', async event => {
 const t = event.target.closest('button,a'); if (!t) return;
 if (t.classList.contains('skip-link')) { event.preventDefault(); $('#main').focus(); return; }
 if (t.dataset.screen) { event.preventDefault(); await setScreen(t.dataset.screen,{push:true}); }
 if (t.dataset.galleryPhoto !== undefined) setGallery(Number(t.dataset.galleryPhoto));
 if (t.dataset.galleryStep) setGallery(galleryPhoto + Number(t.dataset.galleryStep));
 if (t.dataset.colorPhoto !== undefined) setColorPhoto(Number(t.dataset.colorPhoto));
 if (t.dataset.look !== undefined) { lookIndex = Number(t.dataset.look); updateLook(); }
 if(t.dataset.note){event.preventDefault();showNote(t.dataset.note);}
 if(t.dataset.shareNote){const url=location.origin+itemPath('notes',t.dataset.shareNote);try{await navigator.clipboard.writeText(url);$('#note-share-status').textContent='文章連結已複製。';}catch{$('#note-share-status').textContent=url;}}
 if (t.dataset.searchResult !== undefined) {
  const r = searchMatches[Number(t.dataset.searchResult)]; searchDialog.close(); await setScreen(r.screen,{push:true});
  if (screen !== r.screen) return;
  if (r.photo !== undefined) setGallery(r.photo);
  if (r.look !== undefined) { lookIndex = r.look; updateLook(); }
  if (r.note) showNote(r.note);
 }
});
$('#open-search').addEventListener('click',openSearch); $('#close-search').addEventListener('click',() => searchDialog.close());
$('#site-search').addEventListener('input',searchContent);
$('#comparison-toggle').addEventListener('click',() => setComparison(!comparing)); $('#back-to-notes').addEventListener('click',closeNote);
$('#theme-toggle').addEventListener('click',() => {
 const dark = document.documentElement.dataset.theme !== 'dark'; document.documentElement.dataset.theme = dark ? 'dark' : 'light';
 try{localStorage.setItem('field-theme',dark?'dark':'light');}catch{}
 $('#theme-toggle').setAttribute('aria-label',dark ? '切換至淺色主題' : '切換至深色主題'); announce(dark ? '深色主題' : '淺色主題');
});
$('#theme-toggle').setAttribute('aria-label',document.documentElement.dataset.theme==='dark'?'切換至淺色主題':'切換至深色主題');
$('#share-photo').addEventListener('click',async()=>{const p=photos[galleryPhoto];if(!p)return;const url=new URL(itemPath('photos',p.id),location.origin);try{await navigator.clipboard.writeText(url.href);$('#photo-share-status').textContent='照片連結已複製。';}catch{$('#photo-share-status').textContent='請複製瀏覽器網址，即可分享這張照片。';}});
$('#copy-site-info').addEventListener('click',async () => {
 const info = `名稱：${settings.name}\n簡介：${settings.description}\n網址：${location.origin}`;
 try { await navigator.clipboard.writeText(info); $('#copy-feedback').textContent = '網站資訊已複製。'; }
 catch { $('#copy-feedback').textContent = '無法自動複製，請選取上方資訊複製。'; }
});
document.addEventListener('keydown', e => {
 if (e.target.matches('input,textarea,select') || searchDialog.open || photoViewer.isOpen()) return;
 if (e.key === '/' && !e.altKey && !e.metaKey && !e.ctrlKey) { e.preventDefault(); openSearch(); return; }
 if (e.altKey || e.metaKey || e.ctrlKey) return;
 if (screen === 'photos' && ['ArrowLeft','ArrowRight'].includes(e.key)) { e.preventDefault(); setGallery(galleryPhoto + (e.key === 'ArrowRight' ? 1 : -1)); }
 if (screen === 'notes' && article && e.key === 'Escape') closeNote();
});
window.addEventListener('hashchange',readRoute);
window.addEventListener('popstate',readRoute);
