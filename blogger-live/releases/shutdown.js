/* Nava live layer shutdown shim. */
;(function(d){
  'use strict';
  function kill(){
    ['nava-loader-v2-test','nava-live-connection-test'].forEach(function(id){
      var x=d.getElementById(id); if(x) try{x.remove()}catch(_){}
    });
    d.documentElement.removeAttribute('data-nava-live-version');
  }
  kill();
  if(d.readyState==='loading') d.addEventListener('DOMContentLoaded',kill,{once:true});
  setTimeout(kill,50);
  setTimeout(kill,250);
})(document);
