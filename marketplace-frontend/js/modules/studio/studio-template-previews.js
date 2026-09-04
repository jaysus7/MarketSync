/* Collection variants + true-size cards. Uses the studio catalog closure, not a missing window copy. */
(function (global) {
  'use strict';

  function injectCss() {
    if (document.getElementById('studio-template-preview-css')) return;
    const style = document.createElement('style');
    style.id = 'studio-template-preview-css';
    style.textContent = `
      #studio-home-template-grid{align-items:start}
      .studio-home-template-card .studio-template-stage{display:flex;align-items:center;justify-content:center;height:200px;padding:12px;background:#e2e8f0;overflow:hidden}
      .studio-template-preview{position:relative;overflow:hidden;height:176px;width:auto;max-width:100%;box-shadow:0 10px 28px rgba(15,23,42,.22);border-radius:8px}
      .studio-template-preview.is-wide{width:100%;height:auto;max-height:176px}
      .studio-template-kicker{position:absolute;left:8px;top:8px;z-index:2;border-radius:8px;background:rgba(15,23,42,.82);color:#fff;padding:3px 7px;font:800 9px/1.1 sans-serif}
      .studio-template-cat{grid-column:1/-1;margin-top:8px;font:800 11px/1 sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#6366f1}
      .studio-set-montage{display:flex;align-items:flex-end;justify-content:center;gap:10px;height:100%;padding:18px 12px}
      .studio-set-silhouette{background:#fff;box-shadow:0 10px 24px rgba(0,0,0,.25);border-radius:4px;position:relative;overflow:hidden}
      .studio-set-silhouette span{position:absolute;left:10%;right:10%;background:currentColor;opacity:.22;border-radius:2px}
    `;
    document.head.appendChild(style);
  }

  function silhouette(kind, bg, accent) {
    const sizes = {
      card: 'width:42%;height:58%;',
      letter: 'width:28%;height:88%;',
      story: 'width:22%;height:92%;',
      wide: 'width:48%;height:40%;'
    };
    const lines = kind === 'letter'
      ? '<span style="top:12%;height:8%;background:' + accent + ';opacity:1"></span><span style="top:28%;height:4%"></span><span style="top:36%;height:4%"></span><span style="top:44%;height:4%"></span>'
      : kind === 'story'
        ? '<span style="top:8%;height:10%;background:' + accent + ';opacity:1"></span><span style="top:70%;height:14%"></span>'
        : kind === 'wide'
          ? '<span style="top:18%;left:8%;width:40%;height:64%;background:' + accent + ';opacity:1"></span><span style="top:28%;left:52%;width:40%;height:8%"></span>'
          : '<span style="top:0;left:0;width:32%;height:100%;background:' + accent + ';opacity:1;right:auto"></span><span style="top:18%;left:40%;width:50%;height:10%"></span><span style="top:36%;left:40%;width:36%;height:6%"></span>';
    return '<div class="studio-set-silhouette" style="' + sizes[kind] + 'color:#334155;background:' + bg + '">' + lines + '</div>';
  }

  function wrapPreview() {
    if (typeof global.templatePreviewMarkup !== 'function' || global.templatePreviewMarkup.__sized) return;
    const orig = global.templatePreviewMarkup;
    global.templatePreviewMarkup = function (tmpl) {
      if (!tmpl) return '';
      const scene = Object.assign({}, tmpl.scene || {});
      if (!(scene.elements && scene.elements.length) && scene.pages && scene.pages[0]) {
        scene.elements = scene.pages[0].objects || scene.pages[0].elements || [];
      }
      const html = orig(Object.assign({}, tmpl, { scene: scene }));
      const w = Number(scene.width || tmpl.width || 1080);
      const h = Number(scene.height || tmpl.height || 1080);
      return String(html || '').replace('class="studio-template-preview"', 'class="studio-template-preview' + (w >= h * 1.15 ? ' is-wide' : '') + '"');
    };
    global.templatePreviewMarkup.__sized = true;
  }

  function wrapCards() {
    if (typeof global.studioHomeTemplateCards !== 'function' || global.studioHomeTemplateCards.__msLimit) return;
    const orig = global.studioHomeTemplateCards;
    if (orig.__sized) return;
    global.studioHomeTemplateCards = function () {
      return orig(240);
    };
    global.studioHomeTemplateCards.__msLimit = true;
    if (typeof global.renderStudioHomeTemplateGrid === 'function') global.renderStudioHomeTemplateGrid();
  }

  function wrapSets() {
    if (typeof global.renderStudioHomeDesignSets !== 'function' || global.renderStudioHomeDesignSets.__msSilhouettes) return;
    global.renderStudioHomeDesignSets = function () {
      const sets = global.STUDIO_DESIGN_SETS || [];
      const formats = global.STUDIO_SOCIAL_FORMATS || {};
      const count = Object.keys(formats).length || 23;
      return sets.map(function (set) {
        const paper = set.id === 'paper_ledger' ? '#fffaf3' : '#fff';
        return '<button type="button" data-studio-home-set="' + set.id + '" onclick="studioFilterHomeDesignSet(\'' + set.id + '\')" class="studio-home-set-card group overflow-hidden rounded-3xl border border-slate-200/80 bg-white text-left shadow-sm dark:border-white/10 dark:bg-slate-900">' +
          '<div class="relative h-48 overflow-hidden" style="background:linear-gradient(135deg,' + set.background + ',' + set.accent + ')">' +
          '<div class="studio-set-montage">' +
            silhouette('letter', paper, set.accent) +
            silhouette('card', paper, set.accent) +
            silhouette('story', paper, set.accent) +
            silhouette('wide', paper, set.accent) +
          '</div></div>' +
          '<div class="p-4"><div class="text-[10px] font-black uppercase tracking-[.16em] text-indigo-600">' + set.eyebrow + '</div>' +
          '<h3 class="mt-1 text-lg font-black">' + set.name + '</h3>' +
          '<p class="mt-1 text-xs text-slate-500">' + set.description + '</p>' +
          '<div class="mt-3 text-xs font-black text-indigo-700">' + count + ' matching sizes →</div></div></button>';
      }).join('');
    };
    global.renderStudioHomeDesignSets.__msSilhouettes = true;
    const first = document.querySelector('[data-studio-home-set]');
    const host = first && first.parentElement;
    if (host) host.innerHTML = global.renderStudioHomeDesignSets();
  }

  function wrapFilter() {
    if (typeof global.studioFilterHomeDesignSet !== 'function' || global.studioFilterHomeDesignSet.__msFix) return;
    const orig = global.studioFilterHomeDesignSet;
    global.studioFilterHomeDesignSet = function (value) {
      orig(value);
      if (typeof global.renderStudioHomeTemplateGrid === 'function') global.renderStudioHomeTemplateGrid();
      const section = document.getElementById('studio-home-templates');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    global.studioFilterHomeDesignSet.__msFix = true;
  }

  function exposeSets() {
    if (!global.STUDIO_DESIGN_SETS && document.querySelector('[data-studio-home-set]')) {
      global.STUDIO_DESIGN_SETS = [
        { id: 'midnight_luxe', name: 'Midnight Luxe', eyebrow: 'Premium collection', description: 'Deep navy, warm gold and editorial spacing.', background: '#07111F', accent: '#D4A94F' },
        { id: 'electric_current', name: 'Electric Current', eyebrow: 'Modern collection', description: 'Electric blue, cyan highlights and energetic framing.', background: '#102A56', accent: '#2DD4BF' },
        { id: 'paper_ledger', name: 'Paper & Ledger', eyebrow: 'Editorial collection', description: 'Warm paper, charcoal type and restrained rules.', background: '#F4EFE6', accent: '#9F1239' },
        { id: 'signal_red', name: 'Signal Red', eyebrow: 'Campaign collection', description: 'High-impact red, cream and angled graphic blocks.', background: '#B91C1C', accent: '#FDE68A' }
      ];
    }
  }

  const boot = setInterval(function () {
    injectCss();
    exposeSets();
    wrapPreview();
    wrapCards();
    wrapSets();
    wrapFilter();
  }, 300);
  setTimeout(function () { clearInterval(boot); }, 20000);
})(window);
