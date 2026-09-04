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

  function wrapOpenClose() {
    const open = global.openMarketSyncStudio;
    if (typeof open !== 'function' || open.__dashHomeWrapped) return false;
    if (open === global.ensureOpenMarketSyncStudio) return false;
    global.__msOpenStudioReal = open;
    global.openMarketSyncStudio = async function (designId, initialOptions) {
      const opts = initialOptions || {};
      const stayInDashboard = !designId && !opts.bypassHome && !opts.formatKey && !opts.templateKey && !opts.scene;
      if (stayInDashboard && (studioPageRoot() || document.getElementById('studio-root'))) {
        return mountStudioHomeInDashboard();
      }
      return open.apply(this, arguments);
    };
    global.openMarketSyncStudio.__dashHomeWrapped = true;

    const close = global.closeMarketSyncStudio;
    if (typeof close === 'function' && !close.__dashHomeWrapped) {
      global.closeMarketSyncStudio = function () {
        close.apply(this, arguments);
        const studioPage = document.querySelector('[data-page-content="studio"]');
        if (studioPage && !studioPage.classList.contains('hidden')) mountStudioHomeInDashboard();
      };
      global.closeMarketSyncStudio.__dashHomeWrapped = true;
    }
    return true;
  }

  const boot = setInterval(function () {
    if (wrapOpenClose()) {
      const page = document.querySelector('[data-page-content="studio"]');
      if (page && !page.classList.contains('hidden') && !document.getElementById('ms-studio-master-modal')) {
        mountStudioHomeInDashboard();
      }
      clearInterval(boot);
    }
  }, 250);
  setTimeout(function () { clearInterval(boot); }, 20000);
})(window);
