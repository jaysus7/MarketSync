/* Pull live / demo lot vehicles into Website Studio and Design Studio. */
(function (global) {
  'use strict';

  function token() {
    return localStorage.getItem('token') || localStorage.getItem('ms_auth_token') || '';
  }
  function api() {
    return global.API || (location.hostname.indexOf('staging') !== -1
      ? 'https://marketsync-staging-backend.onrender.com'
      : 'https://vehicle-marketplace-s0e4.onrender.com');
  }

  function photosOf(v) {
    const out = [];
    const push = function (u) {
      const url = typeof u === 'string' ? u : (u && (u.url || u.src || u.image || u.href));
      if (url && out.indexOf(url) === -1) out.push(url);
    };
    if (Array.isArray(v.image_urls)) v.image_urls.forEach(push);
    if (Array.isArray(v.photos)) v.photos.forEach(push);
    if (Array.isArray(v.images)) v.images.forEach(push);
    if (v.photo_url) push(v.photo_url);
    if (v.hero_image) push(v.hero_image);
    if (v.image) push(v.image);
    return out;
  }

  function labelOf(v) {
    return [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ') || v.stocknumber || v.vin || 'Vehicle';
  }

  function cache() {
    return (global.__catalogCache && global.__catalogCache.length) ? global.__catalogCache : (global.__msInvBridge || []);
  }

  async function loadLot() {
    if (cache().length) return cache();
    try {
      const res = await fetch(api() + '/inventory/all', { headers: { Authorization: 'Bearer ' + token() } });
      const body = await res.json().catch(function () { return []; });
      const rows = Array.isArray(body) ? body : (body.vehicles || body.items || []);
      global.__msInvBridge = rows;
      if (!global.__catalogCache || !global.__catalogCache.length) global.__catalogCache = rows;
      return rows;
    } catch (e) {
      return [];
    }
  }

  function fillWebsiteGrid(inv) {
    const box = document.getElementById('ws-inv-photos-grid');
    if (!box) return;
    const photos = [];
    (inv || []).forEach(function (v) {
      photosOf(v).forEach(function (url) {
        photos.push({ url: url, label: labelOf(v), id: v.id });
      });
    });
    if (!photos.length) {
      box.innerHTML = '<div class="col-span-3 py-10 text-center text-xs text-slate-500">No lot photos yet — add pictures on Inventory and they appear here.</div>';
      return;
    }
    box.innerHTML = photos.slice(0, 60).map(function (p) {
      const safe = String(p.url).replace(/'/g, '');
      return '<button type="button" class="rounded-xl overflow-hidden border border-slate-200 bg-white text-left" onclick="(window.pickWsPhoto||window.selectWsPhoto||function(){})(\'' + safe + '\')">' +
        '<img src="' + safe + '" alt="" class="w-full h-20 object-cover">' +
        '<div class="px-2 py-1 text-[10px] font-bold text-slate-600 truncate">' + labelOf({ year: '', make: p.label }) + '</div></button>';
    }).join('');
  }

  function fillStudioPickers(inv) {
    document.querySelectorAll('[data-inventory-picker], #studio-inventory-grid, #ds-inventory-grid').forEach(function (box) {
      if (!inv.length) return;
      box.innerHTML = inv.slice(0, 40).map(function (v) {
        const img = photosOf(v)[0] || '';
        return '<button type="button" class="rounded-xl border border-slate-200 overflow-hidden text-left" data-inv-id="' + (v.id || '') + '">' +
          (img ? '<img src="' + img + '" class="w-full h-24 object-cover" alt="">' : '<div class="h-24 bg-slate-100"></div>') +
          '<div class="px-2 py-1.5 text-[11px] font-black">' + labelOf(v) + '</div></button>';
      }).join('');
    });
  }

  function fillWebsitePreview(inv) {
    const empty = Array.from(document.querySelectorAll('p, div, span')).find(function (el) {
      const t = (el.textContent || '').trim().toLowerCase();
      return t === 'no vehicles found' || t === 'no inventory' || t === 'no vehicles in inventory';
    });
    if (!empty || !inv.length) return;
    const host = empty.parentElement;
    if (!host || host.dataset.msInvFilled) return;
    host.dataset.msInvFilled = '1';
    host.innerHTML = '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' + inv.slice(0, 12).map(function (v) {
      const img = photosOf(v)[0] || '';
      return '<article class="rounded-2xl border border-slate-200 overflow-hidden bg-white">' +
        (img ? '<img src="' + img + '" class="w-full h-36 object-cover" alt="">' : '') +
        '<div class="p-3"><div class="font-black text-sm">' + labelOf(v) + '</div>' +
        '<div class="text-xs text-slate-500">' + (v.stocknumber ? 'Stock ' + v.stocknumber : '') + '</div></div></article>';
    }).join('') + '</div>';
  }

  function wrapLoader() {
    if (typeof global.loadWsInventoryPhotos !== 'function' || global.loadWsInventoryPhotos.__msBridge) return;
    const orig = global.loadWsInventoryPhotos;
    global.loadWsInventoryPhotos = async function () {
      const inv = await loadLot();
      fillWebsiteGrid(inv);
      try { await orig.apply(this, arguments); } catch (e) {}
      fillWebsiteGrid(inv.length ? inv : cache());
    };
    global.loadWsInventoryPhotos.__msBridge = true;
  }

  async function enhance() {
    wrapLoader();
    const inv = await loadLot();
    fillWebsiteGrid(inv);
    fillStudioPickers(inv);
    fillWebsitePreview(inv);
  }

  const tick = setInterval(enhance, 1200);
  setTimeout(function () { clearInterval(tick); enhance(); }, 20000);
  enhance();
})(window);
