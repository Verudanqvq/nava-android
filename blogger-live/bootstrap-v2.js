/* Nava Blogger Live Loader v2 — stable one-time bootstrap. */
;(function(d,w){
  'use strict';
  if(w.__NAVA_BLOGGER_LIVE_LOADER_V2__)return;
  w.__NAVA_BLOGGER_LIVE_LOADER_V2__=true;

  var RAW_MANIFEST='https://raw.githubusercontent.com/Verudanqvq/nava-android/main/blogger-live/manifest.json';
  var CDN_BASE='https://cdn.jsdelivr.net/gh/Verudanqvq/nava-android@main/blogger-live/';
  var SAFE_ASSET=/^[A-Za-z0-9._\/-]+\.(?:css|js)$/;

  function showBootstrapTest(){
    function show(){
      if(d.getElementById('nava-loader-v2-test'))return;
      var el=d.createElement('div');
      el.id='nava-loader-v2-test';
      el.textContent='Nava Loader v2 ✓';
      el.style.cssText='position:fixed;z-index:2147483647;top:12px;right:12px;padding:9px 12px;border-radius:8px;background:#111827;color:#fff;font:700 12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.25);pointer-events:none';
      (d.body||d.documentElement).appendChild(el);
      setTimeout(function(){try{el.remove()}catch(_){}},20000);
    }
    if(d.body)show(); else d.addEventListener('DOMContentLoaded',show,{once:true});
  }

  function assetUrl(path,version){
    return CDN_BASE+path+'?v='+encodeURIComponent(String(version||'live'));
  }

  function mount(manifest){
    if(!manifest||manifest.enabled!==true)return;
    var version=String(manifest.version||'live');
    d.documentElement.setAttribute('data-nava-live-version',version);

    if(typeof manifest.css==='string'&&SAFE_ASSET.test(manifest.css)&&/\.css$/.test(manifest.css)){
      var link=d.createElement('link');
      link.rel='stylesheet';
      link.href=assetUrl(manifest.css,version);
      link.setAttribute('data-nava-live-asset','css');
      (d.head||d.documentElement).appendChild(link);
    }

    if(typeof manifest.js==='string'&&SAFE_ASSET.test(manifest.js)&&/\.js$/.test(manifest.js)){
      var script=d.createElement('script');
      script.src=assetUrl(manifest.js,version);
      script.defer=true;
      script.setAttribute('data-nava-live-asset','js');
      (d.head||d.documentElement).appendChild(script);
    }
  }

  showBootstrapTest();
  try{
    fetch(RAW_MANIFEST+'?ts='+Date.now(),{cache:'no-store',mode:'cors',credentials:'omit'})
      .then(function(r){if(!r.ok)throw new Error('manifest '+r.status);return r.json()})
      .then(mount)
      .catch(function(){});
  }catch(_){}
})(document,window);
