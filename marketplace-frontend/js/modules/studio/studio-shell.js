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
window.__studioZoomLevel = 0.55;
window.__studioFitObserver = null;

const STUDIO_FREE_PHOTOS = [
  ['showroom', 'Modern dealership showroom', 'photo-1562141961-b5d64a7b61c0'],
  ['luxury car', 'Luxury car', 'photo-1503376780353-7e6692767b70'],
  ['sports car', 'Sports car on the road', 'photo-1549399542-7e3f8b79c341'],
  ['city drive', 'Car in the city', 'photo-1492144534655-ae79c964c9d7'],
  ['road travel', 'Open road', 'photo-1500530855697-b586d89ba3ee'],
  ['electric vehicle', 'Electric vehicle charging', 'photo-1592833159155-c62df1b65634'],
  ['car interior', 'Premium car interior', 'photo-1503736334956-4c8f8e92946d'],
  ['car keys', 'Car keys', 'photo-1525609004556-c46c7d6cf023'],
  ['handshake customer', 'Customer handshake', 'photo-1521791136064-7986c2920216'],
  ['team office', 'Team working together', 'photo-1522071820081-009f0129c71c'],
  ['phone social', 'Phone and social content', 'photo-1516321318423-f06f85e504b3'],
  ['service mechanic', 'Automotive service', 'photo-1487754180451-c456f719a1fc'],
  ['detail clean', 'Vehicle detailing', 'photo-1607860108855-64acf2078ed9'],
  ['mountain suv', 'SUV adventure', 'photo-1533473359331-0135ef1b58bf'],
  ['night city', 'Night city drive', 'photo-1511919884226-fd3cad34687c'],
  ['business owner', 'Business owner', 'photo-1560250097-0b93528c311a']
].map(([keywords, alt, id], index) => ({ id: index + 1, keywords, alt, url: `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=82` }));

const STUDIO_SOCIAL_FORMATS = {
  square: { label: 'Instagram / Facebook Square', w: 1080, h: 1080, safe: [6, 6, 6, 6], note: 'Keep important words inside' },
  portrait: { label: 'Instagram Portrait 4:5', w: 1080, h: 1350, safe: [7, 6, 12, 6], note: 'Feed and profile-safe text area', profileCrop: true },
  story: { label: 'Instagram Story / Reel', w: 1080, h: 1920, safe: [14, 15, 20, 6], note: 'Avoid profile name, caption and action buttons' },
  tiktok: { label: 'TikTok Vertical Video', w: 1080, h: 1920, safe: [12, 16, 22, 6], note: 'Avoid caption and right-side controls' },
  landscape: { label: 'Facebook Landscape', w: 1200, h: 630, safe: [6, 6, 8, 6], note: 'Visible across feed placements' },
  linkedin: { label: 'LinkedIn Page Post', w: 1200, h: 627, safe: [6, 6, 8, 6], note: 'LinkedIn 1.91:1 safe content area' },
  x_landscape: { label: 'X Landscape Post', w: 1600, h: 900, safe: [6, 6, 8, 6], note: 'Keep text away from crop edges' },
  youtube: { label: 'YouTube Thumbnail', w: 1280, h: 720, safe: [6, 6, 8, 6], note: 'Keep title and logo inside' },
  pinterest: { label: 'Pinterest Pin 2:3', w: 1000, h: 1500, safe: [7, 7, 10, 7], note: 'Pin-safe content area' }
};

function escS(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function zoomStudioIn() {
  window.__studioZoomLevel = Math.min(2.5, (window.__studioZoomLevel || 0.55) + 0.15);
  applyStudioZoom();
}

function zoomStudioOut() {
  window.__studioZoomLevel = Math.max(0.2, (window.__studioZoomLevel || 0.55) - 0.15);
  applyStudioZoom();
}

function zoomStudioFit() {
  const mainEl = document.getElementById('studio-canvas-viewport');
  if (!mainEl) return;
  const availW = Math.max(120, mainEl.clientWidth - 32);
  const availH = Math.max(120, mainEl.clientHeight - 32);
  const canvasW = window.__studioAdapter?.currentScene?.width || 1080;
  const canvasH = window.__studioAdapter?.currentScene?.height || 1080;
  const scaleW = availW / canvasW;
  const scaleH = availH / canvasH;
  window.__studioZoomLevel = Math.max(0.08, Math.min(1.25, Math.min(scaleW, scaleH)));
  applyStudioZoom();
}

function applyStudioZoom() {
  const container = document.getElementById('studio-artboard-container');
  const display = document.getElementById('studio-zoom-display');
  if (container) {
    container.style.transform = `translate(-50%, -50%) scale(${window.__studioZoomLevel || 0.55})`;
  }
  if (display) {
    display.textContent = `${Math.round((window.__studioZoomLevel || 0.55) * 100)}%`;
  }
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
  window.__studioFitObserver?.disconnect();
  const viewport = document.getElementById('studio-canvas-viewport');
  if (viewport && window.ResizeObserver) {
    window.__studioFitObserver = new ResizeObserver(() => requestAnimationFrame(zoomStudioFit));
    window.__studioFitObserver.observe(viewport);
  }
  setTimeout(zoomStudioFit, 100);
};

function studioHasPaidAi() {
  return !!(window.__access?.isPlatformStaff || (typeof __aiBoostActive !== 'undefined' && __aiBoostActive === true));
}

function renderStudioPhotoResults(photos) {
  return photos.map(photo => `<button type="button" onclick="addLibraryImageToCanvas('${photo.url}')" class="relative group overflow-hidden rounded-xl border border-slate-800 hover:border-blue-500 transition" title="${escS(photo.alt)}"><img src="${photo.url}" alt="${escS(photo.alt)}" loading="lazy" class="w-full aspect-square object-cover group-hover:scale-105 transition duration-200"><span class="absolute inset-x-0 bottom-0 px-2 py-1 bg-slate-950/80 text-[9px] text-left text-white truncate">${escS(photo.alt)}</span></button>`).join('');
}

function renderPexelsResults(photos) {
  return photos.map(photo => `<div class="rounded-xl overflow-hidden border border-slate-800 bg-slate-950"><button type="button" onclick="addLibraryImageToCanvas('${escS(photo.source_url)}', '${escS(photo.alt || 'Pexels photo')}')" class="block w-full group"><img src="${escS(photo.preview_url)}" alt="${escS(photo.alt || '')}" loading="lazy" class="w-full aspect-square object-cover group-hover:scale-105 transition duration-200"></button><div class="px-2 py-1.5 text-[9px] truncate"><a href="${escS(photo.author_url || photo.attribution_url || 'https://www.pexels.com')}" target="_blank" rel="noopener" class="text-sky-400 hover:underline">${escS(photo.author || 'Pexels photographer')}</a></div></div>`).join('');
}

function renderStudioVideoResults(videos, uploaded = false) {
  return videos.map(video => `<div class="rounded-xl overflow-hidden border border-slate-800 bg-slate-950"><video src="${escS(video.source_url || video.public_url)}" poster="${escS(video.preview_url || '')}" muted loop playsinline controls preload="metadata" class="w-full aspect-video object-cover bg-black"></video><div class="p-2"><div class="flex items-center justify-between gap-2"><a href="${escS(video.author_url || video.attribution_url || '#')}" target="_blank" rel="noopener" class="min-w-0 truncate text-[9px] text-sky-400 hover:underline">${escS(uploaded ? (video.title || 'Your video') : (video.author || 'Pexels creator'))}</a>${video.duration ? `<span class="text-[9px] text-slate-500">${Number(video.duration)}s</span>` : ''}</div><button onclick="addLibraryVideoToCanvas('${escS(video.source_url || video.public_url)}', '${escS(video.title || video.alt || 'Video')}')" class="mt-2 w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-[10px] font-black">Add video to canvas</button></div></div>`).join('');
}

function renderStudioWorkspaceHtml(designName, scene) {
  return `
    <!-- Top Action Bar -->
    <header class="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between z-20 flex-shrink-0">
      <div class="flex items-center gap-3">
        <button onclick="closeMarketSyncStudio()" class="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5 text-xs font-bold">
          ${typeof isDesignStudioOnlyWorkspace === 'function' && isDesignStudioOnlyWorkspace() ? '← Settings' : '← Back to Marketing'}
        </button>
        <div class="h-5 w-px bg-slate-800"></div>
        <img src="/Logo 2.0.png" alt="MarketSync" class="h-8 w-auto dark:hidden">
        <img src="/Logo 2.1.png" alt="MarketSync" class="h-8 w-auto hidden dark:block">
        <span class="px-2 py-0.5 rounded-lg text-[11px] font-black bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 tracking-wide uppercase">Design Studio</span>
        <input type="text" id="studio-design-name" value="${escS(designName)}" onchange="saveStudioDesignName(this.value)" class="bg-transparent text-sm font-black text-white focus:bg-slate-800 px-2 py-1 rounded-lg border border-transparent hover:border-slate-700 transition">
        <span id="studio-save-status" class="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">SAVED</span>
      </div>

      <div class="flex items-center gap-2">
        <!-- Zoom Controls -->
        <div class="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700">
          <button onclick="zoomStudioOut()" title="Zoom Out" class="px-2.5 py-1 rounded-lg hover:bg-slate-700 text-xs font-black text-slate-300 hover:text-white transition">-</button>
          <span id="studio-zoom-display" class="px-2 text-xs font-mono font-bold text-sky-400">55%</span>
          <button onclick="zoomStudioIn()" title="Zoom In" class="px-2.5 py-1 rounded-lg hover:bg-slate-700 text-xs font-black text-slate-300 hover:text-white transition">+</button>
          <button onclick="zoomStudioFit()" title="Fit to Screen" class="px-2.5 py-1 ml-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-[11px] font-bold text-white transition">Fit</button>
        </div>
        <button id="studio-guides-toggle" onclick="toggleStudioGuides()" class="px-3 py-1.5 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-300 text-xs font-bold">Guides on</button>

        <div class="h-5 w-px bg-slate-800"></div>

        <button onclick="if(window.__studioAdapter) window.__studioAdapter.undo()" title="Undo" class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6-6m-6 6l6 6"/></svg>Undo</button>
        <button onclick="if(window.__studioAdapter) window.__studioAdapter.redo()" title="Redo" class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 10H11a8 8 0 00-8 8v2m18-10l-6-6m6 6l-6 6"/></svg>Redo</button>
        <div class="h-5 w-px bg-slate-800"></div>

        <select id="studio-format-picker" onchange="changeStudioFormat(this.value)" class="bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700">
          ${Object.entries(STUDIO_SOCIAL_FORMATS).map(([key, format]) => `<option value="${key}" ${scene.format_key === key ? 'selected' : ''}>${format.label} (${format.w}×${format.h})</option>`).join('')}
        </select>

        <button onclick="saveStudioDesign()" class="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-slate-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>Save
        </button>
        <button onclick="renderStudioDesignAndPublish()" class="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-lg transition flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.684A1.85 1.85 0 014.28 11.5c0-.853.585-1.572 1.4-1.782m0 0A3.001 3.001 0 0111 8.5h6.25a2.25 2.25 0 012.25 2.25v2.25a2.25 2.25 0 01-2.25 2.25H11a3 3 0 01-5.564-1.566z"/></svg>Render &amp; Publish to Social
        </button>
      </div>
    </header>

    <!-- Main Workspace Body -->
    <div class="flex-1 flex overflow-hidden relative">
      <!-- Left Tool Rail -->
      <nav class="w-16 bg-slate-950 border-r border-slate-800 flex flex-col items-center py-3 gap-3 flex-shrink-0 z-10">
        <button onclick="setStudioTool('templates')" id="tool-btn-templates" class="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition ${window.__studioActiveTool==='templates'?'bg-indigo-600/30 text-indigo-400 border border-indigo-500/50':''}">
          <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>Templates
        </button>
        <button onclick="setStudioTool('inventory')" id="tool-btn-inventory" class="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition ${window.__studioActiveTool==='inventory'?'bg-indigo-600/30 text-indigo-400 border border-indigo-500/50':''}">
          <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 17a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4zM4 9h16l-1.5 5H5.5L4 9z"/></svg>Inventory
        </button>
        <button onclick="setStudioTool('photos')" id="tool-btn-photos" class="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition">
          <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>Photos
        </button>
        <button onclick="setStudioTool('videos')" id="tool-btn-videos" class="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition"><span class="text-base">▶</span>Videos</button>
        <button onclick="setStudioTool('uploads')" id="tool-btn-uploads" class="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition"><span class="text-base">↑</span>Uploads</button>
        <button onclick="setStudioTool('shapes')" id="tool-btn-shapes" class="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition">
          <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"/></svg>Shapes
        </button>
        <button onclick="setStudioTool('ai')" id="tool-btn-ai" class="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold ${studioHasPaidAi() ? 'text-sky-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-900'} transition">
          <span class="text-base">✦</span>${studioHasPaidAi() ? 'AI' : 'AI 🔒'}
        </button>
        <button onclick="setStudioTool('brand')" id="tool-btn-brand" class="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition">
          <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 7h10M7 12h10m-7 5h7"/></svg>Brand
        </button>
      </nav>

      <!-- Left Tool Panel Drawer -->
      <aside class="w-60 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0 z-10 overflow-y-auto transition-all duration-200" id="studio-tool-panel">
        <div class="flex items-center justify-between p-2.5 border-b border-slate-800 bg-slate-950/50">
          <span class="text-[11px] font-black uppercase tracking-wider text-slate-400">Tool Drawer</span>
          <button type="button" onclick="toggleStudioToolPanel()" class="text-slate-400 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded hover:bg-slate-800" title="Collapse Tool Panel">&lt;</button>
        </div>
        ${renderStudioToolPanelContent(window.__studioActiveTool)}
      </aside>

      <!-- Center Artboard Viewport Canvas -->
      <main id="studio-canvas-viewport" class="flex-1 min-w-0 bg-slate-950 overflow-hidden relative">
        <div id="studio-artboard-container" class="absolute left-1/2 top-1/2 shadow-2xl rounded-2xl overflow-hidden border-4 border-blue-500/70 bg-slate-900 ring-4 ring-blue-500/20 transition-transform duration-200 origin-center" style="width:${scene.width}px; height:${scene.height}px; transform:translate(-50%, -50%) scale(0.55);">
          <canvas id="studio-main-canvas"></canvas>
          ${renderStudioSafeGuides(scene.format_key || 'square')}
        </div>
      </main>

      <!-- Right Property Inspector & Layer Controls -->
      <aside class="w-60 bg-slate-900 border-l border-slate-800 flex flex-col flex-shrink-0 p-3 z-10 overflow-y-auto transition-all duration-200" id="studio-inspector-panel">
        <div class="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-800">
          <span class="text-[11px] font-black uppercase tracking-wider text-slate-400">Inspector</span>
          <button type="button" onclick="toggleStudioInspectorPanel()" class="text-slate-400 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded hover:bg-slate-800" title="Collapse Inspector">&gt;</button>
        </div>
        ${renderStudioInspectorHtml(null)}
      </aside>
    </div>
    <footer class="h-16 flex-shrink-0 bg-slate-900 border-t border-slate-800 px-3 flex items-center gap-2 overflow-x-auto z-30">
      <span class="text-[11px] font-black uppercase tracking-wider text-slate-400 mr-1">Text</span>
      <button onclick="studioAddText('heading')" class="whitespace-nowrap px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-black">+ Heading</button>
      <button onclick="studioAddText('subheading')" class="whitespace-nowrap px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold">+ Subheading</button>
      <button onclick="studioAddText('body')" class="whitespace-nowrap px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium">+ Body text</button>
      <div class="h-7 w-px bg-slate-700 mx-1"></div>
      <label class="text-[11px] text-slate-400 font-bold">Size</label>
      <select onchange="studioSetTextStyle('fontSize', Number(this.value))" class="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs"><option>18</option><option>24</option><option selected>36</option><option>48</option><option>64</option><option>88</option></select>
      <button onclick="studioSetTextStyle('fontWeight', '900')" class="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 font-black">B</button>
      <label class="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-800 text-xs font-bold">Colour <input type="color" value="#ffffff" onchange="studioSetTextStyle('fill', this.value)" class="w-6 h-6 rounded cursor-pointer bg-transparent"></label>
      <span id="studio-text-hint" class="ml-auto whitespace-nowrap text-[11px] text-slate-500">Select text to format it</span>
    </footer>
  `;
}

const STUDIO_TEMPLATES_CATALOG = {
  tmpl_spotlight_square: {
    template_key: 'tmpl_spotlight_square',
    name: 'Vehicle Spotlight (Square)',
    desc: '1080×1080 • Bound Inventory Template',
    format_key: 'square',
    width: 1080,
    height: 1080,
    scene: {
      version: 1,
      format_key: 'square',
      width: 1080,
      height: 1080,
      background: { color: '#0F172A' },
      elements: [
        { id: 'el-bg-photo', type: 'vehicle-image', x: 0, y: 0, width: 1080, height: 720, fit: 'cover', opacity: 1, z: 1, name: 'Vehicle Photo' },
        { id: 'el-grad-overlay', type: 'shape', shapeType: 'rect', x: 0, y: 580, width: 1080, height: 500, fill: '#0F172A', opacity: 0.95, z: 2, name: 'Bottom Panel' },
        { id: 'el-badge', type: 'shape', shapeType: 'rect', x: 50, y: 50, width: 220, height: 50, fill: '#4F46E5', rx: 12, opacity: 1, z: 3, name: 'Badge Pill' },
        { id: 'el-badge-txt', type: 'text', x: 75, y: 65, text: 'JUST ARRIVED', fontSize: 18, fontWeight: '800', fill: '#FFFFFF', z: 4, name: 'Badge Text' },
        { id: 'el-title', type: 'text', x: 50, y: 630, text: '{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}', fontSize: 44, fontWeight: '900', fill: '#F8FAFC', z: 5, name: 'Vehicle Name' },
        { id: 'el-trim', type: 'text', x: 50, y: 695, text: '{{vehicle.trim}} • Stock #{{vehicle.stock_number}}', fontSize: 24, fontWeight: '600', fill: '#94A3B8', z: 6, name: 'Trim & Stock' },
        { id: 'el-price-bg', type: 'shape', shapeType: 'rect', x: 50, y: 760, width: 340, height: 70, fill: '#10B981', rx: 16, opacity: 1, z: 7, name: 'Price Badge' },
        { id: 'el-price-txt', type: 'text', x: 80, y: 780, text: '{{vehicle.price}}', fontSize: 32, fontWeight: '900', fill: '#FFFFFF', z: 8, name: 'Price Text' },
        { id: 'el-cta-btn', type: 'shape', shapeType: 'rect', x: 50, y: 900, width: 980, height: 90, fill: '#2563EB', rx: 20, opacity: 1, z: 9, name: 'CTA Button' },
        { id: 'el-cta-txt', type: 'text', x: 380, y: 930, text: 'SCHEDULE TEST DRIVE', fontSize: 24, fontWeight: '800', fill: '#FFFFFF', z: 10, name: 'CTA Text' }
      ]
    }
  },
  tmpl_pricedrop_story: {
    template_key: 'tmpl_pricedrop_story',
    name: 'Price Drop Banner (Story)',
    desc: '1080×1920 • Special Reductions',
    format_key: 'story',
    width: 1080,
    height: 1920,
    scene: {
      version: 1,
      format_key: 'story',
      width: 1080,
      height: 1920,
      background: { color: '#18181B' },
      elements: [
        { id: 'el-photo', type: 'vehicle-image', x: 0, y: 200, width: 1080, height: 1100, fit: 'cover', opacity: 1, z: 1, name: 'Vehicle Photo' },
        { id: 'el-top-banner', type: 'shape', shapeType: 'rect', x: 0, y: 0, width: 1080, height: 200, fill: '#EF4444', opacity: 1, z: 2, name: 'Price Reduction Banner' },
        { id: 'el-top-txt', type: 'text', x: 320, y: 75, text: 'PRICE REDUCED!', fontSize: 44, fontWeight: '900', fill: '#FFFFFF', z: 3, name: 'Banner Text' },
        { id: 'el-card', type: 'shape', shapeType: 'rect', x: 50, y: 1350, width: 980, height: 480, fill: '#27272A', rx: 32, opacity: 0.95, z: 4, name: 'Card Background' },
        { id: 'el-ymmt', type: 'text', x: 100, y: 1410, text: '{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}', fontSize: 48, fontWeight: '900', fill: '#FFFFFF', z: 5, name: 'Vehicle Title' },
        { id: 'el-miles', type: 'text', x: 100, y: 1480, text: 'Mileage: {{vehicle.mileage}} miles', fontSize: 24, fontWeight: '600', fill: '#A1A1AA', z: 6, name: 'Mileage' },
        { id: 'el-price', type: 'text', x: 100, y: 1560, text: 'NOW ONLY: {{vehicle.price}}', fontSize: 40, fontWeight: '900', fill: '#34D399', z: 7, name: 'Special Price' },
        { id: 'el-store', type: 'text', x: 100, y: 1720, text: '{{dealership.name}} • {{dealership.phone}}', fontSize: 22, fontWeight: '700', fill: '#E4E4E7', z: 8, name: 'Store Contact' }
      ]
    }
  },
  tmpl_weekend_landscape: {
    template_key: 'tmpl_weekend_landscape',
    name: 'Weekend Sales Event (Landscape)',
    desc: '1200×628 • Facebook & LinkedIn Ad',
    format_key: 'landscape',
    width: 1200,
    height: 628,
    scene: {
      version: 1,
      format_key: 'landscape',
      width: 1200,
      height: 628,
      background: { color: '#0B0F19' },
      elements: [
        { id: 'el-photo', type: 'vehicle-image', x: 0, y: 0, width: 620, height: 628, fit: 'cover', opacity: 1, z: 1, name: 'Vehicle Photo' },
        { id: 'el-card', type: 'shape', shapeType: 'rect', x: 600, y: 0, width: 600, height: 628, fill: '#1E293B', opacity: 1, z: 2, name: 'Right Copy Panel' },
        { id: 'el-badge', type: 'text', x: 650, y: 60, text: 'WEEKEND SPECIAL', fontSize: 20, fontWeight: '800', fill: '#F59E0B', z: 3, name: 'Badge' },
        { id: 'el-title', type: 'text', x: 650, y: 110, text: '{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}', fontSize: 36, fontWeight: '900', fill: '#FFFFFF', z: 4, name: 'Vehicle Name' },
        { id: 'el-offer', type: 'text', x: 650, y: 220, text: '0% APR FOR 60 MONTHS AVAILABLE', fontSize: 22, fontWeight: '700', fill: '#94A3B8', z: 5, name: 'Offer Text' },
        { id: 'el-price', type: 'text', x: 650, y: 300, text: 'PRICE: {{vehicle.price}}', fontSize: 38, fontWeight: '900', fill: '#10B981', z: 6, name: 'Price Text' },
        { id: 'el-cta-btn', type: 'shape', shapeType: 'rect', x: 650, y: 440, width: 480, height: 75, fill: '#2563EB', rx: 16, opacity: 1, z: 7, name: 'CTA Button' },
        { id: 'el-cta-txt', type: 'text', x: 790, y: 465, text: 'CLAIM THIS OFFER', fontSize: 22, fontWeight: '800', fill: '#FFFFFF', z: 8, name: 'CTA Text' }
      ]
    }
  },
  tmpl_cpo_portrait: {
    template_key: 'tmpl_cpo_portrait',
    name: 'Certified Pre-Owned (Portrait)',
    desc: '1080×1350 • Instagram Post',
    format_key: 'portrait',
    width: 1080,
    height: 1350,
    scene: {
      version: 1,
      format_key: 'portrait',
      width: 1080,
      height: 1350,
      background: { color: '#0F172A' },
      elements: [
        { id: 'el-top-pill', type: 'shape', shapeType: 'rect', x: 50, y: 40, width: 340, height: 50, fill: '#D97706', rx: 12, opacity: 1, z: 1, name: 'CPO Pill' },
        { id: 'el-top-txt', type: 'text', x: 80, y: 55, text: 'CERTIFIED PRE-OWNED', fontSize: 18, fontWeight: '800', fill: '#FFFFFF', z: 2, name: 'CPO Text' },
        { id: 'el-photo', type: 'vehicle-image', x: 0, y: 120, width: 1080, height: 780, fit: 'cover', opacity: 1, z: 3, name: 'Vehicle Photo' },
        { id: 'el-card', type: 'shape', shapeType: 'rect', x: 40, y: 920, width: 1000, height: 380, fill: '#1E293B', rx: 24, opacity: 0.95, z: 4, name: 'Bottom Details Card' },
        { id: 'el-ymmt', type: 'text', x: 80, y: 970, text: '{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}', fontSize: 42, fontWeight: '900', fill: '#FFFFFF', z: 5, name: 'Title' },
        { id: 'el-insp', type: 'text', x: 80, y: 1040, text: '172-Point Inspection Passed • Low Mileage', fontSize: 22, fontWeight: '600', fill: '#94A3B8', z: 6, name: 'Inspection' },
        { id: 'el-price', type: 'text', x: 80, y: 1120, text: '{{vehicle.price}} • 12-Month Warranty Included', fontSize: 28, fontWeight: '800', fill: '#34D399', z: 7, name: 'Price & Warranty' },
        { id: 'el-phone', type: 'text', x: 80, y: 1210, text: 'Call Us Today: {{dealership.phone}}', fontSize: 22, fontWeight: '700', fill: '#38BDF8', z: 8, name: 'Phone' }
      ]
    }
  },
  tmpl_trade_square: {
    template_key: 'tmpl_trade_square',
    name: 'Trade-In Valuation Bonus (Square)',
    desc: '1080×1080 • Top Market Appraisal',
    format_key: 'square',
    width: 1080,
    height: 1080,
    scene: {
      version: 1,
      format_key: 'square',
      width: 1080,
      height: 1080,
      background: { color: '#064E3B' },
      elements: [
        { id: 'el-hdr', type: 'text', x: 60, y: 80, text: 'TOP MARKET TRADE VALUE', fontSize: 44, fontWeight: '900', fill: '#FFFFFF', z: 1, name: 'Header' },
        { id: 'el-sub', type: 'text', x: 60, y: 150, text: 'We Need Used Inventory — Get Up to 120% KBB Value!', fontSize: 26, fontWeight: '700', fill: '#A7F3D0', z: 2, name: 'Subtitle' },
        { id: 'el-photo', type: 'vehicle-image', x: 60, y: 220, width: 960, height: 560, fit: 'cover', opacity: 1, z: 3, name: 'Vehicle Photo' },
        { id: 'el-btn', type: 'shape', shapeType: 'rect', x: 60, y: 840, width: 960, height: 160, fill: '#10B981', rx: 24, opacity: 1, z: 4, name: 'CTA Card' },
        { id: 'el-btn-txt', type: 'text', x: 180, y: 900, text: 'VALUE YOUR TRADE IN 60 SECONDS', fontSize: 32, fontWeight: '900', fill: '#FFFFFF', z: 5, name: 'CTA Text' }
      ]
    }
  },
  tmpl_ev_story: {
    template_key: 'tmpl_ev_story',
    name: 'Electric & Hybrid Showcase (Story)',
    desc: '1080×1920 • EV & Clean Energy Ads',
    format_key: 'story',
    width: 1080,
    height: 1920,
    scene: {
      version: 1,
      format_key: 'story',
      width: 1080,
      height: 1920,
      background: { color: '#0284C7' },
      elements: [
        { id: 'el-badge', type: 'shape', shapeType: 'rect', x: 60, y: 60, width: 360, height: 60, fill: '#06B6D4', rx: 16, opacity: 1, z: 1, name: 'EV Badge' },
        { id: 'el-badge-txt', type: 'text', x: 90, y: 78, text: 'NEXT-GEN ELECTRIC', fontSize: 22, fontWeight: '900', fill: '#FFFFFF', z: 2, name: 'EV Text' },
        { id: 'el-photo', type: 'vehicle-image', x: 0, y: 160, width: 1080, height: 1100, fit: 'cover', opacity: 1, z: 3, name: 'Vehicle Photo' },
        { id: 'el-card', type: 'shape', shapeType: 'rect', x: 50, y: 1300, width: 980, height: 520, fill: '#0F172A', rx: 32, opacity: 0.95, z: 4, name: 'Card' },
        { id: 'el-title', type: 'text', x: 100, y: 1360, text: '{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}', fontSize: 44, fontWeight: '900', fill: '#FFFFFF', z: 5, name: 'Title' },
        { id: 'el-rebate', type: 'text', x: 100, y: 1430, text: 'Federal & State Rebates Up to $7,500 Available', fontSize: 24, fontWeight: '700', fill: '#38BDF8', z: 6, name: 'Rebate' },
        { id: 'el-price', type: 'text', x: 100, y: 1510, text: 'NET PRICE: {{vehicle.price}}', fontSize: 40, fontWeight: '900', fill: '#34D399', z: 7, name: 'Price' },
        { id: 'el-btn', type: 'shape', shapeType: 'rect', x: 100, y: 1620, width: 880, height: 100, fill: '#06B6D4', rx: 20, opacity: 1, z: 8, name: 'Button' },
        { id: 'el-btn-txt', type: 'text', x: 340, y: 1655, text: 'EXPLORE EV OFFERS', fontSize: 26, fontWeight: '800', fill: '#FFFFFF', z: 9, name: 'Button Text' }
      ]
    }
  }
};

Object.entries(STUDIO_SOCIAL_FORMATS).forEach(([formatKey, format], index) => {
  const portrait = format.h > format.w;
  const pad = Math.round(format.w * 0.07);
  const headlineY = Math.round(format.h * (portrait ? 0.62 : 0.48));
  const ctaY = Math.round(format.h * (1 - format.safe[2] / 100 - 0.09));
  const key = `social_ready_${formatKey}`;
  STUDIO_TEMPLATES_CATALOG[key] = {
    template_key: key, name: `${format.label} — Ready Layout`,
    desc: `${format.w}×${format.h} • Gradient campaign template`, format_key: formatKey,
    width: format.w, height: format.h,
    preview: index % 3 === 0 ? 'linear-gradient(135deg,#0f172a,#2563eb)' : index % 3 === 1 ? 'linear-gradient(135deg,#172554,#06b6d4)' : 'linear-gradient(135deg,#111827,#7c3aed)',
    scene: { version: 1, format_key: formatKey, width: format.w, height: format.h, background: { color: '#0F172A' }, elements: [
      { id: `${key}-bg`, type: 'shape', shapeType: 'rect', x: 0, y: 0, width: format.w, height: format.h, fill: '#0F172A', gradient: { colors: index % 3 === 0 ? ['#0F172A','#2563EB'] : index % 3 === 1 ? ['#172554','#06B6D4'] : ['#111827','#7C3AED'] }, name: 'Background Gradient', z: 1 },
      { id: `${key}-orb`, type: 'shape', shapeType: 'circle', x: Math.round(format.w * .68), y: Math.round(format.h * .08), width: Math.round(format.w * .42), height: Math.round(format.w * .42), fill: '#60A5FA', opacity: .22, name: 'Accent Shape', z: 2 },
      { id: `${key}-tag`, type: 'shape', shapeType: 'badge', x: pad, y: Math.round(format.h * .1), width: Math.round(format.w * .34), height: Math.round(format.h * .055), fill: '#FFFFFF', opacity: .18, rx: 28, name: 'Campaign Tag', z: 3 },
      { id: `${key}-tagtext`, type: 'text', x: pad + 24, y: Math.round(format.h * .115), width: Math.round(format.w * .3), text: 'MARKETSYNC MOTORS', fontSize: Math.max(18, Math.round(format.w * .018)), fontWeight: '800', fill: '#FFFFFF', name: 'Brand Label', z: 4 },
      { id: `${key}-title`, type: 'text', x: pad, y: headlineY, width: Math.round(format.w * .82), text: 'YOUR BIG CAMPAIGN HEADLINE', fontSize: Math.max(38, Math.round(format.w * (portrait ? .065 : .06))), fontWeight: '900', fill: '#FFFFFF', name: 'Headline', z: 5 },
      { id: `${key}-sub`, type: 'text', x: pad, y: headlineY + Math.round(format.h * .1), width: Math.round(format.w * .72), text: 'Add the supporting message customers need to take action.', fontSize: Math.max(22, Math.round(format.w * .028)), fontWeight: '600', fill: '#DBEAFE', name: 'Supporting Text', z: 6 },
      { id: `${key}-cta`, type: 'shape', shapeType: 'badge', x: pad, y: ctaY, width: Math.round(format.w * .42), height: Math.round(format.h * .075), fill: '#FFFFFF', rx: 24, name: 'CTA Button', z: 7 },
      { id: `${key}-ctatxt`, type: 'text', x: pad + 32, y: ctaY + Math.round(format.h * .02), width: Math.round(format.w * .35), text: 'LEARN MORE →', fontSize: Math.max(20, Math.round(format.w * .025)), fontWeight: '900', fill: '#1D4ED8', name: 'CTA Text', z: 8 }
    ] }
  };
});

function renderStudioSafeGuides(formatKey) {
  const format = STUDIO_SOCIAL_FORMATS[formatKey] || STUDIO_SOCIAL_FORMATS.square;
  const [top, right, bottom, left] = format.safe;
  const profileGuide = format.profileCrop ? `<div style="position:absolute;left:8%;right:8%;top:10%;aspect-ratio:1/1;border:2px dotted rgba(147,197,253,.9);border-radius:18px"><span style="position:absolute;right:8px;bottom:8px;background:rgba(15,23,42,.82);color:#bfdbfe;padding:5px 9px;border-radius:8px;font:700 18px/1 Arial">Profile preview</span></div>` : '';
  return `<div id="studio-safe-guides" class="absolute inset-0 pointer-events-none z-20"><div style="position:absolute;top:${top}%;right:${right}%;bottom:${bottom}%;left:${left}%;border:3px dashed rgba(96,165,250,.95);border-radius:18px;box-shadow:0 0 0 9999px rgba(15,23,42,.08)"><span style="position:absolute;left:10px;top:10px;background:rgba(15,23,42,.86);color:#dbeafe;padding:6px 10px;border-radius:8px;font:800 18px/1 Arial;letter-spacing:.04em">SAFE AREA · ${format.note}</span></div>${profileGuide}</div>`;
}

function renderStudioTemplateCards(filter = 'all') {
  return Object.values(STUDIO_TEMPLATES_CATALOG).filter(t => filter === 'all' || t.format_key === filter).map(t => {
    const preview = t.preview || 'linear-gradient(135deg,#0f172a,#2563eb 58%,#38bdf8)';
    const format = STUDIO_SOCIAL_FORMATS[t.format_key];
    return `<button onclick="loadStudioTemplate('${t.template_key}')" class="w-full text-left rounded-2xl overflow-hidden bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-500 transition group"><div style="height:104px;background:${preview}" class="relative p-3"><span class="absolute left-2 top-2 px-2 py-1 rounded-lg bg-slate-950/75 text-[9px] font-black text-blue-200">${format ? `${format.w}×${format.h}` : 'READY'}</span><div class="absolute left-3 right-3 bottom-3 text-white font-black text-sm leading-tight drop-shadow">YOUR CAMPAIGN<br><span class="text-blue-200">STARTS HERE</span></div></div><div class="p-3"><div class="text-xs font-black text-white group-hover:text-blue-300">${t.name}</div><div class="mt-1 text-[10px] text-slate-400">${t.desc}</div></div></button>`;
  }).join('');
}

function renderStudioToolPanelContent(tool) {
  if (tool === 'templates') {
    return `
      <div class="p-4 space-y-3">
        <div><h3 class="text-xs font-black uppercase tracking-wider text-slate-300">Social Templates</h3><p class="mt-1 text-[10px] text-slate-500">Ready-made layouts with gradients, shapes and safe text placement.</p></div>
        <select onchange="filterStudioTemplates(this.value)" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white"><option value="all">All social sizes</option>${Object.entries(STUDIO_SOCIAL_FORMATS).map(([key,f]) => `<option value="${key}">${f.label}</option>`).join('')}</select>
        <div id="studio-template-cards" class="space-y-3">${renderStudioTemplateCards()}</div>
      </div>
    `;
  } else if (tool === 'inventory') {
    return `
      <div class="p-4 space-y-3">
        <h3 class="text-xs font-black uppercase tracking-wider text-slate-300">Dealership Inventory</h3>
        <input type="text" placeholder="Search stock #, VIN, year make model..." oninput="searchStudioInventory(this.value)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white">
        <div class="space-y-2" id="studio-inventory-list">
          <button onclick="bindVehicleToStudio('demo_v1')" class="w-full text-left p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-xs font-black text-indigo-400">VEH</div>
            <div class="min-w-0 flex-1">
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
        <div><h3 class="text-xs font-black uppercase tracking-wider text-slate-300">Pexels Photos</h3><p class="text-[10px] text-slate-500 mt-1">Search the free Pexels library and add a photo directly.</p></div>
        <form onsubmit="event.preventDefault(); searchStudioLibrary(document.getElementById('studio-photo-query').value)" class="flex gap-2"><input id="studio-photo-query" type="search" value="car dealership" placeholder="Search photos..." class="min-w-0 flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"><button class="px-3 rounded-xl bg-blue-600 text-xs font-black">Search</button></form>
        <div class="grid grid-cols-2 gap-2 pt-2" id="studio-photo-results"><div class="col-span-2 p-5 text-center text-xs text-slate-500">Loading Pexels photos…</div></div>
        <a href="https://www.pexels.com" target="_blank" rel="noopener" class="block text-center text-[10px] font-bold text-sky-400 hover:underline">Photos provided by Pexels</a>
      </div>
    `;
  } else if (tool === 'videos') {
    return `<div class="p-4 space-y-3"><div><h3 class="text-xs font-black uppercase tracking-wider text-slate-300">Pexels Videos</h3><p class="text-[10px] text-slate-500 mt-1">Search free video clips and place them on the canvas.</p></div><form onsubmit="event.preventDefault(); searchStudioVideos(document.getElementById('studio-video-query').value)" class="flex gap-2"><input id="studio-video-query" type="search" value="car dealership" placeholder="Search videos..." class="min-w-0 flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"><button class="px-3 rounded-xl bg-blue-600 text-xs font-black">Search</button></form><div class="space-y-3" id="studio-video-results"><div class="p-5 text-center text-xs text-slate-500">Loading Pexels videos…</div></div><a href="https://www.pexels.com/videos/" target="_blank" rel="noopener" class="block text-center text-[10px] font-bold text-sky-400 hover:underline">Videos provided by Pexels</a></div>`;
  } else if (tool === 'uploads') {
    return `<div class="p-4 space-y-3"><div><h3 class="text-xs font-black uppercase tracking-wider text-slate-300">Your Video Uploads</h3><p class="text-[10px] text-slate-500 mt-1">Upload video files up to 200 MB and reuse them here.</p></div><label class="block p-4 rounded-xl border-2 border-dashed border-blue-500/50 bg-blue-500/10 text-center cursor-pointer hover:bg-blue-500/20"><span class="block text-xl mb-1">↑</span><span class="text-xs font-black">Upload your video</span><input type="file" accept="video/*" class="hidden" onchange="uploadStudioVideo(this)"></label><div id="studio-upload-status" class="hidden text-xs text-center text-sky-400"></div><div id="studio-uploaded-videos" class="space-y-3"><div class="p-5 text-center text-xs text-slate-500">Loading your videos…</div></div></div>`;
  } else if (tool === 'shapes') {
    return `
      <div class="p-4 space-y-3">
        <h3 class="text-xs font-black uppercase tracking-wider text-slate-300">Shapes &amp; Badges</h3>
        <div class="grid grid-cols-3 gap-2">${[['rect','Rectangle'],['badge','Rounded'],['circle','Circle'],['ellipse','Ellipse'],['triangle','Triangle'],['diamond','Diamond'],['pentagon','Pentagon'],['hexagon','Hexagon'],['star','Star'],['line','Line'],['arrow','Arrow'],['heart','Heart'],['speech','Speech']].map(([id,label]) => `<button onclick="studioAddShape('${id}')" class="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-bold text-white text-center">${label}</button>`).join('')}</div>
        <div class="border-t border-slate-800 pt-3"><h4 class="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Draw</h4><div class="grid grid-cols-2 gap-2"><button onclick="studioDrawingMode('pen')" class="p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-black">Pen</button><button onclick="studioDrawingMode('pencil')" class="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-black">Pencil</button></div><button onclick="studioSelectMode()" class="mt-2 w-full p-2 rounded-xl border border-slate-700 text-xs font-bold">Select &amp; move objects</button></div>
      </div>
    `;
  } else if (tool === 'ai') {
    if (!studioHasPaidAi()) return `
      <div class="p-4 space-y-4">
        <div class="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-sky-400 text-xl">✦</div>
        <div><h3 class="text-sm font-black text-white">AI Content is locked</h3><p class="text-xs text-slate-400 mt-1 leading-relaxed">AI writing appears here when AI Boost is active on the paid account.</p></div>
        <button onclick="if(typeof openUpgradeModal==='function') openUpgradeModal('ai_boost')" class="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-black">View AI Boost</button>
      </div>`;
    return `
      <div class="p-4 space-y-3">
        <div><h3 class="text-xs font-black uppercase tracking-wider text-sky-400">AI Content</h3><p class="text-[11px] text-slate-400 mt-1">Generate campaign-ready copy, then add it directly to the canvas.</p></div>
        <textarea id="studio-ai-prompt" rows="4" placeholder="Example: Write a short summer sales headline for our SUV event" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white resize-none"></textarea>
        <button onclick="generateStudioAiCopy()" id="studio-ai-generate" class="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-black">✦ Generate content</button>
        <div id="studio-ai-result" class="hidden p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 whitespace-pre-wrap"></div>
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
  const object = Array.isArray(selected) ? selected[0] : selected;
  const color = typeof object?.fill === 'string' && object.fill.startsWith('#') ? object.fill : (typeof object?.stroke === 'string' && object.stroke.startsWith('#') ? object.stroke : '#2563eb');
  const opacity = Math.round((object?.opacity ?? 1) * 100);
  return `
    <h3 class="text-xs font-black uppercase tracking-wider text-slate-300 mb-3">Property Inspector</h3>
    <div class="space-y-3">
      <div class="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
        <div><label class="text-[11px] font-bold text-slate-400">Colour</label><input type="color" value="${color}" onchange="studioSetObjectStyle('color', this.value)" class="mt-1 w-full h-9 rounded-lg bg-transparent cursor-pointer"></div>
        <div><div class="flex justify-between"><label class="text-[11px] font-bold text-slate-400">Transparency</label><span id="studio-opacity-value" class="text-[11px] text-sky-400">${100-opacity}%</span></div><input type="range" min="0" max="100" value="${opacity}" oninput="document.getElementById('studio-opacity-value').textContent=(100-Number(this.value))+'%'" onchange="studioSetObjectStyle('opacity', Number(this.value)/100)" class="w-full accent-blue-500"></div>
      </div>
      <button onclick="studioToggleNodes()" class="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black">Edit vector nodes</button>
      <div class="space-y-1">
        <label class="text-[11px] font-bold text-slate-400">Layer Order:</label>
        <div class="flex gap-2">
          <button onclick="if(window.__studioAdapter) window.__studioAdapter.bringForward()" class="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold">Bring Forward</button>
          <button onclick="if(window.__studioAdapter) window.__studioAdapter.sendBackwards()" class="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold">Send Back</button>
        </div>
      </div>
      <button onclick="if(window.__studioAdapter) window.__studioAdapter.deleteSelected()" class="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition flex items-center justify-center gap-1.5">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>Delete Object
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
      const hint = document.getElementById('studio-text-hint');
      const active = Array.isArray(selected) ? selected[0] : selected;
      if (hint) hint.textContent = active && ['textbox', 'text', 'i-text'].includes(active.type) ? 'Text selected — use the controls' : 'Select text to format it';
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
  if (tool === 'photos') setTimeout(() => searchStudioLibrary('car dealership'), 0);
  if (tool === 'videos') setTimeout(() => searchStudioVideos('car dealership'), 0);
  if (tool === 'uploads') setTimeout(loadStudioUploadedVideos, 0);
}

async function loadStudioTemplate(tmplKey) {
  const tmpl = STUDIO_TEMPLATES_CATALOG[tmplKey] || STUDIO_TEMPLATES_CATALOG.tmpl_spotlight_square;
  const scene = JSON.parse(JSON.stringify(tmpl.scene));

  if (window.__studioAdapter) {
    await window.__studioAdapter.renderScene(scene);
  }
  const container = document.getElementById('studio-artboard-container');
  if (container) { container.style.width = `${scene.width}px`; container.style.height = `${scene.height}px`; }
  const picker = document.getElementById('studio-format-picker');
  if (picker && STUDIO_SOCIAL_FORMATS[scene.format_key]) picker.value = scene.format_key;
  updateStudioSafeGuides(scene.format_key || 'square');
  zoomStudioFit();
  if (typeof showToast === 'function') showToast(`Loaded ${tmpl.name}`, 'success');
}

function searchStudioInventory(query) {
  const listEl = document.getElementById('studio-inventory-list');
  if (!listEl) return;
  const q = (query || '').toLowerCase().trim();
  const inv = (ENGINE_DATA && ENGINE_DATA['marketing-overview']?.inventory || [
    { id: 'demo_v1', year: 2024, make: 'Ford', model: 'F-150 Lariat', price: 54990, stocknumber: 'F9041' },
    { id: 'demo_v2', year: 2024, make: 'Honda', model: 'Civic Touring', price: 29850, stocknumber: 'H1022' }
  ]).filter(v => !q || `${v.year} ${v.make} ${v.model} ${v.stocknumber} ${v.vin || ''}`.toLowerCase().includes(q));

  listEl.innerHTML = inv.map(v => `
    <button onclick="bindVehicleToStudio('${v.id}')" class="w-full text-left p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition flex items-center gap-3">
      <div class="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-xs font-black text-indigo-400">VEH</div>
      <div class="min-w-0 flex-1">
        <div class="text-xs font-bold text-white truncate">${escS(`${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() || 'Vehicle')}</div>
        <div class="text-[11px] text-emerald-400 font-bold">$${Number(v.price || 0).toLocaleString()} • STK #${escS(v.stocknumber || '—')}</div>
      </div>
    </button>
  `).join('') || `<div class="text-xs text-slate-400 italic p-3">No matching inventory.</div>`;
}

async function bindVehicleToStudio(vehicleId) {
  const inv = (ENGINE_DATA && ENGINE_DATA['marketing-overview']?.inventory) || [];
  const v = inv.find(x => x.id === vehicleId) || { year: 2024, make: 'Ford', model: 'F-150 Lariat', price: 54990, stocknumber: 'F9041' };
  window.__studioCurrentVehicle = v;
  if (window.__studioAdapter) {
    if (v.primary_photo_url || v.photo_url || v.image_url) {
      window.__studioAdapter.addImage(v.primary_photo_url || v.photo_url || v.image_url, `${v.year} ${v.make} ${v.model}`);
    }
    window.__studioAdapter.addShape('badge', '#10B981');
    window.__studioAdapter.addText(`${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim(), { fontSize: 40, fontWeight: '900', fill: '#FFFFFF', y: 120 });
    window.__studioAdapter.addText(`$${Number(v.price || 0).toLocaleString()}`, { fontSize: 48, fontWeight: '900', fill: '#10B981', y: 180 });
  }
  if (typeof showToast === 'function') showToast(`Bound ${v.year || ''} ${v.make || ''} ${v.model || ''} to design!`, 'success');
}

async function searchStudioLibrary(query) {
  const target = document.getElementById('studio-photo-results');
  if (!target) return;
  const q = String(query || '').trim().toLowerCase();
  target.innerHTML = '<div class="col-span-2 p-5 text-center text-xs text-slate-500">Searching Pexels…</div>';
  try {
    const data = await apiGetJson(`/marketing/studio/library/search?q=${encodeURIComponent(q || 'car dealership')}`);
    target.innerHTML = data?.results?.length ? renderPexelsResults(data.results) : '<div class="col-span-2 p-4 text-center text-xs text-slate-500">No matching Pexels photos.</div>';
  } catch (error) {
    const fallback = STUDIO_FREE_PHOTOS.filter(photo => !q || `${photo.keywords} ${photo.alt}`.toLowerCase().includes(q));
    target.innerHTML = fallback.length ? renderStudioPhotoResults(fallback) : '<div class="col-span-2 p-4 text-center text-xs text-rose-400">Photo search is temporarily unavailable.</div>';
  }
}

async function searchStudioVideos(query) {
  const target = document.getElementById('studio-video-results');
  if (!target) return;
  target.innerHTML = '<div class="p-5 text-center text-xs text-slate-500">Searching Pexels videos…</div>';
  try {
    const data = await apiGetJson(`/marketing/studio/library/search?type=video&q=${encodeURIComponent(String(query || 'car dealership').trim())}`);
    target.innerHTML = data?.results?.length ? renderStudioVideoResults(data.results) : '<div class="p-4 text-center text-xs text-slate-500">No matching videos.</div>';
  } catch (error) {
    target.innerHTML = `<div class="p-4 text-center text-xs text-rose-400">${escS(error.message || 'Video search is unavailable.')}</div>`;
  }
}

async function loadStudioUploadedVideos() {
  const target = document.getElementById('studio-uploaded-videos');
  if (!target) return;
  try {
    const data = await apiGetJson('/marketing/assets');
    const videos = (data?.assets || []).filter(asset => asset.kind === 'video');
    target.innerHTML = videos.length ? renderStudioVideoResults(videos, true) : '<div class="p-4 text-center text-xs text-slate-500">No uploaded videos yet.</div>';
  } catch (error) {
    target.innerHTML = '<div class="p-4 text-center text-xs text-rose-400">Your uploads could not be loaded.</div>';
  }
}

async function uploadStudioVideo(input) {
  const file = input.files?.[0];
  if (!file) return;
  const status = document.getElementById('studio-upload-status');
  if (status) { status.classList.remove('hidden'); status.textContent = `Uploading ${file.name}…`; }
  try {
    const form = new FormData(); form.append('file', file); form.append('title', file.name);
    const response = await fetch(`${API}/marketing/assets/video`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Video upload failed');
    if (status) status.textContent = 'Upload complete';
    await loadStudioUploadedVideos();
    if (typeof showToast === 'function') showToast('Video added to your Studio uploads', 'success');
  } catch (error) {
    if (status) { status.textContent = error.message || 'Upload failed'; status.className = 'text-xs text-center text-rose-400'; }
  } finally { input.value = ''; }
}

function addLibraryVideoToCanvas(url, name = 'Video') {
  window.__studioAdapter?.stopDrawingMode();
  window.__studioAdapter?.addVideo(url, name).then(() => {
    if (typeof showToast === 'function') showToast('Video added to the canvas', 'success');
  }).catch(error => { if (typeof showToast === 'function') showToast(error.message || 'Video could not be added', 'error'); });
}

function studioAddShape(shapeType) {
  window.__studioAdapter?.stopDrawingMode();
  window.__studioAdapter?.addShape(shapeType, '#2563EB');
}

function studioDrawingMode(tool) {
  window.__studioAdapter?.setDrawingMode(tool, { color: '#2563EB' });
  if (typeof showToast === 'function') showToast(`${tool === 'pen' ? 'Pen' : 'Pencil'} active — draw directly on the canvas`, 'info');
}

function studioSelectMode() {
  window.__studioAdapter?.stopDrawingMode();
  if (typeof showToast === 'function') showToast('Select mode — objects can be moved, resized, and rotated', 'info');
}

function studioSetObjectStyle(property, value) {
  const active = window.__studioAdapter?.fabricCanvas?.getActiveObject();
  if (!active) { if (typeof showToast === 'function') showToast('Select an object first', 'info'); return; }
  if (property === 'color') {
    const usesStroke = active.type === 'path' && (!active.fill || active.fill === '');
    window.__studioAdapter.updateSelected(usesStroke ? { stroke: value } : { fill: value });
  } else window.__studioAdapter.updateSelected({ [property]: value });
}

function studioToggleNodes() {
  const editing = window.__studioAdapter?.toggleNodeEditing();
  if (editing == null) { if (typeof showToast === 'function') showToast('Select a vector shape such as a star, polygon, diamond, or speech bubble first', 'info'); return; }
  if (typeof showToast === 'function') showToast(editing ? 'Node editing on — drag the blue points' : 'Node editing off', 'info');
}

function studioAddText(kind) {
  if (!window.__studioAdapter) return;
  const options = kind === 'heading' ? { fontSize: 64, fontWeight: '900' }
    : kind === 'subheading' ? { fontSize: 36, fontWeight: '700' }
      : { fontSize: 24, fontWeight: '500' };
  const copy = kind === 'heading' ? 'ADD A HEADING' : kind === 'subheading' ? 'Add a subheading' : 'Add body text';
  window.__studioAdapter.addText(copy, options);
}

function studioSetTextStyle(property, value) {
  if (!window.__studioAdapter?.updateSelectedText({ [property]: value })) {
    if (typeof showToast === 'function') showToast('Select a text box first', 'info');
  }
}

async function generateStudioAiCopy() {
  if (!studioHasPaidAi()) {
    if (typeof openUpgradeModal === 'function') openUpgradeModal('ai_boost');
    return;
  }
  const prompt = document.getElementById('studio-ai-prompt')?.value?.trim();
  if (!prompt) { if (typeof showToast === 'function') showToast('Describe the content you want first', 'info'); return; }
  const btn = document.getElementById('studio-ai-generate');
  const result = document.getElementById('studio-ai-result');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }
  try {
    const response = await apiSendJson('/ai/assistant', 'POST', { messages: [{ role: 'user', content: `Create concise marketing copy for a visual design. Follow this request: ${prompt}. Return only the finished copy, without commentary, headings, markdown, or quotation marks.` }] });
    const copy = String(response?.reply || '').trim();
    if (!copy) throw new Error('No content returned');
    if (result) {
      result.classList.remove('hidden');
      result.innerHTML = `${escS(copy)}<button type="button" onclick="studioAddGeneratedCopy()" class="mt-3 w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold">Add to canvas</button>`;
      result.dataset.copy = copy;
    }
  } catch (error) {
    if (typeof showToast === 'function') showToast(error.message || 'AI content could not be generated', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✦ Generate content'; }
  }
}

function studioAddGeneratedCopy() {
  const copy = document.getElementById('studio-ai-result')?.dataset?.copy;
  if (copy && window.__studioAdapter) window.__studioAdapter.addText(copy, { fontSize: 36, fontWeight: '800', width: 700 });
}

function addLibraryImageToCanvas(url, name = 'Photo Asset') {
  if (window.__studioAdapter) {
    window.__studioAdapter.addImage(url, name);
    if (typeof showToast === 'function') showToast('Added image to artboard', 'success');
  }
}

function changeStudioFormat(formatKey) {
  const sz = STUDIO_SOCIAL_FORMATS[formatKey] || STUDIO_SOCIAL_FORMATS.square;
  const container = document.getElementById('studio-artboard-container');
  if (container) {
    container.style.width = `${sz.w}px`;
    container.style.height = `${sz.h}px`;
  }
  if (window.__studioAdapter) window.__studioAdapter.resizeCanvas(sz.w, sz.h);
  if (window.__studioAdapter?.currentScene) window.__studioAdapter.currentScene.format_key = formatKey;
  updateStudioSafeGuides(formatKey);
  zoomStudioFit();
  if (typeof showToast === 'function') showToast(`Format set to ${formatKey.toUpperCase()}`, 'info');
}

function filterStudioTemplates(formatKey) {
  const cards = document.getElementById('studio-template-cards');
  if (cards) cards.innerHTML = renderStudioTemplateCards(formatKey);
}

function updateStudioSafeGuides(formatKey) {
  const old = document.getElementById('studio-safe-guides');
  if (old) old.outerHTML = renderStudioSafeGuides(formatKey);
}

function toggleStudioGuides() {
  const guides = document.getElementById('studio-safe-guides');
  const button = document.getElementById('studio-guides-toggle');
  if (!guides) return;
  guides.classList.toggle('hidden');
  if (button) button.textContent = guides.classList.contains('hidden') ? 'Guides off' : 'Guides on';
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
  window.__studioFitObserver?.disconnect();
  window.__studioFitObserver = null;
  document.getElementById('ms-studio-master-modal')?.remove();
}

function toggleStudioToolPanel() {
  const panel = document.getElementById('studio-tool-panel');
  if (panel) { panel.classList.toggle('hidden'); setTimeout(zoomStudioFit, 50); }
}
function toggleStudioInspectorPanel() {
  const panel = document.getElementById('studio-inspector-panel');
  if (panel) { panel.classList.toggle('hidden'); setTimeout(zoomStudioFit, 50); }
}

window.toggleStudioToolPanel = toggleStudioToolPanel;
window.toggleStudioInspectorPanel = toggleStudioInspectorPanel;
window.openMarketSyncStudio = openMarketSyncStudio;
window.setStudioTool = setStudioTool;
window.loadStudioTemplate = loadStudioTemplate;
window.searchStudioInventory = searchStudioInventory;
window.bindVehicleToStudio = bindVehicleToStudio;
window.searchStudioLibrary = searchStudioLibrary;
window.addLibraryImageToCanvas = addLibraryImageToCanvas;
window.changeStudioFormat = changeStudioFormat;
window.filterStudioTemplates = filterStudioTemplates;
window.toggleStudioGuides = toggleStudioGuides;
window.saveStudioDesign = saveStudioDesign;
window.renderStudioDesignAndPublish = renderStudioDesignAndPublish;
window.closeMarketSyncStudio = closeMarketSyncStudio;
window.zoomStudioIn = zoomStudioIn;
window.zoomStudioOut = zoomStudioOut;
window.zoomStudioFit = zoomStudioFit;
window.applyStudioZoom = applyStudioZoom;
window.studioAddShape = studioAddShape;
window.studioDrawingMode = studioDrawingMode;
window.studioSelectMode = studioSelectMode;
window.studioSetObjectStyle = studioSetObjectStyle;
window.studioToggleNodes = studioToggleNodes;
window.searchStudioVideos = searchStudioVideos;
window.loadStudioUploadedVideos = loadStudioUploadedVideos;
window.uploadStudioVideo = uploadStudioVideo;
window.addLibraryVideoToCanvas = addLibraryVideoToCanvas;
window.studioAddText = studioAddText;
window.studioSetTextStyle = studioSetTextStyle;
window.generateStudioAiCopy = generateStudioAiCopy;
window.studioAddGeneratedCopy = studioAddGeneratedCopy;
