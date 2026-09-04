/* Mount Design Studio Creative Home inside the dashboard page, not a fullscreen studio shell. */
(function (global) {
  'use strict';

  const origOpen = global.openMarketSyncStudio;
  const origClose = global.closeMarketSyncStudio;

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
    if (!root || typeof renderStudioHome !== 'function') {
      if (typeof origOpen === 'function') return origOpen();
      return;
    }
    document.getElementById('ms-studio-master-modal')?.remove();
    global.__studioAdapter = null;
    await renderStudioHome(root);
    stripStandaloneChrome(root);
  }

  global.mountStudioHomeInDashboard = mountStudioHomeInDashboard;

  if (typeof origOpen === 'function') {
    global.openMarketSyncStudio = async function (designId, initialOptions) {
      const opts = initialOptions || {};
      const stayInDashboard = !designId && !opts.bypassHome && !opts.formatKey && !opts.templateKey;
      if (stayInDashboard && (studioPageRoot() || document.getElementById('studio-root'))) {
        return mountStudioHomeInDashboard();
      }
      return origOpen.apply(this, arguments);
    };
  }

  if (typeof origClose === 'function') {
    global.closeMarketSyncStudio = function () {
      origClose.apply(this, arguments);
      const studioPage = document.querySelector('[data-page-content="studio"]');
      if (studioPage && !studioPage.classList.contains('hidden')) {
        mountStudioHomeInDashboard();
      }
    };
  }
})(window);
