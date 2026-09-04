/* Collection variants + See collection. */
(function (global) {
  'use strict';

  const COLLECTION_FORMATS = [
    { key: 'business_card', label: 'Business card', w: 1050, h: 600 },
    { key: 'letterhead', label: 'Letterhead', w: 816, h: 1056 },
    { key: 'flyer', label: 'Flyer', w: 816, h: 1056 },
    { key: 'poster', label: 'Poster', w: 1080, h: 1620 },
    { key: 'square', label: 'Square post', w: 1080, h: 1080 },
    { key: 'story', label: 'Story / Reel', w: 1080, h: 1920 },
    { key: 'portrait', label: 'Portrait post', w: 1080, h: 1350 },
    { key: 'landscape', label: 'Landscape', w: 1920, h: 1080 },
    { key: 'cover', label: 'Page cover', w: 1640, h: 924 },
    { key: 'banner', label: 'Web banner', w: 1920, h: 600 },
    { key: 'email', label: 'Email header', w: 1200, h: 400 },
    { key: 'presentation', label: 'Presentation', w: 1920, h: 1080 },
    { key: 'facebook_post', label: 'Facebook post', w: 1200, h: 630 },
    { key: 'linkedin', label: 'LinkedIn', w: 1200, h: 627 },
    { key: 'youtube', label: 'YouTube thumb', w: 1280, h: 720 },
    { key: 'pin', label: 'Pinterest pin', w: 1000, h: 1500 },
    { key: 'billboard', label: 'Billboard', w: 1920, h: 480 },
    { key: 'tabloid', label: 'Tabloid', w: 1224, h: 1584 },
    { key: 'a4', label: 'A4 print', w: 794, h: 1123 },
    { key: 'web', label: 'Website hero', w: 1600, h: 900 },
    { key: 'post', label: 'Feed post', w: 1080, h: 1080 },
    { key: 'reel', label: 'Reel cover', w: 1080, h: 1920 },
    { key: 'wide', label: 'Wide ad', w: 1920, h: 720 }
  ];

  function injectCss() {
    if (document.getElementById('studio-template-preview-css')) return;
    const style = document.createElement('style');
    style.id = 'studio-template-preview-css';
    style.textContent = `
      #studio-home-template-grid{align-items:start}
      .studio-home-template-card .studio-template-stage{display:flex;align-items:center;justify-content:center;height:200px;padding:12px;background:#e2e8f0;overflow:hidden}
      .studio-template-preview{position:relative;overflow:hidden;height:176px;width:auto;max-width:100%;box-shadow:0 10px 28px rgba(15,23,42,.22);border-radius:8px}
      .studio-template-kicker{position:absolute;left:8px;top:8px;z-index:2;border-radius:8px;background:rgba(15,23,42,.82);color:#fff;padding:3px 7px;font:800 9px/1.1 sans-serif}
      .studio-template-cat{grid-column:1/-1;margin-top:8px;font:800 11px/1 sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#6366f1}
      .studio-set-montage{display:flex;align-items:flex-end;justify-content:center;gap:10px;height:100%;padding:18px 12px}
      .studio-set-silhouette{background:#fff;box-shadow:0 10px 24px rgba(0,0,0,.25);border-radius:4px;position:relative;overflow:hidden}
      .studio-collection-banner{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 4px 4px}
    `;
    document.head.appendChild(style);
  }

  function silhouette(kind, bg, accent) {
    const sizes = { card: 'width:42%;height:58%;', letter: 'width:28%;height:88%;', story: 'width:22%;height:92%;', wide: 'width:48%;height:40%;' };
    const lines = kind === 'letter'
      ? '<span style="top:12%;height:8%;background:' + accent + ';opacity:1;position:absolute;left:10%;right:10%;border-radius:2px"></span>'
      : kind === 'story'
        ? '<span style="top:8%;height:10%;background:' + accent + ';opacity:1;position:absolute;left:10%;right:10%"></span>'
        : kind === 'wide'
          ? '<span style="top:18%;left:8%;width:40%;height:64%;background:' + accent + ';opacity:1;position:absolute"></span>'
          : '<span style="top:0;left:0;width:32%;height:100%;background:' + accent + ';opacity:1;position:absolute"></span>';
    return '<div class="studio-set-silhouette" style="' + sizes[kind] + 'background:' + bg + '">' + lines + '</div>';
  }

  function setMeta(id) {
    const sets = global.STUDIO_DESIGN_SETS || [];
    return sets.find(function (set) { return set.id === id; }) || { id: id, name: String(id || '').replace(/_/g, ' ') };
  }

  function collectionCards(setId) {
    const set = setMeta(setId);
    const heading = '<div class="studio-collection-banner"><div class="studio-template-cat" style="margin:0">' + set.name + ' collection · ' + COLLECTION_FORMATS.length + ' layouts</div>' +
      '<button type="button" onclick="studioFilterHomeDesignSet(\'all\')" class="text-xs font-black text-indigo-600">Show all templates</button></div>';
    const cards = COLLECTION_FORMATS.map(function (format) {
      const key = 'design_set_' + setId + '_' + format.key;
      const paper = setId === 'paper_ledger' ? '#fffaf3' : '#fff';
      const accent = set.accent || '#4f46e5';
      const tall = format.h > format.w * 1.15;
      const wide = format.w > format.h * 1.15;
      const box = tall ? 'width:42%;height:88%;' : wide ? 'width:88%;height:48%;' : 'width:70%;height:70%;';
      return '<button type="button" onclick="startStudioTemplate(\'' + key + '\')" class="studio-home-template-card group min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-left shadow-sm dark:bg-slate-900">' +
        '<div class="studio-template-stage relative" style="background:linear-gradient(180deg,#e2e8f0,#f8fafc)">' +
        '<div class="studio-set-silhouette" style="' + box + 'background:' + paper + ';box-shadow:0 10px 24px rgba(15,23,42,.18)"><span style="position:absolute;top:0;left:0;width:28%;height:100%;background:' + accent + '"></span></div>' +
        '<span class="studio-template-kicker">' + format.w + ' × ' + format.h + '</span></div>' +
        '<div class="p-3"><div class="truncate text-sm font-black">' + format.label + '</div>' +
        '<div class="mt-1 truncate text-xs text-slate-500">' + set.name + '</div></div></button>';
    }).join('');
    return heading + cards;
  }

  function wrapCards() {
    if (typeof global.studioHomeTemplateCards !== 'function' || global.studioHomeTemplateCards.__msCollection) return;
    const orig = global.studioHomeTemplateCards;
    global.studioHomeTemplateCards = function () {
      const setFilter = global.__studioHomeDesignSet || 'all';
      if (setFilter && setFilter !== 'all') return collectionCards(setFilter);
      if (typeof orig === 'function') return orig(240);
      return '';
    };
    global.studioHomeTemplateCards.__msCollection = true;
    if (typeof global.renderStudioHomeTemplateGrid === 'function') global.renderStudioHomeTemplateGrid();
  }

  function wrapSets() {
    if (typeof global.renderStudioHomeDesignSets !== 'function' || global.renderStudioHomeDesignSets.__msSee) return;
    global.renderStudioHomeDesignSets = function () {
      return (global.STUDIO_DESIGN_SETS || []).map(function (set) {
        const paper = set.id === 'paper_ledger' ? '#fffaf3' : '#fff';
        return '<button type="button" data-studio-home-set="' + set.id + '" onclick="studioFilterHomeDesignSet(\'' + set.id + '\')" class="studio-home-set-card group overflow-hidden rounded-3xl border border-slate-200/80 bg-white text-left shadow-sm dark:border-white/10 dark:bg-slate-900">' +
          '<div class="relative h-48 overflow-hidden" style="background:linear-gradient(135deg,' + set.background + ',' + set.accent + ')">' +
          '<div class="studio-set-montage">' + silhouette('letter', paper, set.accent) + silhouette('card', paper, set.accent) + silhouette('story', paper, set.accent) + silhouette('wide', paper, set.accent) + '</div></div>' +
          '<div class="p-4"><div class="text-[10px] font-black uppercase tracking-[.16em] text-indigo-600">' + set.eyebrow + '</div>' +
          '<h3 class="mt-1 text-lg font-black">' + set.name + '</h3>' +
          '<p class="mt-1 text-xs text-slate-500">' + set.description + '</p>' +
          '<div class="mt-3 text-xs font-black text-indigo-700">See collection →</div></div></button>';
      }).join('');
    };
    global.renderStudioHomeDesignSets.__msSee = true;
    const first = document.querySelector('[data-studio-home-set]');
    if (first && first.parentElement) first.parentElement.innerHTML = global.renderStudioHomeDesignSets();
  }

  function wrapFilter() {
    if (typeof global.studioFilterHomeDesignSet !== 'function' || global.studioFilterHomeDesignSet.__msSee) return;
    const orig = global.studioFilterHomeDesignSet;
    global.studioFilterHomeDesignSet = function (value) {
      orig(value);
      if (typeof global.renderStudioHomeTemplateGrid === 'function') global.renderStudioHomeTemplateGrid();
      const section = document.getElementById('studio-home-templates');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    global.studioFilterHomeDesignSet.__msSee = true;
  }

  function exposeSets() {
    if (!global.STUDIO_DESIGN_SETS) {
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
    wrapCards();
    wrapSets();
    wrapFilter();
  }, 300);
  setTimeout(function () { clearInterval(boot); }, 20000);
})(window);
