import {build} from 'esbuild';
import fs from 'node:fs';
for(const file of ['public/index.html','public/admin.html','public/app.js','public/admin.js','public/bootstrap.js','public/routes.js','public/photo-organization.js','server/pages.mjs','data/seed.json'])if(!fs.existsSync(file))throw new Error(`缺少 ${file}`);
for(const file of fs.readdirSync('public'))if(/^\.env|access|secret/i.test(file))throw new Error('public/ 中不可包含登入憑證或環境檔。');
await build({entryPoints:['server/sanitizer-entry.cjs'],outfile:'server/sanitizer.cjs',platform:'node',target:'node24',format:'cjs',bundle:true,legalComments:'eof'});
await build({entryPoints:['client/exif-reader.js'],outfile:'public/exif-reader.js',platform:'browser',target:'es2022',format:'esm',bundle:true,minify:true,legalComments:'eof'});
console.log('FIELD build complete: public frontend, protected admin and Vercel API.');
