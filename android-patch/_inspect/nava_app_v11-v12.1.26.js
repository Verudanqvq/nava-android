(function (d, w) {
  'use strict';
  if (w.__navaAppV11Installed) return;
  w.__navaAppV11Installed = true;
  w.__NAVA_ANDROID_APP__ = true;

  d.documentElement.classList.add('nava-app-v9');
  (function(){
    var p=(location.pathname||'/').replace(/\/+$/,'')||'/';
    if(p==='/')d.documentElement.classList.add('nava-app-path-home');
    if(/^\/search\/label\/Series$/i.test(p))d.documentElement.classList.add('nava-app-path-discover');
  })();

  var state = {
    route: 'general', series: [], chapters: [], continueItems: [],
    continueUnsub: null, authUnsub: null, libraryFilter: 'all', routeObserver: null, routeObserverRoot: null,
    readerScrollBound: false, cacheRefreshBound: false, lastDiscoverFilter: 'Tümü',
    notifications: [], notificationUser: null, notificationUnsub: null, notificationAuthUnsub: null, authUiBound: false, readObserver: null,
    readerChapterItems: [], readerChapterPromise: null, commentsMounted: false,
    volumeAuthUnsub: null, volumeReadUnsub: null, volumeReadSet: new Set(), volumeReadIds: new Set(), volumeReadUser: '', volumeReadLabel: '',
    readerSaveTimer: 0, readerPositionRestored: false,
    readerPrevUrl: '', readerNextUrl: '', smartNavBound: false, prewarmed: Object.create(null)
  };

  var I = {
    home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 10.5 12 3l8.5 7.5V21h-6v-6h-5v8h-6z"/></svg>',
    discover:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>',
    library:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h11.5A1.5 1.5 0 0 1 19 5.5V21l-6.5-3.8L6 21z"/><path d="M9 8h7"/></svg>',
    profile:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.7-4 3.2-6 7-6s6.3 2 7 6"/></svg>',
    search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>',
    bell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 9a6 6 0 0 0-12 0c0 6-2.8 6.5-2.8 8h17.6c0-1.5-2.8-2-2.8-8"/><path d="M10 21h4"/></svg>',
    back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    play:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l10-6.5z"/></svg>',
    chapters:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none"/></svg>',
    check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.2 2.2 2.2 4.8-5"/></svg>',
    comments:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11.5a8 8 0 0 1-8.2 8A9 9 0 0 1 8 18.7L3.8 20l1.3-4A8 8 0 1 1 20 11.5Z"/></svg>',
    text:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M5 6h14M9 6v12M15 6v12M7 18h4M13 18h4"/></svg>',
    prev:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 6-6 6 6 6"/></svg>',
    next:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.5 6 6 6-6 6"/></svg>',
    logout:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5H5v14h5"/><path d="m14 8 4 4-4 4"/><path d="M18 12H9"/></svg>',
    user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="8" r="3"/><path d="M4 19c.5-3.2 2.5-5 6-5 1.7 0 3 .4 4 1.1"/><circle cx="17.5" cy="16.5" r="3"/><path d="m19.7 18.7 2 2"/></svg>'
  };

  function ready(fn){ if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',fn,{once:true});else fn(); }
  function clean(v,n){ return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n||500); }
  function e(tag,cls,text){ var x=d.createElement(tag);if(cls)x.className=cls;if(text!=null)x.textContent=text;return x; }
  function safeUrl(v){
    try{
      var u=new URL(String(v||''),location.href),h=(u.hostname||'').toLowerCase();
      if(h==='verudanava.com'||h==='www.verudanava.com'||h==='verudanava.blogspot.com'){
        u.protocol='https:';u.hostname='www.verudanava.com';u.port='';
        return u.href;
      }
      return u.origin===location.origin?u.href:'';
    }catch(_){return'';}
  }
  function urlKey(v){
    try{
      var normalized=safeUrl(v);if(!normalized)return'';
      var u=new URL(normalized);u.hash='';
      return u.href.replace(/\/$/,'');
    }catch(_){return''}
  }
  function volumeKeyV9(value){return encodeURIComponent(clean(value,500).toLocaleLowerCase('tr-TR').replace(/\s+/g,' ')).slice(0,700)}
  function volumeReadCacheKey(uid,label){return 'nava-volume-read-v18:'+encodeURIComponent(clean(uid,180))+':'+volumeKeyV9(label)}
  function volumeReadLegacyCacheKey(uid,label){return 'nava-volume-read-v16:'+encodeURIComponent(clean(uid,180))+':'+volumeKeyV9(label)}
  function loadVolumeReadCache(uid,label){
    var result={urls:new Set(),ids:new Set()};
    try{
      var raw=localStorage.getItem(volumeReadCacheKey(uid,label));
      if(!raw)raw=localStorage.getItem(volumeReadLegacyCacheKey(uid,label));
      var parsed=JSON.parse(raw||'null');
      if(Array.isArray(parsed)){
        parsed.forEach(function(v){var k=urlKey(v);if(k)result.urls.add(k)});
      }else if(parsed&&typeof parsed==='object'){
        (Array.isArray(parsed.urls)?parsed.urls:[]).forEach(function(v){var k=urlKey(v);if(k)result.urls.add(k)});
        (Array.isArray(parsed.ids)?parsed.ids:[]).forEach(function(v){var id=normalizeChapterId(v);if(id)result.ids.add(id)});
      }
    }catch(_){}
    return result;
  }
  function saveVolumeReadCache(uid,label,urlSet,idSet){
    try{
      localStorage.setItem(volumeReadCacheKey(uid,label),JSON.stringify({
        urls:Array.from(urlSet||[]).slice(0,1200),
        ids:Array.from(idSet||[]).slice(0,1200)
      }));
    }catch(_){}
  }
  function highRes(v,size){size=Math.max(96,Math.min(1200,Number(size)||480));return clean(v,2000).replace(/\/s\d+(?:-[a-z0-9-]+)?\//i,'/s'+size+'/').replace(/\/w\d+(?:-h\d+)?(?:-[a-z0-9-]+)?\//i,'/s'+size+'/').replace(/=s\d+(?:-[a-z0-9-]+)?$/i,'=s'+size);}
  function textFromHtml(html){var b=d.createElement('div');b.innerHTML=String(html||'');return clean(b.textContent||'',1200);}
  function normalizeChapterId(v){
    var s=clean(v,300),m=s.match(/(?:post-|post:|\/posts\/|^)(\d{5,})$/i);
    if(m)return m[1];
    m=s.match(/post-(\d{5,})/i);
    return m?m[1]:s;
  }
  function entryChapterId(en){
    var raw=clean(en&&en.id&&en.id.$t,500);
    return normalizeChapterId(raw);
  }
  function postNative(m){try{if(w.NavaNative&&typeof w.NavaNative.postMessage==='function')w.NavaNative.postMessage(m);}catch(_){}}
  function smartNavigate(value){
    var u=safeUrl(value);if(!u)return;
    try{if(w.NavaNative&&typeof w.NavaNative.postMessage==='function'){w.NavaNative.postMessage('navigate:'+u);return;}}catch(_){}
    location.assign(u);
  }
  (function(){
    var originalOpen=w.open;
    w.open=function(value,target,features){
      var u=safeUrl(value);
      if(u){smartNavigate(u);return null;}
      return originalOpen?originalOpen.apply(w,arguments):null;
    };
  })();
  function bindSmartNavigation(){
    if(state.smartNavBound)return;state.smartNavBound=true;
    d.addEventListener('click',function(ev){
      if(ev.defaultPrevented||ev.button>0||ev.metaKey||ev.ctrlKey||ev.shiftKey||ev.altKey)return;
      var a=ev.target&&ev.target.closest?ev.target.closest('a[href]'):null;if(!a)return;
      /* Aktif bölüm satırı sadece sheet'i kapatsın; aynı URL'ye native navigation gönderme. */
      if(a.classList&&a.classList.contains('is-current')&&a.closest('#nava-reader-chapters-v9'))return;
      /* Aynı Nava linki target=_blank olsa bile uygulamadan çıkmasına izin verme.
         Harici target=_blank linkler safeUrl() boş döndürdüğü için normal davranışını korur. */
      if(a.hasAttribute('download'))return;
      var raw=a.getAttribute('href')||'';if(!raw||raw.charAt(0)==='#'||/^javascript:/i.test(raw))return;
      var u=safeUrl(a.href);if(!u)return;
      var parsed;try{parsed=new URL(u)}catch(_){return}
      if(parsed.pathname===location.pathname&&parsed.search===location.search&&parsed.hash)return;
      ev.preventDefault();smartNavigate(u);
    },true);
  }
  function volumeLabelFromPath(path){
    var m=String(path||location.pathname||'').match(/\/search\/label\/(.+)$/i);if(!m)return'';
    try{return clean(decodeURIComponent(m[1].replace(/\+/g,' ')),300)}catch(_){return clean(m[1],300)}
  }
  function volumeLabelFromPage(){
    var fromPath=volumeLabelFromPath();
    if(fromPath&&/(?:^|\s)(?:cilt|volume|vol\.?)(?:\s|[-–—:]|$)/i.test(fromPath))return fromPath;

    /* Cilt POST sayfalarında URL /search/label/... değildir. Önce gerçek etiket DOM'unu kullan. */
    var tags=[].slice.call(d.querySelectorAll('a[rel="tag"]'));
    for(var i=0;i<tags.length;i++){
      var t=clean(tags[i].textContent,300);
      if(t&&/(?:^|\s)(?:cilt|volume|vol\.?)[\s\-–—:]*\d+(?:\.\d+)?(?:\s|$)/i.test(t))return t;
    }

    /* Etiket DOM'da saklıysa başlık/heading'den '... Cilt N' kısmını çıkar. */
    var heading=d.querySelector("header h1[itemprop='name'],main h1,h1");
    var candidates=[heading&&heading.textContent,d.title];
    for(var k=0;k<candidates.length;k++){
      var value=clean(candidates[k],300).replace(/\s*[|–—-]\s*Nava(?:\s.*)?$/i,'');
      var m=value.match(/^(.+?\b(?:cilt|volume|vol\.?)\s*\d+(?:\.\d+)?)/i);
      if(m)return clean(m[1],300);
    }
    return'';
  }

  function route(){
    var p=(location.pathname||'/').replace(/\/+$/,'')||'/';var q=new URLSearchParams(location.search);
    if(p==='/')return'home';
    if(/^\/search\/label\/Series$/i.test(p))return'discover';
    if(/\/p\/profil\.html$/i.test(p)&&q.get('app')==='library')return'library';
    if(/\/p\/profil\.html$/i.test(p)&&q.get('app')==='profile')return'profile';

    /* Bölüm başlıklarında da 'Cilt 11 Bölüm 6' geçer; reader her zaman önce gelir. */
    if(d.querySelector('[data-nava-chapter-meta],#reader'))return'reader';

    /* Hem label URL'sini hem de normal Blogger cilt POST sayfasını volume olarak tanı. */
    if(volumeLabelFromPage())return'volume';

    if(d.querySelector("header[itemprop='mainEntity'][itemtype*='Book']"))return'series';
    return'general';
  }
  function applyRoute(r){state.route=r;d.documentElement.classList.add('nava-app-v9');if(!d.body)return;['home','discover','volume','library','profile','series','reader','general'].forEach(function(x){d.body.classList.remove('nava-app-'+x)});d.body.classList.add('nava-app-'+r);}
  function topTitle(){return clean(d.title.replace(/\s*[|–—-]\s*Nava.*$/i,''),90)||'Nava';}
  function iconButton(icon,label){var b=e('button','nava-app-icon-btn');b.type='button';b.setAttribute('aria-label',label);b.innerHTML=icon;return b;}

  function ensureShell(){
    if(state.route==='reader')return;
    var top=d.getElementById('nava-app-topbar');if(!top){top=e('header');top.id='nava-app-topbar';d.body.appendChild(top);}
    var bottom=d.getElementById('nava-app-bottom');if(!bottom){bottom=e('nav');bottom.id='nava-app-bottom';d.body.appendChild(bottom);}
    renderTop(top);renderBottom(bottom);
  }
  function renderTop(top){
    top.replaceChildren();
    if(['home','discover','library','profile'].indexOf(state.route)>=0){var brand=e('div','nava-app-brand');brand.innerHTML='<span>Nava</span>';top.appendChild(brand);}
    else{var wrap=e('div','nava-app-back-title');var back=iconButton(I.back,'Geri');back.onclick=function(){history.length>1?history.back():location.assign('/')};wrap.append(back,e('div','nava-app-page-title-top',state.route==='volume'?'Bölümler':topTitle()));top.appendChild(wrap);}
    var actions=e('div','nava-app-top-actions');
    var search=iconButton(I.search,'Ara');search.onclick=openSearch;
    var bell=iconButton(I.bell,'Bildirimler');bell.id='nava-app-bell';bell.classList.add('nava-app-bell-v9');bell.onclick=openNotifications;bell.insertAdjacentHTML('beforeend','<span class="nava-app-bell-badge-v9" hidden></span>');
    actions.append(search,bell);top.appendChild(actions);syncNotificationBadge();connectAppNotifications();
  }
  function nav(label,icon,href,key){var a=e('a','nava-app-nav-item'+(state.route===key?' is-active':''));a.href=href;a.innerHTML='<span class="nava-app-nav-icon">'+icon+'</span><span>'+label+'</span>';a.onclick=function(){postNative('haptic')};return a;}
  function renderBottom(b){b.replaceChildren(nav('Ana',I.home,'/','home'),nav('Keşfet',I.discover,'/search/label/Series','discover'),nav('Kütüphane',I.library,'/p/profil.html?app=library','library'),nav('Profil',I.profile,'/p/profil.html?app=profile','profile'));}
  function ensurePage(){var p=d.getElementById('nava-app-page');if(!p){p=e('main');p.id='nava-app-page';d.body.appendChild(p);}return p;}
  function removePage(){var p=d.getElementById('nava-app-page');if(p)p.remove();}
  function hideOriginalOwnedContent(){
    if(state.route!=='home'&&state.route!=='discover'&&state.route!=='volume')return;
    ['#Slider_Post','#section','#status','#feed','#main','#Label2','#Blog1','.grid-area','.blog-posts','.post-outer-container'].forEach(function(sel){
      d.querySelectorAll(sel).forEach(function(node){
        if(node&&node.id!=='nava-app-page'&&!node.closest('#nava-app-page')){
          node.style.setProperty('display','none','important');
          node.style.setProperty('visibility','hidden','important');
          node.setAttribute('aria-hidden','true');
        }
      });
    });
    d.querySelectorAll('main').forEach(function(node){
      if(node.id!=='nava-app-page'&&!node.closest('#nava-app-page')){
        node.style.setProperty('display','none','important');
        node.style.setProperty('visibility','hidden','important');
        node.setAttribute('aria-hidden','true');
      }
    });
  }
  function section(title,sub,right,href){var s=e('section','nava-app-section'),h=e('div','nava-app-section-head'),c=e('div');c.append(e('h2','nava-app-section-title',title));if(sub)c.append(e('div','nava-app-section-sub',sub));h.append(c);if(right){var a=e('a','nava-app-section-link',right);a.href=href||'#';h.append(a);}s.append(h);return s;}

  function cacheFetch(url,ttl){
    ttl=ttl||300000;
    var k='nava-v11:'+encodeURIComponent(url),cached=null;
    try{cached=JSON.parse(localStorage.getItem(k)||'null')}catch(_){}
    function network(){
      return fetch(url,{credentials:'same-origin',cache:'no-store'}).then(function(r){
        if(!r.ok)throw Error('feed');return r.json();
      }).then(function(data){
        try{localStorage.setItem(k,JSON.stringify({t:Date.now(),d:data}))}catch(_){}
        try{d.dispatchEvent(new CustomEvent('nava-app-feed-refresh',{detail:{url:url,data:data}}))}catch(_){}
        return data;
      });
    }
    if(cached&&cached.d){
      if(Date.now()-Number(cached.t||0)>ttl){
        var idle=w.requestIdleCallback||function(fn){return setTimeout(fn,120)};
        idle(function(){network().catch(function(){})});
      }
      return Promise.resolve(cached.d);
    }
    return network();
  }
  function labels(en){return(en&&en.category||[]).map(function(x){return clean(x.term,80)}).filter(Boolean);}
  function entryLink(en){var a=en&&en.link||[];for(var i=0;i<a.length;i++)if(a[i].rel==='alternate'&&a[i].href)return a[i].href;return'';}
  function entryImage(en){var m=en&&en.media$thumbnail&&en.media$thumbnail.url;if(m)return highRes(m,480);var html=String(en&&en.content&&en.content.$t||en&&en.summary&&en.summary.$t||'');var x=html.match(/<img[^>]+src=["']([^"']+)/i);return x?highRes(x[1],480):'';}
  function parseEntry(en){var ls=labels(en),title=clean(en&&en.title&&en.title.$t,400),type=ls.find(function(x){return['Light Novel','Web Novel','Manga','Manhwa','Manhua','Novel','LN','WN'].indexOf(x)>=0})||'Eser',status=ls.find(function(x){return['Güncel','Tamamlandı'].indexOf(x)>=0})||'',volumeLabel=ls.find(function(x){return/(?:^|\s)(?:cilt|volume|vol\.?)[\s\-–—:]*\d/i.test(x)})||'',updated=en&&en.updated&&en.updated.$t?new Date(en.updated.$t).getTime():0;return{title:title,url:safeUrl(entryLink(en)),chapterId:entryChapterId(en),image:entryImage(en),labels:ls,type:type,status:status,volumeLabel:volumeLabel,summary:textFromHtml(en&&en.summary&&en.summary.$t||''),updated:updated};}
  function getSeries(){return cacheFetch('/feeds/posts/summary/-/Series?alt=json&max-results=150',300000).then(function(p){return(p&&p.feed&&p.feed.entry||[]).map(parseEntry).filter(function(x){return x.title&&x.url&&!/(?:^|[\s\-–—])(cilt|volume|vol\.?)[\s\-]*\d+/i.test(x.title)})});}
  function getChapters(){var u='/feeds/posts/summary/-/'+encodeURIComponent('Bölüm')+'?alt=json&max-results=30';return cacheFetch(u,120000).then(function(p){return(p&&p.feed&&p.feed.entry||[]).map(parseEntry).filter(function(x){return x.title&&x.url})}).catch(function(){return cacheFetch('/feeds/posts/summary?alt=json&max-results=50',120000).then(function(p){return(p&&p.feed&&p.feed.entry||[]).filter(function(en){return labels(en).indexOf('Bölüm')>=0}).map(parseEntry)})});}
  function relative(v){var n=v&&typeof v.toDate==='function'?v.toDate().getTime():Number(v||0);if(!n||!isFinite(n))return'';var m=Math.floor((Date.now()-n)/60000);if(m<1)return'şimdi';if(m<60)return m+' dk';var h=Math.floor(m/60);if(h<24)return h+' sa';var day=Math.floor(h/24);if(day<30)return day+' gün';var mo=Math.floor(day/30);return mo<12?mo+' ay':new Date(n).toLocaleDateString('tr-TR');}

  function seriesCard(it){var a=e('a','nava-series-card-v2');a.href=it.url;var wra=e('div','nava-series-cover-wrap-v2'),img=e('img','nava-series-cover-v2');img.loading='lazy';img.decoding='async';img.alt=it.title;if(it.image)img.src=it.image;var badgeClass='nava-series-badge-v2';if(/web novel|\bwn\b/i.test(it.type))badgeClass+=' is-wn';else if(/light novel|\bln\b/i.test(it.type))badgeClass+=' is-ln';else if(/manga|manhwa|manhua/i.test(it.type))badgeClass+=' is-manga';wra.append(img,e('span',badgeClass,it.type));var t=e('div','nava-series-title-v2',it.title.replace(/\s*\((?:Light Novel|Web Novel|Manga|Manhwa|Manhua|Novel)\)\s*$/i,'')),m=e('div','nava-series-meta-v2'),dot=e('span','nava-status-dot-v2'+(it.status==='Tamamlandı'?' is-done':''));m.append(dot,d.createTextNode(it.status||'Güncel'));a.append(wra,t,m);return a;}
  function chapterRow(it){var a=e('a','nava-chapter-row-v2');a.href=it.url;var img=e('img','nava-chapter-thumb-v2');img.loading='lazy';img.alt='';if(it.image)img.src=it.image;var c=e('div','nava-chapter-copy-v2');c.append(e('div','nava-chapter-title-v2',it.title),e('div','nava-chapter-volume-v2',it.volumeLabel||'Bölüm'));a.append(img,c,e('div','nava-chapter-time-v2',it.updated?relative(it.updated):''));return a;}
  function continueCard(it){var a=e('a','nava-continue-card-v2');a.href=safeUrl(it.lastChapterUrl)||safeUrl(it.volumeUrl)||'#';var img=e('img','nava-continue-cover-v2');img.loading='lazy';img.alt=clean(it.volumeTitle,200);var src=highRes(it.cover,480);if(src)img.src=src;var c=e('div','nava-continue-copy-v2'),time=relative(it.lastReadAt),act=e('div','nava-continue-action-v2');act.innerHTML=I.play+'<span>Devam et</span>';c.append(e('div','nava-continue-kicker-v2',clean(it.volumeTitle,220)),e('div','nava-continue-title-v2',clean(it.lastChapterTitle,220)||'Son bölüme devam et'),e('div','nava-continue-meta-v2',(Number(it.readCount)||0)+' bölüm okundu'+(time?' · '+time+' önce':'')),act);a.append(img,c);return a;}

  function heroSlider(items){
    var wrap=e('section','nava-hero-slider-v5'),track=e('div','nava-hero-track-v5'),dots=e('div','nava-hero-dots-v5');
    var arr=(items||[]).slice(0,5);
    if(!arr.length)return wrap;
    arr.forEach(function(it,index){
      var a=e('a','nava-hero-slide-v5');a.href=it.url;
      if(it.image)a.style.backgroundImage='linear-gradient(90deg,rgba(11,18,32,.82),rgba(11,18,32,.24)),url("'+String(it.image).replace(/"/g,'%22')+'")';
      var copy=e('div','nava-hero-copy-v5');
      copy.append(e('div','nava-hero-kicker-v5',(it.type||'Eser')+(it.status?' · '+it.status:'')),e('div','nava-hero-title-v5',it.title.replace(/\s*\((?:Light Novel|Web Novel|Manga|Manhwa|Manhua|Novel)\)\s*$/i,'')),e('div','nava-hero-cta-v5','Hemen Oku'));
      a.append(copy);track.append(a);
      var dot=e('button','nava-hero-dot-v5'+(index===0?' is-active':''));dot.type='button';dot.setAttribute('aria-label',(index+1)+'. slayt');dot.onclick=function(){a.scrollIntoView({behavior:'smooth',inline:'start',block:'nearest'})};dots.append(dot);
    });
    var raf=0;track.addEventListener('scroll',function(){if(raf)return;raf=requestAnimationFrame(function(){raf=0;var slides=[].slice.call(track.children),best=0,dist=Infinity;slides.forEach(function(slide,i){var d0=Math.abs(slide.offsetLeft-track.scrollLeft);if(d0<dist){dist=d0;best=i}});dots.querySelectorAll('.nava-hero-dot-v5').forEach(function(x,i){x.classList.toggle('is-active',i===best)})})},{passive:true});
    wrap.append(track,dots);return wrap;
  }

  function skeletonHome(p){p.replaceChildren();var s=section('Okumaya Devam Et','Son okuduğun bölümler'),r=e('div','nava-app-scroll');for(var i=0;i<2;i++)r.append(e('div','nava-continue-card-v2 nava-skeleton-v2'));s.append(r);p.append(s);var f=section('Öne Çıkanlar','Nava’daki eserler','Daha Fazla','/search/label/Series'),fr=e('div','nava-app-scroll');for(var k=0;k<4;k++){var sk=e('div','nava-series-card-v2 nava-skeleton-v2');sk.style.height='205px';sk.style.borderRadius='16px';fr.append(sk)}f.append(fr);p.append(f);}
  function drawHome(p){
    p.replaceChildren();
    if(state.series.length)p.append(heroSlider(state.series));
    if(state.continueItems.length){
      var c=section('Okumaya Devam Et','Son okuduğun bölümler'),cr=e('div','nava-app-scroll');
      state.continueItems.slice(0,4).forEach(function(x){cr.append(continueCard(x))});c.append(cr);p.append(c);
    }
    var s=section('Öne Çıkanlar','Güncel ve sevilen eserler','Daha Fazla','/search/label/Series'),sr=e('div','nava-app-scroll');
    if(state.series.length)state.series.slice(0,8).forEach(function(x){sr.append(seriesCard(x))});
    else sr.append(e('div','nava-app-empty-card','Eserler yüklenemedi.'));
    s.append(sr);p.append(s);

    if(state.series.length){
      var newest=state.series.slice().sort(function(a,b){return Number(b.updated||0)-Number(a.updated||0)}).slice(0,7);
      var ns=section('Yeni Eserler','Son güncellenen seriler','Tümünü Gör','/search/label/Series'),nr=e('div','nava-app-scroll');
      newest.forEach(function(x){nr.append(seriesCard(x))});ns.append(nr);p.append(ns);
    }

    var ch=section('Son Eklenenler','En yeni bölümler'),list=e('div','nava-chapter-list-v2');
    if(state.chapters.length)state.chapters.slice(0,4).forEach(function(x){list.append(chapterRow(x))});
    else list.append(e('div','nava-app-empty-card','Yeni bölümler şu anda yüklenemiyor.'));
    ch.append(list);p.append(ch);
  }
  function renderHome(){
    hideOriginalOwnedContent();
    var p=ensurePage();
    if(!state.series.length&&!state.chapters.length)skeletonHome(p);else drawHome(p);
    Promise.all([getSeries(),getChapters()]).then(function(x){state.series=x[0];state.chapters=x[1];drawHome(p)}).catch(function(){drawHome(p)});
    connectContinue();
  }
  function waitFirebase(cb){var n=0;(function a(){n++;if(w.firebase&&firebase.auth&&w.db){cb();return}if(n<50)setTimeout(a,160)})();}
  function connectContinue(){if(state.route!=='home')return;waitFirebase(function(){if(state.authUnsub)return;state.authUnsub=firebase.auth().onAuthStateChanged(function(user){if(state.continueUnsub){try{state.continueUnsub()}catch(_){}state.continueUnsub=null}state.continueItems=[];if(!user){var p=d.getElementById('nava-app-page');if(p)drawHome(p);return}try{state.continueUnsub=w.db.collection('users').doc(user.uid).collection('reading').orderBy('lastReadAt','desc').limit(8).onSnapshot(function(snap){state.continueItems=snap.docs.map(function(doc){return Object.assign({docId:doc.id},doc.data()||{})});var p=d.getElementById('nava-app-page');if(p&&state.route==='home')drawHome(p)},function(){})}catch(_){}})});}

  function renderDiscover(){
    hideOriginalOwnedContent();
    var p=ensurePage();p.replaceChildren();var h=e('div','nava-discover-head');h.append(e('div','nava-discover-title','Keşfet'),e('div','nava-discover-copy','Nava’daki eserler alfabetik sırada.'));p.append(h);
    var f=e('div','nava-filter-row-v2');['Tümü','Light Novel','Web Novel','Manga'].forEach(function(label){var b=e('button','nava-filter-chip-v2'+(label==='Tümü'?' is-active':''),label);b.type='button';b.onclick=function(){state.lastDiscoverFilter=label;f.querySelectorAll('button').forEach(function(x){x.classList.remove('is-active')});b.classList.add('is-active');drawGrid(label);postNative('haptic')};f.append(b)});p.append(f);
    var grid=e('div','nava-discover-grid-v2');grid.id='nava-discover-grid-v2';p.append(grid);for(var i=0;i<6;i++){var sk=e('div','nava-skeleton-v2');sk.style.aspectRatio='.7';sk.style.borderRadius='18px';grid.append(sk)}
    getSeries().then(function(x){state.series=x;drawGrid(state.lastDiscoverFilter||'Tümü')}).catch(function(){grid.replaceChildren(e('div','nava-app-empty-card','Eserler yüklenemedi.'))});
  }
  function drawGrid(filter){var g=d.getElementById('nava-discover-grid-v2');if(!g)return;g.replaceChildren();var arr=state.series.filter(function(x){return filter==='Tümü'||x.type===filter}).slice().sort(function(a,b){return a.title.localeCompare(b.title,'tr',{sensitivity:'base'})});if(!arr.length){g.append(e('div','nava-app-empty-card','Bu filtrede eser bulunamadı.'));return}arr.forEach(function(x){var a=e('a','nava-discover-card-v2');a.href=x.url;var img=e('img','nava-discover-cover-v2');img.loading='lazy';img.alt=x.title;if(x.image)img.src=x.image;a.append(img,e('div','nava-discover-card-title-v2',x.title.replace(/\s*\((?:Light Novel|Web Novel|Manga|Manhwa|Manhua|Novel)\)\s*$/i,'')),e('div','nava-discover-card-meta-v2',(x.type||'Eser')+(x.status?' · '+x.status:'')));g.append(a)});}

  function volumeChapterRow(it){
    var a=e('a','nava-volume-chapter-row-v9');a.href=it.url;if(it.chapterId)a.dataset.navaChapterId=normalizeChapterId(it.chapterId);
    var no=chapterNo(it.title),lead=e('span','nava-volume-chapter-no-v9',no>=0?'#'+String(no):'•');
    var copy=e('span','nava-volume-chapter-copy-v9');
    copy.append(e('strong','',shortChapterTitle(it.title)),e('small','',it.updated?relative(it.updated)+' önce':''));
    a.append(lead,copy,e('span','nava-volume-chapter-arrow-v9','›'));return a;
  }
  function rowIsRead(row,readSet,readIds){
    var byUrl=!!(readSet&&readSet.has(urlKey(row.href)));
    var id=normalizeChapterId(row&&row.dataset&&row.dataset.navaChapterId||'');
    var byId=!!(id&&readIds&&readIds.has(id));
    return byUrl||byId;
  }
  function decorateVolumeReadRows(readSet,readIds){
    readSet=readSet||new Set();readIds=readIds||new Set();
    d.querySelectorAll('.nava-volume-chapter-row-v9').forEach(function(row){
      var read=rowIsRead(row,readSet,readIds);row.classList.toggle('is-read',read);row.setAttribute('aria-label',(read?'Okundu: ':'')+clean(row.textContent,220));
      var arrow=row.querySelector('.nava-volume-chapter-arrow-v9');if(arrow)arrow.textContent=read?'✓':'›';
    });
  }
  function decorateReaderReadRows(readSet,readIds){
    readSet=readSet||new Set();readIds=readIds||new Set();
    d.querySelectorAll('.nava-reader-chapter-link-v9').forEach(function(row){
      var read=rowIsRead(row,readSet,readIds);row.classList.toggle('is-read',read);row.setAttribute('aria-label',(read?'Okundu: ':'')+clean(row.textContent,220));
      var arrow=row.querySelector('.nava-reader-chapter-arrow-v10');if(arrow)arrow.textContent=read?'✓':'›';
    });
  }
  function decorateAllReadRows(readSet,readIds){
    decorateVolumeReadRows(readSet,readIds);
    decorateReaderReadRows(readSet,readIds);
  }
  function connectVolumeReadState(label){
    label=clean(label,500);if(!label)return;
    state.volumeReadLabel=label;
    waitFirebase(function(){
      if(state.volumeAuthUnsub)return;
      state.volumeAuthUnsub=firebase.auth().onAuthStateChanged(function(user){
        if(state.volumeReadUnsub){try{state.volumeReadUnsub()}catch(_){}state.volumeReadUnsub=null}
        state.volumeReadUser=user&&user.uid?String(user.uid):'';
        if(!user){
          state.volumeReadSet=new Set();state.volumeReadIds=new Set();
          decorateAllReadRows(state.volumeReadSet,state.volumeReadIds);
          return;
        }

        var cached=loadVolumeReadCache(user.uid,state.volumeReadLabel);
        state.volumeReadSet=cached.urls;state.volumeReadIds=cached.ids;
        decorateAllReadRows(state.volumeReadSet,state.volumeReadIds);

        try{
          var database=w.db||firebase.firestore();
          state.volumeReadUnsub=database.collection('users').doc(user.uid).collection('reading').doc(volumeKeyV9(state.volumeReadLabel)).collection('chapters').onSnapshot({includeMetadataChanges:true},function(snap){
            var read=new Set(),ids=new Set();
            snap.forEach(function(doc){
              var data=doc.data()||{},u=urlKey(data.url),id=normalizeChapterId(data.id||doc.id);
              if(u)read.add(u);if(id)ids.add(id);
            });
            var fromCache=!!(snap&&snap.metadata&&snap.metadata.fromCache);
            if(fromCache&&read.size===0&&ids.size===0&&((state.volumeReadSet&&state.volumeReadSet.size>0)||(state.volumeReadIds&&state.volumeReadIds.size>0))){
              decorateAllReadRows(state.volumeReadSet,state.volumeReadIds);
              return;
            }
            state.volumeReadSet=read;state.volumeReadIds=ids;
            saveVolumeReadCache(user.uid,state.volumeReadLabel,read,ids);
            decorateAllReadRows(state.volumeReadSet,state.volumeReadIds);
          },function(){
            decorateAllReadRows(state.volumeReadSet,state.volumeReadIds);
          });
        }catch(_){
          decorateAllReadRows(state.volumeReadSet,state.volumeReadIds);
        }
      });
    });
  }

  function renderVolume(){
    hideOriginalOwnedContent();
    var p=ensurePage(),label=volumeLabelFromPage(),items=[];
    p.replaceChildren();
    var hero=e('section','nava-volume-head-v9');
    hero.append(e('div','nava-volume-kicker-v9','Cilt'),e('h1','nava-volume-title-v9',label||'Bölümler'),e('div','nava-volume-sub-v9','Bölümler okuma sırasına göre listelenir.'));
    var toolbar=e('div','nava-volume-toolbar-v9'),search=e('input','nava-volume-search-v9');search.type='search';search.autocomplete='off';search.placeholder='Bölüm ara…';
    var count=e('span','nava-volume-count-v9','Yükleniyor…');toolbar.append(search,count);
    var list=e('div','nava-volume-list-v9');list.append(e('div','nava-app-empty-card','Bölümler yükleniyor…'));
    p.append(hero,toolbar,list);connectVolumeReadState(label);
    function draw(){
      var q=clean(search.value,80).toLocaleLowerCase('tr-TR'),shown=items.filter(function(x){return !q||x.title.toLocaleLowerCase('tr-TR').indexOf(q)>=0});
      list.replaceChildren();count.textContent=shown.length+' bölüm';
      if(!shown.length){list.append(e('div','nava-app-empty-card',q?'Bölüm bulunamadı.':'Henüz bölüm yok.'));return;}
      shown.forEach(function(x){list.append(volumeChapterRow(x))});
      decorateAllReadRows(state.volumeReadSet,state.volumeReadIds);
    }
    search.oninput=draw;
    if(!label){items=[];draw();return;}
    cacheFetch('/feeds/posts/summary/-/'+encodeURIComponent(label)+'?alt=json&max-results=150',120000).then(function(payload){
      items=(payload&&payload.feed&&payload.feed.entry||[]).map(parseEntry).filter(function(x){return x.url&&x.title&&x.labels.indexOf('Bölüm')>=0});
      items.sort(function(a,b){var an=chapterNo(a.title),bn=chapterNo(b.title);if(an>=0&&bn>=0)return an-bn;return a.title.localeCompare(b.title,'tr',{numeric:true})});
      draw();
    }).catch(function(){list.replaceChildren(e('div','nava-app-empty-card','Bölümler yüklenemedi.'));count.textContent='';});
  }



  function decorateLibrary(){removePage();var app=d.querySelector('.nava-profile-app');if(!app)return;var head=d.getElementById('nava-app-library-head-v2');if(!head){head=e('div','nava-app-library-head-v2');head.id='nava-app-library-head-v2';head.append(e('div','nava-app-library-title-v2','Kütüphanem'),e('div','nava-app-library-sub-v2','Okuma listeni ve ilerlemeni yönet.'));app.insertBefore(head,app.firstChild);var f=e('div','nava-library-filter-v2');f.id='nava-library-filter-v2';[['all','Tümü'],['plan','Okuyacağım'],['reading','Okuyorum'],['completed','Tamamladım'],['paused','Beklemede'],['dropped','Bıraktım']].forEach(function(pair){var b=e('button',pair[0]==='all'?'is-active':'',pair[1]);b.type='button';b.onclick=function(){state.libraryFilter=pair[0];f.querySelectorAll('button').forEach(function(x){x.classList.toggle('is-active',x===b)});applyLibraryFilter();postNative('haptic')};f.append(b)});head.after(f);}applyLibraryFilter();}
  function applyLibraryFilter(){d.querySelectorAll('.nava-profile-library-card').forEach(function(card){var s=card.querySelector('.nava-library-status-select'),v=s?s.value:'';card.style.display=(state.libraryFilter==='all'||v===state.libraryFilter)?'':'none'});}
  function logoutApp(btn){
    if(btn){btn.disabled=true;btn.querySelector('span')&&(btn.querySelector('span').textContent='Çıkılıyor…')}
    var op=null;try{op=typeof w.navaLogout==='function'?w.navaLogout():(w.firebase&&firebase.auth?firebase.auth().signOut():Promise.reject(new Error('Giriş sistemi hazır değil.')))}catch(err){op=Promise.reject(err)}
    Promise.resolve(op).then(function(){location.assign('/')}).catch(function(){if(btn){btn.disabled=false;btn.querySelector('span')&&(btn.querySelector('span').textContent='Çıkış Yap')}});
  }
  function isOwnProfileRoute(){
    return !new URLSearchParams(location.search).get('u');
  }
  function ensureProfileActions(app){
    var hero=app.querySelector('.nava-profile-hero');if(!hero)return;
    var old=d.getElementById('nava-profile-actions-v5');
    if(!isOwnProfileRoute()){if(old)old.remove();return;}
    if(old)return;
    var bar=e('div','nava-profile-actions-v5');bar.id='nava-profile-actions-v5';
    var user=e('button','nava-profile-action-v5');user.type='button';user.innerHTML=I.user+'<span>Kullanıcı Ara</span>';user.onclick=function(){openSearch('@')};
    var logout=e('button','nava-profile-action-v5 is-danger');logout.type='button';logout.innerHTML=I.logout+'<span>Çıkış Yap</span>';logout.onclick=function(){logoutApp(logout)};
    bar.append(user,logout);hero.after(bar);
  }
  function normalizeProfileTabs(app){
    var tabs=app.querySelector('.nava-profile-tabs');if(!tabs)return;
    var own=isOwnProfileRoute();
    d.body.classList.toggle('nava-app-own-profile',own);
    var library=tabs.querySelector('[data-tab="library"]'),panel=app.querySelector('.nava-profile-panel');
    if(own&&library&&library.classList.contains('is-active')){
      if(panel)panel.classList.add('nava-profile-panel-switching-v11');
      var ratings=tabs.querySelector('[data-tab="ratings"]')||tabs.querySelector('[data-tab="comments"]');
      if(ratings&&!ratings.dataset.navaAutoOpen){ratings.dataset.navaAutoOpen='1';setTimeout(function(){try{ratings.click()}catch(_){}},0)}
    }else if(panel)panel.classList.remove('nava-profile-panel-switching-v11');
  }
  function moveAfter(parent,node,anchor){
    if(!node||node.parentNode!==parent||!anchor)return anchor;
    if(anchor.nextSibling!==node)parent.insertBefore(node,anchor.nextSibling);
    return node;
  }
  function reorderProfile(app){
    var hero=app.querySelector('.nava-profile-hero');if(!hero)return;
    var actions=d.getElementById('nava-profile-actions-v5');
    var fav=app.querySelector('.nava-profile-favorites');
    var stats=app.querySelector('.nava-profile-stats');
    var tabs=app.querySelector('.nava-profile-tabs');
    var panel=app.querySelector('.nava-profile-panel');
    var cont=d.getElementById('nava-profile-continue');if(cont)cont.remove();
    var anchor=hero;
    anchor=moveAfter(app,actions,anchor);
    anchor=moveAfter(app,fav,anchor);
    anchor=moveAfter(app,stats,anchor);
    anchor=moveAfter(app,tabs,anchor);
    moveAfter(app,panel,anchor);
  }
  function decorateProfile(){
    removePage();
    var app=d.querySelector('.nava-profile-app');if(!app)return false;
    app.classList.add('nava-app-profile-owned-v9');
    ensureProfileActions(app);normalizeProfileTabs(app);reorderProfile(app);return true;
  }


  function decorateSeries(){
    removePage();
    var main=d.querySelector('main[itemscope]');
    if(main)main.classList.add('nava-app-series-owned-v5');
  }

  function notificationDate(v){
    try{if(v&&typeof v.toDate==='function')return v.toDate();if(v&&v.seconds)return new Date(v.seconds*1000);if(v)return new Date(v)}catch(_){}return null;
  }
  function notificationAgo(v){var dt=notificationDate(v);if(!dt||isNaN(dt.getTime()))return'';var sec=Math.max(0,Math.floor((Date.now()-dt.getTime())/1000));if(sec<60)return'az önce';if(sec<3600)return Math.floor(sec/60)+' dk önce';if(sec<86400)return Math.floor(sec/3600)+' sa önce';return Math.floor(sec/86400)+' gün önce';}
  function notificationCopy(item){
    var type=clean(item&&item.type,40),title=clean(item&&item.title,160),body=clean(item&&item.body,220);
    if(type==='reply')return'Yorumuna yeni bir yanıt geldi.';
    if(type==='like')return'Yorumun beğenildi.';
    if(type==='chapter')return(body||'Takip ettiğin eser')+' için yeni bölüm yayımlandı.';
    if(type==='comment_removed')return'Yorumun yönetim ekibi tarafından kaldırıldı.';
    if(type==='bug_resolved')return'Hata bildirimin çözüldü olarak işaretlendi.';
    if(type==='contact_resolved')return'İletişim mesajın çözüldü olarak işaretlendi.';
    if(type==='system')return body||title||'Nava yönetiminden yeni bir mesajın var.';
    return title||body||'Yeni bir bildirimin var.';
  }
  function syncNotificationBadge(){
    var b=d.querySelector('#nava-app-bell .nava-app-bell-badge-v9');if(!b)return;
    var n=state.notifications.filter(function(x){return !x.read}).length;
    b.hidden=n<1;b.textContent=n>99?'99+':String(n);
  }
  function ensureNotificationSheet(){
    var sh=d.getElementById('nava-app-notifications-v9');if(sh)return sh;
    sh=e('section');sh.id='nava-app-notifications-v9';sh.hidden=true;
    sh.innerHTML='<div class="nava-app-sheet-backdrop-v9" data-nava-sheet-close="1"></div><div class="nava-app-notification-card-v9"><div class="nava-app-notification-head-v9"><div><strong>Bildirimler</strong><span data-nava-notification-sub="1">Nava hesabındaki bildirimler</span></div><div class="nava-app-notification-head-actions-v9"><button type="button" data-nava-mark-all="1">Tümünü oku</button><button type="button" class="nava-app-sheet-close-v9" data-nava-sheet-close="1">×</button></div></div><div class="nava-app-notification-list-v9" data-nava-notification-list="1"></div></div>';
    d.body.appendChild(sh);
    sh.querySelectorAll('[data-nava-sheet-close]').forEach(function(x){x.addEventListener('click',function(){sh.hidden=true})});
    sh.querySelector('[data-nava-mark-all]').addEventListener('click',markAllAppNotifications);
    return sh;
  }
  function renderAppNotifications(){
    syncNotificationBadge();var sh=ensureNotificationSheet(),list=sh.querySelector('[data-nava-notification-list]');if(!list)return;list.replaceChildren();
    if(!state.notificationUser){list.append(e('div','nava-app-notification-empty-v9','Bildirimleri görmek için giriş yap.'));return;}
    if(!state.notifications.length){list.append(e('div','nava-app-notification-empty-v9','Henüz bildirimin yok.'));return;}
    state.notifications.forEach(function(item){
      var row=e('button','nava-app-notification-row-v9'+(!item.read?' is-unread':''));row.type='button';
      var dot=e('span','nava-app-notification-icon-v9',item.type==='chapter'?'＋':item.type==='like'?'♥':item.type==='reply'?'↩':'•');
      var copy=e('span','nava-app-notification-copy-v9');copy.append(e('strong','',notificationCopy(item)));if(item.title&&item.type!=='system')copy.append(e('span','',clean(item.title,120)));var ago=notificationAgo(item.createdAt);if(ago)copy.append(e('small','',ago));row.append(dot,copy);
      row.onclick=function(){markOneAppNotification(item);var u=safeUrl(item.url);if(u){sh.hidden=true;smartNavigate(u)}};list.append(row);
    });
  }
  function markOneAppNotification(item){if(!state.notificationUser||!item||!item.id||item.read)return;item.read=true;syncNotificationBadge();try{(w.db||firebase.firestore()).collection('users').doc(state.notificationUser.uid).collection('notifications').doc(item.id).set({read:true,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}).catch(function(){})}catch(_){}}
  function markAllAppNotifications(){
    if(!state.notificationUser)return;var unread=state.notifications.filter(function(x){return !x.read&&x.id});if(!unread.length)return;
    try{var dbx=w.db||firebase.firestore(),batch=dbx.batch();unread.forEach(function(item){item.read=true;batch.set(dbx.collection('users').doc(state.notificationUser.uid).collection('notifications').doc(item.id),{read:true,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true})});syncNotificationBadge();renderAppNotifications();batch.commit().catch(function(){})}catch(_){}
  }
  function connectAppNotifications(){
    if(state.notificationAuthUnsub)return;waitFirebase(function(){if(state.notificationAuthUnsub)return;state.notificationAuthUnsub=firebase.auth().onAuthStateChanged(function(user){
      if(state.notificationUnsub){try{state.notificationUnsub()}catch(_){}state.notificationUnsub=null}state.notificationUser=user||null;state.notifications=[];renderAppNotifications();
      if(!user)return;try{state.notificationUnsub=(w.db||firebase.firestore()).collection('users').doc(user.uid).collection('notifications').orderBy('createdAt','desc').limit(40).onSnapshot(function(snap){state.notifications=snap.docs.map(function(doc){return Object.assign({id:doc.id},doc.data()||{})});renderAppNotifications()},function(){renderAppNotifications()})}catch(_){renderAppNotifications()}
    })});
  }
  function hideOverlay(id){var x=d.getElementById(id);if(x)x.hidden=true;}
  function openNotifications(){hideOverlay('nava-app-search-v2');connectAppNotifications();var sh=ensureNotificationSheet();renderAppNotifications();sh.hidden=false;postNative('haptic');}
  function searchUsersApp(raw,res){
    var q=clean(raw,21).replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_]/g,'');
    if(!q){res.innerHTML='<div class="nava-search-state-v2">Kullanıcı adı yaz: @veldanava</div>';return;}
    if(!w.firebase||!firebase.firestore){res.innerHTML='<div class="nava-search-state-v2">Kullanıcı araması hazırlanıyor…</div>';setTimeout(function(){searchUsersApp(raw,res)},350);return;}
    res.innerHTML='<div class="nava-search-state-v2">Kullanıcılar aranıyor…</div>';
    var dbx=w.db||firebase.firestore();
    dbx.collection('usernames').orderBy(firebase.firestore.FieldPath.documentId()).startAt(q).endAt(q+'\uf8ff').limit(12).get().then(function(snap){
      var claims=snap.docs.map(function(doc){return{username:doc.id,uid:(doc.data()||{}).uid}}).filter(function(x){return x.uid});
      return Promise.all(claims.map(function(c){return dbx.collection('users').doc(c.uid).get().then(function(u){if(!u.exists)return null;var p=u.data()||{};p.username=p.username||c.username;return p}).catch(function(){return null})}));
    }).then(function(items){items=(items||[]).filter(Boolean);res.replaceChildren();if(!items.length){res.innerHTML='<div class="nava-search-state-v2">Kullanıcı bulunamadı.</div>';return}items.forEach(function(p){var a=e('a','nava-search-row-v2 nava-search-user-v5');a.href='/p/profil.html?app=profile&u='+encodeURIComponent(p.username||'');var av;if(p.avatarType==='google'&&/^https:\/\/lh\d+\.googleusercontent\.com\//i.test(String(p.photoURL||''))){av=e('img','nava-search-user-avatar-v5');av.referrerPolicy='no-referrer';av.src=p.photoURL}else{av=e('div','nava-search-user-avatar-v5 is-fallback',clean((p.displayName||p.username||'K').charAt(0),1).toUpperCase())}var c=e('div');c.append(e('div','nava-search-row-title-v2',p.displayName||p.username||'Kullanıcı'),e('div','nava-search-row-meta-v2','@'+(p.username||'')));a.append(av,c);res.append(a)})}).catch(function(){res.innerHTML='<div class="nava-search-state-v2">Kullanıcılar aranamadı.</div>'});
  }
  function ensureSearch(){
    var o=d.getElementById('nava-app-search-v2');if(o)return o;
    o=e('section');o.id='nava-app-search-v2';o.hidden=true;o.innerHTML='<div class="nava-search-head-v2"><button class="nava-search-back-v2" type="button" aria-label="Kapat">'+I.back+'</button><input class="nava-search-box-v2" type="search" autocomplete="off" placeholder="Eser veya @kullanıcı ara…"></div><div class="nava-search-results-v2"><div class="nava-search-state-v2">Eser adı veya @kullanıcı yaz.</div></div>';
    d.body.append(o);var input=o.querySelector('input'),res=o.querySelector('.nava-search-results-v2'),timer=0;o.querySelector('button').onclick=function(){o.hidden=true;input.blur()};o.addEventListener('click',function(ev){if(ev.target===o){o.hidden=true;input.blur()}});o.querySelector('.nava-search-head-v2').addEventListener('click',function(ev){ev.stopPropagation()});res.addEventListener('click',function(ev){ev.stopPropagation()});
    input.oninput=function(){clearTimeout(timer);var raw=clean(input.value,100);if(raw.charAt(0)==='@'){timer=setTimeout(function(){searchUsersApp(raw,res)},180);return}var q=raw.toLocaleLowerCase('tr-TR');if(q.length<2){res.innerHTML='<div class="nava-search-state-v2">En az 2 harf yaz veya @kullanıcı ara.</div>';return}timer=setTimeout(function(){var src=state.series.length?Promise.resolve(state.series):getSeries();res.innerHTML='<div class="nava-search-state-v2">Eserler aranıyor…</div>';src.then(function(items){state.series=items;var found=items.filter(function(x){return x.title.toLocaleLowerCase('tr-TR').indexOf(q)>=0}).slice(0,20);res.replaceChildren();if(!found.length){res.innerHTML='<div class="nava-search-state-v2">Eser bulunamadı.</div>';return}found.forEach(function(x){var a=e('a','nava-search-row-v2');a.href=x.url;var img=e('img');img.loading='lazy';if(x.image)img.src=x.image;var c=e('div');c.append(e('div','nava-search-row-title-v2',x.title),e('div','nava-search-row-meta-v2',(x.type||'Eser')+(x.status?' · '+x.status:'')));a.append(img,c);res.append(a)})}).catch(function(){res.innerHTML='<div class="nava-search-state-v2">Arama şu anda kullanılamıyor.</div>'})},180)};
    return o;
  }
  function openSearch(prefill){hideOverlay('nava-app-notifications-v9');var o=ensureSearch();o.hidden=false;var i=o.querySelector('input');if(typeof prefill==='string'){i.value=prefill;i.dispatchEvent(new Event('input',{bubbles:true}))}setTimeout(function(){try{i.focus();if(prefill)i.setSelectionRange(i.value.length,i.value.length)}catch(_){}},40);postNative('haptic');}


  function chapterMeta(){
    var n=d.querySelector('[data-nava-chapter-meta]');
    return n?{volumeTitle:clean(n.getAttribute('data-volume-title'),300),chapterTitle:clean(n.getAttribute('data-chapter-title'),300),chapterUrl:safeUrl(n.getAttribute('data-chapter-url'))||safeUrl(location.href)}:null;
  }
  function readerAction(label,icon,fn){var b=e('button','nava-reader-action-v2');b.type='button';b.innerHTML=icon+'<span>'+label+'</span>';b.onclick=function(){fn();postNative('haptic')};return b;}
  function currentChapterLabel(){var n=d.getElementById('nextPrevJSbottom');return clean(n&&n.getAttribute('data-label'),300);}
  function chapterNo(title){var m=String(title||'').match(/(?:Bölüm|Chapter|Ep(?:isode)?)[\s.:#-]*(\d+(?:\.\d+)?)/i);return m?Number(m[1]):-1;}
  function shortChapterTitle(title){var meta=chapterMeta(),v=meta&&meta.volumeTitle||'';var t=clean(title,220);if(v&&t.toLocaleLowerCase('tr-TR').indexOf(v.toLocaleLowerCase('tr-TR'))===0)t=clean(t.slice(v.length).replace(/^\s*[-–—:|]\s*/,''),220);return t||clean(title,220);}
  function allowPrewarm(){
    var c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    if(c&&c.saveData)return false;
    var t=clean(c&&c.effectiveType,20).toLowerCase();return t!=='slow-2g'&&t!=='2g';
  }
  function prewarmPage(value){
    var u=safeUrl(value);if(!u||urlKey(u)===urlKey(location.href)||state.prewarmed[urlKey(u)]||!allowPrewarm())return;
    state.prewarmed[urlKey(u)]=1;
    var idle=w.requestIdleCallback||function(fn){return setTimeout(fn,420)};
    idle(function(){fetch(u,{credentials:'same-origin',cache:'force-cache'}).then(function(r){if(r.ok)return r.text()}).catch(function(){})});
  }
  function scheduleMainPrewarm(){
    var target=state.route==='home'?'/search/label/Series':state.route==='discover'?'/':state.route==='library'?'/p/profil.html?app=profile':state.route==='profile'?'/p/profil.html?app=library':'';
    if(target)setTimeout(function(){prewarmPage(target)},900);
  }
  function loadReaderChapters(){
    if(state.readerChapterItems.length)return Promise.resolve(state.readerChapterItems);
    if(state.readerChapterPromise)return state.readerChapterPromise;
    var label=currentChapterLabel();
    if(!label){state.readerChapterPromise=Promise.resolve([]);return state.readerChapterPromise;}
    var url='/feeds/posts/summary/-/'+encodeURIComponent(label)+'?alt=json&max-results=150';
    state.readerChapterPromise=cacheFetch(url,300000).then(function(payload){
      var arr=(payload&&payload.feed&&payload.feed.entry||[]).map(parseEntry).filter(function(x){return x.url&&x.title&&x.labels.indexOf('Bölüm')>=0});
      arr.sort(function(a,b){var an=chapterNo(a.title),bn=chapterNo(b.title);if(an>=0&&bn>=0)return an-bn;return a.title.localeCompare(b.title,'tr',{numeric:true})});
      state.readerChapterItems=arr;return arr;
    }).catch(function(){return[]}).finally(function(){state.readerChapterPromise=null});
    return state.readerChapterPromise;
  }
  function ensureChapterSheet(){
    var sh=d.getElementById('nava-reader-chapters-v9');if(sh)return sh;
    sh=e('section');sh.id='nava-reader-chapters-v9';sh.hidden=true;
    sh.innerHTML='<div class="nava-reader-sheet-backdrop-v9"></div><div class="nava-reader-chapter-card-v9"><div class="nava-reader-chapter-head-v9"><strong>Bölümler</strong><button type="button" aria-label="Kapat">×</button></div><div class="nava-reader-chapter-search-v9"><input type="search" placeholder="Bölüm ara…" autocomplete="off"></div><div class="nava-reader-chapter-list-v9"><div class="nava-reader-chapter-empty-v9">Bölümler hazırlanıyor…</div></div></div>';
    d.body.append(sh);sh.querySelector('.nava-reader-sheet-backdrop-v9').onclick=function(){sh.hidden=true};sh.querySelector('.nava-reader-chapter-head-v9 button').onclick=function(){sh.hidden=true};
    var input=sh.querySelector('input');input.oninput=function(){renderChapterSheet(input.value)};return sh;
  }
  function renderChapterSheet(query){
    var sh=ensureChapterSheet(),list=sh.querySelector('.nava-reader-chapter-list-v9'),q=clean(query,80).toLocaleLowerCase('tr-TR'),current=safeUrl(location.href);list.replaceChildren(e('div','nava-reader-chapter-empty-v9','Bölümler hazırlanıyor…'));
    loadReaderChapters().then(function(items){
      if(sh.hidden)return;list.replaceChildren();
      var filtered=items.filter(function(x){return !q||x.title.toLocaleLowerCase('tr-TR').indexOf(q)>=0});
      if(!filtered.length){list.append(e('div','nava-reader-chapter-empty-v9','Bölüm bulunamadı.'));return;}
      filtered.forEach(function(x){
        var isCurrent=urlKey(x.url)===urlKey(current),a=e('a','nava-reader-chapter-link-v9'+(isCurrent?' is-current':''));a.href=x.url;if(x.chapterId)a.dataset.navaChapterId=normalizeChapterId(x.chapterId);var no=chapterNo(x.title);
        var tail=e('small',isCurrent?'nava-reader-current-pill-v10':'nava-reader-chapter-arrow-v10',isCurrent?'Şu an':'›');
        if(isCurrent)a.onclick=function(ev){ev.preventDefault();sh.hidden=true;};
        a.append(e('span','nava-reader-chapter-no-v9',no>=0?'#'+no:'•'),e('span','nava-reader-chapter-name-v9',shortChapterTitle(x.title)),tail);list.append(a)
      });
      decorateReaderReadRows(state.volumeReadSet,state.volumeReadIds);
      var cur=list.querySelector('.is-current');if(cur&&!q)setTimeout(function(){try{cur.scrollIntoView({block:'center'})}catch(_){}},30);
    });
  }
  function openChapterSheet(){hideOverlay('nava-app-comments-v9');hideOverlay('nava-reader-settings-v2');var sh=ensureChapterSheet();sh.hidden=false;var input=sh.querySelector('input');if(input)input.value='';renderChapterSheet('');setTimeout(function(){try{input&&input.focus()}catch(_){}},70)}

  function findCommentsNode(){var owned=d.querySelector('#nava-app-comments-v9 .nava-comments');if(owned)return owned;var panel=d.getElementById('BIzIXe82RX');return panel&&panel.querySelector('.nava-comments');}
  function ensureCommentsSheet(){
    var sh=d.getElementById('nava-app-comments-v9');if(sh)return sh;
    sh=e('section');sh.id='nava-app-comments-v9';sh.hidden=true;
    sh.innerHTML='<div class="nava-reader-sheet-backdrop-v9" data-close-comments="1"></div><div class="nava-app-comments-card-v9"><div class="nava-app-comments-head-v9"><div><strong>Yorumlar</strong><span>Bölüm hakkındaki yorumlar</span></div><button type="button" data-close-comments="1" aria-label="Kapat">×</button></div><div class="nava-app-comments-body-v9"><div class="nava-app-comments-loading-v9">Yorumlar hazırlanıyor…</div></div></div>';
    sh.querySelectorAll('[data-close-comments]').forEach(function(x){x.onclick=function(){sh.hidden=true}});d.body.append(sh);return sh;
  }
  function mountComments(){
    var sh=ensureCommentsSheet(),body=sh.querySelector('.nava-app-comments-body-v9'),comments=findCommentsNode();
    if(!comments){body.innerHTML='<div class="nava-app-comments-loading-v9">Yorumlar hazırlanıyor…</div>';return false;}
    if(comments.parentNode!==body){body.replaceChildren(comments);comments.classList.add('nava-app-comments-owned-v9')}
    state.commentsMounted=true;return true;
  }
  function openAppComments(){hideOverlay('nava-reader-chapters-v9');hideOverlay('nava-reader-settings-v2');var sh=ensureCommentsSheet();sh.hidden=false;if(!mountComments())waitForElement('#BIzIXe82RX .nava-comments',function(){mountComments()},{timeout:5000});postNative('haptic');}

  function detectAppReaderMode(reader){
    reader=reader||d.getElementById('reader');if(!reader)return false;
    var text=String(reader.innerText||reader.textContent||'').replace(/\s+/g,' ').trim();
    var images=[].slice.call(reader.querySelectorAll('img'));
    var forced=localStorage.getItem('navaAppReaderMode')||'auto';

    /* Etiket varsa heuristiğin önüne geçsin.
       LN/WN/Novel sayfasındaki 3 küçük illüstrasyon artık yanlışlıkla manga sayılmıyor. */
    var labels=[].slice.call(d.querySelectorAll('a[rel="tag"],[data-label],[data-nava-type]')).map(function(el){
      return clean((el.getAttribute&&(
        el.getAttribute('data-label')||
        el.getAttribute('data-nava-type')
      ))||el.textContent||'',120).toLocaleLowerCase('tr-TR');
    }).join(' | ');

    var explicitManga=/(?:^|[\s|,;/_-])(manga|manhwa|manhua)(?:$|[\s|,;/_-])/i.test(labels);
    var explicitNovel=/(?:light\s*novel|web\s*novel|\bln\b|\bwn\b|(?:^|[\s|,;/_-])novel(?:$|[\s|,;/_-]))/i.test(labels);

    var manga=false;
    if(forced==='manga')manga=true;
    else if(forced==='novel')manga=false;
    else if(explicitNovel)manga=false;
    else if(explicitManga)manga=true;
    else{
      /* Etiketsiz sayfalarda eski 3-resim eşiği fazla agresifti.
         Manga kabul etmek için çok daha güçlü görsel ağırlık gerekiyor. */
      var authoredSmall=images.filter(function(img){
        var w=parseFloat(img.getAttribute('width')||img.style&&img.style.width||0);
        var h=parseFloat(img.getAttribute('height')||img.style&&img.style.height||0);
        return (w>0&&w<=320)||(h>0&&h<=320);
      }).length;
      manga=(images.length>=8 && text.length<260 && authoredSmall===0);
    }

    if(forced==='auto'&&text.length>=650)manga=false;
    reader.classList.toggle('mg',manga);
    reader.classList.toggle('nv',!manga);
    reader.setAttribute('data-nava-app-reader-kind',manga?'manga':'novel');
    return manga;
  }
  function normalizeReaderImages(){
    var reader=d.getElementById('reader');if(!reader)return;
    var manga=detectAppReaderMode(reader);
    function authoredValue(img,prop){
      var inline=(img.style&&img.style[prop])?String(img.style[prop]).trim():'';
      var attr=String(img.getAttribute(prop)||'').trim();
      var raw=inline||attr;
      if(!raw||raw==='auto'||raw==='100%'||raw==='100vw')return '';
      if(/^\d+(?:\.\d+)?$/.test(raw))return raw+'px';
      if(/^\d+(?:\.\d+)?(?:px|%|em|rem|vw|vh)$/i.test(raw))return raw;
      return '';
    }
    reader.querySelectorAll('img').forEach(function(img){
      if(manga){
        img.classList.remove('nava-reader-authored-width-v103','nava-reader-authored-height-v103');
        img.style.removeProperty('--nava-reader-authored-width');img.style.removeProperty('--nava-reader-authored-height');return;
      }
      var rawWidth=authoredValue(img,'width'),rawHeight=authoredValue(img,'height');
      img.classList.toggle('nava-reader-authored-width-v103',!!rawWidth);
      img.classList.toggle('nava-reader-authored-height-v103',!!rawHeight);
      if(rawWidth)img.style.setProperty('--nava-reader-authored-width',rawWidth);else img.style.removeProperty('--nava-reader-authored-width');
      if(rawHeight)img.style.setProperty('--nava-reader-authored-height',rawHeight);else img.style.removeProperty('--nava-reader-authored-height');
    });
  }
  function syncReaderSettings(){
    var box=d.getElementById('nava-reader-settings-v2');if(!box)return;
    var mode=localStorage.getItem('navaAppReaderMode')||'auto';
    box.querySelectorAll('[data-reader-mode]').forEach(function(b){b.classList.toggle('is-active',b.dataset.readerMode===mode)});
  }
  function applyReaderTypography(){
    var reader=d.getElementById('reader');if(!reader)return;
    var font=parseInt(localStorage.getItem('navaAppReaderFont')||'18',10);font=Math.max(15,Math.min(24,font||18));
    var line=parseFloat(localStorage.getItem('navaAppReaderLine')||'1.78');line=Math.max(1.5,Math.min(2.05,line||1.78));
    reader.style.setProperty('--nava-reader-font',font+'px');reader.style.setProperty('--nava-reader-line',String(line));
    normalizeReaderImages();
    var box=d.getElementById('nava-reader-settings-v2');if(box){var v=box.querySelector('.nava-reader-font-value-v2');if(v)v.textContent=font+' px';box.querySelectorAll('[data-line]').forEach(function(b){b.classList.toggle('is-active',Number(b.dataset.line)===line)});syncReaderSettings()}
  }
  function readerPositionKey(){return 'nava-reader-position-v9:'+encodeURIComponent(location.pathname||'reader')}
  function restoreReaderPosition(){
    if(state.readerPositionRestored||location.hash)return;state.readerPositionRestored=true;
    setTimeout(function(){
      try{var raw=JSON.parse(localStorage.getItem(readerPositionKey())||'null');var y=raw&&Number(raw.y);var max=Math.max(0,d.documentElement.scrollHeight-w.innerHeight);if(y>90&&max>150)w.scrollTo(0,Math.min(y,max))}catch(_){}
    },420);
  }
  function scheduleReaderPositionSave(){
    if(state.readerSaveTimer)return;state.readerSaveTimer=w.setTimeout(function(){state.readerSaveTimer=0;try{localStorage.setItem(readerPositionKey(),JSON.stringify({y:Math.round(w.scrollY||0),t:Date.now()}))}catch(_){}},550);
  }

  function hideLegacyReaderChrome(){
    var navi=d.getElementById('navi');if(navi)navi.style.setProperty('display','none','important');
    var metaNode=d.querySelector('[data-nava-chapter-meta]');
    if(metaNode){var prev=metaNode.previousElementSibling;if(prev&&prev.classList&&prev.classList.contains('bg-accent'))prev.style.setProperty('display','none','important');}
  }
  function updateReaderAdjacent(){
    return loadReaderChapters().then(function(items){
      var current=urlKey(location.href),idx=-1;for(var i=0;i<items.length;i++){if(urlKey(items[i].url)===current){idx=i;break;}}
      state.readerPrevUrl=idx>0?items[idx-1].url:'';state.readerNextUrl=idx>=0&&idx<items.length-1?items[idx+1].url:'';
      if(state.readerPrevUrl)prewarmPage(state.readerPrevUrl);if(state.readerNextUrl)prewarmPage(state.readerNextUrl);
      var bottom=d.getElementById('nava-reader-bottom-v2');if(bottom){
        var prev=bottom.querySelector('[data-reader-nav=prev]'),next=bottom.querySelector('[data-reader-nav=next]');
        if(prev){prev.disabled=!state.readerPrevUrl;prev.classList.toggle('is-disabled',!state.readerPrevUrl)}
        if(next){next.disabled=!state.readerNextUrl;next.classList.toggle('is-disabled',!state.readerNextUrl)}
      }
      return items;
    });
  }
  function readerAdjacent(dir){
    var target=dir<0?state.readerPrevUrl:state.readerNextUrl;
    if(target){smartNavigate(target);return;}
    updateReaderAdjacent().then(function(){var u=dir<0?state.readerPrevUrl:state.readerNextUrl;if(u)smartNavigate(u)});
  }
  function readerNavAction(label,icon,dir){var b=readerAction(label,icon,function(){readerAdjacent(dir)});b.dataset.readerNav=dir<0?'prev':'next';b.classList.add('nava-reader-adjacent-v10');return b;}

  function setupReader(){
    removePage();var t=d.getElementById('nava-app-topbar');if(t)t.remove();var b=d.getElementById('nava-app-bottom');if(b)b.remove();var reader=d.getElementById('reader');if(!reader)return;
    var drawer=d.getElementById('m91YjOFga6');if(drawer)drawer.style.setProperty('display','none','important');hideLegacyReaderChrome();applyReaderTypography();restoreReaderPosition();
    var meta=chapterMeta()||{volumeTitle:'Nava',chapterTitle:topTitle()};connectVolumeReadState(meta.volumeTitle||volumeLabelFromPage());var top=d.getElementById('nava-reader-top-v2');
    if(!top){top=e('header');top.id='nava-reader-top-v2';var back=iconButton(I.back,'Geri');back.onclick=function(){history.length>1?history.back():location.assign('/')};var c=e('div','nava-reader-title-wrap-v2');c.append(e('div','nava-reader-kicker-v2',meta.volumeTitle||'Nava'),e('div','nava-reader-title-v2',meta.chapterTitle||topTitle()));var more=iconButton(I.text,'Yazı');more.onclick=toggleReaderSettings;top.append(back,c,more);var prog=e('div');prog.id='nava-reader-progress-v2';top.append(prog);d.body.append(top)}
    var bottom=d.getElementById('nava-reader-bottom-v2');if(!bottom){bottom=e('nav');bottom.id='nava-reader-bottom-v2';bottom.append(readerNavAction('Önceki',I.prev,-1),readerAction('Bölümler',I.chapters,openChapterSheet),readerAction('Okundu',I.check,function(){var x=d.querySelector('[data-nava-read-toggle]');if(x)x.click();setTimeout(syncRead,180)}),readerAction('Yorum',I.comments,openAppComments),readerNavAction('Sonraki',I.next,1));d.body.append(bottom)}
    detectAppReaderMode(reader);ensureReaderSettings();syncRead();bindReadState();updateReaderAdjacent();normalizeReaderImages();setTimeout(function(){detectAppReaderMode(reader);normalizeReaderImages();},180);if(!state.readerScrollBound){state.readerScrollBound=true;w.addEventListener('scroll',readerProgress,{passive:true});readerProgress();}
  }
  function bindReadState(){var orig=d.querySelector('[data-nava-read-toggle]');if(!orig||state.readObserver)return;state.readObserver=new MutationObserver(syncRead);state.readObserver.observe(orig,{attributes:true,attributeFilter:['class','aria-pressed']});}
  function syncRead(){
    var orig=d.querySelector('[data-nava-read-toggle]'),bottom=d.getElementById('nava-reader-bottom-v2');
    var isRead=!!(orig&&orig.classList.contains('is-read'));
    if(bottom&&bottom.children[2])bottom.children[2].classList.toggle('is-active',isRead);

    /* Tema Firestore snapshot'ı gelmeden önce buton false başlayabilir.
       FALSE artık authoritative read state'i ASLA silmez. */
    if(isRead){
      var current=urlKey(location.href),meta=chapterMeta(),id=normalizeChapterId(meta&&meta.chapterId||'');
      if(current)state.volumeReadSet.add(current);
      if(id)state.volumeReadIds.add(id);
      if(state.volumeReadUser&&state.volumeReadLabel)saveVolumeReadCache(state.volumeReadUser,state.volumeReadLabel,state.volumeReadSet,state.volumeReadIds);
      decorateAllReadRows(state.volumeReadSet,state.volumeReadIds);
    }
  }
  function readerProgress(){var max=Math.max(1,d.documentElement.scrollHeight-w.innerHeight),pct=Math.max(0,Math.min(100,w.scrollY/max*100)),p=d.getElementById('nava-reader-progress-v2');if(p)p.style.width=pct+'%';scheduleReaderPositionSave();}
  function ensureReaderSettings(){
    var box=d.getElementById('nava-reader-settings-v2');if(box)return box;box=e('section');box.id='nava-reader-settings-v2';box.hidden=true;
    box.innerHTML='<div class="nava-reader-settings-title-v2">Okuma ayarları</div><div class="nava-reader-font-row-v2"><button class="nava-reader-font-btn-v2" data-dir="-1">A−</button><div class="nava-reader-font-value-v2">18 px</div><button class="nava-reader-font-btn-v2" data-dir="1">A+</button></div><div class="nava-reader-line-row-v9"><span>Satır aralığı</span><div><button type="button" data-line="1.58">Sıkı</button><button type="button" data-line="1.78">Normal</button><button type="button" data-line="1.98">Ferah</button></div></div><div class="nava-reader-mode-row-v11"><span>Görünüm</span><div><button type="button" data-reader-mode="auto">Oto</button><button type="button" data-reader-mode="novel">Metin</button><button type="button" data-reader-mode="manga">Manga</button></div></div>';
    box.querySelectorAll('[data-dir]').forEach(function(btn){btn.onclick=function(){var dir=Number(btn.dataset.dir)||0,cur=parseInt(localStorage.getItem('navaAppReaderFont')||'18',10)||18;cur=Math.max(15,Math.min(24,cur+dir));localStorage.setItem('navaAppReaderFont',String(cur));applyReaderTypography();postNative('haptic')}});
    box.querySelectorAll('[data-line]').forEach(function(btn){btn.onclick=function(){localStorage.setItem('navaAppReaderLine',String(Number(btn.dataset.line)||1.78));applyReaderTypography();postNative('haptic')}});
    box.querySelectorAll('[data-reader-mode]').forEach(function(btn){btn.onclick=function(){localStorage.setItem('navaAppReaderMode',btn.dataset.readerMode||'auto');detectAppReaderMode(d.getElementById('reader'));normalizeReaderImages();syncReaderSettings();postNative('haptic')}});
    d.body.append(box);applyReaderTypography();syncReaderSettings();return box;
  }
  function toggleReaderSettings(){var b=ensureReaderSettings(),opening=b.hidden;if(opening){hideOverlay('nava-reader-chapters-v9');hideOverlay('nava-app-comments-v9')}b.hidden=!opening;}


  function autoDisplayName(email){
    var base=clean(String(email||'').split('@')[0],40).replace(/[._-]+/g,' ').replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ ]/g,' ').trim();
    if(base.length<2)base='Nava Kullanıcı';return base.slice(0,40);
  }
  function normalizeAuthModal(){
    d.querySelectorAll('.nava-modal').forEach(function(box){
      if(box.getAttribute('data-nava-app-auth-v9')==='1')return;var nameField=box.querySelector('[data-auth-name-field]'),nameInput=box.querySelector('[data-auth-name]'),email=box.querySelector('[data-auth-email]'),form=box.querySelector('[data-auth-form]');if(!form||!email)return;
      box.setAttribute('data-nava-app-auth-v9','1');if(nameField)nameField.style.setProperty('display','none','important');
      function syncName(){if(nameInput)nameInput.value=autoDisplayName(email.value)}email.addEventListener('input',syncName);syncName();
      form.addEventListener('submit',function(){syncName()},true);
      box.querySelectorAll('[data-auth-mode]').forEach(function(tab){tab.addEventListener('click',function(){setTimeout(function(){if(nameField)nameField.style.setProperty('display','none','important');try{email.focus()}catch(_){}},35)})});
    });
  }
  function watchAuthUi(){
    normalizeAuthModal();if(state.authUiBound)return;state.authUiBound=true;
    d.addEventListener('click',function(){setTimeout(normalizeAuthModal,0)},true);
  }
  function closeOverlays(){var s=d.getElementById('nava-app-search-v2');if(s&&!s.hidden){s.hidden=true;return true}var an=d.getElementById('nava-app-notifications-v9');if(an&&!an.hidden){an.hidden=true;return true}var ch=d.getElementById('nava-reader-chapters-v9');if(ch&&!ch.hidden){ch.hidden=true;return true}var cm=d.getElementById('nava-app-comments-v9');if(cm&&!cm.hidden){cm.hidden=true;return true}var rs=d.getElementById('nava-reader-settings-v2');if(rs&&!rs.hidden){rs.hidden=true;return true}return false;}
  w.navaAndroidOpenSearch=openSearch;w.navaAndroidOpenNotifications=openNotifications;w.navaAndroidCloseOverlays=closeOverlays;

  function bindFeedRefresh(){
    if(state.cacheRefreshBound)return;state.cacheRefreshBound=true;
    d.addEventListener('nava-app-feed-refresh',function(ev){
      var detail=ev&&ev.detail||{},url=String(detail.url||''),data=detail.data;
      try{
        if(url.indexOf('/Series?')>=0){
          state.series=(data&&data.feed&&data.feed.entry||[]).map(parseEntry).filter(function(x){return x.title&&x.url&&!/(?:^|[\s\-–—])(cilt|volume|vol\.?)[\s\-]*\d+/i.test(x.title)});
          if(state.route==='home'){var hp=d.getElementById('nava-app-page');if(hp)drawHome(hp)}
          if(state.route==='discover')drawGrid(state.lastDiscoverFilter||'Tümü');
        }else if(url.indexOf(encodeURIComponent('Bölüm'))>=0||url.indexOf('/feeds/posts/summary?')>=0){
          var raw=(data&&data.feed&&data.feed.entry||[]);
          if(url.indexOf('/feeds/posts/summary?')>=0)raw=raw.filter(function(en){return labels(en).indexOf('Bölüm')>=0});
          state.chapters=raw.map(parseEntry).filter(function(x){return x.title&&x.url});
          if(state.route==='home'){var hp2=d.getElementById('nava-app-page');if(hp2)drawHome(hp2)}
        }
      }catch(_){}
    });
  }
  function waitForElement(selector,cb,opts){
    opts=opts||{};var now=d.querySelector(selector);if(now){cb(now);return null}if(!('MutationObserver'in w))return null;
    var root=opts.root||d.documentElement,done=false,obs=new MutationObserver(function(){var n=d.querySelector(selector);if(n&&!done){done=true;obs.disconnect();cb(n)}});obs.observe(root,{childList:true,subtree:true});
    setTimeout(function(){if(!done){done=true;try{obs.disconnect()}catch(_){}}},Number(opts.timeout)||8000);return obs;
  }
  function bindRouteObserver(app){
    if(!app||state.routeObserverRoot===app)return;
    if(state.routeObserver)try{state.routeObserver.disconnect()}catch(_){}
    state.routeObserverRoot=app;var queued=false;
    state.routeObserver=new MutationObserver(function(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;if(state.route==='profile')decorateProfile();else if(state.route==='library'){decorateLibrary();applyLibraryFilter();}})});
    state.routeObserver.observe(app,{childList:true});
  }
  function setupDynamicRoute(){
    if(state.route==='profile'||state.route==='library'){
      var run=function(app){bindRouteObserver(app);if(state.route==='profile')decorateProfile();else decorateLibrary()};
      var app=d.querySelector('.nava-profile-app');if(app)run(app);else waitForElement('.nava-profile-app',run,{timeout:10000});
    }
    if(state.route==='reader'){
      waitForElement('[data-nava-read-toggle]',function(){bindReadState();syncRead()},{timeout:8000});
    }
  }
  function enhance(){
    var r=route();applyRoute(r);hideOriginalOwnedContent();watchAuthUi();
    if(r==='reader'){setupReader();setupDynamicRoute();return}
    connectAppNotifications();ensureShell();ensureSearch();scheduleMainPrewarm();
    if(r==='home')renderHome();else if(r==='discover')renderDiscover();else if(r==='volume')renderVolume();else if(r==='library'||r==='profile')setupDynamicRoute();else if(r==='series')decorateSeries();else removePage();
  }

  ready(function(){bindSmartNavigation();bindFeedRefresh();enhance()});
  w.addEventListener('pagehide',function(ev){
    /* BFCache'e giden sayfayı canlı bırak; geri dönüşte DOM yeniden kurulmasın. */
    if(ev&&ev.persisted)return;
    if(state.continueUnsub)try{state.continueUnsub()}catch(_){};if(state.authUnsub)try{state.authUnsub()}catch(_){};if(state.notificationUnsub)try{state.notificationUnsub()}catch(_){};if(state.notificationAuthUnsub)try{state.notificationAuthUnsub()}catch(_){};
    if(state.volumeReadUnsub)try{state.volumeReadUnsub()}catch(_){};if(state.volumeAuthUnsub)try{state.volumeAuthUnsub()}catch(_){};if(state.readerSaveTimer)try{w.clearTimeout(state.readerSaveTimer)}catch(_){};
    if(state.routeObserver)try{state.routeObserver.disconnect()}catch(_){};if(state.readObserver)try{state.readObserver.disconnect()}catch(_){};
  });
  w.addEventListener('pageshow',function(ev){
    if(!ev||!ev.persisted)return;
    applyRoute(route());
    if(state.route==='reader'){hideLegacyReaderChrome();applyReaderTypography();syncRead();updateReaderAdjacent();readerProgress();}
    else enhance();
  });
})(document,window);

/* Nava v12.1.26 — Firestore-safe Android push token registration.
   IMPORTANT: never reads a potentially-missing devicePushTokens doc before create. */
;(function(d,w){
  'use strict';
  if(w.__navaAndroidPushV12126)return;
  w.__navaAndroidPushV12126=true;
  if(!w.__NAVA_ANDROID_APP__)return;

  var currentUser=null,currentToken='',authBound=false,retryTimer=0,verifyTimer=0;
  var INSTALL_KEY='nava_push_install_v12122';
  var DEVICE_KEY='nava_push_device_key_v12122';

  function nativeMessage(value){
    try{if(w.NavaNative&&typeof w.NavaNative.postMessage==='function')w.NavaNative.postMessage(value)}catch(_){}
  }
  function requestNativeToken(){nativeMessage('pushTokenRequest')}
  function clearNativeToken(){nativeMessage('pushDeleteToken')}

  function randomHex(bytes){
    try{
      var a=new Uint8Array(bytes);(w.crypto||crypto).getRandomValues(a);
      return Array.prototype.map.call(a,function(x){return ('0'+x.toString(16)).slice(-2)}).join('');
    }catch(_){
      var out='';for(var i=0;i<bytes*2;i++)out+=Math.floor(Math.random()*16).toString(16);
      return out;
    }
  }
  function persistent(key,prefix,bytes){
    var value='';
    try{value=localStorage.getItem(key)||''}catch(_){}
    if(!value){
      value=prefix+randomHex(bytes);
      try{localStorage.setItem(key,value)}catch(_){}
    }
    return value;
  }
  var installBase=persistent(INSTALL_KEY,'d_',24);
  var deviceKey=persistent(DEVICE_KEY,'k_',32);

  function readyForFirestore(){
    return !!(w.db&&w.firebase&&firebase.firestore&&firebase.firestore.FieldValue);
  }
  function scheduleRegister(delay){
    if(retryTimer)clearTimeout(retryTimer);
    retryTimer=setTimeout(registerNow,delay||800);
  }
  function scheduleVerify(){
    if(verifyTimer)clearTimeout(verifyTimer);
    verifyTimer=setTimeout(function(){if(currentUser)requestNativeToken()},120000);
  }
  function accountInstallId(uid){
    var tail=String(uid||'').replace(/[^A-Za-z0-9_-]/g,'').slice(0,16);
    return (installBase+'_'+tail).slice(0,100);
  }
  function flagKey(uid){return 'nava_push_registered_v12126:'+String(uid||'')}

  function writeCreate(ref,uid,token){
    var stamp=firebase.firestore.FieldValue.serverTimestamp();
    return ref.set({
      uid:uid,
      token:token,
      platform:'android',
      appVersion:'12.1.26',
      deviceKey:deviceKey,
      createdAt:stamp,
      updatedAt:stamp
    },{merge:false});
  }
  function writeUpdate(ref,uid,token){
    var stamp=firebase.firestore.FieldValue.serverTimestamp();
    return ref.set({
      uid:uid,
      token:token,
      platform:'android',
      appVersion:'12.1.26',
      deviceKey:deviceKey,
      updatedAt:stamp
    },{merge:true});
  }

  function registerNow(){
    if(!currentUser||!currentToken)return;
    if(!readyForFirestore()){scheduleRegister(350);return}

    var uid=currentUser.uid;
    var token=currentToken;
    var ref=w.db.collection('devicePushTokens').doc(accountInstallId(uid));
    var preferUpdate=false;
    try{preferUpdate=localStorage.getItem(flagKey(uid))==='1'}catch(_){}

    var first=preferUpdate?writeUpdate(ref,uid,token):writeCreate(ref,uid,token);
    first.catch(function(){
      if(!currentUser||currentUser.uid!==uid||currentToken!==token)throw new Error('stale registration');
      return preferUpdate?writeCreate(ref,uid,token):writeUpdate(ref,uid,token);
    }).then(function(){
      if(!currentUser||currentUser.uid!==uid||currentToken!==token)return;
      try{localStorage.setItem(flagKey(uid),'1')}catch(_){}
      scheduleVerify();
    }).catch(function(error){
      try{console.error('Nava push token kaydı başarısız:',error)}catch(_){}
      scheduleRegister(5000);
    });
  }

  w.navaAndroidPushToken=function(token){
    currentToken=String(token||'').trim();
    if(currentToken)registerNow();
  };
  w.navaAndroidPushTokenError=function(){
    if(retryTimer)clearTimeout(retryTimer);
    retryTimer=setTimeout(requestNativeToken,5000);
  };
  w.navaAndroidEnsurePushToken=function(){
    if(currentUser)requestNativeToken();else bindAuth();
    return true;
  };

  function requestBurst(){
    requestNativeToken();
    setTimeout(requestNativeToken,1200);
    setTimeout(requestNativeToken,4000);
  }
  function bindAuth(){
    if(authBound)return;
    if(!w.firebase||!firebase.auth){setTimeout(bindAuth,180);return}
    authBound=true;
    firebase.auth().onAuthStateChanged(function(user){
      currentUser=user||null;
      currentToken='';
      if(user)requestBurst();else clearNativeToken();
    });
  }

  w.addEventListener('pageshow',function(){setTimeout(function(){if(currentUser)requestNativeToken()},500)});
  d.addEventListener('visibilitychange',function(){if(!d.hidden&&currentUser)setTimeout(requestNativeToken,400)});
  w.addEventListener('online',function(){if(currentUser)setTimeout(requestNativeToken,500)});
  bindAuth();
})(document,window);

