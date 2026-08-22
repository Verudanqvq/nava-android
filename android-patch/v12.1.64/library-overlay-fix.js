/* Nava Android 12.1.64 — downloaded overlay visibility + scroll fail-safe. */
;(function(d,w){
'use strict';
if(w.__navaLibraryOverlayFixV12164)return;w.__navaLibraryOverlayFixV12164=true;
function shell(){return d.getElementById('nava-offline-browser-v12163')}
function unlock(){var s=shell();if(!s||s.hidden){d.documentElement.classList.remove('nava-offline62-open');if(d.body)d.body.style.removeProperty('overflow')}}
function verifyOpen(){var s=shell();if(s&&!s.hidden){d.documentElement.classList.add('nava-offline62-open');return true}unlock();return false}
function openNow(){try{if(typeof w.navaOpenDownloads==='function')w.navaOpenDownloads()}catch(_){}setTimeout(verifyOpen,80);setTimeout(verifyOpen,240)}
d.addEventListener('click',function(e){var t=e.target&&e.target.closest?e.target.closest('[data-open-library]'):null;if(!t)return;e.preventDefault();e.stopPropagation();openNow()},true);
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',unlock,{once:true});else unlock();
w.addEventListener('pageshow',unlock,{passive:true});
})(document,window);
