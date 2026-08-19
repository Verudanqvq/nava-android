/* Nava Blogger Live connection test — visible briefly, then self-removes. */
;(function(d){
  'use strict';
  function show(){
    if(d.getElementById('nava-live-connection-test'))return;
    var el=d.createElement('div');
    el.id='nava-live-connection-test';
    el.textContent='Nava Live ✓';
    (d.body||d.documentElement).appendChild(el);
    setTimeout(function(){try{el.remove()}catch(_){}},8000);
  }
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',show,{once:true});else show();
})(document);
