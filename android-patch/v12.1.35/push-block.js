/* Nava v12.1.35 — current Android push token registration. */
;(function(d,w){
  'use strict';
  if(w.__navaAndroidPushV12135)return;
  w.__navaAndroidPushV12135=true;
  if(!w.__NAVA_ANDROID_APP__)return;
  var currentUser=null,currentToken='',authBound=false,retryTimer=0,verifyTimer=0;
  var INSTALL_KEY='nava_push_install_v12122';
  var DEVICE_KEY='nava_push_device_key_v12122';
  function nativeMessage(value){try{if(w.NavaNative&&typeof w.NavaNative.postMessage==='function')w.NavaNative.postMessage(value)}catch(_){}}
  function requestNativeToken(){nativeMessage('pushTokenRequest')}
  function clearNativeToken(){nativeMessage('pushDeleteToken')}
  function randomHex(bytes){try{var a=new Uint8Array(bytes);(w.crypto||crypto).getRandomValues(a);return Array.prototype.map.call(a,function(x){return('0'+x.toString(16)).slice(-2)}).join('')}catch(_){var out='';for(var i=0;i<bytes*2;i++)out+=Math.floor(Math.random()*16).toString(16);return out}}
  function persistent(key,prefix,bytes){var value='';try{value=localStorage.getItem(key)||''}catch(_){}if(!value){value=prefix+randomHex(bytes);try{localStorage.setItem(key,value)}catch(_){}}return value}
  var installBase=persistent(INSTALL_KEY,'d_',24),deviceKey=persistent(DEVICE_KEY,'k_',32);
  function ready(){return!!(w.db&&w.firebase&&firebase.firestore&&firebase.firestore.FieldValue)}
  function schedule(delay){if(retryTimer)clearTimeout(retryTimer);retryTimer=setTimeout(registerNow,delay||500)}
  function accountInstallId(uid){var tail=String(uid||'').replace(/[^A-Za-z0-9_-]/g,'').slice(0,16);return(installBase+'_'+tail).slice(0,100)}
  function registerNow(){
    if(!currentUser||!currentToken)return;
    if(!ready()){schedule(350);return}
    var uid=currentUser.uid,token=currentToken,stamp=firebase.firestore.FieldValue.serverTimestamp();
    var ref=w.db.collection('devicePushTokens').doc(accountInstallId(uid));
    ref.set({uid:uid,token:token,platform:'android',appVersion:'12.1.35',deviceKey:deviceKey,notificationProtocol:'v3',updatedAt:stamp},{merge:true}).then(function(){
      try{localStorage.setItem('nava_push_registered_v12135:'+uid,'1')}catch(_){}
      if(verifyTimer)clearTimeout(verifyTimer);verifyTimer=setTimeout(function(){if(currentUser)requestNativeToken()},90000);
    }).catch(function(error){try{console.error('Nava push token kaydı başarısız:',error)}catch(_){}schedule(4000)})
  }
  w.navaAndroidPushToken=function(token){currentToken=String(token||'').trim();if(currentToken)registerNow()};
  w.navaAndroidPushTokenError=function(){schedule(4000)};
  w.navaAndroidEnsurePushToken=function(){if(currentUser)requestNativeToken();else bindAuth();return true};
  function burst(){requestNativeToken();setTimeout(requestNativeToken,900);setTimeout(requestNativeToken,2800)}
  function bindAuth(){if(authBound)return;if(!w.firebase||!firebase.auth){setTimeout(bindAuth,180);return}authBound=true;firebase.auth().onAuthStateChanged(function(user){currentUser=user||null;currentToken='';if(user)burst();else clearNativeToken()})}
  w.addEventListener('pageshow',function(){setTimeout(function(){if(currentUser)requestNativeToken()},350)});
  d.addEventListener('visibilitychange',function(){if(!d.hidden&&currentUser)setTimeout(requestNativeToken,250)});
  w.addEventListener('online',function(){if(currentUser)setTimeout(requestNativeToken,350)});
  bindAuth();
})(document,window);
