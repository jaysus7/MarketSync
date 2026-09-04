/* MarketSync Design Studio document model.
 * The canvas adapter still consumes the legacy `elements` array, while the
 * persisted document has pages, objects, components, assets and metadata.
 * This compatibility boundary lets new editor features grow without breaking
 * existing designs or published renders.
 */
(function () {
  const clone = value => JSON.parse(JSON.stringify(value == null ? null : value));
  const id = prefix => `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;

  window.msStudioNormalizeDocument = function (scene, options = {}) {
    const input = scene || window.msCreateDefaultScene?.(options.formatKey || 'square') || {};
    const legacyObjects = Array.isArray(input.elements) ? input.elements : (Array.isArray(input.layers) ? input.layers : []);
    const existingPages = Array.isArray(input.pages) ? input.pages : [];
    const pages = existingPages.length ? existingPages : [{
      id: id('page'), name: 'Page 1', width: Number(input.width) || 1080, height: Number(input.height) || 1080,
      background: clone(input.background || { color: '#FFFFFF' }), objects: legacyObjects
    }];
    const first = pages[0];
    return {
      version: Math.max(3, Number(input.version) || 0), id: input.id || id('doc'), title: input.title || options.title || 'Untitled Design',
      format_key: input.format_key || options.formatKey || 'square', width: Number(input.width || first.width) || 1080,
      height: Number(input.height || first.height) || 1080, brand_id: input.brand_id || null,
      metadata: { ...(input.metadata || {}), ...(input.seo ? { seo: clone(input.seo) } : {}) },
      assets: Array.isArray(input.assets) ? clone(input.assets) : [],
      components: Array.isArray(input.components) ? clone(input.components) : [],
      pages: pages.map((page, index) => ({
        id: page.id || id('page'), name: page.name || `Page ${index + 1}`,
        format_key: page.format_key || input.format_key || options.formatKey || 'square',
        variation_of: page.variation_of || null,
        width: Number(page.width || input.width) || 1080, height: Number(page.height || input.height) || 1080,
        background: clone(page.background || input.background || { color: '#FFFFFF' }),
        objects: Array.isArray(page.objects) ? clone(page.objects) : [],
        duration_ms: Math.max(500, Number(page.duration_ms) || 5000),
        transition: page.transition || 'none'
      }))
    };
  };

  window.msStudioDocumentToScene = function (document) {
    const doc = window.msStudioNormalizeDocument(document);
    const page = doc.pages[0];
    return {
      version: doc.version, id: doc.id, title: doc.title, format_key: doc.format_key,
      width: page.width, height: page.height, background: page.background,
      elements: clone(page.objects), pages: clone(doc.pages), components: clone(doc.components), assets: clone(doc.assets), metadata: clone(doc.metadata)
    };
  };

  window.msStudioSceneToDocument = function (scene, options = {}) {
    return window.msStudioNormalizeDocument(scene, options);
  };

  window.msStudioResolveObject = function (object, breakpoint = 'desktop') {
    const override = object?.responsive?.[breakpoint];
    return override && typeof override === 'object' ? { ...clone(object), ...clone(override) } : clone(object);
  };

  window.msStudioAddPage = function (document, options = {}) {
    const doc = window.msStudioNormalizeDocument(document);
    const index = doc.pages.length + 1;
    doc.pages.push({ id: id('page'), name: options.name || `Page ${index}`, format_key: options.format_key || doc.format_key, variation_of: options.variation_of || null, width: options.width || doc.width, height: options.height || doc.height, background: { color: options.background || '#FFFFFF' }, objects: [], duration_ms: Math.max(500, Number(options.duration_ms) || 5000), transition: options.transition || 'none' });
    return doc;
  };

  window.msStudioCreateComponent = function (name = 'Component', children = []) {
    return { id: id('component'), name, type: 'component', props: {}, children: clone(children), created_at: new Date().toISOString() };
  };

  window.msStudioCreateRepeater = function (name = 'Repeater', collection = 'inventory', template = {}) {
    return { id: id('repeater'), name, type: 'repeater', collection, item_key: 'id', template: clone(template), items: [] };
  };
})();

(function loadStudioCompanions() {
  if (window.__studioPageThumbsLoaded) return;
  window.__studioPageThumbsLoaded = true;
  [
    '/js/modules/studio/studio-dashboard-home.js?v=20260904_home_dash_v4',
    '/js/modules/studio/studio-page-thumbs.js?v=20260904_white_canvas_v1',
    '/js/modules/studio/studio-elements-upgrade.js?v=20260904_elements_v1',
    '/js/modules/studio/studio-unify-elements.js?v=20260904_unify_v1',
    '/js/modules/studio/studio-template-previews.js?v=20260904_tmpl_preview_v1'
  ].forEach(function (src) {
    var s = document.createElement('script');
    s.src = src;
    document.head.appendChild(s);
  });
})();
