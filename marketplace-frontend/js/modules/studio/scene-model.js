/**
 * MarketSync Design Studio — Scene Schema & Dynamic Binding Engine
 *
 * Single source of truth for design scene JSON structures and variable resolution.
 */

window.__MS_STUDIO_FORMATS = {
  square: { name: 'Instagram / Facebook Square', width: 1080, height: 1080 },
  portrait: { name: 'Instagram Portrait', width: 1080, height: 1350 },
  story: { name: 'Instagram Story / Reel', width: 1080, height: 1920 },
  landscape: { name: 'Facebook Banner / Link', width: 1200, height: 628 }
};

window.msCreateDefaultScene = function(formatKey = 'square') {
  const fmt = window.__MS_STUDIO_FORMATS[formatKey] || window.__MS_STUDIO_FORMATS.square;
  return {
    version: 1,
    format_key: formatKey,
    width: fmt.width,
    height: fmt.height,
    background: { color: '#FFFFFF' },
    elements: []
  };
};
