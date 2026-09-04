/* Creative Home stays on the dashboard page. Editor stays a full-screen overlay. */
(function (global) {
  'use strict';

  function studioPage() {
    return document.querySelector('[data-page-content="studio"]');
  }

  function studioRoot() {
    return document.getElementById('studio-root');
  }

  function showStudioDashboardPage() {
    const page = studioPage();
    if (!page) return;
    document.querySelectorAll('[data-page-content]').forEach(function (el) {
      if (el !== page) el.classList.add('hidden');
    });
    page.classList.remove('hidden');
    if (typeof global.switchPage === 'function') {
      try { global.switchPage('studio'); } catch (e) {}
    }
  }

  function stripStudioChrome(root) {
    if (!root) return;
    root.querySelectorAll('button[onclick="closeMarketSyncStudio()"]').forEach(function (btn) {
      const bar = btn.closest('header');
      if (bar) bar.remove();
      else btn.remove();
    });
    const homeMain = root.querySelector('main.studio-home');
    if (homeMain) {
      homeMain.classList.remove('flex-1');
      homeMain.style.overflow = 'visible';
      homeMain.style.background = 'transparent';
    }
  }

  function isHomeShell(node) {
    if (!node || !node.querySelector) return false;
    return !!node.querySelector('.studio-home-hero, .studio-home');
  }

  function isEditorShell(node) {
    if (!node || !node.querySelector) return false;
    return !!(node.querySelector('[data-studio-tool], #studio-tool-panel, canvas.upper-canvas, .studio-editor-shell'));
  }

  function moveHomeToDashboard(source) {
    const root = studioRoot();
    if (!root || !source || source === root) return false;
    if (!isHomeShell(source) || isEditorShell(source)) return false;
    showStudioDashboardPage();
    root.innerHTML = '';
    while (source.firstChild) root.appendChild(source.firstChild);
    if (source.id === 'ms-studio-master-modal') source.remove();
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    stripStudioChrome(root);
    global.__studioAdapter = null;
    return true;
  }

  async function mountStudioHomeInDashboard() {
    showStudioDashboardPage();
    const root = studioRoot();
    if (!root) return false;
    const modal = document.getElementById('ms-studio-master-modal');
    if (modal && isHomeShell(modal) && !isEditorShell(modal)) {
      return moveHomeToDashboard(modal);
    }
    if (typeof global.renderStudioHome === 'function') {
      await global.renderStudioHome(root);
      stripStudioChrome(root);
      return true;
    }
    return false;
  }

  global.mountStudioHomeInDashboard = mountStudioHomeInDashboard;

  const obs = new MutationObserver(function () {
    const modal = document.getElementById('ms-studio-master-modal');
    if (modal && isHomeShell(modal) && !isEditorShell(modal)) moveHomeToDashboard(modal);
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  const poll = setInterval(function () {
    const modal = document.getElementById('ms-studio-master-modal');
    if (modal && isHomeShell(modal) && !isEditorShell(modal)) moveHomeToDashboard(modal);
  }, 200);
  setTimeout(function () { clearInterval(poll); }, 30000);
})(window);
