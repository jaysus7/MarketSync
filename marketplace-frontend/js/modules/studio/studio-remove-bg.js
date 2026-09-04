/* Remove background from the selected Studio image. */
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
  function canvas() {
    return global.__studioAdapter && global.__studioAdapter.fabricCanvas;
  }

  async function cutSelected() {
    const c = canvas();
    const obj = c && c.getActiveObject && c.getActiveObject();
    if (!obj || obj.type !== 'image') {
      if (typeof global.showToast === 'function') global.showToast('Select a photo first', 'info');
      return;
    }
    const src = obj.getSrc ? obj.getSrc() : obj._element && obj._element.src;
    if (!src) return;
    if (typeof global.showToast === 'function') global.showToast('Removing background…', 'info');
    try {
      const r = await fetch(api() + '/studio/remove-background', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: src })
      });
      const d = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(d.error || 'Could not remove background');
      const fabric = window.fabric;
      fabric.Image.fromURL(d.url, function (img) {
        img.set({ left: obj.left, top: obj.top, scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle });
        img.msData = Object.assign({}, obj.msData || {}, { cutout: true });
        c.remove(obj);
        c.add(img);
        c.setActiveObject(img);
        c.requestRenderAll();
        if (typeof global.showToast === 'function') global.showToast('Background removed', 'success');
      }, { crossOrigin: 'anonymous' });
    } catch (e) {
      if (typeof global.showToast === 'function') global.showToast(e.message || 'Remove background failed', 'error');
    }
  }
  global.msStudioRemoveBackground = cutSelected;

  function ensureButton() {
    if (document.getElementById('studio-remove-bg-btn')) return;
    const host = document.getElementById('studio-context-toolbar') || document.getElementById('studio-tool-panel');
    if (!host) return;
    const btn = document.createElement('button');
    btn.id = 'studio-remove-bg-btn';
    btn.type = 'button';
    btn.textContent = 'Remove BG';
    btn.style.cssText = 'margin:6px;padding:8px 10px;border-radius:12px;border:0;background:#4F46E5;color:#fff;font-weight:800;font-size:11px';
    btn.onclick = cutSelected;
    host.appendChild(btn);
  }

  setInterval(ensureButton, 900);
})(window);
