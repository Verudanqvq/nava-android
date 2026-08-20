/* Nava Android 12.1.43 — stable chrome + compact download center + notification delete. */
;(function(d,w){
  'use strict';
  if(w.__navaCompatFixV12143)return;
  w.__navaCompatFixV12143=true;
  if(!w.__NAVA_ANDROID_APP__)return;

  var ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v11"/><path d="m7.5 10 4.5 4.5 4.5-4.5"/><path d="M5 20h14"/></svg>';
  var db=w.db||null,auth=w.auth||null,unsub=null,docs=[],listObserver=null,observer=null,busy=false;

  function clean(v,n){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n||300)}
  function el(tag,cls,text){var x=d.createElement(tag);if(cls)x.className=cls;if(text!=null)x.textContent=text;return x}
  function isReader(){return !!(d.body&&d.body.classList.contains('nava-app-reader'))}
  function isVolume(){return !!(d.body&&d.body.classList.contains('nava-app-volume'))}
  function isSeries(){return !!(d.body&&d.body.classList.contains('nava-app-series'))}
  function currentUrl(){try{var u=new URL(location.href);u.hash='';u.protocol='https:';u.hostname='www.verudanava.com';u.port='';return u.href}catch(_){return location.href}}
  function nativeCall(method){try{var n=w.NavaOffline;if(!n||typeof n[method]!=='function')return null;return n[method].apply(n,[].slice.call(arguments,1))}catch(_){return null}}
  function titleOf(root){root=root||d;var x=root.querySelector('.nava-reader-title-v2,header h1[itemprop="name"],main h1,h1');return clean(x?x.textContent:(root===d?d.title:''),300)||'İçerik'}
  function volumeNo(v){var m=clean(v,600).match(/(?:cilt|volume|vol\.?)\s*([0-9]+(?:\.[0-9]+)?)/i);return m?m[1]:''}
  function stripRelease(v){return clean(v,500).replace(/\s*(?:[-–—|:]\s*)?(?:cilt|volume|vol\.?|bölüm|bolum|chapter|ch\.?|episode|ep\.?)\s*\d+(?:\.\d+)?(?:\s*[-–—|:].*)?$/i,'').trim()}
  function volumeTitle(root){root=root||d;var m=root.querySelector('[data-nava-chapter-meta]'),v=clean(m&&m.getAttribute('data-volume-title'),400);if(v)return v;var tags=[].slice.call(root.querySelectorAll('a[rel="tag"]')).map(function(a){return clean(a.textContent,250)}).filter(function(x){return /(?:cilt|volume|vol\.?)\s*\d/i.test(x)});if(tags[0])return tags[0];var h=titleOf(root);return /(?:cilt|volume|vol\.?)\s*\d/i.test(h)?h:''}
  function seriesTitle(root){root=root||d;if(root===d&&isSeries())return titleOf(root);var v=volumeTitle(root);if(v){var s=stripRelease(v);if(s&&s!==v)return s}var h=titleOf(root),s2=stripRelease(h);return s2&&s2!==h?s2:''}
  function groupTitle(root){root=root||d;var s=seriesTitle(root)||seriesTitle(d),v=volumeTitle(root),n=volumeNo(v||titleOf(root));return n?(s?s+' Cilt '+n:'Cilt '+n):(v||s||titleOf(root))}
  function listState(){try{return JSON.parse(nativeCall('listDownloads')||'{}')}catch(_){return{items:[]}}}
  function downloadedSet(){var out=Object.create(null);(listState().items||[]).forEach(function(x){if(x&&x.url)out[x.url]=1});return out}

  function isVolumeAnchor(a){
    if(!a||!isSeries())return false;
    if(a.closest&&a.closest('#nava-download-quick-v12143'))return false;
    try{var href=a.getAttribute('href')||'';if(!href||href.charAt(0)==='#'||/^javascript:/i.test(href))return false;var u=new URL(href,location.href);if(!/^https?:$/.test(u.protocol)||u.hostname.indexOf('verudanava')<0)return false;var text=clean(a.textContent,220),box=clean((a.closest('li,article,.bs,.bsx,.eplister,.listupd,div')||a).textContent,360);return /(?:^|\s)(?:cilt|volume|vol\.?)\s*\d+/i.test(text+' '+box)}catch(_){return false}
  }
  d.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(!isVolumeAnchor(a))return;var href=a.href;e.preventDefault();e.stopImmediatePropagation();location.assign(href)},true);

  function sameNava(u){try{var x=new URL(u,location.href);return /^https?:$/.test(x.protocol)&&x.hostname.indexOf('verudanava')>=0}catch(_){return false}}
  function chapterItems(root,base,group){var seen=Object.create(null),out=[];[].slice.call(root.querySelectorAll('#clwd a[href],#chapters a[href],[data-nava-chapter-list] a[href],.eplister a[href],.listeps a[href]')).forEach(function(a){try{var u=new URL(a.getAttribute('href'),base);u.hash='';if(!sameNava(u.href)||seen[u.href])return;var text=clean(a.textContent,220),box=clean((a.closest('li,article,div')||a).textContent,340);if(!/(?:bölüm|bolum|chapter|ch\.?|episode|ep\.?)\s*\d/i.test(text+' '+box))return;seen[u.href]=1;out.push({url:u.href,title:text||box||'Bölüm',seriesTitle:group||'İçerik',kind:'chapter'})}catch(_){}});return out.slice(0,350)}
  function volumeLinks(){var seen=Object.create(null),out=[],s=seriesTitle(d);[].slice.call(d.querySelectorAll('a[href]')).forEach(function(a){try{var text=clean(a.textContent,220),box=clean((a.closest('li,article,.bs,.bsx,.eplister,.listupd,div')||a).textContent,340);if(!/(?:cilt|volume|vol\.?)\s*\d+/i.test(text+' '+box))return;var u=new URL(a.href,location.href);u.hash='';if(!sameNava(u.href)||seen[u.href]||u.href===currentUrl())return;seen[u.href]=1;var n=volumeNo(text+' '+box);out.push({url:u.href,title:text||box||('Cilt '+n),group:(s&&n)?s+' Cilt '+n:(s||text||box)})}catch(_){}});return out.slice(0,80)}

  function legacyCleanup(){
    ['nava-download-menu-v12138','nava-download-menu-v12139','nava-download-menu-v12141'].forEach(function(id){var x=d.getElementById(id);if(x)try{x.remove()}catch(_){x.hidden=true}});
  }
  function openLibrary(){hideQuick();if(typeof w.navaOpenDownloads==='function'){w.navaOpenDownloads();return}try{location.href='file:///android_asset/offline.html'}catch(_){}}
  function setQuickStatus(text,tone){var q=d.getElementById('nava-download-quick-v12143'),s=q&&q.querySelector('[data-q-status]');if(!s)return;s.textContent=text||'';s.className='nava-q-status-v12143'+(tone?' is-'+tone:'')}
  function hideQuick(){var q=d.getElementById('nava-download-quick-v12143');if(q)q.hidden=true;d.documentElement.classList.remove('nava-q-open-v12143')}
  function qButton(label,sub,fn,kind){var b=el('button','nava-q-action-v12143'+(kind?' is-'+kind:''));b.type='button';var c=el('span','nava-q-copy-v12143');c.append(el('strong','',label),el('small','',sub||''));b.append(c);b.onclick=fn;return b}
  function makeQuick(){
    var q=d.getElementById('nava-download-quick-v12143');if(q)return q;
    q=el('div','nava-q-backdrop-v12143');q.id='nava-download-quick-v12143';q.hidden=true;
    var p=el('section','nava-q-panel-v12143'),h=el('header','nava-q-head-v12143'),t=el('strong','','İndirme'),x=el('button','nava-q-close-v12143','×');x.type='button';x.setAttribute('aria-label','Kapat');x.onclick=hideQuick;h.append(t,x);
    var a=el('div','nava-q-actions-v12143');a.dataset.qActions='1';var s=el('div','nava-q-status-v12143');s.dataset.qStatus='1';p.append(h,a,s);q.append(p);q.addEventListener('click',function(e){if(e.target===q)hideQuick()});d.body.append(q);return q
  }
  function downloadChapter(){nativeCall('download',currentUrl(),titleOf(d),groupTitle(d),'chapter');setQuickStatus('Bölüm indirme sırasına alındı.','ok')}
  function downloadVolume(){var g=groupTitle(d),items=[{url:currentUrl(),title:titleOf(d),seriesTitle:g,kind:'volume'}].concat(chapterItems(d,location.href,g)),seen=downloadedSet();items=items.filter(function(x){return !seen[x.url]});if(!items.length){setQuickStatus('Bu cilt zaten indirilmiş.','ok');return}nativeCall('downloadBatch',JSON.stringify(items));setQuickStatus(items.length+' içerik indirme sırasına alındı.','ok')}
  async function fetchVolume(v){var r=await fetch(v.url,{credentials:'include',cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);var html=await r.text(),doc=new DOMParser().parseFromString(html,'text/html'),g=volumeTitle(doc)||v.group||groupTitle(doc);return[{url:v.url,title:v.title,seriesTitle:g,kind:'volume'}].concat(chapterItems(doc,v.url,g))}
  async function downloadSeries(){if(busy)return;var vols=volumeLinks();if(!vols.length){setQuickStatus('Cilt bağlantısı bulunamadı.','error');return}busy=true;var seen=downloadedSet(),all=[];try{for(var i=0;i<vols.length;i++){setQuickStatus('Ciltler hazırlanıyor '+(i+1)+'/'+vols.length+'…','ok');try{var got=await fetchVolume(vols[i]);got.forEach(function(x){if(!seen[x.url]){seen[x.url]=1;all.push(x)}})}catch(_){}}if(!all.length){setQuickStatus('İndirilecek yeni içerik yok.','ok');return}nativeCall('downloadBatch',JSON.stringify(all.slice(0,700)));setQuickStatus(Math.min(all.length,700)+' içerik indirme sırasına alındı.','ok')}finally{busy=false}}
  function renderQuick(){var q=makeQuick(),a=q.querySelector('[data-q-actions]');a.replaceChildren();if(isReader())a.append(qButton('Bölümü indir',titleOf(d),downloadChapter,'primary'));else if(isVolume())a.append(qButton('Cildi indir','Cilt ve bölümleri kaydet',downloadVolume,'primary'));else if(isSeries())a.append(qButton('Eseri indir','Tüm ciltleri kaydet',downloadSeries,'primary'));a.append(qButton('İndirilenler','Eser → cilt → bölüm',openLibrary,''))}
  function showQuick(){legacyCleanup();renderQuick();var q=makeQuick();q.hidden=false;d.documentElement.classList.add('nava-q-open-v12143');setQuickStatus('','')}
  function ensureFab(){
    legacyCleanup();
    var b=d.getElementById('nava-download-fab-v12143');if(!b){b=el('button','nava-download-fab-v12143');b.id='nava-download-fab-v12143';b.type='button';b.setAttribute('aria-label','İndirme');b.setAttribute('title','İndirme');b.innerHTML=ICON;b.onclick=showQuick;d.body.append(b)}
    makeQuick();
  }

  function firebaseReady(){return !!(db&&auth&&w.firebase&&firebase.firestore)}
  function timestampMs(v){try{if(v&&typeof v.toMillis==='function')return v.toMillis();if(v&&typeof v.toDate==='function')return v.toDate().getTime();return new Date(v||0).getTime()||0}catch(_){return 0}}
  function grouped(items){var output=[],likes=new Map();(items||[]).forEach(function(item){if(item.type!=='like'){output.push({kind:'single',items:[item],latest:item});return}var k='like:'+clean(item.postId,200)+':'+clean(item.commentId,200);if(!likes.has(k)){var g={kind:'likes',items:[],latest:item};likes.set(k,g);output.push(g)}var cur=likes.get(k);cur.items.push(item);if(timestampMs(item.createdAt)>timestampMs(cur.latest.createdAt))cur.latest=item});output.sort(function(a,b){return timestampMs(b.latest.createdAt)-timestampMs(a.latest.createdAt)});return output}
  function bindNotificationIds(){var list=d.getElementById('nava-notification-list');if(!list)return;var cards=[].slice.call(list.querySelectorAll('.nava-notification-item')),groups=grouped(docs);cards.forEach(function(card,i){var g=groups[i];if(!g){card.removeAttribute('data-nava-notification-ids');return}card.setAttribute('data-nava-notification-ids',g.items.map(function(x){return x.id}).filter(Boolean).join(','))})}
  function bindListObserver(){var list=d.getElementById('nava-notification-list');if(!list||list.dataset.navaDeleteObserver143==='1')return;list.dataset.navaDeleteObserver143='1';listObserver=new MutationObserver(function(){setTimeout(bindNotificationIds,0)});listObserver.observe(list,{childList:true,subtree:true});bindNotificationIds()}
  function currentUser(){return(auth&&auth.currentUser)||(w.firebase&&firebase.auth?firebase.auth().currentUser:null)}
  function notificationCol(){var u=currentUser();if(!u||!db)return null;return db.collection('users').doc(u.uid).collection('notifications')}
  async function deleteIds(ids){var col=notificationCol();if(!col)throw new Error('Oturum açık değil.');var unique=Array.from(new Set((ids||[]).filter(Boolean)));for(var i=0;i<unique.length;i+=400){var batch=db.batch();unique.slice(i,i+400).forEach(function(id){batch.delete(col.doc(id))});await batch.commit()}return unique.length}
  async function deleteAll(btn){var col=notificationCol();if(!col)throw new Error('Oturum açık değil.');var removed=0;for(var pass=0;pass<30;pass++){var snap=await col.limit(400).get();if(snap.empty)break;var batch=db.batch();snap.docs.forEach(function(doc){batch.delete(doc.ref)});await batch.commit();removed+=snap.size;if(snap.size<400)break}if(btn){btn.textContent=removed?'Temizlendi':'Bildirim yok';setTimeout(function(){btn.textContent='Tümünü sil'},1200)}return removed}
  function ensureClearAll(){var actions=d.querySelector('#nava-notification-panel .nava-notification-head-actions');if(!actions)return;var btn=d.getElementById('nava-notification-clear-all-v12143');if(!btn){var old=d.getElementById('nava-notification-clear-all-v12142');if(old)try{old.remove()}catch(_){}btn=d.createElement('button');btn.type='button';btn.id='nava-notification-clear-all-v12143';btn.className='nava-notification-head-button';btn.textContent='Tümünü sil';btn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();if(btn.disabled)return;btn.disabled=true;btn.textContent='Siliniyor…';deleteAll(btn).catch(function(){btn.textContent='Tekrar dene'}).finally(function(){setTimeout(function(){btn.disabled=false},450)})});actions.appendChild(btn)}}
  function wireDeleteCapture(){var panel=d.getElementById('nava-notification-panel');if(!panel||panel.dataset.navaDeleteCapture143==='1')return;panel.dataset.navaDeleteCapture143='1';panel.addEventListener('click',function(e){var del=e.target&&e.target.closest?e.target.closest('.nava-notification-delete'):null;if(!del)return;var card=del.closest('.nava-notification-item'),raw=card&&card.getAttribute('data-nava-notification-ids');if(!raw)return;var ids=raw.split(',').map(function(x){return clean(x,240)}).filter(Boolean);if(!ids.length)return;e.preventDefault();e.stopImmediatePropagation();del.disabled=true;deleteIds(ids).catch(function(){del.disabled=false})},true)}
  function watch(user){if(unsub){try{unsub()}catch(_){}unsub=null}docs=[];bindNotificationIds();if(!user||!db)return;unsub=db.collection('users').doc(user.uid).collection('notifications').orderBy('createdAt','desc').limit(50).onSnapshot(function(snap){docs=snap.docs.map(function(doc){return Object.assign({id:doc.id},doc.data()||{})});setTimeout(bindNotificationIds,0)},function(){})}
  function bindAuth(){if(!firebaseReady()){setTimeout(bindAuth,300);return}auth.onAuthStateChanged(watch);watch(auth.currentUser)}
  function sync(){ensureFab();ensureClearAll();wireDeleteCapture();bindListObserver();bindNotificationIds()}
  function init(){sync();if(!observer&&d.body){observer=new MutationObserver(function(){sync()});observer.observe(d.body,{childList:true,subtree:true})}bindAuth();w.addEventListener('pageshow',function(){setTimeout(sync,100);setTimeout(sync,600)},{passive:true})}
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(document,window);
