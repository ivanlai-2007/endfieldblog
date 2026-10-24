import {AppError,readJsonBlob,writeJsonBlob,prefix} from './content.mjs';

const dayFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei'});
const recentLifetime=120_000;
export const visitDay=now=>dayFormatter.format(new Date(now));
export const visitsKey=()=>`${prefix()}/analytics/visits.json`;
export function publicVisits(value,now=Date.now()){
 return {total:value?.total||0,today:value?.day===visitDay(now)?value.today:0,startedAt:value?.startedAt||null,timeZone:'Asia/Taipei'};
}
export const skipVisit=request=> /bot|crawler|spider|headless|preview|facebookexternalhit|slurp/i.test(request.headers.get('user-agent')||'') || request.headers.get('dnt')==='1' || request.headers.get('sec-gpc')==='1';
export async function readVisits(){return publicVisits((await readJsonBlob(visitsKey()))?.value);}
// Separate CAS document: traffic can never change CMS revisions or overwrite content.
export async function recordVisit(id,{read=()=>readJsonBlob(visitsKey()),write=(value,etag)=>writeJsonBlob(visitsKey(),value,etag),now=()=>Date.now(),pause=()=>new Promise(resolve=>setTimeout(resolve,40+Math.random()*100))}={}){
 if(typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id))throw new AppError(422,'瀏覽記錄格式無效。');
 for(let attempt=0;attempt<12;attempt++){
  const saved=await read(),time=now(),value=saved?.value;
  const recent=(value?.recent||[]).filter(entry=>time-entry.at<recentLifetime);
  if(recent.some(entry=>entry.id===id))return publicVisits(value,time);
  if(recent.length>=2048)throw new AppError(429,'統計服務忙碌，請稍後再試。');
  const next={total:(value?.total||0)+1,day:visitDay(time),today:(value?.day===visitDay(time)?value.today:0)+1,startedAt:value?.startedAt||new Date(time).toISOString(),recent:[...recent,{id,at:time}]};
  try{await write(next,saved?.etag);return publicVisits(next,time);}
  catch(error){
   // A first-write race or an ambiguous network response may already have committed.
   const winner=await read();
   if(winner?.etag===saved?.etag||!winner)throw error;
   await pause();
  }
 }
 throw new AppError(503,'統計暫時忙碌。');
}
