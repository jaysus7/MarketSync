(function () {
  window.msDesignStudioKeyboard = { nudge(event) { const distance = event.shiftKey ? 10 : 1; const delta = { ArrowUp: [0, -distance], ArrowDown: [0, distance], ArrowLeft: [-distance, 0], ArrowRight: [distance, 0] }[event.key]; if (!delta) return false; event.preventDefault(); window.__studioAdapter?.nudgeSelected(...delta); return true; } };
})();
