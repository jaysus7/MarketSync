/* Excel tables, social view-area grids, large icons, photo-drop frames. */
(function (global) {
  'use strict';
  const WHITE = '#FFFFFF';
  const INK = '#0F172A';
  const FRAME_STYLES = ['classic','round','circle','polaroid','phone','window','arch','double','ticket','hex','diamond','story','oval','shadow','gold','thin','thick','dashed'];
  const FRAME_COLORS = ['#8B5CF6','#2563EB','#0EA5E9','#14B8A6','#22C55E','#EAB308','#F97316','#EF4444','#EC4899','#111827','#64748B','#F8FAFC'];
  const FRAME_ORNAMENTS = ['plain','mat','double-mat','ornate','film','stamp','float'];
  const SOCIAL_GRIDS = [
    { id: 'grid-ig-square', name: 'Instagram feed 1:1', style: 'social-ig-square', note: 'Keep faces and prices inside the dashed square' },
    { id: 'grid-ig-portrait', name: 'Instagram portrait 4:5', style: 'social-ig-portrait', note: '4:5 feed crop' },
    { id: 'grid-ig-story', name: 'Instagram / TikTok story', style: 'social-story', note: 'Top and bottom bands are UI chrome' },
    { id: 'grid-tiktok', name: 'TikTok vertical', style: 'social-tiktok', note: 'Buttons cover the lower-right and bottom' },
    { id: 'grid-fb', name: 'Facebook / Link preview', style: 'social-fb', note: 'Link previews crop toward the center band' },
    { id: 'grid-yt', name: 'YouTube thumbnail', style: 'social-yt', note: 'Keep title-safe content away from timestamp' },
    { id: 'grid-thirds', name: 'Rule of thirds', style: 'social-thirds', note: 'Place subject on the intersections' },
    { id: 'grid-center-safe', name: 'Center safe area', style: 'social-center', note: 'Safe zone for every network crop' }
  ];
  function frameCatalog() {
    if (global.__msFrameCatalog) return global.__msFrameCatalog;
    const list = [];
    FRAME_STYLES.forEach((style) => FRAME_COLORS.forEach((color) => FRAME_ORNAMENTS.forEach((ornament) => {
      list.push({ id: 'frame-' + style + '-' + ornament + '-' + color.slice(1), name: style + ' ' + ornament + ' frame', category: 'Frames', kind: 'frame', style, ornament, color });
    })));
    global.__msFrameCatalog = list;
    return list;
  }
  function extraVisuals() {
    return frameCatalog().concat(SOCIAL_GRIDS.map((g) => Object.assign({ category: 'Grids', kind: 'grid', color: '#0EA5E9' }, g)));
  }
  function scaleIcon(image) {
    if (!image) return;
    if (typeof image.scaleToWidth === 'function') image.scaleToWidth(240);
    image.setCoords && image.setCoords();
    global.__studioAdapter && global.__studioAdapter.fabricCanvas && global.__studioAdapter.fabricCanvas.requestRenderAll();
  }
  function hydrateIcons() {
    if (global.__msIconHydrated) return;
    global.__msIconHydrated = true;
    fetch('https://api.iconify.design/collection?prefix=lucide').then((r) => r.json()).then((data) => {
      const names = [].concat(data.uncategorized || []);
      Object.values(data.categories || {}).forEach((arr) => { if (Array.isArray(arr)) names.push.apply(names, arr); });
      const seen = {};
      global.__msIconCatalog = names.filter((n) => n && !seen[n] && (seen[n] = 1)).slice(0, 1200).map((name, i) => ({ id: 'icon-x-' + (i + 1), name, label: name.replace(/-/g, ' ') }));
      if (typeof global.filterStudioIcons === 'function') global.filterStudioIcons(false);
    }).catch(function () {});
  }
  function colLabel(i) { return String.fromCharCode(65 + (i % 26)); }
  function addExcelTable(rows, cols) {
    rows = rows || 5; cols = cols || 4;
    const adapter = global.__studioAdapter, canvas = adapter && adapter.fabricCanvas, fabric = global.fabric;
    if (!adapter || !canvas || !fabric) return;
    const center = canvas.getCenter(), cellW = 150, cellH = 48;
    const left = center.left - (cols * cellW) / 2, top = center.top - (rows * cellH) / 2;
    const objects = [], cells = [], tableId = 'table_' + Date.now();
    for (let r = 0; r < rows; r++) {
      cells[r] = [];
      for (let c = 0; c < cols; c++) {
        const x = left + c * cellW, y = top + r * cellH, header = r === 0;
        const bg = new fabric.Rect({ left: x, top: y, width: cellW, height: cellH, fill: header ? '#1E293B' : WHITE, stroke: '#CBD5E1', strokeWidth: 1 });
        const value = header ? ('Column ' + colLabel(c)) : '';
        const txt = new fabric.Textbox(value, { left: x + 8, top: y + 12, width: cellW - 16, fontSize: 16, fontWeight: header ? '800' : '600', fill: header ? WHITE : INK, fontFamily: 'Inter, system-ui, sans-serif' });
        bg.msData = { tableId, role: 'cell-bg', row: r, col: c };
        txt.msData = { tableId, role: 'cell', row: r, col: c };
        canvas.add(bg); canvas.add(txt); objects.push(bg, txt); cells[r][c] = value;
      }
    }
    canvas.discardActiveObject();
    canvas.setActiveObject(new fabric.ActiveSelection(objects, { canvas }));
    adapter.groupSelected && adapter.groupSelected();
    const group = canvas.getActiveObject();
    if (group) group.msData = Object.assign({}, group.msData || {}, { kind: 'excel-table', tableId, rows, cols, cells });
    canvas.requestRenderAll(); adapter.saveHistory && adapter.saveHistory();
    if (typeof showToast === 'function') showToast('Excel table added \u2014 double-tap to type', 'success');
  }
  function openExcelEditor(group) {
    const meta = group && group.msData || {};
    if (meta.kind !== 'excel-table') return;
    document.getElementById('ms-excel-sheet') && document.getElementById('ms-excel-sheet').remove();
    const rows = meta.rows || 5, cols = meta.cols || 4;
    const cells = meta.cells || Array.from({ length: rows }, function () { return Array.from({ length: cols }, function () { return ''; }); });
    const sheet = document.createElement('div');
    sheet.id = 'ms-excel-sheet';
    sheet.style.cssText = 'position:fixed;inset:0;z-index:100010;background:rgba(15,23,42,.55);display:flex;align-items:flex-end;justify-content:center;padding:12px';
    const head = Array.from({ length: cols }, function (_, c) { return '<th style="background:#e2e8f0;border:1px solid #cbd5e1">' + colLabel(c) + '</th>'; }).join('');
    const body = cells.map(function (row, r) {
      return '<tr>' + row.map(function (val, c) { return '<td style="border:1px solid #cbd5e1;padding:0"><input data-r="' + r + '" data-c="' + c + '" value="' + String(val || '').replace(/"/g, '&quot;') + '" style="width:100%;border:0;padding:8px"></td>'; }).join('') + '</tr>';
    }).join('');
    sheet.innerHTML = '<div style="width:min(720px,96vw);max-height:72vh;overflow:auto;background:#fff;color:#0f172a;border-radius:20px 20px 0 0;padding:16px"><div style="display:flex;justify-content:space-between;margin-bottom:10px"><b>Edit table</b><span><button type="button" id="ms-excel-apply">Apply</button> <button type="button" id="ms-excel-close">Close</button></span></div><table style="width:100%;border-collapse:collapse"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table><p style="font-size:12px;color:#64748b">Tab moves right. Enter moves down.</p></div>';
    document.body.appendChild(sheet);
    const inputs = [].slice.call(sheet.querySelectorAll('input'));
    inputs[0] && inputs[0].focus();
    sheet.addEventListener('keydown', function (e) {
      if (!(e.target instanceof HTMLInputElement)) return;
      const r = Number(e.target.dataset.r), c = Number(e.target.dataset.c);
      if (e.key === 'Tab') { e.preventDefault(); const n = e.shiftKey ? (c === 0 ? [r - 1, cols - 1] : [r, c - 1]) : (c === cols - 1 ? [r + 1, 0] : [r, c + 1]); const el = sheet.querySelector('input[data-r="' + n[0] + '"][data-c="' + n[1] + '"]'); el && el.focus(); }
      if (e.key === 'Enter') { e.preventDefault(); const el = sheet.querySelector('input[data-r="' + (r + 1) + '"][data-c="' + c + '"]'); el && el.focus(); }
    });
    function apply() {
      inputs.forEach(function (input) { cells[Number(input.dataset.r)][Number(input.dataset.c)] = input.value; });
      meta.cells = cells;
      const kids = group._objects || (group.getObjects && group.getObjects()) || [];
      kids.forEach(function (obj) { if (obj.msData && obj.msData.role === 'cell') obj.set('text', cells[obj.msData.row][obj.msData.col] || ''); });
      group.msData = meta; group.addWithUpdate && group.addWithUpdate();
      global.__studioAdapter.fabricCanvas.requestRenderAll(); global.__studioAdapter.saveHistory && global.__studioAdapter.saveHistory(); sheet.remove();
    }
    sheet.querySelector('#ms-excel-apply').onclick = apply;
    sheet.querySelector('#ms-excel-close').onclick = function () { sheet.remove(); };
  }
  function addSocialGrid(item) {
    const adapter = global.__studioAdapter, canvas = adapter && adapter.fabricCanvas, fabric = global.fabric;
    if (!adapter || !canvas || !fabric) return;
    const w = canvas.getWidth(), h = canvas.getHeight();
    function addLine(x1,y1,x2,y2){ const line = new fabric.Line([x1,y1,x2,y2], { stroke: 'rgba(14,165,233,.85)', strokeWidth: 3, strokeDashArray: [14,10], selectable: false, evented: false }); line.msData = { kind: 'social-guide', name: item.name }; canvas.add(line); }
    function addBand(top,height,label){ const rect = new fabric.Rect({ left:0, top:top, width:w, height:height, fill:'rgba(15,23,42,.22)', selectable:false, evented:false }); const text = new fabric.Textbox(label, { left:24, top:top+10, width:w-48, fontSize:22, fill:'#E2E8F0', fontWeight:'800' }); rect.msData = text.msData = { kind:'social-guide', name:item.name }; canvas.add(rect); canvas.add(text); }
    const pad = Math.round(Math.min(w,h)*0.08);
    if (item.style === 'social-thirds') { addLine(w/3,0,w/3,h); addLine(w*2/3,0,w*2/3,h); addLine(0,h/3,w,h/3); addLine(0,h*2/3,w,h*2/3); }
    else if (item.style === 'social-story' || item.style === 'social-tiktok') { addBand(0, Math.round(h*0.12), 'UI chrome'); addBand(Math.round(h*0.78), Math.round(h*0.22), item.style === 'social-tiktok' ? 'Buttons / caption' : 'Story sticker zone'); }
    else if (item.style === 'social-yt') addBand(Math.round(h*0.82), Math.round(h*0.18), 'Timestamp / title-safe');
    else if (item.style === 'social-fb') { addBand(0, Math.round(h*0.18), 'Link preview crop'); addBand(Math.round(h*0.82), Math.round(h*0.18), 'Link preview crop'); }
    else { const rect = new fabric.Rect({ left:pad, top:pad, width:w-pad*2, height:h-pad*2, fill:'rgba(255,255,255,0)', stroke:'#0EA5E9', strokeWidth:4, strokeDashArray:[16,10] }); const label = new fabric.Textbox(item.note || item.name, { left:pad+16, top:pad+16, width:w-pad*2-32, fontSize:22, fill:'#0369A1', fontWeight:'800' }); rect.msData = label.msData = { kind:'social-guide', name:item.name }; canvas.add(rect); canvas.add(label); }
    canvas.requestRenderAll(); adapter.saveHistory && adapter.saveHistory();
    if (typeof showToast === 'function') showToast(item.name + ' guides added', 'success');
  }
  function addPhotoFrame(item) {
    const adapter = global.__studioAdapter, canvas = adapter && adapter.fabricCanvas, fabric = global.fabric;
    if (!adapter || !canvas || !fabric) return;
    item = item || {};
    const center = canvas.getCenter(), color = item.color || '#8B5CF6', style = item.style || 'classic';
    const w = style === 'phone' ? 280 : style === 'story' ? 320 : 420;
    const h = (style === 'circle' || style === 'hex' || style === 'diamond') ? w : (style === 'phone' || style === 'story') ? 560 : 320;
    const left = center.left - w/2, top = center.top - h/2;
    const hole = new fabric.Rect({ left:left, top:top, width:w, height:h, fill:'rgba(248,250,252,.92)', stroke:color, strokeWidth: item.ornament === 'thick' ? 22 : item.ornament === 'thin' ? 6 : 14, rx: (style==='round'||style==='polaroid')?28:(style==='circle'||style==='oval')?w/2:8, ry: style==='oval'?h/2:style==='circle'?w/2:(style==='round'||style==='polaroid')?28:8, strokeDashArray: (item.ornament==='dashed'||item.ornament==='stamp')?[18,10]:null });
    hole.msData = { kind:'photo-frame', style:style, ornament:item.ornament, name:item.name, acceptsPhoto:true };
    canvas.add(hole);
    const hint = new fabric.Textbox('Drop a photo here', { left:left+16, top:top+h/2-14, width:w-32, fontSize:18, fill:'#64748B', textAlign:'center', fontWeight:'700' });
    hint.msData = { kind:'photo-frame-hint' }; canvas.add(hint);
    canvas.setActiveObject(hole); canvas.requestRenderAll(); adapter.saveHistory && adapter.saveHistory();
    if (typeof showToast === 'function') showToast('Frame added \u2014 drag a photo onto it', 'success');
  }
  function fillFrameWithUrl(frame, url) {
    const adapter = global.__studioAdapter, canvas = adapter && adapter.fabricCanvas, fabric = global.fabric;
    if (!adapter || !canvas || !fabric || !frame || !url) return;
    fabric.Image.fromURL(url, function (img) {
      if (!img) return;
      const w = frame.getScaledWidth(), h = frame.getScaledHeight();
      img.set({ left: frame.left, top: frame.top });
      img.scaleToWidth(w);
      if (img.getScaledHeight() < h) img.scaleToHeight(h);
      img.clipPath = new fabric.Rect({ width:w, height:h, rx:frame.rx||0, ry:frame.ry||0, originX:'center', originY:'center' });
      img.msData = { kind:'framed-photo' };
      canvas.add(img); canvas.setActiveObject(img); canvas.requestRenderAll(); adapter.saveHistory && adapter.saveHistory();
    }, { crossOrigin: 'anonymous' });
  }
  function wireCanvas() {
    const canvas = global.__studioAdapter && global.__studioAdapter.fabricCanvas;
    if (!canvas || canvas.__msElementsUpgrade) return;
    canvas.__msElementsUpgrade = true;
    canvas.on('mouse:dblclick', function (evt) {
      const target = evt.target;
      const group = target && (target.type === 'group' ? target : target.group);
      if (group && group.msData && group.msData.kind === 'excel-table') openExcelEditor(group);
    });
    const el = canvas.wrapperEl || canvas.upperCanvasEl;
    if (!el) return;
    el.addEventListener('dragover', function (e) { e.preventDefault(); });
    el.addEventListener('drop', function (e) {
      e.preventDefault();
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      const pointer = canvas.getPointer({ clientX: e.clientX, clientY: e.clientY, target: el });
      const objects = canvas.getObjects().slice().reverse();
      const frame = objects.find(function (obj) { return obj.msData && obj.msData.acceptsPhoto && obj.containsPoint && obj.containsPoint(new global.fabric.Point(pointer.x, pointer.y)); }) || canvas.getActiveObject();
      if (file && file.type.indexOf('image/') === 0) {
        const reader = new FileReader();
        reader.onload = function () { if (frame && frame.msData && frame.msData.acceptsPhoto) fillFrameWithUrl(frame, reader.result); else global.__studioAdapter.addImage(reader.result, file.name); };
        reader.readAsDataURL(file);
      }
    });
  }
  function wrapAll() {
    if (typeof global.studioAddIcon === 'function' && !global.studioAddIcon.__upgraded) {
      const orig = global.studioAddIcon;
      global.studioAddIcon = function (id) {
        const extra = (global.__msIconCatalog || []).find(function (item) { return item.id === id; });
        if (extra && global.__studioAdapter) {
          const library = (document.getElementById('studio-icon-library-select') && document.getElementById('studio-icon-library-select').value) || 'lucide';
          const url = (global.studioIconUrl && global.studioIconUrl(extra.name, library)) || ('https://api.iconify.design/lucide/' + extra.name + '.svg?color=%232563EB');
          global.__studioAdapter.addImage(url, 'Icon: ' + extra.name).then(function (image) { if (image) { image.msData = Object.assign({}, image.msData || {}, { iconName: extra.name, mediaType: 'svg-icon' }); scaleIcon(image); } });
          return;
        }
        orig(id);
        setTimeout(function () { scaleIcon(global.__studioAdapter && global.__studioAdapter.fabricCanvas && global.__studioAdapter.fabricCanvas.getActiveObject()); }, 400);
      };
      global.studioAddIcon.__upgraded = true;
    }
    if (typeof global.renderStudioIconLibrary === 'function' && !global.renderStudioIconLibrary.__upgraded) {
      const origR = global.renderStudioIconLibrary;
      global.renderStudioIconLibrary = function (query, library) {
        const html = origR(query, library);
        const needle = String(query || (document.getElementById('studio-icon-query') && document.getElementById('studio-icon-query').value) || '').toLowerCase();
        const extra = (global.__msIconCatalog || []).filter(function (item) { return !needle || item.name.indexOf(needle) >= 0 || item.label.indexOf(needle) >= 0; }).slice(0, 80);
        const cards = extra.map(function (item) {
          const url = (global.studioIconUrl && global.studioIconUrl(item.name, library || 'lucide')) || ('https://api.iconify.design/lucide/' + item.name + '.svg?color=%232563EB');
          return '<button type="button" onclick="studioAddIcon(\'' + item.id + '\')" class="studio-icon-card" title="' + item.label + '"><span class="studio-icon-visual"><img src="' + url + '" class="studio-icon-art" style="width:42px;height:42px"></span><small>' + item.label + '</small></button>';
        }).join('');
        return (html || '') + cards;
      };
      global.renderStudioIconLibrary.__upgraded = true;
    }
    if (typeof global.studioAddVisualElement === 'function' && !global.studioAddVisualElement.__upgraded) {
      const origV = global.studioAddVisualElement;
      global.studioAddVisualElement = function (id) {
        const extra = extraVisuals().find(function (item) { return item.id === id; });
        if ((extra && extra.kind === 'frame') || String(id || '').indexOf('frame-') === 0) return addPhotoFrame(extra || { id: id, name: 'Photo frame', style: String(id).replace('frame-','').split('-')[0], color: '#8B5CF6' });
        if (extra && extra.kind === 'grid' && String(extra.style || '').indexOf('social-') === 0) return addSocialGrid(extra);
        if (String(id || '').indexOf('table-') === 0) return addExcelTable();
        const result = origV(id);
        setTimeout(function () { const a = global.__studioAdapter && global.__studioAdapter.fabricCanvas && global.__studioAdapter.fabricCanvas.getActiveObject(); if (a && a.msData && a.msData.mediaType === 'svg-icon') scaleIcon(a); }, 350);
        return result;
      };
      global.studioAddVisualElement.__upgraded = true;
    }
    if (typeof global.renderStudioPremadeElements === 'function' && !global.renderStudioPremadeElements.__upgraded) {
      const origP = global.renderStudioPremadeElements;
      global.renderStudioPremadeElements = function (query, category) {
        const html = origP(query, category);
        const needle = String(query || '').toLowerCase();
        const cat = category || global.__studioElementCategory || 'All';
        const extras = extraVisuals().filter(function (item) { return (cat === 'All' || item.category === cat) && (!needle || (item.name + ' ' + item.category).toLowerCase().indexOf(needle) >= 0); });
        const cards = extras.slice(0, cat === 'Frames' ? 48 : 16).map(function (item) {
          return '<button type="button" onclick="studioAddVisualElement(\'' + item.id + '\')" class="studio-element-card"><div class="studio-catalog-card-copy"><b>' + item.name + '</b><span>' + item.category + '</span></div></button>';
        }).join('');
        return (html || '') + cards;
      };
      global.renderStudioPremadeElements.__upgraded = true;
    }
  }
  const boot = setInterval(function () { wrapAll(); wireCanvas(); hydrateIcons(); }, 500);
  setTimeout(function () { clearInterval(boot); }, 25000);
})(window);
