/* Nava profile visual redesign 12.5.0-live.1 */
;(function(d,w){
 'use strict';
 if(w.__NAVA_PROFILE_LIVE_1250__)return;
 w.__NAVA_PROFILE_LIVE_1250__=true;
 function apply(){
   var app=d.querySelector('.nava-profile-app');
   if(app){
     app.classList.add('nava-profile-redesign-live-1250');
     app.setAttribute('data-nava-profile-design','12.5.0');
   }
 }
 if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',apply,{once:true});
 else apply();
 new MutationObserver(apply).observe(d.documentElement,{childList:true,subtree:true});
})(document,window);
