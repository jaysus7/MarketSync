/* Hide standalone Icons/Shapes/Stickers rails and open them inside Elements. */
(function (global) {
  const HIDE = ['icons', 'shapes', 'stickers'];
  const MAP = { icons: 'Icons', shapes: 'Shapes', stickers: 'Graphics' };

  function hideStandaloneRails() {
    HIDE.forEach(function (tool) {
      document.querySelectorAll('[data-studio-tool="' + tool + '"], #tool-btn-' + tool).forEach(function (btn) {
        btn.style.display = 'none';
        btn.setAttribute('hidden', 'hidden');
      });
    });
  }

  function injectIconsIntoElements() {
    const host = document.getElementById('studio-premade-library');
    if (!host || host.dataset.msIcons === '1') return;
    if ((global.__studioElementCategory || '') !== 'Icons') return;
    host.dataset.msIcons = '1';
    const box = document.createElement('div');
    box.id = 'studio-elements-icon-embed';
    box.innerHTML = '<input id="studio-icon-query" oninput="filterStudioIcons()" placeholder="Search 1000+ icons…" class="w-full mb-2 px-3 py-2 rounded-xl bg-slate-900 text-white border border-white/10 text-xs"><div id="studio-icon-library" class="studio-icon-library"></div>';
    host.prepend(box);
    if (typeof global.filterStudioIcons === 'function') global.filterStudioIcons(false);
  }

  function wrapTools() {
    if (typeof global.setStudioTool === 'function' && !global.setStudioTool.__unified) {
      const orig = global.setStudioTool;
      global.setStudioTool = function (tool) {
        if (MAP[tool]) {
          orig('elements');
          if (typeof global.setStudioElementCategory === 'function') global.setStudioElementCategory(MAP[tool]);
          setTimeout(injectIconsIntoElements, 50);
          return;
        }
        orig(tool);
        if (tool === 'elements') setTimeout(injectIconsIntoElements, 50);
      };
      global.setStudioTool.__unified = true;
    }
    if (typeof global.setStudioElementCategory === 'function' && !global.setStudioElementCategory.__unified) {
      const origCat = global.setStudioElementCategory;
      global.setStudioElementCategory = function (category) {
        origCat(category);
        const host = document.getElementById('studio-premade-library');
        if (host) host.dataset.msIcons = '';
        if (category === 'Icons') setTimeout(injectIconsIntoElements, 30);
      };
      global.setStudioElementCategory.__unified = true;
    }
  }

  const boot = setInterval(function () {
    hideStandaloneRails();
    wrapTools();
  }, 400);
  setTimeout(function () { clearInterval(boot); }, 20000);
})(window);
