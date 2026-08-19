/* Nava v12.1.24 — reliable FREE push token bridge.
   The Android WebView always verifies the current FCM token against Firestore.
   A stale localStorage flag can never suppress registration again. */
;(function(d,w){
  'use strict';
  if(w.__navaAndroidPushV12124)return;
  w.__navaAndroidPushV12124=true;
  if(!w.__NAVA_ANDROID_APP__)return;

  var currentUser=null,currentToken='',authBound=false,retryTimer=0,verifyTimer=0;
  var INSTALL_KEY='nava_push_install_v12122';
  var DEVICE_KEY='nava_push_device_key_v12122';

  function nativeMessage(value){
    try{if(w.NavaNative&&typeof w.NavaNative.postMessage==='function')w.NavaNative.postMessage(value)}catch(_){}
  }
  function requestNativeToken(){nativeMessage('pushTokenRequest')}
  function clearNativeToken(){nativeMessage('pushDeleteToken')}

  function randomHex(bytes){
    try{
      var a=new Uint8Array(bytes);(w.crypto||crypto).getRandomValues(a);
      return Array.prototype.map.call(a,function(x){return ('0'+x.toString(16)).slice(-2)}).join('');
    }catch(_){
      var out='';for(var i=0;i<bytes*2;i++)out+=Math.floor(Math.random()*16).toString(16);
      return out;
    }
  }
  function persistent(key,prefix,bytes){
    var value='';
    try{value=localStorage.getItem(key)||''}catch(_){}
    if(!value){
      value=prefix+randomHex(bytes);
      try{localStorage.setItem(key,value)}catch(_){}
    }
    return value;
  }
  var installId=persistent(INSTALL_KEY,'d_',24);
  var deviceKey=persistent(DEVICE_KEY,'k_',32);

  function readyForFirestore(){
    return !!(w.db&&w.firebase&&firebase.firestore&&firebase.firestore.FieldValue);
  }
  function scheduleRegister(delay){
    if(retryTimer)clearTimeout(retryTimer);
    retryTimer=setTimeout(registerNow,delay||800);
  }
  function scheduleVerify(){
    if(verifyTimer)clearTimeout(verifyTimer);
    verifyTimer=setTimeout(function(){
      if(currentUser)requestNativeToken();
    },120000);
  }

  function registerNow(){
    if(!currentUser||!currentToken)return;
    if(!readyForFirestore()){
      scheduleRegister(350);
      return;
    }

    var user=currentUser;
    var uid=user.uid;
    var token=currentToken;
    var ref=w.db.collection('devicePushTokens').doc(installId);

    ref.get().then(function(snapshot){
      if(!currentUser||currentUser.uid!==uid||currentToken!==token)return null;
      var existing=snapshot.exists?(snapshot.data()||{}):{};

      if(snapshot.exists &&
         existing.uid===uid &&
         existing.token===token &&
         existing.platform==='android' &&
         existing.appVersion==='12.1.24' &&
         existing.deviceKey===deviceKey){
        return 'already-ok';
      }

      var stamp=firebase.firestore.FieldValue.serverTimestamp();
      return ref.set({
        uid:uid,
        token:token,
        platform:'android',
        appVersion:'12.1.24',
        deviceKey:deviceKey,
        createdAt:existing.createdAt||stamp,
        updatedAt:stamp
      },{merge:false}).then(function(){return 'written'});
    }).then(function(result){
      if(result==='already-ok'||result==='written')scheduleVerify();
    }).catch(function(error){
      try{console.error('Nava push token kaydı başarısız:',error)}catch(_){}
      scheduleRegister(5000);
    });
  }

  w.navaAndroidPushToken=function(token){
    currentToken=String(token||'').trim();
    if(currentToken)registerNow();
  };
  w.navaAndroidPushTokenError=function(){
    if(retryTimer)clearTimeout(retryTimer);
    retryTimer=setTimeout(requestNativeToken,5000);
  };

  w.navaAndroidEnsurePushToken=function(){
    if(currentUser)requestNativeToken();
    else bindAuth();
    return true;
  };

  function requestBurst(){
    requestNativeToken();
    setTimeout(requestNativeToken,1200);
    setTimeout(requestNativeToken,4000);
  }

  function bindAuth(){
    if(authBound)return;
    if(!w.firebase||!firebase.auth){setTimeout(bindAuth,180);return}
    authBound=true;
    firebase.auth().onAuthStateChanged(function(user){
      currentUser=user||null;
      currentToken='';
      if(user)requestBurst();
      else clearNativeToken();
    });
  }

  w.addEventListener('pageshow',function(){setTimeout(function(){if(currentUser)requestNativeToken()},500)});
  d.addEventListener('visibilitychange',function(){
    if(!d.hidden&&currentUser)setTimeout(requestNativeToken,400);
  });
  w.addEventListener('online',function(){if(currentUser)setTimeout(requestNativeToken,500)});

  bindAuth();
})(document,window);