/* Contextual element toolbar + live animations. */
(function (global) {
  'use strict';

  const MOTIONS = [
    ['none', '—', 'None'],
    ['fade', '◑', 'Fade'],
    ['float', '↕', 'Float'],
    ['pulse', '◉', 'Pulse'],
    ['pop', '✦', 'Pop'],
    ['bounce', '⇧', 'Bounce'],
    ['spin', '↻', 'Spin'],
    ['slide', '→', 'Slide'],
    ['rise', '↑', 'Rise'],
    ['shake', '↔', 'Shake'],
    ['wiggle', '〰', 'Wiggle']
  ];

  function active() {
    return global.__studioAdapter && global.__studioAdapter.fabricCanvas && global.__studioAdapter.fabricCanvas.getActiveObject();
  }

  function kindOf(obj) {
    if (!obj) return null;
    const type = String(obj.type || '');
    if (['textbox', 'text', 'i-text'].indexOf(type) >= 0) return 'text';
    if (type === 'image') return 'image';
    if (type === 'group') return 'group';
    return 'shape';
  }

  function injectCss() {
    if (document.getElementById('studio-context-toolbar-css')) return;
    const style = document.createElement('style');
    style.id = 'studio-context-toolbar-css';
    style.textContent = `
      #studio-context-toolbar{position:absolute;left:50%;bottom:var(--studio-ctx-bottom,86px);transform:translateX(-50%);z-index:80;display:none;align-items:center;gap:2px;max-width:calc(100% - 16px);overflow-x:auto;padding:6px 8px;border-radius:22px;background:rgba(15,23,42,.94);color:#fff;box-shadow:0 12px 40px rgba(0,0,0,.35)}
      #studio-context-toolbar.is-open{display:flex}
      #studio-context-toolbar button{flex:0 0 auto;min-width:58px;border:0;background:transparent;color:#e2e8f0;padding:6px 8px;border-radius:14px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;font:700 10px/1.1 -apple-system,Segoe UI,sans-serif}
      #studio-context-toolbar button .ico{font-size:16px;line-height:1}
      #studio-context-quick{position:absolute;top:72px;right:12px;z-index:80;display:none;gap:6px;padding:6px;border-radius:18px;background:rgba(15,23,42,.92);color:#fff}
      #studio-context-quick.is-open{display:flex}
      #studio-context-quick button{width:36px;height:36px;border:0;border-radius:12px;background:transparent;color:#fff;font-size:16px;cursor:pointer}
      /* The sheet used to be hardcoded dark (#0f172a on #fff text) inside an editor
         that is light by default, so every panel opened as a black slab. It follows
         the app theme now, and only goes dark when the app does. */
      #studio-context-sheet{position:absolute;left:0;right:0;bottom:0;z-index:90;display:none;max-height:62%;overflow:auto;padding:14px 16px 24px;border-radius:22px 22px 0 0;background:#fff;color:#0f172a;box-shadow:0 -12px 40px rgba(15,23,42,.18)}
      #studio-context-sheet.is-open{display:block}
      #studio-context-sheet h4{margin:0 0 10px;font:800 13px/1.2 -apple-system,Segoe UI,sans-serif}
      #studio-context-sheet label{display:block;font:700 11px/1.2 -apple-system,Segoe UI,sans-serif;color:#64748b;margin:8px 0}
      #studio-context-sheet input,#studio-context-sheet select{width:100%;margin-top:4px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;color:#0f172a;padding:8px}
      #studio-ctx-close{border:0;background:transparent;color:#64748b;font-size:20px;line-height:1;cursor:pointer}
      /* Colour grid: tapping a colour is the common case, so it leads. */
      .studio-swatch-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:7px;margin:6px 0 2px}
      .studio-swatch{aspect-ratio:1;border-radius:8px;border:1px solid rgba(15,23,42,.14);padding:0;cursor:pointer;box-shadow:0 1px 2px rgba(15,23,42,.08)}
      .studio-swatch[aria-pressed="true"]{outline:2.5px solid #2563eb;outline-offset:2px}
      .studio-swatch-heading{font:800 10px/1.2 -apple-system,Segoe UI,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin:12px 0 2px}
      .studio-swatch-current{display:flex;align-items:center;gap:9px;font:700 12px/1.2 -apple-system,Segoe UI,sans-serif}
      .studio-swatch-current span.chip{width:26px;height:26px;border-radius:8px;border:1px solid rgba(15,23,42,.18)}
      .dark #studio-context-sheet{background:#0f172a;color:#f8fafc;box-shadow:0 -12px 40px rgba(0,0,0,.5)}
      .dark #studio-context-sheet label{color:#94a3b8}
      .dark #studio-context-sheet input,.dark #studio-context-sheet select{border-color:#334155;background:#1e293b;color:#fff}
      .dark #studio-ctx-close{color:#94a3b8}
      .dark .studio-swatch{border-color:rgba(255,255,255,.22)}
      .dark .studio-swatch-heading{color:#94a3b8}
      .dark .studio-swatch-current span.chip{border-color:rgba(255,255,255,.28)}
      .studio-motion-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
      .studio-motion-grid button{border:1px solid #334155;background:#1e293b;color:#e2e8f0;border-radius:14px;padding:10px 6px;font:800 11px/1.2 -apple-system,Segoe UI,sans-serif}
      .studio-motion-grid button[aria-current="true"]{border-color:#818cf8;background:#312e81;color:#fff}
      @media (min-width:900px){#studio-context-toolbar{bottom:var(--studio-ctx-bottom,24px)}}
    `;
    document.head.appendChild(style);
  }

  function ensure() {
    const modal = document.getElementById('ms-studio-master-modal');
    if (!modal) return null;
    injectCss();
    ['studio-context-toolbar', 'studio-context-quick', 'studio-context-sheet'].forEach(function (id) {
      if (!document.getElementById(id)) {
        const el = document.createElement('div');
        el.id = id;
        modal.appendChild(el);
      }
    });
    return {
      bar: document.getElementById('studio-context-toolbar'),
      quick: document.getElementById('studio-context-quick'),
      sheet: document.getElementById('studio-context-sheet')
    };
  }

  // The toolbar is absolutely positioned against the modal, and BELOW it sit the
  // tool rail and the footer. The old hardcoded bottom:86px was smaller than the
  // two of them together on a phone (a 64px rail plus a 50px footer = 114px), so
  // the dark pill sat on top of the rail and swallowed its taps. Measure them
  // instead of guessing: whatever the rail and footer actually are, the toolbar
  // clears them.
  function positionToolbar() {
    const modal = document.getElementById('ms-studio-master-modal');
    if (!modal) return;
    const modalBox = modal.getBoundingClientRect();
    let clearance = 0;
    ['[data-studio-region="rail"]', ':scope > footer'].forEach(function (selector) {
      const el = modal.querySelector(selector);
      if (!el) return;
      const box = el.getBoundingClientRect();
      if (box.height <= 0) return;
      // Full width is what tells a bottom bar from a side column. On a phone the
      // rail is a full-width strip under the canvas and must be cleared; on a wide
      // screen it is a narrow left-hand column that the toolbar sits beside, and
      // counting its height would fling the toolbar off the top of the modal.
      if (box.width >= modalBox.width * 0.9) clearance += box.height;
    });
    modal.style.setProperty('--studio-ctx-bottom', (clearance + 16) + 'px');
  }

  // Rail and footer heights change with orientation and with the desktop layout.
  ['resize', 'orientationchange'].forEach(function (event) {
    global.addEventListener(event, function () { positionToolbar(); });
  });

  function tool(id, icon, label) {
    return '<button type="button" data-ctx-tool="' + id + '"><span class="ico">' + icon + '</span>' + label + '</button>';
  }

  function toolsFor(kind) {
    const animate = tool('animate','✨','Animate');
    if (kind === 'text') return tool('format','B≡','Format') + tool('type','T','Type') + tool('effects','▢','Effects') + animate + tool('opacity','◑','Transparency') + tool('layers','≡','Layers') + tool('position','⤢','Position') + tool('nudge','↔','Nudge');
    if (kind === 'image') return tool('edit','✎','Edit') + animate + tool('color','◉','Color') + tool('opacity','◑','Transparency') + tool('effects','▢','Effects') + tool('position','⤢','Position') + tool('nudge','↔','Nudge') + tool('layers','≡','Layers');
    return tool('shape','◇','Shape') + tool('edit','✎','Edit') + tool('color','◉','Color') + tool('style','≣','Style') + animate + tool('corners','◢','Corners') + tool('opacity','◑','Transparency') + tool('position','⤢','Position') + tool('nudge','↔','Nudge') + tool('layers','≡','Layers');
  }

  function hexColor(obj) {
    const fill = obj && (typeof obj.fill === 'string' ? obj.fill : '');
    const stroke = obj && (typeof obj.stroke === 'string' ? obj.stroke : '');
    return (fill && fill.charAt(0) === '#') ? fill : ((stroke && stroke.charAt(0) === '#') ? stroke : '#2563eb');
  }

  function openSheet(title, html) {
    const ui = ensure();
    if (!ui) return;
    ui.sheet.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h4>' + title + '</h4><button type="button" id="studio-ctx-close" aria-label="Close">&times;</button></div>' + html;
    positionToolbar();
    ui.sheet.classList.add('is-open');
    ui.sheet.querySelector('#studio-ctx-close').onclick = function () { ui.sheet.classList.remove('is-open'); };
  }

  // A single colour bar gave no idea what was available and needed a fiddly drag on
  // a phone. Tapping a swatch is the common case, so the grid leads and the native
  // picker stays underneath for an exact value.
  const STUDIO_FILL_NEUTRALS = [
    '#FFFFFF', '#F1F5F9', '#CBD5E1', '#94A3B8', '#64748B', '#334155', '#1E293B', '#000000',
  ];
  const STUDIO_FILL_COLOURS = [
    '#FEE2E2', '#FCA5A5', '#EF4444', '#B91C1C', '#FFEDD5', '#FDBA74', '#F97316', '#C2410C',
    '#FEF3C7', '#FCD34D', '#F59E0B', '#B45309', '#DCFCE7', '#86EFAC', '#22C55E', '#15803D',
    '#CCFBF1', '#5EEAD4', '#14B8A6', '#0F766E', '#DBEAFE', '#93C5FD', '#3B82F6', '#1D4ED8',
    '#E0E7FF', '#A5B4FC', '#6366F1', '#4338CA', '#F3E8FF', '#D8B4FE', '#A855F7', '#7E22CE',
    '#FCE7F3', '#F9A8D4', '#EC4899', '#BE185D', '#F5F5F4', '#D6D3D1', '#78716C', '#292524',
  ];

  function swatchRow(colours, current) {
    return colours.map(function (hex) {
      const on = String(hex).toUpperCase() === String(current || '').toUpperCase();
      return '<button type="button" class="studio-swatch" aria-pressed="' + on + '" aria-label="' + hex +
        '" title="' + hex + '" style="background:' + hex + '" data-studio-fill="' + hex + '"></button>';
    }).join('');
  }

  function colorSheetHtml(current) {
    return '<div class="studio-swatch-current"><span class="chip" id="studio-fill-chip" style="background:' + current +
      '"></span><span id="studio-fill-value">' + current + '</span></div>' +
      '<div class="studio-swatch-heading">Neutrals</div>' +
      '<div class="studio-swatch-grid">' + swatchRow(STUDIO_FILL_NEUTRALS, current) + '</div>' +
      '<div class="studio-swatch-heading">Colours</div>' +
      '<div class="studio-swatch-grid">' + swatchRow(STUDIO_FILL_COLOURS, current) + '</div>' +
      '<label>Custom<input type="color" id="studio-fill-custom" value="' + current + '"></label>';
  }

  // Delegated so it survives the sheet being re-rendered.
  document.addEventListener('click', function (ev) {
    const btn = ev.target && ev.target.closest && ev.target.closest('[data-studio-fill]');
    if (!btn) return;
    ev.preventDefault();
    applyFill(btn.getAttribute('data-studio-fill'));
  });
  document.addEventListener('input', function (ev) {
    if (ev.target && ev.target.id === 'studio-fill-custom') applyFill(ev.target.value);
  });

  function applyFill(hex) {
    if (typeof global.studioSetObjectStyle === 'function') global.studioSetObjectStyle('color', hex);
    const chip = document.getElementById('studio-fill-chip');
    const value = document.getElementById('studio-fill-value');
    if (chip) chip.style.background = hex;
    if (value) value.textContent = hex;
    document.querySelectorAll('[data-studio-fill]').forEach(function (el) {
      el.setAttribute('aria-pressed', String(el.getAttribute('data-studio-fill')).toUpperCase() === String(hex).toUpperCase());
    });
  }

  function currentMotion() {
    const obj = active();
    return (obj && obj.msData && obj.msData.animation && obj.msData.animation.type) || 'none';
  }

  function applyMotion(type, duration) {
    const adapter = global.__studioAdapter;
    const obj = active();
    if (!adapter || !obj) return;
    if (typeof adapter.setSelectedAnimation === 'function') adapter.setSelectedAnimation(type, duration || 1600);
    else if (typeof global.studioSetAnimation === 'function') global.studioSetAnimation(type);
    // setSelectedAnimation already records msData.animation, previews it once and
    // restores every value. Writing msData a second time here — and stamping
    // __animationBase — is what let a half-played frame reach the saved scene.
    if (typeof adapter.setSelectedAnimation !== 'function' && obj) {
      if (type === 'none') { if (obj.msData) delete obj.msData.animation; }
      else obj.msData = Object.assign({}, obj.msData || {}, { animation: { type: type, duration: duration || 1600 } });
      if (typeof adapter.previewAnimation === 'function') adapter.previewAnimation(obj);
    }
    if (typeof showToast === 'function') showToast(type === 'none' ? 'Animation removed' : type + ' animation previewed — it plays on export', 'success');
    openAnimateSheet();
  }
  global.studioApplyMotion = applyMotion;

  function openAnimateSheet() {
    const obj = active();
    const current = currentMotion();
    const duration = (obj && obj.msData && obj.msData.animation && obj.msData.animation.duration) || 1600;
    const grid = MOTIONS.map(function (item) {
      return '<button type="button" aria-current="' + (current === item[0]) + '" onclick="studioApplyMotion(\'' + item[0] + '\',' + duration + ')">' + item[1] + '<div>' + item[2] + '</div></button>';
    }).join('');
    openSheet('Animate', '<div class="studio-motion-grid">' + grid + '</div><label>Speed<input type="range" min="400" max="4000" step="100" value="' + duration + '" oninput="studioApplyMotion(\'' + current + '\', Number(this.value))"></label><p style="font-size:11px;color:#64748b">Previews once here. It plays in full on export.</p>');
  }

  function runTool(id) {
    const obj = active();
    if (!obj) return;
    if (id === 'layers') {
      if (typeof global.setStudioTool === 'function') global.setStudioTool('layers');
      if (typeof global.openStudioMobilePanel === 'function') global.openStudioMobilePanel('tool');
      return;
    }
    if (id === 'animate') return openAnimateSheet();
    if (id === 'color') return openSheet('Colour', colorSheetHtml(hexColor(obj)));
    if (id === 'opacity') return openSheet('Transparency', '<label>Opacity<input type="range" min="0" max="100" value="' + Math.round((obj.opacity == null ? 1 : obj.opacity) * 100) + '" oninput="studioSetObjectStyle(\'opacity\', Number(this.value)/100)"></label>');
    if (id === 'corners') return openSheet('Corners', '<label>Radius<input type="range" min="0" max="120" value="' + Math.round(obj.rx || 0) + '" oninput="studioSetObjectStyle(\'rx\', Number(this.value));studioSetObjectStyle(\'ry\', Number(this.value))"></label>');
    if (id === 'style' || id === 'effects') return openSheet('Style', '<label>Shadow<select onchange="studioSetObjectStyle(\'shadow\', this.value===\'none\'?null:{color:\'rgba(0,0,0,.35)\',blur:12,offsetY:6})"><option value="none">None</option><option value="soft">Soft</option><option value="lift">Lift</option></select></label>');
    if (id === 'position') return openSheet('Position', '<label>X<input type="number" value="' + Math.round(obj.left || 0) + '" onchange="studioSetObjectGeometry(\'left\', this.value)"></label><label>Y<input type="number" value="' + Math.round(obj.top || 0) + '" onchange="studioSetObjectGeometry(\'top\', this.value)"></label><label>Rotate<input type="number" value="' + Math.round(obj.angle || 0) + '" onchange="studioSetObjectGeometry(\'rotation\', this.value)"></label>');
    if (id === 'nudge') return openSheet('Nudge', '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:180px;margin:12px auto"><span></span><button type="button" onclick="studioSetObjectGeometry(\'top\',' + Math.round((obj.top || 0) - 8) + ')">↑</button><span></span><button type="button" onclick="studioSetObjectGeometry(\'left\',' + Math.round((obj.left || 0) - 8) + ')">←</button><button type="button">·</button><button type="button" onclick="studioSetObjectGeometry(\'left\',' + Math.round((obj.left || 0) + 8) + ')">→</button><span></span><button type="button" onclick="studioSetObjectGeometry(\'top\',' + Math.round((obj.top || 0) + 8) + ')">↓</button><span></span></div>');
    if (id === 'format' || id === 'type' || id === 'edit' || id === 'shape') {
      if (kindOf(obj) === 'text') {
        return openSheet('Format', '<label>Font size<input type="number" value="' + Math.round(obj.fontSize || 24) + '" onchange="studioSetTextStyle(\'fontSize\', Number(this.value))"></label><label>Color<input type="color" value="' + hexColor(obj) + '" oninput="studioSetTextStyle(\'fill\', this.value)"></label>');
      }
      if (typeof global.setStudioInspectorTab === 'function') global.setStudioInspectorTab('style');
      if (typeof global.openStudioMobilePanel === 'function') global.openStudioMobilePanel('inspector');
    }
  }

  // applyExtraMotion() and hookAnimations() lived here: a second requestAnimationFrame
  // loop, running forever alongside the adapter's, writing the same object properties
  // through its own __animationBase. Both are gone — StudioFabricAdapter.previewAnimation
  // plays every motion type once and puts the values back.

  function render(selected) {
    const ui = ensure();
    if (!ui) return;
    const obj = Array.isArray(selected) ? selected[0] : selected || active();
    const kind = kindOf(obj);
    if (!kind) {
      ui.bar.classList.remove('is-open');
      ui.quick.classList.remove('is-open');
      ui.sheet.classList.remove('is-open');
      ui.bar.innerHTML = '';
      return;
    }
    ui.bar.innerHTML = toolsFor(kind);
    positionToolbar();
    ui.bar.classList.add('is-open');
    ui.quick.innerHTML = '<button type="button" title="Duplicate" data-ctx-quick="dup">⧉</button><button type="button" title="Delete" data-ctx-quick="del">🗑</button>';
    ui.quick.classList.add('is-open');
    ui.bar.querySelectorAll('[data-ctx-tool]').forEach(function (btn) {
      btn.onclick = function () { runTool(btn.getAttribute('data-ctx-tool')); };
    });
    ui.quick.onclick = function (e) {
      const action = e.target && e.target.getAttribute && e.target.getAttribute('data-ctx-quick');
      if (action === 'dup' && global.__studioAdapter && global.__studioAdapter.duplicateSelected) global.__studioAdapter.duplicateSelected();
      if (action === 'del' && global.__studioAdapter && global.__studioAdapter.deleteSelected) global.__studioAdapter.deleteSelected();
    };
  }

  function hookAdapter() {
    const adapter = global.__studioAdapter;
    if (!adapter) return;
    if (adapter.__ctxToolbarHooked) return;
    const orig = adapter.onSelectionChange.bind(adapter);
    adapter.onSelectionChange = function (selected) {
      orig(selected);
      render(selected);
    };
    adapter.__ctxToolbarHooked = true;
    render(adapter.fabricCanvas && adapter.fabricCanvas.getActiveObject());
  }

  const boot = setInterval(hookAdapter, 400);
  setTimeout(function () { clearInterval(boot); }, 25000);
  document.addEventListener('click', hookAdapter);
})(window);
