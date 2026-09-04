/* Design Studio always uses the full-screen overlay, including Creative Home. */
(function (global) {
  'use strict';

  const origOpen = global.openMarketSyncStudio;
  const origClose = global.closeMarketSyncStudio;

  async function mountStudioHomeInDashboard() {
    if (typeof origOpen === 'function') return origOpen();
    if (typeof global.openMarketSyncStudio === 'function') return global.openMarketSyncStudio();
  }

  global.mountStudioHomeInDashboard = mountStudioHomeInDashboard;

  if (typeof origOpen === 'function') {
    global.openMarketSyncStudio = function (designId, initialOptions) {
      return origOpen.call(this, designId, initialOptions);
    };
  }

  if (typeof origClose === 'function') {
    global.closeMarketSyncStudio = function () {
      origClose.apply(this, arguments);
    };
  }
})(window);
