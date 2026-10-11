;(function(document, window) {
  'use strict';
  if (window.__navaShellV12197 || !window.__NAVA_ANDROID_APP__) return;
  window.__navaShellV12197 = true;
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
    var link=document.querySelector('#nava-app-bottom a[href*="profile"], #nava-app-bottom a[data-page="profile"]'), icon=link&&link.querySelector('.nava-app-nav-icon');
    if(!icon) return; if(!icon.dataset.navaDefaultIcon) icon.dataset.navaDefaultIcon=icon.innerHTML;
    var source=''; try { source=String((window.auth&&window.auth.currentUser&&window.auth.currentUser.photoURL)||''); } catch (_) {}
    if(!/^https:\/\//i.test(source)){var avatar=document.querySelector('.nava-profile-hero img[src], .nava-profile-avatar img[src], img.nava-profile-avatar[src]');source=avatar?String(avatar.src||''):'';}
    if(!/^https:\/\//i.test(source)||icon.dataset.navaAvatarSource===source) return;
    var image=document.createElement('img');image.className='nava-nav-profile-image-v12197';image.alt='Profil';image.decoding='async';image.referrerPolicy='no-referrer';image.src=source;
    image.onerror=function(){icon.innerHTML=icon.dataset.navaDefaultIcon;};icon.replaceChildren(image);icon.dataset.navaAvatarSource=source;
  }
  function updateBrand() {
    var brand=document.querySelector('#nava-app-topbar .nava-app-brand');
    if(!brand||brand.dataset.navaCrystalMark==='1') return;
    brand.dataset.navaCrystalMark='1';brand.setAttribute('role','img');brand.setAttribute('aria-label','Nava');
    brand.innerHTML='<svg class="nava-crystal-mark-v12197" viewBox="0 0 140 180" aria-hidden="true" focusable="false"><defs><linearGradient id="navaCrystalFill90" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".48" stop-color="#dff7f7"/><stop offset="1" stop-color="#8bbdc5"/></linearGradient></defs><path d="M70 2 82 58 122 38 100 72 138 98 91 100 79 151 70 178 59 143 43 105 8 122 28 89 2 73 47 70 70 2Z" fill="url(#navaCrystalFill90)" stroke="#789fa7" stroke-width="2.5" stroke-linejoin="round"/><path d="M70 2 65 72 47 70 59 103 70 178 78 106 100 72 82 58Z" fill="#f8ffff" fill-opacity=".82" stroke="#a7cbd0" stroke-width="1.5"/><path d="M8 122 59 103 43 105 28 89 47 70 2 73 47 70 65 72 70 2 82 58 122 38 100 72 138 98 91 100 79 151 70 178 59 143" fill="none" stroke="#789fa7" stroke-width="2" stroke-linejoin="round"/><path d="M47 70 65 72 59 103 28 89M82 58 100 72 91 100 70 111M59 143 70 111 79 151M91 100 138 98 100 72" fill="#b8e3e7" fill-opacity=".65" stroke="#9fc9cf" stroke-width="1.4"/></svg>';
  }
  function bind() {
    updateBrand();
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
