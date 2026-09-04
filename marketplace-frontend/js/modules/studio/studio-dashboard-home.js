/* Creative Home (projects, templates, sizes) lives on the dashboard page.
   The canvas editor still opens as the full-screen overlay. */
(function (global) {
  'use strict';

  function studioPageRoot() {
    const page = document.querySelector('[data-page-content="studio"]');
    if (!page || page.classList.contains('hidden')) return null;
    return document.getElementById('studio-root');
  }

  function stripStandaloneChrome(root) {
    const standalone = root.querySelector('button[onclick="closeMarketSyncStudio()"]');
    if (standalone) {
      const bar = standalone.closest('header');
      if (bar) bar.remove();
    }
    if (!root.querySelector('[data-studio-dash-create]')) {
      const wrap = document.createElement('div');
      wrap.className = 'flex items-center justify-between gap-3 mb-2';
      wrap.innerHTML = '<div class="text-xs font-black uppercase tracking-[.16em] text-indigo-500">Design</div><button type="button" data-studio-dash-create class="whitespace-nowrap rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500" onclick="openStudioSizePicker(\'new\')">+ Create design</button>';
      root.prepend(wrap);
    }
  }

  async function mountStudioHomeInDashboard() {
    const root = studioPageRoot() || document.getElementById('studio-root');
    if (!root || typeof renderStudioHome !== 'function') return false;
    document.getElementById('ms-studio-master-modal')?.remove();
    global.__studioAdapter = null;
    await renderStudioHome(root);
    stripStandaloneChrome(root);
    return true;
  }

  global.mountStudioHomeInDashboard = mountStudioHomeInDashboard;

  let realOpen = null;
  let realClose = null;

  function isPlaceholder(fn) {
    return !fn || fn === global.ensureOpenMarketSyncStudio || fn.__dashHomeWrapped;
  }

  async function wrappedOpen(designId, initialOptions) {
    const opts = initialOptions || {};
    const stayInDashboard = !designId && !opts.bypassHome && !opts.formatKey && !opts.templateKey && !opts.scene;
    if (stayInDashboard && (studioPageRoot() || document.getElementById('studio-root'))) {
      return mountStudioHomeInDashboard();
    }
    if (typeof realOpen === 'function') return realOpen.apply(this, arguments);
    if (typeof global.ensureOpenMarketSyncStudio === 'function') return global.ensureOpenMarketSyncStudio(designId, opts);
  }
  wrappedOpen.__dashHomeWrapped = true;

  function wrappedClose() {
    if (typeof realClose === 'function') realClose.apply(this, arguments);
    const studioPage = document.querySelector('[data-page-content="studio"]');
    if (studioPage && !studioPage.classList.contains('hidden')) mountStudioHomeInDashboard();
  }
  wrappedClose.__dashHomeWrapped = true;

  function installHook(name, getter, setter) {
    try {
      Object.defineProperty(global, name, {
        configurable: true,
        enumerable: true,
        get: getter,
        set: setter
      });
    } catch (e) {}
  }

  const existingOpen = global.openMarketSyncStudio;
  if (!isPlaceholder(existingOpen)) realOpen = existingOpen;
  installHook('openMarketSyncStudio', function () { return wrappedOpen; }, function (fn) {
    if (!isPlaceholder(fn)) realOpen = fn;
  });

  const existingClose = global.closeMarketSyncStudio;
  if (typeof existingClose === 'function') realClose = existingClose;
  installHook('closeMarketSyncStudio', function () { return wrappedClose; }, function (fn) {
    if (typeof fn === 'function' && fn !== wrappedClose) realClose = fn;
  });
})(window);
