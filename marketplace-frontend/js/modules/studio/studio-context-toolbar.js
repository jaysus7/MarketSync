/* Contextual element toolbar — populates when a canvas object is selected. */
(function (global) {
  'use strict';

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
      #studio-context-toolbar{
        position:absolute;left:50%;bottom:86px;transform:translateX(-50%);
        z-index:80;display:none;align-items:center;gap:2px;
        max-width:calc(100% - 16px);overflow-x:auto;
        padding:6px 8px;border-radius:22px;
        background:rgba(15,23,42,.94);color:#fff;
        box-shadow:0 12px 40px rgba(0,0,0,.35);
        backdrop-filter:blur(16px);
      }
      #studio-context-toolbar.is-open{display:flex}
      #studio-context-toolbar button{
        flex:0 0 auto;min-width:58px;border:0;background:transparent;color:#e2e8f0;
        padding:6px 8px;border-radius:14px;cursor:pointer;
        display:flex;flex-direction:column;align-items:center;gap:3px;
        font:700 10px/1.1 -apple-system,Segoe UI,sans-serif;
      }
      #studio-context-toolbar button .ico{font-size:16px;line-height:1}
      #studio-context-toolbar button[aria-pressed="true"],
      #studio-context-toolbar button:active{background:rgba(255,255,255,.12);color:#fff}
      #studio-context-quick{
        position:absolute;top:72px;right:12px;z-index:80;display:none;gap:6px;
        padding:6px;border-radius:18px;background:rgba(15,23,42,.92);color:#fff;
      }
      #studio-context-quick.is-open{display:flex}
      #studio-context-quick button{
        width:36px;height:36px;border:0;border-radius:12px;background:transparent;color:#fff;font-size:16px;cursor:pointer;
      }
      #studio-context-sheet{
        position:absolute;left:0;right:0;bottom:0;z-index:90;
        display:none;max-height:46%;overflow:auto;
        padding:14px 16px 24px;border-radius:22px 22px 0 0;
        background:#0f172a;color:#fff;
      }
      #studio-context-sheet.is-open{display:block}
      #studio-context-sheet h4{margin:0 0 10px;font:800 13px/1.2 -apple-system,Segoe UI,sans-serif}
      #studio-context-sheet label{display:block;font:700 11px/1.2 -apple-system,Segoe UI,sans-serif;color:#94a3b8;margin:8px 0}
      #studio-context-sheet input,#studio-context-sheet select{
        width:100%;margin-top:4px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#fff;padding:8px;
      }
      @media (min-width:900px){
        #studio-context-toolbar{bottom:24px}
      }
    `;
    document.head.appendChild(style);
  }

  function ensure() {
    const modal = document.getElementById('ms-studio-master-modal');
    if (!modal) return null;
    injectCss();
    let bar = document.getElementById('studio-context-toolbar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'studio-context-toolbar';
      modal.appendChild(bar);
    }
    let quick = document.getElementById('studio-context-quick');
    if (!quick) {
      quick = document.createElement('div');
      quick.id = 'studio-context-quick';
      modal.appendChild(quick);
    }
    let sheet = document.getElementById('studio-context-sheet');
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.id = 'studio-context-sheet';
      modal.appendChild(sheet);
    }
    return { bar: bar, quick: quick, sheet: sheet };
  }

  function tool(id, icon, label) {
    return '<button type="button" data-ctx-tool="' + id + '"><span class="ico">' + icon + '</span>' + label + '</button>';
  }

  function toolsFor(kind) {
    if (kind === 'text') {
      return tool('format','B≡','Format') + tool('type','T','Type') + tool('effects','▢','Effects') + tool('animate','○','Animate') + tool('opacity','◑','Transparency') + tool('layers','≡','Layers') + tool('position','⤢','Position') + tool('nudge','↔','Nudge');
    }
    if (kind === 'image') {
      return tool('edit','✎','Edit') + tool('color','◉','Color') + tool('opacity','◑','Transparency') + tool('effects','▢','Effects') + tool('position','⤢','Position') + tool('nudge','↔','Nudge') + tool('layers','≡','Layers');
    }
    return tool('shape','◇','Shape') + tool('edit','✎','Edit') + tool('color','◉','Color') + tool('style','≣','Style') + tool('corners','◢','Corners') + tool('format','B≡','Format') + tool('opacity','◑','Transparency') + tool('position','⤢','Position') + tool('nudge','↔','Nudge') + tool('layers','≡','Layers');
  }

  function hexColor(obj) {
    const fill = obj && (typeof obj.fill === 'string' ? obj.fill : '');
    const stroke = obj && (typeof obj.stroke === 'string' ? obj.stroke : '');
    const value = (fill && fill.charAt(0) === '#') ? fill : ((stroke && stroke.charAt(0) === '#') ? stroke : '#2563eb');
    return value;
  }

  function openSheet(title, html) {
    const ui = ensure();
    if (!ui) return;
    ui.sheet.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h4>' + title + '</h4><button type="button" id="studio-ctx-close" style="border:0;background:transparent;color:#fff;font-size:20px">✕</button></div>' + html;
    ui.sheet.classList.add('is-open');
    ui.sheet.querySelector('#studio-ctx-close').onclick = function () { ui.sheet.classList.remove('is-open'); };
  }

  function runTool(id) {
    const obj = active();
    if (!obj) return;
    const adapter = global.__studioAdapter;
    if (id === 'layers') {
      if (typeof global.setStudioTool === 'function') global.setStudioTool('layers');
      if (typeof global.openStudioMobilePanel === 'function') global.openStudioMobilePanel('tool');
      return;
    }
    if (id === 'color') {
      openSheet('Color', '<label>Fill<input type="color" value="' + hexColor(obj) + '" oninput="studioSetObjectStyle(\'color\', this.value)"></label>');
      return;
    }
    if (id === 'opacity') {
      const pct = Math.round((obj.opacity == null ? 1 : obj.opacity) * 100);
      openSheet('Transparency', '<label>Opacity<input type="range" min="0" max="100" value="' + pct + '" oninput="studioSetObjectStyle(\'opacity\', Number(this.value)/100)"></label>');
      return;
    }
    if (id === 'corners') {
      openSheet('Corners', '<label>Radius<input type="range" min="0" max="120" value="' + Math.round(obj.rx || 0) + '" oninput="studioSetObjectStyle(\'rx\', Number(this.value));studioSetObjectStyle(\'ry\', Number(this.value))"></label>');
      return;
    }
    if (id === 'style' || id === 'effects') {
      openSheet('Style', '<label>Shadow
        <select onchange="studioSetObjectStyle(\'shadow\', this.value===\'none\'?null:{color:\'rgba(0,0,0,.35)\',blur:this.value===\'glow\'?24:12,offsetY:this.value===\'lift\'?10:4})">
          <option value="none">None</option><option value="soft">Soft</option><option value="lift">Lift</option><option value="glow">Glow</option>
        </select></label>');
      return;
    }
    if (id === 'animate') {
      openSheet('Animate', '<label>Motion
        <select onchange="studioSetAnimation(this.value)">
          <option value="none">None</option><option value="fade">Fade</option><option value="float">Float</option><option value="pop">Pop</option>
        </select></label>');
      return;
    }
    if (id === 'position') {
      openSheet('Position', '<label>X<input type="number" value="' + Math.round(obj.left || 0) + '" onchange="studioSetObjectGeometry(\'left\', this.value)"></label>' +
        '<label>Y<input type="number" value="' + Math.round(obj.top || 0) + '" onchange="studioSetObjectGeometry(\'top\', this.value)"></label>' +
        '<label>Width<input type="number" value="' + Math.round((obj.getScaledWidth && obj.getScaledWidth()) || obj.width || 0) + '" onchange="studioSetObjectGeometry(\'width\', this.value)"></label>' +
        '<label>Height<input type="number" value="' + Math.round((obj.getScaledHeight && obj.getScaledHeight()) || obj.height || 0) + '" onchange="studioSetObjectGeometry(\'height\', this.value)"></label>' +
        '<label>Rotate<input type="number" value="' + Math.round(obj.angle || 0) + '" onchange="studioSetObjectGeometry(\'rotation\', this.value)"></label>');
      return;
    }
    if (id === 'nudge') {
      openSheet('Nudge', '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:180px;margin:12px auto">' +
        '<span></span><button type="button" onclick="studioSetObjectGeometry(\'top\',' + Math.round((obj.top || 0) - 8) + ')">↑</button><span></span>' +
        '<button type="button" onclick="studioSetObjectGeometry(\'left\',' + Math.round((obj.left || 0) - 8) + ')">←</button>' +
        '<button type="button" onclick="studioSetObjectGeometry(\'left\',' + Math.round((obj.left || 0) + 0) + ')">·</button>' +
        '<button type="button" onclick="studioSetObjectGeometry(\'left\',' + Math.round((obj.left || 0) + 8) + ')">→</button>' +
        '<span></span><button type="button" onclick="studioSetObjectGeometry(\'top\',' + Math.round((obj.top || 0) + 8) + ')">↓</button><span></span></div>');
      return;
    }
    if (id === 'format' || id === 'type' || id === 'edit' || id === 'shape') {
      const isText = kindOf(obj) === 'text';
      if (isText) {
        openSheet('Format', '<label>Font size<input type="number" value="' + Math.round(obj.fontSize || 24) + '" onchange="studioSetTextStyle(\'fontSize\', Number(this.value))"></label>' +
          '<label>Weight<select onchange="studioSetTextStyle(\'fontWeight\', this.value)"><option>400</option><option selected>700</option><option>900</option></select></label>' +
          '<label>Color<input type="color" value="' + hexColor(obj) + '" oninput="studioSetTextStyle(\'fill\', this.value)"></label>');
        return;
      }
      if (typeof global.setStudioInspectorTab === 'function') global.setStudioInspectorTab('style');
      if (typeof global.openStudioMobilePanel === 'function') global.openStudioMobilePanel('inspector');
      return;
    }
    if (typeof global.openStudioMobilePanel === 'function') global.openStudioMobilePanel('inspector');
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
      if (action === 'dup' && adapterDup()) return;
      if (action === 'del' && global.__studioAdapter && global.__studioAdapter.deleteSelected) global.__studioAdapter.deleteSelected();
    };
  }

  function adapterDup() {
    const adapter = global.__studioAdapter;
    if (adapter && typeof adapter.duplicateSelected === 'function') {
      adapter.duplicateSelected();
      return true;
    }
    return false;
  }

  function hookAdapter() {
    const adapter = global.__studioAdapter;
    if (!adapter || adapter.__ctxToolbarHooked) return;
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
  document.addEventListener('click', function () { hookAdapter(); });
})(window);
