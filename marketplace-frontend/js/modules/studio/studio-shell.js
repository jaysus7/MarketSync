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

// Small inline SVG previews so each Shapes button shows the actual shape, not just
// its name — mirrors the geometry fabric-adapter.js's addShape() draws on canvas.
const STUDIO_SHAPE_PREVIEW = {
  rect: '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="currentColor"><rect x="3" y="6" width="18" height="12" rx="1"/></svg>',
  badge: '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="currentColor"><rect x="2" y="7" width="20" height="10" rx="5"/></svg>',
  circle: '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="currentColor"><circle cx="12" cy="12" r="9"/></svg>',
  ellipse: '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="currentColor"><ellipse cx="12" cy="12" rx="10" ry="6"/></svg>',
  triangle: '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="currentColor"><polygon points="12,4 21,20 3,20"/></svg>',
  diamond: '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="currentColor"><polygon points="12,3 21,12 12,21 3,12"/></svg>',
  pentagon: '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="currentColor"><polygon points="12,3 21,9.5 17.5,20 6.5,20 3,9.5"/></svg>',
  hexagon: '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="currentColor"><polygon points="7,3 17,3 22,12 17,21 7,21 2,12"/></svg>',
  star: '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="currentColor"><polygon points="12,3 14.7,9.5 21.8,10 16.5,14.6 18.1,21.5 12,17.8 5.9,21.5 7.5,14.6 2.2,10 9.3,9.5"/></svg>',
  line: '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="17" y2="12"/><polyline points="12,6 18,12 12,18"/></svg>',
  heart: '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="currentColor"><path d="M12 21s-7.5-5-9.5-9.5C1 7 3 4 6.5 4c2 0 3.5 1.2 5.5 3.5C14 5.2 15.5 4 17.5 4 21 4 23 7 21.5 11.5 19.5 16 12 21 12 21z"/></svg>',
  speech: '<svg viewBox="0 0 24 24" class="w-6 h-6" fill="currentColor"><path d="M3 4h18v11H9l-3.5 3.5V15H3V4z"/></svg>',
};

// Emoji-based clip art / stickers — no external asset library required, renders
// identically everywhere, and drops onto the canvas as a resizable text object via
// the same addText() path real text uses.
const STUDIO_STICKERS = [
  '🚗', '🚙', '🚚', '🏎️', '🔧', '⭐', '🔥', '💰', '🎉', '📞', '📍', '✅',
  '❌', '💯', '🏆', '👍', '❤️', '⚡', '🛠️', '🔑', '🎁', '📣', '🕒', '🛡️',
];

// Curated Google Fonts for on-canvas text — loaded on demand (not on every page
// load) the first time the Text tool is opened, via a single stylesheet request.
const STUDIO_GOOGLE_FONTS = [
  'Manrope', 'Inter', 'Poppins', 'Montserrat', 'Oswald', 'Bebas Neue',
  'Playfair Display', 'Anton', 'Archivo Black', 'Roboto Condensed',
  'DM Sans', 'Barlow Condensed', 'Teko', 'Righteous',
];

function loadStudioGoogleFonts() {
  if (document.getElementById('studio-google-fonts-link')) return;
  const link = document.createElement('link');
  link.id = 'studio-google-fonts-link';
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${STUDIO_GOOGLE_FONTS.map(f => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;700;900`).join('&')}&display=swap`;
  document.head.appendChild(link);
}

// Applies to the selected text box if one is active, otherwise becomes the
// font new text (AI copy, headings, etc.) is added with next.
function studioPickFont(fontName) {
  window.__studioSelectedFont = `'${fontName}', sans-serif`;
  document.querySelectorAll('#studio-font-picker button').forEach(btn => {
    btn.classList.toggle('ring-2', btn.dataset.font === fontName);
    btn.classList.toggle('ring-indigo-500', btn.dataset.font === fontName);
  });
  const active = window.__studioAdapter?.fabricCanvas?.getActiveObject();
  if (active && ['textbox', 'text', 'i-text'].includes(active.type)) {
    window.__studioAdapter.updateSelectedText({ fontFamily: window.__studioSelectedFont });
    if (typeof showToast === 'function') showToast(`${fontName} applied`, 'success');
  } else if (typeof showToast === 'function') {
    showToast(`${fontName} selected — new text will use it`, 'info');
  }
}
window.studioPickFont = studioPickFont;

function studioAddSticker(emoji) {
  if (!window.__studioAdapter) return;
  window.__studioAdapter.addText(emoji, { fontSize: 96, fontWeight: '400' });
}
window.studioAddSticker = studioAddSticker;

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
  window.__studioCurrentDesign = null;
  let modal = document.getElementById('ms-studio-master-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'ms-studio-master-modal';
    modal.className = 'fixed inset-0 z-[99999] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col overflow-hidden font-sans';
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
        scene = window.msStudioDocumentToScene ? window.msStudioDocumentToScene(res.design.scene || scene) : (res.design.scene || scene);
        designName = res.design.name || designName;
      }
    } catch (e) { /* fallback */ }
  }

  modal.innerHTML = renderStudioWorkspaceHtml(designName, scene);
  window.__studioDocument = window.msStudioSceneToDocument ? window.msStudioSceneToDocument(scene, { title: designName }) : scene;
  if (window.__msStudioStore) {
    window.__msStudioStore.hydrate(window.msStudioSceneToDocument ? window.msStudioSceneToDocument(scene, { title: designName }) : scene, window.__studioCurrentDesign?.id || designId);
    window.__msStudioStore.subscribe(studioRenderSaveState);
  }
  initStudioAdapter(scene);
  window.__studioFitObserver?.disconnect();
  const viewport = document.getElementById('studio-canvas-viewport');
  if (viewport && window.ResizeObserver) {
    window.__studioFitObserver = new ResizeObserver(() => requestAnimationFrame(zoomStudioFit));
    window.__studioFitObserver.observe(viewport);
  }
  setTimeout(zoomStudioFit, 100);
  if (!window.__studioKeydownBound) {
    window.__studioKeydownBound = true;
    document.addEventListener('keydown', studioKeydownHandler);
  }
};

function studioRenderSaveState(state) {
  const el = document.getElementById('studio-save-status');
  if (!el) return;
  const styles = { SAVED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', SAVING: 'bg-sky-500/20 text-sky-400 border-sky-500/40', UNSAVED: 'bg-amber-500/20 text-amber-400 border-amber-500/40', 'SAVE FAILED': 'bg-rose-500/20 text-rose-400 border-rose-500/40', PUBLISHED: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' };
  el.textContent = state.status;
  el.className = `px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold border ${styles[state.status] || styles.UNSAVED}`;
}

// Standard editor shortcuts (undo/redo/copy/cut/paste/duplicate/group/delete). Every
// shortcut is disabled while focus is in an input/textarea/contenteditable — including
// Fabric's own hidden textarea for in-canvas text editing — so typing a design name,
// a text object's contents, or a search box is never hijacked.
function studioKeydownHandler(e) {
  const adapter = window.__studioAdapter;
  if (!adapter) return;
  const tag = (document.activeElement?.tagName || '').toLowerCase();
  const editable = tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable;
  if (editable) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); adapter.deleteSelected(); return; }
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  const key = e.key.toLowerCase();
  if (key === 'z' && e.shiftKey) { e.preventDefault(); adapter.redo(); }
  else if (key === 'z') { e.preventDefault(); adapter.undo(); }
  else if (key === 'y') { e.preventDefault(); adapter.redo(); }
  else if (key === 'd') { e.preventDefault(); adapter.duplicateSelected(); }
  else if (key === 'c') { e.preventDefault(); adapter.copySelected(); }
  else if (key === 'x') { e.preventDefault(); adapter.cutSelected(); }
  else if (key === 'v') { e.preventDefault(); adapter.pasteClipboard(); }
  else if (key === 'g' && e.shiftKey) { e.preventDefault(); adapter.ungroupSelected(); }
  else if (key === 'g') { e.preventDefault(); adapter.groupSelected(); }
}
window.studioKeydownHandler = studioKeydownHandler;

function renderStudioPhotoResults(photos) {
  return photos.map(photo => `<button type="button" onclick="addLibraryImageToCanvas('${photo.url}')" class="relative group overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 transition" title="${escS(photo.alt)}"><img src="${photo.url}" alt="${escS(photo.alt)}" loading="lazy" class="w-full aspect-square object-cover group-hover:scale-105 transition duration-200"><span class="absolute inset-x-0 bottom-0 px-2 py-1 bg-slate-950/80 text-[9px] text-left text-white truncate">${escS(photo.alt)}</span></button>`).join('');
}

function renderPexelsResults(photos) {
  return photos.map(photo => `<div class="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"><button type="button" onclick="addLibraryImageToCanvas('${escS(photo.source_url)}', '${escS(photo.alt || 'Pexels photo')}')" class="block w-full group"><img src="${escS(photo.preview_url)}" alt="${escS(photo.alt || '')}" loading="lazy" class="w-full aspect-square object-cover group-hover:scale-105 transition duration-200"></button><div class="px-2 py-1.5 text-[9px] truncate"><a href="${escS(photo.author_url || photo.attribution_url || 'https://www.pexels.com')}" target="_blank" rel="noopener" class="text-sky-400 hover:underline">${escS(photo.author || 'Pexels photographer')}</a></div></div>`).join('');
}

function renderStudioVideoResults(videos, uploaded = false) {
  return videos.map(video => `<div class="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"><video src="${escS(video.source_url || video.public_url)}" poster="${escS(video.preview_url || '')}" muted loop playsinline controls preload="metadata" class="w-full aspect-video object-cover bg-black"></video><div class="p-2"><div class="flex items-center justify-between gap-2"><a href="${escS(video.author_url || video.attribution_url || '#')}" target="_blank" rel="noopener" class="min-w-0 truncate text-[9px] text-sky-400 hover:underline">${escS(uploaded ? (video.title || 'Your video') : (video.author || 'Pexels creator'))}</a>${video.duration ? `<span class="text-[9px] text-slate-500 dark:text-slate-400">${Number(video.duration)}s</span>` : ''}</div><button onclick="addLibraryVideoToCanvas('${escS(video.source_url || video.public_url)}', '${escS(video.title || video.alt || 'Video')}')" class="mt-2 w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-[10px] font-black">Add video to canvas</button></div></div>`).join('');
}

function renderStudioWorkspaceHtml(designName, scene) {
  return `
    <!-- Header: two stacked layers — identity/branding on top, actions below.
         Split out of one crowded row so the toolbar (zoom, undo/redo, format,
         Save/Schedule/Render) has its own layer instead of fighting the logo/back
         button/name field for space. -->
    <div class="flex-shrink-0 z-20">
    <header class="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button onclick="closeMarketSyncStudio()" class="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5 text-xs font-bold">
          ${typeof isDesignStudioOnlyWorkspace === 'function' && isDesignStudioOnlyWorkspace() ? '← Settings' : '← Back to Marketing'}
        </button>
        <div class="h-5 w-px bg-slate-100 dark:bg-slate-800"></div>
        <img src="/assets/brand/marketsync-logo-primary.png" alt="MarketSync" class="h-8 w-auto dark:hidden">
        <img src="/assets/brand/marketsync-logo-white.png" alt="MarketSync" class="h-8 w-auto hidden dark:block">
        <span class="px-2 py-0.5 rounded-lg text-[11px] font-black bg-indigo-600 text-white dark:bg-indigo-600/20 dark:text-indigo-400 border border-indigo-600 dark:border-indigo-500/40 tracking-wide uppercase">Design Studio</span>
        <input type="text" id="studio-design-name" value="${escS(designName)}" onchange="saveStudioDesignName(this.value)" class="bg-transparent text-sm font-black text-slate-900 dark:text-white focus:bg-slate-100 dark:focus:bg-slate-800 px-2 py-1 rounded-lg border border-transparent hover:border-slate-300 dark:hover:border-slate-700 transition">
        <span id="studio-save-status" class="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-600 text-white dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-600 dark:border-emerald-500/40">SAVED</span>
      </div>
    </header>

    <!-- Toolbar layer -->
    <div class="h-14 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between gap-3">
      <!-- Left tool cluster scrolls on its own so it can never push the primary
           actions (Save/Schedule/Publish) off the right edge — the exact reason
           Schedule + Render weren't visible on laptop widths. -->
      <div class="flex items-center gap-2 min-w-0 overflow-x-auto">
        <!-- Zoom Controls -->
        <div class="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-300 dark:border-slate-700">
          <button onclick="zoomStudioOut()" title="Zoom Out" class="px-2.5 py-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-black text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition">-</button>
          <span id="studio-zoom-display" class="px-2 text-xs font-mono font-bold text-indigo-600 dark:text-sky-400">55%</span>
          <button onclick="zoomStudioIn()" title="Zoom In" class="px-2.5 py-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-black text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition">+</button>
          <button onclick="zoomStudioFit()" title="Fit to Screen" class="px-2.5 py-1 ml-1 rounded-lg bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 text-[11px] font-bold text-slate-900 dark:text-white transition">Fit</button>
        </div>
        <button id="studio-guides-toggle" onclick="toggleStudioGuides()" class="px-3 py-1.5 rounded-xl bg-indigo-600 text-white dark:bg-blue-600/20 dark:border dark:border-blue-500/40 dark:text-blue-300 text-xs font-bold">Guides on</button>

        <div class="h-5 w-px bg-slate-200 dark:bg-slate-800"></div>

        <button onclick="if(window.__studioAdapter) window.__studioAdapter.undo()" title="Undo (Ctrl+Z)" class="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6-6m-6 6l6 6"/></svg>Undo</button>
        <button onclick="if(window.__studioAdapter) window.__studioAdapter.redo()" title="Redo (Ctrl+Shift+Z)" class="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 10H11a8 8 0 00-8 8v2m18-10l-6-6m6 6l-6 6"/></svg>Redo</button>
        <div class="h-5 w-px bg-slate-200 dark:bg-slate-800"></div>

        <button onclick="if(window.__studioAdapter) window.__studioAdapter.duplicateSelected()" title="Duplicate (Ctrl+D)" class="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>Duplicate</button>
        <button onclick="if(window.__studioAdapter) window.__studioAdapter.groupSelected()" title="Group (Ctrl+G)" class="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4h7v7H4V4zm9 9h7v7h-7v-7zM4 20a1 1 0 001-1v-2M4 17v-1a1 1 0 011-1M20 4a1 1 0 00-1 1v2M20 7v1a1 1 0 01-1 1"/></svg>Group</button>
        <button onclick="if(window.__studioAdapter) window.__studioAdapter.ungroupSelected()" title="Ungroup (Ctrl+Shift+G)" class="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4h6v6H4V4zm10 10h6v6h-6v-6zM4 14h6v6H4v-6zm10-10h6v6h-6V4z"/></svg>Ungroup</button>
        <div class="h-5 w-px bg-slate-200 dark:bg-slate-800"></div>

        <select id="studio-format-picker" onchange="changeStudioFormat(this.value)" class="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700">
          ${Object.entries(STUDIO_SOCIAL_FORMATS).map(([key, format]) => `<option value="${key}" ${scene.format_key === key ? 'selected' : ''}>${format.label} (${format.w}×${format.h})</option>`).join('')}
        </select>
        <div class="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 p-0.5" title="Preview breakpoint-specific layout overrides">
          <button type="button" onclick="setStudioBreakpoint('desktop')" data-studio-breakpoint="desktop" class="studio-breakpoint px-2 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-black">Desktop</button>
          <button type="button" onclick="setStudioBreakpoint('tablet')" data-studio-breakpoint="tablet" class="studio-breakpoint px-2 py-1 rounded-lg text-slate-500 dark:text-slate-300 text-[10px] font-bold">Tablet</button>
          <button type="button" onclick="setStudioBreakpoint('mobile')" data-studio-breakpoint="mobile" class="studio-breakpoint px-2 py-1 rounded-lg text-slate-500 dark:text-slate-300 text-[10px] font-bold">Mobile</button>
        </div>
      </div>

      <div class="flex items-center gap-2 flex-shrink-0">
        <button onclick="saveStudioDesign()" class="px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold transition flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>Save
        </button>
        <button onclick="openStudioRevisionHistory()" class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold transition">History</button>
        <button onclick="publishStudioDesign()" class="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-lg transition">Publish</button>
        <button onclick="if(typeof openStudioSchedulerWithEntitlementCheck === 'function') openStudioSchedulerWithEntitlementCheck()" class="px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold transition flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>Schedule
        </button>
        <button onclick="renderStudioDesignAndPublish()" class="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-lg transition flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.684A1.85 1.85 0 014.28 11.5c0-.853.585-1.572 1.4-1.782m0 0A3.001 3.001 0 0111 8.5h6.25a2.25 2.25 0 012.25 2.25v2.25a2.25 2.25 0 01-2.25 2.25H11a3 3 0 01-5.564-1.566z"/></svg>Render &amp; Publish to Social
        </button>
      </div>
    </div>
    </div>

    <!-- Main Workspace Body -->
    <div class="flex-1 flex overflow-hidden relative">
      <!-- Left Tool Rail -->
      <nav class="w-16 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col items-center py-3 gap-3 flex-shrink-0 z-10">
        <button onclick="setStudioTool('templates')" id="tool-btn-templates" class="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition ${window.__studioActiveTool==='templates'?'bg-indigo-600/30 text-indigo-400 border border-indigo-500/50':''}">
          <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>Templates
        </button>
        <button onclick="setStudioTool('inventory')" id="tool-btn-inventory" class="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition ${window.__studioActiveTool==='inventory'?'bg-indigo-600/30 text-indigo-400 border border-indigo-500/50':''}">
          <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 17a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4zM4 9h16l-1.5 5H5.5L4 9z"/></svg>Inventory
        </button>
        <button onclick="setStudioTool('photos')" id="tool-btn-photos" class="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition">
          <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>Photos
        </button>
        <button onclick="setStudioTool('videos')" id="tool-btn-videos" class="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"><span class="text-base">▶</span>Videos</button>
        <button onclick="setStudioTool('record')" id="tool-btn-record" class="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition ${window.__studioActiveTool==='record'?'bg-indigo-600/30 text-indigo-400 border border-indigo-500/50':''}"><span class="text-base">●</span>Record</button>
        <button onclick="setStudioTool('uploads')" id="tool-btn-uploads" class="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"><span class="text-base">↑</span>Uploads</button>
        <button onclick="setStudioTool('media')" id="tool-btn-media" class="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"><span class="text-base mb-0.5">▧</span>Media</button>
        <button onclick="setStudioTool('shapes')" id="tool-btn-shapes" class="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition">
          <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"/></svg>Shapes
        </button>
        <button onclick="setStudioTool('stickers')" id="tool-btn-stickers" class="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition">
          <span class="text-base mb-0.5">⭐</span>Stickers
        </button>
        <button onclick="setStudioTool('text')" id="tool-btn-text" class="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition ${window.__studioActiveTool==='text'?'bg-indigo-600/30 text-indigo-400 border border-indigo-500/50':''}">
          <span class="text-base font-black">Aa</span>Text
        </button>
        <button onclick="setStudioTool('brand')" id="tool-btn-brand" class="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition">
          <svg class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 7h10M7 12h10m-7 5h7"/></svg>Brand
        </button>
        <button onclick="setStudioTool('layers')" id="tool-btn-layers" class="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"><span class="text-base mb-0.5">≡</span>Layers</button>
      </nav>

      <!-- Left Tool Panel Drawer -->
      <aside class="w-60 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col flex-shrink-0 z-10 overflow-y-auto transition-all duration-200" id="studio-tool-panel">
        <div class="flex items-center justify-between p-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
          <span class="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Tool Drawer</span>
          <button type="button" onclick="toggleStudioToolPanel()" class="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-bold px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="Collapse Tool Panel">&lt;</button>
        </div>
        ${renderStudioToolPanelContent(window.__studioActiveTool)}
      </aside>

      <!-- Center Artboard Viewport Canvas -->
      <main id="studio-canvas-viewport" class="flex-1 min-w-0 bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
        <div id="studio-artboard-container" class="absolute left-1/2 top-1/2 shadow-2xl rounded-2xl overflow-hidden border-4 border-blue-500/70 bg-white dark:bg-slate-900 ring-4 ring-blue-500/20 transition-transform duration-200 origin-center" style="width:${scene.width}px; height:${scene.height}px; transform:translate(-50%, -50%) scale(0.55);">
          <canvas id="studio-main-canvas"></canvas>
          ${renderStudioSafeGuides(scene.format_key || 'square')}
        </div>
      </main>

      <!-- Right Property Inspector & Layer Controls -->
      <aside class="w-60 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col flex-shrink-0 p-3 z-10 overflow-y-auto transition-all duration-200" id="studio-inspector-panel">
        <div class="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-200 dark:border-slate-800">
          <span class="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Inspector</span>
          <button type="button" onclick="toggleStudioInspectorPanel()" class="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-bold px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="Collapse Inspector">&gt;</button>
        </div>
        ${renderStudioInspectorHtml(null)}
      </aside>
    </div>
    <footer class="h-16 flex-shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-3 flex items-center gap-2 overflow-x-auto z-30">
      <span class="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Pages</span>
      <select onchange="setStudioPage(this.value)" class="max-w-28 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold">${(scene.pages || [{ id: 'page-1', name: 'Page 1' }]).map((page, index) => `<option value="${escS(page.id || `page-${index + 1}`)}">${escS(page.name || `Page ${index + 1}`)}</option>`).join('')}</select>
      <button onclick="addStudioPage()" class="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-xs font-black">+ Page</button>
      <div class="h-7 w-px bg-slate-300 dark:bg-slate-700 mx-1"></div>
      <span class="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1">Text</span>
      <button onclick="studioAddText('heading')" class="whitespace-nowrap px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-black">+ Heading</button>
      <button onclick="studioAddText('subheading')" class="whitespace-nowrap px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold">+ Subheading</button>
      <button onclick="studioAddText('body')" class="whitespace-nowrap px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium">+ Body text</button>
      <div class="h-7 w-px bg-slate-300 dark:bg-slate-700 mx-1"></div>
      <label class="text-[11px] text-slate-500 dark:text-slate-400 font-bold">Size</label>
      <select onchange="studioSetTextStyle('fontSize', Number(this.value))" class="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs"><option>18</option><option>24</option><option selected>36</option><option>48</option><option>64</option><option>88</option></select>
      <button onclick="studioSetTextStyle('fontWeight', '900')" class="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-black">B</button>
      <label class="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold">Colour <input type="color" value="#ffffff" onchange="studioSetTextStyle('fill', this.value)" class="w-6 h-6 rounded cursor-pointer bg-transparent"></label>
      <span id="studio-text-hint" class="ml-auto whitespace-nowrap text-[11px] text-slate-500 dark:text-slate-400">Select text to format it</span>
    </footer>
  `;
}

// Every 'vehicle-image' element below carries a real fallback `src` (a free library
// photo) so a template shows a fully styled example the moment it loads — before that,
// with no src and no bound vehicle, fabric-adapter.js's render condition
// `(el.src || currentVehicle?.primary_photo_url)` was false and the whole photo slot
// rendered as nothing, a blank hole in the layout. Binding a real vehicle
// (bindVehicleToStudio()) doesn't touch this src — it layers a new image + badge +
// text on top instead — so the fallback photo stays as a backdrop unless the user
// deletes it, same as any other placeholder asset.
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
        { id: 'el-bg-photo', type: 'vehicle-image', src: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=82', x: 0, y: 0, width: 1080, height: 720, fit: 'cover', opacity: 1, z: 1, name: 'Vehicle Photo' },
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
        { id: 'el-photo', type: 'vehicle-image', src: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1600&q=82', x: 0, y: 200, width: 1080, height: 1100, fit: 'cover', opacity: 1, z: 1, name: 'Vehicle Photo' },
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
        { id: 'el-photo', type: 'vehicle-image', src: 'https://images.unsplash.com/photo-1562141961-b5d64a7b61c0?auto=format&fit=crop&w=1600&q=82', x: 0, y: 0, width: 620, height: 628, fit: 'cover', opacity: 1, z: 1, name: 'Vehicle Photo' },
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
        { id: 'el-photo', type: 'vehicle-image', src: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1600&q=82', x: 0, y: 120, width: 1080, height: 780, fit: 'cover', opacity: 1, z: 3, name: 'Vehicle Photo' },
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
        { id: 'el-photo', type: 'vehicle-image', src: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1600&q=82', x: 60, y: 220, width: 960, height: 560, fit: 'cover', opacity: 1, z: 3, name: 'Vehicle Photo' },
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
        { id: 'el-photo', type: 'vehicle-image', src: 'https://images.unsplash.com/photo-1592833159155-c62df1b65634?auto=format&fit=crop&w=1600&q=82', x: 0, y: 160, width: 1080, height: 1100, fit: 'cover', opacity: 1, z: 3, name: 'Vehicle Photo' },
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

// Every template used to preview as the exact same generic blue gradient with the
// exact same "YOUR CAMPAIGN STARTS HERE" caption — none of the 9+ templates looked
// any different from each other in the picker. Build a real gradient from each
// template's OWN scene colors (background + its most prominent shape fills) instead,
// so the card actually shows what that template looks like.
function templatePreviewGradient(tmpl) {
  const bg = tmpl.scene?.background?.color || '#0f172a';
  const fills = (tmpl.scene?.elements || [])
    .filter(e => e.type === 'shape' && e.fill && e.opacity !== 0 && e.fill !== bg);
  const accent = fills[0]?.fill || '#2563eb';
  const accent2 = fills.slice().reverse().find(e => e.fill !== accent)?.fill || accent;
  return `linear-gradient(135deg, ${bg}, ${accent} 58%, ${accent2})`;
}

function renderStudioTemplateCards(filter = 'all') {
  return Object.values(STUDIO_TEMPLATES_CATALOG).filter(t => filter === 'all' || t.format_key === filter).map(t => {
    const preview = t.preview || templatePreviewGradient(t);
    const format = STUDIO_SOCIAL_FORMATS[t.format_key];
    return `<button onclick="loadStudioTemplate('${t.template_key}')" class="w-full text-left rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 hover:border-blue-500 transition group"><div style="height:104px;background:${preview}" class="relative p-3"><span class="absolute left-2 top-2 px-2 py-1 rounded-lg bg-slate-950/75 text-[9px] font-black text-blue-200">${format ? `${format.w}×${format.h}` : 'READY'}</span><div class="absolute left-3 right-3 bottom-3 text-white font-black text-sm leading-tight drop-shadow">${escS(t.name)}</div></div><div class="p-3"><div class="text-xs font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-300">${t.name}</div><div class="mt-1 text-[10px] text-slate-500 dark:text-slate-400">${t.desc}</div></div></button>`;
  }).join('');
}

function renderStudioToolPanelContent(tool) {
  if (tool === 'media') {
    return `<div class="p-4 space-y-3"><div><h3 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Media library</h3><p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Reusable dealership images and videos. Select an asset to place it on the artboard.</p></div><input id="studio-media-query" oninput="filterStudioMediaLibrary(this.value)" placeholder="Search your media…" class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"><div id="studio-media-library" class="grid grid-cols-2 gap-2"><div class="col-span-2 p-5 text-center text-xs text-slate-500">Loading media…</div></div></div>`;
  }
  if (tool === 'layers') {
    const objects = window.__studioAdapter?.fabricCanvas?.getObjects?.() || [];
    const rows = objects.slice().reverse().map((object, reversedIndex) => {
      const index = objects.length - reversedIndex - 1;
      const label = object.msData?.name || object.text || `${object.type || 'Object'} ${index + 1}`;
      return `<button type="button" onclick="selectStudioLayer(${index})" class="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600/30 border border-slate-300 dark:border-slate-700 text-left text-xs font-bold text-slate-900 dark:text-white"><span class="text-[10px] text-sky-400">${object.type === 'textbox' ? 'T' : object.type === 'image' ? '▧' : '◇'}</span><span class="truncate">${escS(label)}</span></button>`;
    }).join('');
    const structures = window.__studioAdapter?.currentScene?.components || [];
    return `<div class="p-4 space-y-3"><div><h3 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Layers</h3><p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Select and reorder the current page. Groups and component children remain part of the document model.</p></div><div class="grid grid-cols-2 gap-2"><button type="button" onclick="addStudioStructure('component')" class="px-2 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[10px] font-black text-white">+ Component</button><button type="button" onclick="addStudioStructure('repeater')" class="px-2 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-[10px] font-black text-white">+ Repeater</button></div><div class="space-y-1.5 max-h-[55vh] overflow-y-auto">${rows || '<p class="text-xs text-slate-500">No layers yet.</p>'}</div>${structures.length ? `<div class="pt-2 border-t border-slate-800"><div class="text-[10px] font-black uppercase text-sky-400 mb-1">Structured elements</div>${structures.map(item => `<div class="text-xs text-slate-300 py-1">${item.type === 'repeater' ? '↻' : '◇'} ${escS(item.name)}</div>`).join('')}</div>` : ''}</div>`;
  }
  if (tool === 'templates') {
    return `
      <div class="p-4 space-y-3">
        <div><h3 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Social Templates</h3><p class="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Ready-made layouts with gradients, shapes and safe text placement.</p></div>
        <select onchange="filterStudioTemplates(this.value)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"><option value="all">All social sizes</option>${Object.entries(STUDIO_SOCIAL_FORMATS).map(([key,f]) => `<option value="${key}">${f.label}</option>`).join('')}</select>
        <div id="studio-template-cards" class="space-y-3">${renderStudioTemplateCards()}</div>
        <div class="pt-3 mt-1 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <h4 class="text-[11px] font-black uppercase tracking-wider text-sky-400">✦ Generate a template</h4>
          <p class="text-[10px] text-slate-500 dark:text-slate-400 -mt-1">Replaces everything currently on the canvas.</p>
          <textarea id="studio-ai-template-prompt" rows="3" placeholder="Example: Bold red price-drop banner with room for a headline and a call-to-action button" class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white resize-none"></textarea>
          <button onclick="generateStudioAiTemplate()" id="studio-ai-template-generate" class="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-black">✦ Generate template</button>
        </div>
      </div>
    `;
  } else if (tool === 'inventory') {
    return `
      <div class="p-4 space-y-3">
        <h3 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Create from vehicle</h3>
        <p class="text-[11px] text-slate-500 dark:text-slate-400 -mt-1">Pick a vehicle — its photo and details fill an automotive template, ready to edit and schedule.</p>
        <input type="text" placeholder="Search stock #, VIN, year make model..." oninput="searchStudioInventory(this.value)" class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white">
        <div class="space-y-2" id="studio-inventory-list">
          <button onclick="createFromVehicle('demo_v1')" class="w-full text-left p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-xs font-black text-indigo-400">VEH</div>
            <div class="min-w-0 flex-1">
              <div class="text-xs font-bold text-slate-900 dark:text-white">2024 Ford F-150 Lariat</div>
              <div class="text-[11px] text-emerald-400 font-bold">$54,990 • STK #F9041</div>
            </div>
          </button>
        </div>
      </div>
    `;
  } else if (tool === 'photos') {
    return `
      <div class="p-4 space-y-3">
        <div><h3 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Pexels Photos</h3><p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Search the free Pexels library and add a photo directly.</p></div>
        <form onsubmit="event.preventDefault(); searchStudioLibrary(document.getElementById('studio-photo-query').value)" class="flex gap-2"><input id="studio-photo-query" type="search" value="car dealership" placeholder="Search photos..." class="min-w-0 flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"><button class="px-3 rounded-xl bg-blue-600 text-xs font-black">Search</button></form>
        <div class="grid grid-cols-2 gap-2 pt-2" id="studio-photo-results"><div class="col-span-2 p-5 text-center text-xs text-slate-500 dark:text-slate-400">Loading Pexels photos…</div></div>
        <a href="https://www.pexels.com" target="_blank" rel="noopener" class="block text-center text-[10px] font-bold text-sky-400 hover:underline">Photos provided by Pexels</a>
        <div class="pt-3 mt-1 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <h4 class="text-[11px] font-black uppercase tracking-wider text-sky-400">✦ Generate an image</h4>
          <textarea id="studio-ai-image-prompt" rows="3" placeholder="Example: A clean studio shot of a silver SUV on a white background" class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white resize-none"></textarea>
          <button onclick="generateStudioAiImage()" id="studio-ai-image-generate" class="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-black">✦ Generate image</button>
          <div id="studio-ai-image-result" class="hidden"></div>
        </div>
      </div>
    `;
  } else if (tool === 'videos') {
    return `<div class="p-4 space-y-3"><div><h3 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Pexels Videos</h3><p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Search free video clips and place them on the canvas.</p></div><form onsubmit="event.preventDefault(); searchStudioVideos(document.getElementById('studio-video-query').value)" class="flex gap-2"><input id="studio-video-query" type="search" value="car dealership" placeholder="Search videos..." class="min-w-0 flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"><button class="px-3 rounded-xl bg-blue-600 text-xs font-black">Search</button></form><div class="space-y-3" id="studio-video-results"><div class="p-5 text-center text-xs text-slate-500 dark:text-slate-400">Loading Pexels videos…</div></div><a href="https://www.pexels.com/videos/" target="_blank" rel="noopener" class="block text-center text-[10px] font-bold text-sky-400 hover:underline">Videos provided by Pexels</a></div>`;
  } else if (tool === 'uploads') {
    return `<div class="p-4 space-y-3"><div><h3 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Your Video Uploads</h3><p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Upload video files up to 200 MB and reuse them here.</p></div><label class="block p-4 rounded-xl border-2 border-dashed border-blue-500/50 bg-blue-500/10 text-center cursor-pointer hover:bg-blue-500/20"><span class="block text-xl mb-1">↑</span><span class="text-xs font-black">Upload your video</span><input type="file" accept="video/*" class="hidden" onchange="uploadStudioVideo(this)"></label><div id="studio-upload-status" class="hidden text-xs text-center text-sky-400"></div><div id="studio-uploaded-videos" class="space-y-3"><div class="p-5 text-center text-xs text-slate-500 dark:text-slate-400">Loading your videos…</div></div></div>`;
  } else if (tool === 'record') {
    return `
      <div class="p-4 space-y-3">
        <div>
          <h3 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Teleprompter Record</h3>
          <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Write the script, then record with a see-through teleprompter. Marketing can use this for ads, reels, and lot updates.</p>
        </div>
        <textarea id="studio-tp-script" rows="7" class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white" placeholder="Type the words you want on camera…"></textarea>
        <button type="button" onclick="openStudioTeleprompterRecorder(document.getElementById('studio-tp-script')?.value)" class="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black">Open camera + teleprompter</button>
      </div>`;
  } else if (tool === 'shapes') {
    return `
      <div class="p-4 space-y-3">
        <h3 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Shapes &amp; Badges</h3>
        <div class="grid grid-cols-3 gap-2">${[['rect','Rectangle'],['badge','Rounded'],['circle','Circle'],['ellipse','Ellipse'],['triangle','Triangle'],['diamond','Diamond'],['pentagon','Pentagon'],['hexagon','Hexagon'],['star','Star'],['line','Line'],['arrow','Arrow'],['heart','Heart'],['speech','Speech']].map(([id,label]) => `<button onclick="studioAddShape('${id}')" title="${label}" class="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-center flex flex-col items-center gap-1.5"><span class="text-slate-700 dark:text-slate-200">${STUDIO_SHAPE_PREVIEW[id]}</span><span class="text-[10px] font-bold">${label}</span></button>`).join('')}</div>
        <div class="border-t border-slate-200 dark:border-slate-800 pt-3"><h4 class="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Draw</h4><div class="grid grid-cols-2 gap-2"><button onclick="studioDrawingMode('pen')" class="p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-black">Pen</button><button onclick="studioDrawingMode('pencil')" class="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-black">Pencil</button></div><button onclick="studioSelectMode()" class="mt-2 w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold">Select &amp; move objects</button></div>
      </div>
    `;
  } else if (tool === 'stickers') {
    return `
      <div class="p-4 space-y-3">
        <div><h3 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Stickers &amp; Clip Art</h3><p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Click to drop a sticker on the canvas — drag to resize once placed.</p></div>
        <div class="grid grid-cols-4 gap-2">${STUDIO_STICKERS.map(s => `<button onclick="studioAddSticker('${s}')" title="Add sticker" class="aspect-square rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-2xl transition">${s}</button>`).join('')}</div>
      </div>
    `;
  } else if (tool === 'text') {
    return `
      <div class="p-4 space-y-5">
        <div><h3 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Text</h3><p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Generate copy with AI, then pick a font and add it to the canvas.</p></div>

        <div class="space-y-2 pb-4 border-b border-slate-200 dark:border-slate-800">
          <h4 class="text-[11px] font-black uppercase tracking-wider text-sky-400">✦ Generate copy</h4>
          <textarea id="studio-ai-prompt" rows="3" placeholder="Example: Write a short summer sales headline for our SUV event" class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white resize-none"></textarea>
          <button onclick="generateStudioAiCopy()" id="studio-ai-generate" class="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-black">✦ Generate content</button>
          <div id="studio-ai-result" class="hidden p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap"></div>
        </div>

        <div class="space-y-2">
          <h4 class="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Fonts</h4>
          <p class="text-[10px] text-slate-500 dark:text-slate-400 -mt-1">Pick a font — applies to selected text, or the next text you add.</p>
          <div class="space-y-1.5" id="studio-font-picker">${STUDIO_GOOGLE_FONTS.map(f => `<button type="button" data-font="${escS(f)}" onclick="studioPickFont('${f.replace(/'/g, "\\'")}')" style="font-family:'${escS(f)}', sans-serif" class="w-full text-left px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white transition">${escS(f)}</button>`).join('')}</div>
        </div>
      </div>
    `;
  } else if (tool === 'brand') {
    const storeName = window.__dealerConfig?.store_name || 'MarketSync Motors';
    return `
      <div class="p-4 space-y-3">
        <h3 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Dealership Brand Kit</h3>
        <div class="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 space-y-2">
          <div class="text-xs font-bold text-slate-900 dark:text-white">${escS(storeName)}</div>
          <button onclick="if(window.__studioAdapter) window.__studioAdapter.addImage('/assets/brand/marketsync-logo-primary.png', 'MarketSync Logo')" class="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold">
            + Insert Dealership Logo
          </button>
        </div>
      </div>
    `;
  }
  return '';
}

function selectStudioLayer(index) {
  const canvas = window.__studioAdapter?.fabricCanvas;
  const object = canvas?.getObjects?.()[index];
  if (!canvas || !object) return;
  canvas.discardActiveObject(); canvas.setActiveObject(object); canvas.requestRenderAll();
  window.__studioAdapter?.onSelectionChange([object]);
}
window.selectStudioLayer = selectStudioLayer;

function addStudioStructure(type) {
  const adapter = window.__studioAdapter;
  if (!adapter?.currentScene || !window.msStudioSceneToDocument) return;
  const document = window.msStudioSceneToDocument(adapter.exportScene());
  const item = type === 'repeater'
    ? window.msStudioCreateRepeater('Inventory repeater', 'inventory', { type: 'vehicle-card', fields: ['year', 'make', 'model', 'price'] })
    : window.msStudioCreateComponent('Reusable component', []);
  document.components = [...(document.components || []), item];
  adapter.currentScene = window.msStudioDocumentToScene(document);
  window.__msStudioStore?.update(document);
  if (window.msStudioScheduleAutosave) window.msStudioScheduleAutosave(adapter.currentScene);
  setStudioTool('layers');
  if (typeof showToast === 'function') showToast(`${type === 'repeater' ? 'Repeater' : 'Component'} added`, 'success');
}
window.addStudioStructure = addStudioStructure;

function renderStudioInspectorHtml(selected) {
  const object = Array.isArray(selected) ? selected[0] : selected;
  const color = typeof object?.fill === 'string' && object.fill.startsWith('#') ? object.fill : (typeof object?.stroke === 'string' && object.stroke.startsWith('#') ? object.stroke : '#2563eb');
  const opacity = Math.round((object?.opacity ?? 1) * 100);
  return `
    <h3 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-3">Property Inspector</h3>
    <div class="space-y-3">
      <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
        <div class="grid grid-cols-2 gap-2"><label class="text-[10px] font-bold text-slate-500">X<input type="number" value="${Math.round(object?.left || 0)}" onchange="studioSetObjectGeometry('left', this.value)" class="mt-1 w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"></label><label class="text-[10px] font-bold text-slate-500">Y<input type="number" value="${Math.round(object?.top || 0)}" onchange="studioSetObjectGeometry('top', this.value)" class="mt-1 w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"></label><label class="text-[10px] font-bold text-slate-500">Width<input type="number" value="${Math.round(object?.getScaledWidth?.() || object?.width || 0)}" onchange="studioSetObjectGeometry('width', this.value)" class="mt-1 w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"></label><label class="text-[10px] font-bold text-slate-500">Height<input type="number" value="${Math.round(object?.getScaledHeight?.() || object?.height || 0)}" onchange="studioSetObjectGeometry('height', this.value)" class="mt-1 w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"></label></div>
        <div><label class="text-[11px] font-bold text-slate-500 dark:text-slate-400">Colour</label><input type="color" value="${color}" onchange="studioSetObjectStyle('color', this.value)" class="mt-1 w-full h-9 rounded-lg bg-transparent cursor-pointer"></div>
        <div><div class="flex justify-between"><label class="text-[11px] font-bold text-slate-500 dark:text-slate-400">Transparency</label><span id="studio-opacity-value" class="text-[11px] text-sky-400">${100-opacity}%</span></div><input type="range" min="0" max="100" value="${opacity}" oninput="document.getElementById('studio-opacity-value').textContent=(100-Number(this.value))+'%'" onchange="studioSetObjectStyle('opacity', Number(this.value)/100)" class="w-full accent-blue-500"></div>
      </div>
      <button onclick="studioToggleNodes()" class="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black">Edit vector nodes</button>
      <div class="space-y-1">
        <label class="text-[11px] font-bold text-slate-500 dark:text-slate-400">Layer Order:</label>
        <div class="flex gap-2">
          <button onclick="if(window.__studioAdapter) window.__studioAdapter.bringForward()" class="flex-1 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold">Bring Forward</button>
          <button onclick="if(window.__studioAdapter) window.__studioAdapter.sendBackwards()" class="flex-1 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold">Send Back</button>
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
      if (window.msStudioScheduleAutosave) window.msStudioScheduleAutosave(window.__studioAdapter.exportScene());
    }
  });

  await window.__studioAdapter.init(scene, window.__studioCurrentVehicle);
  wireStudioContextMenu(window.__studioAdapter);
}

// Right-click on the artboard — the same actions already on the toolbar/keyboard
// shortcuts (Copy/Cut/Paste/Duplicate, layer order, Group/Ungroup, Delete), just
// reachable without knowing the shortcut exists.
function wireStudioContextMenu(adapter) {
  const canvas = adapter?.fabricCanvas;
  if (!canvas?.upperCanvasEl) return;
  canvas.upperCanvasEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const target = canvas.findTarget(e, false);
    if (target && !canvas.getActiveObjects().includes(target)) {
      canvas.discardActiveObject();
      canvas.setActiveObject(target);
      canvas.requestRenderAll();
    } else if (!target) {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    }
    showStudioContextMenu(e.clientX, e.clientY, !!target);
  });
}

function closeStudioContextMenu() {
  document.getElementById('studio-context-menu')?.remove();
  document.removeEventListener('keydown', studioContextMenuEscape);
}
window.closeStudioContextMenu = closeStudioContextMenu;
function studioContextMenuEscape(e) { if (e.key === 'Escape') closeStudioContextMenu(); }

function showStudioContextMenu(x, y, hasTarget) {
  closeStudioContextMenu();
  const adapter = window.__studioAdapter;
  const active = adapter?.fabricCanvas?.getActiveObject();
  const isSelection = active?.type === 'activeSelection';
  const isGroup = active?.type === 'group';
  const item = (label, method, opts = {}) => `<button type="button" onclick="studioCtxAction('${method}')" ${opts.disabled ? 'disabled' : ''} class="w-full text-left px-3 py-1.5 flex items-center justify-between gap-4 transition ${opts.disabled ? 'opacity-40 cursor-default' : 'hover:bg-slate-100 dark:hover:bg-slate-800'} ${opts.danger && !opts.disabled ? 'text-rose-400' : ''}"><span>${label}</span>${opts.shortcut ? `<span class="text-[10px] text-slate-500 dark:text-slate-400 font-mono">${opts.shortcut}</span>` : ''}</button>`;
  const divider = '<div class="my-1 border-t border-slate-200 dark:border-slate-800"></div>';
  const menu = document.createElement('div');
  menu.id = 'studio-context-menu';
  menu.className = 'fixed z-[100000] min-w-[190px] py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xl text-xs font-bold text-slate-700 dark:text-slate-200';
  menu.innerHTML = [
    item('Copy', 'copySelected', { disabled: !hasTarget, shortcut: 'Ctrl+C' }),
    item('Cut', 'cutSelected', { disabled: !hasTarget, shortcut: 'Ctrl+X' }),
    item('Paste', 'pasteClipboard', { disabled: !adapter?._clipboard, shortcut: 'Ctrl+V' }),
    item('Duplicate', 'duplicateSelected', { disabled: !hasTarget, shortcut: 'Ctrl+D' }),
    divider,
    item('Bring to Front', 'bringToFront', { disabled: !hasTarget }),
    item('Bring Forward', 'bringForward', { disabled: !hasTarget }),
    item('Send Backward', 'sendBackwards', { disabled: !hasTarget }),
    item('Send to Back', 'sendToBack', { disabled: !hasTarget }),
    divider,
    item('Group', 'groupSelected', { disabled: !isSelection, shortcut: 'Ctrl+G' }),
    item('Ungroup', 'ungroupSelected', { disabled: !isGroup, shortcut: 'Ctrl+Shift+G' }),
    divider,
    item('Delete', 'deleteSelected', { disabled: !hasTarget, danger: true }),
  ].join('');
  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`;
  setTimeout(() => {
    document.addEventListener('click', closeStudioContextMenu, { once: true });
    document.addEventListener('keydown', studioContextMenuEscape);
  }, 0);
}
window.showStudioContextMenu = showStudioContextMenu;

function studioCtxAction(method) {
  closeStudioContextMenu();
  const adapter = window.__studioAdapter;
  if (adapter && typeof adapter[method] === 'function') adapter[method]();
}
window.studioCtxAction = studioCtxAction;

function setStudioTool(tool) {
  window.__studioActiveTool = tool;
  const panel = document.getElementById('studio-tool-panel');
  if (panel) panel.innerHTML = renderStudioToolPanelContent(tool);
  if (tool === 'photos') setTimeout(() => searchStudioLibrary('car dealership'), 0);
  if (tool === 'videos') setTimeout(() => searchStudioVideos('car dealership'), 0);
  if (tool === 'uploads') setTimeout(loadStudioUploadedVideos, 0);
  if (tool === 'media') setTimeout(loadStudioMediaLibrary, 0);
  if (tool === 'text') setTimeout(loadStudioGoogleFonts, 0);
}

let __studioMediaAssets = [];
async function loadStudioMediaLibrary() {
  const target = document.getElementById('studio-media-library'); if (!target) return;
  try {
    const data = await apiGetJson('/marketing/assets');
    __studioMediaAssets = data?.assets || [];
    filterStudioMediaLibrary(document.getElementById('studio-media-query')?.value || '');
  } catch (_) { target.innerHTML = '<div class="col-span-2 p-4 text-center text-xs text-rose-400">Media library unavailable.</div>'; }
}
function filterStudioMediaLibrary(query = '') {
  const target = document.getElementById('studio-media-library'); if (!target) return;
  const q = String(query).toLowerCase();
  const assets = __studioMediaAssets.filter(asset => `${asset.title || ''} ${asset.alt_text || ''}`.toLowerCase().includes(q));
  target.innerHTML = assets.length ? assets.map(asset => {
    const src = asset.public_url || asset.url; const isVideo = asset.kind === 'video';
    return `<button type="button" onclick="addLibrary${isVideo ? 'Video' : 'Image'}ToCanvas('${escS(src)}','${escS(asset.title || 'Media asset')}')" class="relative overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-left hover:border-indigo-500"><${isVideo ? 'video' : 'img'} src="${escS(src)}" ${isVideo ? 'muted preload="metadata"' : `alt="${escS(asset.alt_text || asset.title || '')}"`} class="w-full aspect-square object-cover"></${isVideo ? 'video' : 'img'}><span class="block px-2 py-1 text-[9px] truncate text-slate-700 dark:text-slate-200">${escS(asset.title || 'Untitled')}</span></button>`;
  }).join('') : '<div class="col-span-2 p-4 text-center text-xs text-slate-500">No matching media.</div>';
}
window.loadStudioMediaLibrary = loadStudioMediaLibrary;
window.filterStudioMediaLibrary = filterStudioMediaLibrary;

function studioSetObjectGeometry(property, value) {
  const object = window.__studioAdapter?.fabricCanvas?.getActiveObject(); const number = Number(value);
  if (!object || !Number.isFinite(number) || number < 0) return;
  if (property === 'width') object.scaleToWidth(Math.max(1, number));
  else if (property === 'height') object.scaleToHeight(Math.max(1, number));
  else object.set(property, number);
  const breakpoint = window.__studioAdapter?.activeBreakpoint || 'desktop';
  if (breakpoint !== 'desktop') {
    object.msData = object.msData || {};
    object.msData.responsive = object.msData.responsive || {};
    object.msData.responsive[breakpoint] = { ...(object.msData.responsive[breakpoint] || {}), [property]: number };
  }
  object.setCoords(); window.__studioAdapter?.fabricCanvas?.requestRenderAll(); window.__studioAdapter?.saveHistory();
}
window.studioSetObjectGeometry = studioSetObjectGeometry;

function setStudioPage(pageId) { window.__studioAdapter?.setPage(pageId); }
window.setStudioPage = setStudioPage;
function addStudioPage() {
  const adapter = window.__studioAdapter; if (!adapter?.currentScene || !window.msStudioAddPage) return;
  const doc = window.msStudioAddPage(window.msStudioSceneToDocument(adapter.exportScene()));
  adapter.currentScene = window.msStudioDocumentToScene(doc); adapter.activePageId = doc.pages[doc.pages.length - 1].id;
  adapter.renderScene(adapter.currentScene); window.__studioDocument = doc; window.__msStudioStore?.update(doc);
  const select = document.querySelector('footer select'); if (select) { select.innerHTML = doc.pages.map(page => `<option value="${escS(page.id)}">${escS(page.name)}</option>`).join(''); select.value = adapter.activePageId; }
  if (typeof showToast === 'function') showToast('New page added', 'success');
}
window.addStudioPage = addStudioPage;

// The dealership photo for a vehicle, across the field names inventory returns.
function studioVehiclePhoto(v) {
  if (!v) return null;
  return v.primary_photo_url || v.photo_url || v.image_url
    || (Array.isArray(v.photos) && v.photos.length ? (v.photos[0]?.url || v.photos[0]) : null) || null;
}

async function loadStudioTemplate(tmplKey) {
  const tmpl = STUDIO_TEMPLATES_CATALOG[tmplKey] || STUDIO_TEMPLATES_CATALOG.tmpl_spotlight_square;
  const scene = JSON.parse(JSON.stringify(tmpl.scene));

  // If a vehicle is selected (e.g. via "Create from vehicle"), populate the template
  // with its real photo and details instead of the template's stock placeholder photo.
  const veh = window.__studioCurrentVehicle;
  if (veh) {
    if (window.__studioAdapter) window.__studioAdapter.currentVehicle = veh;  // resolves {{vehicle.*}}
    const photo = studioVehiclePhoto(veh);
    if (photo && Array.isArray(scene.elements)) {
      scene.elements.forEach(el => { if (el.type === 'vehicle-image') el.src = photo; });
    }
  }

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

// "Create from vehicle" quick-start: pick a vehicle from dealership inventory, pull its
// photo + details, drop them into an automotive template, and hand off to editing (and
// then the social scheduler). Reuses loadStudioTemplate — no separate editor. Defaults to
// the square vehicle spotlight when no template is specified.
async function createFromVehicle(vehicleId, tmplKey) {
  const inv = (ENGINE_DATA && ENGINE_DATA['marketing-overview']?.inventory) || [];
  const v = inv.find(x => x.id === vehicleId) || window.__studioCurrentVehicle
    || { id: vehicleId || 'demo_v1', year: 2024, make: 'Ford', model: 'F-150 Lariat', price: 54990, stock_number: 'F9041' };
  window.__studioCurrentVehicle = v;
  if (window.__studioAdapter) window.__studioAdapter.currentVehicle = v;
  if (typeof setStudioTool === 'function') setStudioTool('templates');   // show the template rail
  await loadStudioTemplate(tmplKey || 'tmpl_spotlight_square');          // populates with the vehicle
  const ymm = `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim();
  if (typeof showToast === 'function') showToast(`Created a design from ${ymm || 'the vehicle'} — edit it, then schedule.`, 'success');
}
window.createFromVehicle = createFromVehicle;

function searchStudioInventory(query) {
  const listEl = document.getElementById('studio-inventory-list');
  if (!listEl) return;
  const q = (query || '').toLowerCase().trim();
  const inv = (ENGINE_DATA && ENGINE_DATA['marketing-overview']?.inventory || [
    { id: 'demo_v1', year: 2024, make: 'Ford', model: 'F-150 Lariat', price: 54990, stocknumber: 'F9041' },
    { id: 'demo_v2', year: 2024, make: 'Honda', model: 'Civic Touring', price: 29850, stocknumber: 'H1022' }
  ]).filter(v => !q || `${v.year} ${v.make} ${v.model} ${v.stocknumber} ${v.vin || ''}`.toLowerCase().includes(q));

  listEl.innerHTML = inv.map(v => `
    <button onclick="createFromVehicle('${v.id}')" class="w-full text-left p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition flex items-center gap-3">
      <div class="w-10 h-10 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-xs font-black text-indigo-400">VEH</div>
      <div class="min-w-0 flex-1">
        <div class="text-xs font-bold text-slate-900 dark:text-white truncate">${escS(`${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() || 'Vehicle')}</div>
        <div class="text-[11px] text-emerald-400 font-bold">$${Number(v.price || 0).toLocaleString()} • STK #${escS(v.stocknumber || '—')}</div>
      </div>
    </button>
  `).join('') || `<div class="text-xs text-slate-500 dark:text-slate-400 italic p-3">No matching inventory.</div>`;
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

// Search state — a fresh search resets to page 1 and replaces results; "Load More"
// keeps the query/page and appends the next page instead.
let __studioPhotoQuery = '', __studioPhotoPage = 1, __studioPhotoHasMore = false;
let __studioVideoQuery = '', __studioVideoPage = 1, __studioVideoHasMore = false;

function loadMoreButton(onclick, label) {
  return `<button type="button" onclick="${onclick}" id="studio-load-more-btn" class="col-span-2 w-full mt-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-black text-slate-900 dark:text-white transition">${label}</button>`;
}

async function searchStudioLibrary(query) {
  const target = document.getElementById('studio-photo-results');
  if (!target) return;
  __studioPhotoQuery = String(query || '').trim().toLowerCase();
  __studioPhotoPage = 1;
  target.innerHTML = '<div class="col-span-2 p-5 text-center text-xs text-slate-500 dark:text-slate-400">Searching Pexels…</div>';
  try {
    const data = await apiGetJson(`/marketing/studio/library/search?q=${encodeURIComponent(__studioPhotoQuery || 'car dealership')}&page=1`);
    const results = data?.results || [];
    __studioPhotoHasMore = results.length > 0 && results.length < (data?.total_results || 0);
    target.innerHTML = results.length ? renderPexelsResults(results) : '<div class="col-span-2 p-4 text-center text-xs text-slate-500 dark:text-slate-400">No matching Pexels photos.</div>';
    if (__studioPhotoHasMore) target.insertAdjacentHTML('beforeend', loadMoreButton('loadMoreStudioPhotos()', 'Load more photos'));
  } catch (error) {
    __studioPhotoHasMore = false;
    const fallback = STUDIO_FREE_PHOTOS.filter(photo => !__studioPhotoQuery || `${photo.keywords} ${photo.alt}`.toLowerCase().includes(__studioPhotoQuery));
    target.innerHTML = fallback.length ? renderStudioPhotoResults(fallback) : '<div class="col-span-2 p-4 text-center text-xs text-rose-400">Photo search is temporarily unavailable.</div>';
  }
}

async function loadMoreStudioPhotos() {
  const target = document.getElementById('studio-photo-results');
  const btn = document.getElementById('studio-load-more-btn');
  if (!target || !__studioPhotoHasMore) return;
  if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
  try {
    const nextPage = __studioPhotoPage + 1;
    const data = await apiGetJson(`/marketing/studio/library/search?q=${encodeURIComponent(__studioPhotoQuery || 'car dealership')}&page=${nextPage}`);
    const results = data?.results || [];
    __studioPhotoPage = nextPage;
    btn?.remove();
    if (results.length) target.insertAdjacentHTML('beforeend', renderPexelsResults(results));
    __studioPhotoHasMore = results.length > 0;
    if (__studioPhotoHasMore) target.insertAdjacentHTML('beforeend', loadMoreButton('loadMoreStudioPhotos()', 'Load more photos'));
  } catch (error) {
    if (btn) { btn.disabled = false; btn.textContent = 'Load more photos'; }
  }
}
window.loadMoreStudioPhotos = loadMoreStudioPhotos;

async function searchStudioVideos(query) {
  const target = document.getElementById('studio-video-results');
  if (!target) return;
  __studioVideoQuery = String(query || '').trim();
  __studioVideoPage = 1;
  target.innerHTML = '<div class="p-5 text-center text-xs text-slate-500 dark:text-slate-400">Searching Pexels videos…</div>';
  try {
    const data = await apiGetJson(`/marketing/studio/library/search?type=video&q=${encodeURIComponent(__studioVideoQuery || 'car dealership')}&page=1`);
    const results = data?.results || [];
    __studioVideoHasMore = results.length > 0 && results.length < (data?.total_results || 0);
    target.innerHTML = results.length ? renderStudioVideoResults(results) : '<div class="p-4 text-center text-xs text-slate-500 dark:text-slate-400">No matching videos.</div>';
    if (__studioVideoHasMore) target.insertAdjacentHTML('beforeend', loadMoreButton('loadMoreStudioVideos()', 'Load more videos'));
  } catch (error) {
    __studioVideoHasMore = false;
    target.innerHTML = `<div class="p-4 text-center text-xs text-rose-400">${escS(error.message || 'Video search is unavailable.')}</div>`;
  }
}

async function loadMoreStudioVideos() {
  const target = document.getElementById('studio-video-results');
  const btn = document.getElementById('studio-load-more-btn');
  if (!target || !__studioVideoHasMore) return;
  if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
  try {
    const nextPage = __studioVideoPage + 1;
    const data = await apiGetJson(`/marketing/studio/library/search?type=video&q=${encodeURIComponent(__studioVideoQuery || 'car dealership')}&page=${nextPage}`);
    const results = data?.results || [];
    __studioVideoPage = nextPage;
    btn?.remove();
    if (results.length) target.insertAdjacentHTML('beforeend', renderStudioVideoResults(results));
    __studioVideoHasMore = results.length > 0;
    if (__studioVideoHasMore) target.insertAdjacentHTML('beforeend', loadMoreButton('loadMoreStudioVideos()', 'Load more videos'));
  } catch (error) {
    if (btn) { btn.disabled = false; btn.textContent = 'Load more videos'; }
  }
}
window.loadMoreStudioVideos = loadMoreStudioVideos;

async function loadStudioUploadedVideos() {
  const target = document.getElementById('studio-uploaded-videos');
  if (!target) return;
  try {
    const data = await apiGetJson('/marketing/assets');
    const videos = (data?.assets || []).filter(asset => asset.kind === 'video');
    target.innerHTML = videos.length ? renderStudioVideoResults(videos, true) : '<div class="p-4 text-center text-xs text-slate-500 dark:text-slate-400">No uploaded videos yet.</div>';
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
  options.fontFamily = window.__studioSelectedFont;
  const copy = kind === 'heading' ? 'ADD A HEADING' : kind === 'subheading' ? 'Add a subheading' : 'Add body text';
  window.__studioAdapter.addText(copy, options);
}

function studioSetTextStyle(property, value) {
  if (!window.__studioAdapter?.updateSelectedText({ [property]: value })) {
    if (typeof showToast === 'function') showToast('Select a text box first', 'info');
  }
}

async function generateStudioAiCopy() {
  const prompt = document.getElementById('studio-ai-prompt')?.value?.trim();
  if (!prompt) { if (typeof showToast === 'function') showToast('Describe the content you want first', 'info'); return; }
  const btn = document.getElementById('studio-ai-generate');
  const result = document.getElementById('studio-ai-result');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }
  try {
    const response = await apiSendJson('/ai/studio-copy', 'POST', { prompt });
    const copy = String(response?.copy || '').trim();
    if (!copy) throw new Error('No content returned');
    if (result) {
      result.classList.remove('hidden');
      result.innerHTML = `${escS(copy)}<button type="button" onclick="studioAddGeneratedCopy()" class="mt-3 w-full py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold">Add to canvas</button>`;
      result.dataset.copy = copy;
    }
  } catch (error) {
    if (typeof showToast === 'function') showToast(error.message || 'AI content could not be generated', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✦ Generate content'; }
  }
}

// The backend returns a clear 503 if no image-gen provider key is configured
// for this server, surfaced here rather than pretending it worked.
async function generateStudioAiImage() {
  const prompt = document.getElementById('studio-ai-image-prompt')?.value?.trim();
  if (!prompt) { if (typeof showToast === 'function') showToast('Describe the image you want first', 'info'); return; }
  const btn = document.getElementById('studio-ai-image-generate');
  const result = document.getElementById('studio-ai-image-result');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }
  try {
    const response = await apiSendJson('/ai/studio-image', 'POST', { prompt });
    const url = response?.url;
    if (!url) throw new Error('No image returned');
    if (result) {
      result.classList.remove('hidden');
      result.innerHTML = `<img src="${escS(url)}" alt="${escS(prompt)}" class="w-full rounded-xl border border-slate-200 dark:border-slate-800 mb-2"><button type="button" onclick="addLibraryImageToCanvas('${escS(url)}', 'AI image')" class="w-full py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold">Add to canvas</button>`;
    }
  } catch (error) {
    if (typeof showToast === 'function') showToast(error.message || 'AI image could not be generated', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✦ Generate image'; }
  }
}
window.generateStudioAiImage = generateStudioAiImage;

// Replaces the whole scene with an AI-generated layout — same load path as
// picking a template from the library (renderScene), just with a
// server-generated scene instead of one from STUDIO_TEMPLATES_CATALOG.
async function generateStudioAiTemplate() {
  const prompt = document.getElementById('studio-ai-template-prompt')?.value?.trim();
  if (!prompt) { if (typeof showToast === 'function') showToast('Describe the template you want first', 'info'); return; }
  const btn = document.getElementById('studio-ai-template-generate');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }
  try {
    const current = window.__studioAdapter?.currentScene;
    const formatKey = document.getElementById('studio-format-picker')?.value || current?.format_key || 'square';
    const size = STUDIO_SOCIAL_FORMATS[formatKey] || { w: current?.width || 1080, h: current?.height || 1080 };
    const response = await apiSendJson('/ai/studio-template', 'POST', { prompt, format_key: formatKey, width: size.w, height: size.h });
    const scene = response?.scene;
    if (!scene) throw new Error('No template returned');
    if (window.__studioAdapter) await window.__studioAdapter.renderScene(scene);
    const container = document.getElementById('studio-artboard-container');
    if (container) { container.style.width = `${scene.width}px`; container.style.height = `${scene.height}px`; }
    updateStudioSafeGuides(scene.format_key || formatKey);
    zoomStudioFit();
    if (typeof showToast === 'function') showToast(`Loaded ${response.name || 'AI template'}`, 'success');
  } catch (error) {
    if (typeof showToast === 'function') showToast(error.message || 'AI template could not be generated', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✦ Generate template'; }
  }
}
window.generateStudioAiTemplate = generateStudioAiTemplate;

function studioAddGeneratedCopy() {
  const copy = document.getElementById('studio-ai-result')?.dataset?.copy;
  if (copy && window.__studioAdapter) window.__studioAdapter.addText(copy, { fontSize: 36, fontWeight: '800', width: 700, fontFamily: window.__studioSelectedFont });
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

function setStudioBreakpoint(breakpoint) {
  window.__studioAdapter?.setBreakpoint(breakpoint);
  document.querySelectorAll('[data-studio-breakpoint]').forEach(button => {
    const active = button.dataset.studioBreakpoint === breakpoint;
    button.classList.toggle('bg-indigo-600', active);
    button.classList.toggle('text-white', active);
    button.classList.toggle('font-black', active);
    button.classList.toggle('font-bold', !active);
  });
}
window.setStudioBreakpoint = setStudioBreakpoint;

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

// Renaming a design that already exists persists straight away, so the title in
// the header and the title in My Designs never disagree. A design that has not
// been saved yet has nothing to rename — the name it carries is picked up by the
// next save, which is where it becomes real.
async function saveStudioDesignName(name) {
  const clean = String(name || '').trim() || 'Untitled Design';
  const input = document.getElementById('studio-design-name');
  if (input && input.value !== clean) input.value = clean;
  const design = window.__studioCurrentDesign;
  if (!design?.id) return;
  if (design.name === clean) return;
  try {
    await apiSendJson(`/marketing/studio/designs/${design.id}`, 'PUT', { name: clean });
    design.name = clean;
    if (typeof showToast === 'function') showToast('Design renamed', 'success');
  } catch (e) {
    if (typeof showToast === 'function') showToast('Rename failed: ' + e.message, 'error');
  }
}
window.saveStudioDesignName = saveStudioDesignName;

async function saveStudioDesign() {
  if (!window.__studioAdapter) return;
  const scene = window.__studioAdapter.exportScene();
  const name = document.getElementById('studio-design-name')?.value || 'Untitled Design';

  const persistedScene = window.msStudioSceneToDocument ? window.msStudioSceneToDocument(scene, { title: name }) : scene;
  const payload = {
    name,
    format_key: scene.format_key || 'square',
    width: scene.width,
    height: scene.height,
    scene: persistedScene,
    change_summary: 'Saved Studio draft',
    vehicle_id: window.__studioCurrentVehicle?.id || null
  };

  try {
    if (window.__studioCurrentDesign?.id) {
      const res = await apiSendJson(`/marketing/studio/designs/${window.__studioCurrentDesign.id}`, 'PUT', payload);
      if (res?.design) window.__studioCurrentDesign = res.design;
    } else {
      const res = await apiSendJson('/marketing/studio/designs', 'POST', payload);
      if (res?.design) window.__studioCurrentDesign = res.design;
    }
    if (window.__msStudioStore) window.__msStudioStore.saved(persistedScene, window.__studioCurrentDesign?.id);
    const status = document.getElementById('studio-save-status');
    if (status) { status.textContent = 'SAVED'; status.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'; }
    if (typeof showToast === 'function') showToast('Design saved', 'success');
    return true;
  } catch (e) {
    if (typeof showToast === 'function') showToast('Save failed: ' + e.message, 'error');
    return false;
  }
}

async function publishStudioDesign() {
  if (!await saveStudioDesign()) return;
  const id = window.__studioCurrentDesign?.id;
  if (!id) return;
  try {
    const res = await apiSendJson(`/marketing/studio/designs/${id}/status`, 'POST', { status: 'published' });
    if (res?.design) window.__studioCurrentDesign = res.design;
    window.__msStudioStore?.setStatus('PUBLISHED', false);
    if (typeof showToast === 'function') showToast('Design published', 'success');
  } catch (e) { if (typeof showToast === 'function') showToast('Publish failed: ' + e.message, 'error'); }
}
window.publishStudioDesign = publishStudioDesign;

async function openStudioRevisionHistory() {
  const id = window.__studioCurrentDesign?.id;
  if (!id) { if (typeof showToast === 'function') showToast('Save the design once to create history', 'info'); return; }
  try {
    const res = await apiGetJson(`/marketing/studio/designs/${id}/revisions`);
    const revisions = res?.revisions || [];
    const rows = revisions.length ? revisions.map(rev => `<div class="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-700"><div class="min-w-0"><div class="text-sm font-bold text-white">Revision ${rev.revision_number}</div><div class="text-[11px] text-slate-400 truncate">${escS(rev.change_summary || 'Saved draft')} · ${new Date(rev.created_at).toLocaleString()}</div></div><button type="button" onclick="restoreStudioRevision('${rev.id}')" class="shrink-0 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-indigo-600 text-xs font-bold text-white">Restore</button></div>`).join('') : '<p class="text-sm text-slate-400">No saved revisions yet.</p>';
    if (typeof crmOverlay === 'function') crmOverlay(`<div class="p-5 space-y-4 max-w-xl"><div class="flex items-center justify-between"><h3 class="text-lg font-black text-white">Design history</h3><span class="text-xs text-slate-400">${revisions.length} checkpoints</span></div><p class="text-xs text-slate-400">Restoring creates a new draft revision, so published work remains protected.</p><div class="space-y-2 max-h-[55vh] overflow-y-auto">${rows}</div></div>`);
  } catch (e) { if (typeof showToast === 'function') showToast('History unavailable: ' + e.message, 'error'); }
}
window.openStudioRevisionHistory = openStudioRevisionHistory;

async function restoreStudioRevision(revisionId) {
  const id = window.__studioCurrentDesign?.id;
  if (!id) return;
  try {
    const res = await apiSendJson(`/marketing/studio/designs/${id}/revisions/${revisionId}/restore`, 'POST', {});
    if (res?.design) {
      window.__studioCurrentDesign = res.design;
      const scene = window.msStudioDocumentToScene ? window.msStudioDocumentToScene(res.design.scene) : res.design.scene;
      await window.__studioAdapter?.renderScene(scene);
      window.__msStudioStore?.saved(res.design.scene, res.design.id);
      document.getElementById('studio-design-name').value = res.design.name || document.getElementById('studio-design-name').value;
    }
    document.querySelector('[data-crm-overlay-close]')?.click();
    if (typeof showToast === 'function') showToast('Revision restored as a draft', 'success');
  } catch (e) { if (typeof showToast === 'function') showToast('Restore failed: ' + e.message, 'error'); }
}
window.restoreStudioRevision = restoreStudioRevision;

function hasSocialSchedulerEntitlement() {
  const access = (typeof window !== 'undefined' && window.__access) ? window.__access : {};
  if (access.isPlatformStaff) return true;
  const feats = access.features || [];
  const prods = access.products || [];
  return feats.includes('social.scheduler') || feats.includes('os.marketing') ||
    prods.includes('marketsync_social') || prods.includes('social-scheduler') ||
    prods.includes('complete-marketing-suite') || prods.includes('sales-marketing-suite') ||
    prods.includes('service-marketing-suite') || prods.includes('marketsync-digital') ||
    prods.includes('dealer-os-core') || prods.includes('dealer-os-pro') || prods.includes('dealer-os-complete');
}
window.hasSocialSchedulerEntitlement = hasSocialSchedulerEntitlement;

function showSocialSchedulerUpgradeModal() {
  if (typeof crmOverlay === 'function') {
    crmOverlay(`
      <div class="p-6 space-y-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5"/></svg>
          </div>
          <div>
            <h3 class="text-base font-black text-slate-900 dark:text-white">Social Scheduler Required</h3>
            <p class="text-xs text-slate-500">Upgrade to schedule and distribute your designs directly to social channels.</p>
          </div>
        </div>
        <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Design Studio allows you to create high-converting graphics and canvas artwork. To publish or schedule your designs across Facebook, Instagram, LinkedIn, TikTok, and YouTube, add the standalone <strong>Social Scheduler ($99/mo)</strong> or upgrade to any <strong>Marketing Suite</strong>.
        </p>
        <div class="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <a href="upgrade.html" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md transition">View Upgrade Options</a>
          <button onclick="this.closest('.fixed').remove();" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">Dismiss</button>
        </div>
      </div>
    `, 'max-w-md');
  } else {
    alert('Social Scheduler is required to schedule posts. Please upgrade in subscription settings.');
  }
}
window.showSocialSchedulerUpgradeModal = showSocialSchedulerUpgradeModal;

function openStudioSchedulerWithEntitlementCheck() {
  if (!hasSocialSchedulerEntitlement()) {
    showSocialSchedulerUpgradeModal();
    return;
  }
  // Schedule is its own destination, not a view nested inside Design Studio —
  // close Studio (if it's the one open) and hand off to the real, standalone,
  // entitlement-gated Social Scheduler page.
  if (document.getElementById('ms-studio-master-modal') && typeof closeMarketSyncStudio === 'function') {
    closeMarketSyncStudio();
  }
  if (typeof switchPage === 'function') switchPage('social-scheduler');
}
window.openStudioSchedulerWithEntitlementCheck = openStudioSchedulerWithEntitlementCheck;

async function renderStudioDesignAndPublish() {
  if (!window.__studioAdapter) return;

  if (!hasSocialSchedulerEntitlement()) {
    showSocialSchedulerUpgradeModal();
    return;
  }

  await saveStudioDesign();
  const scene = window.__studioAdapter.exportScene();

  try {
    const res = await apiSendJson('/marketing/studio/render', 'POST', {
      name: document.getElementById('studio-design-name')?.value || 'Studio Creative',
      scene
    });

    if (res?.asset?.public_url) {
      // studioSchedulerCompose() closes Design Studio and hands off to the real,
      // standalone, entitlement-gated Social Scheduler page
      // (data-page-content="social-scheduler"), pre-selecting this rendered asset
      // for the new post — mktCompose() below is only a fallback for the case
      // where studio-scheduler.js somehow isn't loaded, since it mounts into the
      // full DealerOS Marketing engine page that a Design-Studio-only account
      // never renders.
      if (typeof window.studioSchedulerCompose === 'function') {
        const designId = window.__studioCurrentDesign?.id;
        let editableAssetUrl = res.asset.public_url;
        if (designId) {
          try {
            const linkedAsset = new URL(editableAssetUrl, window.location.origin);
            linkedAsset.searchParams.set('studio_design', designId);
            editableAssetUrl = linkedAsset.toString();
          } catch {}
        }
        window.studioSchedulerCompose(editableAssetUrl);
      } else if (typeof window.mktCompose === 'function') {
        closeMarketSyncStudio();
        window.mktCompose({ assetUrl: res.asset.public_url });
      }
      if (typeof showToast === 'function') showToast('Design rendered — choose where to post it.', 'success');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Render error: ' + e.message, 'error');
  }
}

function closeMarketSyncStudio() {
  window.__studioFitObserver?.disconnect();
  window.__studioFitObserver = null;
  document.getElementById('ms-studio-master-modal')?.remove();
  closeStudioContextMenu();
  if (window.__studioKeydownBound) {
    window.__studioKeydownBound = false;
    document.removeEventListener('keydown', studioKeydownHandler);
  }
  if (typeof switchDept === 'function' && typeof currentDept !== 'undefined' && currentDept === 'marketing') {
    if (typeof engineTab === 'function') engineTab('marketing-overview', 'overview');
    else switchDept('marketing', 'overview');
  }
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
