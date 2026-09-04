/* Make every MarketSync camera feel like a native capture app. */
(function (global) {
  'use strict';

  function injectCss() {
    if (document.getElementById('ms-native-camera-css')) return;
    const style = document.createElement('style');
    style.id = 'ms-native-camera-css';
    style.textContent = `
      html.ms-native-cam, body.ms-native-cam {
        overflow: hidden !important;
        background: #000 !important;
      }
      .ms-native-cam-root,
      #vid-studio-modal, #video-studio-modal, [id*="vid-studio"],
      [class*="vid-studio"], .vid-camera-root {
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100dvh !important;
        max-width: none !important;
        max-height: none !important;
        margin: 0 !important;
        border-radius: 0 !important;
        z-index: 2147483000 !important;
        background: #000 !important;
        padding: 0 !important;
      }
      .ms-native-cam-root video,
      #vid-studio-modal video,
      [id*="vid-studio"] video,
      .ms-native-cam-root canvas {
        width: 100vw !important;
        height: 100dvh !important;
        object-fit: cover !important;
        border-radius: 0 !important;
        max-height: none !important;
      }
      body.ms-native-cam #dashboard-nav,
      body.ms-native-cam header,
      body.ms-native-cam #staff-chat-dock-bar,
      body.ms-native-cam #demo-mode-badge {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function goFullscreen(el) {
    if (!el) return;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitEnterFullscreen;
    try { if (req) req.call(el); } catch (e) {}
    document.documentElement.classList.add('ms-native-cam');
    document.body.classList.add('ms-native-cam');
  }

  function leaveNative() {
    document.documentElement.classList.remove('ms-native-cam');
    document.body.classList.remove('ms-native-cam');
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
  }

  function promote(el) {
    if (!el || el.dataset.msNative === '1') return;
    el.dataset.msNative = '1';
    el.classList.add('ms-native-cam-root');
    goFullscreen(el);
    const video = el.querySelector('video') || (el.tagName === 'VIDEO' ? el : null);
    if (video) {
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.style.objectFit = 'cover';
    }
  }

  function scan() {
    injectCss();
    const nodes = document.querySelectorAll([
      '#vid-studio-modal',
      '#video-studio-modal',
      '[id*="vid-studio"]',
      'video[autoplay]',
      '#svc-in-video-preview'
    ].join(','));
    nodes.forEach(function (node) {
      const root = node.closest('.fixed') || node.parentElement || node;
      if (root && (root.querySelector('video') || node.tagName === 'VIDEO')) promote(root);
    });
    if (isService()) hideTeleprompter();
  }

  function isService() {
    const lane = String(global.__videoStudioLane || '').toLowerCase();
    const role = String((global.profileContext && global.profileContext.role) || '').toUpperCase();
    const page = String(global.__currentPage || '');
    return lane.indexOf('service') >= 0 || role === 'SERVICE' || page.indexOf('service') >= 0;
  }

  function hideTeleprompter() {
    const btn = document.getElementById('vid-tp-toggle-btn');
    if (btn) btn.remove();
    const box = document.getElementById('vid-teleprompter-box');
    if (box) box.classList.add('hidden');
    document.querySelectorAll('button').forEach(function (b) {
      if (/teleprompter/i.test(b.textContent || '')) b.remove();
    });
  }

  function wrapOpeners() {
    ['openVinScanner', 'openCustomerVideoStudio', 'svcOpenVideoWalkaround', 'svcOpenTechVideoWalkaround'].forEach(function (name) {
      if (typeof global[name] !== 'function' || global[name].__msNative) return;
      const orig = global[name];
      global[name] = function () {
        const out = orig.apply(this, arguments);
        setTimeout(scan, 50);
        setTimeout(scan, 300);
        setTimeout(scan, 800);
        return out;
      };
      global[name].__msNative = true;
    });
    document.addEventListener('click', function (e) {
      const t = e.target.closest('button, [onclick]');
      if (!t) return;
      const label = (t.textContent || '') + ' ' + (t.getAttribute('onclick') || '');
      if (/vin scanner|scan vin|scan license|id scan|verify|walkaround|camera/i.test(label)) {
        setTimeout(scan, 80);
        setTimeout(scan, 400);
      }
    }, true);
    document.addEventListener('fullscreenchange', function () {
      if (!document.fullscreenElement) leaveNative();
    });
  }

  injectCss();
  wrapOpeners();
  setInterval(function () {
    wrapOpeners();
    if (document.querySelector('video[autoplay], #vid-tp-toggle-btn, #svc-in-video-preview')) scan();
  }, 600);
})(window);
