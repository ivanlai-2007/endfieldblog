import {parse} from 'exifr/dist/full.esm.mjs';
import {exifFromTags} from '../public/photo-meta.js';

export async function readPhotoExif(file) {
 // Only these photographic fields are read; GPS and serial numbers are excluded.
 const tags = await parse(file,{
  pick:['Make','Model','LensModel','FocalLength','FNumber','ExposureTime','ISO'],
  gps:false,makerNote:false,userComment:false,xmp:false,iptc:false,icc:false,
  chunkLimit:20
 });
 return exifFromTags(tags);
}
