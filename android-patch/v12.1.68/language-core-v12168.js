/* Nava Android 12.1.68 TEST-FIRST — explicit-label aware current-chapter language core. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.NavaLanguageCoreV12168=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
var LANGS=['TR','EN','JP','KR','CN'];
function clean(v,n){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n||800)}
function norm(v){return clean(v,1000).toLocaleLowerCase('tr-TR').replace(/ı/g,'i').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ö/g,'o').replace(/ç/g,'c').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function canon(v,base){try{var u=new URL(String(v||''),base||'https://www.verudanava.com/');u.hash='';u.search='';u.protocol='https:';u.hostname='www.verudanava.com';u.port='';return u.href.replace(/\/$/,'')}catch(_){return''}}
function volNo(v){var m=clean(v,1500).match(/(?:cilt|volume|vol\.?)\s*([0-9]+(?:\.[0-9]+)?)/i);return m?m[1]:''}
function chNo(v){var m=clean(v,1500).match(/(?:bölüm|bolum|chapter|ch\.?|episode|ep\.?)\s*([0-9]+(?:\.[0-9]+)?)/i);return m?m[1]:''}
function entryTitle(e){return clean(e&&e.title&&e.title.$t,700)}
function entryLabels(e){return(e&&e.category||[]).map(function(x){return clean(x&&x.term,700)}).filter(Boolean)}
function entryUrl(e){var a=(e&&e.link||[]).find(function(x){return x&&x.rel==='alternate'&&x.href});return canon(a&&a.href)}
function explicitLang(labels){for(var i=0;i<(labels||[]).length;i++){var x=clean(labels[i],10).toUpperCase();if(LANGS.indexOf(x)>=0)return x}return''}
function genericVolumeLabel(v){var n=norm(v),k=volNo(v);return !!k&&(n==='cilt '+k||n==='volume '+k||n==='vol '+k)}
function volumeLabel(labels){var matches=(labels||[]).filter(function(x){return volNo(x)&&!genericVolumeLabel(x)});matches.sort(function(a,b){return b.length-a.length});return matches[0]||''}
function chapterNumber(e){var title=entryTitle(e),labels=entryLabels(e),n=chNo(title);if(!n){for(var i=0;i<labels.length&&!n;i++)n=chNo(labels[i])}if(!n)n=chNo(entryUrl(e).replace(/[-_/]+/g,' '));return n}
function buildIndex(entries){var byUrl={},groups={};(entries||[]).forEach(function(e){var url=entryUrl(e);if(!url)return;var labels=entryLabels(e),n=chapterNumber(e);if(!n)return;var vl=volumeLabel(labels),explicit=explicitLang(labels),lang=explicit||'TR';var rec={url:url,title:entryTitle(e),labels:labels,chapterNo:String(n),volumeLabel:vl,volumeKey:norm(vl),lang:lang,explicitLang:explicit};byUrl[url]=rec;var key=(rec.volumeKey||'novol')+'|'+rec.chapterNo;if(!groups[key])groups[key]=[];groups[key].push(rec)});return{byUrl:byUrl,groups:groups}}
function variantsForUrl(index,currentUrl){index=index||{byUrl:{},groups:{}};var u=canon(currentUrl),cur=index.byUrl&&index.byUrl[u];if(!cur)return{current:null,languages:[],targets:{},show:false};var key=(cur.volumeKey||'novol')+'|'+cur.chapterNo,rows=(index.groups&&index.groups[key])||[cur],targets={},seen={};rows.forEach(function(r){if(LANGS.indexOf(r.lang)<0||seen[r.lang])return;seen[r.lang]=1;targets[r.lang]=r.url});var languages=LANGS.filter(function(l){return !!seen[l]});return{current:cur,languages:languages,targets:targets,show:languages.length>1||!!cur.explicitLang}}
return{LANGS:LANGS,clean:clean,norm:norm,canon:canon,volNo:volNo,chNo:chNo,explicitLang:explicitLang,buildIndex:buildIndex,variantsForUrl:variantsForUrl};
});
