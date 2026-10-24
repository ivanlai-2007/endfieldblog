import {swipeDirection} from './photo-gestures.js';
import {cleanExif} from './photo-meta.js';

export function createPhotoViewer({photos,imagePath,sourceLabel,onSelect}) {
 const dialog=document.querySelector('#photo-viewer');
 const stage=dialog.querySelector('.viewer-stage');
 const image=dialog.querySelector('#viewer-image');
 const title=dialog.querySelector('#viewer-title');
 const details=dialog.querySelector('#viewer-exif');
 const info=dialog.querySelector('#viewer-info');
 const zoomButton=dialog.querySelector('#viewer-zoom');
 const infoButton=dialog.querySelector('#viewer-toggle-info');
 const status=dialog.querySelector('#viewer-status'),loadPanel=dialog.querySelector('#viewer-load-panel'),retry=dialog.querySelector('#viewer-retry'),background=dialog.querySelector('#viewer-background');
 let gray=false;try{gray=localStorage.getItem('field-viewer-background')==='gray';}catch{}
 function setBackground(){dialog.classList.toggle('is-gray',gray);background.textContent=gray?'深色背景':'中性灰背景';background.setAttribute('aria-pressed',String(gray));}
 setBackground();background.addEventListener('click',()=>{gray=!gray;setBackground();try{localStorage.setItem('field-viewer-background',gray?'gray':'dark');}catch{}});
 let touch=null;
 let index=0,zoomed=false,closing=false,returnFocus=null,drag=null,dragged=false;
 const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
 function fitImage() {
  if(!image.naturalWidth||!dialog.open)return;
  const narrow=stage.clientWidth<=600;
  const scale=Math.min(1,(stage.clientWidth-(narrow?24:112))/image.naturalWidth,(stage.clientHeight-(narrow?132:112))/image.naturalHeight);
  dialog.style.setProperty('--fit-width',Math.max(1,Math.floor(image.naturalWidth*scale))+'px');
  dialog.style.setProperty('--fit-height',Math.max(1,Math.floor(image.naturalHeight*scale))+'px');
  dialog.style.setProperty('--native-width',image.naturalWidth+'px');
  dialog.style.setProperty('--native-height',image.naturalHeight+'px');
 }
 function setZoom(next) {
  zoomed=next;
  dialog.classList.toggle('is-zoomed',next);
  zoomButton.textContent=next?'適合螢幕':'原尺寸';
  zoomButton.setAttribute('aria-pressed',String(next));
  image.style.cursor=next?'grab':'zoom-in';
  if(next){stage.scrollLeft=(stage.scrollWidth-stage.clientWidth)/2;stage.scrollTop=(stage.scrollHeight-stage.clientHeight)/2;}
  else{stage.scrollLeft=0;stage.scrollTop=0;}
 }
 function renderExif(photo) {
  const exif=cleanExif(photo.exif);
  details.replaceChildren();
  const equipment=[exif.camera,exif.lens].filter(Boolean).join(' / ');
  if(equipment){const line=document.createElement('p');line.className='viewer-equipment';line.textContent=equipment;details.append(line);}
  const values=[['focalLength','焦距'],['aperture','光圈'],['shutter','快門'],['iso','感光度']].filter(([key])=>exif[key]);
  if(values.length){
   const list=document.createElement('dl');list.className='viewer-exposure';
   for(const [key,label] of values){const item=document.createElement('div'),term=document.createElement('dt'),value=document.createElement('dd');term.className='sr-only';term.textContent=label;value.textContent=(key==='iso'?'ISO ':'')+exif[key];item.append(term,value);list.append(item);}
   details.append(list);
  }
  details.hidden=!details.childElementCount;
 }
 function show(next) {
  index=(next+photos.length)%photos.length;
  const photo=photos[index];
  setZoom(false);
  image.hidden=true;zoomButton.disabled=true;
  info.classList.add('is-loading');loadPanel.hidden=false;retry.hidden=true;status.hidden=false;status.textContent='正在載入影像…';
  title.textContent=photo.title;
  dialog.querySelector('#viewer-category').textContent=photo.en;
  dialog.querySelector('#viewer-counter').textContent=String(index+1).padStart(2,'0')+' / '+String(photos.length).padStart(2,'0');
  dialog.querySelector('#viewer-source').textContent=sourceLabel(photo);
  const description=dialog.querySelector('#viewer-description');
  description.textContent=photo.alt===photo.title?'':photo.alt;description.hidden=!description.textContent;
  renderExif(photo);
  image.alt=photo.alt;image.src=imagePath(photo);
  onSelect(index);
  if(image.complete&&image.naturalWidth)loaded();
 }
 function loaded(){
  fitImage();image.hidden=false;zoomButton.disabled=false;info.classList.remove('is-loading');status.hidden=true;loadPanel.hidden=true;
 }
 image.addEventListener('load',loaded);
 image.addEventListener('error',()=>{loadPanel.hidden=false;status.hidden=false;retry.hidden=false;status.textContent='圖片暫時無法載入。';});
 retry.addEventListener('click',()=>show(index));
 function finishClose(){
  dialog.close();dialog.classList.remove('is-closing');document.body.classList.remove('photo-viewer-open');closing=false;
  returnFocus?.focus({preventScroll:true});
 }
 function close(){
  if(!dialog.open||closing)return;
  closing=true;
  if(reduced()){finishClose();return;}
  dialog.classList.add('is-closing');
  dialog.animate([{opacity:1},{opacity:0}],{duration:140,easing:'ease-out'}).finished.catch(()=>{}).then(finishClose);
 }
 function open(next){
  if(!photos.length||dialog.open||closing)return;
  returnFocus=document.activeElement;
  document.body.classList.add('photo-viewer-open');
  dialog.showModal();show(next);
  if(!reduced())dialog.animate([{opacity:0},{opacity:1}],{duration:220,easing:'cubic-bezier(.2,.7,.1,1)'});
  dialog.querySelector('#viewer-close').focus({preventScroll:true});
 }
 dialog.querySelector('#viewer-close').addEventListener('click',close);
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.addEventListener('close',()=>{document.body.classList.remove('photo-viewer-open');});
 dialog.querySelectorAll('[data-viewer-step]').forEach(button=>{button.hidden=photos.length<2;button.addEventListener('click',()=>show(index+Number(button.dataset.viewerStep)));});
 zoomButton.addEventListener('click',()=>setZoom(!zoomed));
 infoButton.addEventListener('click',()=>{info.hidden=!info.hidden;infoButton.textContent=info.hidden?'顯示資訊':'隱藏資訊';infoButton.setAttribute('aria-pressed',String(!info.hidden));});
 stage.addEventListener('click',event=>{
  if(dragged){dragged=false;return;}
  if(event.target===image||zoomed)setZoom(!zoomed);
  else if(event.target===stage||event.target.classList.contains('viewer-canvas'))close();
 });
 // Native scrolling handles touch and trackpads; mouse users can also drag at 1:1.
 stage.addEventListener('pointerdown',event=>{
  if(!zoomed||event.pointerType!=='mouse'||event.button!==0)return;
  dragged=false;drag={x:event.clientX,y:event.clientY,left:stage.scrollLeft,top:stage.scrollTop};
  stage.setPointerCapture(event.pointerId);image.style.cursor='grabbing';
 });
 stage.addEventListener('pointermove',event=>{
  if(!drag)return;
  const x=event.clientX-drag.x,y=event.clientY-drag.y;
  if(Math.hypot(x,y)>4)dragged=true;
  stage.scrollLeft=drag.left-x;stage.scrollTop=drag.top-y;
 });
 function stopDrag(event){if(!drag)return;drag=null;image.style.cursor=zoomed?'grab':'zoom-in';if(stage.hasPointerCapture(event.pointerId))stage.releasePointerCapture(event.pointerId);}
 stage.addEventListener('pointerup',stopDrag);stage.addEventListener('pointercancel',stopDrag);
 dialog.addEventListener('keydown',event=>{
  if(event.altKey||event.metaKey||event.ctrlKey)return;
  if(['ArrowLeft','ArrowRight'].includes(event.key)&&!zoomed){event.preventDefault();show(index+(event.key==='ArrowRight'?1:-1));}
 });
 // Swipes change photos only in fit mode; native-size touch gestures stay available for panning.
 stage.addEventListener('pointerdown',event=>{
  if(event.pointerType!=='touch')return;
  if(zoomed||!event.isPrimary){touch=null;return;}
  touch={id:event.pointerId,x:event.clientX,y:event.clientY,at:performance.now()};
 });
 stage.addEventListener('pointermove',event=>{
  if(!touch||touch.id!==event.pointerId||zoomed)return;
  if(Math.abs(event.clientX-touch.x)>20&&Math.abs(event.clientX-touch.x)>Math.abs(event.clientY-touch.y)*1.4){dragged=true;event.preventDefault();}
 },{passive:false});
 stage.addEventListener('pointerup',event=>{
  if(!touch||touch.id!==event.pointerId)return;
  const dx=event.clientX-touch.x,dy=event.clientY-touch.y,elapsed=performance.now()-touch.at;touch=null;
  const direction=swipeDirection({dx,dy,elapsed,zoomed});if(direction){dragged=true;show(index+direction);}
 });
 stage.addEventListener('pointercancel',()=>{touch=null;});
 new ResizeObserver(fitImage).observe(stage);
 window.addEventListener('hashchange',()=>{if(dialog.open)close();});
 window.addEventListener('popstate',()=>{if(dialog.open)close();});
 return {open,isOpen:()=>dialog.open};
}
