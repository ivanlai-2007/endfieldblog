import {del,BlobNotFoundError} from '@vercel/blob';
import {AppError,readState,writeJsonBlob,contentKey,prefix,photoSources,noteImageSources} from './content.mjs';

const mediaKey=src=>/^\/api\/media\?key=([a-f0-9-]+\.(?:webp|jpg|png))$/.exec(src)?.[1];
const defaultStorage={
 read:readState,
 commit:(value,etag)=>writeJsonBlob(contentKey(),value,etag),
 deleteFiles:async keys=>{
  const results=await Promise.allSettled(keys.map(async key=>{try{await del(`${prefix()}/media/${key}`);}catch(error){if(!(error instanceof BlobNotFoundError))throw error;}}));
  const failed=results.find(result=>result.status==='rejected');if(failed)throw failed.reason;
 }
};
export function assertContentWritable(state,content){
 if(state.photoPurge)throw new AppError(409,'照片正在永久清除。請先在垃圾桶完成該照片的永久刪除，再儲存其他內容。');
 const ids=new Set(state.purgedPhotoIds||[]),keys=new Set(state.purgedMedia||[]);
 if(content.photos.some(p=>ids.has(p.id)||photoSources(p).some(src=>keys.has(mediaKey(src)))))throw new AppError(422,'內容包含已永久刪除的照片，不能從舊備份還原。請移除該照片紀錄後再匯入。');
 if(content.notes.some(n=>noteImageSources(n).some(src=>keys.has(mediaKey(src)))))throw new AppError(422,'文章包含已永久刪除的圖片。請先移除該插圖。');
}
export function planPhotoPurge(content,id){
 const photo=content.photos.find(p=>p.id===id);
 if(!photo)throw new AppError(404,'找不到這張照片，可能已被刪除。');
 if(photo.status!=='deleted')throw new AppError(409,'請先將照片移到垃圾桶，再執行永久刪除。');
 const sources=photoSources(photo);
 for(const note of content.notes)if(noteImageSources(note).some(src=>sources.includes(src)))throw new AppError(422,`照片仍被文章「${note.title}」引用。請先移除文章內的圖片，再永久刪除（包含草稿與封存文章）。`);
 const shared=new Set(content.photos.filter(p=>p.id!==id).flatMap(photoSources));
 const keys=[...new Set(sources.filter(src=>!shared.has(src)).map(mediaKey).filter(Boolean))];
 return {photo,keys,shared:sources.some(src=>shared.has(src))};
}
export async function purgePhoto(input,saved,storage=defaultStorage){
 if(input.confirmation!=='permanently-delete')throw new AppError(422,'請確認永久刪除，這個操作無法還原。');
 if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(input.id||''))throw new AppError(422,'照片編號無效。');
 let current=saved;
 const response=()=>({content:current.value.content,revision:current.etag,updatedAt:current.value.updatedAt,purgingPhotoId:null});
 if((current.value.purgedPhotoIds||[]).includes(input.id))return {...response(),deletedFiles:0};
 if(current.value.photoPurge&&current.value.photoPurge.id!==input.id)throw new AppError(409,'另一張照片的永久清除尚未完成。請先回到垃圾桶完成該操作。');
 if(!current.value.photoPurge&&input.revision!==current.etag)throw new AppError(409,'內容已更新，請重新載入後再確認永久刪除。');
 const plan=planPhotoPurge(current.value.content,input.id);
 if(input.title!==plan.photo.title)throw new AppError(409,'照片名稱已變更，請重新載入後再確認。');
 if(!current.value.photoPurge){
  const value={...current.value,photoPurge:{id:input.id,keys:plan.keys,shared:plan.shared,startedAt:new Date().toISOString()}};
  const written=await storage.commit(value,current.etag);current={value,etag:written.etag};
 }
 // A durable pending operation prevents restore/import while the physical files are removed.
 // Retry is safe after a partial deletion or a request timeout; Blob deletion is idempotent.
 try{await storage.deleteFiles(current.value.photoPurge.keys);}
 catch{throw new AppError(503,'雲端圖片尚未完全清除，照片仍留在垃圾桶。請重新按「永久刪除」完成清除。');}
 const keys=current.value.photoPurge.keys,shared=current.value.photoPurge.shared;
 for(let attempt=0;attempt<3;attempt++){
  current=await storage.read();
  if((current.value.purgedPhotoIds||[]).includes(input.id))return {...response(),deletedFiles:keys.length,sharedFilesRetained:shared};
  if(current.value.photoPurge?.id!==input.id)throw new AppError(409,'永久清除狀態已變更，請重新載入垃圾桶。');
  const {photoPurge,...rest}=current.value;
  const value={...rest,content:{...rest.content,photos:rest.content.photos.filter(p=>p.id!==input.id)},
   purgedPhotoIds:[...new Set([...(rest.purgedPhotoIds||[]),input.id])],
   purgedMedia:[...new Set([...(rest.purgedMedia||[]),...keys])],updatedAt:new Date().toISOString()};
  try{const written=await storage.commit(value,current.etag);current={value,etag:written.etag};return {...response(),deletedFiles:keys.length,sharedFilesRetained:shared};}
  catch(error){if(error.status!==409)throw new AppError(503,'圖片清除後的紀錄尚未保存完成，請重新按「永久刪除」完成操作。');}
 }
 throw new AppError(409,'其他分頁持續更新，請重新載入後重試永久刪除。');
}
