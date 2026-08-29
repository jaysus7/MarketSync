(function () {
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const makeId = prefix => `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
  function normalize(input = {}) {
    const pages = Array.isArray(input.pages) && input.pages.length ? input.pages : [{ id: makeId('page'), name: 'Page 1', width: input.width || 1080, height: input.height || 1080, background: clone(input.background || { color: '#0F172A' }), objects: clone(input.elements || []) }];
    return { version: 2, id: input.id || makeId('design'), title: input.title || 'Untitled Design', format_key: input.format_key || 'square', width: Number(input.width || pages[0].width) || 1080, height: Number(input.height || pages[0].height) || 1080, metadata: clone(input.metadata || {}), assets: clone(input.assets || []), components: clone(input.components || []), pages: pages.map((page, index) => ({ id: page.id || makeId('page'), name: page.name || `Page ${index + 1}`, width: Number(page.width || input.width) || 1080, height: Number(page.height || input.height) || 1080, background: clone(page.background || { color: '#0F172A' }), objects: clone(page.objects || []) })) };
  }
  window.msDesignStudioSchema = { clone, makeId, normalize, createObject: (type, data = {}) => ({ id: makeId('object'), type, name: data.name || type, visible: true, locked: false, opacity: 1, ...clone(data) }) };
})();
