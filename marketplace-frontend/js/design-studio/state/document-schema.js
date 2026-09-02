(function () {
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const makeId = prefix => `${prefix}_${globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
  const formats = {
    square: { label: 'Instagram / Facebook Square', width: 1080, height: 1080, channel: 'social' },
    portrait: { label: 'Instagram Portrait', width: 1080, height: 1350, channel: 'social' },
    story: { label: 'Instagram Story', width: 1080, height: 1920, channel: 'social' },
    tiktok: { label: 'TikTok Vertical Video', width: 1080, height: 1920, channel: 'social' },
    facebook_post: { label: 'Facebook Post', width: 1200, height: 630, channel: 'social' },
    facebook_story: { label: 'Facebook Story', width: 1080, height: 1920, channel: 'social' },
    marketplace: { label: 'Marketplace Image', width: 1200, height: 900, channel: 'marketplace' },
    linkedin: { label: 'LinkedIn Image', width: 1200, height: 627, channel: 'social' },
    x_landscape: { label: 'X Image', width: 1600, height: 900, channel: 'social' },
    youtube: { label: 'YouTube Thumbnail', width: 1280, height: 720, channel: 'social' },
    pinterest: { label: 'Pinterest Pin', width: 1000, height: 1500, channel: 'social' },
    email_hero: { label: 'Email Hero', width: 1200, height: 600, channel: 'campaign' },
    website_banner: { label: 'Website Banner', width: 1920, height: 720, channel: 'website' },
    display_300x250: { label: 'Display Ad · 300×250', width: 300, height: 250, channel: 'display' },
    display_728x90: { label: 'Display Ad · 728×90', width: 728, height: 90, channel: 'display' },
    display_160x600: { label: 'Display Ad · 160×600', width: 160, height: 600, channel: 'display' },
    letterhead: { label: 'Letterhead · US Letter', width: 2550, height: 3300, channel: 'print' },
    presentation: { label: 'Presentation Slide · 16:9', width: 1920, height: 1080, channel: 'presentation' },
    business_card: { label: 'Business Card · 3.5×2 in', width: 1050, height: 600, channel: 'print' },
    postcard: { label: 'Postcard · 6×4 in', width: 1800, height: 1200, channel: 'print' },
    flyer: { label: 'Flyer · US Letter', width: 2550, height: 3300, channel: 'print' },
    brochure: { label: 'Tri-fold Brochure · Letter', width: 3300, height: 2550, channel: 'print' }
  };
  const bindingFields = ['vehicle.photo','vehicle.year','vehicle.make','vehicle.model','vehicle.trim','vehicle.vin','vehicle.stock_number','vehicle.msrp','vehicle.sale_price','vehicle.payment','vehicle.mileage','vehicle.exterior_color','vehicle.drivetrain','vehicle.body_style','vehicle.fuel_type','vehicle.availability','dealership.logo_url','dealership.name','dealership.phone','dealership.website','salesperson.name','salesperson.phone','cta'];
  const getPath = (source, path) => String(path || '').split('.').reduce((value, key) => value == null ? value : value[key], source);
  const money = value => value == null || value === '' ? '' : `$${Number(value).toLocaleString('en-CA', { maximumFractionDigits: 0 })}`;
  const number = value => value == null || value === '' ? '' : Number(value).toLocaleString('en-CA');
  const formatValue = (path, value) => /(?:msrp|sale_price|payment)$/.test(path) ? money(value) : /mileage$/.test(path) ? number(value) : String(value ?? '');

  function normalizeContext(input = {}) {
    const vehicle = input.vehicle || {};
    const dealership = input.dealership || {};
    const salesperson = input.salesperson || input.rep || {};
    return {
      vehicle: { ...vehicle, photo: vehicle.photo || vehicle.primary_photo_url || vehicle.photo_url || vehicle.image_url || vehicle.image_urls?.[0] || '', stock_number: vehicle.stock_number || vehicle.stocknumber || vehicle.stock_no || '', msrp: vehicle.msrp ?? vehicle.msrp_price ?? null, sale_price: vehicle.sale_price ?? vehicle.price ?? null, exterior_color: vehicle.exterior_color || vehicle.color || '', body_style: vehicle.body_style || vehicle.body || '', fuel_type: vehicle.fuel_type || vehicle.fuel || '', availability: vehicle.availability || vehicle.status || '' },
      dealership: { ...dealership, name: dealership.name || dealership.store_name || '', logo_url: dealership.logo_url || dealership.logo || '', website: dealership.website || dealership.website_url || '' },
      salesperson: { ...salesperson, name: salesperson.name || salesperson.full_name || '' }, cta: input.cta || 'Shop now'
    };
  }
  function resolveTemplate(value, context = {}) {
    const facts = normalizeContext(context);
    return String(value == null ? '' : value).replace(/\{\{\s*([a-zA-Z0-9_.]+)(?:\|([^}]*))?\s*\}\}/g, (_match, path, fallback) => {
      const resolved = getPath(facts, path);
      if (resolved !== undefined && resolved !== null && resolved !== '') return formatValue(path, resolved);
      return fallback === undefined ? '' : fallback.trim();
    });
  }
  function normalize(input = {}) {
    const pages = Array.isArray(input.pages) && input.pages.length ? input.pages : [{ id: makeId('page'), name: 'Page 1', width: input.width || 1080, height: input.height || 1080, background: clone(input.background || { color: '#0F172A' }), objects: clone(input.elements || []) }];
    return { version: Math.max(3, Number(input.version) || 0), id: input.id || makeId('design'), title: input.title || 'Untitled Design', format_key: input.format_key || 'square', width: Number(input.width || pages[0].width) || 1080, height: Number(input.height || pages[0].height) || 1080, metadata: clone(input.metadata || {}), assets: clone(input.assets || []), components: clone(input.components || []), pages: pages.map((page, index) => ({ id: page.id || makeId('page'), name: page.name || `Page ${index + 1}`, format_key: page.format_key || input.format_key || 'square', variation_of: page.variation_of || null, width: Number(page.width || input.width) || 1080, height: Number(page.height || input.height) || 1080, background: clone(page.background || { color: '#0F172A' }), objects: clone(page.objects || []), duration_ms: Math.max(500, Number(page.duration_ms) || 5000), transition: page.transition || 'none' })) };
  }
  function semanticRole(object = {}) {
    const name = `${object.name || ''} ${object.binding?.field || ''}`.toLowerCase();
    if (/background|backdrop/.test(name)) return 'background';
    if (/logo|dealership mark/.test(name)) return 'logo';
    if (/disclaimer|legal|o\.a\.c|terms/.test(name)) return 'legal';
    if (/cta|button|shop|book|call/.test(name)) return 'cta';
    if (/price|payment|apr|rate|offer|badge/.test(name)) return 'offer';
    if (object.type === 'vehicle-image' || /vehicle photo|hero image/.test(name)) return 'vehicle';
    if (object.type === 'image') return 'media';
    if (/headline|title|vehicle name/.test(name)) return 'headline';
    if (object.type === 'text') return 'copy';
    return 'decoration';
  }
  function reflowScene(scene, formatKey) {
    const target = formats[formatKey] || formats.square;
    const source = clone(scene || {});
    const oldWidth = Number(source.width) || 1080, oldHeight = Number(source.height) || 1080;
    const width = target.width, height = target.height, margin = Math.max(18, Math.round(Math.min(width, height) * .055));
    const scale = Math.min(width / oldWidth, height / oldHeight), ratio = width / height;
    const objects = (source.elements || source.objects || []).map((object, index) => {
      const next = clone(object), role = semanticRole(next);
      next.width = Math.max(12, Math.round((Number(next.width) || 220) * scale)); next.height = Math.max(12, Math.round((Number(next.height) || 80) * scale));
      next.fontSize = next.fontSize ? Math.max(10, Math.round(Number(next.fontSize) * scale)) : next.fontSize;
      next.x = Math.round((Number(next.x) || 0) / oldWidth * width); next.y = Math.round((Number(next.y) || 0) / oldHeight * height);
      next.constraints = { ...(next.constraints || {}), role };
      if (role === 'background') return { ...next, x: 0, y: 0, width, height };
      if (role === 'logo') return { ...next, x: width - margin - Math.min(next.width, width * .24), y: margin, width: Math.min(next.width, width * .24) };
      if (role === 'legal') return { ...next, x: margin, y: height - margin - Math.min(next.height, height * .09), width: width - margin * 2, fontSize: Math.min(next.fontSize || 14, Math.max(9, width * .018)) };
      if (ratio > 1.65) {
        if (role === 'vehicle' || role === 'media') return { ...next, x: Math.round(width * .52), y: margin, width: Math.round(width * .45), height: height - margin * 2 };
        if (role === 'headline') return { ...next, x: margin, y: margin, width: Math.round(width * .45), fontSize: Math.min(next.fontSize || 56, height * .24) };
        if (role === 'offer') return { ...next, x: margin, y: Math.round(height * .5), width: Math.round(width * .28) };
        if (role === 'cta') return { ...next, x: margin, y: height - margin - next.height, width: Math.min(next.width, Math.round(width * .32)) };
      } else if (ratio < .72) {
        if (role === 'vehicle' || role === 'media') return { ...next, x: margin, y: Math.round(height * .23), width: width - margin * 2, height: Math.round(height * .43) };
        if (role === 'headline') return { ...next, x: margin, y: margin * 1.5, width: width - margin * 2, fontSize: Math.min(next.fontSize || 58, width * .105) };
        if (role === 'offer') return { ...next, x: margin, y: Math.round(height * .69), width: Math.round(width * .52) };
        if (role === 'cta') return { ...next, x: margin, y: Math.round(height * .81), width: width - margin * 2 };
      }
      next.x = Math.max(margin, Math.min(width - margin - next.width, next.x)); next.y = Math.max(margin, Math.min(height - margin - next.height, next.y)); next.z = Number(next.z) || index + 1;
      return next;
    });
    return { ...source, version: 3, format_key: formatKey, width, height, elements: objects, objects, metadata: { ...(source.metadata || {}), reflowed_at: new Date().toISOString(), reflow_strategy: 'semantic-v1' } };
  }
  function createVariations(scene, formatKeys = []) {
    const baseId = scene?.id || makeId('variation-source');
    return Array.from(new Set(formatKeys)).filter(key => formats[key]).map(key => { const reflowed = reflowScene(scene, key); return { id: makeId('page'), name: formats[key].label, format_key: key, variation_of: baseId, width: reflowed.width, height: reflowed.height, background: reflowed.background, objects: reflowed.elements, duration_ms: 5000, transition: 'none' }; });
  }
  function refreshBindings(scene, context = {}) {
    const facts = normalizeContext(context), next = clone(scene || {});
    const refresh = object => { const binding = object.binding || {}; if ((object.type === 'vehicle-image' || object.type === 'image') && binding.field === 'vehicle.photo') object.src = facts.vehicle.photo || object.src; if (object.type === 'text' && (binding.template || /\{\{/.test(object.text || ''))) { object.binding = { ...binding, template: binding.template || object.text }; object.text = resolveTemplate(object.binding.template, facts); } return object; };
    next.elements = (next.elements || []).map(refresh); next.pages = (next.pages || []).map(page => ({ ...page, objects: (page.objects || []).map(refresh) }));
    next.metadata = { ...(next.metadata || {}), binding_context: { vehicle_id: facts.vehicle.id || null, refreshed_at: new Date().toISOString() } }; return next;
  }
  const templateGroups = {
    'Vehicle marketing': ['New Arrival','Used Vehicle','Certified Pre-Owned','Sold','Delivery','Featured Vehicle','Vehicle Spotlight','Weekend Special','Manager Special','Clearance','Demo','Incoming Vehicle'],
    Promotions: ['Finance Rate','Lease Offer','Cash Purchase','Trade-In Event','OEM Incentive','Loyalty Offer','Conquest Offer','First-Time Buyer','Holiday Sale','Month-End Event','Year-End Event','Truck Event','SUV Event','EV Event'],
    'Fixed operations': ['Service Special','Tire Special','Oil Change','Brake Service','Seasonal Service','Parts Promotion','Accessories','Detailing','Collision'],
    'Dealership content': ['Employee Spotlight','Customer Delivery','Review/Testimonial','Community Event','Holiday','Hours Change','Hiring','Award','Anniversary','Brand Awareness']
  };
  function templateScene(name, category, index) {
    const service = category === 'Fixed operations', people = category === 'Dealership content', accent = ['#2563EB','#0F766E','#B45309','#7C3AED','#BE123C'][index % 5];
    const title = service || people ? name.toUpperCase() : '{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}';
    return { version: 3, format_key: 'square', width: 1080, height: 1080, background: { color: '#0F172A' }, metadata: { template_category: category, template_name: name, editable: true }, elements: [
      { id: makeId('el'), type: 'shape', shapeType: 'rect', name: 'Background panel', x: 0, y: 0, width: 1080, height: 1080, fill: '#0F172A', z: 1 },
      { id: makeId('el'), type: service || people ? 'image' : 'vehicle-image', name: service ? 'Service photo' : people ? 'Dealership photo' : 'Vehicle Photo', binding: service || people ? null : { field: 'vehicle.photo' }, x: 0, y: 190, width: 1080, height: 600, fit: 'cover', z: 2 },
      { id: makeId('el'), type: 'shape', shapeType: 'badge', name: 'Offer badge', x: 54, y: 54, width: 360, height: 72, fill: accent, rx: 24, z: 3 },
      { id: makeId('el'), type: 'text', name: 'Campaign eyebrow', text: name.toUpperCase(), binding: { template: name.toUpperCase() }, x: 84, y: 70, width: 500, height: 54, fontSize: 26, fontWeight: '900', fill: '#FFFFFF', z: 4 },
      { id: makeId('el'), type: 'text', name: 'Headline', text: title, binding: { template: title }, x: 54, y: 810, width: 760, height: 80, fontSize: 48, fontWeight: '900', fill: '#FFFFFF', z: 5 },
      { id: makeId('el'), type: 'text', name: 'Price / offer', text: service || people ? '{{dealership.name}}' : '{{vehicle.sale_price|Contact us}}', binding: { template: service || people ? '{{dealership.name}}' : '{{vehicle.sale_price|Contact us}}' }, x: 54, y: 900, width: 520, height: 68, fontSize: 34, fontWeight: '800', fill: '#5EEAD4', z: 6 },
      { id: makeId('el'), type: 'shape', shapeType: 'badge', name: 'CTA Button', x: 650, y: 900, width: 370, height: 82, fill: accent, rx: 22, z: 7 },
      { id: makeId('el'), type: 'text', name: 'CTA Text', text: '{{cta|Learn more}}', binding: { template: '{{cta|Learn more}}' }, x: 705, y: 923, width: 280, height: 44, fontSize: 25, fontWeight: '900', fill: '#FFFFFF', z: 8 },
      { id: makeId('el'), type: 'text', name: 'Legal disclaimer', text: '{{dealership.legal_disclaimer|Vehicle availability and offer terms are subject to change.}}', binding: { template: '{{dealership.legal_disclaimer|Vehicle availability and offer terms are subject to change.}}' }, x: 54, y: 1025, width: 970, height: 24, fontSize: 13, fontWeight: '500', fill: '#CBD5E1', z: 9 }
    ] };
  }
  const templateFormats = ['square','portrait','story','facebook_post','linkedin','x_landscape','youtube','pinterest','marketplace'];
  const automotiveTemplates = Object.entries(templateGroups).flatMap(([category, names], groupIndex) => names.map((name, index) => {
    const format_key = templateFormats[(groupIndex * 3 + index) % templateFormats.length];
    const scene = format_key === 'square' ? templateScene(name, category, index) : reflowScene(templateScene(name, category, index), format_key);
    scene.metadata = { ...(scene.metadata || {}), template_category: category, template_name: name, editable: true };
    return { template_key: `auto_${category}_${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '_'), name, category, format_key, editable: true, scene };
  }));
  window.msDesignStudioSchema = { clone, makeId, normalize, formats, bindingFields, normalizeContext, resolveTemplate, semanticRole, reflowScene, createVariations, refreshBindings, automotiveTemplates, createObject: (type, data = {}) => ({ id: makeId('object'), type, name: data.name || type, visible: true, locked: false, opacity: 1, ...clone(data) }) };
  window.msDesignStudioFormats = formats; window.msDesignStudioAutomotiveTemplates = automotiveTemplates;
})();
