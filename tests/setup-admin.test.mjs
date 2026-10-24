import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {passwordMatches} from '../server/auth.mjs';
const script=fileURLToPath(new URL('../scripts/setup-admin.mjs',import.meta.url));
function run(cwd,...args){return spawnSync(process.execPath,[script,...args],{cwd,encoding:'utf8'});}
async function sandbox(work){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'field-setup-test-'));try{await work(dir);}finally{fs.rmSync(dir,{recursive:true,force:true});}}
test('本機設定產生可登入的憑證，空白範本有效且輸出不含密碼',()=>sandbox(async dir=>{
 fs.copyFileSync(new URL('../.env.example',import.meta.url),path.join(dir,'.env.local'));
 const result=run(dir);assert.equal(result.status,0,result.stderr);
 const row=JSON.parse(fs.readFileSync(path.join(dir,'.local/admin-development.json')));
 assert.ok(await passwordMatches(row.password,row.ADMIN_PASSWORD_HASH));assert.ok(row.SESSION_SECRET.length>=32);
 assert.ok(!result.stdout.includes(row.password));assert.ok(!result.stdout.includes(row.SESSION_SECRET));
 const env=fs.readFileSync(path.join(dir,'.env.local'),'utf8');assert.ok(env.includes('CONTENT_PREFIX=development'));assert.ok(env.includes('ADMIN_PASSWORD_HASH=scrypt:'));
 if(process.platform!=='win32')assert.equal(fs.statSync(path.join(dir,'.local/admin-development.json')).mode&0o777,0o600);
 const before=fs.readFileSync(path.join(dir,'.local/admin-development.json'),'utf8');assert.notEqual(run(dir).status,0);assert.equal(fs.readFileSync(path.join(dir,'.local/admin-development.json'),'utf8'),before);
}));
test('已設定或加引號的本機認證均不可被覆蓋',()=>sandbox(async dir=>{
 for(const value of ['existing-secret','"existing-secret"',"'existing-secret'"]){const env=`SESSION_SECRET=${value}\nADMIN_PASSWORD_HASH=\n`;fs.writeFileSync(path.join(dir,'.env.local'),env);assert.notEqual(run(dir).status,0);assert.equal(fs.readFileSync(path.join(dir,'.env.local'),'utf8'),env);assert.ok(!fs.existsSync(path.join(dir,'.local')));}
}));
test('正式與預覽憑證獨立產生，保留本機設定並保留預覽自動分區',()=>sandbox(async dir=>{
 fs.writeFileSync(path.join(dir,'.env.local'),'UNCHANGED=local\n');
 for(const mode of ['production','preview'])assert.equal(run(dir,'--environment='+mode).status,0);
 const production=JSON.parse(fs.readFileSync(path.join(dir,'.local/admin-production.json'))),preview=JSON.parse(fs.readFileSync(path.join(dir,'.local/admin-preview.json')));
 assert.ok(production.password!==preview.password);assert.ok(production.SESSION_SECRET!==preview.SESSION_SECRET);
 assert.equal(fs.readFileSync(path.join(dir,'.env.local'),'utf8'),'UNCHANGED=local\n');assert.ok(!fs.readFileSync(path.join(dir,'.local/preview.env'),'utf8').includes('CONTENT_PREFIX'));
}));
test('說明與無效參數不產生任何設定檔',()=>sandbox(async dir=>{
 assert.equal(run(dir,'--help').status,0);assert.notEqual(run(dir,'--environment=unknown').status,0);assert.deepEqual(fs.readdirSync(dir),[]);
}));
