/* Nava 12.2.33 profile redesign: keeps the existing data model and actions. */
;(function(d,w){
 'use strict';
 if(w.__navaProfileRedesign12233)return;w.__navaProfileRedesign12233=true;
 function run(){
  var app=d.querySelector('.nava-profile-app');if(!app)return;
  d.body.classList.add('nava-profile-redesign-12233');
  var style=d.getElementById('nava-profile-redesign-style-12233');
  if(!style){
   style=d.createElement('style');style.id='nava-profile-redesign-style-12233';
   style.textContent=String.raw`
html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-app{max-width:720px!important;padding:12px!important;box-sizing:border-box!important}
html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-hero{border:1px solid rgba(255,255,255,.12)!important;border-radius:24px!important;min-height:0!important;margin:0 0 14px!important;overflow:hidden!important;box-shadow:0 14px 35px rgba(0,0,0,.18)!important}
html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-hero-inner{min-height:0!important;padding:26px 18px 18px!important;gap:10px!important}
html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-avatar-wrap{width:96px!important;height:96px!important;flex-basis:96px!important;padding:4px!important;border:2px solid rgba(255,255,255,.9)!important;box-shadow:0 8px 24px rgba(0,0,0,.22)!important}
html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-name{font-size:clamp(22px,5vw,29px)!important;font-weight:850!important;letter-spacing:-.035em!important}
html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-username{font-size:13px!important;opacity:.86!important}
html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-bio{font-size:12px!important;line-height:1.55!important;max-width:440px!important}
html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-hero .nava-profile-edit{border-radius:999px!important;min-height:42px!important;font-size:12px!important;font-weight:750!important;background:rgba(255,255,255,.16)!important;border:1px solid rgba(255,255,255,.28)!important}
html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-actions-v5{display:flex!important;gap:9px!important;margin:0 0 14px!important}
html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-action-v5{flex:1!important;min-height:44px!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;border:1px solid var(--nava-line)!important;border-radius:14px!important;background:var(--nava-surface)!important;color:var(--nava-ink)!important;font-size:12px!important;font-weight:750!important}
html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-action-v5.is-danger{color:#fb7185!important}
html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-stats{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:8px!important;margin:0 0 14px!important}
html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-stat{padding:13px 5px!important;border-radius:15px!important;background:var(--nava-surface)!important;border:1px solid var(--nava-line)!important}
html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-stat strong{font-size:18px!important;font-weight:850!important}
html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-stat span{font-size:10px!important;line-height:1.3!important}
html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-favorites{padding:16px!important;margin-bottom:14px!important;border-radius:18px!important;background:var(--nava-surface)!important;border:1px solid var(--nava-line)!important}
html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-tabs{gap:6px!important;padding:5px!important;border-radius:16px!important;background:var(--nava-surface-2)!important;border:1px solid var(--nava-line)!important;margin-bottom:12px!important;top:calc(var(--nava-top) + 4px)!important}
html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-tab{min-height:42px!important;padding:8px 13px!important;border-radius:12px!important;font-size:11px!important;font-weight:750!important;color:var(--nava-muted)!important}
html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-tab.is-active{background:var(--nava-accent)!important;color:#142033!important;box-shadow:0 3px 10px rgba(0,0,0,.12)!important}
html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-panel{padding:14px!important;border-radius:18px!important;background:var(--nava-surface)!important;border:1px solid var(--nava-line)!important}
html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-panel .nava-profile-work,html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-panel .nava-profile-comment{border-radius:14px!important;border-color:var(--nava-line)!important;background:var(--nava-surface-2)!important}
html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-panel .nava-profile-grid{gap:10px!important}
html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-library-card{border-radius:15px!important;background:var(--nava-surface-2)!important;border:1px solid var(--nava-line)!important;box-shadow:none!important}
html.nava-app-v9 body.nava-profile-redesign-12233 .nava-library-filter-v2 button{border-radius:999px!important;background:var(--nava-surface)!important;color:var(--nava-ink)!important;border-color:var(--nava-line)!important}
html.nava-app-v9 body.nava-profile-redesign-12233 .nava-library-filter-v2 button.is-active{background:var(--nava-accent)!important;color:#142033!important}
@media(max-width:390px){html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-stats{gap:5px!important}html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-stat{padding:10px 2px!important}html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-stat strong{font-size:16px!important}html.nava-app-v9 body.nava-profile-redesign-12233 .nava-profile-action-v5{font-size:11px!important}}
`;
   d.head.appendChild(style);
  }
  /* The "Eserler" tab is the user's reading-status library, not Favorites. Give it a clear name. */
  var tabs=app.querySelector('.nava-profile-tabs');
  if(tabs){
   var library=tabs.querySelector('[data-tab="library"]');
   if(library){
    var label=library.querySelector('span')||library;
    if(!library.dataset.navaLibraryLabel12233){library.dataset.navaLibraryLabel12233='1';library.setAttribute('aria-label','Okuma listem');}
    if(label===library){var text=library.textContent.trim();if(/^(Eserler|Eserlerim|Kütüphane)$/i.test(text))library.textContent='Okuma listem';}
    else if(/^(Eserler|Eserlerim|Kütüphane)$/i.test(label.textContent.trim()))label.textContent='Okuma listem';
   }
  }
  var libraryHead=d.querySelector('.nava-app-library-title-v2');if(libraryHead&&/^(Kütüphanem|Eserler|Eserlerim)$/i.test(libraryHead.textContent.trim()))libraryHead.textContent='Okuma listem';
  var librarySub=d.querySelector('.nava-app-library-sub-v2');if(librarySub&&/Okuma listeni ve ilerlemeni yönet/i.test(librarySub.textContent))librarySub.textContent='Okumayı planladığın, sürdürdüğün ve tamamladığın eserler tek yerde.';
 }
 if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',run,{once:true});else run();
 new MutationObserver(function(){run()}).observe(d.documentElement,{childList:true,subtree:true});
})(document,window);
