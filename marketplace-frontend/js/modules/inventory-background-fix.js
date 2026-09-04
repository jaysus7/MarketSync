/* Keep branded lot background uploads from hanging on the spinner. */
(function (global) {
  'use strict';

  function token() {
    return localStorage.getItem('token') || localStorage.getItem('ms_auth_token') || '';
  }
  function api() {
    return global.API || (location.hostname.indexOf('staging') !== -1
      ? 'https://marketsync-staging-backend.onrender.com'
      : 'https://vehicle-marketplace-s0e4.onrender.com');
  }

  function paintPreview(url) {
    global.__photoBackgroundUrl = url || null;
    const box = document.getElementById('pbg-preview');
    if (!box) return;
    if (url) box.innerHTML = '<img src="' + url + '" class="w-full h-40 object-cover rounded-lg border border-slate-200">';
    else box.innerHTML = '<div class="w-full h-40 rounded-lg bg-slate-100 flex items-center justify-center text-sm text-slate-400">No background set</div>';
  }

  async function loadExisting() {
    try {
      const r = await fetch(api() + '/dealership/photo-background', { headers: { Authorization: 'Bearer ' + token() } });
      const d = await r.json().catch(function () { return {}; });
      if (d.url) paintPreview(d.url);
    } catch (e) {}
  }

  async function upload(file) {
    if (!file) return;
    if (typeof global.showToast === 'function') global.showToast('Uploading background…', 'info');
    try {
      const fd = new FormData();
      fd.append('background', file);
      const ctrl = new AbortController();
      const timer = setTimeout(function () { ctrl.abort(); }, 45000);
      const r = await fetch(api() + '/dealership/photo-background', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token() },
        body: fd,
        signal: ctrl.signal
      });
      clearTimeout(timer);
      const d = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(d.error || ('Upload failed (' + r.status + ')'));
      paintPreview(d.url);
      if (typeof global.showToast === 'function') global.showToast('Background saved', 'success');
    } catch (e) {
      if (typeof global.showToast === 'function') global.showToast(e.name === 'AbortError' ? 'Upload timed out — try a smaller photo' : (e.message || 'Upload failed'), 'error');
    }
  }

  function wrap() {
    if (typeof global.uploadPhotoBackground === 'function' && !global.uploadPhotoBackground.__msFix) {
      global.uploadPhotoBackground = function (file) { return upload(file); };
      global.uploadPhotoBackground.__msFix = true;
    }
    if (typeof global.openPhotoBackgroundUploader === 'function' && !global.openPhotoBackgroundUploader.__msFix) {
      const orig = global.openPhotoBackgroundUploader;
      global.openPhotoBackgroundUploader = function () {
        const out = orig.apply(this, arguments);
        setTimeout(loadExisting, 50);
        return out;
      };
      global.openPhotoBackgroundUploader.__msFix = true;
    }
  }

  wrap();
  setInterval(wrap, 800);
})(window);
