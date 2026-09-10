;(function(document, window){
  'use strict';
  if(window.__navaShellV12174)return;
  window.__navaShellV12174=true;
  if(!window.__NAVA_ANDROID_APP__)return;
  var pendingFrame=0;
  function safeImageUrl(value){var url=String(value||'').trim();return /^https:\/\//i.test(url)?url:'';}
  function currentProfileImage(){var user=null;try{user=window.auth&&window.auth.currentUser}catch(_){user=null;}if(!user)try{user=window.firebase&&window.firebase.auth&&window.firebase.auth().currentUser}catch(_){user=null;}var image=safeImageUrl(user&&user.photoURL);if(image)return image;var avatar=document.querySelector('.nava-profile-hero img[src],.nava-profile-avatar img[src],img.nava-profile-avatar[src]');return safeImageUrl(avatar&&avatar.getAttribute('src'));}
  function updateProfileButton(){var link=document.querySelector('#nava-app-bottom a[href*="app=profile"]');if(!link)return;var icon=link.querySelector('.nava-app-nav-icon');if(!icon)return;if(!icon.dataset.navaDefaultIcon)icon.dataset.navaDefaultIcon=icon.innerHTML;var imageUrl=currentProfileImage();if(!imageUrl){if(icon.dataset.navaProfileImage==='1')icon.innerHTML=icon.dataset.navaDefaultIcon;icon.dataset.navaProfileImage='0';return;}if(icon.dataset.navaProfileImage===imageUrl)return;var image=document.createElement('img');image.className='nava-nav-profile-image-v12174';image.alt='Profil';image.decoding='async';image.referrerPolicy='no-referrer';image.src=imageUrl;icon.replaceChildren(image);icon.dataset.navaProfileImage=imageUrl;}
  function prefetch(link){var href=link&&link.href;if(!href||link.dataset.navaPrefetched==='1'||href===location.href)return;link.dataset.navaPrefetched='1';try{fetch(href,{credentials:'same-origin',cache:'force-cache'}).catch(function(){});}catch(_){} }
  function activate(link){if(!link)return;document.querySelectorAll('#nava-app-bottom .nava-app-nav-item').forEach(function(item){item.classList.remove('is-pending');});link.classList.add('is-pending');document.documentElement.classList.add('nava-route-pending-v12174');}
  function bindNavigation(){document.querySelectorAll('#nava-app-bottom .nava-app-nav-item').forEach(function(link){if(link.dataset.navaShellBound==='1')return;link.dataset.navaShellBound='1';link.addEventListener('pointerdown',function(){prefetch(link);activate(link);},{passive:true});link.addEventListener('focus',function(){prefetch(link);},{passive:true});link.addEventListener('click',function(){activate(link);},{passive:true});});}
  function refresh(){pendingFrame=0;updateProfileButton();bindNavigation();}
  function scheduleRefresh(){if(pendingFrame)return;pendingFrame=window.requestAnimationFrame?window.requestAnimationFrame(refresh):window.setTimeout(refresh,16);}
  function init(){scheduleRefresh();new MutationObserver(scheduleRefresh).observe(document.body,{childList:true,subtree:true});document.addEventListener('nava:profile-customization-updated',scheduleRefresh);window.addEventListener('pageshow',scheduleRefresh,{passive:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(document,window);
