;(function(d,w){
'use strict';
if(w.__navaShellV12181)return;
w.__navaShellV12181=true;
if(!w.__NAVA_ANDROID_APP__)return;
var frame=0,observer=null,seen=Object.create(null);
function safeUrl(v){v=String(v||'').trim();try{var u=new URL(v,location.href);return u.protocol==='https:'?u.href:''}catch(_){return''}}
function profileImage(){
 var user=null;
 try{user=w.auth&&w.auth.currentUser}catch(_){}
 if(!user)try{user=w.firebase&&w.firebase.auth&&w.firebase.auth().currentUser}catch(_){}
 var src=safeUrl(user&&user.photoURL);
 if(src)return src;
 var avatar=d.querySelector('.nava-profile-hero img[src],.nava-profile-avatar img[src],img.nava-profile-avatar[src]');
 return safeUrl(avatar&&avatar.getAttribute('src'));
}
function updateAvatar(){
 var link=d.querySelector('#nava-app-bottom a[href*="app=profile"]');
 if(!link)return;
 var icon=link.querySelector('.nava-app-nav-icon');
 if(!icon)return;
 if(!icon.dataset.navaDefaultIcon)icon.dataset.navaDefaultIcon=icon.innerHTML;
 var src=profileImage();
 if(!src){if(icon.dataset.navaProfileImage==='1')icon.innerHTML=icon.dataset.navaDefaultIcon;icon.dataset.navaProfileImage='0';return}
 if(icon.dataset.navaProfileImage===src)return;
 var img=d.createElement('img');img.className='nava-nav-profile-image-v12181';img.alt='Profil fotoğrafı';img.decoding='async';img.loading='eager';img.referrerPolicy='no-referrer';img.src=src;
 img.onerror=function(){if(icon.dataset.navaProfileImage===src){icon.innerHTML=icon.dataset.navaDefaultIcon;icon.dataset.navaProfileImage='0'}};
 icon.replaceChildren(img);icon.dataset.navaProfileImage=src;
}
function warm(link){
 var href=link&&link.href;
 if(!href||href===location.href||seen[href])return;
 seen[href]=1;
 try{
  var existing=d.querySelector('link[rel="prefetch"][href="'+CSS.escape(href)+'"]');
  if(!existing){var hint=d.createElement('link');hint.rel='prefetch';hint.href=href;hint.as='document';hint.crossOrigin='use-credentials';(d.head||d.documentElement).appendChild(hint)}
  fetch(href,{credentials:'same-origin',cache:'force-cache'}).catch(function(){});
 }catch(_){}
}
function navLinks(){return [].slice.call(d.querySelectorAll('#nava-app-bottom .nava-app-nav-item'))}
function bindNav(){
 navLinks().forEach(function(a){
  if(a.dataset.navaPolishBound==='1')return;
  a.dataset.navaPolishBound='1';
  a.addEventListener('pointerdown',function(){warm(a);a.classList.add('nava-tap-feedback-v12181')},{passive:true});
  a.addEventListener('pointerup',function(){a.classList.remove('nava-tap-feedback-v12181')},{passive:true});
  a.addEventListener('pointercancel',function(){a.classList.remove('nava-tap-feedback-v12181')},{passive:true});
  a.addEventListener('focus',function(){warm(a)},{passive:true});
  a.addEventListener('click',function(){navLinks().forEach(function(x){x.classList.remove('is-pending')});a.classList.add('is-pending')},{passive:true});
 });
}
function refresh(){frame=0;updateAvatar();bindNav()}
function schedule(){if(frame)return;frame=w.requestAnimationFrame?w.requestAnimationFrame(refresh):w.setTimeout(refresh,16)}
function idleWarm(){
 var links=navLinks(),i=0;
 function next(){if(i>=links.length)return;warm(links[i++]);if(w.requestIdleCallback)w.requestIdleCallback(next,{timeout:1200});else w.setTimeout(next,220)}
 if(w.requestIdleCallback)w.requestIdleCallback(next,{timeout:900});else w.setTimeout(next,500);
}
function init(){
 schedule();idleWarm();
 if(w.MutationObserver){observer=new MutationObserver(schedule);observer.observe(d.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src']})}
 d.addEventListener('nava:profile-customization-updated',schedule);
 w.addEventListener('pageshow',function(){schedule();idleWarm()},{passive:true});
}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(document,window);
