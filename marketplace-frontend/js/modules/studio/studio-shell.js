/**
 * MarketSync Design Studio — Master Desktop UI Workspace
 *
 * Canva-style automotive visual design studio workspace rendering top bar, tool rail,
 * asset/inventory panels, freeform Fabric.js artboard viewport, property inspector,
 * and social publishing composer handoff.
 */

window.__studioAdapter = null;
window.__studioActiveTool = 'templates';
window.__studioCurrentDesign = null;
window.__studioCurrentVehicle = null;

function escS(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.openMarketSyncStudio = async function(designId = null, initialOptions = {}) {
  let modal = document.getElementById('ms-studio-master-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'ms-studio-master-modal';
    modal.className = 'fixed inset-0 z-[99999] bg-slate-950 text-white flex flex-col overflow-hidden font-sans';
    document.body.appendChild(modal);
  }

  // Load existing design or default blank scene
  let scene = window.msCreateDefaultScene(initialOptions.formatKey || 'square');
  let designName = 'Untitled Design';

  if (designId) {
    try {
      const res = await apiGetJson(`/marketing/studio/designs/${designId}`).catch(() => null);
      if (res?.design) {
        window.__studioCurrentDesign = res.design;
        scene = res.design.scene || scene;
        designName = res.design.name || designName;
      }
    } catch (e) { /* fallback */ }
  }

  modal.innerHTML = renderStudioWorkspaceHtml(designName, scene);
  initStudioAdapter(scene);
};

function renderStudioWorkspaceHtml(designName, scene) {
  return `
    <!-- Top Action Bar -->
    <header class="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between z-20 flex-shrink-0">
      <div class="flex items-center gap-3">
        <button onclick="closeMarketSyncStudio()" class="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5 text-xs font-bold">
          ← Back to Marketing
        </button>
        <div class="h-5 w-px bg-slate-800"></div>
        <img src="/logo.png" alt="MarketSync" class="h-6 w-auto">
        <input type="text" id="studio-design-name" value="${escS(designName)}" onchange="saveStudioDesignName(this.value)" class="bg-transparent text-sm font-black text-white focus:bg-slate-800 px-2 py-1 rounded-lg border border-transparent hover:border-slate-700 transition">
        <span id="studio-save-status" class="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">SAVED</span>
      </div>

      <div class="flex items-center gap-2">
        <button onclick="if(window.__studioAdapter) window.__studioAdapter.undo()" title="Undo" class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold">↩ Undo</button>
        <button onclick="if(window.__studioAdapter) window.__studioAdapter.redo()" title="Redo" class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold">↪ Redo</button>
        <div class="h-5 w-px bg-slate-800"></div>

        <select id="studio-format-picker" onchange="changeStudioFormat(this.value)" class="bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700">
          <option value="square" ${scene.format_key === 'square' ? 'selected' : ''}>Instagram / FB Square (1080×1080)</option>
          <option value="portrait" ${scene.format_key === 'portrait' ? 'selected' : ''}>Instagram Portrait (1080×1350)</option>
          <option value="story" ${scene.format_key === 'story' ? 'selected' : ''}>Story / Reel (1080×1920)</option>
          <option value="landscape" ${scene.format_key === 'landscape' ? 'selected' : ''}>Facebook Banner (1200×628)</option>
        </select>

        <button onclick="saveStudioDesign()" class="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition">
          💾 Save
        </button>
        <button onclick="renderStudioDesignAndPublish()" class="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-lg transition flex items-center gap-1.5">
          📢 Render &amp; Publish to Social
        </button>
      </div>
    </header>

    <!-- Main Workspace Body -->
    <div class="flex-1 flex overflow-hidden relative">
      <!-- Left Tool Rail -->
      <nav class="w-16 bg-slate-950 border-r border-slate-800 flex flex-col items-center py-3 gap-3 flex-shrink-0 z-10">
        <button onclick="setStudioTool('templates')" id="tool-btn-templates" class="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition ${window.__studioActiveTool==='templates'?'bg-indigo-600/30 text-indigo-400 border border-indigo-500/50':''}">
          <span class="text-base">📄</span>Templates
        </button>
        <button onclick="setStudioTool('inventory')" id="tool-btn-inventory" class="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition ${window.__studioActiveTool==='inventory'?'bg-indigo-600/30 text-indigo-400 border border-indigo-500/50':''}">
          <span class="text-base">🚗</span>Inventory
        </button>
        <button onclick="setStudioTool('photos')" id="tool-btn-photos" class="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition">
          <span class="text-base">📷</span>Photos
        </button>
        <button onclick="setStudioTool('shapes')" id="tool-btn-shapes" class="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition">
          <span class="text-base">🟩</span>Shapes
        </button>
        <button onclick="setStudioTool('text')" id="tool-btn-text" class="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition">
          <span class="text-base">T</span>Text
        </button>
        <button onclick="setStudioTool('brand')" id="tool-btn-brand" class="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition">
          <span class="text-base">🏷️</span>Brand
        </button>
      </nav>

      <!-- Left Tool Panel Drawer -->
      <aside class="w-80 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0 z-10 overflow-y-auto" id="studio-tool-panel">
        ${renderStudioToolPanelContent(window.__studioActiveTool)}
      </aside>

      <!-- Center Artboard Viewport Canvas -->
      <main class="flex-1 bg-slate-950 overflow-auto flex items-center justify-center p-8 relative">
        <div class="relative shadow-2xl rounded-xl overflow-hidden border border-slate-800 bg-slate-900" style="width:${scene.width}px; height:${scene.height}px;">
          <canvas id="studio-main-canvas"></canvas>
        </div>
      </main>

      <!-- Right Property Inspector & Layer Controls -->
      <aside class="w-72 bg-slate-900 border-l border-slate-800 flex flex-col flex-shrink-0 p-4 z-10 overflow-y-auto" id="studio-inspector-panel">
        ${renderStudioInspectorHtml(null)}
      </aside>
    </div>
  `;
}

function renderStudioToolPanelContent(tool) {
  if (tool === 'templates') {
    return `
      <div class="p-4 space-y-3">
        <h3 class="text-xs font-black uppercase tracking-wider text-slate-300">Automotive Templates</h3>
        <div class="space-y-2">
          <button onclick="loadStudioTemplate('tmpl_spotlight_square')" class="w-full text-left p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition">
            <div class="text-xs font-bold text-white">Vehicle Spotlight (Square)</div>
            <div class="text-[11px] text-slate-400">1080×1080 • Bound Inventory Template</div>
          </button>
          <button onclick="loadStudioTemplate('tmpl_pricedrop_story')" class="w-full text-left p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition">
            <div class="text-xs font-bold text-white">Price Drop Banner (Story)</div>
            <div class="text-[11px] text-slate-400">1080×1920 • Special Reductions</div>
          </button>
        </div>
      </div>
    `;
  } else if (tool === 'inventory') {
    return `
      <div class="p-4 space-y-3">
        <h3 class="text-xs font-black uppercase tracking-wider text-slate-300">Dealership Inventory</h3>
        <input type="text" placeholder="Search stock #, VIN, year make model..." oninput="searchStudioInventory(this.value)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white">
        <div class="space-y-2" id="studio-inventory-list">
          <button onclick="bindVehicleToStudio('demo_v1')" class="w-full text-left p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition flex items-center gap-3">
            <div class="w-12 h-12 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-lg">🚗</div>
            <div>
              <div class="text-xs font-bold text-white">2024 Ford F-150 Lariat</div>
              <div class="text-[11px] text-emerald-400 font-bold">$54,990 • STK #F9041</div>
            </div>
          </button>
        </div>
      </div>
    `;
  } else if (tool === 'photos') {
    return `
      <div class="p-4 space-y-3">
        <h3 class="text-xs font-black uppercase tracking-wider text-slate-300">Stock &amp; Free Asset Library</h3>
        <input type="text" placeholder="Search photos (e.g. showroom, luxury car)..." onkeydown="if(event.key==='Enter') searchStudioLibrary(this.value)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white">
        <div class="grid grid-cols-2 gap-2 pt-2" id="studio-photo-results">
          <img src="https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=400&q=80" onclick="addLibraryImageToCanvas(this.src)" class="w-full aspect-square object-cover rounded-xl border border-slate-800 cursor-pointer hover:border-indigo-500 transition">
          <img src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=400&q=80" onclick="addLibraryImageToCanvas(this.src)" class="w-full aspect-square object-cover rounded-xl border border-slate-800 cursor-pointer hover:border-indigo-500 transition">
        </div>
      </div>
    `;
  } else if (tool === 'shapes') {
    return `
      <div class="p-4 space-y-3">
        <h3 class="text-xs font-black uppercase tracking-wider text-slate-300">Shapes &amp; Badges</h3>
        <div class="grid grid-cols-2 gap-2">
          <button onclick="if(window.__studioAdapter) window.__studioAdapter.addShape('rect', '#2563EB')" class="p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-white text-center">
            🟩 Rectangle
          </button>
          <button onclick="if(window.__studioAdapter) window.__studioAdapter.addShape('circle', '#10B981')" class="p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-white text-center">
            🟢 Circle
          </button>
        </div>
      </div>
    `;
  } else if (tool === 'text') {
    return `
      <div class="p-4 space-y-3">
        <h3 class="text-xs font-black uppercase tracking-wider text-slate-300">Add Text</h3>
        <button onclick="if(window.__studioAdapter) window.__studioAdapter.addText('ADD HEADING', {fontSize:44, fontWeight:'900'})" class="w-full p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-black text-white text-left">
          Add Heading
        </button>
        <button onclick="if(window.__studioAdapter) window.__studioAdapter.addText('Add subheading details...', {fontSize:24, fontWeight:'600'})" class="w-full p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 text-left">
          Add Subheading
        </button>
      </div>
    `;
  } else if (tool === 'brand') {
    const storeName = window.__dealerConfig?.store_name || 'MarketSync Motors';
    return `
      <div class="p-4 space-y-3">
        <h3 class="text-xs font-black uppercase tracking-wider text-slate-300">Dealership Brand Kit</h3>
        <div class="p-3 rounded-xl bg-slate-800 border border-slate-700 space-y-2">
          <div class="text-xs font-bold text-white">${escS(storeName)}</div>
          <button onclick="if(window.__studioAdapter) window.__studioAdapter.addImage('/logo.png', 'MarketSync Logo')" class="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold">
            + Insert Dealership Logo
          </button>
        </div>
      </div>
    `;
  }
  return '';
}

function renderStudioInspectorHtml(selected) {
  return `
    <h3 class="text-xs font-black uppercase tracking-wider text-slate-300 mb-3">Property Inspector</h3>
    <div class="space-y-3">
      <div class="space-y-1">
        <label class="text-[11px] font-bold text-slate-400">Layer Order:</label>
        <div class="flex gap-2">
          <button onclick="if(window.__studioAdapter) window.__studioAdapter.bringForward()" class="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold">⬆ Bring Forward</button>
          <button onclick="if(window.__studioAdapter) window.__studioAdapter.sendBackwards()" class="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold">⬇ Send Back</button>
        </div>
      </div>
      <button onclick="if(window.__studioAdapter) window.__studioAdapter.deleteSelected()" class="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition">
        🗑️ Delete Object
      </button>
    </div>
  `;
}

async function initStudioAdapter(scene) {
  const canvasEl = document.getElementById('studio-main-canvas');
  if (!canvasEl) return;
  window.__studioAdapter = new StudioFabricAdapter(canvasEl, {
    onSelection: (selected) => {
      const panel = document.getElementById('studio-inspector-panel');
      if (panel) panel.innerHTML = renderStudioInspectorHtml(selected);
    },
    onStateChange: () => {
      const status = document.getElementById('studio-save-status');
      if (status) { status.textContent = 'UNSAVED'; status.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/40'; }
    }
  });

  await window.__studioAdapter.init(scene, window.__studioCurrentVehicle);
}

function setStudioTool(tool) {
  window.__studioActiveTool = tool;
  const panel = document.getElementById('studio-tool-panel');
  if (panel) panel.innerHTML = renderStudioToolPanelContent(tool);
}

async function saveStudioDesign() {
  if (!window.__studioAdapter) return;
  const scene = window.__studioAdapter.exportScene();
  const name = document.getElementById('studio-design-name')?.value || 'Untitled Design';

  const payload = {
    name,
    format_key: scene.format_key || 'square',
    width: scene.width,
    height: scene.height,
    scene,
    vehicle_id: window.__studioCurrentVehicle?.id || null
  };

  try {
    if (window.__studioCurrentDesign?.id) {
      await apiSendJson(`/marketing/studio/designs/${window.__studioCurrentDesign.id}`, 'PUT', payload);
    } else {
      const res = await apiSendJson('/marketing/studio/designs', 'POST', payload);
      if (res?.design) window.__studioCurrentDesign = res.design;
    }
    const status = document.getElementById('studio-save-status');
    if (status) { status.textContent = 'SAVED'; status.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'; }
    if (typeof showToast === 'function') showToast('Design saved', 'success');
  } catch (e) {
    if (typeof showToast === 'function') showToast('Save failed: ' + e.message, 'error');
  }
}

async function renderStudioDesignAndPublish() {
  if (!window.__studioAdapter) return;
  await saveStudioDesign();
  const scene = window.__studioAdapter.exportScene();

  try {
    const res = await apiSendJson('/marketing/studio/render', 'POST', {
      name: document.getElementById('studio-design-name')?.value || 'Studio Creative',
      scene
    });

    if (res?.asset?.public_url) {
      closeMarketSyncStudio();
      if (typeof window.mktCompose === 'function') {
        window.mktCompose({ assetUrl: res.asset.public_url });
      }
      if (typeof showToast === 'function') showToast('Design rendered and loaded into Social Composer!', 'success');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Render error: ' + e.message, 'error');
  }
}

function closeMarketSyncStudio() {
  document.getElementById('ms-studio-master-modal')?.remove();
}

window.openMarketSyncStudio = openMarketSyncStudio;
window.setStudioTool = setStudioTool;
window.saveStudioDesign = saveStudioDesign;
window.renderStudioDesignAndPublish = renderStudioDesignAndPublish;
window.closeMarketSyncStudio = closeMarketSyncStudio;
