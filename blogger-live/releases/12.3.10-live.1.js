/* Nava 12.3.10-live.1 — production live cleanup. */
;(function(d,w){
  'use strict';
  function clean(){
    ['nava-loader-v2-test','nava-live-connection-test'].forEach(function(id){var x=d.getElementById(id);if(x)try{x.remove()}catch(_){}});
  }
  clean();
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',clean,{once:true});
  setTimeout(clean,120);
  setTimeout(clean,1200);
})(document,window);
