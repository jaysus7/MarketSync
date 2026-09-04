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
      #studio-context-toolbar{position:absolute;left:50%;bottom:86px;transform:translateX(-50%);z-index:80;display:none;align-items:center;gap:2px;max-width:calc(100% - 16px);overflow-x:auto;padding:6px 8px;border-radius:22px;background:rgba(15,23,42,.94);color:#fff;box-shadow:0 12px 40px rgba(0,0,0,.35)}
      #studio-context-toolbar.is-open{display:flex}
      #studio-context-toolbar button{flex:0 0 auto;min-width:58px;border:0;background:transparent;color:#e2e8f0;padding:6px 8px;border-radius:14px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;font:700 10px/1.1 -apple-system,Segoe UI,sans-serif}
      #studio-context-toolbar button .ico{font-size:16px;line-height:1}
      #studio-context-quick{position:absolute;top:72px;right:12px;z-index:80;display:none;gap:6px;padding:6px;border-radius:18px;background:rgba(15,23,42,.92);color:#fff}
      #studio-context-quick.is-open{display:flex}
      #studio-context-quick button{width:36px;height:36px;border:0;border-radius:12px;background:transparent;color:#fff;font-size:16px;cursor:pointer}
      #studio-context-sheet{position:absolute;left:0;right:0;bottom:0;z-index:90;display:none;max-height:52%;overflow:auto;padding:14px 16px 24px;border-radius:22px 22px 0 0;background:#0f172a;color:#fff}
      #studio-context-sheet.is-open{display:block}
      #studio-context-sheet h4{margin:0 0 10px;font:800 13px/1.2 -apple-system,Segoe UI,sans-serif}
      #studio-context-sheet label{display:block;font:700 11px/1.2 -apple-system,Segoe UI,sans-serif;color:#94a3b8;margin:8px 0}
      #studio-context-sheet input,#studio-context-sheet select{width:100%;margin-top:4px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#fff;padding:8px}
      .studio-motion-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
      .studio-motion-grid button{border:1px solid #334155;background:#1e293b;color:#e2e8f0;border-radius:14px;padding:10px 6px;font:800 11px/1.2 -apple-system,Segoe UI,sans-serif}
      .studio-motion-grid button[aria-current="true"]{border-color:#818cf8;background:#312e81;color:#fff}
      @media (min-width:900px){#studio-context-toolbar{bottom:24px}}
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
    ui.sheet.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h4>' + title + '</h4><button type="button" id="studio-ctx-close" style="border:0;background:transparent;color:#fff;font-size:20px">✕</button></div>' + html;
    ui.sheet.classList.add('is-open');
    ui.sheet.querySelector('#studio-ctx-close').onclick = function () { ui.sheet.classList.remove('is-open'); };
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
    if (obj) {
      delete obj.__animationBase;
      if (type === 'none') {
        if (obj.msData) delete obj.msData.animation;
      } else {
        obj.msData = Object.assign({}, obj.msData || {}, { animation: { type: type, duration: duration || 1600 } });
      }
    }
    if (typeof adapter.startAnimationLoop === 'function') adapter.startAnimationLoop();
    if (typeof showToast === 'function') showToast(type === 'none' ? 'Animation removed' : type + ' animation playing', 'success');
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
    openSheet('Animate', '<div class="studio-motion-grid">' + grid + '</div><label>Speed<input type="range" min="400" max="4000" step="100" value="' + duration + '" oninput="studioApplyMotion(\'' + current + '\', Number(this.value))"></label><p style="font-size:11px;color:#94a3b8">Plays on the canvas and is included in animated exports.</p>');
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
    if (id === 'color') return openSheet('Color', '<label>Fill<input type="color" value="' + hexColor(obj) + '" oninput="studioSetObjectStyle(\'color\', this.value)"></label>');
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

  function applyExtraMotion(object, animation, time) {
    if (!animation || !animation.type) return;
    object.__animationBase = object.__animationBase || { left: object.left || 0, top: object.top || 0, angle: object.angle || 0, opacity: object.opacity == null ? 1 : object.opacity, scaleX: object.scaleX || 1, scaleY: object.scaleY || 1 };
    const base = object.__animationBase;
    const duration = Number(animation.duration || 1600);
    const phase = (time % duration) / duration;
    const wave = Math.sin(phase * Math.PI * 2);
    const type = animation.type;
    if (type === 'slide') object.set({ left: base.left + wave * 28 });
    else if (type === 'rise') object.set({ top: base.top - Math.max(0, wave) * 36, opacity: 0.55 + (wave + 1) * 0.22 });
    else if (type === 'shake') object.set({ left: base.left + Math.sin(phase * Math.PI * 8) * 10 });
    else if (type === 'wiggle') object.set({ angle: base.angle + Math.sin(phase * Math.PI * 6) * 8 });
    else if (type === 'pop') object.set({ scaleX: base.scaleX * (1 + Math.max(0, wave) * 0.12), scaleY: base.scaleY * (1 + Math.max(0, wave) * 0.12) });
  }

  function hookAnimations(adapter) {
    if (!adapter || adapter.__motionHooked || typeof adapter.startAnimationLoop !== 'function') return;
    const orig = adapter.startAnimationLoop.bind(adapter);
    adapter.startAnimationLoop = function () {
      orig();
      const canvas = adapter.fabricCanvas;
      if (!canvas || canvas.__msExtraMotion) return;
      canvas.__msExtraMotion = true;
      const tick = function (time) {
        (canvas.getObjects && canvas.getObjects() || []).forEach(function (object) {
          const animation = object.msData && object.msData.animation;
          if (animation && animation.type && ['slide','rise','shake','wiggle','pop'].indexOf(animation.type) >= 0) applyExtraMotion(object, animation, time);
        });
        canvas.requestRenderAll && canvas.requestRenderAll();
        canvas.__msExtraMotionFrame = requestAnimationFrame(tick);
      };
      canvas.__msExtraMotionFrame = requestAnimationFrame(tick);
    };
    adapter.__motionHooked = true;
    adapter.startAnimationLoop();
  }

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
    hookAnimations(adapter);
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
