/* Nava Android v12.1.30 — UI/reader/runtime polish. */
;(function(d,w){
  'use strict';
  if(w.__navaAndroidPolishV12130)return;
  w.__navaAndroidPolishV12130=true;
  if(!w.__NAVA_ANDROID_APP__)return;

  var root=d.documentElement, overlayObserver=null, viewportBound=false;
  root.dataset.navaAndroidVersion='12.1.30';
  root.classList.add('nava-app-runtime-v12130');

  function setNetworkState(){
    root.classList.toggle('nava-app-offline',w.navigator&&w.navigator.onLine===false);
    root.classList.toggle('nava-app-online',!(w.navigator&&w.navigator.onLine===false));
  }

  function syncViewport(){
    var vv=w.visualViewport,h=vv&&vv.height?vv.height:w.innerHeight;
    var top=vv&&isFinite(vv.offsetTop)?Math.max(0,vv.offsetTop):0;
    root.style.setProperty('--nava-visual-height',Math.max(320,Math.round(h))+'px');
    root.style.setProperty('--nava-visual-top',Math.round(top)+'px');
  }

  function bindViewport(){
    if(viewportBound)return;viewportBound=true;syncViewport();
    w.addEventListener('resize',syncViewport,{passive:true});
    w.addEventListener('orientationchange',function(){setTimeout(syncViewport,80)},{passive:true});
    if(w.visualViewport){w.visualViewport.addEventListener('resize',syncViewport,{passive:true});w.visualViewport.addEventListener('scroll',syncViewport,{passive:true})}
  }

  function isVisible(el){return!!(el&&el.isConnected&&!el.hidden&&getComputedStyle(el).display!=='none')}
  function syncOverlayLock(){
    var visible=false;
    ['nava-app-search-v2','nava-app-notifications-v9','nava-reader-chapters-v9','nava-reader-settings-v2'].some(function(id){var el=d.getElementById(id);if(isVisible(el)){visible=true;return true}return false});
    if(!visible){var modal=d.querySelector('.nava-modal-backdrop:not([hidden]),.nava-profile-edit-modal:not([hidden])');visible=isVisible(modal)}
    root.classList.toggle('nava-app-overlay-open',visible);
  }

  function bindOverlayLock(){
    if(overlayObserver||!d.body)return;
    overlayObserver=new MutationObserver(function(list){
      var relevant=list.some(function(m){return m.type==='attributes'||m.addedNodes&&m.addedNodes.length});
      if(relevant)syncOverlayLock();
    });
    overlayObserver.observe(d.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class','style']});
    d.addEventListener('click',function(){setTimeout(syncOverlayLock,0)},true);
    syncOverlayLock();
  }

  function readerPositionKey(){return'nava-reader-position-v9:'+encodeURIComponent(location.pathname||'reader')}
  function saveReaderPositionNow(){
    try{
      if(!d.body||!d.body.classList.contains('nava-app-reader'))return;
      localStorage.setItem(readerPositionKey(),JSON.stringify({y:Math.max(0,Math.round(w.scrollY||0)),t:Date.now()}));
    }catch(_){}
  }

  function cleanOldLocalCaches(){
    try{
      var now=Date.now(),last=Number(localStorage.getItem('nava-v12130-cache-clean-at')||0);
      if(now-last<24*60*60*1000)return;
      for(var i=localStorage.length-1;i>=0;i--){
        var k=localStorage.key(i)||'';
        if(k.indexOf('nava-v11:')===0){
          try{var v=JSON.parse(localStorage.getItem(k)||'null');if(v&&Number(v.t)>0&&now-Number(v.t)>7*24*60*60*1000)localStorage.removeItem(k)}catch(_){}
        }else if(k.indexOf('nava-reader-position-v9:')===0){
          try{var p=JSON.parse(localStorage.getItem(k)||'null');if(p&&Number(p.t)>0&&now-Number(p.t)>120*24*60*60*1000)localStorage.removeItem(k)}catch(_){}
        }
      }
      localStorage.setItem('nava-v12130-cache-clean-at',String(now));
    }catch(_){}
  }

  function polishImages(scope){
    try{
      (scope||d).querySelectorAll('img').forEach(function(img){
        img.decoding='async';
        if(!img.closest('#reader')&&!img.closest('.nava-reader-chapter-card-v9')&&!img.hasAttribute('loading'))img.loading='lazy';
      });
    }catch(_){}
  }

  function polishTouchTargets(){
    try{
      d.querySelectorAll('#nava-app-topbar button,#nava-app-bottom button,#nava-reader-top-v2 button,#nava-reader-bottom-v2 button').forEach(function(btn){
        if(!btn.getAttribute('aria-label')){var text=(btn.textContent||'').replace(/\s+/g,' ').trim();if(text)btn.setAttribute('aria-label',text.slice(0,80))}
      });
    }catch(_){}
  }

  function sync(){bindViewport();bindOverlayLock();setNetworkState();polishImages(d);polishTouchTargets();syncOverlayLock()}

  w.addEventListener('online',function(){setNetworkState();sync()},{passive:true});
  w.addEventListener('offline',setNetworkState,{passive:true});
  w.addEventListener('pageshow',function(){setTimeout(sync,0);setTimeout(sync,500)},{passive:true});
  w.addEventListener('pagehide',saveReaderPositionNow,{capture:true});
  d.addEventListener('visibilitychange',function(){if(d.hidden)saveReaderPositionNow();else setTimeout(sync,0)});
  d.addEventListener('click',function(ev){
    var a=ev.target&&ev.target.closest?ev.target.closest('a[href]'):null;
    if(a&&d.body&&d.body.classList.contains('nava-app-reader'))saveReaderPositionNow();
  },true);
  d.addEventListener('keydown',function(ev){
    if(ev.key!=='Escape')return;
    var close=d.querySelector('.nava-profile-edit-modal:not([hidden]) [data-close],#nava-reader-chapters-v9:not([hidden]) [data-nava-reader-close],#nava-app-notifications-v9:not([hidden]) [data-nava-sheet-close],#nava-app-search-v2:not([hidden]) .nava-search-back-v2');
    if(close&&typeof close.click==='function'){ev.preventDefault();close.click()}
  },true);

  cleanOldLocalCaches();
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
  w.navaAndroidForceUiSync=sync;
})(document,window);
