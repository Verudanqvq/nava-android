;(function(d,w){
'use strict';
if(w.__navaShellV12191||!w.__NAVA_ANDROID_APP__)return;w.__navaShellV12191=true;
function clean(v,n){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n||400)}
function norm(v){return clean(v).toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function slug(url){try{return decodeURIComponent(new URL(String(url||''),w.location.href).pathname.split('/').filter(Boolean).pop()||'').replace(/\.html?$/i,'').replace(/[-_]+/g,' ')}catch(_){return''}}
function number(text,kind){var rx=kind==='volume'?/(?:cilt|volume|vol\.?|v)\s*[-:#]?\s*(\d+(?:\.\d+)?)/i:/(?:bölüm|bolum|chapter|ch\.?|episode|ep\.?)\s*[-:#]?\s*(\d+(?:\.\d+)?)/i,m=clean(text,900).match(rx);return m?m[1]:''}
function strip(text){return clean(text,400).replace(/\s*(?:[-–—|:]\s*)?(?:cilt|volume|vol\.?|bölüm|bolum|chapter|ch\.?|episode|ep\.?)\s*\d+(?:\.\d+)?(?:\s*[-–—|:].*)?$/i,'').trim()}
function meta(item){
 item=item||{};var url=clean(item.url,2000),title=clean(item.title),seriesTitle=clean(item.seriesTitle),vol=clean(item.volume),chap=clean(item.chapter);
 var sl=slug(url),joined=[seriesTitle,title,sl].join(' '),vn=vol||number(joined,'volume'),cn=chap||number(joined,'chapter');
 var series=seriesTitle||strip(sl)||strip(title);if(!series||/^(cilt|bölüm|chapter|volume)$/i.test(series))series='Diğer indirilenler';
 series=strip(series)||series;
 if(!vn&&String(item.kind||'').toLowerCase()==='volume')vn=number(title+' '+sl,'volume');
 return{series:series,volume:vn?'Cilt '+vn:(String(item.kind||'').toLowerCase()==='volume'?'Cilt':'Bölümler'),chapter:cn?'Bölüm '+cn:(title||sl||'İndirilen içerik'),url:url,raw:item};
}
function items(){try{var x=JSON.parse(w.NavaOffline.listDownloads()||'{}');return Array.isArray(x.items)?x.items:[]}catch(_){return[]}}
function offlinePage(){return /offline|download|indirilen/i.test((w.location.hash||'')+' '+(d.body&&d.body.innerText||'').slice(0,180))}
function groupList(){
 if(!w.NavaOffline||!offlinePage())return;
 var data=items(),unique=Object.create(null),series=Object.create(null),roots=[];
 data.forEach(function(raw){var m=meta(raw),key=m.url||norm(m.series+'|'+m.volume+'|'+m.chapter);if(unique[key]){var old=unique[key];if((!old.raw.seriesTitle&&raw.seriesTitle)||(!old.raw.volume&&raw.volume)||(!old.raw.chapter&&raw.chapter))unique[key]=m;return}unique[key]=m;});
 Object.keys(unique).forEach(function(k){var m=unique[k],sk=norm(m.series),vk=norm(m.volume);if(!series[sk]){series[sk]={name:m.series,volumes:Object.create(null)};roots.push(series[sk])}var s=series[sk];if(!s.volumes[vk])s.volumes[vk]={name:m.volume,chapters:[]};s.volumes[vk].chapters.push(m)});
 roots.forEach(function(s){Object.keys(s.volumes).forEach(function(v){s.volumes[v].chapters.sort(function(a,b){return (parseFloat(number(a.chapter,'chapter'))||0)-(parseFloat(number(b.chapter,'chapter'))||0)})})});
 var existing=d.querySelector('[data-nava-offline-hierarchy-v12191]');if(existing)existing.remove();
 var host=d.querySelector('#nava-app-page')||d.querySelector('main')||d.body;if(!host||!data.length)return;
 var panel=d.createElement('section');panel.setAttribute('data-nava-offline-hierarchy-v12191','1');panel.className='nava-offline-hierarchy-v12191';
 var heading=d.createElement('h2');heading.textContent='İndirilenler';panel.appendChild(heading);
 roots.sort(function(a,b){return a.name.localeCompare(b.name,'tr')});
 roots.forEach(function(s){var sd=d.createElement('details');sd.className='nava-offline-series-v12191';sd.open=true;var sh=d.createElement('summary');sh.textContent=s.name;sd.appendChild(sh);
 Object.keys(s.volumes).sort(function(a,b){return a.localeCompare(b,'tr',{numeric:true})}).forEach(function(vk){var v=s.volumes[vk],vd=d.createElement('details');vd.className='nava-offline-volume-v12191';var vh=d.createElement('summary');vh.textContent=v.name;vd.appendChild(vh);v.chapters.forEach(function(ch){var row=d.createElement('button');row.type='button';row.className='nava-offline-chapter-v12191';row.textContent=ch.chapter;row.addEventListener('click',function(){try{w.NavaOffline.open(ch.url)}catch(e){try{w.NavaOffline.read(ch.url)}catch(_){}}});vd.appendChild(row)});sd.appendChild(vd)});panel.appendChild(sd)});
 var target=d.querySelector('[data-nava-offline-list],#nava-offline-list,.nava-offline-list,.nava-download-list')||host;target.insertBefore(panel,target.firstChild);
}
function css(){if(d.getElementById('nava-offline-hierarchy-style-v12191'))return;var st=d.createElement('style');st.id='nava-offline-hierarchy-style-v12191';st.textContent='.nava-offline-hierarchy-v12191{padding:12px;color:var(--nava-ink,#243449)}.nava-offline-hierarchy-v12191 h2{font-size:20px;margin:8px 0 14px}.nava-offline-series-v12191,.nava-offline-volume-v12191{display:block;margin:8px 0;padding:10px 12px;border:1px solid #dce6f0;border-radius:14px;background:#fff}.nava-offline-series-v12191>summary,.nava-offline-volume-v12191>summary{font-weight:750;cursor:pointer;padding:4px 0}.nava-offline-volume-v12191{margin:8px 0 0 8px;background:#f5f8fc}.nava-offline-chapter-v12191{display:block;width:100%;padding:11px 10px;margin-top:6px;text-align:left;border:1px solid #e2eaf3;border-radius:10px;background:#fff;color:#243449}';d.head.appendChild(st)}
function init(){css();groupList();if(w.MutationObserver)new MutationObserver(function(){if(offlinePage()&&!d.querySelector('[data-nava-offline-hierarchy-v12191]'))groupList()}).observe(d.body,{childList:true,subtree:true});w.addEventListener('hashchange',groupList)}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(document,window);
