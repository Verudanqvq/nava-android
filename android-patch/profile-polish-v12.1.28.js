/* Nava Android v12.1.28 — profile/search live polish. */
;(function(d,w){
  'use strict';
  if(w.__navaAndroidProfilePolishV12128)return;
  w.__navaAndroidProfilePolishV12128=true;
  if(!w.__NAVA_ANDROID_APP__)return;

  var cache=new Map(),observer=null,scheduled=0;
  function clean(v,n){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n||200)}
  function initials(v){return clean(v,80).charAt(0).toLocaleUpperCase('tr-TR')||'K'}
  function presetIcon(id){try{return (w.navaPresetAvatarIcons&&w.navaPresetAvatarIcons[id])||''}catch(_){return''}}
  function allowedGoogle(v){try{return typeof w.navaAllowedGooglePhoto==='function'?w.navaAllowedGooglePhoto(v):(/^https:\/\/lh\d+\.googleusercontent\.com\//i.test(String(v||''))?String(v):'')}catch(_){return''}}
  function allowedAdmin(v){try{return typeof w.navaAllowedAdminImage==='function'?w.navaAllowedAdminImage(v,180000):''}catch(_){return''}}
  function usernameFromRow(row){
    try{var u=new URL(row.getAttribute('href')||'',location.href);return clean(u.searchParams.get('u'),20).toLowerCase()}catch(_){return''}
  }
  function safeGet(ref){return ref.get().then(function(s){return s.exists?(s.data()||{}):{}}).catch(function(){return{}})}
  function load(username){
    if(!username||!w.db)return Promise.resolve(null);
    if(cache.has(username))return cache.get(username);
    var p=w.db.collection('usernames').doc(username).get().then(function(claim){
      if(!claim.exists)return null;
      var uid=clean((claim.data()||{}).uid,180);if(!uid)return null;
      return Promise.all([
        safeGet(w.db.collection('users').doc(uid)),
        safeGet(w.db.collection('staff').doc(uid)),
        safeGet(w.db.collection('adminProfiles').doc(uid))
      ]).then(function(parts){
        var user=parts[0]||{},staff=parts[1]||{},admin=parts[2]||{};
        return{uid:uid,username:clean(user.username||username,20),displayName:clean(user.displayName||username,80),photoURL:user.photoURL||'',avatarType:clean(user.avatarType,20),avatarId:clean(user.avatarId,40),role:clean(staff.role,30).toLowerCase(),admin:admin};
      });
    }).catch(function(){return null});
    cache.set(username,p);return p;
  }
  function avatarNode(p){
    var custom=p&&p.role==='admin'?allowedAdmin(p.admin&&p.admin.customAvatarURL):'';
    var google=p&&p.avatarType==='google'?allowedGoogle(p.photoURL):'';
    if(custom||google){var img=d.createElement('img');img.className='nava-search-user-avatar-v5';img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.src=custom||google;return img}
    var box=d.createElement('div');box.className='nava-search-user-avatar-v5 is-fallback is-preset';
    var id=p&&p.avatarType==='preset'?clean(p.avatarId,40):'';if(id)box.setAttribute('data-avatar',id);
    box.textContent=presetIcon(id)||initials(p&&p.displayName||p&&p.username||'K');return box;
  }
  function decorateRow(row,force){
    if(!row||!row.isConnected)return;var username=usernameFromRow(row);if(!username)return;
    if(!force&&row.dataset.navaProfilePolish==='12128'&&row.dataset.navaProfileUser===username)return;
    row.dataset.navaProfilePolish='pending';row.dataset.navaProfileUser=username;
    load(username).then(function(p){
      if(!p||!row.isConnected||usernameFromRow(row)!==username)return;
      var old=row.querySelector('.nava-search-user-avatar-v5');var av=avatarNode(p);if(old)old.replaceWith(av);else row.insertBefore(av,row.firstChild);
      var title=row.querySelector('.nava-search-row-title-v2');if(title&&p.displayName)title.textContent=p.displayName;
      var meta=row.querySelector('.nava-search-row-meta-v2');if(meta&&p.username)meta.textContent='@'+p.username;
      row.dataset.navaProfilePolish='12128';
    }).catch(function(){row.dataset.navaProfilePolish='error'});
  }
  function polishProfile(){
    var app=d.querySelector('.nava-profile-app');if(app)app.classList.add('nava-app-profile-live-v12128');
    d.querySelectorAll('.nava-search-user-v5').forEach(function(row){decorateRow(row,false)});
  }
  function schedule(){if(scheduled)return;scheduled=requestAnimationFrame(function(){scheduled=0;polishProfile()})}
  function refresh(detail){
    var p=detail&&detail.profile||{},u=clean(p.username,20).toLowerCase();if(u)cache.delete(u);
    d.querySelectorAll('.nava-search-user-v5').forEach(function(row){var name=usernameFromRow(row);if(!u||name===u){cache.delete(name);row.dataset.navaProfilePolish='';decorateRow(row,true)}});
    schedule();
  }
  d.addEventListener('nava:profile-customization-updated',function(ev){refresh(ev&&ev.detail)});
  d.addEventListener('click',function(){setTimeout(schedule,0)},true);
  w.addEventListener('pageshow',schedule);
  if(d.body){observer=new MutationObserver(schedule);observer.observe(d.body,{childList:true,subtree:true})}
  else d.addEventListener('DOMContentLoaded',function(){observer=new MutationObserver(schedule);observer.observe(d.body,{childList:true,subtree:true});schedule()},{once:true});
  schedule();
})(document,window);
