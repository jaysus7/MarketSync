(function () {
  window.msDesignStudioSelection = { active: () => window.__studioAdapter?.fabricCanvas?.getActiveObject(), all: () => window.__studioAdapter?.fabricCanvas?.getActiveObjects?.() || [], select: object => { const canvas = window.__studioAdapter?.fabricCanvas; if (!canvas || !object) return; canvas.discardActiveObject(); canvas.setActiveObject(object); canvas.requestRenderAll(); window.__studioAdapter?.onSelectionChange([object]); } };
})();
