/* MarketSync Design Studio — template imagery.
 *
 * Every picture a template shows has to be a vehicle or an RV. That is a hard
 * rule, not a preference, and the old catalogue broke it in the worst possible
 * way: photo slots held hand-copied Unsplash photo IDs, nobody could verify what
 * an ID actually pointed at, and templates shipped showing a field of solar
 * panels where a vehicle belonged.
 *
 * So no photo is addressed by ID here. A slot carries an automotive or RV SEARCH
 * TERM, and it is filled, in order of preference:
 *
 *   1. the dealership's own inventory photography — real vehicles, on the lot;
 *   2. the automotive stock pool, fetched by that search term through the
 *      backend's Pexels proxy, so the result is on-topic by construction;
 *   3. a drawn vehicle silhouette on the template's own palette.
 *
 * Step 3 is why there is no failure mode that shows something unrelated. When
 * the network is down, the key is unset, or a query returns nothing, the slot
 * renders as a car, truck, van, motorhome or trailer drawn in this file.
 */
(function (global) {
  'use strict';

  // ── Vehicle marks ─────────────────────────────────────────────────────────
  // Drawn on a 240×110 viewBox with the wheels sitting on y≈86 so every mark
  // shares a baseline and a set of them reads as one family.
  const MARKS = {
    sedan: 'M10,80 L20,60 Q25,51 38,49 L86,45 Q102,33 124,33 L150,33 Q170,35 184,50 L208,57 Q228,61 230,73 L230,80 Q230,86 222,86 L18,86 Q10,86 10,80 Z',
    suv: 'M12,80 L18,54 Q21,45 34,43 L74,40 Q80,26 100,25 L160,25 Q178,27 190,44 L212,52 Q230,57 231,70 L231,80 Q231,86 223,86 L20,86 Q12,86 12,80 Z',
    pickup: 'M10,80 L14,58 Q17,49 30,47 L62,45 Q68,28 88,27 L124,27 Q140,29 148,47 L150,47 L150,44 Q150,41 154,41 L226,41 Q231,41 231,46 L231,80 Q231,86 223,86 L18,86 Q10,86 10,80 Z',
    van: 'M12,80 L14,44 Q16,30 34,28 L150,28 Q168,29 182,42 L214,56 Q231,62 231,74 L231,80 Q231,86 223,86 L20,86 Q12,86 12,80 Z',
    motorhome: 'M10,82 L10,30 Q10,20 22,20 L182,20 Q196,20 202,30 L224,52 Q232,58 232,70 L232,82 Q232,88 224,88 L18,88 Q10,88 10,82 Z',
    trailer: 'M2,62 L34,62 L34,34 Q34,24 46,24 L212,24 Q224,24 224,34 L224,80 Q224,86 216,86 L42,86 Q34,86 34,80 L34,70 L2,70 Z',
    fifth_wheel: 'M6,74 L30,74 L30,44 Q30,34 44,34 L66,34 L66,26 Q66,18 78,18 L214,18 Q226,18 226,28 L226,80 Q226,86 218,86 L44,86 Q30,86 30,78 L30,80 L6,80 Z',
    camper_van: 'M12,82 L12,46 Q14,32 32,30 L60,30 L60,22 Q60,16 70,16 L134,16 Q144,16 144,24 L144,30 L156,30 Q172,32 186,44 L214,56 Q231,62 231,74 L231,82 Q231,88 223,88 L20,88 Q12,88 12,82 Z'
  };

  const WHEELS = {
    sedan: [[64, 86, 17], [186, 86, 17]],
    suv: [[62, 86, 18], [188, 86, 18]],
    pickup: [[58, 86, 18], [192, 86, 18]],
    van: [[60, 86, 18], [190, 86, 18]],
    motorhome: [[56, 88, 17], [176, 88, 17], [204, 88, 17]],
    trailer: [[128, 86, 17]],
    fifth_wheel: [[150, 86, 16], [186, 86, 16]],
    camper_van: [[60, 88, 18], [190, 88, 18]]
  };

  // Query → mark. Ordered longest-phrase first so "camper van" is not captured
  // by the bare "van" rule.
  const MARK_RULES = [
    [/fifth wheel/, 'fifth_wheel'],
    [/camper van|campervan/, 'camper_van'],
    [/travel trailer/, 'trailer'],
    [/motorhome|recreational|\brv\b/, 'motorhome'],
    // Truck before the generic trailer rule: "pickup truck towing trailer" is a
    // truck campaign, while "travel trailer towed by truck" is caught above.
    [/pickup|truck/, 'pickup'],
    [/trailer|towing|towed/, 'trailer'],
    [/suv|crossover|family/, 'suv'],
    [/van|cargo/, 'van']
  ];

  function markFor(query) {
    const q = String(query || '').toLowerCase();
    for (const [pattern, mark] of MARK_RULES) if (pattern.test(q)) return mark;
    return 'sedan';
  }

  function isLight(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return false;
    const n = parseInt(m[1], 16);
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255 >= 0.55;
  }

  function escapeAttr(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  }

  /**
   * A drawn placeholder for a photo slot: the template's own palette with the
   * matching vehicle silhouette. Returned as a data URI so it needs no network
   * and cannot 404 — the two ways a remote placeholder fails in the field.
   *
   * The viewBox is built to the SLOT's aspect ratio rather than to the drawing's
   * own. An image whose ratio disagrees with its box gets cropped by
   * object-fit:cover, and on a tall slot that crop magnifies the middle of the
   * artwork until a car fills the frame like a billboard. Matching the ratio
   * means the mark is composed for the space it is actually going into.
   */
  function silhouetteDataUri(query, options) {
    const o = options || {};
    const mark = markFor(query);
    const from = o.from || '#1E293B';
    const to = o.to || '#0F172A';
    // White ink disappears on the light palettes, so the mark's ink follows the
    // ground it is drawn on rather than being fixed.
    const ink = o.ink || (isLight(from) ? 'rgba(15,23,42,0.20)' : 'rgba(255,255,255,0.22)');
    const ratio = Math.max(0.08, Math.min(12, (Number(o.width) || 4) / (Number(o.height) || 3)));
    const vbW = 400;
    const vbH = Math.max(34, Math.round(vbW / ratio));
    // Fit the 240×110 drawing into a comfortable share of the slot and centre
    // it, so it reads as a composed mark at any proportion.
    const k = Math.min((vbW * 0.62) / 240, (vbH * 0.46) / 110);
    const tx = (vbW - 240 * k) / 2;
    const ty = (vbH - 110 * k) / 2;
    const wheels = (WHEELS[mark] || []).map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid slice">`
      + `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">`
      + `<stop offset="0" stop-color="${escapeAttr(from)}"/><stop offset="1" stop-color="${escapeAttr(to)}"/>`
      + `</linearGradient></defs>`
      + `<rect width="${vbW}" height="${vbH}" fill="url(#g)"/>`
      + `<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${k.toFixed(4)})" fill="${escapeAttr(ink)}">`
      + `<path d="${MARKS[mark]}"/>${wheels}</g>`
      + `</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  // ── Automotive stock pool ─────────────────────────────────────────────────
  // One pool, warmed once per session, keyed by the automotive/RV search terms
  // the factory uses. Nothing else is ever requested, so nothing off-topic can
  // enter the pool in the first place.
  const pool = new Map();
  let warming = null;

  function poolFor(query) {
    const list = pool.get(String(query || '').toLowerCase());
    return Array.isArray(list) ? list : [];
  }

  function rememberPool(query, urls) {
    const clean = (urls || []).filter(url => typeof url === 'string' && /^https:\/\//.test(url));
    if (clean.length) pool.set(String(query || '').toLowerCase(), clean);
    return clean;
  }

  async function warmPool(fetchJson, queries) {
    if (warming) return warming;
    warming = (async () => {
      try {
        const data = await fetchJson('/marketing/studio/template-imagery');
        const groups = data && data.imagery && typeof data.imagery === 'object' ? data.imagery : {};
        for (const [query, urls] of Object.entries(groups)) rememberPool(query, urls);
      } catch (error) {
        // A cold or unconfigured stock pool is not an error state for the user:
        // every slot still renders, as a drawn vehicle rather than a photo.
        if (global.console && global.console.debug) global.console.debug('[studio] stock imagery unavailable, using drawn vehicles', error && error.message);
      }
      return pool;
    })();
    return warming;
  }

  /**
   * Fills the photo slots of a scene. `inventoryPhotos` (the dealership's own
   * vehicle photography) is preferred over stock for every slot, because a
   * dealer's own car beats a stock car every time. The choice is indexed, not
   * random, so re-resolving the same scene produces the same design.
   */
  function resolveScene(scene, options) {
    const o = options || {};
    const inventory = (o.inventoryPhotos || []).filter(url => typeof url === 'string' && url);
    const palette = o.palette || {};
    const elements = (scene && scene.elements) || [];
    let slot = 0;
    for (const element of elements) {
      if (!element || (element.type !== 'vehicle-image' && element.type !== 'image')) continue;
      // A drawn placeholder is marked as one, so that resolving again after the
      // stock pool warms upgrades it to a photograph. Without the mark, the
      // first paint would pin a drawing in place for the rest of the session.
      if (element.src && !element.ms_placeholder) { slot += 1; continue; }
      const query = element.image_query || 'car dealership lot';
      const stock = poolFor(query);
      if (inventory.length) {
        element.src = inventory[slot % inventory.length];
        delete element.ms_placeholder;
      } else if (stock.length) {
        element.src = stock[(o.seed == null ? slot : o.seed + slot) % stock.length];
        delete element.ms_placeholder;
      } else {
        element.src = silhouetteDataUri(query, { from: palette.panel || o.from, to: palette.ground || o.to, ink: o.ink, width: element.width, height: element.height });
        element.ms_placeholder = true;
      }
      slot += 1;
    }
    return scene;
  }

  global.MS_STUDIO_IMAGERY = {
    MARKS, markFor, isLight, silhouetteDataUri, resolveScene, warmPool, poolFor, rememberPool,
    poolSize: () => pool.size,
    resetPool: () => { pool.clear(); warming = null; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
