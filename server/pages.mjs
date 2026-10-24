import {readFile} from 'node:fs/promises';
import {markdownHtml} from './content.mjs';
import {itemPath} from '../public/routes.js';
const template=readFile(new URL('../public/index.html',import.meta.url),'utf8');
const origin=()=>process.env.SITE_ORIGIN||'https://example.com';
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const absolute=path=>new URL(path,origin()).href;
const imagePath=p=>p.file.startsWith('/api/')?p.file:'/assets/'+p.file;
export async function renderItemPage(content,kind,id){
 const photo=kind==='photos'?content.photos.find(p=>p.id===id&&p.status==='published'):null;
 const note=kind==='notes'?content.notes.find(n=>n.id===id&&n.status==='published'):null;
 const item=photo||note,status=item?200:404,esc=escapeHtml;
 const title=item?`${item.title} / ${content.settings.name}`:'找不到這個頁面 / FIELD';
 const description=photo?photo.alt:note?note.summary:'這個內容可能已下架，請返回網站瀏覽其他作品。';
 const canonical=absolute(itemPath(kind,id));
 const noteImage=note&&markdownHtml(note.markdown??note.paragraphs?.join('\n\n')??'').match(/<img\b[^>]*\bsrc="([^"]+)"/)?.[1]?.replace(/&amp;/g,'&');
 const cover=!item?null:photo?imagePath(photo):noteImage||(content.photos.find(p=>p.status==='published')?imagePath(content.photos.find(p=>p.status==='published')):null);
 const metadata=`<link rel="canonical" href="${esc(canonical)}"><meta property="og:url" content="${esc(canonical)}"><meta name="twitter:card" content="${cover?'summary_large_image':'summary'}"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}">${cover?`<meta property="og:image" content="${esc(absolute(cover))}"><meta property="og:image:alt" content="${esc(photo?.alt||note.title)}"><meta name="twitter:image" content="${esc(absolute(cover))}">`:''}${!item?'<meta name="robots" content="noindex, follow">':''}`;
 const structured=item?{'@context':'https://schema.org','@type':photo?'ImageObject':'BlogPosting',name:item.title,headline:item.title,description,url:canonical,author:{'@type':'Person',name:content.settings.author||'FIELD'},...(cover?{image:absolute(cover)}:{}),...(photo?{contentUrl:absolute(imagePath(photo))}:{datePublished:note.publishedAt})}:null;
 let html=await template;
 html=html.replace(/<title>.*?<\/title>/,()=>`<title>${esc(title)}</title>`).replace(/<meta name="description"[^>]*>/,()=>`<meta name="description" content="${esc(description)}">`).replace(/<meta property="og:title"[^>]*>/,()=>`<meta property="og:title" content="${esc(title)}">`).replace(/<meta property="og:description"[^>]*>/,()=>`<meta property="og:description" content="${esc(description)}">`).replace('content="website"',`content="${note?'article':'website'}"`);
 html=html.replace('</head>',()=>metadata+(structured?`<script type="application/ld+json">${JSON.stringify(structured).replace(/</g,'\\u003c')}</script>`:'')+'</head>');
 const preview=`<article id="server-preview" class="workspace server-preview"><a href="/#${photo?'photos':note?'notes':'home'}">← ${photo?'影像檔案':note?'博客':'返回網站'}</a><span class="latin">// ${photo?'PHOTOGRAPHY':note?'NOTES':'PAGE NOT FOUND'}</span><h1>${esc(item?.title||'找不到這個頁面')}</h1>${photo?`<figure><img src="${esc(imagePath(photo))}" alt="${esc(photo.alt)}"><figcaption>${esc(photo.credit||photo.source)}</figcaption></figure><p>${esc(photo.alt)}</p>`:note?`<p>${esc(note.publishedAt)} / ${esc(note.category)}</p><p>${esc(note.summary)}</p><div class="markdown-body">${markdownHtml(note.markdown??note.paragraphs?.join('\n\n')??'')}</div>`:`<p>${esc(description)}</p>`}</article>`;
 html=html.replace('<main inert',preview+'<main hidden inert');
 if(!item)html=html.replace('<script type="module" src="/bootstrap.js"></script>','').replace('</head>','<style>#site-load-status{display:none!important}</style></head>');
 return new Response(html,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}
export function sitemap(content){
 const urls=[{loc:origin()+'/'},...content.photos.filter(p=>p.status==='published').map(p=>({loc:absolute(itemPath('photos',p.id)),date:p.updatedAt})),...content.notes.filter(n=>n.status==='published').map(n=>({loc:absolute(itemPath('notes',n.id)),date:n.updatedAt||n.publishedAt}))];
 return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(row=>`<url><loc>${escapeHtml(row.loc)}</loc>${row.date&&Number.isFinite(Date.parse(row.date))?`<lastmod>${new Date(row.date).toISOString()}</lastmod>`:''}</url>`).join('')}</urlset>`,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'no-store'}});
}
