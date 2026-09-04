/* Charts take real numbers and redraw on the canvas. */
(function (global) {
  'use strict';

  const DEFAULT_ROWS = [
    { label: 'New', value: 12 },
    { label: 'Used', value: 19 },
    { label: 'CPO', value: 7 },
    { label: 'Service', value: 15 }
  ];

  function canvas() {
    return global.__studioAdapter && global.__studioAdapter.fabricCanvas;
  }

  function parseText(text) {
    return String(text || '').split(/\n+/).map(function (line) {
      const parts = line.split(/[,|:\t]+/);
      if (parts.length < 2) return null;
      const label = parts[0].trim();
      const value = Number(String(parts[1]).replace(/[^0-9.\-]/g, ''));
      if (!label || !isFinite(value)) return null;
      return { label: label, value: value };
    }).filter(Boolean);
  }

  function toText(rows) {
    return (rows || DEFAULT_ROWS).map(function (r) { return r.label + ', ' + r.value; }).join('\n');
  }

  function colors() {
    return ['#4F46E5', '#06B6D4', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#0EA5E9', '#F97316'];
  }

  function svgFor(style, rows) {
    const w = 640, h = 400;
    const max = Math.max.apply(null, rows.map(function (r) { return r.value; }).concat([1]));
    const palette = colors();
    let inner = '<rect width="' + w + '" height="' + h + '" rx="28" fill="#0F172A"/>';
    inner += '<text x="28" y="40" fill="#E2E8F0" font-size="20" font-family="Arial" font-weight="800">Dealership chart</text>';
    if (style === 'donut' || style === 'progress') {
      const total = rows.reduce(function (s, r) { return s + Math.max(0, r.value); }, 0) || 1;
      let acc = 0;
      const R = 92, C = 2 * Math.PI * R;
      rows.forEach(function (r, i) {
        const frac = Math.max(0, r.value) / total;
        inner += '<circle cx="210" cy="220" r="' + R + '" fill="none" stroke="' + palette[i % palette.length] + '" stroke-width="36" stroke-dasharray="' + (C * frac) + ' ' + C + '" stroke-dashoffset="' + (-C * acc) + '" transform="rotate(-90 210 220)"/>';
        inner += '<text x="400" y="' + (120 + i * 32) + '" fill="' + palette[i % palette.length] + '" font-size="16" font-family="Arial" font-weight="700">' + r.label + '  ' + r.value + '</text>';
        acc += frac;
      });
      if (style === 'progress') {
        const pct = Math.round((rows[0].value / (max || 1)) * 100);
        inner += '<text x="210" y="226" text-anchor="middle" fill="#F8FAFC" font-size="28" font-family="Arial" font-weight="900">' + pct + '%</text>';
      }
    } else if (style === 'line') {
      const pts = rows.map(function (r, i) {
        const x = 50 + i * ((w - 90) / Math.max(rows.length - 1, 1));
        const y = 340 - (r.value / max) * 220;
        return x + ',' + y;
      }).join(' ');
      inner += '<polyline fill="none" stroke="#38BDF8" stroke-width="8" points="' + pts + '"/>';
      rows.forEach(function (r, i) {
        const x = 50 + i * ((w - 90) / Math.max(rows.length - 1, 1));
        const y = 340 - (r.value / max) * 220;
        inner += '<circle cx="' + x + '" cy="' + y + '" r="7" fill="#F8FAFC"/><text x="' + x + '" y="372" text-anchor="middle" fill="#94A3B8" font-size="14" font-family="Arial">' + r.label + '</text>';
      });
    } else if (style === 'kpi') {
      const r = rows[0];
      inner += '<text x="40" y="160" fill="#94A3B8" font-size="22" font-family="Arial" font-weight="700">' + r.label + '</text>';
      inner += '<text x="40" y="250" fill="#F8FAFC" font-size="72" font-family="Arial" font-weight="900">' + r.value + '</text>';
    } else {
      const gap = 16;
      const barW = Math.max(24, (w - 80 - gap * rows.length) / rows.length);
      rows.forEach(function (r, i) {
        const bh = (r.value / max) * 240;
        const x = 40 + i * (barW + gap);
        const y = 340 - bh;
        inner += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + bh + '" rx="10" fill="' + palette[i % palette.length] + '"/>';
        inner += '<text x="' + (x + barW / 2) + '" y="368" text-anchor="middle" fill="#94A3B8" font-size="13" font-family="Arial">' + r.label + '</text>';
        inner += '<text x="' + (x + barW / 2) + '" y="' + (y - 8) + '" text-anchor="middle" fill="#E2E8F0" font-size="13" font-family="Arial" font-weight="700">' + r.value + '</text>';
      });
    }
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">' + inner + '</svg>');
  }

  function paint(style, rows, existing) {
    const c = canvas();
    const fabric = window.fabric;
    if (!c || !fabric) return;
    const src = svgFor(style || 'bars', rows && rows.length ? rows : DEFAULT_ROWS);
    fabric.Image.fromURL(src, function (img) {
      img.scaleToWidth(520);
      img.set({ left: existing && existing.left != null ? existing.left : c.getCenter().left - 260, top: existing && existing.top != null ? existing.top : c.getCenter().top - 160 });
      img.msData = { type: 'chart', style: style || 'bars', rows: rows, name: 'Chart' };
      if (existing) {
        const idx = c.getObjects().indexOf(existing);
        c.remove(existing);
        if (idx >= 0) c.insertAt(img, idx, false);
        else c.add(img);
      } else c.add(img);
      c.setActiveObject(img);
      c.requestRenderAll();
    }, { crossOrigin: 'anonymous' });
  }

  function openEditor(style, rows, existing) {
    document.getElementById('studio-chart-data-sheet')?.remove();
    const sheet = document.createElement('div');
    sheet.id = 'studio-chart-data-sheet';
    sheet.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:240;background:#0f172a;color:#fff;padding:16px 16px 28px;border-radius:22px 22px 0 0;max-height:62%;overflow:auto';
    sheet.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><strong>Chart data</strong><button type="button" id="ms-chart-close" style="background:none;border:0;color:#fff;font-size:22px">×</button></div>' +
      '<p style="font-size:12px;color:#94a3b8;margin:0 0 8px">One row per bar. Label, then a comma, then the number. Example: Used, 19</p>' +
      '<textarea id="ms-chart-rows" style="width:100%;min-height:140px;border-radius:14px;padding:10px;background:#020617;color:#fff;border:1px solid #334155">' + toText(rows || DEFAULT_ROWS) + '</textarea>' +
      '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
      ['bars','columns','line','donut','progress','kpi'].map(function (s) {
        return '<button type="button" data-style="' + s + '" style="padding:8px 10px;border-radius:12px;border:0;background:' + (s === (style || 'bars') ? '#4F46E5' : '#1e293b') + ';color:#fff;font-weight:800;font-size:12px">' + s + '</button>';
      }).join('') + '</div>' +
      '<button type="button" id="ms-chart-apply" style="margin-top:12px;width:100%;padding:12px;border:0;border-radius:14px;background:#4F46E5;color:#fff;font-weight:900">Apply to canvas</button>';
    document.body.appendChild(sheet);
    let chosen = style || 'bars';
    sheet.querySelectorAll('[data-style]').forEach(function (btn) {
      btn.onclick = function () {
        chosen = btn.getAttribute('data-style');
        sheet.querySelectorAll('[data-style]').forEach(function (b) { b.style.background = '#1e293b'; });
        btn.style.background = '#4F46E5';
      };
    });
    sheet.querySelector('#ms-chart-close').onclick = function () { sheet.remove(); };
    sheet.querySelector('#ms-chart-apply').onclick = function () {
      const parsed = parseText(sheet.querySelector('#ms-chart-rows').value);
      paint(chosen, parsed.length ? parsed : DEFAULT_ROWS, existing);
      sheet.remove();
    };
  }

  function wrapAdd() {
    if (typeof global.studioAddVisualElement !== 'function' || global.studioAddVisualElement.__msChart) return;
    const orig = global.studioAddVisualElement;
    global.studioAddVisualElement = function (id) {
      const item = (global.STUDIO_VISUAL_ELEMENTS || []).find && (global.STUDIO_VISUAL_ELEMENTS || []).find(function (el) { return el.id === id; });
      if (item && item.kind === 'chart') {
        openEditor(item.style || 'bars', DEFAULT_ROWS, null);
        return;
      }
      return orig.apply(this, arguments);
    };
    global.studioAddVisualElement.__msChart = true;
  }

  document.addEventListener('dblclick', function () {
    const obj = canvas() && canvas().getActiveObject && canvas().getActiveObject();
    if (obj && obj.msData && obj.msData.type === 'chart') openEditor(obj.msData.style, obj.msData.rows, obj);
  });

  global.msEditStudioChart = function () {
    const obj = canvas() && canvas().getActiveObject && canvas().getActiveObject();
    openEditor(obj && obj.msData && obj.msData.style, obj && obj.msData && obj.msData.rows, obj);
  };

  wrapAdd();
  setInterval(wrapAdd, 800);
})(window);
