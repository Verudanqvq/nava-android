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
 function clean(s){return String(s||'').toLocaleLowerCase('tr-TR').replace(/ı/g,'i').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ö/g,'o').replace(/ç/g,'c').replace(/(?:bölüm|bolum|chapter|ch\.?|episode|ep\.?)\s*#?\s*\d+(?:\.\d+)?/gi,' ').replace(/(?:cilt|volume|vol\.?)\s*\d+(?:\.\d+)?/gi,' ').replace(/\b\d+\s*(?:bölüm|bolum|chapter|episode)\b/gi,' ').replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim()}
 function chapterNumber(s){var t=String(s||'');var patterns=[/(?:bölüm|bolum|chapter|episode|ep\.?|ch\.?)\s*#?\s*(\d+(?:\.\d+)?)/i,/(\d+(?:\.\d+)?)\s*(?:bölüm|bolum|chapter|episode)/i,/\/(?:bolum|chapter|episode)[-_/ ]*(\d+(?:\.\d+)?)/i];for(var i=0;i<patterns.length;i++){var m=t.match(patterns[i]);if(m)return Number(m[1])}return 0}
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
