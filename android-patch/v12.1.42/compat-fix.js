/* Nava Android 12.1.42 — volume navigation + reliable mobile notification deletion. */
;(function(d,w){
  'use strict';
  if(w.__navaCompatFixV12142)return;
  w.__navaCompatFixV12142=true;
  if(!w.__NAVA_ANDROID_APP__)return;

  function clean(v,n){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n||240)}
  function isSeries(){return !!(d.body&&d.body.classList.contains('nava-app-series'))}
  function isVolumeAnchor(a){
    if(!a||!isSeries())return false;
    if(a.closest&&a.closest('#nava-download-menu-v12138,#nava-download-menu-v12139,#nava-download-menu-v12141'))return false;
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

  d.addEventListener('click',function(e){
    var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;
    if(!isVolumeAnchor(a))return;
    var href=a.href;
    e.preventDefault();e.stopImmediatePropagation();location.assign(href);
  },true);

  var db=w.db||null,auth=w.auth||null,unsub=null,docs=[],listObserver=null;
  function firebaseReady(){return !!(db&&auth&&w.firebase&&firebase.firestore)}
  function timestampMs(v){try{if(v&&typeof v.toMillis==='function')return v.toMillis();if(v&&typeof v.toDate==='function')return v.toDate().getTime();return new Date(v||0).getTime()||0}catch(_){return 0}}
  function grouped(items){
    var output=[],likes=new Map();
    (items||[]).forEach(function(item){
      if(item.type!=='like'){output.push({kind:'single',items:[item],latest:item});return}
      var k='like:'+clean(item.postId,200)+':'+clean(item.commentId,200);
      if(!likes.has(k)){var g={kind:'likes',items:[],latest:item};likes.set(k,g);output.push(g)}
      var cur=likes.get(k);cur.items.push(item);if(timestampMs(item.createdAt)>timestampMs(cur.latest.createdAt))cur.latest=item;
    });
    output.sort(function(a,b){return timestampMs(b.latest.createdAt)-timestampMs(a.latest.createdAt)});
    return output;
  }
  function bindNotificationIds(){
    var list=d.getElementById('nava-notification-list');if(!list)return;
    var cards=[].slice.call(list.querySelectorAll('.nava-notification-item')),groups=grouped(docs);
    cards.forEach(function(card,i){
      var g=groups[i];if(!g){card.removeAttribute('data-nava-notification-ids');return}
      card.setAttribute('data-nava-notification-ids',g.items.map(function(x){return x.id}).filter(Boolean).join(','));
    });
  }
  function bindListObserver(){
    var list=d.getElementById('nava-notification-list');if(!list||list.dataset.navaDeleteObserver==='1')return;
    list.dataset.navaDeleteObserver='1';
    listObserver=new MutationObserver(function(){setTimeout(bindNotificationIds,0)});
    listObserver.observe(list,{childList:true,subtree:true});
    bindNotificationIds();
  }
  function currentUser(){return (auth&&auth.currentUser)||(w.firebase&&firebase.auth?firebase.auth().currentUser:null)}
  function notificationCol(){
    var u=currentUser();if(!u||!db)return null;
    return db.collection('users').doc(u.uid).collection('notifications');
  }
  async function deleteIds(ids){
    var col=notificationCol();if(!col)throw new Error('Oturum açık değil.');
    var unique=Array.from(new Set((ids||[]).filter(Boolean)));
    for(var i=0;i<unique.length;i+=400){
      var batch=db.batch();unique.slice(i,i+400).forEach(function(id){batch.delete(col.doc(id))});await batch.commit();
    }
    return unique.length;
  }
  async function deleteAll(btn){
    var col=notificationCol();if(!col)throw new Error('Oturum açık değil.');
    var removed=0;
    for(var pass=0;pass<30;pass++){
      var snap=await col.limit(400).get();if(snap.empty)break;
      var batch=db.batch();snap.docs.forEach(function(doc){batch.delete(doc.ref)});await batch.commit();removed+=snap.size;if(snap.size<400)break;
    }
    if(btn){btn.textContent=removed?'Temizlendi':'Bildirim yok';setTimeout(function(){btn.textContent='Tümünü sil'},1200)}
    return removed;
  }
  function ensureClearAll(){
    var actions=d.querySelector('#nava-notification-panel .nava-notification-head-actions');if(!actions)return;
    var btn=d.getElementById('nava-notification-clear-all-v12142');
    if(!btn){
      btn=d.createElement('button');btn.type='button';btn.id='nava-notification-clear-all-v12142';btn.className='nava-notification-head-button';btn.textContent='Tümünü sil';btn.setAttribute('aria-label','Tüm bildirimleri sil');
      btn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();if(btn.disabled)return;btn.disabled=true;btn.textContent='Siliniyor…';deleteAll(btn).catch(function(){btn.textContent='Tekrar dene'}).finally(function(){setTimeout(function(){btn.disabled=false},450)})});
      actions.appendChild(btn);
    }
  }
  function wireDeleteCapture(){
    var panel=d.getElementById('nava-notification-panel');if(!panel||panel.dataset.navaDeleteCapture==='1')return;
    panel.dataset.navaDeleteCapture='1';
    panel.addEventListener('click',function(e){
      var del=e.target&&e.target.closest?e.target.closest('.nava-notification-delete'):null;
      if(!del)return;
      var card=del.closest('.nava-notification-item'),raw=card&&card.getAttribute('data-nava-notification-ids');
      if(!raw)return;
      var ids=raw.split(',').map(function(x){return clean(x,240)}).filter(Boolean);if(!ids.length)return;
      e.preventDefault();e.stopImmediatePropagation();del.disabled=true;
      deleteIds(ids).catch(function(){del.disabled=false});
    },true);
  }
  function watch(user){
    if(unsub){try{unsub()}catch(_){}unsub=null}
    docs=[];bindNotificationIds();
    if(!user||!db)return;
    unsub=db.collection('users').doc(user.uid).collection('notifications').orderBy('createdAt','desc').limit(50).onSnapshot(function(snap){
      docs=snap.docs.map(function(doc){return Object.assign({id:doc.id},doc.data()||{})});
      setTimeout(bindNotificationIds,0);
    },function(){});
  }
  function bindAuth(){
    if(!firebaseReady()){setTimeout(bindAuth,250);return}
    auth.onAuthStateChanged(watch);watch(auth.currentUser);
  }
  var observer=null;
  function sync(){ensureClearAll();wireDeleteCapture();bindListObserver();bindNotificationIds()}
  function init(){sync();if(!observer&&d.body){observer=new MutationObserver(function(){sync()});observer.observe(d.body,{childList:true,subtree:true})}bindAuth()}
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(document,window);
