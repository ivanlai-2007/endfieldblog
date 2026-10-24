import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {Readable} from 'node:stream';
import {handler} from '../server/handler.mjs';
for(const key of ['BLOB_READ_WRITE_TOKEN','SESSION_SECRET','ADMIN_PASSWORD_HASH'])if(!process.env[key])throw new Error(`缺少 ${key}，請先連接 Blob 並設定管理員登入。`);
// Never let a pulled production environment point local development at live content.
if(!process.env.CONTENT_PREFIX||process.env.CONTENT_PREFIX==='production')process.env.CONTENT_PREFIX='development';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.ttf':'font/ttf','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:4175');
  const share=url.pathname.match(/^\/(photos|notes)\/([^/]+)\/?$/);
  if(share){url.searchParams.set('route','page');url.searchParams.set('kind',share[1]);url.searchParams.set('id',decodeURIComponent(share[2]));}
  if(url.pathname==='/sitemap.xml')url.searchParams.set('route','sitemap');
  if(url.pathname.startsWith('/api/')||share||url.pathname==='/sitemap.xml'){
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4_000_000){res.writeHead(413);res.end();return;}chunks.push(chunk);}
   const request=new Request(url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
   const response=await handler(request);res.writeHead(response.status,Object.fromEntries(response.headers));if(response.body)Readable.fromWeb(response.body).pipe(res);else res.end();return;
  }
  let pathname=decodeURIComponent(url.pathname);if(pathname==='/')pathname='/index.html';if(pathname==='/admin'||pathname==='/admin/')pathname='/admin.html';
  const filename=path.resolve('public','.'+pathname);if(!filename.startsWith(path.resolve('public')+path.sep))throw new Error('Bad path');
  const data=await fs.readFile(filename);res.writeHead(200,{'content-type':types[path.extname(filename)]||'application/octet-stream','cache-control':'no-store'});res.end(data);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(4175,'127.0.0.1',()=>console.log('FIELD ready: http://127.0.0.1:4175 /admin — real private Vercel Blob storage, isolated content prefix'));
