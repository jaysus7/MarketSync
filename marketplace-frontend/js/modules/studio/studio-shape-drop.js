/* Clicking a shape in Elements must drop it on the visible studio canvas. */
(function (global) {
  'use strict';

  function fabricCanvas() {
    const adapter = global.__studioAdapter;
    if (adapter && adapter.fabricCanvas) return adapter.fabricCanvas;
    const canvases = Array.from(document.querySelectorAll('canvas.upper-canvas, canvas.lower-canvas, #studio-canvas, canvas'));
    const visible = canvases.find(function (el) {
      const box = el.getBoundingClientRect();
      return box.width > 80 && box.height > 80;
    });
    if (visible && visible.__fabric) return visible.__fabric;
    if (visible && window.fabric) {
      const existing = window.fabric.Canvas && window.fabric.Canvas.prototype;
      return adapter && adapter.fabricCanvas;
    }
    return null;
  }

  function drop(shapeType, color) {
    const fill = color || global.__studioShapeColor || '#2563EB';
    const type = String(shapeType || 'rect').toLowerCase();
    if (global.__studioAdapter && typeof global.__studioAdapter.addShape === 'function' && global.__studioAdapter.fabricCanvas) {
      global.__studioAdapter.stopDrawingMode && global.__studioAdapter.stopDrawingMode();
      global.__studioAdapter.addShape(type, fill);
      return true;
    }
    const canvas = fabricCanvas();
    const fabric = window.fabric;
    if (!canvas || !fabric) return false;
    const center = canvas.getCenter ? canvas.getCenter() : { left: 200, top: 200 };
    let shape;
    if (type === 'circle') shape = new fabric.Circle({ left: center.left - 80, top: center.top - 80, radius: 80, fill: fill });
    else if (type === 'ellipse') shape = new fabric.Ellipse({ left: center.left - 120, top: center.top - 70, rx: 120, ry: 70, fill: fill });
    else if (type === 'triangle') shape = new fabric.Triangle({ left: center.left - 90, top: center.top - 90, width: 180, height: 180, fill: fill });
    else if (type === 'line' || type === 'arrow') {
      const path = type === 'arrow' ? 'M 0 40 L 200 40 M 160 10 L 200 40 L 160 70' : 'M 0 0 L 220 0';
      shape = new fabric.Path(path, { left: center.left - 110, top: center.top - 20, fill: '', stroke: fill, strokeWidth: 8 });
    } else if (type === 'star') {
      const pts = Array.from({ length: 10 }, function (_, i) {
        const r = i % 2 ? 40 : 90;
        const a = -Math.PI / 2 + i * Math.PI / 5;
        return { x: 90 + Math.cos(a) * r, y: 90 + Math.sin(a) * r };
      });
      shape = new fabric.Polygon(pts, { left: center.left - 90, top: center.top - 90, fill: fill });
    } else {
      shape = new fabric.Rect({ left: center.left - 110, top: center.top - 70, width: 220, height: 140, fill: fill, rx: type === 'badge' ? 18 : 0, ry: type === 'badge' ? 18 : 0 });
    }
    shape.set({ selectable: true, evented: true });
    shape.msData = { type: 'shape', shapeType: type };
    canvas.add(shape);
    canvas.setActiveObject(shape);
    canvas.requestRenderAll();
    return true;
  }

  function wrap() {
    if (typeof global.studioAddShape === 'function' && !global.studioAddShape.__msDrop) {
      const orig = global.studioAddShape;
      global.studioAddShape = function (shapeType) {
        const ok = drop(shapeType);
        if (!ok) orig.apply(this, arguments);
        if (typeof global.showToast === 'function' && ok) global.showToast('Shape added', 'success');
      };
      global.studioAddShape.__msDrop = true;
    }
    global.msDropStudioShape = drop;
  }

  document.addEventListener('click', function (ev) {
    const btn = ev.target.closest('button, [data-shape], [data-shape-type]');
    if (!btn) return;
    const attr = btn.getAttribute('data-shape') || btn.getAttribute('data-shape-type');
    const onclick = btn.getAttribute('onclick') || '';
    const fromOnclick = (onclick.match(/studioAddShape\('([^']+)'\)/) || [])[1];
    const label = String(btn.getAttribute('aria-label') || btn.title || btn.textContent || '').toLowerCase();
    const type = attr || fromOnclick || ({
      rectangle: 'rect', square: 'rect', circle: 'circle', ellipse: 'ellipse', oval: 'ellipse',
      triangle: 'triangle', diamond: 'diamond', star: 'star', line: 'line', arrow: 'arrow',
      heart: 'heart', badge: 'badge', hexagon: 'hexagon', pentagon: 'pentagon', speech: 'speech'
    })[label.replace(/^add\s+/, '').trim()];
    if (!type) return;
    if (fromOnclick && global.studioAddShape && global.studioAddShape.__msDrop) return;
    ev.preventDefault();
    drop(type);
  }, true);

  wrap();
  setInterval(wrap, 700);
})(window);
