(function () {
  window.msDesignStudioTransform = { update: properties => window.__studioAdapter?.updateSelected(properties), geometry: (property, value) => window.studioSetObjectGeometry?.(property, value), nudge: (x, y) => window.__studioAdapter?.nudgeSelected(x, y) };
})();
