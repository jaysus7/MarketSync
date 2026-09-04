/* Clicking a template must paint a dealer-ready canvas, not a blank page. */
(function (global) {
  'use strict';

  const PEXELS = [
    'https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&w=1600',
    'https://images.pexels.com/photos/1149137/pexels-photo-1149137.jpeg?auto=compress&cs=tinysrgb&w=1600',
    'https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg?auto=compress&cs=tinysrgb&w=1600',
    'https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg?auto=compress&cs=tinysrgb&w=1600',
    'https://images.pexels.com/photos/112460/pexels-photo-112460.jpeg?auto=compress&cs=tinysrgb&w=1600',
    'https://images.pexels.com/photos/164634/pexels-photo-164634.jpeg?auto=compress&cs=tinysrgb&w=1600',
    'https://images.pexels.com/photos/244206/pexels-photo-244206.jpeg?auto=compress&cs=tinysrgb&w=1600',
    'https://images.pexels.com/photos/358070/pexels-photo-358070.jpeg?auto=compress&cs=tinysrgb&w=1600'
  ];

  function dealer() {
    const cfg = global.__dealerConfig || global.__dealership || {};
    const brand = (cfg.branding && typeof cfg.branding === 'object') ? cfg.branding : cfg;
    const logoImg = document.querySelector('#dashboard-brand img:not(.hidden), header img[alt*="MarketSync"]');
    return {
      name: cfg.store_name || cfg.name || brand.name || 'Your Dealership',
      city: cfg.city || brand.city || '',
      phone: cfg.phone || brand.phone || '',
      logo: brand.logo_url || brand.logo || cfg.logo_url || cfg.logo || (logoImg && logoImg.src) || ''
    };
  }

  function vehicle() {
    const v = global.__studioCurrentVehicle || (global.__catalogCache && global.__catalogCache[0]) || {};
    const photos = [].concat(v.image_urls || [], v.photos || [], v.photo_url || []);
    return {
      year: v.year || '2024',
      make: v.make || 'Chevrolet',
      model: v.model || 'Silverado',
      trim: v.trim || 'RST',
      price: v.price ? ('$' + Number(v.price).toLocaleString()) : '$48,990',
      stock: v.stocknumber || v.stock_number || 'MS-1024',
      photo: photos[0] || PEXELS[1]
    };
  }

  function fillTokens(text, d, v) {
    return String(text || '')
      .replace(/\{\{vehicle\.year\}\}/g, v.year)
      .replace(/\{\{vehicle\.make\}\}/g, v.make)
      .replace(/\{\{vehicle\.model\}\}/g, v.model)
      .replace(/\{\{vehicle\.trim\}\}/g, v.trim)
      .replace(/\{\{vehicle\.price\}\}/g, v.price)
      .replace(/\{\{vehicle\.stock_number\}\}/g, v.stock)
      .replace(/\{\{vehicle\.stocknumber\}\}/g, v.stock)
      .replace(/\{\{dealership\.name\}\}/g, d.name)
      .replace(/\{\{dealership\.logo_url\}\}/g, d.logo)
      .replace(/\{\{cta\}\}/g, 'Shop this vehicle');
  }

  function formatSize(key) {
    const map = {
      square: [1080, 1080], story: [1080, 1920], portrait: [1080, 1350], landscape: [1920, 1080],
      letterhead: [816, 1056], business_card: [1050, 600], flyer: [816, 1056], poster: [1080, 1620],
      banner: [1920, 600], email: [1200, 400], cover: [1640, 924], youtube: [1280, 720]
    };
    return map[key] || [1080, 1080];
  }

  function buildScene(templateKey) {
    const catalog = global.STUDIO_TEMPLATES_CATALOG || {};
    const tmpl = catalog[templateKey] || {};
    const formatKey = tmpl.format_key || 'square';
    const size = formatSize(formatKey);
    const d = dealer();
    const v = vehicle();
    const hero = v.photo || PEXELS[0];
    const scene = tmpl.scene ? JSON.parse(JSON.stringify(tmpl.scene)) : {
      version: 1, format_key: formatKey, width: size[0], height: size[1],
      background: { color: '#0F172A' }, elements: []
    };
    scene.width = scene.width || size[0];
    scene.height = scene.height || size[1];
    scene.elements = Array.isArray(scene.elements) ? scene.elements : [];

    if (!scene.elements.length) {
      scene.elements = [
        { id: 'hero', type: 'image', src: hero, x: 0, y: 0, width: scene.width, height: Math.round(scene.height * 0.62), fit: 'cover', z: 1, name: 'Hero photo' },
        { id: 'panel', type: 'shape', shapeType: 'rect', x: 0, y: Math.round(scene.height * 0.55), width: scene.width, height: Math.round(scene.height * 0.45), fill: '#0F172A', z: 2, name: 'Copy panel' },
        { id: 'kicker', type: 'text', x: 48, y: Math.round(scene.height * 0.58), text: 'JUST ARRIVED', fontSize: 18, fontWeight: '800', fill: '#818CF8', z: 3 },
        { id: 'title', type: 'text', x: 48, y: Math.round(scene.height * 0.64), text: v.year + ' ' + v.make + ' ' + v.model, fontSize: 42, fontWeight: '900', fill: '#F8FAFC', z: 4 },
        { id: 'sub', type: 'text', x: 48, y: Math.round(scene.height * 0.72), text: v.trim + ' • Stock #' + v.stock, fontSize: 22, fontWeight: '600', fill: '#94A3B8', z: 5 },
        { id: 'price', type: 'text', x: 48, y: Math.round(scene.height * 0.80), text: v.price, fontSize: 36, fontWeight: '900', fill: '#34D399', z: 6 },
        { id: 'dealer', type: 'text', x: 48, y: scene.height - 70, text: d.name, fontSize: 18, fontWeight: '800', fill: '#E2E8F0', z: 7 }
      ];
      if (d.logo) {
        scene.elements.push({ id: 'logo', type: 'image', src: d.logo, x: scene.width - 180, y: 36, width: 132, height: 56, fit: 'contain', z: 8, name: 'Dealership logo' });
      }
    }

    scene.elements.forEach(function (el, idx) {
      if (el.text) el.text = fillTokens(el.text, d, v);
      if ((el.type === 'vehicle-image' || el.type === 'image' || el.type === 'logo') && (!el.src || String(el.src).indexOf('{{') !== -1)) {
        el.src = el.type === 'logo' || /logo/i.test(el.name || '') ? (d.logo || PEXELS[5]) : (idx === 0 ? hero : PEXELS[idx % PEXELS.length]);
      }
      if (el.type === 'vehicle-image') el.type = 'image';
    });
    if (d.logo && !scene.elements.some(function (el) { return /logo/i.test(el.name || el.id || ''); })) {
      scene.elements.push({ id: 'ms-logo', type: 'image', src: d.logo, x: scene.width - 180, y: 28, width: 132, height: 56, fit: 'contain', z: 99, name: 'Dealership logo' });
    }
    return scene;
  }

  async function paint(templateKey) {
    const key = templateKey || global.__studioPendingTemplate || global.__studioAppliedTemplateKey;
    const scene = buildScene(key);
    if (typeof global.loadStudioTemplate === 'function') {
      try { await global.loadStudioTemplate(key); } catch (e) {}
    }
    if (global.__studioAdapter && typeof global.__studioAdapter.renderScene === 'function') {
      await global.__studioAdapter.renderScene(scene);
    }
    global.__studioDocument = scene;
    if (global.__msStudioStore && typeof global.__msStudioStore.update === 'function') global.__msStudioStore.update(scene);
  }

  function wrap() {
    ['startStudioTemplate', 'applyStudioTemplate', 'previewStudioTemplate'].forEach(function (name) {
      const orig = global[name];
      if (typeof orig !== 'function' || orig.__msHydrate) return;
      global[name] = function (templateKey) {
        global.__studioPendingTemplate = templateKey;
        const out = orig.apply(this, arguments);
        setTimeout(function () { paint(templateKey); }, 600);
        setTimeout(function () { paint(templateKey); }, 1600);
        return out;
      };
      global[name].__msHydrate = true;
    });
  }

  function watchClicks() {
    document.addEventListener('click', function (ev) {
      const card = ev.target.closest('[data-template-key], [data-studio-template], button, article');
      if (!card) return;
      const key = card.getAttribute('data-template-key') || card.getAttribute('data-studio-template');
      const label = (card.textContent || '').toLowerCase();
      if (key) {
        global.__studioPendingTemplate = key;
        setTimeout(function () { paint(key); }, 800);
      } else if (/use template|open template|start with this/.test(label)) {
        setTimeout(function () { paint(global.__studioPendingTemplate); }, 800);
      }
    }, true);
  }

  wrap();
  watchClicks();
  setInterval(wrap, 800);
})(window);
