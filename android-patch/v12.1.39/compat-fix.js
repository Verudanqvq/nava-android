/* Nava Android 12.1.39 — restore volume navigation + clear all notifications. */
;(function(d,w){
  'use strict';
  if(w.__navaCompatFixV12139)return;
  w.__navaCompatFixV12139=true;
  if(!w.__NAVA_ANDROID_APP__)return;

  function clean(v,n){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n||240)}
  function isSeries(){return !!(d.body&&d.body.classList.contains('nava-app-series'))}
  function isVolumeAnchor(a){
    if(!a||!isSeries())return false;
    if(a.closest&&a.closest('#nava-download-menu-v12138,#nava-download-menu-v12139'))return false;
    try{
      var href=a.getAttribute('href')||'';
      if(!href||href.charAt(0)==='#'||/^javascript:/i.test(href))return false;
      var u=new URL(href,location.href);
      if(!/^https?:$/.test(u.protocol)||!/(^|\.)verudanava(?:\.blogspot)?\.com$/i.test(u.hostname))return false;
      var text=clean(a.textContent,220);
      var box=clean((a.closest('li,article,.bs,.bsx,.eplister,.listupd,div')||a).textContent,360);
      return /(?:^|\s)cilt\s*\d+/i.test(text+' '+box);
    }catch(_){return false}
  }

  /* Android app route handlers occasionally swallow volume-card taps. For Nava volume links,
     force the normal page navigation and leave download actions completely separate. */
  d.addEventListener('click',function(e){
    var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;
    if(!isVolumeAnchor(a))return;
    var href=a.href;
    e.preventDefault();
    e.stopImmediatePropagation();
    location.assign(href);
  },true);

  function firebaseReady(){return !!(w.db&&w.firebase&&firebase.auth&&firebase.firestore)}
  async function deleteAllNotifications(btn){
    if(!firebaseReady())throw new Error('Firebase hazır değil.');
    var user=firebase.auth().currentUser;
    if(!user)throw new Error('Oturum açık değil.');
    var col=w.db.collection('users').doc(user.uid).collection('notifications');
    var removed=0;
    for(var pass=0;pass<25;pass++){
      var snap=await col.limit(400).get();
      if(snap.empty)break;
      var batch=w.db.batch();
      snap.docs.forEach(function(doc){batch.delete(doc.ref)});
      await batch.commit();
      removed+=snap.size;
      if(snap.size<400)break;
    }
    if(btn)btn.textContent=removed?'Temizlendi':'Bildirim yok';
    setTimeout(function(){if(btn)btn.textContent='Tümünü temizle'},1200);
  }

  function ensureClearAll(){
    var actions=d.querySelector('#nava-notification-panel .nava-notification-head-actions');
    if(!actions)return;
    var btn=d.getElementById('nava-notification-clear-all-v12139');
    if(btn)return;
    btn=d.createElement('button');
    btn.type='button';
    btn.id='nava-notification-clear-all-v12139';
    btn.className='nava-notification-head-button nava-notification-clear-all-v12139';
    btn.textContent='Tümünü temizle';
    btn.setAttribute('aria-label','Tüm bildirimleri temizle');
    btn.addEventListener('click',function(e){
      e.preventDefault();e.stopPropagation();
      if(btn.disabled)return;
      btn.disabled=true;btn.textContent='Temizleniyor…';
      deleteAllNotifications(btn).catch(function(){btn.textContent='Tekrar dene'}).finally(function(){setTimeout(function(){btn.disabled=false},500)});
    });
    actions.appendChild(btn);
  }

  var observer=null;
  function sync(){ensureClearAll()}
  function init(){
    sync();
    if(!observer&&d.body){observer=new MutationObserver(sync);observer.observe(d.body,{childList:true,subtree:true})}
    w.addEventListener('pageshow',function(){setTimeout(sync,80);setTimeout(sync,500)},{passive:true});
  }
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(document,window);
