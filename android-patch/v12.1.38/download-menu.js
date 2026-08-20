/* Nava Android 12.1.38 — clearer download center + all volumes. */
;(function(d,w){
  'use strict';
  if(w.__navaDownloadMenuV12138)return;
  w.__navaDownloadMenuV12138=true;
  if(!w.__NAVA_ANDROID_APP__)return;

  var ICON={
    download:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v11"/><path d="m7.5 10 4.5 4.5 4.5-4.5"/><path d="M5 20h14"/></svg>',
    list:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></svg>',
    folder:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h7l2 2h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>',
    stack:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4"/><path d="m4 17 8 4 8-4"/></svg>',
    book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20"/></svg>'
  };
  var observer=null,prevNativeEvent=w.navaOfflineNativeEvent,busy=false;
  function clean(v,n){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n||240)}
  function el(tag,cls,text){var x=d.createElement(tag);if(cls)x.className=cls;if(text!=null)x.textContent=text;return x}
  function call(method){try{var n=w.NavaOffline;if(!n||typeof n[method]!=='function')return null;return n[method].apply(n,[].slice.call(arguments,1))}catch(_){return null}}
  function currentUrl(){try{var u=new URL(location.href);u.hash='';u.protocol='https:';u.hostname='www.verudanava.com';u.port='';return u.href}catch(_){return location.href}}
  function isReader(){return d.body&&d.body.classList.contains('nava-app-reader')}
  function isVolume(){return d.body&&d.body.classList.contains('nava-app-volume')}
  function isSeries(){return d.body&&d.body.classList.contains('nava-app-series')}
  function pageTitle(){var x=d.querySelector('.nava-reader-title-v2,header h1[itemprop="name"],main h1,h1');return clean(x?x.textContent:d.title,300)||'Nava'}
  function seriesTitle(){var x=d.querySelector('.nava-reader-kicker-v2,header h1[itemprop="name"],main h1,h1');return clean(x?x.textContent:d.title,300)||'Nava'}
  function listState(){try{return JSON.parse(call('listDownloads')||'{}')}catch(_){return{items:[],storageBytes:0,wifiOnly:true}}}
  function fmt(n){n=Number(n)||0;if(n<1024)return n+' B';if(n<1048576)return(n/1024).toFixed(1)+' KB';if(n<1073741824)return(n/1048576).toFixed(1)+' MB';return(n/1073741824).toFixed(2)+' GB'}
  function downloaded(){return call('isDownloaded',currentUrl())===true}
  function downloadedSet(){var out=Object.create(null),s=listState();(s.items||[]).forEach(function(x){if(x&&x.url)out[x.url]=1});return out}

  function panel(){
    var wrap=d.getElementById('nava-download-menu-v12138');if(wrap)return wrap;
    wrap=el('div');wrap.id='nava-download-menu-v12138';wrap.hidden=true;
    var p=el('section','nava-dl-menu-panel');
    var h=el('header','nava-dl-menu-head');
    var titles=el('div');titles.append(el('strong','','İndirme Merkezi'),el('span','nava-dl-summary',''));
    var close=el('button','nava-dl-menu-close','×');close.type='button';close.setAttribute('aria-label','Kapat');close.onclick=hide;h.append(titles,close);
    var tip=el('div','nava-dl-tip');tip.dataset.dlTip='1';
    var actions=el('div','nava-dl-menu-actions');actions.dataset.dlActions='1';
    var wifi=el('label','nava-dl-wifi');var wt=el('span','','Yalnız Wi‑Fi ile indir');var cb=d.createElement('input');cb.type='checkbox';cb.dataset.dlWifi='1';cb.onchange=function(){call('setWifiOnly',cb.checked);setStatus(cb.checked?'Yalnız Wi‑Fi açık.':'Mobil veriyle indirme açık.','ok')};wifi.append(wt,cb);
    var status=el('div','nava-dl-status');status.dataset.dlStatus='1';
    p.append(h,tip,actions,wifi,status);wrap.append(p);wrap.addEventListener('click',function(e){if(e.target===wrap)hide()});d.body.append(wrap);return wrap;
  }
  function hide(){var x=d.getElementById('nava-download-menu-v12138');if(x)x.hidden=true;d.documentElement.classList.remove('nava-download-menu-open-v12138')}
  function setStatus(text,tone){var x=panel().querySelector('[data-dl-status]');x.textContent=text||'';x.className='nava-dl-status'+(tone?' is-'+tone:'')}
  function action(icon,title,sub,state,fn){var b=el('button','nava-dl-action');b.type='button';if(busy)b.disabled=true;var i=el('span','nava-dl-action-icon');i.innerHTML=icon;var c=el('span','nava-dl-action-copy');c.append(el('strong','',title),el('span','',sub||''));var s=el('span','nava-dl-action-state',state||'');b.append(i,c,s);b.onclick=fn;return b}

  function chapterItemsFrom(root,base,title){var seen=Object.create(null),out=[];[].slice.call(root.querySelectorAll('#clwd a[href],#chapters a[href],[data-nava-chapter-list] a[href]')).forEach(function(a){try{var u=new URL(a.getAttribute('href'),base);u.hash='';var text=clean(a.textContent,220),box=clean((a.closest('li,article,div')||a).textContent,320);if(!/(bölüm|bolum|chapter)\s*\d/i.test(text+' '+box))return;if(seen[u.href])return;seen[u.href]=1;out.push({url:u.href,title:text||box||'Bölüm',seriesTitle:title,kind:'chapter'})}catch(_){}});return out}
  function chapterItems(){return chapterItemsFrom(d,location.href,seriesTitle()).slice(0,300)}
  function volumeLinks(){var seen=Object.create(null),out=[];[].slice.call(d.querySelectorAll('a[href]')).forEach(function(a){try{var text=clean(a.textContent,220),box=clean((a.closest('li,article,div')||a).textContent,320);if(!/cilt\s*\d+/i.test(text+' '+box))return;var u=new URL(a.href,location.href);u.hash='';if(!/^https?:$/.test(u.protocol)||u.hostname.indexOf('verudanava')<0)return;if(seen[u.href]||u.href===currentUrl())return;seen[u.href]=1;out.push({url:u.href,title:text||box||'Cilt'})}catch(_){}});return out.slice(0,100)}

  function downloadCurrent(){call('download',currentUrl(),pageTitle(),seriesTitle(),isReader()?'chapter':(isVolume()?'volume':'page'));setStatus(downloaded()?'Yeniden indirme başladı…':'İndirme başladı…','ok')}
  function downloadVolume(){var items=[{url:currentUrl(),title:pageTitle(),seriesTitle:seriesTitle(),kind:'volume'}].concat(chapterItems()),set=downloadedSet();items=items.filter(function(x){return !set[x.url]});if(!items.length){setStatus('Bu cilt zaten tamamen indirilmiş.','ok');return}call('downloadBatch',JSON.stringify(items));setStatus(items.length+' öğe indirme sırasına alındı.','ok')}
  function showSeriesList(){hide();var t=d.querySelector('#chapters,#clwd,[data-nava-chapter-list],.eplister,.listupd');if(!t){setTimeout(function(){show();setStatus('Cilt listesi bulunamadı.','error')},50);return}try{t.scrollIntoView({behavior:'smooth',block:'start'})}catch(_){t.scrollIntoView()}}
  function openDownloads(){hide();if(typeof w.navaOpenDownloads==='function')w.navaOpenDownloads()}

  async function fetchVolume(v){var r=await fetch(v.url,{credentials:'include',cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);var html=await r.text(),doc=new DOMParser().parseFromString(html,'text/html');return [{url:v.url,title:v.title,seriesTitle:seriesTitle(),kind:'volume'}].concat(chapterItemsFrom(doc,v.url,seriesTitle()))}
  async function downloadAllVolumes(){
    if(busy)return;var vols=volumeLinks();if(!vols.length){setStatus('Bu eserde cilt bağlantısı bulunamadı.','error');return}
    busy=true;render();var all=[],seen=downloadedSet();setStatus(vols.length+' cilt taranıyor…','ok');
    try{
      for(var i=0;i<vols.length;i++){
        setStatus('Ciltler taranıyor: '+(i+1)+' / '+vols.length,'ok');
        try{var got=await fetchVolume(vols[i]);got.forEach(function(x){if(!seen[x.url]){seen[x.url]=1;all.push(x)}})}catch(_){}
      }
      if(!all.length){setStatus('İndirilecek yeni içerik yok.','ok');return}
      call('downloadBatch',JSON.stringify(all.slice(0,700)));
      setStatus(vols.length+' ciltte '+Math.min(all.length,700)+' öğe indirme sırasına alındı.','ok');
    }finally{busy=false;render()}
  }

  function render(){var p=panel(),actions=p.querySelector('[data-dl-actions]'),idx=listState(),count=Array.isArray(idx.items)?idx.items.length:0;p.querySelector('.nava-dl-summary').textContent=count+' kayıt • '+fmt(idx.storageBytes||0);p.querySelector('[data-dl-wifi]').checked=idx.wifiOnly!==false;actions.replaceChildren();var tip=p.querySelector('[data-dl-tip]');
    if(isReader()){tip.textContent='Bu bölüm çevrimdışı okunmak üzere cihazına kaydedilir.';actions.append(action(ICON.download,downloaded()?'Bölümü yeniden indir':'Bu bölümü indir',pageTitle(),downloaded()?'İndirildi':'',downloadCurrent))}
    else if(isVolume()){var n=chapterItems().length;tip.textContent='Cildin sayfasını ve içindeki tüm bölümleri tek seferde indir.';actions.append(action(ICON.book,'Bu cildi tamamen indir',n?n+' bölüm + cilt sayfası':'Cilt ve bölümler taranacak','',downloadVolume))}
    else if(isSeries()){var v=volumeLinks().length;tip.textContent='Tüm eseri indirebilir veya tek bir cilt seçebilirsin.';actions.append(action(ICON.stack,'Tüm ciltleri indir',v?v+' cilt taranacak':'Ciltler otomatik bulunacak','',downloadAllVolumes));actions.append(action(ICON.list,'Bir cilt seç','Cilt listesine git ve istediğini aç','',showSeriesList))}
    actions.append(action(ICON.folder,'İndirilenler','İnternetsiz okuyabileceğin kayıtları aç',count?String(count):'',openDownloads))
  }
  function show(){render();var p=panel();p.hidden=false;d.documentElement.classList.add('nava-download-menu-open-v12138');setStatus('','')}
  function wireButtons(){var global=d.getElementById('nava-offline-library-btn-v12131');if(global){global.setAttribute('aria-label','İndirme Merkezi');global.setAttribute('title','İndirme Merkezi');global.onclick=show;global.dataset.navaDownloadMenu='1'}var reader=d.getElementById('nava-offline-reader-download-v12131');if(reader){reader.setAttribute('aria-label','İndirme');reader.setAttribute('title','İndirme');reader.onclick=show;reader.dataset.navaDownloadMenu='1'}var volume=d.getElementById('nava-offline-volume-btn-v12131');if(volume)try{volume.remove()}catch(_){}}
  w.navaOfflineNativeEvent=function(ev){try{if(typeof prevNativeEvent==='function')prevNativeEvent(ev)}catch(_){}ev=ev||{};var t=String(ev.type||'');if(t==='start')setStatus('İndiriliyor: '+clean(ev.title,80),'ok');else if(t==='complete')setStatus('İndirildi: '+clean(ev.title,80),'ok');else if(t==='batch-complete')setStatus('Toplu indirme tamamlandı. Başarılı: '+Number(ev.ok||0)+(Number(ev.failed||0)?' • Hata: '+Number(ev.failed||0):''),'ok');else if(t==='error')setStatus(clean(ev.message,220)||'İndirme başarısız.','error');if(!panel().hidden)render()};
  function init(){wireButtons();panel();if(!observer&&d.body){observer=new MutationObserver(wireButtons);observer.observe(d.body,{childList:true,subtree:true})}d.addEventListener('visibilitychange',function(){if(!d.hidden)setTimeout(wireButtons,60)});w.addEventListener('pageshow',function(){setTimeout(wireButtons,60);setTimeout(wireButtons,500)},{passive:true})}
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(document,window);
