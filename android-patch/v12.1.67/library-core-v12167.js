/* Nava Android 12.1.67 TEST-FIRST — pure downloaded-library relation core. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.NavaLibraryCoreV12167=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function clean(v,n){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n||800)}
function norm(v){return clean(v,1000).toLocaleLowerCase('tr-TR').replace(/ı/g,'i').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ö/g,'o').replace(/ç/g,'c').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function canon(v,base){try{var u=new URL(String(v||''),base||'https://www.verudanava.com/');if(!/(^|\.)verudanava\.(?:com|blogspot\.com)$/i.test(u.hostname))return'';u.hash='';u.search='';u.protocol='https:';u.hostname='www.verudanava.com';u.port='';return u.href.replace(/\/$/,'')}catch(_){return''}}
function slug(v){try{return clean(decodeURIComponent(new URL(String(v||''),'https://www.verudanava.com/').pathname.split('/').filter(Boolean).pop()||'').replace(/\.html?$/i,'').replace(/[-_]+/g,' '),600)}catch(_){return''}}
function volNo(v){var m=clean(v,1500).match(/(?:cilt|volume|vol\.?)\s*([0-9]+(?:\.[0-9]+)?)/i);return m?m[1]:''}
function chNo(v){var m=clean(v,1500).match(/(?:bölüm|bolum|chapter|ch\.?|episode|ep\.?)\s*([0-9]+(?:\.[0-9]+)?)/i);return m?m[1]:''}
function hasContentToken(v){return/(?:^|\s)(?:cilt|volume|vol\.?|bölüm|bolum|chapter|ch\.?|episode|ep\.?)\s*\d/i.test(clean(v,1500))}
function seriesPrefix(v){v=clean(v,1000);var m=v.match(/^(.*?)(?:\s*[-–—|:]\s*)?(?:cilt|volume|vol\.?)\s*\d+(?:\.\d+)?\b/i);return m?clean(m[1],800):v}
function genericLabel(v){var n=norm(v);return !n||/^(series|project|cilt|volume|vol|bolum|chapter|ch|episode|ep|tr|en|jp|kr|cn|guncel|tamamlandi|birakildi|ara verildi|yeni|manga|manhwa|manhua|novel|light novel|web novel|ln|wn|aksiyon|fantastik|fantezi|macera|komedi|drama|romantizm|harem|shounen|seinen|shoujo|josei|isekai|okul hayati|yasamdan kesitler|dogaustu|buyu|gizem|psikolojik|trajedi|yetiskin|ecchi|nsfw)$/.test(n)}
function junk(v){var n=norm(v);return !n||/^(nava|icerik|diger|cilt|volume|vol|bolum|chapter|ch|episode|ep|tr|en|jp|kr|cn)$/.test(n)}
function entryTitle(e){return clean(e&&e.title&&e.title.$t,600)}
function entryLabels(e){return(e&&e.category||[]).map(function(x){return clean(x&&x.term,600)}).filter(Boolean)}
function entryUrl(e){var a=(e&&e.link||[]).find(function(x){return x&&x.rel==='alternate'&&x.href});return canon(a&&a.href)}
function canonicalSeriesForVolume(e){var labs=entryLabels(e),c=labs.filter(function(x){return !genericLabel(x)&&!volNo(x)});if(!c.length)return'';c.sort(function(a,b){return b.length-a.length});return c[0]}
function relationVolumeLabel(e,n){var labs=entryLabels(e),best='';labs.forEach(function(l){if(volNo(l)!==String(n))return;var z=norm(l);if(z==='cilt '+n||z==='volume '+n||z==='vol '+n)return;if(!best||l.length>best.length)best=l});return best||(volNo(entryTitle(e))===String(n)?entryTitle(e):'')}
function buildRelations(volumes,chapters){
  var rel={byUrl:{},byAlias:{},volumeLabels:{},updatedAt:Date.now()};
  (volumes||[]).forEach(function(e){
    var title=entryTitle(e),labs=entryLabels(e),n=volNo(title);
    if(!n){for(var i=0;i<labs.length&&!n;i++)n=volNo(labs[i])}
    if(!n)return;
    var series=canonicalSeriesForVolume(e);if(!series)return;
    var u=entryUrl(e),vl=relationVolumeLabel(e,n),info={series:series,volumeNo:String(n),kind:'volume'};
    if(u)rel.byUrl[u]=info;
    rel.byAlias[norm(series)]=series;
    var tp=seriesPrefix(title);if(tp&&!junk(tp))rel.byAlias[norm(tp)]=series;
    labs.forEach(function(l){var p=seriesPrefix(l);if(volNo(l)&&p&&!junk(p))rel.byAlias[norm(p)]=series});
    if(vl){rel.volumeLabels[norm(vl)]={series:series,volumeNo:String(n)};var vp=seriesPrefix(vl);if(vp&&!junk(vp))rel.byAlias[norm(vp)]=series}
  });
  (chapters||[]).forEach(function(e){
    var labs=entryLabels(e),hit=null;
    for(var i=0;i<labs.length&&!hit;i++)hit=rel.volumeLabels[norm(labs[i])]||null;
    if(!hit)return;
    var u=entryUrl(e);if(u)rel.byUrl[u]={series:hit.series,volumeNo:hit.volumeNo,kind:'chapter'};
  });
  return rel;
}
function relationFor(rel,u){var r=rel&&rel.byUrl&&rel.byUrl[u];if(typeof r==='string')return{series:r};return r||null}
function resolveItem(item,rel){
  item=item||{};rel=rel||{byUrl:{},byAlias:{}};
  var u=canon(item.url),rr=relationFor(rel,u),st=clean(item.seriesTitle,800),tt=clean(item.title,700),sl=slug(item.url),kind=String(item.kind||'').toLowerCase();
  var vn=clean(rr&&rr.volumeNo,40)||clean(item.volumeNo,40)||volNo(st+' '+tt+' '+sl);
  var cn=clean(item.chapterNo,40)||chNo(tt+' '+sl);
  var series=clean(rr&&rr.series,800),aliases=rel.byAlias||{};
  if(!series&&st){
    var direct=aliases[norm(st)];if(direct)series=direct;
    if(!series&&hasContentToken(st)){
      var p=seriesPrefix(st);if(p&&aliases[norm(p)])series=aliases[norm(p)];
    }else if(!series&&!junk(st))series=st;
  }
  if(!series){
    var tp=seriesPrefix(tt);if(tp&&aliases[norm(tp)])series=aliases[norm(tp)];
  }
  if(!series){
    var sp=seriesPrefix(sl);if(sp&&aliases[norm(sp)])series=aliases[norm(sp)];
  }
  if(!series)series='Diğer';
  var isVolume=(rr&&rr.kind==='volume')||kind==='volume';
  if(isVolume)cn='';
  if(rr&&rr.kind==='chapter')kind='chapter';
  return{item:item,url:u,series:series,volumeNo:vn,chapterNo:cn,kind:kind,isVolume:!!isVolume};
}
function dedupe(items){var by={},order=[];(items||[]).forEach(function(i){var u=canon(i&&i.url);if(!u)return;if(!by[u]){by[u]=i;order.push(u);return}var a=by[u],scoreA=(a.kind==='volume'?4:0)+clean(a.seriesTitle).length,scoreB=(i.kind==='volume'?4:0)+clean(i.seriesTitle).length;if(scoreB>scoreA)by[u]=i});return order.map(function(u){return by[u]})}
function groupDownloads(items,rel){
  var sm=new Map();
  dedupe(items).map(function(i){return resolveItem(i,rel)}).forEach(function(r){
    var sk=norm(r.series);if(!sm.has(sk))sm.set(sk,{name:r.series,items:[],volumes:new Map()});var s=sm.get(sk);s.items.push(r);
    var vk=r.volumeNo||'unknown';if(!s.volumes.has(vk))s.volumes.set(vk,{name:r.volumeNo?'Cilt '+r.volumeNo:'Diğer',no:r.volumeNo,items:[],page:null,chapters:[]});
    var v=s.volumes.get(vk);v.items.push(r);if(r.isVolume){if(!v.page)v.page=r;return}if(r.kind==='chapter'||r.chapterNo)v.chapters.push(r);
  });
  return Array.from(sm.values()).sort(function(a,b){if(a.name==='Diğer')return 1;if(b.name==='Diğer')return-1;return a.name.localeCompare(b.name,'tr')});
}
return{clean:clean,norm:norm,canon:canon,slug:slug,volNo:volNo,chNo:chNo,seriesPrefix:seriesPrefix,buildRelations:buildRelations,resolveItem:resolveItem,groupDownloads:groupDownloads};
});
