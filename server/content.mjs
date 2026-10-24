import {get, put, BlobPreconditionFailedError} from '@vercel/blob';
import {marked} from 'marked';
import sanitizeHtml from './sanitizer.cjs';
import seed from '../data/seed.json' with {type:'json'};
import {cleanExif} from '../public/photo-meta.js';

export const canonicalEtag = value => String(value||'').replace(/^W\//,'').replace(/^"|"$/g,'');
export class AppError extends Error { constructor(status,message){super(message);this.status=status;} }
export const prefix = () => process.env.CONTENT_PREFIX || (process.env.VERCEL_ENV === 'preview' ? `preview-${process.env.VERCEL_GIT_COMMIT_REF || process.env.VERCEL_URL || 'default'}`.replace(/[^a-zA-Z0-9-]/g,'-') : 'production');
export const contentKey = () => `${prefix()}/cms/content.json`;
export async function readJsonBlob(key) {
 const result = await get(key,{access:'private',useCache:false});
 if (!result || result.statusCode !== 200) return null;
 return {value:await new Response(result.stream).json(),etag:canonicalEtag(result.blob.etag)};
}
export async function writeJsonBlob(key,value,etag) {
 try {
  const result = await put(key,JSON.stringify(value),{access:'private',addRandomSuffix:false,allowOverwrite:!!etag,ifMatch:etag ? `"${canonicalEtag(etag)}"` : undefined,contentType:'application/json',cacheControlMaxAge:60});
  return {...result,etag:canonicalEtag(result.etag)};
 } catch(error) {
  if(error instanceof BlobPreconditionFailedError) throw new AppError(409,'內容已在另一個分頁更新。請重新載入後再儲存，避免覆蓋新內容。');
  throw error;
 }
}
export async function readState() {
 if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) throw new AppError(503,'尚未連接私人 Vercel Blob 儲存庫。');
 const existing = await readJsonBlob(contentKey());
 if (existing) return existing;
 const initial = {content:structuredClone(seed),auth:{version:1},updatedAt:new Date().toISOString()};
 try { const blob=await writeJsonBlob(contentKey(),initial);return {value:initial,etag:blob.etag}; }
 catch(error) { const winner=await readJsonBlob(contentKey());if(winner)return winner;throw error; }
}
const text = (value,max=200) => typeof value === 'string' ? value.trim().slice(0,max) : '';
const required = (value,label,max) => { const result=text(value,max);if(!result)throw new AppError(422,`${label}不能留空。`);return result; };
function id(value) {if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(value||''))throw new AppError(422,'內容編號只能使用小寫英文、數字與連字號。');return value;}
function unique(rows){const ids=new Set();for(const row of rows){if(ids.has(row.id))throw new AppError(422,'內容編號重複。');ids.add(row.id);}}
function image(value,optional=false){if(optional&&!value)return '';if(!/^(?:[a-zA-Z0-9_/-]+\.(?:jpg|jpeg|webp|png|avif)|\/api\/media\?key=[a-f0-9-]+\.(?:webp|jpg|png))$/.test(value||'')||value.split('/').includes('..'))throw new AppError(422,'請使用本站照片，或透過上傳功能加入圖片。');return value;}
function status(value,allowDemo=false,allowDeleted=false){if(!['draft','published','archived',...(allowDemo?['demo']:[]),...(allowDeleted?['deleted']:[])].includes(value))throw new AppError(422,'內容狀態無效。');return value;}
export function markdownHtml(markdown) {
 return sanitizeHtml(marked.parse(text(markdown,150000),{async:false}),{
  allowedTags:['p','br','h2','h3','h4','strong','em','del','blockquote','ul','ol','li','pre','code','a','img','hr','table','thead','tbody','tr','th','td'],
  allowedAttributes:{a:['href','title','target','rel'],img:['src','alt','title','loading'],code:['class']},
  allowedSchemes:['https','http'],allowProtocolRelative:false,
  transformTags:{a:(tag,attrs)=>({tagName:'a',attribs:{...attrs,target:'_blank',rel:'noopener noreferrer'}}),img:(tag,attrs)=>({tagName:'img',attribs:{...attrs,loading:'lazy'}})},
  exclusiveFilter:frame=>frame.tag==='img'&&!/^\/(?:api\/media\?key=[a-f0-9-]+\.(?:webp|jpg|png)|assets\/[a-zA-Z0-9_./-]+\.(?:jpg|jpeg|webp|png|avif))$/.test(frame.attribs.src||'')
 });
}
export const photoSources = photo => [photo.file,photo.thumbnail].filter(Boolean).map(src=>src.startsWith('/api/')?src:'/assets/'+src);
export function noteImageSources(note){
 return [...markdownHtml(note.markdown??note.paragraphs?.join('\n\n')??'').matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map(match=>match[1].replace(/&amp;/g,'&'));
}
export function validateContent(input) {
 if(!input||typeof input!=='object')throw new AppError(422,'內容格式無效。');
 for(const key of ['photos','notes','friends'])if(!Array.isArray(input[key])||input[key].length>500)throw new AppError(422,'每個內容分類最多可保存 500 筆資料。');
 const settings={};for(const [key,max] of Object.entries({name:80,title:40,description:200,intro:1000,headline:60}))settings[key]=required(input.settings?.[key],`網站${key}`,max);
 settings.author=text(input.settings?.author,80)||'FIELD';
 const photos=input.photos.map(p=>({id:id(p.id),file:image(p.file),thumbnail:image(p.thumbnail,true),title:required(p.title,'照片標題',100),en:required(p.en,'照片分類',50),alt:required(p.alt,'照片描述',500),source:required(p.source,'照片來源',100),credit:text(p.credit,100),exif:cleanExif(p.exif),temporary:p.temporary===true,status:status(p.status,false,true),...(p.status==='deleted'?{deletedAt:text(p.deletedAt,40)||new Date().toISOString()}:{}),updatedAt:text(p.updatedAt,40)}));
 const notes=input.notes.map(n=>{
  const state=status(n.status,true);const publishedAt=text(n.publishedAt,10);
  if(state==='published'&&(!/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)||!Number.isFinite(Date.parse(publishedAt))||new Date(publishedAt).toISOString().slice(0,10)!==publishedAt))throw new AppError(422,'正式文章需要有效的發佈日期。');
  if(state==='published'&&publishedAt>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei'}).format(new Date()))throw new AppError(422,'目前不支援排程，請選擇今天或之前的發佈日期。');
  const markdown=typeof n.markdown==='string'?text(n.markdown,150000):(Array.isArray(n.paragraphs)?n.paragraphs.map(p=>text(p,20000)).join('\n\n'):'');
  if(!markdown)throw new AppError(422,'文章內文不能留空。');
  return {id:id(n.id),title:required(n.title,'文章標題',150),category:required(n.category,'文章分類',50),summary:required(n.summary,'文章摘要',500),status:state,publishedAt,markdown,updatedAt:text(n.updatedAt,40)};
 });
 const friends=input.friends.map(f=>{let url;try{url=new URL(f.url);}catch{throw new AppError(422,'友鏈網址無效。');}if(url.protocol!=='https:')throw new AppError(422,'友鏈請使用 HTTPS 網址。');return {id:id(f.id),name:required(f.name,'友鏈名稱',100),url:url.href,domain:url.hostname,description:required(f.description,'友鏈簡介',300),label:text(f.label,40)||'個人網站',status:status(f.status)};});
 [photos,notes,friends].forEach(unique);
 const publishedImages=new Set(photos.filter(p=>p.status==='published').flatMap(photoSources));
 const deletedPhotos=photos.filter(p=>p.status==='deleted');
 for(const n of notes){
  // Inspect rendered image elements, so code examples and ordinary links do not block deletion.
  const images=noteImageSources(n);
  for(const p of deletedPhotos)if(photoSources(p).some(src=>images.includes(src)))throw new AppError(422,`照片「${p.title}」仍被文章「${n.title}」引用。請先移除該文章內的圖片，再刪除照片（草稿與封存文章也會檢查）。`);
  if(['published','demo'].includes(n.status))for(const src of images)if(!publishedImages.has(src))throw new AppError(422,`文章「${n.title}」使用的照片尚未發佈或已刪除。請先還原並發佈該照片，或移除文章內的圖片。`);
 }
 return {settings,photos,notes,friends,looks:structuredClone(seed.looks)};
}
export function publicContent(content) {
 return {settings:content.settings,looks:content.looks,photos:content.photos.filter(p=>p.status==='published'),friends:content.friends.filter(f=>f.status==='published'),notes:content.notes.filter(n=>['published','demo'].includes(n.status)).map(n=>({...n,html:markdownHtml(n.markdown??n.paragraphs.join('\n\n'))}))};
}
