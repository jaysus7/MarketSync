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
      background: clone(input.background || { color: '#0F172A' }), objects: legacyObjects
    }];
    const first = pages[0];
    return {
      version: 2, id: input.id || id('doc'), title: input.title || options.title || 'Untitled Design',
      format_key: input.format_key || options.formatKey || 'square', width: Number(input.width || first.width) || 1080,
      height: Number(input.height || first.height) || 1080, brand_id: input.brand_id || null,
      metadata: { ...(input.metadata || {}), ...(input.seo ? { seo: clone(input.seo) } : {}) },
      assets: Array.isArray(input.assets) ? clone(input.assets) : [],
      components: Array.isArray(input.components) ? clone(input.components) : [],
      pages: pages.map((page, index) => ({
        id: page.id || id('page'), name: page.name || `Page ${index + 1}`,
        width: Number(page.width || input.width) || 1080, height: Number(page.height || input.height) || 1080,
        background: clone(page.background || input.background || { color: '#0F172A' }),
        objects: Array.isArray(page.objects) ? clone(page.objects) : []
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
})();
