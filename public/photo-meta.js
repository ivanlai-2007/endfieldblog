export const exifFields = [
 {key:'camera',label:'相機',en:'CAMERA',max:120,placeholder:'Nikon Z6III'},
 {key:'lens',label:'鏡頭',en:'LENS',max:160,placeholder:'NIKKOR Z 24–70mm f/4 S'},
 {key:'focalLength',label:'焦距',en:'FOCAL LENGTH',max:24,placeholder:'35 mm'},
 {key:'aperture',label:'光圈',en:'APERTURE',max:24,placeholder:'f/5.6'},
 {key:'shutter',label:'快門',en:'SHUTTER',max:24,placeholder:'1/250 s'},
 {key:'iso',label:'感光度',en:'ISO',max:24,placeholder:'100'}
];
const clean = (value,max=160) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max) : '';
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const decimal = value => String(Number(value.toFixed(3)));
export function cleanExif(value) {
 return Object.fromEntries(exifFields.map(({key,max}) => [key,clean(value?.[key],max)]).filter(([,value]) => value));
}
export function exifFromTags(tags = {}) {
 const make = clean(tags.Make,120), model = clean(tags.Model,120);
 const brand = make.split(/\s/)[0];
 const camera = model && brand && !model.toLowerCase().includes(brand.toLowerCase()) ? `${make} ${model}` : model || make;
 const exposure = tags.ExposureTime;
 let shutter = '';
 if (positive(exposure)) {
  const denominator = Math.round(1 / exposure);
  shutter = exposure < .5 && Math.abs(1 / denominator - exposure) / exposure < .02
   ? `1/${denominator} s` : `${decimal(exposure)} s`;
 }
 const iso = Array.isArray(tags.ISO) ? tags.ISO[0] : tags.ISO;
 return cleanExif({camera,lens:clean(tags.LensModel),
  focalLength:positive(tags.FocalLength) ? `${decimal(tags.FocalLength)} mm` : '',
  aperture:positive(tags.FNumber) ? `f/${decimal(tags.FNumber)}` : '',
  shutter,iso:positive(iso) ? String(Math.round(iso)) : ''});
}
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function exifMarkup(value) {
 const exif = cleanExif(value);
 const fields = exifFields.filter(({key}) => exif[key]);
 if (!fields.length) return '<div class="photo-exif-empty"><span class="exif-kicker">EXIF / CAPTURE DATA</span><p>未提供拍攝資料</p></div>';
 const columns=fields.map(({key})=>`minmax(0,${key==='camera'?1.2:key==='lens'?1.7:key==='shutter'?0.9:0.65}fr)`).join(' ');
 return `<div class="exif-section-heading"><span class="exif-kicker">EXIF / CAPTURE DATA</span><span class="exif-rule" aria-hidden="true"></span></div><dl class="exif-grid" style="--exif-columns:${columns}">${fields.map(({key,label,en}) => `<div class="exif-item exif-${key}"><dt><span aria-hidden="true">${en}</span><span class="sr-only">${label}</span></dt><dd>${escape(exif[key])}</dd></div>`).join('')}</dl>`;
}
