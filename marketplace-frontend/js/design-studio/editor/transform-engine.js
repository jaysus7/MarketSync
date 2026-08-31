(function () {
  window.msDesignStudioTransform = {
    update: properties => window.__studioAdapter?.updateSelected(properties), geometry: (property, value) => window.studioSetObjectGeometry?.(property, value), nudge: (x, y) => window.__studioAdapter?.nudgeSelected(x, y),
    align: axis => window.__studioAdapter?.alignSelected(axis), distribute: axis => window.__studioAdapter?.distributeSelected(axis),
    lock: value => window.__studioAdapter?.toggleSelectedLock(value), visible: value => window.__studioAdapter?.toggleSelectedVisibility(value),
    flipX: () => { const object = window.__studioAdapter?.fabricCanvas?.getActiveObject(); return object && window.__studioAdapter.updateSelected({ flipX: !object.flipX }); },
    flipY: () => { const object = window.__studioAdapter?.fabricCanvas?.getActiveObject(); return object && window.__studioAdapter.updateSelected({ flipY: !object.flipY }); }
  };
})();
