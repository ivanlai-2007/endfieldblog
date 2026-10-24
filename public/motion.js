let activeAnimations=[];
window.fieldTransition=function(update,{initial=false}={}){
 activeAnimations.forEach(animation=>animation.cancel());activeAnimations=[];
 update();
 if(initial||matchMedia('(prefers-reduced-motion: reduce)').matches)return Promise.resolve();
 const panel=document.querySelector('.workspace-body')||document.querySelector('.admin-content');
 if(panel?.animate)activeAnimations.push(panel.animate([{opacity:.55,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,easing:'cubic-bezier(.16,1,.3,1)'}));
 return Promise.resolve();
};
