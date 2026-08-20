/* Nava Android v12.1.31 — native offline downloads UI. */
;(function(d,w){
  'use strict';
  if(w.__navaOfflineUiV12131)return;
  w.__navaOfflineUiV12131=true;
  if(!w.__NAVA_ANDROID_APP__||!w.NavaOffline)return;

  var ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v11"/><path d="m7.5 10 4.5 4.5 4.5-4.5"/><path d="M5 20h14"/></svg>';
  var TRASH='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>';
  var REFRESH='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M20 6v5h-5"/><path d="M19 11a7 7 0 1 0 1 5"/></svg>';
  var state={index:{items:[],storageBytes:0,wifiOnly:true},busy:Object.create(null),observer:null};

  function clean(v,n){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n||300)}
  function el(tag,cls,text){var x=d.createElement(tag);if(cls)x.className=cls;if(text!=null)x.textContent=text;return x}
  function fmt(n){n=Number(n)||0;if(n<1024)return n+' B';if(n<1048576)return(n/1024).toFixed(1)+' KB';if(n<1073741824)return(n/1048576).toFixed(1)+' MB';return(n/1073741824).toFixed(2)+' GB'}
  function native(method){try{return w.NavaOffline&&w.NavaOffline[method]}catch(_){return null}}
  function call(method){try{var fn=native(method);if(typeof fn!=='function')return null;return fn.apply(w.NavaOffline,[].slice.call(arguments,1))}catch(e){toast('Offline işlemi başlatılamadı.','error');return null}}
  function navaUrl(value){try{var u=new URL(String(value||''),location.href),h=(u.hostname||'').toLowerCase();if(h!=='verudanava.com'&&h!=='www.verudanava.com'&&h!=='verudanava.blogspot.com')return'';u.protocol='https:';u.hostname='www.verudanava.com';u.port='';u.hash='';return u.href}catch(_){return''}}
  function isReader(){return!!(d.querySelector('#reader')||d.querySelector('[data-nava-chapter-meta]'))}
  function volumeTitle(){var tags=[].slice.call(d.querySelectorAll('a[rel="tag"]')).map(function(a){return clean(a.textContent,220)}).filter(function(t){return /(?:cilt|volume|vol\.?)\s*\d/i.test(t)});if(tags[0])return tags[0];var h=d.querySelector('header h1[itemprop="name"],main h1,h1');var t=clean(h?h.textContent:d.title,250);var m=t.match(/^(.+?\b(?:cilt|volume|vol\.?)\s*\d+(?:\.\d+)?)/i);return m?clean(m[1],250):''}
  function isVolume(){return!!volumeTitle()&&!isReader()}
  function currentTitle(){var x=d.querySelector('.nava-reader-title-v2,header h1[itemprop="name"],main h1,h1');return clean(x?x.textContent:d.title,300)||'Nava'}
  function currentSeries(){var x=d.querySelector('.nava-reader-kicker-v2');return clean(x&&x.textContent,300)||volumeTitle()||'Nava'}
  function currentDownloaded(){var u=navaUrl(location.href);return u&&call('isDownloaded',u)===true}

  function toast(message,tone){var x=el('div','nava-offline-toast-v12131 '+(tone||''),message);d.body.appendChild(x);requestAnimationFrame(function(){x.classList.add('is-show')});setTimeout(function(){x.classList.remove('is-show');setTimeout(function(){x.remove()},220)},2600)}
  function loadIndex(){try{var raw=call('listDownloads');var x=JSON.parse(raw||'{}');if(!Array.isArray(x.items))x.items=[];state.index=x;return x}catch(_){state.index={items:[],storageBytes:0,wifiOnly:true};return state.index}}

  function sheet(){
    var wrap=d.getElementById('nava-offline-sheet-v12131');if(wrap)return wrap;
    wrap=el('div','nava-offline-backdrop-v12131');wrap.id='nava-offline-sheet-v12131';wrap.hidden=true;
    var panel=el('section','nava-offline-panel-v12131');var head=el('header','nava-offline-head-v12131');var titles=el('div');titles.append(el('strong','','İndirilenler'),el('span','nava-offline-storage-v12131','0 MB'));
    var close=el('button','nava-offline-close-v12131','×');close.type='button';close.setAttribute('aria-label','Kapat');close.onclick=hideDownloads;head.append(titles,close);
    var prefs=el('label','nava-offline-pref-v12131');var check=d.createElement('input');check.type='checkbox';check.dataset.offlineWifi='1';check.onchange=function(){call('setWifiOnly',check.checked);state.index.wifiOnly=check.checked;toast(check.checked?'Yalnız Wi‑Fi açık.':'Mobil veride indirme açık.','success')};prefs.append(check,el('span','','Yalnız Wi‑Fi ile indir'));
    var status=el('div','nava-offline-status-v12131');status.dataset.offlineStatus='1';var list=el('div','nava-offline-list-v12131');list.dataset.offlineList='1';
    panel.append(head,prefs,status,list);wrap.append(panel);wrap.addEventListener('click',function(ev){if(ev.target===wrap)hideDownloads()});d.body.append(wrap);return wrap;
  }
  function showDownloads(){var s=sheet();s.hidden=false;d.documentElement.classList.add('nava-offline-sheet-open-v12131');renderList()}
  function hideDownloads(){var s=d.getElementById('nava-offline-sheet-v12131');if(s)s.hidden=true;d.documentElement.classList.remove('nava-offline-sheet-open-v12131')}
  function setStatus(text,tone){var x=sheet().querySelector('[data-offline-status]');x.textContent=text||'';x.className='nava-offline-status-v12131 '+(tone||'')}

  function renderList(){
    var idx=loadIndex(),s=sheet(),list=s.querySelector('[data-offline-list]'),wifi=s.querySelector('[data-offline-wifi]');if(wifi)wifi.checked=idx.wifiOnly!==false;
    var storage=s.querySelector('.nava-offline-storage-v12131');if(storage)storage.textContent=fmt(idx.storageBytes||0);list.replaceChildren();
    var items=idx.items||[];if(!items.length){var empty=el('div','nava-offline-empty-v12131');empty.append(el('strong','','Henüz indirme yok'),el('p','','Bir bölümde indirme simgesine, ciltte ise “Cildi indir” düğmesine dokun.'));list.append(empty);return}
    var groups=Object.create(null);items.forEach(function(item){var k=clean(item.seriesTitle,240)||'Nava';(groups[k]||(groups[k]=[])).push(item)});
    Object.keys(groups).forEach(function(group){var sec=el('section','nava-offline-group-v12131');sec.append(el('h3','',group));groups[group].forEach(function(item){var card=el('article','nava-offline-card-v12131');var copy=el('div','nava-offline-copy-v12131');copy.append(el('strong','',clean(item.title,300)||'Bölüm'),el('span','',fmt(item.bytes||0)+' • '+new Date(Number(item.downloadedAt)||Date.now()).toLocaleDateString('tr-TR')));var actions=el('div','nava-offline-actions-v12131');var open=el('button','is-open','Aç');open.type='button';open.onclick=function(){call('open',item.url);hideDownloads()};var refresh=el('button','is-icon','');refresh.type='button';refresh.innerHTML=REFRESH;refresh.setAttribute('aria-label','Yeniden indir');refresh.onclick=function(){call('download',item.url,item.title,item.seriesTitle,item.kind||'chapter');setStatus('Güncelleniyor: '+clean(item.title,80),'busy')};var del=el('button','is-icon is-danger','');del.type='button';del.innerHTML=TRASH;del.setAttribute('aria-label','Sil');del.onclick=function(){call('delete',item.url);setStatus('Siliniyor…','busy')};actions.append(open,refresh,del);card.append(copy,actions);sec.append(card)});list.append(sec)});
  }

  function downloadCurrent(){var u=navaUrl(location.href);if(!u)return;call('download',u,currentTitle(),currentSeries(),isReader()?'chapter':(isVolume()?'volume':'page'));state.busy[u]=1;syncButtons();toast('İndirme başladı.','success')}
  function collectVolume(){var seen=Object.create(null),out=[],series=volumeTitle()||currentTitle();[].slice.call(d.querySelectorAll('#cilt a[href],main a[href],article a[href],[data-nava-chapter-list] a[href]')).forEach(function(a){var u=navaUrl(a.href);if(!u||seen[u])return;var text=clean(a.textContent,240);var box=clean((a.closest('article,li,div,figure')||a).textContent,500);if(!/(?:bölüm|bolum|chapter)\s*\d/i.test(text+' '+box)&&!/\bchapter\b/i.test(u))return;seen[u]=1;out.push({url:u,title:text||box||'Bölüm',seriesTitle:series,kind:'chapter'})});return out.slice(0,300)}
  function downloadVolume(){var items=collectVolume();if(!items.length){toast('Bu ciltte indirilecek bölüm bağlantısı bulunamadı.','error');return}call('downloadBatch',JSON.stringify(items));setStatus(items.length+' bölüm indirme sırasına alındı.','busy');toast(items.length+' bölüm indiriliyor.','success')}

  function iconButton(id,label,handler){var b=el('button','nava-app-icon-btn nava-offline-icon-v12131');b.id=id;b.type='button';b.setAttribute('aria-label',label);b.innerHTML=ICON;b.onclick=handler;return b}
  function syncButtons(){
    if(isReader()){
      var top=d.getElementById('nava-reader-top-v2');if(top&&!d.getElementById('nava-offline-reader-download-v12131')){var b=iconButton('nava-offline-reader-download-v12131','Bölümü indir',downloadCurrent);var more=top.querySelector('button[aria-label="Yazı"]');top.insertBefore(b,more||top.lastElementChild)}
      var rb=d.getElementById('nava-offline-reader-download-v12131');if(rb){var yes=currentDownloaded();rb.classList.toggle('is-downloaded',yes);rb.setAttribute('aria-label',yes?'Bölümü yeniden indir':'Bölümü indir')}return;
    }
    var topbar=d.getElementById('nava-app-topbar');if(!topbar)return;if(!d.getElementById('nava-offline-library-btn-v12131'))topbar.append(iconButton('nava-offline-library-btn-v12131','İndirilenler',showDownloads));var old=d.getElementById('nava-offline-volume-btn-v12131');if(isVolume()){if(!old){old=iconButton('nava-offline-volume-btn-v12131','Cildi indir',downloadVolume);topbar.append(old)}}else if(old)old.remove();
  }

  w.navaOfflineNativeEvent=function(ev){ev=ev||{};var t=String(ev.type||'');if(t==='start'){state.busy[ev.url]=1;setStatus('İndiriliyor: '+clean(ev.title,90),'busy')}else if(t==='progress'){setStatus('İndiriliyor: '+clean(ev.title,70)+' • '+Number(ev.done||0)+'/'+Number(ev.total||0),'busy')}else if(t==='complete'){delete state.busy[ev.url];setStatus('İndirildi: '+clean(ev.title,90),'success');renderList();syncButtons()}else if(t==='deleted'){setStatus('İndirme silindi.','success');renderList();syncButtons()}else if(t==='batch-start'){setStatus(Number(ev.total||0)+' bölüm indiriliyor…','busy')}else if(t==='batch-complete'){setStatus('Toplu indirme tamamlandı: '+Number(ev.ok||0)+' başarılı'+(Number(ev.failed||0)?', '+Number(ev.failed)+' hata':''),Number(ev.failed||0)?'warn':'success');renderList();syncButtons()}else if(t==='error'){if(ev.url)delete state.busy[ev.url];setStatus(clean(ev.message,240)||'İndirme başarısız.','error');toast(clean(ev.message,220)||'İndirme başarısız.','error');syncButtons()}else if(t==='settings'){renderList()}};

  function init(){sheet();loadIndex();syncButtons();if(!state.observer&&d.body){state.observer=new MutationObserver(function(){syncButtons()});state.observer.observe(d.body,{subtree:true,childList:true})}w.addEventListener('pageshow',function(){setTimeout(syncButtons,80);setTimeout(syncButtons,600)},{passive:true});d.addEventListener('visibilitychange',function(){if(!d.hidden)setTimeout(syncButtons,80)})}
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init,{once:true});else init();
  w.navaOpenDownloads=showDownloads;
})(document,window);
