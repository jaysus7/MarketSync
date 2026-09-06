/* White canvas defaults + page thumbnails. Flatten extra artboard frames. */
(function (global) {
  const WHITE = '#FFFFFF';

  function injectStyle() {
    let style = document.getElementById('studio-page-thumb-css');
    if (!style) {
      style = document.createElement('style');
      style.id = 'studio-page-thumb-css';
      document.head.appendChild(style);
    }
    style.textContent = `
      .studio-page-thumbs{display:flex;align-items:center;gap:8px;flex-shrink:0}
      .studio-page-thumb{display:flex;flex-direction:column;align-items:center;gap:4px;background:transparent;border:0;padding:0;cursor:pointer;color:#cbd5e1;font:800 10px/1.1 -apple-system,Segoe UI,sans-serif}
      .studio-page-thumb-canvas{width:42px;height:42px;border-radius:8px;background:#fff;border:1px solid #cbd5e1;position:relative}
      .studio-page-thumb-canvas.is-wide{width:52px;height:28px}
      .studio-page-thumb-canvas.is-tall{width:28px;height:52px}
      .studio-page-thumb-canvas.is-add:after{content:'+';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 18px/1 inherit;color:#64748b}
      .studio-page-thumb-canvas.is-dup:after{content:'';position:absolute;right:6px;bottom:6px;width:16px;height:16px;border:1.5px solid #64748b;border-radius:3px;background:#fff;box-shadow:-4px -4px 0 -1.5px #fff,-4px -4px 0 0 #64748b}
      #studio-artboard-container{
        background:#fff !important;
        border:0 !important;
        border-radius:0 !important;
        box-shadow:0 18px 50px rgba(0,0,0,.28) !important;
        ring:none !important;
        outline:none !important;
      }
      /* The lower canvas ONLY. Fabric's upper canvas is the transparent
         interaction layer that sits ON TOP of the artwork — painting it opaque
         covers the whole design with a white sheet, which is exactly what
         5b07ea9 did when it added canvas.upper-canvas to this rule. The
         artboard then looked blank while the drawing underneath was perfectly
         intact: the bitmap had pixels, objects reported, selection still
         worked, and nothing was visible. A background on the LOWER canvas is
         safe because it renders behind the bitmap, giving an empty page its
         white default. */
      #studio-canvas-host,canvas.lower-canvas{
        background:#fff !important;
      }
      #studio-safe-guides > div{
        box-shadow:none !important;
        border-width:1px !important;
        border-color:rgba(37,99,235,.35) !important;
        border-radius:0 !important;
      }
      #studio-safe-guides span{display:none !important}
    `;
  }

  function flattenSafeGuides() {
    const guide = document.querySelector('#studio-safe-guides > div');
    if (guide) {
      guide.style.boxShadow = 'none';
      guide.style.borderRadius = '0';
    }
    const artboard = document.getElementById('studio-artboard-container');
    if (artboard) {
      artboard.style.background = WHITE;
      artboard.style.border = '0';
      artboard.style.borderRadius = '0';
    }
  }

  function aspectClass() {
    const scene = global.__studioAdapter?.currentScene || {};
    const w = Number(scene.width) || 1080;
    const h = Number(scene.height) || 1080;
    if (w > h * 1.15) return 'is-wide';
    if (h > w * 1.15) return 'is-tall';
    return '';
  }

  function paintFooter() {
    const footer = document.querySelector('#ms-studio-master-modal footer[data-studio-region="footer"]')
      || document.querySelector('#ms-studio-master-modal footer');
    if (!footer) return;
    const existingAdd = [...footer.querySelectorAll('button')].find((b) => /^\+?\s*Page$/i.test((b.textContent || '').trim()));
    if (!existingAdd && footer.querySelector('.studio-page-thumbs')) {
      footer.querySelectorAll('.studio-page-thumb-canvas').forEach((el) => {
        el.classList.remove('is-wide', 'is-tall');
        const cls = aspectClass();
        if (cls) el.classList.add(cls);
      });
      return;
    }
    if (!existingAdd) return;
    const wrap = document.createElement('div');
    wrap.className = 'studio-page-thumbs';
    const shape = aspectClass();
    wrap.innerHTML = `
      <button type="button" class="studio-page-thumb" onclick="duplicateStudioPage(window.__studioAdapter&&window.__studioAdapter.activePageId)" title="Duplicate page">
        <span class="studio-page-thumb-canvas is-dup ${shape}"></span>
        <span>Duplicate</span>
      </button>
      <button type="button" class="studio-page-thumb" onclick="addStudioPage()" title="Add a page">
        <span class="studio-page-thumb-canvas is-add ${shape}"></span>
        <span>Add page</span>
      </button>`;
    existingAdd.replaceWith(wrap);
  }

  function bleachEmptyNavy() {
    const adapter = global.__studioAdapter;
    const scene = adapter?.currentScene;
    if (!scene) return;
    const navy = (c) => String(c || '').toLowerCase() === '#0f172a';
    const empty = (arr) => !arr || !arr.length;
    if (empty(scene.elements) && navy(scene.background?.color)) scene.background.color = WHITE;
    (scene.pages || []).forEach((page) => {
      if (empty(page.objects) && navy(page.background?.color)) page.background = { color: WHITE };
    });
    const active = scene.pages?.find((p) => p.id === adapter.activePageId);
    const color = active?.background?.color || scene.background?.color || WHITE;
    if (adapter.fabricCanvas && (navy(adapter.fabricCanvas.backgroundColor) || empty(active?.objects || scene.elements))) {
      adapter.fabricCanvas.setBackgroundColor(navy(color) ? WHITE : color, () => adapter.fabricCanvas.requestRenderAll());
    }
  }

  function wrapFns() {
    if (typeof global.addStudioPage === 'function' && !global.addStudioPage.__whiteWrapped) {
      const origAdd = global.addStudioPage;
      global.addStudioPage = function () {
        origAdd();
        const adapter = global.__studioAdapter;
        const page = adapter?.currentScene?.pages?.find((p) => p.id === adapter.activePageId);
        if (page) page.background = { color: WHITE };
        if (adapter?.currentScene) adapter.currentScene.background = { color: WHITE };
        adapter?.fabricCanvas?.setBackgroundColor(WHITE, () => adapter.fabricCanvas.requestRenderAll());
        paintFooter();
      };
      global.addStudioPage.__whiteWrapped = true;
    }
    if (typeof global.duplicateStudioPage === 'function' && !global.duplicateStudioPage.__whiteWrapped) {
      const origDup = global.duplicateStudioPage;
      global.duplicateStudioPage = function (pageId) {
        origDup(pageId);
        paintFooter();
      };
      global.duplicateStudioPage.__whiteWrapped = true;
    }
  }

  const boot = setInterval(() => {
    injectStyle();
    flattenSafeGuides();
    wrapFns();
    if (document.getElementById('ms-studio-master-modal')) {
      bleachEmptyNavy();
      paintFooter();
    }
  }, 400);
  setTimeout(() => clearInterval(boot), 25000);
  document.addEventListener('click', () => setTimeout(() => { injectStyle(); flattenSafeGuides(); wrapFns(); paintFooter(); }, 50));
})(window);
