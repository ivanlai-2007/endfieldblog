import {randomBytes,scrypt,timingSafeEqual,createHmac} from 'node:crypto';
import {promisify} from 'node:util';
import {AppError,readJsonBlob,writeJsonBlob,prefix} from './content.mjs';
const derive=promisify(scrypt);
export async function passwordHash(password){const salt=randomBytes(16).toString('hex');const key=await derive(password,salt,64);return `scrypt:${salt}:${key.toString('hex')}`;}
export async function passwordMatches(password,hash){const [type,salt,encoded]=String(hash||'').split(':');if(type!=='scrypt'||!salt||!encoded)return false;try{const expected=Buffer.from(encoded,'hex');const actual=await derive(password,salt,expected.length);return actual.length===expected.length&&timingSafeEqual(actual,expected);}catch{return false;}}
function secret(){const value=process.env.SESSION_SECRET;if(!value||value.length<32)throw new AppError(503,'管理員登入尚未完成設定。');return value;}
const sign=value=>createHmac('sha256',secret()).update(value).digest('base64url');
export function makeSession(version){const value=Buffer.from(JSON.stringify({role:'owner',version,exp:Date.now()+8*60*60*1000,nonce:randomBytes(12).toString('hex')})).toString('base64url');return value+'.'+sign(value);}
export function verifySession(request,version){const cookies=request.headers.get('cookie')||'';const raw=cookies.split(';').map(s=>s.trim()).find(s=>s.startsWith('field_session='))?.slice(14);if(!raw)return false;try{const [value,signature]=raw.split('.');const expected=sign(value);if(signature?.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return false;const payload=JSON.parse(Buffer.from(value,'base64url').toString());return payload.role==='owner'&&payload.version===version&&payload.exp>Date.now();}catch{return false;}}
export function assertSession(request,state){if(!verifySession(request,state.auth.version))throw new AppError(401,'請先登入管理後台。');}
export function assertOrigin(request){const origin=request.headers.get('origin');if(!origin||origin!==new URL(request.url).origin)throw new AppError(403,'來源驗證失敗，請從本站管理頁面操作。');}
export function sessionCookie(request,value,maxAge=28800){return `field_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
export async function reserveLoginAttempt(request){
 const ip=request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')?.split(',')[0]||'local';
 const key=`${prefix()}/security/login-${sign(ip)}.json`;
 const saved=await readJsonBlob(key);let value=saved?.value;
 if(!value||value.until<Date.now())value={count:0,until:Date.now()+15*60*1000};
 if(value.count>=8)throw new AppError(429,'登入嘗試次數過多，請在 15 分鐘後再試。');
 await writeJsonBlob(key,{...value,count:value.count+1},saved?.etag);
 return key;
}
export async function clearLoginAttempts(key){const row=await readJsonBlob(key);if(row)await writeJsonBlob(key,{count:0,until:Date.now()+15*60*1000},row.etag);}
