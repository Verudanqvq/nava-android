/* Nava Android 12.1.42 — simple hierarchical offline library. */
;(function(d,w){
  'use strict';
  if(w.__navaOfflineUiV12142)return;
  w.__navaOfflineUiV12142=true;
  if(!w.__NAVA_ANDROID_APP__||!w.NavaOffline)return;

  var prevNative=w.navaOfflineNativeEvent||null;
  var state={index:{items:[]},seriesOpen:Object.create(null),volumeOpen:Object.create(null),bulk:null};
  function clean(v,n){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n||500)}
  function key(v){return clean(v,500).toLocaleLowerCase('tr-TR')}
  function el(tag,cls,text){var x=d.createElement(tag);if(cls)x.className=cls;if(text!=null)x.textContent=text;return x}
  function call(method){try{var fn=w.NavaOffline&&w.NavaOffline[method];if(typeof fn!=='function')return null;return fn.apply(w.NavaOffline,[].slice.call(arguments,1))}catch(_){return null}}
  function slugText(url){try{return clean(decodeURIComponent(new URL(String(url||''),location.href).pathname.split('/').filter(Boolean).pop()||'').replace(/\.html?$/i,'').replace(/[-_]+/g,' '),400)}catch(_){return''}}
  function pretty(v){return clean(v,300).split(' ').map(function(x){return x?x.charAt(0).toLocaleUpperCase('tr-TR')+x.slice(1):''}).join(' ')}
  function junk(v){var x=key(v);return !x||['nava','bölüm','bolum','chapter','cilt','volume','içerik'].indexOf(x)>=0}
  function releaseNo(text,type){var rx=type==='volume'?/(?:cilt|volume|vol\.?)\s*([0-9]+(?:\.[0-9]+)?)/i:/(?:bölüm|bolum|chapter|ch\.?|episode|ep\.?)\s*([0-9]+(?:\.[0-9]+)?)/i,m=clean(text,900).match(rx);return m?m[1]:''}
  function stripRelease(v){return clean(v,500).replace(/\s*(?:[-–—|:]\s*)?(?:cilt|volume|vol\.?|bölüm|bolum|chapter|ch\.?|episode|ep\.?)\s*\d+(?:\.\d+)?(?:\s*[-–—|:].*)?$/i,'').trim()}
  function meta(item){
    item=item||{};var st=clean(item.seriesTitle,400),title=clean(item.title,400),slug=slugText(item.url),all=[st,title,slug].join(' '),kind=String(item.kind||'').toLowerCase(),vn=releaseNo(all,'volume'),cn=releaseNo(all,'chapter'),series='';
    if(!junk(st))series=stripRelease(st);if(!series||junk(series)){var s=stripRelease(slug);if(s&&!junk(s))series=pretty(s)}if((!series||junk(series))&&!junk(title))series=stripRelease(title);if(!series||junk(series))series='Diğer';
    var volume=vn?'Cilt '+vn:(kind==='volume'?'Cilt':'Bölümler');var display=title;if(junk(display))display=cn?'Bölüm '+cn:(kind==='volume'?(vn?'Cilt '+vn:'Cilt'):'Bölüm');
    return{series:series,volume:volume,title:display,chapterNo:cn,kind:kind}
  }
  function load(){try{var x=JSON.parse(call('listDownloads')||'{}');if(!Array.isArray(x.items))x.items=[];state.index=x;return x}catch(_){state.index={items:[]};return state.index}}
  function groups(items){var sm=new Map();items.forEach(function(item){var m=meta(item);if(!sm.has(m.series))sm.set(m.series,{name:m.series,items:[],volumes:new Map()});var s=sm.get(m.series);s.items.push(item);if(!s.volumes.has(m.volume))s.volumes.set(m.volume,{name:m.volume,items:[]});s.volumes.get(m.volume).items.push({item:item,meta:m})});return Array.from(sm.values())}
  function uniqUrls(items){var seen=Object.create(null),out=[];(items||[]).forEach(function(i){var u=clean(i&&i.url,2000);if(u&&!seen[u]){seen[u]=1;out.push(u)}});return out}

  function shell(){
    var wrap=d.getElementById('nava-offline-sheet-v12142');if(wrap)return wrap;
    wrap=el('div','nava-offline-backdrop-v12142');wrap.id='nava-offline-sheet-v12142';wrap.hidden=true;
    var p=el('section','nava-offline-panel-v12142'),head=el('header','nava-offline-head-v12142'),left=el('div'),tools=el('div','nava-offline-tools-v12142'),menu=el('button','nava-offline-more-v12142','⋯'),close=el('button','nava-offline-close-v12142','×');
    left.append(el('strong','','İndirilenler'),el('span','nava-offline-count-v12142',''));menu.type=close.type='button';menu.setAttribute('aria-label','İndirme ayarları');close.setAttribute('aria-label','Kapat');menu.onclick=toggleSettings;close.onclick=hide;tools.append(menu,close);head.append(left,tools);
    var settings=el('div','nava-offline-settings-v12142');settings.hidden=true;settings.dataset.settings='1';
    var wifi=el('button','nava-offline-setting-row-v12142');wifi.type='button';wifi.dataset.wifi='1';wifi.onclick=function(){var on=call('getWifiOnly')===true;call('setWifiOnly',!on);renderSettings()};settings.append(wifi);
    var search=el('input','nava-offline-search-v12142');search.type='search';search.placeholder='Eser veya bölüm ara';search.autocomplete='off';search.dataset.search='1';search.oninput=render;
    var status=el('div','nava-offline-status-v12142');status.dataset.status='1';var list=el('div','nava-offline-list-v12142');list.dataset.list='1';
    p.append(head,settings,search,status,list);wrap.append(p);wrap.onclick=function(e){if(e.target===wrap)hide()};d.body.append(wrap);return wrap;
  }
  function hide(){var x=d.getElementById('nava-offline-sheet-v12142');if(x)x.hidden=true}
  function toggleSettings(){var x=shell().querySelector('[data-settings]');x.hidden=!x.hidden;if(!x.hidden)renderSettings()}
  function renderSettings(){var b=shell().querySelector('[data-wifi]');var on=call('getWifiOnly')===true;b.textContent='Yalnız Wi‑Fi '+(on?'✓':'')}
  function setStatus(t,error){var x=shell().querySelector('[data-status]');x.textContent=t||'';x.className='nava-offline-status-v12142'+(error?' is-error':'')}
  function popMenu(anchor,items){
    closeMenus();var m=el('div','nava-offline-pop-v12142');items.forEach(function(it){var b=el('button',''+(it.danger?' is-danger':''),it.label);b.type='button';b.onclick=function(e){e.stopPropagation();closeMenus();it.run()};m.append(b)});anchor.parentNode.append(m);setTimeout(function(){d.addEventListener('click',closeMenus,{once:true})},0)
  }
  function closeMenus(){[].slice.call(d.querySelectorAll('.nava-offline-pop-v12142')).forEach(function(x){x.remove()})}
  function beginBulk(items,label){var urls=uniqUrls(items);if(!urls.length)return;if(typeof w.confirm==='function'&&!w.confirm(label+' silinsin mi?'))return;state.bulk={queue:urls.slice(),done:0,total:urls.length,label:label};setStatus('Siliniyor 0/'+urls.length);nextBulk()}
  function nextBulk(){var b=state.bulk;if(!b)return;if(!b.queue.length){setStatus('Silindi.');state.bulk=null;render();return}var url=b.queue.shift();call('delete',url)}
  function itemRow(entry){var item=entry.item,m=entry.meta,row=el('article','nava-offline-item-v12142'),copy=el('button','nava-offline-item-open-v12142'),more=el('button','nava-offline-item-more-v12142','⋯');copy.type='button';copy.append(el('strong','',m.title));copy.onclick=function(){call('open',item.url);hide()};more.type='button';more.setAttribute('aria-label',m.title+' seçenekleri');more.onclick=function(e){e.stopPropagation();popMenu(more,[{label:'Sil',danger:true,run:function(){beginBulk([item],m.title)}}])};row.append(copy,more);return row}
  function render(){
    var idx=load(),s=shell(),list=s.querySelector('[data-list]'),q=key(s.querySelector('[data-search]').value),items=(idx.items||[]).filter(function(i){if(!q)return true;var m=meta(i);return[m.series,m.volume,m.title].join(' ').toLocaleLowerCase('tr-TR').indexOf(q)>=0});s.querySelector('.nava-offline-count-v12142').textContent=(idx.items||[]).length+' içerik';list.replaceChildren();closeMenus();
    if(!items.length){var e=el('div','nava-offline-empty-v12142');e.append(el('strong','',idx.items&&idx.items.length?'Sonuç yok':'Henüz indirme yok'),el('span','',idx.items&&idx.items.length?'Aramayı değiştir.':'İndirdiğin eserler burada görünecek.'));list.append(e);return}
    groups(items).forEach(function(series){
      var sk=key(series.name),sec=el('section','nava-offline-series-v12142'),line=el('div','nava-offline-group-line-v12142'),head=el('button','nava-offline-group-toggle-v12142'),more=el('button','nava-offline-group-more-v12142','⋯'),body=el('div','nava-offline-series-body-v12142');head.type=more.type='button';var open=q?true:!!state.seriesOpen[sk];head.setAttribute('aria-expanded',open?'true':'false');head.append(el('span','nava-offline-chevron-v12142','›'),el('strong','',series.name),el('small','',series.items.length+' içerik'));head.onclick=function(){state.seriesOpen[sk]=!state.seriesOpen[sk];render()};more.setAttribute('aria-label',series.name+' seçenekleri');more.onclick=function(e){e.stopPropagation();popMenu(more,[{label:'Eseri sil',danger:true,run:function(){beginBulk(series.items,series.name)}}])};line.append(head,more);body.hidden=!open;
      Array.from(series.volumes.values()).forEach(function(volume){var vk=sk+'|'+key(volume.name),vsec=el('section','nava-offline-volume-v12142'),vline=el('div','nava-offline-group-line-v12142 is-volume'),vh=el('button','nava-offline-group-toggle-v12142'),vm=el('button','nava-offline-group-more-v12142','⋯'),vb=el('div','nava-offline-volume-body-v12142'),openV=q?true:!!state.volumeOpen[vk];vh.type=vm.type='button';vh.setAttribute('aria-expanded',openV?'true':'false');vh.append(el('span','nava-offline-chevron-v12142','›'),el('strong','',volume.name),el('small','',volume.items.length+' içerik'));vh.onclick=function(){state.volumeOpen[vk]=!state.volumeOpen[vk];render()};vm.setAttribute('aria-label',volume.name+' seçenekleri');vm.onclick=function(e){e.stopPropagation();popMenu(vm,[{label:'Cildi sil',danger:true,run:function(){beginBulk(volume.items.map(function(x){return x.item}),series.name+' • '+volume.name)}}])};vline.append(vh,vm);vb.hidden=!openV;volume.items.sort(function(a,b){var an=Number(a.meta.chapterNo)||0,bn=Number(b.meta.chapterNo)||0;return an&&bn?an-bn:0}).forEach(function(x){vb.append(itemRow(x))});vsec.append(vline,vb);body.append(vsec)});sec.append(line,body);list.append(sec)
    })
  }
  function show(){var s=shell();s.hidden=false;s.querySelector('[data-settings]').hidden=true;setStatus('');render();renderSettings()}

  w.navaOfflineNativeEvent=function(ev){try{if(typeof prevNative==='function')prevNative(ev)}catch(_){}ev=ev||{};var t=String(ev.type||'');if(t==='deleted'){if(state.bulk){state.bulk.done++;setStatus('Siliniyor '+state.bulk.done+'/'+state.bulk.total);nextBulk()}else render()}else if(t==='complete'||t==='batch-complete'){render()}else if(t==='error'){setStatus(clean(ev.message,180)||'İşlem başarısız.',true);if(state.bulk){state.bulk=null;render()}}};
  function init(){shell();w.navaOpenDownloads=show}
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(document,window);
