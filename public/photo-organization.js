export function batchPhotos(photos,ids,changes,now=new Date().toISOString()){
 const chosen=new Set(ids),rows=photos.filter(p=>chosen.has(p.id));
 if(!chosen.size)throw new Error('請先選擇照片。');
 if(rows.length!==chosen.size||rows.some(p=>p.status==='deleted'))throw new Error('選取內容已改變，請重新選擇照片。');
 const patch={};
 for(const [key,max] of [['en',50],['credit',100]])if(changes[key]!==undefined){const text=String(changes[key]).trim();if(!text||text.length>max)throw new Error(`${key==='en'?'分類':'署名'}請填寫 1–${max} 個字元。`);patch[key]=text;}
 if(changes.status){if(!['draft','published','archived'].includes(changes.status))throw new Error('照片狀態無效。');patch.status=changes.status;}
 if(!Object.keys(patch).length)throw new Error('請指定至少一個要修改的欄位。');
 return photos.map(p=>chosen.has(p.id)?{...p,...patch,updatedAt:now}:p);
}
export function reorderPhotos(photos,id,beforeId){
 if(id===beforeId)return [...photos];
 const source=photos.find(p=>p.id===id),target=photos.find(p=>p.id===beforeId);
 if(!source||!target||source.status==='deleted'||target.status==='deleted')throw new Error('只能排列一般照片。');
 const next=photos.filter(p=>p.id!==id);next.splice(next.findIndex(p=>p.id===beforeId),0,source);return next;
}
export function movePhotoGroup(photos,ids,toEnd=false){
 const chosen=new Set(ids),selected=photos.filter(p=>chosen.has(p.id));
 if(!selected.length||selected.length!==chosen.size||selected.some(p=>p.status==='deleted'))throw new Error('請重新選擇一般照片。');
 const remaining=photos.filter(p=>!chosen.has(p.id));return toEnd?[...remaining,...selected]:[...selected,...remaining];
}
