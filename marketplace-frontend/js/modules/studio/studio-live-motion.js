/* Animation picks must move on the canvas, not sit as still icons. */
(function (global) {
  'use strict';

  let raf = 0;

  function canvas() {
    const adapter = global.__studioAdapter;
    return (adapter && adapter.fabricCanvas) || null;
  }

  function applyFrame(object, time) {
    const raw = object.msData && object.msData.animation;
    const type = typeof raw === 'string' ? raw : (raw && raw.type);
    if (!type || type === 'none') return;
    object.__animationBase = object.__animationBase || {
      left: object.left || 0,
      top: object.top || 0,
      angle: object.angle || 0,
      opacity: object.opacity == null ? 1 : object.opacity,
      scaleX: object.scaleX || 1,
      scaleY: object.scaleY || 1
    };
    const base = object.__animationBase;
    const duration = Number((raw && raw.duration) || 1400);
    const phase = (time % duration) / duration;
    const wave = Math.sin(phase * Math.PI * 2);
    if (type === 'float') object.set({ top: base.top + wave * 36 });
    else if (type === 'pulse') object.set({ scaleX: base.scaleX * (1 + wave * 0.12), scaleY: base.scaleY * (1 + wave * 0.12), opacity: Math.max(0.55, base.opacity * (0.75 + (wave + 1) * 0.15)) });
    else if (type === 'pop') object.set({ scaleX: base.scaleX * (1 + Math.max(0, wave) * 0.22), scaleY: base.scaleY * (1 + Math.max(0, wave) * 0.22) });
    else if (type === 'spin') object.set({ angle: base.angle + phase * 360 });
    else if (type === 'bounce') object.set({ top: base.top - Math.abs(wave) * 48 });
    else if (type === 'fade') object.set({ opacity: 0.25 + (wave + 1) * 0.37 });
    else if (type === 'slide') object.set({ left: base.left + wave * 48 });
    else if (type === 'rise') object.set({ top: base.top - Math.max(0, wave) * 56, opacity: 0.45 + (wave + 1) * 0.28 });
    else if (type === 'shake') object.set({ left: base.left + Math.sin(phase * Math.PI * 10) * 16 });
    else if (type === 'wiggle') object.set({ angle: base.angle + Math.sin(phase * Math.PI * 6) * 14 });
  }

  function loop(time) {
    const c = canvas();
    if (c && c.getObjects) {
      c.getObjects().forEach(function (obj) { applyFrame(obj, time); });
      c.requestRenderAll();
    }
    raf = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (!raf) raf = requestAnimationFrame(loop);
    const adapter = global.__studioAdapter;
    if (adapter && typeof adapter.startAnimationLoop === 'function' && !adapter.__msLiveMotion) {
      adapter.startAnimationLoop();
      adapter.__msLiveMotion = true;
    }
  }

  function setMotion(obj, type, duration) {
    if (!obj) return;
    if (type === 'none') {
      if (obj.msData) delete obj.msData.animation;
      delete obj.__animationBase;
      return;
    }
    obj.msData = Object.assign({}, obj.msData || {}, { animation: { type: type, duration: duration || 1400 } });
    delete obj.__animationBase;
    startLoop();
  }

  function wrapAddVisual() {
    if (typeof global.studioAddVisualElement !== 'function' || global.studioAddVisualElement.__msMotion) return;
    const orig = global.studioAddVisualElement;
    global.studioAddVisualElement = function (id) {
      const catalog = global.STUDIO_VISUAL_ELEMENTS || [];
      const item = catalog.find && catalog.find(function (el) { return el.id === id; });
      const out = orig.apply(this, arguments);
      if (item && item.animation) {
        setTimeout(function () {
          const c = canvas();
          const obj = c && c.getActiveObject && c.getActiveObject();
          if (obj) setMotion(obj, item.animation, 1400);
          else if (c && c.getObjects) {
            const last = c.getObjects()[c.getObjects().length - 1];
            if (last) {
              c.setActiveObject(last);
              setMotion(last, item.animation, 1400);
            }
          }
          startLoop();
        }, 400);
      }
      return out;
    };
    global.studioAddVisualElement.__msMotion = true;
  }

  function wrapApply() {
    ['studioApplyMotion', 'studioSetAnimation'].forEach(function (name) {
      const orig = global[name];
      if (typeof orig !== 'function' || orig.__msMotion) return;
      global[name] = function (type, duration) {
        const c = canvas();
        const obj = c && c.getActiveObject && c.getActiveObject();
        if (obj) setMotion(obj, type, duration);
        startLoop();
        return orig.apply(this, arguments);
      };
      global[name].__msMotion = true;
    });
  }

  document.addEventListener('click', function (ev) {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const onclick = btn.getAttribute('onclick') || '';
    const motion = (onclick.match(/studioApplyMotion\('([^']+)'/) || onclick.match(/studioSetAnimation\('([^']+)'/) || [])[1];
    if (motion) {
      const obj = canvas() && canvas().getActiveObject && canvas().getActiveObject();
      if (obj) setMotion(obj, motion);
      startLoop();
    }
  }, true);

  wrapAddVisual();
  wrapApply();
  startLoop();
  setInterval(function () { wrapAddVisual(); wrapApply(); startLoop(); }, 800);
})(window);
