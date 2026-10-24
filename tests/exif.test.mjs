import {test} from 'node:test';
import assert from 'node:assert/strict';
import seed from './helpers/content-fixture.mjs';
import {readPhotoExif} from '../client/exif-reader.js';
import {exifFromTags,exifMarkup} from '../public/photo-meta.js';
import {validateContent,publicContent} from '../server/content.mjs';
import {withTestExif} from './helpers/exif-fixture.mjs';
test('原始 JPEG 的 EXIF 在壓縮前讀取，只保留相機及曝光欄位',async()=>{
 const jpeg=withTestExif(Buffer.from([0xff,0xd8,0xff,0xd9]));
 const result=await readPhotoExif(jpeg);
 assert.deepEqual(result,{camera:'NIKON Z f',lens:'NIKKOR Z 40mm f/2',focalLength:'40 mm',aperture:'f/2.8',shutter:'1/250 s',iso:'200'});
 assert.ok(!JSON.stringify(result).includes('SERIAL'));
 assert.deepEqual(await readPhotoExif(Buffer.from([0xff,0xd8,0xff,0xd9])),{});
});
test('攝影資料經過保存與公開讀取仍保留；額外私人欄位會移除',()=>{
 const data=structuredClone(seed);data.photos[0].exif={camera:'Nikon Z f',iso:'200',GPSLatitude:25,BodySerialNumber:'PRIVATE'};
 const saved=validateContent(data),read=publicContent(saved).photos[0].exif;
 assert.deepEqual(read,{camera:'Nikon Z f',iso:'200'});
});
test('無資料與部分資料不捏造數值；HTML 字元安全顯示',()=>{
 assert.match(exifMarkup(),/未提供拍攝資料/);
 const partial=exifMarkup({camera:'<img src=x onerror=alert(1)>',iso:'100'});
 assert.ok(!partial.includes('<img'));assert.ok(!partial.includes('exif-shutter'));assert.match(partial,/&lt;img/);
 assert.equal(exifFromTags({ExposureTime:2.5}).shutter,'2.5 s');
 assert.equal(exifFromTags({ExposureTime:.4}).shutter,'0.4 s');
 assert.deepEqual(exifFromTags({ISO:NaN,FNumber:-2,FocalLength:Infinity}),{});
});
