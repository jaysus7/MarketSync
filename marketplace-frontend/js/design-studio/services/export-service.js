(function () {
  const dataUrl = (format = 'png', options = {}) => window.__studioAdapter?.fabricCanvas?.toDataURL?.({ format, quality: options.quality ?? .92, multiplier: Math.max(.25, Math.min(4, Number(options.multiplier) || 1)) });
  const download = (format = 'png', options = {}) => {
    const url = dataUrl(format === 'jpg' ? 'jpeg' : format, options); if (!url) return false;
    const link = document.createElement('a'); link.href = url; link.download = `${options.name || 'marketsync-design'}.${format}`; link.click(); return true;
  };
  window.msDesignStudioExport = { scene: () => window.__studioAdapter?.exportScene(), png: options => dataUrl('png', options), jpg: options => dataUrl('jpeg', options), download, supported: ['png','jpg','transparent-png','webp-render','social-handoff'] };
})();
