;(function(document, window) {
  'use strict';
  if (window.__navaShellV12192 || !window.__NAVA_ANDROID_APP__) return;
  window.__navaShellV12192 = true;
  var scheduled = false, warmed = Object.create(null), originWarmed = false;
  function links() { return Array.prototype.slice.call(document.querySelectorAll('#nava-app-bottom .nava-app-nav-item')); }
  function sameOriginUrl(link) {
    try { var url = new URL(link && link.href, window.location.href); return url.origin === window.location.origin && url.href !== window.location.href ? url.href : ''; }
    catch (_) { return ''; }
  }
  function warmOrigin() {
    if (originWarmed) return; originWarmed = true;
    try { var hint=document.createElement('link'); hint.rel='preconnect'; hint.href=window.location.origin; hint.crossOrigin='use-credentials'; (document.head||document.documentElement).appendChild(hint); } catch (_) {}
  }
  function warm(link) {
    var url=sameOriginUrl(link); if(!url||warmed[url]) return; warmed[url]=true;
    try { var hint=document.createElement('link'); hint.rel='prefetch'; hint.as='document'; hint.href=url; hint.crossOrigin='use-credentials'; (document.head||document.documentElement).appendChild(hint); } catch (_) {}
  }
  function warmAll() { warmOrigin(); links().forEach(warm); }
  function updateAvatar() {
    var link=document.querySelector('#nava-app-bottom a[href*="profile"], #nava-app-bottom a[data-page="profile"]'),icon=link&&link.querySelector('.nava-app-nav-icon');
    if(!icon)return;
    if(!icon.dataset.navaDefaultIcon)icon.dataset.navaDefaultIcon=icon.innerHTML;
    var source='',avatar=document.querySelector('.nava-profile-hero img[src], .nava-profile-avatar img[src], img.nava-profile-avatar[src], [data-nava-custom-avatar] img[src], img[data-avatar-url]');
    if(avatar)source=String(avatar.currentSrc||avatar.src||avatar.getAttribute('data-avatar-url')||'');
    if(!/^https:\/\//i.test(source)){try{source=String((window.auth&&window.auth.currentUser&&window.auth.currentUser.photoURL)||'')}catch(_){}}
    if(!/^https:\/\//i.test(source)||icon.dataset.navaAvatarSource===source)return;
    var image=document.createElement('img');image.className='nava-nav-profile-image-v12192';image.alt='Profil';image.decoding='async';image.referrerPolicy='no-referrer';image.src=source;
    image.onerror=function(){icon.innerHTML=icon.dataset.navaDefaultIcon};icon.replaceChildren(image);icon.dataset.navaAvatarSource=source;
  }

  function bind() {
    links().forEach(function(link){
      if(link.dataset.navaBound90==='1') return; link.dataset.navaBound90='1';
      link.addEventListener('pointerenter',function(){warm(link);},{passive:true});
      link.addEventListener('touchstart',function(){warm(link);},{passive:true});
      link.addEventListener('pointerdown',function(){warm(link);},{passive:true});
      link.addEventListener('focus',function(){warm(link);},{passive:true});
      link.addEventListener('click',function(){links().forEach(function(item){item.classList.remove('is-pending');});},{passive:true});
    });
    updateAvatar();
  }
  function schedule(){if(scheduled)return;scheduled=true;(window.requestAnimationFrame||window.setTimeout)(function(){scheduled=false;bind();},16);}
  function init(){bind();warmAll();if(window.MutationObserver)new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});document.addEventListener('nava:profile-customization-updated',schedule);window.addEventListener('pageshow',function(){schedule();warmAll();},{passive:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(document,window);
