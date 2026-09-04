/* Teleprompter is Sales + Marketing only. Service and techs record without a script. */
(function (global) {
  'use strict';

  function isServiceLane() {
    const lane = String(global.__videoStudioLane || '').toLowerCase();
    if (lane.indexOf('service') >= 0 || lane.indexOf('tech') >= 0) return true;
    const dept = String(global.__vidActiveDept || global.__currentDept || '').toLowerCase();
    if (dept.indexOf('service') >= 0) return true;
    const role = String((global.profileContext && global.profileContext.role) || (global.__user && global.__user.role) || '').toUpperCase();
    if (role === 'SERVICE' || role === 'TECH' || role === 'TECHNICIAN') return true;
    const page = String(global.__currentPage || '');
    if (page.indexOf('service') >= 0) return true;
    return false;
  }

  function hidePrompter() {
    if (!isServiceLane()) return;
    const box = document.getElementById('vid-teleprompter-box');
    if (box) box.classList.add('hidden');
    const btn = document.getElementById('vid-tp-toggle-btn');
    if (btn) btn.classList.add('hidden');
    document.querySelectorAll('button, label, div').forEach(function (el) {
      const t = (el.textContent || '').trim();
      if (/teleprompter/i.test(t) && el.closest('#vid-studio-root, #video-studio, .vid-studio, [id*="vid-"]')) {
        if (el.id === 'vid-teleprompter-text') return;
        el.classList.add('hidden');
      }
    });
  }

  function wrap() {
    if (typeof global.vidTeleprompterHiddenByDefault === 'function' && !global.vidTeleprompterHiddenByDefault.__msSvc) {
      const orig = global.vidTeleprompterHiddenByDefault;
      global.vidTeleprompterHiddenByDefault = function () {
        if (isServiceLane()) return true;
        return orig.apply(this, arguments);
      };
      global.vidTeleprompterHiddenByDefault.__msSvc = true;
    }
    if (typeof global.vidToggleTeleprompter === 'function' && !global.vidToggleTeleprompter.__msSvc) {
      const orig = global.vidToggleTeleprompter;
      global.vidToggleTeleprompter = function () {
        if (isServiceLane()) {
          const box = document.getElementById('vid-teleprompter-box');
          if (box) box.classList.add('hidden');
          return;
        }
        return orig.apply(this, arguments);
      };
      global.vidToggleTeleprompter.__msSvc = true;
    }
    if (typeof global.openCustomerVideoStudio === 'function' && !global.openCustomerVideoStudio.__msSvcTp) {
      const orig = global.openCustomerVideoStudio;
      global.openCustomerVideoStudio = function (contactId, options) {
        const opts = options || {};
        const dept = String(opts.department || opts.dept || opts.scriptKey || '').toLowerCase();
        if (dept.indexOf('service') >= 0 || dept.indexOf('tech') >= 0) {
          global.__videoStudioLane = global.__videoStudioLane || 'service';
        }
        const out = orig.apply(this, arguments);
        setTimeout(hidePrompter, 50);
        setTimeout(hidePrompter, 400);
        return out;
      };
      global.openCustomerVideoStudio.__msSvcTp = true;
    }
    hidePrompter();
  }

  const t = setInterval(wrap, 400);
  setTimeout(function () { clearInterval(t); wrap(); }, 20000);
})(window);
