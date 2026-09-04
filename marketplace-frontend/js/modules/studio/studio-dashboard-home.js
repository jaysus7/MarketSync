/* Creative Home stays on the dashboard page. Editor stays a full-screen overlay. */
(function (global) {
  'use strict';

  let stealHome = true;

  function studioRoot() {
    return document.getElementById('studio-root');
  }

  function isHomeShell(node) {
    return !!(node && node.querySelector && node.querySelector('.studio-home-hero'));
  }

  function isEditorShell(node) {
    return !!(node && node.querySelector && node.querySelector('[data-studio-tool], #studio-tool-panel, #studio-canvas-viewport, canvas.lower-canvas'));
  }

  function stripStudioChrome(root) {
    if (!root) return;
    root.querySelectorAll('button[onclick="closeMarketSyncStudio()"]').forEach(function (btn) {
      const bar = btn.closest('header');
      if (bar) bar.remove();
      else btn.remove();
    });
  }

  function moveHomeToDashboard(source) {
    const root = studioRoot();
    if (!stealHome || !root || !source || source === root) return false;
    if (!isHomeShell(source) || isEditorShell(source)) return false;
    const page = document.querySelector('[data-page-content="studio"]');
    if (page) page.classList.remove('hidden');
    root.innerHTML = '';
    while (source.firstChild) root.appendChild(source.firstChild);
    if (source.id === 'ms-studio-master-modal') source.remove();
    document.body.style.overflow = '';
    stripStudioChrome(root);
    global.__studioAdapter = null;
    return true;
  }

  function realOpen() {
    const fn = global.__msOpenStudioReal;
    if (typeof fn === 'function' && fn !== global.ensureOpenMarketSyncStudio) return fn;
    const open = Object.getOwnPropertyDescriptor(global, 'openMarketSyncStudio');
    const value = open && open.value;
    if (typeof value === 'function' && value !== global.ensureOpenMarketSyncStudio && String(value).indexOf('ms-studio-master-modal') >= 0) {
      global.__msOpenStudioReal = value;
      return value;
    }
    if (typeof global.openMarketSyncStudio === 'function' && global.openMarketSyncStudio !== global.ensureOpenMarketSyncStudio && String(global.openMarketSyncStudio).indexOf('ms-studio-master-modal') >= 0) {
      global.__msOpenStudioReal = global.openMarketSyncStudio;
      return global.openMarketSyncStudio;
    }
    return null;
  }

  function openEditor(designId, opts) {
    stealHome = false;
    const fn = realOpen();
    const result = fn ? fn.call(global, designId || null, opts || {}) : (global.ensureOpenMarketSyncStudio && global.ensureOpenMarketSyncStudio(designId, opts));
    return Promise.resolve(result).finally(function () {
      setTimeout(function () { stealHome = true; }, 2500);
    });
  }

  function wrapLaunchers() {
    ['startStudioTemplate', 'startStudioBlankDesign', 'startStudioCustomDesign', 'openStudioProject'].forEach(function (name) {
      const orig = global[name];
      if (typeof orig !== 'function' || orig.__dashLaunchWrapped) return;
      global[name] = function () {
        stealHome = false;
        const out = orig.apply(this, arguments);
        return Promise.resolve(out).finally(function () {
          setTimeout(function () { stealHome = true; }, 2500);
        });
      };
      global[name].__dashLaunchWrapped = true;
    });
    if (typeof global.openMarketSyncStudio === 'function' && !global.openMarketSyncStudio.__dashHomeWrapped) {
      const current = global.openMarketSyncStudio;
      if (current !== global.ensureOpenMarketSyncStudio && String(current).indexOf('ms-studio-master-modal') >= 0) {
        global.__msOpenStudioReal = current;
      }
      global.openMarketSyncStudio = function (designId, initialOptions) {
        const opts = initialOptions || {};
        const goEditor = !!(designId || opts.bypassHome || opts.formatKey || opts.templateKey || opts.scene);
        if (goEditor) return openEditor(designId, opts);
        const root = studioRoot();
        if (root && typeof global.renderStudioHome === 'function') {
          return global.renderStudioHome(root).then(function () { stripStudioChrome(root); });
        }
        return openEditor(designId, opts);
      };
      global.openMarketSyncStudio.__dashHomeWrapped = true;
    }
  }

  const obs = new MutationObserver(function () {
    const modal = document.getElementById('ms-studio-master-modal');
    if (stealHome && modal && isHomeShell(modal) && !isEditorShell(modal)) moveHomeToDashboard(modal);
    wrapLaunchers();
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  const boot = setInterval(wrapLaunchers, 250);
  setTimeout(function () { clearInterval(boot); }, 20000);
})(window);
