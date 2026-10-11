;(function(document, window) {
  'use strict';
  if (window.__navaShellV12189 || !window.__NAVA_ANDROID_APP__) return;
  window.__navaShellV12189 = true;

  var scheduled = false;
  var warmed = Object.create(null);

  function links() {
    return Array.prototype.slice.call(document.querySelectorAll('#nava-app-bottom .nava-app-nav-item'));
  }

  function sameOriginUrl(link) {
    try {
      var url = new URL(link && link.href, location.href);
      return url.origin === location.origin && url.href !== location.href ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function warm(link) {
    var url = sameOriginUrl(link);
    if (!url || warmed[url]) return;
    warmed[url] = true;
    try {
      var hint = document.createElement('link');
      hint.rel = 'prefetch';
      hint.as = 'document';
      hint.href = url;
      hint.crossOrigin = 'use-credentials';
      (document.head || document.documentElement).appendChild(hint);
    } catch (_) {}
  }

  function updateAvatar() {
    var link = document.querySelector('#nava-app-bottom a[href*="profile"], #nava-app-bottom a[data-page="profile"]');
    var icon = link && link.querySelector('.nava-app-nav-icon');
    if (!icon) return;
    if (!icon.dataset.navaDefaultIcon) icon.dataset.navaDefaultIcon = icon.innerHTML;
    var source = '';
    try { source = String((window.auth && window.auth.currentUser && window.auth.currentUser.photoURL) || ''); } catch (_) {}
    if (!/^https:\/\//i.test(source)) {
      var avatar = document.querySelector('.nava-profile-hero img[src], .nava-profile-avatar img[src], img.nava-profile-avatar[src]');
      source = avatar ? String(avatar.src || '') : '';
    }
    if (!/^https:\/\//i.test(source) || icon.dataset.navaAvatarSource === source) return;
    var image = document.createElement('img');
    image.className = 'nava-nav-profile-image-v12189';
    image.alt = 'Profil';
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.src = source;
    image.onerror = function() { icon.innerHTML = icon.dataset.navaDefaultIcon; };
    icon.replaceChildren(image);
    icon.dataset.navaAvatarSource = source;
  }

  function updateBrand() {
    var brand = document.querySelector('#nava-app-topbar .nava-app-brand');
    if (!brand || brand.dataset.navaDragonMark === '1') return;
    brand.dataset.navaDragonMark = '1';
    brand.setAttribute('role', 'img');
    brand.setAttribute('aria-label', 'Nava');
    brand.innerHTML = '<svg class="nava-dragon-mark-v12189" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M8 12 18 16 22 7 29 14 40 10 36 21 41 27 30 29 25 41 18 32 10 35 14 25 8 12Z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="m18 22 7-4 7 3-6 4-8-3Z" fill="currentColor"/><path d="m29 29 5 1-3 4M17 17l-2-5M30 14l4-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function bind() {
    updateBrand();
    links().forEach(function(link) {
      if (link.dataset.navaBound89 === '1') return;
      link.dataset.navaBound89 = '1';
      link.addEventListener('pointerdown', function() { warm(link); }, { passive: true });
      link.addEventListener('focus', function() { warm(link); }, { passive: true });
      link.addEventListener('click', function() {
        links().forEach(function(item) { item.classList.remove('is-pending'); });
      }, { passive: true });
    });
    updateAvatar();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    (window.requestAnimationFrame || window.setTimeout)(function() { scheduled = false; bind(); }, 16);
  }

  function warmOnIdle() {
    function run() { links().forEach(function(link) { warm(link); }); }
    if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 180 });
    else window.setTimeout(run, 60);
  }

  function init() {
    bind();
    warmOnIdle();
    if (window.MutationObserver) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('nava:profile-customization-updated', schedule);
    window.addEventListener('pageshow', function() { schedule(); warmOnIdle(); }, { passive: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(document, window);
