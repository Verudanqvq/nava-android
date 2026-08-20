/* Nava Android 12.1.43 — stable offline library + persistent queue. */
;(function(d,w){
  'use strict';
  if(w.__navaOfflineUiV12143)return;
  w.__navaOfflineUiV12143=true;
  if(!w.__NAVA_ANDROID_APP__||!w.NavaOffline)return;

  var QUEUE_KEY='nava_download_queue_v12143';
  var state={index:{items:[],storageBytes:0},seriesOpen:Object.create(null),volumeOpen:Object.create(null),queue:[],observer:null,deletePending:0};

  function clean(v,n){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n||500)}
  function key(v){return clean(v,500).toLocaleLowerCase('tr-TR')}
  function el(tag,cls,text){var x=d.createElement(tag);if(cls)x.className=cls;if(text!=null)x.textContent=text;return x}
  function fmt(n){n=Number(n)||0;if(n<1024)return n+' B';if(n<1048576)return(n/1024).toFixed(1)+' KB';if(n<1073741824)return(n/1048576).toFixed(1)+' MB';return(n/1073741824).toFixed(2)+' GB'}
  function when(ms){var n=Number(ms)||0;if(!n)return'';try{return new Date(n).toLocaleDateString('tr-TR',{day:'numeric',month:'short'})}catch(_){return''}}
  function call(method){try{var fn=w.NavaOffline&&w.NavaOffline[method];if(typeof fn!=='function')return null;return fn.apply(w.NavaOffline,[].slice.call(arguments,1))}catch(_){return null}}
  function canon(url){try{var u=new URL(String(url||''),location.href);u.hash='';u.protocol='https:';u.hostname='www.verudanava.com';u.port='';return u.href}catch(_){return clean(url,2000)}}
  function slugText(url){try{var p=decodeURIComponent(new URL(String(url||''),location.href).pathname.split('/').filter(Boolean).pop()||'').replace(/\.html?$/i,'').replace(/[-_]+/g,' ');return clean(p,400)}catch(_){return''}}
  function pretty(v){return clean(v,300).split(' ').map(function(x){return x?x.charAt(0).toLocaleUpperCase('tr-TR')+x.slice(1):''}).join(' ')}
  function isJunk(v){var x=key(v);return !x||x==='nava'||x==='bölüm'||x==='bolum'||x==='chapter'||x==='cilt'||x==='volume'||x==='içerik'}
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
    var display=title;if(isJunk(display))display=cn?'Bölüm '+cn:(kind==='volume'?(vn?'Cilt '+vn+' sayfası':'Cilt sayfası'):'Bölüm');
    return{series:series,volume:volume,title:display,kind:kind,chapterNo:cn,volumeNo:vn};
  }
  function load(){try{var x=JSON.parse(call('listDownloads')||'{}');if(!Array.isArray(x.items))x.items=[];state.index=x;return x}catch(_){state.index={items:[],storageBytes:0};return state.index}}
  function groups(items){var sm=new Map();items.forEach(function(item){var m=meta(item),sk=m.series,vk=m.volume;if(!sm.has(sk))sm.set(sk,{name:sk,count:0,bytes:0,volumes:new Map(),items:[]});var s=sm.get(sk);s.items.push(item);if(!s.volumes.has(vk))s.volumes.set(vk,{name:vk,count:0,bytes:0,items:[]});var v=s.volumes.get(vk);v.items.push({item:item,meta:m});v.count++;v.bytes+=Number(item.bytes)||0;s.count++;s.bytes+=Number(item.bytes)||0});return Array.from(sm.values())}

  function readQueue(){try{var q=JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]');state.queue=Array.isArray(q)?q:[]}catch(_){state.queue=[]}return state.queue}
  function saveQueue(){try{localStorage.setItem(QUEUE_KEY,JSON.stringify(state.queue.slice(0,800)))}catch(_){}try{w.dispatchEvent(new CustomEvent('nava:offline-queue'))}catch(_){}}
  function queueItems(items){var existing=readQueue(),map=Object.create(null);existing.forEach(function(x){if(x&&x.url&&x.status!=='done')map[canon(x.url)]=x});(items||[]).forEach(function(x){var u=canon(x.url);if(!u||map[u])return;map[u]={url:u,title:clean(x.title,300)||'İçerik',seriesTitle:clean(x.seriesTitle,300),kind:clean(x.kind,40)||'chapter',status:'waiting',done:0,total:0}});state.queue=Object.keys(map).map(function(k){return map[k]});saveQueue();return state.queue}
  function queueSingle(item){queueItems([item]);call('download',item.url,item.title||'İçerik',item.seriesTitle||'',item.kind||'chapter')}
  function queueBatch(items){items=(items||[]).filter(function(x){return x&&x.url});if(!items.length)return false;queueItems(items);call('downloadBatch',JSON.stringify(items));return true}
  function queueForEvent(ev,status){var u=canon(ev&&ev.url),found=false;readQueue().forEach(function(x){if(canon(x.url)===u){x.status=status;found=true;if(status==='active'){x.done=Number(ev.done||x.done||0);x.total=Number(ev.total||x.total||0)}}});if(!found&&u&&status!=='done')state.queue.push({url:u,title:clean(ev.title,300)||'İçerik',status:status,done:Number(ev.done||0),total:Number(ev.total||0)});if(status==='done')state.queue=state.queue.filter(function(x){return canon(x.url)!==u});saveQueue()}
  function queueError(ev){var u=canon(ev&&ev.url);readQueue().forEach(function(x){if(canon(x.url)===u){x.status='error';x.message=clean(ev.message,220)}});saveQueue()}
  function queueData(){readQueue();return state.queue.slice()}

  function shell(){
    var wrap=d.getElementById('nava-offline-sheet-v12143');if(wrap)return wrap;
    wrap=el('div','nava-offline-backdrop-v12143');wrap.id='nava-offline-sheet-v12143';wrap.hidden=true;
    var panel=el('section','nava-offline-panel-v12143');
    var head=el('header','nava-offline-head-v12143'),titles=el('div');titles.append(el('strong','','İndirilenler'),el('span','nava-offline-storage-v12143','0 içerik'));
    var close=el('button','nava-offline-close-v12143','×');close.type='button';close.setAttribute('aria-label','Kapat');close.onclick=hide;head.append(titles,close);
    var search=el('input','nava-offline-search-v12143');search.type='search';search.placeholder='İndirilenlerde ara';search.autocomplete='off';search.dataset.offlineSearch='1';search.addEventListener('input',render);
    var status=el('div','nava-offline-status-v12143');status.dataset.offlineStatus='1';
    var list=el('div','nava-offline-list-v12143');list.dataset.offlineList='1';
    panel.append(head,search,status,list);wrap.append(panel);wrap.addEventListener('click',function(e){if(e.target===wrap)hide()});d.body.append(wrap);return wrap;
  }
  function hide(){var x=d.getElementById('nava-offline-sheet-v12143');if(x)x.hidden=true;d.documentElement.classList.remove('nava-offline-sheet-open-v12143')}
  function setStatus(text,tone){var x=shell().querySelector('[data-offline-status]');x.textContent=text||'';x.className='nava-offline-status-v12143'+(tone?' is-'+tone:'')}

  function row(entry){var item=entry.item,m=entry.meta,card=el('article','nava-offline-item-v12143'),copy=el('div','nava-offline-item-copy-v12143'),title=el('strong','',m.title),sub=el('span','',[(m.kind==='volume'?'Cilt sayfası':'Bölüm'),when(item.downloadedAt),fmt(item.bytes||0)].filter(Boolean).join(' • ')),actions=el('div','nava-offline-item-actions-v12143'),open=el('button','is-open','Oku'),del=el('button','is-delete','Sil');copy.append(title,sub);open.type=del.type='button';open.onclick=function(){call('open',item.url);hide()};del.onclick=function(){del.disabled=true;setStatus('Siliniyor…','busy');call('delete',item.url)};actions.append(open,del);card.append(copy,actions);return card}
  function deleteMany(items,label){items=(items||[]).filter(function(x){return x&&x.url});if(!items.length)return;if(!w.confirm(label+' içindeki '+items.length+' indirme silinsin mi?'))return;state.deletePending=items.length;setStatus(label+' siliniyor…','busy');items.forEach(function(x){call('delete',x.url)})}
  function groupHead(label,sub,expanded,onToggle,onDelete,deleteLabel,cls){var line=el('div','nava-offline-group-line-v12143'),head=el('button',cls),chev=el('span','nava-offline-chevron-v12143','›'),copy=el('span','nava-offline-group-copy-v12143');head.type='button';head.setAttribute('aria-expanded',expanded?'true':'false');copy.append(el('strong','',label),el('small','',sub));head.append(chev,copy);head.onclick=onToggle;var del=el('button','nava-offline-group-delete-v12143',deleteLabel);del.type='button';del.onclick=function(e){e.preventDefault();e.stopPropagation();onDelete()};line.append(head,del);return line}
  function render(){
    var idx=load(),s=shell(),list=s.querySelector('[data-offline-list]'),search=s.querySelector('[data-offline-search]'),q=clean(search.value,120).toLocaleLowerCase('tr-TR'),items=(idx.items||[]).filter(function(i){if(!q)return true;var m=meta(i);return[m.series,m.volume,m.title,clean(i.seriesTitle),clean(i.title)].join(' ').toLocaleLowerCase('tr-TR').indexOf(q)>=0});
    var storage=s.querySelector('.nava-offline-storage-v12143');if(storage)storage.textContent=(idx.items||[]).length+' içerik • '+fmt(idx.storageBytes||0);list.replaceChildren();
    if(!items.length){var empty=el('div','nava-offline-empty-v12143');empty.append(el('strong','',idx.items&&idx.items.length?'Sonuç bulunamadı':'Henüz indirme yok'),el('p','',idx.items&&idx.items.length?'Başka bir adla ara.':'Bir bölüm veya cilt indirdiğinde burada görünecek.'));list.append(empty);return}
    groups(items).forEach(function(series){
      var sk=key(series.name),sec=el('section','nava-offline-series-v12143'),body=el('div','nava-offline-series-body-v12143'),openSeries=q?true:!!state.seriesOpen[sk];body.hidden=!openSeries;
      sec.append(groupHead(series.name,series.count+' içerik • '+fmt(series.bytes),openSeries,function(){state.seriesOpen[sk]=!state.seriesOpen[sk];render()},function(){deleteMany(series.items,'“'+series.name+'”')},'Eseri sil','nava-offline-series-head-v12143'));
      Array.from(series.volumes.values()).forEach(function(volume){
        var vk=sk+'|'+key(volume.name),vsec=el('section','nava-offline-volume-v12143'),vbody=el('div','nava-offline-volume-body-v12143'),openVolume=q?true:!!state.volumeOpen[vk];vbody.hidden=!openVolume;
        var rawItems=volume.items.map(function(x){return x.item});
        vsec.append(groupHead(volume.name,volume.count+' içerik',openVolume,function(){state.volumeOpen[vk]=!state.volumeOpen[vk];render()},function(){deleteMany(rawItems,series.name+' • '+volume.name)},'Cildi sil','nava-offline-volume-head-v12143'));
        volume.items.sort(function(a,b){var an=Number(a.meta.chapterNo)||0,bn=Number(b.meta.chapterNo)||0;if(an&&bn)return an-bn;return(Number(b.item.downloadedAt)||0)-(Number(a.item.downloadedAt)||0)}).forEach(function(x){vbody.append(row(x))});vsec.append(vbody);body.append(vsec)
      });sec.append(body);list.append(sec)
    })
  }
  function show(){var s=shell();s.hidden=false;d.documentElement.classList.add('nava-offline-sheet-open-v12143');setStatus('','');render()}

  var previous=w.navaOfflineNativeEvent;
  w.navaOfflineNativeEvent=function(ev){try{if(typeof previous==='function')previous(ev)}catch(_){}ev=ev||{};var t=String(ev.type||'');
    if(t==='start')queueForEvent(ev,'active');
    else if(t==='progress')queueForEvent(ev,'active');
    else if(t==='complete'){queueForEvent(ev,'done');render()}
    else if(t==='deleted'){if(state.deletePending>0)state.deletePending--;render();if(state.deletePending===0)setStatus('Silindi.','ok')}
    else if(t==='batch-complete'){readQueue();state.queue=state.queue.filter(function(x){return x.status==='error'});saveQueue();render()}
    else if(t==='error'){queueError(ev);setStatus(clean(ev.message,240)||'İşlem başarısız.','error')}
  };

  function removeLegacy(){['nava-offline-sheet-v12131','nava-offline-sheet-v12141','nava-offline-library-btn-v12131','nava-offline-volume-btn-v12131'].forEach(function(id){var x=d.getElementById(id);if(x)try{x.remove()}catch(_){}})}
  function init(){removeLegacy();shell();readQueue();if(!state.observer&&d.body){state.observer=new MutationObserver(function(){removeLegacy()});state.observer.observe(d.body,{childList:true,subtree:true})}}
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init,{once:true});else init();

  w.navaOpenDownloads=show;
  w.navaOfflineRefresh=render;
  w.navaQueueDownloadBatch=queueBatch;
  w.navaQueueSingleDownload=queueSingle;
  w.navaGetDownloadQueue=queueData;
})(document,window);
