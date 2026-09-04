/* Icons, frames, grids, graphics, tables, charts, stickers all land on the canvas. */
(function (global) {
  'use strict';

  function adapter() { return global.__studioAdapter || null; }
  function canvas() {
    const a = adapter();
    return (a && a.fabricCanvas) || null;
  }
  function center() {
    const c = canvas();
    return c && c.getCenter ? c.getCenter() : { left: 220, top: 220 };
  }
  function toast(msg) {
    if (typeof global.showToast === 'function') global.showToast(msg, 'success');
  }
  function count() {
    const c = canvas();
    return c && c.getObjects ? c.getObjects().length : -1;
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
        obj.set({ left: mid.left - (w || 160) / 2, top: mid.top - (h || 120) / 2, fill: fill || '#2563EB' });
        c.requestRenderAll();
        return obj;
      }
    }
    if (!c || !fabric) return null;
    const obj = extra.circle
      ? new fabric.Circle({ left: mid.left - 70, top: mid.top - 70, radius: 70, fill: fill || '#2563EB' })
      : new fabric.Rect({ left: mid.left - (w || 180) / 2, top: mid.top - (h || 120) / 2, width: w || 180, height: h || 120, fill: fill || '#2563EB', rx: 12, ry: 12 });
    obj.msData = { name: extra.name || 'Element' };
    c.add(obj); c.setActiveObject(obj); c.requestRenderAll();
    return obj;
  }

  function addText(text, opts) {
    const a = adapter();
    const c = canvas();
    const fabric = window.fabric;
    const mid = center();
    opts = opts || {};
    if (a && typeof a.addText === 'function') { a.addText(text, opts); return c && c.getActiveObject && c.getActiveObject(); }
    if (!c || !fabric) return null;
    const obj = new fabric.Textbox(text, { left: mid.left - 140, top: mid.top - 20, width: 280, fontSize: opts.fontSize || 28, fontWeight: '800', fill: opts.fill || '#0F172A' });
    c.add(obj); c.setActiveObject(obj); c.requestRenderAll();
    return obj;
  }

  function addImage(url, name) {
    const a = adapter();
    const c = canvas();
    if (a && typeof a.addImage === 'function') return Promise.resolve(a.addImage(url, name));
    const fabric = window.fabric;
    if (!c || !fabric) return Promise.resolve(null);
    return new Promise(function (resolve) {
      fabric.Image.fromURL(url, function (img) {
        img.scaleToWidth(180);
        const mid = center();
        img.set({ left: mid.left - 90, top: mid.top - 90 });
        img.msData = { name: name || 'Image' };
        c.add(img); c.setActiveObject(img); c.requestRenderAll();
        resolve(img);
      }, { crossOrigin: 'anonymous' });
    });
  }

  function dropItem(item) {
    if (!item) return false;
    if (item.kind === 'chart' && typeof global.msEditStudioChart === 'function') { global.msEditStudioChart(); return true; }
    if (item.kind === 'icon' || item.icon) {
      const url = typeof global.studioIconUrl === 'function' ? global.studioIconUrl(item.icon || item.name, item.library || 'lucide', item.color || '#2563EB') : '';
      if (url) addImage(url, item.name);
      else addText(item.name || 'Icon', { fontSize: 42, fill: item.color || '#2563EB' });
      toast((item.name || 'Icon') + ' added');
      return true;
    }
    if (item.kind === 'shape' || item.shape || item.base) {
      if (typeof global.msDropStudioShape === 'function') global.msDropStudioShape(item.shape || item.base || 'rect', item.color);
      else addRect(item.color || '#2563EB', 200, 140, { name: item.name });
      toast((item.name || 'Shape') + ' added');
      return true;
    }
    if (item.kind === 'table') { addRect('#FFFFFF', 420, 240, { name: item.name }); addText('Double-tap to type', { fontSize: 16 }); toast('Table added'); return true; }
    addRect(item.color || '#4F46E5', 240, 180, { name: item.name });
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
    return { id: id, name: String(id || 'Element'), kind: 'shape' };
  }

  function wrap(name, fallback) {
    const orig = global[name];
    if (typeof orig !== 'function') { global[name] = fallback; return; }
    if (orig.__msAllDrop) return;
    global[name] = function (id) {
      const item = findItem(id);
      const before = count();
      const out = orig.apply(this, arguments);
      setTimeout(function () {
        if (count() === before) dropItem(item);
      }, 160);
      return out;
    };
    global[name].__msAllDrop = true;
  }

  function install() {
    wrap('studioAddVisualElement', function (id) { dropItem(findItem(id)); });
    wrap('studioAddPremade', function (id) { dropItem(findItem(id)); });
    wrap('studioAddIcon', function (id) { dropItem(findItem(id)); });
    wrap('studioAddSticker', function () { addText('Sticker', { fontSize: 48 }); });
    wrap('studioAddTextTemplate', function (id) { addText(String(id || 'Headline'), { fontSize: 36 }); });
    wrap('studioAddShape', function (type) {
      if (typeof global.msDropStudioShape === 'function') global.msDropStudioShape(type);
      else addRect('#2563EB', 200, 140, { name: type });
    });
  }

  install();
  setInterval(install, 900);
})(window);
