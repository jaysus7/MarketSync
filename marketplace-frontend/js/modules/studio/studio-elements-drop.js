/* Icons, frames, grids, graphics, tables, charts, stickers — all must land on the canvas. */
(function (global) {
  'use strict';

  function adapter() { return global.__studioAdapter || null; }
  function canvas() {
    const a = adapter();
    if (a && a.fabricCanvas) return a.fabricCanvas;
    return null;
  }
  function center() {
    const c = canvas();
    return c && c.getCenter ? c.getCenter() : { left: 220, top: 220 };
  }
  function toast(msg) {
    if (typeof global.showToast === 'function') global.showToast(msg, 'success');
  }

  function addRect(fill, w, h, extra) {
    const a = adapter();
    const c = canvas();
    const fabric = window.fabric;
    const mid = center();
    extra = extra || {};
    if (a && typeof a.addShape === 'function' && a.fabricCanvas) {
      a.addShape(extra.circle ? 'circle' : 'rect', fill || '#2563EB');
      const obj = c && c.getActiveObject && c.getActiveObject();
      if (obj) {
        obj.set(Object.assign({ left: mid.left - (w || 160) / 2, top: mid.top - (h || 120) / 2, fill: fill || '#2563EB' }, extra.width ? { width: extra.width } : {}, extra.height ? { height: extra.height } : {}, extra));
        obj.setCoords();
        c.requestRenderAll();
        return obj;
      }
    }
    if (!c || !fabric) return null;
    const obj = extra.circle
      ? new fabric.Circle({ left: mid.left - 70, top: mid.top - 70, radius: 70, fill: fill || '#2563EB' })
      : new fabric.Rect({ left: mid.left - (w || 180) / 2, top: mid.top - (h || 120) / 2, width: w || 180, height: h || 120, fill: fill || '#2563EB', rx: extra.rx || 12, ry: extra.ry || 12 });
    obj.msData = { type: extra.name ? 'element' : 'shape', name: extra.name || 'Element' };
    c.add(obj);
    c.setActiveObject(obj);
    c.requestRenderAll();
    return obj;
  }

  function addText(text, opts) {
    const a = adapter();
    const c = canvas();
    const fabric = window.fabric;
    const mid = center();
    opts = opts || {};
    if (a && typeof a.addText === 'function') {
      a.addText(text, opts);
      return c && c.getActiveObject && c.getActiveObject();
    }
    if (!c || !fabric) return null;
    const obj = new fabric.Textbox(text, {
      left: mid.left - 140,
      top: mid.top - 20,
      width: 280,
      fontSize: opts.fontSize || 28,
      fontWeight: opts.fontWeight || '800',
      fill: opts.fill || '#0F172A'
    });
    c.add(obj);
    c.setActiveObject(obj);
    c.requestRenderAll();
    return obj;
  }

  function addImage(url, name) {
    const a = adapter();
    const c = canvas();
    if (a && typeof a.addImage === 'function') {
      return Promise.resolve(a.addImage(url, name));
    }
    const fabric = window.fabric;
    if (!c || !fabric) return Promise.resolve(null);
    return new Promise(function (resolve) {
      fabric.Image.fromURL(url, function (img) {
        img.scaleToWidth(180);
        const mid = center();
        img.set({ left: mid.left - 90, top: mid.top - 90 });
        img.msData = { name: name || 'Image' };
        c.add(img);
        c.setActiveObject(img);
        c.requestRenderAll();
        resolve(img);
      }, { crossOrigin: 'anonymous' });
    });
  }

  function dropItem(item) {
    if (!item) return false;
    if (item.kind === 'chart' && typeof global.msEditStudioChart === 'function') {
      global.msEditStudioChart();
      return true;
    }
    if (item.kind === 'icon' || item.icon) {
      const url = typeof global.studioIconUrl === 'function'
        ? global.studioIconUrl(item.icon || item.name, item.library || 'lucide', item.color || '#2563EB')
        : '';
      if (url) addImage(url, item.name);
      else addText(item.name || 'Icon', { fontSize: 42, fill: item.color || '#2563EB' });
      toast((item.name || 'Icon') + ' added');
      return true;
    }
    if (item.kind === 'shape' || item.shape) {
      if (typeof global.msDropStudioShape === 'function') global.msDropStudioShape(item.shape || item.base || 'rect', item.color);
      else addRect(item.color || '#2563EB', 200, 140, { name: item.name });
      toast((item.name || 'Shape') + ' added');
      return true;
    }
    if (item.kind === 'table') {
      addRect('#FFFFFF', 420, 240, { name: item.name, stroke: '#CBD5E1', strokeWidth: 2 });
      addText('Double-tap to type in this table', { fontSize: 16, fill: '#334155' });
      toast('Table added');
      return true;
    }
    if (item.kind === 'grid' || item.kind === 'frame' || item.kind === 'social') {
      addRect('rgba(79,70,229,0.08)', 360, 360, { name: item.name, stroke: '#4F46E5', strokeWidth: 3 });
      toast((item.name || 'Element') + ' added');
      return true;
    }
    addRect(item.color || '#4F46E5', 220, 160, { name: item.name });
    toast((item.name || 'Element') + ' added');
    return true;
  }

  function findItem(id) {
    const lists = [global.STUDIO_VISUAL_ELEMENTS, global.STUDIO_PREMADE_ELEMENTS, global.STUDIO_ICON_LIBRARY, global.STUDIO_SHAPE_LIBRARY];
    for (let i = 0; i < lists.length; i++) {
      const list = lists[i];
      if (!list || !list.find) continue;
      const hit = list.find(function (el) { return el.id === id || el.base === id || el.name === id; });
      if (hit) return hit;
    }
    return null;
  }

  function wrap(name, fallback) {
    const orig = global[name];
    if (typeof orig !== 'function' || orig.__msAllDrop) {
      if (typeof orig !== 'function') global[name] = fallback;
      return;
    }
    global[name] = function (id) {
      const item = findItem(id) || { id: id, name: String(id || 'Element'), kind: 'shape' };
      const hadCanvas = !!canvas();
      const out = orig.apply(this, arguments);
      setTimeout(function () {
        const c = canvas();
        const count = c && c.getObjects ? c.getObjects().length : 0;
        if (!hadCanvas || !c || count === 0) dropItem(item);
      }, 80);
      return out;
    };
    global[name].__msAllDrop = true;
  }

  function install() {
    wrap('studioAddVisualElement', function (id) { dropItem(findItem(id)); });
    wrap('studioAddPremade', function (id) { dropItem(findItem(id)); });
    wrap('studioAddIcon', function (id) { dropItem(findItem(id) || { id: id, kind: 'icon', icon: id, name: id }); });
    wrap('studioAddSticker', function () { addText('Sticker', { fontSize: 48 }); });
    wrap('studioAddTextTemplate', function (id) { addText(String(id || 'Headline'), { fontSize: 36 }); });
    wrap('studioAddShape', function (type) {
      if (typeof global.msDropStudioShape === 'function') global.msDropStudioShape(type);
      else addRect('#2563EB', 200, 140, { name: type });
    });
  }

  document.addEventListener('click', function (ev) {
    const btn = ev.target.closest('button, [data-element-id]');
    if (!btn) return;
    const onclick = btn.getAttribute('onclick') || '';
    const id = btn.getAttribute('data-element-id') ||
      (onclick.match(/studioAddVisualElement\('([^']+)'\)/) || [])[1] ||
      (onclick.match(/studioAddPremade\('([^']+)'\)/) || [])[1] ||
      (onclick.match(/studioAddIcon\('([^']+)'\)/) || [])[1];
    if (!id) return;
    setTimeout(function () {
      const c = canvas();
      if (!c) dropItem(findItem(id) || { id: id, name: btn.title || id, kind: 'shape' });
    }, 120);
  }, true);

  install();
  setInterval(install, 900);
})(window);
