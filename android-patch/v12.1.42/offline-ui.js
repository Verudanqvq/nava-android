/* Nava Android 12.1.42 — hierarchical offline library + bulk delete. */
;(function(d,w){
  'use strict';
  if(w.__navaOfflineUiV12142)return;
  w.__navaOfflineUiV12142=true;
  if(!w.__NAVA_ANDROID_APP__||!w.NavaOffline)return;

  var ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v11"/><path d="m7.5 10 4.5 4.5 4.5-4.5"/><path d="M5 20h14"/></svg>';
  var state={index:{items:[],storageBytes:0},seriesOpen:Object.create(null),volumeOpen:Object.create(null),observer:null,bulk:null};

  function clean(v,n){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n||500)}
  function el(tag,cls,text){var x=d.createElement(tag);if(cls)x.className=cls;if(text!=null)x.textContent=text;return x}
  function fmt(n){n=Number(n)||0;if(n<1024)return n+' B';if(n<1048576)return(n/1024).toFixed(1)+' KB';if(n<1073741824)return(n/1048576).toFixed(1)+' MB';return(n/1073741824).toFixed(2)+' GB'}
  function when(ms){var n=Number(ms)||0;if(!n)return'';try{return new Date(n).toLocaleDateString('tr-TR',{day:'numeric',month:'short'})}catch(_){return''}}
  function call(method){try{var fn=w.NavaOffline&&w.NavaOffline[method];if(typeof fn!=='function')return null;return fn.apply(w.NavaOffline,[].slice.call(arguments,1))}catch(_){return null}}
  function slugText(url){try{var p=decodeURIComponent(new URL(String(url||''),location.href).pathname.split('/').filter(Boolean).pop()||'').replace(/\.html?$/i,'').replace(/[-_]+/g,' ');return clean(p,400)}catch(_){return''}}
  function pretty(v){return clean(v,300).split(' ').map(function(x){return x?x.charAt(0).toLocaleUpperCase('tr-TR')+x.slice(1):''}).join(' ')}
  function isJunk(v){var x=clean(v,300).toLocaleLowerCase('tr-TR');return !x||x==='nava'||x==='bölüm'||x==='bolum'||x==='chapter'||x==='cilt'||x==='volume'||x==='içerik'}
  function releaseNo(text,type){var rx=type==='volume'?/(?:cilt|volume|vol\.?)\s*([0-9]+(?:\.[0-9]+)?)/i:/(?:bölüm|bolum|chapter|ch\.?|episode|ep\.?)\s*([0-9]+(?:\.[0-9]+)?)/i;var m=clean(text,900).match(rx);return m?m[1]:''}
  function stripRelease(v){return clean(v,500).replace(/\s*(?:[-–—|:]\s*)?(?:cilt|volume|vol\.?|bölüm|bolum|chapter|ch\.?|episode|ep\.?)\s*\d+(?:\.\d+)?(?:\s*[-–—|:].*)?$/i,'').trim()}
  function meta(item){
    item=item||{};var st=clean(item.seriesTitle,400),title=clean(item.title,400),slug=slugText(item.url),all=[st,title,slug].join(' '),kind=String(item.kind||'').toLowerCase();
    var vn=releaseNo(all,'volume'),cn=releaseNo(all,'chapter'),series='';
    if(!isJunk(st))series=stripRelease(st);
    if(!series||isJunk(series)){var fromSlug=stripRelease(slug);if(fromSlug&&!isJunk(fromSlug))series=pretty(fromSlug)}
    if((!series||isJunk(series))&&!isJunk(title))series=stripRelease(title);
    if(!series||isJunk(series))series='Diğer indirilenler';
    var volume=vn?'Cilt '+vn:(kind==='volume'?'Cilt':'Bölümler');
    var display=title;
    if(isJunk(display))display=cn?'Bölüm '+cn:(kind==='volume'?(vn?'Cilt '+vn+' sayfası':'Cilt sayfası'):'Bölüm');
    if(kind==='volume'&&/^cilt\s*\d+$/i.test(display)&&vn)display='Cilt '+vn+' sayfası';
    return{series:series,volume:volume,title:display,kind:kind,chapterNo:cn,volumeNo:vn};
  }
  function load(){try{var x=JSON.parse(call('listDownloads')||'{}');if(!Array.isArray(x.items))x.items=[];state.index=x;return x}catch(_){state.index={items:[],storageBytes:0};return state.index}}
  function groups(items){
    var sm=new Map();items.forEach(function(item){var m=meta(item),sk=m.series,vk=m.volume;if(!sm.has(sk))sm.set(sk,{name:sk,count:0,bytes:0,items:[],volumes:new Map()});var s=sm.get(sk);s.items.push(item);if(!s.volumes.has(vk))s.volumes.set(vk,{name:vk,count:0,bytes:0,raw:[],items:[]});var v=s.volumes.get(vk);v.raw.push(item);v.items.push({item:item,meta:m});v.count++;v.bytes+=Number(item.bytes)||0;s.count++;s.bytes+=Number(item.bytes)||0});return Array.from(sm.values())
  }
  function key(v){return clean(v,500).toLocaleLowerCase('tr-TR')}

  function shell(){
    var wrap=d.getElementById('nava-offline-sheet-v12142');if(wrap)return wrap;
    wrap=el('div','nava-offline-backdrop-v12142');wrap.id='nava-offline-sheet-v12142';wrap.hidden=true;
    var panel=el('section','nava-offline-panel-v12142');
    var head=el('header','nava-offline-head-v12142'),titles=el('div');titles.append(el('strong','','İndirilenler'),el('span','nava-offline-storage-v12142','0 içerik'));
    var close=el('button','nava-offline-close-v12142','×');close.type='button';close.setAttribute('aria-label','Kapat');close.onclick=hide;head.append(titles,close);
    var search=el('input','nava-offline-search-v12142');search.type='search';search.placeholder='İndirilenlerde ara';search.autocomplete='off';search.dataset.offlineSearch='1';search.addEventListener('input',render);
    var status=el('div','nava-offline-status-v12142');status.dataset.offlineStatus='1';
    var list=el('div','nava-offline-list-v12142');list.dataset.offlineList='1';
    panel.append(head,search,status,list);wrap.append(panel);wrap.addEventListener('click',function(e){if(e.target===wrap)hide()});d.body.append(wrap);return wrap;
  }
  function hide(){var x=d.getElementById('nava-offline-sheet-v12142');if(x)x.hidden=true;d.documentElement.classList.remove('nava-offline-sheet-open-v12142')}
  function setStatus(text,tone){var x=shell().querySelector('[data-offline-status]');x.textContent=text||'';x.className='nava-offline-status-v12142'+(tone?' is-'+tone:'')}
  function row(entry){var item=entry.item,m=entry.meta,card=el('article','nava-offline-item-v12142'),copy=el('div','nava-offline-item-copy-v12142'),title=el('strong','',m.title),sub=el('span','',[(m.kind==='volume'?'Cilt sayfası':'Bölüm'),when(item.downloadedAt),fmt(item.bytes||0)].filter(Boolean).join(' • ')),actions=el('div','nava-offline-item-actions-v12142'),open=el('button','is-open','Oku'),del=el('button','is-delete','Sil');copy.append(title,sub);open.type=del.type='button';open.onclick=function(){call('open',item.url);hide()};del.onclick=function(){del.disabled=true;call('delete',item.url);setStatus('Siliniyor…','busy')};actions.append(open,del);card.append(copy,actions);return card}

  function queueBulkDelete(items,label){
    var urls=[],seen=Object.create(null);(items||[]).forEach(function(i){var u=clean(i&&i.url,2000);if(u&&!seen[u]){seen[u]=1;urls.push(u)}});
    if(!urls.length)return;
    if(typeof w.confirm==='function'&&!w.confirm(label+' ve içindeki '+urls.length+' indirme silinsin mi?'))return;
    state.bulk={label:label,total:urls.length,done:0,failed:0};
    setStatus(label+' siliniyor • 0/'+urls.length,'busy');
    urls.forEach(function(u){call('delete',u)});
  }
  function bulkEvent(ok){
    if(!state.bulk)return false;
    state.bulk.done++;if(!ok)state.bulk.failed++;
    if(state.bulk.done<state.bulk.total){setStatus(state.bulk.label+' siliniyor • '+state.bulk.done+'/'+state.bulk.total,'busy');return true}
    var b=state.bulk;state.bulk=null;
    setStatus(b.failed?b.label+' silindi, '+b.failed+' öğe silinemedi.':b.label+' tamamen silindi.',b.failed?'error':'success');
    render();return true;
  }

  function render(){
    var idx=load(),s=shell(),list=s.querySelector('[data-offline-list]'),search=s.querySelector('[data-offline-search]'),q=clean(search.value,120).toLocaleLowerCase('tr-TR'),items=(idx.items||[]).filter(function(i){if(!q)return true;var m=meta(i);return[m.series,m.volume,m.title,clean(i.seriesTitle),clean(i.title)].join(' ').toLocaleLowerCase('tr-TR').indexOf(q)>=0});
    var storage=s.querySelector('.nava-offline-storage-v12142');if(storage)storage.textContent=(idx.items||[]).length+' içerik • '+fmt(idx.storageBytes||0);list.replaceChildren();
    if(!items.length){var empty=el('div','nava-offline-empty-v12142');empty.append(el('strong','',idx.items&&idx.items.length?'Sonuç bulunamadı':'Henüz indirme yok'),el('p','',idx.items&&idx.items.length?'Başka bir adla aramayı dene.':'Bir cilt veya bölüm indirdiğinde burada görünecek.'));list.append(empty);return}
    groups(items).forEach(function(series){
      var sk=key(series.name),sec=el('section','nava-offline-series-v12142'),line=el('div','nava-offline-series-line-v12142'),head=el('button','nava-offline-series-head-v12142'),chev=el('span','nava-offline-chevron-v12142','›'),copy=el('span','nava-offline-group-copy-v12142'),removeSeries=el('button','nava-offline-group-delete-v12142','Eseri sil'),body=el('div','nava-offline-series-body-v12142');
      head.type='button';removeSeries.type='button';copy.append(el('strong','',series.name),el('small','',series.count+' içerik • '+fmt(series.bytes)));head.append(chev,copy);line.append(head,removeSeries);
      var openSeries=q?true:!!state.seriesOpen[sk];head.setAttribute('aria-expanded',openSeries?'true':'false');body.hidden=!openSeries;head.onclick=function(){state.seriesOpen[sk]=!state.seriesOpen[sk];render()};removeSeries.onclick=function(e){e.preventDefault();e.stopPropagation();queueBulkDelete(series.items,series.name)};
      Array.from(series.volumes.values()).forEach(function(volume){
        var vk=sk+'|'+key(volume.name),vsec=el('section','nava-offline-volume-v12142'),vline=el('div','nava-offline-volume-line-v12142'),vh=el('button','nava-offline-volume-head-v12142'),vc=el('span','nava-offline-group-copy-v12142'),vbody=el('div','nava-offline-volume-body-v12142'),vchev=el('span','nava-offline-chevron-v12142','›'),removeVolume=el('button','nava-offline-group-delete-v12142 is-volume','Cildi sil');
        vh.type='button';removeVolume.type='button';vc.append(el('strong','',volume.name),el('small','',volume.count+' içerik'));vh.append(vchev,vc);vline.append(vh,removeVolume);
        var openVolume=q?true:!!state.volumeOpen[vk];vh.setAttribute('aria-expanded',openVolume?'true':'false');vbody.hidden=!openVolume;vh.onclick=function(){state.volumeOpen[vk]=!state.volumeOpen[vk];render()};removeVolume.onclick=function(e){e.preventDefault();e.stopPropagation();queueBulkDelete(volume.raw,series.name+' • '+volume.name)};
        volume.items.sort(function(a,b){var an=Number(a.meta.chapterNo)||0,bn=Number(b.meta.chapterNo)||0;if(an&&bn)return an-bn;return(Number(b.item.downloadedAt)||0)-(Number(a.item.downloadedAt)||0)}).forEach(function(x){vbody.append(row(x))});vsec.append(vline,vbody);body.append(vsec)
      });sec.append(line,body);list.append(sec)
    })
  }
  function show(){var s=shell();s.hidden=false;d.documentElement.classList.add('nava-offline-sheet-open-v12142');setStatus('','');render()}

  function iconButton(id,label){var b=el('button','nava-app-icon-btn nava-offline-icon-v12142');b.id=id;b.type='button';b.setAttribute('aria-label',label);b.innerHTML=ICON;return b}
  function isReader(){return !!(d.body&&d.body.classList.contains('nava-app-reader'))}
  function ensureButtons(){
    var top=d.getElementById('nava-app-topbar');if(top&&!d.getElementById('nava-offline-library-btn-v12131')){var lib=iconButton('nava-offline-library-btn-v12131','İndirilenler');lib.onclick=show;top.append(lib)}
    if(isReader()){var rt=d.getElementById('nava-reader-top-v2');if(rt&&!d.getElementById('nava-offline-reader-download-v12131')){var rb=iconButton('nava-offline-reader-download-v12131','İndirme');var more=rt.querySelector('button[aria-label="Yazı"]');rt.insertBefore(rb,more||rt.lastElementChild)}}
  }

  w.navaOfflineNativeEvent=function(ev){ev=ev||{};var t=String(ev.type||'');if(t==='deleted'){if(!bulkEvent(true)){setStatus('','');render()}}else if(t==='complete'||t==='batch-complete'){render()}else if(t==='error'){if(!bulkEvent(false))setStatus(clean(ev.message,240)||'İşlem başarısız.','error')}};
  function init(){shell();ensureButtons();if(!state.observer&&d.body){state.observer=new MutationObserver(ensureButtons);state.observer.observe(d.body,{childList:true,subtree:true})}w.addEventListener('pageshow',function(){setTimeout(ensureButtons,80);setTimeout(ensureButtons,500)},{passive:true})}
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init,{once:true});else init();
  w.navaOpenDownloads=show;
})(document,window);
