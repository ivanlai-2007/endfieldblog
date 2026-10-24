import fs from 'node:fs';
import {randomBytes,scryptSync} from 'node:crypto';

const args=process.argv.slice(2);
if(args.includes('--help')){
 console.log('Usage: npm run setup -- [--environment=development|preview|production]');
 console.log('Generates new credentials in ignored .local/ files. No network or Vercel changes.');
 process.exit(0);
}
if(args.some(arg=>!/^--environment=(development|preview|production)$/.test(arg))||args.length>1)throw new Error('請使用 --environment=development、preview 或 production。');
const environment=args[0]?.split('=')[1]||'development';
const accessFile=`.local/admin-${environment}.json`;
const configFile=`.local/${environment}.env`;
if(fs.existsSync(accessFile)||fs.existsSync(configFile))throw new Error('這個環境已產生登入設定；為避免覆蓋，請先保管既有設定，再使用新的工作目錄產生。');
let localEnv='';
if(environment==='development'){
 if(!fs.existsSync('.env.local'))throw new Error('請先將 .env.example 複製成 .env.local。');
 localEnv=fs.readFileSync('.env.local','utf8');
 const configured=localEnv.split(/\r?\n/).some(line=>{const match=line.match(/^[ \t]*(SESSION_SECRET|ADMIN_PASSWORD_HASH)[ \t]*=[ \t]*(.*)$/);const value=match?.[2].trim();return value&&!['\"\"',"''"].includes(value)&&!value.startsWith('#');});
 if(configured)throw new Error('.env.local 已有登入設定，停止以避免覆蓋。');
}
const password=randomBytes(20).toString('base64url');
const salt=randomBytes(16).toString('hex');
const access={password,SESSION_SECRET:randomBytes(48).toString('base64url'),ADMIN_PASSWORD_HASH:`scrypt:${salt}:${scryptSync(password,salt,64).toString('hex')}`};
const config=`SESSION_SECRET=${access.SESSION_SECRET}\nADMIN_PASSWORD_HASH=${access.ADMIN_PASSWORD_HASH}\n${environment==='preview'?'':`CONTENT_PREFIX=${environment}\n`}`;
fs.mkdirSync('.local',{recursive:true,mode:0o700});
fs.writeFileSync(accessFile,JSON.stringify(access,null,2)+'\n',{mode:0o600,flag:'wx'});
fs.writeFileSync(configFile,config,{mode:0o600,flag:'wx'});
if(environment==='development'){
 const retained=localEnv.split('\n').filter(line=>!/^\s*(SESSION_SECRET|ADMIN_PASSWORD_HASH|CONTENT_PREFIX)\s*=/.test(line)).join('\n').trimEnd();
 fs.writeFileSync('.env.local',retained+'\n'+config,{mode:0o600});
 fs.chmodSync('.env.local',0o600);
}
console.log(`已產生 ${environment} 登入設定：${accessFile} 與 ${configFile}。`);
console.log(environment==='development'?'已填入本機 .env.local；請另外設定 Development 私人 Blob token。':'請將環境設定檔中的值自行填入對應的 Vercel 環境；此腳本沒有上傳資料。');
console.log('密碼只保存在本機忽略目錄中，不會顯示於終端輸出。');
