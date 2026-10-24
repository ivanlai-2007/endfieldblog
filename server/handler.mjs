import {renderItemPage,sitemap} from './pages.mjs';
import {readVisits,recordVisit,skipVisit} from './visits.mjs';
import {randomUUID} from 'node:crypto';
import {get,put} from '@vercel/blob';
import {AppError,readState,writeJsonBlob,contentKey,validateContent,publicContent,markdownHtml,prefix} from './content.mjs';
import {assertOrigin,assertSession,verifySession,passwordMatches,passwordHash,makeSession,sessionCookie,reserveLoginAttempt,clearLoginAttempts} from './auth.mjs';
import {purgePhoto,assertContentWritable} from './photo-purge.mjs';
const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
async function body(request,max=3_800_000){if(Number(request.headers.get('content-length')||0)>max)throw new AppError(413,'資料太大，請壓縮圖片或縮短內容後再試。');const raw=await request.text();if(Buffer.byteLength(raw)>max)throw new AppError(413,'資料太大，請壓縮圖片後再試。');try{return JSON.parse(raw);}catch{throw new AppError(400,'請求資料格式錯誤。');}}
export async function handler(request){
 try{
  if(request.method==='HEAD'){const result=await handler(new Request(request.url,{headers:request.headers}));return new Response(null,{status:result.status,headers:result.headers});}
  const url=new URL(request.url);const route=url.searchParams.get('route')||url.pathname.replace(/^\/api\/?/,'');
  const method=request.method;
  if(!['GET','POST','PUT'].includes(method))return json({error:'不支援此操作。'},405,{allow:'GET, POST, PUT'});
  if(method!=='GET')assertOrigin(request);
  if(route==='visits'){
   if(method==='GET')return json(await readVisits());
   if(method==='POST'){const input=await body(request,256);return json(skipVisit(request)?await readVisits():await recordVisit(input.id));}
   return json({error:'不支援此操作。'},405,{allow:'GET, POST'});
  }
  const saved=await readState();const state=saved.value;
  if(route==='page'&&method==='GET')return renderItemPage(state.content,url.searchParams.get('kind'),url.searchParams.get('id')||'');
  if(route==='sitemap'&&method==='GET')return sitemap(state.content);
  if(route==='content'&&method==='GET')return json(publicContent(state.content));
  if(route==='session'&&method==='GET')return json({authenticated:verifySession(request,state.auth.version),configured:!!process.env.ADMIN_PASSWORD_HASH,storage:'Vercel Blob'});
  if(route==='login'&&method==='POST'){
   const input=await body(request,10000);const key=await reserveLoginAttempt(request);
   if(typeof input.password!=='string'||input.password.length>256||!await passwordMatches(input.password,state.auth.passwordHash||process.env.ADMIN_PASSWORD_HASH))throw new AppError(401,'密碼不正確。');
   await clearLoginAttempts(key);
   return json({ok:true},200,{'set-cookie':sessionCookie(request,makeSession(state.auth.version))});
  }
  if(route==='logout'&&method==='POST')return json({ok:true},200,{'set-cookie':sessionCookie(request,'',0)});
  if(route==='media'&&method==='GET'){
   const key=url.searchParams.get('key');if(!/^[a-f0-9-]+\.(webp|jpg|png)$/.test(key||''))throw new AppError(404,'找不到圖片。');
   const src='/api/media?key='+key;
   if(state.purgedMedia?.includes(key)||state.photoPurge?.keys.includes(key))throw new AppError(404,'找不到圖片。');
   const published=state.content.photos.some(p=>p.status==='published'&&(p.file===src||p.thumbnail===src));
   if(!published&&!verifySession(request,state.auth.version))throw new AppError(404,'找不到圖片。');
   const file=await get(`${prefix()}/media/${key}`,{access:'private'});if(!file||file.statusCode!==200)throw new AppError(404,'找不到圖片。');
   return new Response(file.stream,{headers:{'content-type':file.blob.contentType,'cache-control':published?'public, max-age=300':'private, no-store','x-content-type-options':'nosniff'}});
  }
  assertSession(request,state);
  if(route==='admin/content'&&method==='GET')return json({content:state.content,revision:saved.etag,updatedAt:state.updatedAt,purgingPhotoId:state.photoPurge?.id||null});
  if(route==='admin/photos/purge'&&method==='POST')return json(await purgePhoto(await body(request,10000),saved));
  if(route==='admin/content'&&method==='PUT'){
   const input=await body(request,2_000_000);if(input.revision!==saved.etag)throw new AppError(409,'另一個分頁已更新內容。請重新載入後再儲存。');
   const content=validateContent(input.content);assertContentWritable(state,content);const updatedAt=new Date().toISOString();
   // Immutable private history lets the owner export previous revisions without exposing drafts.
   await put(`${prefix()}/history/${Date.now()}-${randomUUID()}.json`,JSON.stringify(state.content),{access:'private',addRandomSuffix:false,contentType:'application/json'});
   const result=await writeJsonBlob(contentKey(),{...state,content,updatedAt},saved.etag);
   return json({content,revision:result.etag,updatedAt});
  }
  if(route==='admin/preview'&&method==='POST'){const input=await body(request,200000);return json({html:markdownHtml(input.markdown)});}
  if(route==='admin/upload'&&method==='POST'){
   const input=await body(request,3_000_000);if(typeof input.data!=='string'||input.data.length>2_900_000)throw new AppError(413,'網頁圖需小於 2 MB。');
   const buffer=Buffer.from(input.data,'base64');const type=input.contentType;
   const valid=type==='image/webp'&&buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP'||type==='image/jpeg'&&buffer[0]===255&&buffer[1]===216||type==='image/png'&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
   if(!valid||buffer.length>2_100_000||buffer.length<12)throw new AppError(422,'請使用有效的 WebP、JPEG 或 PNG 網頁圖。');
   const key=randomUUID()+'.'+({'image/webp':'webp','image/jpeg':'jpg','image/png':'png'}[type]);
   await put(`${prefix()}/media/${key}`,buffer,{access:'private',addRandomSuffix:false,contentType:type});
   return json({file:'/api/media?key='+key});
  }
  if(route==='admin/password'&&method==='POST'){
   const input=await body(request,10000);
   if(!await passwordMatches(input.current,state.auth.passwordHash||process.env.ADMIN_PASSWORD_HASH))throw new AppError(401,'目前密碼不正確。');
   if(typeof input.password!=='string'||input.password.length<14||input.password.length>256)throw new AppError(422,'新密碼請使用 14–256 個字元。');
   const version=state.auth.version+1;
   await writeJsonBlob(contentKey(),{...state,auth:{version,passwordHash:await passwordHash(input.password)}},saved.etag);
   return json({ok:true},200,{'set-cookie':sessionCookie(request,makeSession(version))});
  }
  throw new AppError(404,'找不到此功能。');
 }catch(error){
  if(error instanceof AppError)return json({error:error.message},error.status);
  console.error('FIELD request failed:',error.name);return json({error:'服務暫時無法完成操作，請稍後再試。'},500);
 }
}
