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
    background: { color: '#0F172A' },
    elements: []
  };
};

/**
 * Resolve dynamic bindings in template strings: `{{namespace.field|fallback}}`
 */
window.msResolveTemplateVars = function(str, context = {}) {
  if (str == null) return '';
  const vehicle = context.vehicle || {};
  const dealership = context.dealership || window.__dealerConfig || {};
  const rep = context.rep || window.__user || {};

  const varMap = {
    'vehicle.year': vehicle.year || '2024',
    'vehicle.make': vehicle.make || 'Ford',
    'vehicle.model': vehicle.model || 'F-150',
    'vehicle.trim': vehicle.trim || 'Lariat',
    'vehicle.price': vehicle.price ? (typeof vehicle.price === 'number' ? `$${vehicle.price.toLocaleString()}` : vehicle.price) : null,
    'vehicle.payment': vehicle.payment ? `$${vehicle.payment}/mo` : '$499/mo',
    'vehicle.mileage': vehicle.mileage ? Number(vehicle.mileage).toLocaleString() : '12,450',
    'vehicle.stock_number': vehicle.stock_number || vehicle.stock_no || 'STK-9041',
    'vehicle.vin': vehicle.vin || '1FTFW1ED4MFC12345',
    'dealership.name': dealership.store_name || dealership.name || 'MarketSync Motors',
    'dealership.phone': dealership.phone || '(555) 234-5678',
    'dealership.website': dealership.website || 'www.marketsync.com',
    'rep.first_name': rep.first_name || (rep.name ? rep.name.split(' ')[0] : 'Dave'),
    'rep.full_name': rep.name || 'Dave Miller'
  };

  return String(str).replace(/\{\{\s*([a-zA-Z0-9_.]+)(?:\|([^}]+))?\s*\}\}/g, (match, path, fallback) => {
    const val = varMap[path];
    if (val != null && val !== '') return val;
    return fallback !== undefined ? fallback : '';
  });
};

/**
 * Update all bound elements in a scene when switching vehicles
 */
window.msSwapVehicleInScene = function(scene, newVehicle) {
  if (!scene || !Array.isArray(scene.elements)) return scene;

  scene.elements.forEach(el => {
    if (el.type === 'vehicle-image' && newVehicle?.primary_photo_url) {
      el.src = newVehicle.primary_photo_url;
    }
  });

  return scene;
};
