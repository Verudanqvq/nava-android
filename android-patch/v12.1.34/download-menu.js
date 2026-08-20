/* Nava Android 12.1.34 — download action sheet + loader killer. */
;(function(d,w){
  'use strict';
  if(w.__navaDownloadMenuV12134)return;
  w.__navaDownloadMenuV12134=true;
  if(!w.__NAVA_ANDROID_APP__)return;

  var ICON={
    download:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v11"/><path d="m7.5 10 4.5 4.5 4.5-4.5"/><path d="M5 20h14"/></svg>',
    list:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></svg>',
    folder:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h7l2 2h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>',
    chapters:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h14v16H5z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>'
  };
  var observer=null,prevNativeEvent=w.navaOfflineNativeEvent;

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

  function killLegacyLoader(){
    ['nava-loader-v2-test','nava-live-connection-test'].forEach(function(id){var x=d.getElementById(id);if(x)try{x.remove()}catch(_){}});
    [].slice.call(d.querySelectorAll('[data-nava-live-asset]')).forEach(function(x){try{x.remove()}catch(_){}});
  }

  function panel(){
    var wrap=d.getElementById('nava-download-menu-v12134');
    if(wrap)return wrap;
    wrap=el('div');wrap.id='nava-download-menu-v12134';wrap.hidden=true;
    var p=el('section','nava-dl-menu-panel');
    var h=el('header','nava-dl-menu-head');
    var titles=el('div');titles.append(el('strong','','İndirme'),el('span','nava-dl-summary',''));
    var close=el('button','nava-dl-menu-close','×');close.type='button';close.setAttribute('aria-label','Kapat');close.onclick=hide;
    h.append(titles,close);
    var actions=el('div','nava-dl-menu-actions');actions.dataset.dlActions='1';
    var wifi=el('label','nava-dl-wifi');var wt=el('span','','Yalnız Wi‑Fi ile indir');var cb=d.createElement('input');cb.type='checkbox';cb.dataset.dlWifi='1';cb.onchange=function(){call('setWifiOnly',cb.checked);setStatus(cb.checked?'Yalnız Wi‑Fi açık.':'Mobil veride indirme açık.','ok')};wifi.append(wt,cb);
    var status=el('div','nava-dl-status');status.dataset.dlStatus='1';
    p.append(h,actions,wifi,status);wrap.append(p);wrap.addEventListener('click',function(e){if(e.target===wrap)hide()});d.body.append(wrap);return wrap;
  }
  function hide(){var x=d.getElementById('nava-download-menu-v12134');if(x)x.hidden=true;d.documentElement.classList.remove('nava-download-menu-open-v12134')}
  function setStatus(text,tone){var x=panel().querySelector('[data-dl-status]');x.textContent=text||'';x.className='nava-dl-status'+(tone?' is-'+tone:'')}
  function action(icon,title,sub,state,fn){var b=el('button','nava-dl-action');b.type='button';var i=el('span','nava-dl-action-icon');i.innerHTML=icon;var c=el('span','nava-dl-action-copy');c.append(el('strong','',title),el('span','',sub||''));var s=el('span','nava-dl-action-state',state||'');b.append(i,c,s);b.onclick=fn;return b}

  function chapterItems(){
    var seen=Object.create(null),out=[];
    [].slice.call(d.querySelectorAll('#clwd a[href],#chapters a[href],[data-nava-chapter-list] a[href]')).forEach(function(a){
      try{
        var u=new URL(a.href,location.href);if(!/^https?:$/.test(u.protocol))return;u.hash='';
        var text=clean(a.textContent,220),box=clean((a.closest('li,article,div')||a).textContent,320);
        if(!/(bölüm|bolum|chapter)\s*\d/i.test(text+' '+box))return;
        if(seen[u.href])return;seen[u.href]=1;out.push({url:u.href,title:text||box||'Bölüm',seriesTitle:seriesTitle(),kind:'chapter'});
      }catch(_){}
    });
    return out.slice(0,300);
  }

  function downloadCurrent(){
    var yes=downloaded();
    call('download',currentUrl(),pageTitle(),seriesTitle(),isReader()?'chapter':(isVolume()?'volume':'page'));
    setStatus(yes?'Yeniden indiriliyor…':'İndirme başladı…','ok');
  }
  function downloadVolume(){
    var items=chapterItems();
    if(!items.length){setStatus('Bu ciltte bölüm bağlantısı bulunamadı.','error');return}
    call('downloadBatch',JSON.stringify(items));setStatus(items.length+' bölüm indirme sırasına alındı.','ok');
  }
  function showSeriesChapters(){
    hide();var target=d.querySelector('#chapters,#clwd,[data-nava-chapter-list]');
    if(!target){setTimeout(function(){show();setStatus('Cilt/bölüm listesi bulunamadı.','error')},50);return}
    try{target.scrollIntoView({behavior:'smooth',block:'start'})}catch(_){target.scrollIntoView()}
  }
  function openDownloads(){hide();if(typeof w.navaOpenDownloads==='function')w.navaOpenDownloads()}

  function render(){
    var p=panel(),actions=p.querySelector('[data-dl-actions]'),idx=listState(),count=Array.isArray(idx.items)?idx.items.length:0;
    p.querySelector('.nava-dl-summary').textContent=count+' indirme • '+fmt(idx.storageBytes||0);
    p.querySelector('[data-dl-wifi]').checked=idx.wifiOnly!==false;
    actions.replaceChildren();
    if(isReader()){
      actions.append(action(ICON.download,downloaded()?'Bölümü yeniden indir':'Bu bölümü indir',pageTitle(),downloaded()?'İndirildi':'',downloadCurrent));
    }else if(isVolume()){
      var n=chapterItems().length;
      actions.append(action(ICON.chapters,'Bu cildi indir',n?n+' bölüm bulundu':'Bölümler taranacak','',downloadVolume));
    }else if(isSeries()){
      actions.append(action(ICON.chapters,'Ciltleri seçip indir','Önce istediğin cildi aç, sonra toplu indir','',showSeriesChapters));
    }
    actions.append(action(ICON.folder,'İndirilenler','Kaydedilmiş bölümleri internetsiz aç',count?String(count):'',openDownloads));
  }
  function show(){killLegacyLoader();render();var p=panel();p.hidden=false;d.documentElement.classList.add('nava-download-menu-open-v12134');setStatus('','')}

  function wireButtons(){
    killLegacyLoader();
    var global=d.getElementById('nava-offline-library-btn-v12131');
    if(global){global.setAttribute('aria-label','İndirme');global.setAttribute('title','İndirme');global.onclick=show;global.dataset.navaDownloadMenu='1'}
    var reader=d.getElementById('nava-offline-reader-download-v12131');
    if(reader){reader.setAttribute('aria-label','İndirme');reader.setAttribute('title','İndirme');reader.onclick=show;reader.dataset.navaDownloadMenu='1'}
    var volume=d.getElementById('nava-offline-volume-btn-v12131');if(volume)try{volume.remove()}catch(_){}
  }

  w.navaOfflineNativeEvent=function(ev){
    try{if(typeof prevNativeEvent==='function')prevNativeEvent(ev)}catch(_){}
    ev=ev||{};var t=String(ev.type||'');
    if(t==='complete')setStatus('İndirme tamamlandı.','ok');
    else if(t==='batch-complete')setStatus('Cilt indirmesi tamamlandı.','ok');
    else if(t==='error')setStatus(clean(ev.message,220)||'İndirme başarısız.','error');
    if(!panel().hidden)render();
  };

  function init(){
    killLegacyLoader();wireButtons();panel();
    if(!observer&&d.body){observer=new MutationObserver(function(){killLegacyLoader();wireButtons()});observer.observe(d.body,{childList:true,subtree:true})}
    d.addEventListener('visibilitychange',function(){if(!d.hidden)setTimeout(wireButtons,60)});
    w.addEventListener('pageshow',function(){setTimeout(wireButtons,60);setTimeout(wireButtons,500)},{passive:true});
  }
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(document,window);
