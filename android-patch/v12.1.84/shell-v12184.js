;(function(document, window) {
  'use strict';
  if (window.__navaShellV12184 || !window.__NAVA_ANDROID_APP__) return;
  window.__navaShellV12184 = true;

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
      window.fetch(url, { credentials: 'same-origin', cache: 'force-cache' }).catch(function() {});
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
    image.className = 'nava-nav-profile-image-v12184';
    image.alt = 'Profil';
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.src = source;
    image.onerror = function() { icon.innerHTML = icon.dataset.navaDefaultIcon; };
    icon.replaceChildren(image);
    icon.dataset.navaAvatarSource = source;
  }

  function bind() {
    links().forEach(function(link) {
      if (link.dataset.navaBound84 === '1') return;
      link.dataset.navaBound84 = '1';
      link.addEventListener('pointerdown', function() { warm(link); }, { passive: true });
      link.addEventListener('focus', function() { warm(link); }, { passive: true });
      link.addEventListener('click', function() {
        links().forEach(function(item) { item.classList.remove('is-pending'); });
        link.classList.add('is-pending');
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
    var items = links();
    var index = 0;
    function next() {
      if (index >= items.length) return;
      warm(items[index++]);
      if (window.requestIdleCallback) window.requestIdleCallback(next, { timeout: 1200 });
      else window.setTimeout(next, 300);
    }
    if (window.requestIdleCallback) window.requestIdleCallback(next, { timeout: 900 });
    else window.setTimeout(next, 500);
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
