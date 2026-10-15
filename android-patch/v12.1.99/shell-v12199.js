;(function(document, window) {
  'use strict';
  if (window.__navaShellV12199 || !window.__NAVA_ANDROID_APP__) return;
  window.__navaShellV12199 = true;
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
    var image=document.createElement('img');image.className='nava-nav-profile-image-v12199';image.alt='Profil';image.decoding='async';image.referrerPolicy='no-referrer';image.src=source;
    image.onerror=function(){icon.innerHTML=icon.dataset.navaDefaultIcon;};icon.replaceChildren(image);icon.dataset.navaAvatarSource=source;
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

/* v12.1.99 smart-download policy */
(function(window,document){
 'use strict';
 if(window.__navaSmartDownloadPolicy12200)return;
 window.__navaSmartDownloadPolicy12200=true;
 var KEY='navaSmartDownload',CAP='navaDownloadCapGb',timer=0,lastPage='';
 function pref(k,d){try{var v=localStorage.getItem(k);return v===null?d:v}catch(_){return d}}
 function enabled(){try{if(window.NavaOffline&&typeof window.NavaOffline.getSmartDownloads==='function')return !!window.NavaOffline.getSmartDownloads()}catch(_){}return pref(KEY,'true')!=='false'}
 function keepCount(){return 3}
 function capBytes(){try{if(window.NavaOffline&&typeof window.NavaOffline.getStorageLimitBytes==='function'){var b=Number(window.NavaOffline.getStorageLimitBytes());if(isFinite(b)&&b>=536870912)return Math.min(214748364800,b)}}catch(_){}var n=Number(pref(CAP,'2'));if(!isFinite(n)||n<.5)n=2;return Math.min(200,n)*1073741824}
 function clean(s){return String(s||'').toLocaleLowerCase('tr-TR').replace(/ı/g,'i').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ö/g,'o').replace(/ç/g,'c').replace(/(?:bölüm|bolum|chapter|ch\.?|episode|ep\.?)\s*#?\s*\d+/gi,' ').replace(/(?:cilt|volume|vol\.?)\s*\d+/gi,' ').replace(/\b\d+\s*(?:bölüm|bolum|chapter|episode)\b/gi,' ').replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim()}
 function chapterNumber(s){var t=String(s||'');var patterns=[/(?:bölüm|bolum|chapter|episode|ep\.?|ch\.?)\s*#?\s*(\d+)/i,/(\d+)\s*(?:bölüm|bolum|chapter|episode)/i,/\/(?:bolum|chapter|episode)[-_/ ]*(\d+)/i];for(var i=0;i<patterns.length;i++){var m=t.match(patterns[i]);if(m)return Number(m[1])}return 0}
 function downloads(){try{var d=JSON.parse(window.NavaOffline.listDownloads()||'{}');return Array.isArray(d.items)?d.items:[]}catch(_){return[]}}
 function pageInfo(){var title=(document.querySelector('article h1, .post-title, h1, article h2')||{}).textContent||document.title||'';var url=location.href;var ch=chapterNumber(title)||chapterNumber(url);if(!ch)return null;var series=clean(title)||clean(url.split('/').pop());if(!series)return null;return{chapter:ch,series:series,url:url,language:languageFromUrl(url)}}
 function languageFromUrl(url){try{var m=new URL(url,location.href).pathname.toLowerCase().match(/\/(tr|en|ja|jp|es|fr|de|ko|zh)(?:\/|$)/);return m?m[1]:''}catch(_){return''}}
 function cleanup(completed){
  if(!completed||!enabled()||!window.NavaOffline||typeof window.NavaOffline.listDownloads!=='function'||typeof window.NavaOffline.delete!=='function')return;
  var p=completed;if(!p.chapter||p.chapter<4)return;
  var floor=p.chapter-2,seen=Object.create(null);
  downloads().forEach(function(item){
   var url=String(item.url||'');if(!url||url===p.url||seen[url])return;
   var n=chapterNumber(String(item.title||'')+' '+url);if(!n||n>=floor)return;
   var series=clean(item.seriesTitle||item.series||item.workTitle||'');
   if(!series||series!==p.series)return;var lang=languageFromUrl(url);if(!p.language||!lang||lang!==p.language)return;
   seen[url]=1;try{window.NavaOffline.delete(url)}catch(_){}
  });
 }
 function storageGuard(){
  var api=window.NavaOffline;if(!api||api.__navaCapWrapped)return;
  try{
   ['download','downloadBatch'].forEach(function(name){
    if(typeof api[name]!=='function')return;
    var original=api[name];
    api[name]=function(){
     var used=0;try{var d=JSON.parse(api.listDownloads()||'{}');used=Number(d.storageBytes)||0}catch(_){}
     if(used>=capBytes()){
      try{window.dispatchEvent(new CustomEvent('nava:download-cap-reached',{detail:{limitGb:capBytes()/1073741824,usedBytes:used}}))}catch(_){}
      return;
     }
     return original.apply(api,arguments);
    };
   });
   api.__navaCapWrapped=true;
  }catch(_){}
 }
 function tick(){storageGuard()}
 function schedule(){if(timer)return;timer=setTimeout(function(){timer=0;tick()},350)}
 function init(){tick();if(window.MutationObserver)new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});window.addEventListener('popstate',schedule);window.addEventListener('pageshow',schedule);document.addEventListener('click',function(ev){var a=ev.target&&ev.target.closest?ev.target.closest('a[href]'):null;if(!a)return;var from=pageInfo(),to=String(a.href||''),label=String(a.textContent||'').toLocaleLowerCase('tr-TR'),next=chapterNumber(label)||chapterNumber(to),isNext=/sonraki|ileri|next|sonraki bölüm|next chapter/.test(label)||a.rel==='next'||/next|older|chapter-next|next-chapter|blog-pager-older-link/i.test(String(a.className||''));if(from&&isNext&&next>from.chapter){var completed={chapter:from.chapter,series:from.series,url:from.url,language:from.language};try{localStorage.setItem('navaLastCompletedChapter',JSON.stringify(completed))}catch(_){}cleanup(completed)}setTimeout(schedule,150)},true);setInterval(tick,2500)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window,document);

/* v12.2.17: online Profile uses the same native Downloads settings */
(function(w,d){'use strict';if(w.__navaProfileDownloadSettings12218)return;w.__navaProfileDownloadSettings12218=true;var id='nava-profile-download-settings-12218',timer=0;function api(){return w.NavaOffline||null}function gb(){try{var a=api(),n=a&&a.getStorageLimitBytes?Number(a.getStorageLimitBytes())/1073741824:2;return Math.max(1,Math.floor(n||2))}catch(_){return 2}}function state(){var a=api(),s={used:0,free:0,cap:gb(),items:0};try{var x=JSON.parse(a&&a.listDownloads?a.listDownloads():'{}');s.used=Number(x.storageBytes)||0;s.free=Number(x.storageAvailableBytes)||0;s.items=(x.items||[]).length}catch(_){}return s}function fmt(n){n=Math.max(0,Number(n)||0);return n>=1073741824?(n/1073741824).toFixed(2)+' GB':n>=1048576?(n/1048576).toFixed(1)+' MB':Math.round(n/1024)+' KB'}function root(){if(new URLSearchParams(w.location.search).get('u'))return null;var r=d.querySelector('.nava-profile-app');if(!r)return null;var s=w.getComputedStyle?w.getComputedStyle(r):null;return r.getClientRects().length&&(!s||(s.display!=='none'&&s.visibility!=='hidden'))?r:null}function el(tag,cls,txt){var x=d.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=txt;return x}function add(){var r=root();if(!r)return;var card=d.getElementById(id);if(!card){card=el('section','nava-profile-download-settings');card.id=id;card.setAttribute('aria-label','İndirme ayarları');var h=el('div','nava-profile-download-head');h.append(el('strong','','İndirme ayarları'),el('span','','Çevrimiçi ve çevrimdışı aynı ayarlar'));card.append(h);var status=el('p','nava-profile-download-status','');status.id=id+'-status';card.append(status);function check(k,title,desc,method,pref){var row=el('label','nava-profile-download-row'),copy=el('span','nava-profile-download-copy');copy.append(el('strong','',title),el('small','',desc));var input=el('input','');input.type='checkbox';input.id=id+'-'+k;row.append(copy,input);card.append(row);input.addEventListener('change',function(){try{var a=api();if(a&&a[method])a[method](input.checked);w.localStorage.setItem(pref,String(input.checked))}catch(_){}});return input}check('wifi','Yalnızca Wi‑Fi','Mobil veriyle indirmeyi engeller.','setWifiOnly','navaWifiOnly');check('smart','Akıllı İndirme','3 bölüm ilerleyince eski bölümleri otomatik temizler.','setSmartDownloads','navaSmartDownload');var row=el('label','nava-profile-download-row'),copy=el('span','nava-profile-download-copy');copy.append(el('strong','','İndirme sınırı (GB)'),el('small','','Her iki modda da aynı sınır geçerlidir.'));var cap=el('input','');cap.type='number';cap.id=id+'-cap';cap.min='1';cap.max='200';cap.step='1';cap.inputMode='numeric';row.append(copy,cap);card.append(row);cap.addEventListener('change',function(){var s=state(),max=Math.max(1,Math.floor((s.used+s.free-268435456)/1073741824)),n=Math.max(1,Math.min(max,Math.floor(Number(cap.value)||gb())));cap.value=String(n);try{var a=api();if(a&&a.setStorageLimitBytes)a.setStorageLimitBytes(n*1073741824);w.localStorage.setItem('navaDownloadCapGb',String(n))}catch(_){}refresh()});var b=el('button','nava-profile-download-refresh','İndirilenleri yenile');b.type='button';b.addEventListener('click',refresh);card.append(b);(r.matches('body.nava-app-own-profile #nava-app-page')?r:(r.parentElement||r)).append(card)}refresh()}function refresh(){var c=d.getElementById(id);if(!c)return;var a=api(),s=state(),wif=c.querySelector('#'+id+'-wifi'),smart=c.querySelector('#'+id+'-smart'),cap=c.querySelector('#'+id+'-cap'),status=d.getElementById(id+'-status');if(wif)wif.checked=!!(a&&a.getWifiOnly?a.getWifiOnly():w.localStorage.getItem('navaWifiOnly')!=='false');if(smart)smart.checked=!!(a&&a.getSmartDownloads?a.getSmartDownloads():w.localStorage.getItem('navaSmartDownload')!=='false');if(cap){if(d.activeElement!==cap)cap.value=String(s.cap);cap.max=String(Math.max(1,Math.floor((s.used+s.free-268435456)/1073741824)))}if(status)status.textContent=s.items+' içerik · '+fmt(s.used)+' kullanılıyor · '+fmt(s.free)+' boş'}function tick(){if(root())add();else{var c=d.getElementById(id);if(c)c.remove()}}function schedule(){if(timer)return;timer=w.setTimeout(function(){timer=0;tick()},250)}function init(){tick();if(w.MutationObserver)new MutationObserver(schedule).observe(d.body,{childList:true,subtree:true});w.addEventListener('pageshow',schedule);w.addEventListener('popstate',schedule);d.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('#nava-app-bottom a[href*="profile"], #nava-app-bottom a[data-page="profile"]'))setTimeout(schedule,100)},true);w.setInterval(function(){if(d.getElementById(id))refresh()},3000)}if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init,{once:true});else init()})(window,document);


/* v12.2.18 — admin-controlled membership-card placeholder; no membership logic or pricing. */
(function(w,d){
 'use strict';
 if(w.__navaMembershipCardToggle12218)return;
 w.__navaMembershipCardToggle12218=true;
 var CONFIG='membership',CARD='nava-membership-card-12218',ADMIN='nava-membership-admin-toggle-12218',busy=false,scheduled=0,lastUid='';
 function db(){try{return w.db||(w.firebase&&w.firebase.firestore?w.firebase.firestore():null)}catch(_){return null}}
 function user(){try{return(w.auth&&w.auth.currentUser)||(w.firebase&&w.firebase.auth&&w.firebase.auth().currentUser)||null}catch(_){return null}}
 function own(){try{return !new URLSearchParams(w.location.search).get('u')}catch(_){return true}}
 function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,120)}
 function el(tag,cls,txt){var n=d.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n}
 function remove(){[CARD,ADMIN].forEach(function(id){var n=d.getElementById(id);if(n)n.remove()})}
 function place(n,app){var before=app.querySelector('.nava-profile-favorites, .nava-profile-stats, .nava-profile-tabs, .nava-profile-panel');if(before)app.insertBefore(n,before);else app.appendChild(n)}
 function card(){var c=el('section','nava-membership-card-12218');c.id=CARD;c.setAttribute('aria-label','Nava üyelik');var mark=el('span','nava-membership-mark-12218','N');var copy=el('div','nava-membership-copy-12218');copy.append(el('strong','','Nava Üyelik'),el('span','','Üyelik özellikleri hazırlanıyor.'));var status=el('span','nava-membership-status-12218','YAKINDA');c.append(mark,copy,status);return c}
 function adminControl(enabled){var box=el('section','nava-membership-admin-12218');box.id=ADMIN;var copy=el('div','nava-membership-admin-copy-12218');copy.append(el('strong','','Üyelik kartı görünürlüğü'),el('small','','Açıldığında profil sayfalarında görünür. Üyelik sistemi henüz etkin değildir.'));var label=el('label','nava-membership-switch-12218');var input=el('input','');input.type='checkbox';input.checked=!!enabled;input.setAttribute('aria-label','Üyelik kartını göster');var track=el('span','');label.append(input,track);input.addEventListener('change',function(){if(busy)return;var store=db(),api=w.firebase&&w.firebase.firestore;if(!store){input.checked=!input.checked;return}busy=true;input.disabled=true;var stamp;try{stamp=api&&api.FieldValue?api.FieldValue.serverTimestamp():new Date().toISOString()}catch(_){stamp=new Date().toISOString()}store.collection('appConfig').doc(CONFIG).set({enabled:input.checked,updatedAt:stamp},{merge:true}).then(function(){schedule()}).catch(function(){input.checked=!input.checked}).finally(function(){busy=false;input.disabled=false})});box.append(copy,label);return box}
 function render(){
  if(!own()){remove();return}
  var app=d.querySelector('.nava-profile-app'),u=user(),store=db();if(!app||!u||!store){remove();return}
  var uid=clean(u.uid);if(!uid){remove();return}lastUid=uid;
  Promise.all([
   store.collection('appConfig').doc(CONFIG).get().then(function(s){return s.exists&&(s.data()||{}).enabled===true}).catch(function(){return false}),
   store.collection('staff').doc(uid).get().then(function(s){return s.exists&&clean((s.data()||{}).role).toLowerCase()==='admin'}).catch(function(){return false})
  ]).then(function(values){
   if(!own()||lastUid!==uid||!app.isConnected)return;
   var enabled=values[0],isAdmin=values[1],c=d.getElementById(CARD),a=d.getElementById(ADMIN);
   if(enabled){if(!c)c=card();place(c,app)}else if(c)c.remove();
   if(isAdmin){if(!a)a=adminControl(enabled);else{var input=a.querySelector('input');if(input&&!input.matches(':active'))input.checked=enabled}place(a,app)}else if(a)a.remove();
  }).catch(function(){});
 }
 function schedule(){if(scheduled)return;scheduled=w.setTimeout(function(){scheduled=0;render()},180)}
 function init(){render();if(w.MutationObserver)new MutationObserver(schedule).observe(d.body,{childList:true,subtree:true});w.addEventListener('pageshow',schedule);w.addEventListener('popstate',schedule);d.addEventListener('nava:profile-customization-updated',schedule);if(w.auth&&typeof w.auth.onAuthStateChanged==='function')w.auth.onAuthStateChanged(schedule)}
 if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window,document);
