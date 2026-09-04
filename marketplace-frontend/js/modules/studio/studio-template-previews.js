/* True-size template thumbnails + full creative catalog on Creative Home. */
(function (global) {
  'use strict';

  function injectCss() {
    if (document.getElementById('studio-template-preview-css')) return;
    const style = document.createElement('style');
    style.id = 'studio-template-preview-css';
    style.textContent = `
      #studio-home-template-grid{align-items:start}
      .studio-home-template-card .studio-template-stage{
        display:flex;align-items:center;justify-content:center;
        height:220px;padding:12px;background:#e2e8f0;overflow:hidden;
      }
      .dark .studio-home-template-card .studio-template-stage{background:#0f172a}
      .studio-template-preview{
        position:relative;overflow:hidden;flex:0 1 auto;
        height:196px;width:auto;max-width:100%;
        box-shadow:0 10px 28px rgba(15,23,42,.22);
        border:1px solid rgba(15,23,42,.12);border-radius:8px;
        container-type:size;
      }
      .studio-template-preview.is-wide{width:100%;height:auto;max-height:196px}
      .studio-template-kicker{
        position:absolute;left:8px;top:8px;z-index:2;
        border-radius:8px;background:rgba(15,23,42,.82);color:#fff;
        padding:3px 7px;font:800 9px/1.1 -apple-system,Segoe UI,sans-serif;
      }
      .studio-template-cat{
        grid-column:1/-1;margin-top:8px;
        font:800 11px/1 -apple-system,Segoe UI,sans-serif;
        letter-spacing:.16em;text-transform:uppercase;color:#6366f1;
      }
    `;
    document.head.appendChild(style);
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function mergeCreative() {
    const catalog = global.STUDIO_TEMPLATES_CATALOG;
    if (!catalog) return;
    (global.msDesignStudioAutomotiveTemplates || []).forEach(function (template) {
      if (!template || !template.template_key || catalog[template.template_key]) return;
      catalog[template.template_key] = Object.assign({
        desc: (template.category || 'Creative') + ' · fully editable',
        width: template.scene && template.scene.width,
        height: template.scene && template.scene.height
      }, template);
    });
  }

  function wrapPreview() {
    if (typeof global.templatePreviewMarkup !== 'function' || global.templatePreviewMarkup.__sized) return;
    const orig = global.templatePreviewMarkup;
    global.templatePreviewMarkup = function (tmpl) {
      const scene = Object.assign({}, (tmpl && tmpl.scene) || {});
      if (!(scene.elements && scene.elements.length) && Array.isArray(scene.pages) && scene.pages[0]) {
        scene.elements = scene.pages[0].objects || scene.pages[0].elements || [];
      }
      const html = orig(Object.assign({}, tmpl, { scene: scene }));
      const w = Number(scene.width || tmpl.width || 1080);
      const h = Number(scene.height || tmpl.height || 1080);
      const wide = w >= h * 1.15;
      return String(html || '').replace('class="studio-template-preview"', 'class="studio-template-preview' + (wide ? ' is-wide' : '') + '"');
    };
    global.templatePreviewMarkup.__sized = true;
  }

  function card(template) {
    const key = encodeURIComponent(template.template_key);
    const format = (global.STUDIO_SOCIAL_FORMATS || {})[template.format_key] || {};
    const w = Number(template.width || template.scene && template.scene.width || 1080);
    const h = Number(template.height || template.scene && template.scene.height || 1080);
    const preview = typeof global.templatePreviewMarkup === 'function' ? global.templatePreviewMarkup(template) : '';
    const pages = template.scene && template.scene.pages && template.scene.pages.length > 1 ? '<span class="studio-template-kicker" style="left:auto;right:8px">' + template.scene.pages.length + ' pages</span>' : '';
    return '<button type="button" onclick="startStudioTemplate(decodeURIComponent(\'' + key + '\'))" class="studio-home-template-card group min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-left shadow-sm dark:border-white/10 dark:bg-slate-900">' +
      '<div class="studio-template-stage relative">' + preview +
      '<span class="studio-template-kicker">' + w + ' × ' + h + '</span>' + pages + '</div>' +
      '<div class="p-3"><div class="truncate text-sm font-black">' + esc(template.name) + '</div>' +
      '<div class="mt-1 truncate text-xs text-slate-500">' + esc(format.label || template.category || 'Editable design') + '</div></div></button>';
  }

  function wrapCards() {
    if (typeof global.studioHomeTemplateCards !== 'function' || global.studioHomeTemplateCards.__sized) return;
    global.studioHomeTemplateCards = function () {
      mergeCreative();
      const query = String(global.__studioHomeTemplateQuery || '').trim().toLowerCase();
      const setFilter = global.__studioHomeDesignSet || 'all';
      const formatFilter = global.__studioHomeFormat || 'all';
      const catalog = global.STUDIO_TEMPLATES_CATALOG || {};
      const templates = Object.values(catalog).filter(function (template) {
        const searchable = ((template.name || '') + ' ' + (template.desc || '') + ' ' + (template.category || '') + ' ' + (template.design_set || '')).toLowerCase();
        return (!query || searchable.indexOf(query) >= 0) && (setFilter === 'all' || template.design_set === setFilter) && (formatFilter === 'all' || template.format_key === formatFilter);
      });
      const groups = {};
      templates.forEach(function (template) {
        const cat = template.category || (String(template.template_key || '').indexOf('auto_') === 0 ? 'Creative campaigns' : 'Templates');
        (groups[cat] = groups[cat] || []).push(template);
      });
      const order = ['Vehicle marketing','Promotions','Fixed operations','Dealership content','Print & stationery','Presentations','Display advertising','Social media','Design templates','Templates'];
      const keys = Object.keys(groups).sort(function (a, b) {
        const ia = order.indexOf(a), ib = order.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
      const html = keys.map(function (cat) {
        const list = groups[cat];
        const cap = cat === 'Social media' ? 18 : 30;
        return '<div class="studio-template-cat">' + esc(cat) + ' · ' + list.length + '</div>' + list.slice(0, cap).map(card).join('');
      }).join('');
      return html || '<div class="col-span-full rounded-3xl border border-dashed border-slate-300 px-6 py-12 text-center"><h3 class="font-black">No matching templates</h3></div>';
    };
    global.studioHomeTemplateCards.__sized = true;
    if (typeof global.renderStudioHomeTemplateGrid === 'function') global.renderStudioHomeTemplateGrid();
  }

  const boot = setInterval(function () {
    injectCss();
    wrapPreview();
    wrapCards();
  }, 300);
  setTimeout(function () { clearInterval(boot); }, 20000);
})(window);
