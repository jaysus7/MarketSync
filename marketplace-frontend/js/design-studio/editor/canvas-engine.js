(function () {
  window.msDesignStudioCanvas = { get: () => window.__studioAdapter?.fabricCanvas, addText: (...args) => window.__studioAdapter?.addText(...args), addShape: (...args) => window.__studioAdapter?.addShape(...args), addImage: (...args) => window.__studioAdapter?.addImage(...args), render: scene => window.__studioAdapter?.renderScene(scene), export: () => window.__studioAdapter?.exportScene() };
})();
