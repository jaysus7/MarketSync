/* True-size template thumbnails + collection variants. */
(function (global) {
  'use strict';

  const SET_PREVIEW_FORMATS = ['business_card', 'letterhead', 'story', 'square', 'landscape', 'flyer'];

  function injectCss() {
    if (document.getElementById('studio-template-preview-css')) return;
    const style = document.createElement('style');
    style.id = 'studio-template-preview-css';
    style.textContent = `
      #studio-home-template-grid{align-items:start}
      .studio-home-template-card .studio-template-stage{display:flex;align-items:center;justify-content:center;height:220px;padding:12px;background:#e2e8f0;overflow:hidden}
      .studio-template-preview{position:relative;overflow:hidden;height:196px;width:auto;max-width:100%;box-shadow:0 10px 28px rgba(15,23,42,.22);border-radius:8px;container-type:size}
      .studio-template-preview.is-wide{width:100%;height:auto;max-height:196px}
      .studio-template-kicker{position:absolute;left:8px;top:8px;z-index:2;border-radius:8px;background:rgba(15,23,42,.82);color:#fff;padding:3px 7px;font:800 9px/1.1 -apple-system,Segoe UI,sans-serif}
      .studio-template-cat{grid-column:1/-1;margin-top:8px;font:800 11px/1 -apple-system,Segoe UI,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#6366f1}
      .studio-set-montage{display:flex;align-items:flex-end;justify-content:center;gap:8px;height:100%;padding:8px}
      .studio-set-montage .studio-template-preview{height:70%;max-width:28%;box-shadow:0 8px 18px rgba(0,0,0,.25)}
      .studio-set-montage .studio-template-preview:nth-child(2){height:92%;max-width:34%}
    `;
    document.head.appendChild(style);
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' })[ch];
    });
  }

  function catalog() { return global.STUDIO_TEMPLATES_CATALOG || {}; }

  function mergeCreative() {
    const list = catalog();
    (global.msDesignStudioAutomotiveTemplates || []).forEach(function (template) {
      if (!template || !template.template_key || list[template.template_key]) return;
      list[template.template_key] = Object.assign({ desc: (template.category || 'Creative') + ' · fully editable', width: template.scene && template.scene.width, height: template.scene && template.scene.height }, template);
    });
  }

  function templatesForSet(setId) {
    return Object.values(catalog()).filter(function (template) {
      return template && template.design_set === setId;
    }).sort(function (a, b) {
      return String(a.format_key).localeCompare(String(b.format_key));
    });
  }

  function wrapPreview() {
    if (typeof global.templatePreviewMarkup !== 'function' || global.templatePreviewMarkup.__sized) return;
    const orig = global.templatePreviewMarkup;
    global.templatePreviewMarkup = function (tmpl) {
      if (!tmpl) return '';
      const scene = Object.assign({}, tmpl.scene || {});
      if (!(scene.elements && scene.elements.length) && Array.isArray(scene.pages) && scene.pages[0]) {
        scene.elements = scene.pages[0].objects || scene.pages[0].elements || [];
      }
      const html = orig(Object.assign({}, tmpl, { scene: scene }));
      const w = Number(scene.width || tmpl.width || 1080);
      const h = Number(scene.height || tmpl.height || 1080);
      return String(html || '').replace('class="studio-template-preview"', 'class="studio-template-preview' + (w >= h * 1.15 ? ' is-wide' : '') + '"');
    };
    global.templatePreviewMarkup.__sized = true;
  }

  function card(template) {
    const key = encodeURIComponent(template.template_key);
    const format = (global.STUDIO_SOCIAL_FORMATS || {})[template.format_key] || {};
    const w = Number(template.width || template.scene && template.scene.width || 1080);
    const h = Number(template.height || template.scene && template.scene.height || 1080);
    const preview = typeof global.templatePreviewMarkup === 'function' ? global.templatePreviewMarkup(template) : '';
    return '<button type="button" onclick="startStudioTemplate(decodeURIComponent(\'' + key + '\'))" class="studio-home-template-card group min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-left shadow-sm dark:border-white/10 dark:bg-slate-900">' +
      '<div class="studio-template-stage relative">' + preview + '<span class="studio-template-kicker">' + w + ' × ' + h + '</span></div>' +
      '<div class="p-3"><div class="truncate text-sm font-black">' + esc(template.name) + '</div>' +
      '<div class="mt-1 truncate text-xs text-slate-500">' + esc(format.label || template.format_key || 'Editable design') + '</div></div></button>';
  }

  function wrapCards() {
    if (typeof global.studioHomeTemplateCards !== 'function' || global.studioHomeTemplateCards.__sized) return;
    global.studioHomeTemplateCards = function () {
      mergeCreative();
      const query = String(global.__studioHomeTemplateQuery || '').trim().toLowerCase();
      const setFilter = global.__studioHomeDesignSet || 'all';
      const formatFilter = global.__studioHomeFormat || 'all';
      if (setFilter && setFilter !== 'all') {
        let list = templatesForSet(setFilter).filter(function (template) {
          const searchable = ((template.name || '') + ' ' + (template.format_key || '') + ' ' + (template.desc || '')).toLowerCase();
          return (!query || searchable.indexOf(query) >= 0) && (formatFilter === 'all' || template.format_key === formatFilter);
        });
        if (!list.length) list = Object.values(catalog()).filter(function (template) { return template.design_set === setFilter; });
        const heading = '<div class="studio-template-cat">' + esc(setFilter.replace(/_/g, ' ')) + ' · ' + list.length + ' sizes</div>';
        return heading + (list.length ? list.map(card).join('') : '<div class="col-span-full p-6 text-sm text-slate-500">No sizes in this collection yet.</div>');
      }
      const templates = Object.values(catalog()).filter(function (template) {
        const searchable = ((template.name || '') + ' ' + (template.desc || '') + ' ' + (template.category || '') + ' ' + (template.design_set || '')).toLowerCase();
        return (!query || searchable.indexOf(query) >= 0) && (formatFilter === 'all' || template.format_key === formatFilter);
      });
      const groups = {};
      templates.forEach(function (template) {
        const cat = template.category || 'Templates';
        (groups[cat] = groups[cat] || []).push(template);
      });
      const order = ['Vehicle marketing','Promotions','Fixed operations','Dealership content','Print & stationery','Presentations','Display advertising','Social media','Design templates','Templates'];
      return Object.keys(groups).sort(function (a, b) {
        const ia = order.indexOf(a), ib = order.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      }).map(function (cat) {
        return '<div class="studio-template-cat">' + esc(cat) + ' · ' + groups[cat].length + '</div>' + groups[cat].slice(0, 24).map(card).join('');
      }).join('') || '<div class="col-span-full p-6 text-sm">No matching templates</div>';
    };
    global.studioHomeTemplateCards.__sized = true;
    if (typeof global.renderStudioHomeTemplateGrid === 'function') global.renderStudioHomeTemplateGrid();
  }

  function wrapSets() {
    if (typeof global.renderStudioHomeDesignSets !== 'function' || global.renderStudioHomeDesignSets.__sized) return;
    const orig = global.renderStudioHomeDesignSets;
    global.renderStudioHomeDesignSets = function () {
      const sets = global.STUDIO_DESIGN_SETS || [];
      if (!sets.length) return orig();
      const formats = global.STUDIO_SOCIAL_FORMATS || {};
      return sets.map(function (set) {
        const variants = templatesForSet(set.id);
        const montage = SET_PREVIEW_FORMATS.map(function (formatKey) {
          return variants.find(function (template) { return template.format_key === formatKey; });
        }).filter(Boolean).slice(0, 4).map(function (template) {
          return typeof global.templatePreviewMarkup === 'function' ? global.templatePreviewMarkup(template) : '';
        }).join('');
        const count = variants.length || Object.keys(formats).length;
        return '<button type="button" data-studio-home-set="' + set.id + '" onclick="studioFilterHomeDesignSet(\'' + set.id + '\')" class="studio-home-set-card group overflow-hidden rounded-3xl border border-slate-200/80 bg-white text-left shadow-sm dark:border-white/10 dark:bg-slate-900">' +
          '<div class="relative h-48 overflow-hidden" style="background:linear-gradient(135deg,' + set.background + ',' + set.accent + ')"><div class="studio-set-montage">' + montage + '</div></div>' +
          '<div class="p-4"><div class="text-[10px] font-black uppercase tracking-[.16em] text-indigo-600">' + esc(set.eyebrow) + '</div>' +
          '<h3 class="mt-1 text-lg font-black">' + esc(set.name) + '</h3>' +
          '<p class="mt-1 text-xs text-slate-500">' + esc(set.description) + '</p>' +
          '<div class="mt-3 text-xs font-black text-indigo-700">' + count + ' matching sizes →</div></div></button>';
      }).join('');
    };
    global.renderStudioHomeDesignSets.__sized = true;
    const host = document.querySelector('[data-studio-home-set]') && document.querySelector('[data-studio-home-set]').parentElement;
    if (host && typeof global.renderStudioHomeDesignSets === 'function') {
      try { host.innerHTML = global.renderStudioHomeDesignSets(); } catch (e) {}
    }
  }

  function wrapFilter() {
    if (typeof global.studioFilterHomeDesignSet !== 'function' || global.studioFilterHomeDesignSet.__sized) return;
    const orig = global.studioFilterHomeDesignSet;
    global.studioFilterHomeDesignSet = function (value) {
      orig(value);
      if (typeof global.renderStudioHomeTemplateGrid === 'function') global.renderStudioHomeTemplateGrid();
      const grid = document.getElementById('studio-home-templates');
      if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    global.studioFilterHomeDesignSet.__sized = true;
  }

  const boot = setInterval(function () {
    injectCss();
    wrapPreview();
    wrapCards();
    wrapSets();
    wrapFilter();
  }, 300);
  setTimeout(function () { clearInterval(boot); }, 20000);
})(window);
