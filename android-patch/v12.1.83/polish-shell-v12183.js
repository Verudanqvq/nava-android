;(function(d,w){
'use strict';
if(w.__navaShellV12183)return;
w.__navaShellV12183=true;
if(!w.__NAVA_ANDROID_APP__)return;
var raf=0,observer=null,seen=Object.create(null);
function safeUrl(value){
 value=String(value||'').trim();
 try{var u=new URL(value,location.href);return u.protocol==='https:'?u.href:''}catch(_){return''}
}
function currentUser(){
 try{if(w.auth&&w.auth.currentUser)return w.auth.currentUser}catch(_){}
 try{if(w.firebase&&w.firebase.auth){var a=w.firebase.auth();if(a&&a.currentUser)return a.currentUser}}catch(_){}
 return null;
}
function profileImage(){
 var user=currentUser(),src=safeUrl(user&&user.photoURL);
 if(src)return src;
 var avatar=d.querySelector('.nava-profile-hero img[src],.nava-profile-avatar img[src],img.nava-profile-avatar[src],#nava-app-page img[alt*="profil" i][src]');
 return safeUrl(avatar&&avatar.getAttribute('src'));
}
function updateAvatar(){
 var link=d.querySelector('#nava-app-bottom a[href*="profile"],#nava-app-bottom a[data-page="profile"]');
 if(!link)return;
 var icon=link.querySelector('.nava-app-nav-icon');
 if(!icon)return;
 if(!icon.dataset.navaOriginalIcon)icon.dataset.navaOriginalIcon=icon.innerHTML;
 var src=profileImage();
 if(!src){
  if(icon.dataset.navaAvatarSrc){icon.innerHTML=icon.dataset.navaOriginalIcon;icon.dataset.navaAvatarSrc=''}
  return;
 }
 if(icon.dataset.navaAvatarSrc===src)return;
 var img=d.createElement('img');
 img.className='nava-nav-profile-image-v12183';
 img.alt='Profil fotoğrafı';img.decoding='async';img.loading='eager';img.referrerPolicy='no-referrer';img.src=src;
 img.onerror=function(){if(icon.dataset.navaAvatarSrc===src){icon.innerHTML=icon.dataset.navaOriginalIcon;icon.dataset.navaAvatarSrc=''}};
 icon.replaceChildren(img);icon.dataset.navaAvatarSrc=src;
}
function labelFor(link){
 var icon=link.querySelector('.nava-app-nav-icon');
 var existing=link.querySelector('.nava-app-nav-label,.nava-app-nav-text,.nava-nav-label-v12183');
 if(existing)return existing;
 var candidates=Array.prototype.slice.call(link.children).filter(function(node){return node!==icon});
 if(candidates.length){
  candidates[0].classList.add('nava-nav-label-v12183');
  for(var i=1;i<candidates.length;i++)candidates[i].classList.add('nava-nav-extra-v12183');
  return candidates[0];
 }
 var textNodes=Array.prototype.slice.call(link.childNodes).filter(function(n){return n.nodeType===3&&n.nodeValue.trim()});
 if(textNodes.length){
  var label=d.createElement('span');label.className='nava-nav-label-v12183';
  textNodes.forEach(function(n){label.appendChild(d.createTextNode(n.nodeValue));link.removeChild(n)});
  link.appendChild(label);return label;
 }
 return null;
}
function navLinks(){return Array.prototype.slice.call(d.querySelectorAll('#nava-app-bottom .nava-app-nav-item'))}
function warm(link){
 var href=link&&link.href;
 if(!href||href===location.href||seen[href])return;
 try{var u=new URL(href,location.href);if(u.origin!==location.origin)return}catch(_){return}
 seen[href]=true;
 try{
  var existing=Array.prototype.slice.call(d.querySelectorAll('link[rel="prefetch"]')).some(function(n){return n.href===href});
  if(!existing){var hint=d.createElement('link');hint.rel='prefetch';hint.href=href;hint.crossOrigin='use-credentials';(d.head||d.documentElement).appendChild(hint)}
 }catch(_){}
}
function bindNav(){
 navLinks().forEach(function(a){
  labelFor(a);
  if(a.dataset.navaBound83==='1')return;
  a.dataset.navaBound83='1';
  a.addEventListener('pointerdown',function(){warm(a);a.classList.add('nava-nav-pressed-v12183')},{passive:true});
  function release(){a.classList.remove('nava-nav-pressed-v12183')}
  a.addEventListener('pointerup',release,{passive:true});
  a.addEventListener('pointercancel',release,{passive:true});
  a.addEventListener('blur',release,{passive:true});
  a.addEventListener('focus',function(){warm(a)},{passive:true});
  a.addEventListener('click',function(){
   navLinks().forEach(function(x){x.classList.remove('is-pending')});
   a.classList.add('is-pending');
  },{passive:true});
 });
}
function markPrimaryActions(){
 var hero=d.querySelector('body.nava-app-home .nava-hero-slide-v5');
 if(!hero)return;
 var actions=hero.querySelectorAll('a,button');
 if(actions.length&&!hero.querySelector('.nava-primary-action-v12183')){
  var first=actions[0];first.classList.add('nava-primary-action-v12183');
 }
}
function refresh(){raf=0;bindNav();updateAvatar();markPrimaryActions()}
function schedule(){if(raf)return;raf=w.requestAnimationFrame?w.requestAnimationFrame(refresh):w.setTimeout(refresh,16)}
function warmOnIdle(){
 var links=navLinks(),index=0;
 function next(){if(index>=links.length)return;warm(links[index++]);if(w.requestIdleCallback)w.requestIdleCallback(next,{timeout:1500});else w.setTimeout(next,350)}
 if(w.requestIdleCallback)w.requestIdleCallback(next,{timeout:1000});else w.setTimeout(next,600);
}
function init(){
 schedule();warmOnIdle();
 if(w.MutationObserver){observer=new MutationObserver(schedule);observer.observe(d.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src']})}
 d.addEventListener('nava:profile-customization-updated',schedule);
 w.addEventListener('pageshow',function(){schedule();warmOnIdle()},{passive:true});
}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(document,window);
