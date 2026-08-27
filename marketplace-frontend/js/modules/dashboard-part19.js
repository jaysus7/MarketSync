/* dashboard.js split part 19/26 — contiguous, load-order-critical. Do not reorder the <script> tags in dashboard.html. */

let __catalogStatusFilter = 'all';
let __catalogTypeFilter = 'all';
let __catalogSegmentFilter = 'all';
// Both inventory experiences use the same dealership inventory pool. A vehicle may come
// from a website feed, a CSV, a manual entry, or a won trade appraisal — all of them can
// be prepared and posted from the Facebook Marketplace experience.
let __catalogSourceFilter = 'all';

// The Inventory page serves two nav entries: the Facebook posting hub (feed sync +
// synced stock) and the Inventory-Intelligence manual list (own stock only).
// Default to 'manual' so generic deep-links land on the dealer's own inventory.
let __inventoryMode = 'manual';   // 'facebook' | 'manual'
function applyInventoryMode() {
  const facebook = __inventoryMode === 'facebook';
  const feeds = document.getElementById('feeds-panel');
  const catalogPanel = document.getElementById('catalog-panel');
  const title = document.getElementById('catalog-title');
  const sub = document.getElementById('catalog-sub');
  
  if (catalogPanel) catalogPanel.classList.remove('hidden');
  if (feeds) {
    if (facebook) feeds.classList.remove('hidden');
    else feeds.classList.add('hidden'); // Only show inventory cards in manual mode
  }
  
  __catalogSourceFilter = 'all';
  if (title) title.textContent = facebook ? 'Inventory Catalog' : 'Inventory List';
  if (sub) sub.textContent = facebook
    ? 'All of your stock, ready to post on Facebook Marketplace.'
    : 'Your whole lot — Facebook-synced, manually added, and won trade appraisals.';
  applyInventoryProductGating();
  // Ensure inventory catalog is loaded and rendered
  if (typeof loadInventoryCatalog === 'function') {
    if (typeof __catalogCache === 'undefined' || !__catalogCache || !__catalogCache.length) {
      loadInventoryCatalog();
    } else if (document.getElementById('catalog-list')) {
      renderCatalog();
    }
  }
  if (facebook && typeof loadInventoryFeeds === 'function') {
    loadInventoryFeeds();
  }
}
window.applyInventoryMode = applyInventoryMode;
// The feed panel is always shown on the inventory view now; the "Sync Inventory"
// button just scrolls up to it (it never hides the panel).
function toggleFeedsPanel() {
  const f = document.getElementById('feeds-panel'); if (!f) return;
  f.classList.remove('hidden');
  f.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.toggleFeedsPanel = toggleFeedsPanel;
// Inventory creation is an RBAC capability, not a product restriction. Facebook users
// with inventory.edit can add a single vehicle or import a CSV as well as sync a feed.
// The server independently enforces this permission on every write.
function applyInventoryProductGating() {
  const canManageInventory = window.canDo('inventory.edit');
  document.querySelectorAll('.inv-raw-add').forEach(el => el.classList.toggle('hidden', !canManageInventory));
}
window.applyInventoryProductGating = applyInventoryProductGating;

// A vehicle the dealer entered themselves: manually added, imported, or acquired
// from a trade appraisal. Everything else came in from a synced website feed.
function catalogIsMine(v) {
  return ['manual', 'appraisal', 'import'].includes(v.source) || !!v.source_appraisal_id;
}
function catalogIsSynced(v) { return !catalogIsMine(v); }

// Days-in-stock aging badge — the core lot metric, shown on every live card (no AI
// add-on required). Bands: 0-30 fresh (green), 31-60 (amber), 61-90 (orange), 90+
// aged (red). Sold/archived units don't age. Uses created_at (when the unit first
// landed in our system) as the in-stock proxy.
function catalogDaysInStock(v) {
  if (!v.created_at) return null;
  const d = Math.floor((Date.now() - new Date(v.created_at).getTime()) / 86400000);
  return Number.isFinite(d) && d >= 0 ? d : null;
}
function catalogAgeBadge(v) {
  if (v.status === 'sold') return '';
  const days = catalogDaysInStock(v);
  if (days == null) return '';
  const TAG = 'inline-flex items-center text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border backdrop-blur-sm';
  const cls = days <= 30 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
    : days <= 60 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
    : days <= 90 ? 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30'
    : 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30';
  const tip = `In stock ${days} day${days === 1 ? '' : 's'}${days > 90 ? ' — aged unit, prioritise moving it' : days > 60 ? ' — getting old' : ''}`;
  return `<span class="${TAG} ${cls}" title="${tip}">${days}d in stock</span>`;
}
// Merchandising-completeness flag — a live unit missing photos or a price won't
// sell and hurts the lot. Universal (no add-on), and only nags on live stock.
function catalogGapBadge(v) {
  if (v.status === 'sold') return '';
  const gaps = [];
  if (!(v.image_urls && v.image_urls.length)) gaps.push('photos');
  if (!(Number(v.price) > 0)) gaps.push('price');
  if (!gaps.length) return '';
  const TAG = 'inline-flex items-center text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border backdrop-blur-sm';
  return `<span class="${TAG} bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30" title="Missing ${gaps.join(' & ')} — this unit isn't merchandising-ready">Needs ${gaps.join(' + ')}</span>`;
}

function renderCatalog() {
  const list = document.getElementById('catalog-list');
  if (!list) return;
  const q = (document.getElementById('catalog-search')?.value || '').trim().toLowerCase();
  const statusFilter = __catalogStatusFilter;
  const typeFilter = __catalogTypeFilter;
  const segmentFilter = __catalogSegmentFilter;

  const conditionRank = (v) => {
    const c = (v.condition || '').toLowerCase();
    if (c === 'used') return 0;
    if (c === 'demo') return 1;
    if (c === 'new') return 2;
    return 3; // unknown
  };
  const catalogSortRank = (v) => {
    const s = v.status;
    if (s === 'sold') return 400 + conditionRank(v);
    if (s === 'pending') return 300 + conditionRank(v);
    // available / posted: Used → Demo → New
    return conditionRank(v);
  };

  let filtered = __catalogCache;
  if (__catalogSourceFilter === 'mine') filtered = filtered.filter(catalogIsMine);
  else if (__catalogSourceFilter === 'synced') filtered = filtered.filter(catalogIsSynced);
  if (statusFilter !== 'all') {
    filtered = filtered.filter(v => v.status === statusFilter);
  }
  if (typeFilter !== 'all') {
    filtered = filtered.filter(v => (v.condition || '').toLowerCase() === typeFilter);
  }
  if (segmentFilter !== 'all') {
    filtered = filtered.filter(v => {
      const mm = `${v.make} ${v.model}`.toLowerCase();
      return segmentFilter === 'hot' ? __hotMakeModels.has(mm) : __coldMakeModels.has(mm);
    });
  }
  if (q) {
    filtered = filtered.filter(v =>
      `${v.year} ${v.make} ${v.model} ${v.trim || ''} ${v.vin || ''} ${v.stocknumber || ''} ${v.exterior_color || ''}`
        .toLowerCase()
        .includes(q)
    );
  }
  filtered = [...filtered].sort((a, b) => catalogSortRank(a) - catalogSortRank(b));

  if (!filtered.length) {
    document.getElementById('catalog-value-summary')?.classList.add('hidden');
    // Mode-aware empty state: Facebook inventory can be feed-synced or added directly.
    const noFilters = q === '' && statusFilter === 'all' && typeFilter === 'all' && segmentFilter === 'all';
    let msg = 'No vehicles match.';
    if (noFilters) {
      msg = __inventoryMode === 'facebook'
        ? 'No vehicles yet. Use “Add vehicle”, import a CSV, or sync an inventory feed.'
        : 'No vehicles yet. Use “Add vehicle” or import a CSV — trade appraisals you win also land here.';
    }
    list.innerHTML = `<div class="text-xs text-slate-500 italic col-span-full">${msg}</div>`;
    return;
  }

  // Glass tag base — translucent fill + subtle border + blur, rounded rectangle.
  const TAG = 'inline-flex items-center text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border backdrop-blur-sm';
  const statusBadge = (s) => {
    const map = {
      available: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      pending:   'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
      sold:      'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30'
    };
    const tip = { available: 'Available — live and sellable', pending: 'Pending — a deal is in progress on this unit', sold: 'Sold — off the live lot' }[s] || 'Status unknown';
    return `<span class="${TAG} ${map[s] || map.sold}" title="${tip}">${s || 'unknown'}</span>`;
  };
  const conditionBadge = (c) => {
    if (!c) return '';
    const lc = c.toLowerCase();
    const cls = lc === 'new'
      ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
      : lc === 'demo'
        ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30'
        : 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30';
    const tip = lc === 'new' ? 'New — never registered/retailed' : lc === 'demo' ? 'Demo — dealer-driven demonstrator' : 'Used — previously owned';
    return `<span class="${TAG} ${cls}" title="${tip}">${c}</span>`;
  };

  // Manager value summary (internal): retail, cost & potential gross on the live lot.
  (() => {
    const sum = document.getElementById('catalog-value-summary'); if (!sum) return;
    const isMgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
    const avail = filtered.filter(v => v.status !== 'sold');
    const withCost = avail.filter(v => v.invoice_amount != null && v.price);
    if (!isMgr || !avail.length) { sum.className = 'hidden'; return; }
    const totRetail = avail.reduce((s, v) => s + (Number(v.price) || 0), 0);
    const totCost = withCost.reduce((s, v) => s + (Number(v.invoice_amount) || 0), 0);
    const totGross = withCost.reduce((s, v) => s + ((Number(v.price) || 0) - (Number(v.invoice_amount) || 0)), 0);
    // Lot health: how much of the live inventory is aging past 60 / 90 days.
    const ages = avail.map(catalogDaysInStock).filter(d => d != null);
    const aged60 = ages.filter(d => d > 60).length;
    const aged90 = ages.filter(d => d > 90).length;
    const avgAge = ages.length ? Math.round(ages.reduce((s, d) => s + d, 0) / ages.length) : null;
    const m = (n) => '$' + Math.round(n).toLocaleString();
    const tile = (label, val, cls = 'text-slate-900 dark:text-white', tip = '') => `<div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2"${tip ? ` title="${tip}"` : ''}><div class="text-[10px] uppercase tracking-wider text-slate-400 font-bold">${label}</div><div class="text-base font-black ${cls}">${val}</div></div>`;
    // Show cost/gross tiles only when we actually have cost data; always show units,
    // retail, average age and the aged-unit count (the lot-health signal).
    const costTiles = withCost.length ? (m(totCost) && (tile('Cost in stock', m(totCost)) + tile('Potential gross', (totGross >= 0 ? '' : '−') + m(Math.abs(totGross)), totGross >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'))) : '';
    const agedCls = aged90 > 0 ? 'text-rose-600 dark:text-rose-400' : aged60 > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
    sum.className = 'grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3';
    sum.innerHTML = tile('Units (live)', avail.length)
      + tile('Retail value', m(totRetail))
      + (avgAge != null ? tile('Avg days in stock', avgAge + 'd', avgAge > 60 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white') : '')
      + tile('Aged 60d+', aged60 + (aged90 ? ` · ${aged90} over 90` : ''), agedCls, 'Live units in stock more than 60 (and 90) days — prioritise moving these')
      + costTiles;
  })();

  list.innerHTML = filtered.map(v => {
    const img = v.image_urls?.[0]
      ? `<img src="${API}/proxy-image?url=${encodeURIComponent(v.image_urls[0])}" loading="lazy" class="w-full h-32 object-cover rounded bg-slate-50 dark:bg-slate-950">`
      : catalogCarPlaceholder('w-full h-32 rounded');
    const price = v.price ? `$${Number(v.price).toLocaleString()}` : '—';
    const mileage = v.mileage ? `${Number(v.mileage).toLocaleString()} km` : 'New';
    // Every card is clickable. Prefer the vehicle's source_url (harvested or per-feed),
    // fall back to a stock-number search on the dealer's site so the click still does
    // something useful even when we don't have a direct URL.
    const fallbackUrl = (() => {
      try {
        const base = v.source_url ? new URL(v.source_url).origin : null;
        if (base && v.stocknumber) return `${base}/?s=${encodeURIComponent(v.stocknumber)}`;
        return null;
      } catch { return null; }
    })();
    const href = v.source_url || fallbackUrl;
    const tag = href ? 'a' : 'div';
    const linkAttrs = href
      ? `href="${href}" target="_blank" rel="noopener" title="Open on dealer site ↗"`
      : '';
    const externalIcon = href
      ? `<svg class="w-3 h-3 text-slate-400 dark:text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>`
      : '';
    return `
      <${tag} ${linkAttrs} class="relative bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-3 flex flex-col gap-2 ${href ? 'hover:border-indigo-400 dark:hover:border-indigo-500 transition no-underline' : ''}">
        <div class="absolute top-1.5 right-1.5 z-10 flex items-center gap-1">
          ${catalogIsMine(v) ? `<button onclick="event.preventDefault();event.stopPropagation();editVehicle('${v.id}')" title="Edit vehicle" class="bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-700 rounded-md p-1 shadow border border-slate-200 dark:border-slate-700"><svg class="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 4H4a1 1 0 00-1 1v14a1 1 0 001 1h14a1 1 0 001-1v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>` : ''}
          ${v.status === 'posted' ? `<span title="Live on Facebook Marketplace" class="bg-emerald-600 text-white rounded-md px-1.5 py-1 shadow text-[10px] font-bold flex items-center gap-0.5"> Posted</span>` : ''}
          <button type="button" onclick="event.preventDefault();event.stopPropagation();msPostVehicle('${v.id}',this)" title="${v.status === 'posted' ? 'Re-post this vehicle' : 'Post this vehicle on Facebook Marketplace'} — the MarketSync extension auto-fills the listing" class="bg-[#1877F2] hover:bg-[#0f6ae0] text-white rounded-md px-1.5 py-1 shadow text-[10px] font-bold flex items-center gap-1">${v.status === 'posted' ? 'Repost ↗' : 'Post ↗'}</button>
        </div>
        ${img}
        <div class="text-xs font-bold text-slate-900 dark:text-white truncate" title="${v.year} ${v.make} ${v.model} ${v.trim || ''}">${v.year} ${v.make} ${v.model}</div>
        <div class="flex items-center gap-1 flex-wrap">
          ${conditionBadge(v.condition)}
          ${statusBadge(v.status)}
          ${catalogAgeBadge(v)}
          ${catalogGapBadge(v)}
          ${v.awaiting_possession ? `<span class="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md border bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" title="Acquired trade — hidden from your website until the deal is delivered (possession)">⏳ Awaiting possession</span>` : ''}
          ${(() => {
            const makeModel = `${v.make} ${v.model}`.toLowerCase()
            const gtag = 'inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md border backdrop-blur-sm'
            const hotColdTag = __invIntelActive
              ? (__hotMakeModels.has(makeModel) ? `<span class="${gtag} bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30" title="Hot — this make/model is selling fast off your lot; stock more / price with confidence"> Hot</span>`
                : __coldMakeModels.has(makeModel) ? `<span class="${gtag} bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30" title="Cold — slow mover; consider sharper pricing or wholesaling"> Cold</span>`
                : '')
              : ''
            const healthScore = __invIntelActive && __vehicleHealthScores[v.id] != null ? __vehicleHealthScores[v.id] : null
            const healthBadge = healthScore != null ? (() => {
              const cls = healthScore >= 80 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                : healthScore >= 50 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                : 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30'
              return `<span class="${gtag} ${cls}" title="Merchandising health 0–100 (photos, price, mileage, description, days on lot). Open the unit to see the breakdown."> ${healthScore}/100</span>`
            })() : ''
            // Pricing action verdict (from the AI market report): green = priced right,
            // amber = underpriced (raise), red = overpriced (lower). Hidden if the price
            // changed since the report ran (stale) or no report exists yet.
            const vv = __invIntelActive ? __marketVerdicts[v.id] : null
            const vFresh = vv && (vv.price_at_generation == null || Number(vv.price_at_generation) === Number(v.price))
            const verdictBadge = vFresh ? (() => {
              const map = {
                ok:    { cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', txt: ' Priced right' },
                raise: { cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30', txt: '↑ Underpriced' },
                lower: { cls: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30', txt: '↓ Overpriced' },
              }
              const cfg = map[vv.verdict]; if (!cfg) return ''
              const tip = ((vv.headline || cfg.txt) + (vv.reason ? ' — ' + vv.reason : '')).replace(/"/g, '&quot;')
              return `<span class="${gtag} ${cfg.cls}" title="${tip}">${cfg.txt}</span>`
            })() : ''
            const recallCount = Array.isArray(v.recalls) ? v.recalls.length : 0
            const recallBadge = recallCount > 0
              ? `<span class="${gtag} bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30" title="${recallCount} open recall${recallCount > 1 ? 's' : ''} — open VIN Decode for details"> ${recallCount} Recall${recallCount > 1 ? 's' : ''}</span>`
              : ''
            // "% to market" — used cars only, from the last Inventory Scan's market median.
            const mktMedian = __invIntelActive ? __marketPositions[v.id] : null
            const isUsedCar = (v.condition || '').toLowerCase() === 'used'
            let marketBadge = ''
            if (mktMedian && isUsedCar && v.price > 0) {
              const pct = Math.round((Number(v.price) / mktMedian) * 100)
              // Suppress implausible values (thin/noisy comps) — only show a sane band.
              if (pct >= 60 && pct <= 160) {
                const m = __marketMeta[v.id] || {};
                const cnt = m.count != null ? Number(m.count) : null;
                // A read that wasn't matched to this exact trim (or is thin) pools other
                // trims and can read falsely over/under — show it greyed with a warning
                // so nobody reprices off a bad comp set.
                const shaky = m.trim_matched === false || (cnt != null && cnt < 8);
                const cls = shaky ? 'bg-slate-400/15 text-slate-500 dark:text-slate-400 border-slate-400/30'
                  : pct > 103 ? 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30'
                  : pct < 97 ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
                const matchTxt = m.trim_matched === true ? 'trim-matched' : m.trim_matched === false ? 'matched on model, NOT trim — verify' : 'match basis unknown';
                const cntTxt = cnt != null ? `${cnt} comp${cnt === 1 ? '' : 's'}` : 'comp count n/a';
                const tip = `Your price vs mileage-adjusted market value $${Number(mktMedian).toLocaleString()} (comps matched on make/model/year/trim, normalised to this car's km) · ${cntTxt} · ${matchTxt}`;
                marketBadge = `<span class="${gtag} ${cls}" title="${tip}">${pct}% to market${cnt != null ? ` · ${cnt}` : ''}${shaky ? ' ' : ''}</span>`;
              }
            }
            return hotColdTag + healthBadge + recallBadge + marketBadge + verdictBadge
          })()}
        </div>
        <div class="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
          <span class="truncate">${v.trim || ''} ${v.exterior_color ? '· ' + v.exterior_color : ''}</span>
          ${externalIcon}
        </div>
        <div class="flex items-center justify-between text-xs mt-auto">
          <span class="font-bold text-indigo-600 dark:text-indigo-400">${price}</span>
          ${v.stocknumber ? `<span class="font-mono text-slate-400 dark:text-slate-500">#${v.stocknumber}</span>` : ''}
          <span class="text-slate-500">${mileage}</span>
        </div>
        ${(['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role) && v.invoice_amount != null && v.price) ? (() => {
          const g = Number(v.price) - Number(v.invoice_amount);
          return `<div class="flex items-center justify-between text-[11px] -mt-0.5" title="Internal — not shown to reps, customers or your website"><span class="text-slate-400">Cost $${Number(v.invoice_amount).toLocaleString()}</span><span class="font-bold ${g >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">${g >= 0 ? '+' : '−'}$${Math.abs(g).toLocaleString()} gross</span></div>`;
        })() : ''}
        ${__vinStickerActive ? (() => {
          // Recall status + VIN/sticker/brochure actions live on the card for
          // Inventory Intelligence dealers (no separate page).
          const rc = Array.isArray(v.recalls) ? v.recalls.length : 0;
          const recallLine = rc > 0
            ? `<div class="text-[11px] font-bold text-red-600 dark:text-red-400"> ${rc} open recall${rc > 1 ? 's' : ''}</div>`
            : v.recalls_checked_at
              ? `<div class="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"> No open recalls</div>`
              : `<div class="text-[11px] text-slate-400 dark:text-slate-500">Recalls not checked yet</div>`;
          const b = 'text-[10px] font-bold px-2 py-1 rounded transition';
          const vinAttr = v.vin ? `data-vin="${v.vin}"` : '';
          const lbl = `${v.year} ${v.make} ${v.model}${v.trim ? ' ' + v.trim : ''}`.replace(/"/g, '&quot;');
          return `
            <div class="mt-1.5 pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-1.5" onclick="event.preventDefault();event.stopPropagation();">
              ${recallLine}
              ${v.vin ? `<div class="flex flex-wrap gap-1">
                <button class="inv-vin-btn ${b} bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700" data-id="${v.id}" ${vinAttr}>Decode VIN</button>
                <button class="inv-sticker-btn ${b} bg-emerald-600 hover:bg-emerald-500 text-white" data-id="${v.id}" data-label="${lbl}" data-oem-url="${v.window_sticker_oem_url || ''}" data-gen-url="${v.window_sticker_gen_url || ''}">Sticker ▾</button>
                <button class="inv-brochure-btn ${b} bg-indigo-600 hover:bg-indigo-500 text-white" data-id="${v.id}" data-label="${lbl}" data-oem-url="${v.brochure_oem_url || ''}" data-gen-url="${v.brochure_gen_url || ''}">Brochure ▾</button>
                <button type="button" onclick="event.preventDefault();event.stopPropagation();openCarfax('${v.id}','${v.vin}')" class="${b} bg-[#0a1e3f] hover:bg-[#122a52] text-white flex items-center gap-1 tracking-tight" title="Pull the Carfax report for this VIN">CARFAX<span class="text-red-500 leading-none"></span></button>
                <button type="button" onclick="event.preventDefault();event.stopPropagation();openVehicleHistory({inventory_id:'${v.id}',vin:'${esc(v.vin)}',label:'${esc(lbl)}'})" class="${b} bg-slate-600 hover:bg-slate-500 text-white" title="Carfax history & stored reports">History</button>
              </div>` : `<div class="text-[10px] text-slate-400 italic">No VIN on file — can't decode or build docs.</div>`}
            </div>`;
        })() : ''}
      </${tag}>
    `;
  }).join('');

  // One-click AI listing copy (AI Boost). Non-subscribers get the upgrade modal.
  list.querySelectorAll('.inv-aiwrite-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (__aiBoostActive) openAIEnrich(btn.dataset.id);
      else openUpgradeModal('ai_boost');
    });
  });

  // Wire the on-card Inventory-Intelligence actions (VIN decode, sticker, brochure).
  if (__vinStickerActive) {
    list.querySelectorAll('.inv-vin-btn').forEach(btn => {
      btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openVinDecode(btn.dataset.id, btn.dataset.vin); });
    });
    list.querySelectorAll('.inv-sticker-btn').forEach(btn => {
      btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); showStickerChoice(btn); });
    });
    list.querySelectorAll('.inv-brochure-btn').forEach(btn => {
      btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); showBrochureChoice(btn); });
    });
  }
}

function setupActionListeners() {
  // Profile & Settings is its own nav page now — make sure the card is relocated
  // into the profile page (in case this runs before the first switchPage).
  ensurePanelsInOriginalLocations();

  // Profile update form (full identity + workspace)
  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('profile-msg');
    // Handle avatar upload if a new file was selected
    let avatarUrl = profileContext.avatar_url || null;
    const avatarFile = document.getElementById('prof-avatar-file').files[0];
    if (avatarFile) {
      try {
        const fd = new FormData(); fd.append('avatar', avatarFile);
        const upRes = await fetch(`${API}/profile/avatar`, {
          method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd
        });
        const upData = await upRes.json().catch(() => ({}));
        if (upRes.ok) avatarUrl = upData.url;
        else {
          showMsg(`Avatar upload failed: ${upData.error || upRes.status}`, 'err');
          return;
        }
      } catch (e) {
        showMsg(`Avatar upload error: ${e.message}`, 'err');
        return;
      }
    } else if (!document.getElementById('prof-avatar-img').src && profileContext.avatar_url) {
      avatarUrl = null; // user removed it
    }

    const payload = {
      fullName: document.getElementById('prof-name').value.trim(),
      displayName: document.getElementById('prof-display-name').value.trim(),
      phone: document.getElementById('prof-phone')?.value.trim() || '',
      email: document.getElementById('prof-email').value.trim(),
      password: document.getElementById('prof-password').value,
      avatarUrl,
    };
    // Dealership identity has a stricter server-side permission than a personal
    // profile. Do not include its already-populated fields when the user only
    // changes their own name, email, phone, password, or avatar.
    const normalized = value => String(value || '').trim();
    const dealershipName = normalized(document.getElementById('prof-dealername')?.value);
    const websiteUrl = normalized(document.getElementById('prof-website')?.value);
    const savedDealershipName = normalized(profileContext?.dealership?.name);
    const savedWebsiteUrl = normalized(profileContext?.dealership?.website_url);
    if (dealershipName !== savedDealershipName) payload.dealershipName = dealershipName;
    if (websiteUrl !== savedWebsiteUrl) payload.websiteUrl = websiteUrl;
    // Strip empties so we only send fields the user actually changed
    Object.keys(payload).forEach(k => { if (!payload[k]) delete payload[k]; });
    // Keep intentionally-cleared dealership website fields: an authorized admin
    // must be able to remove an obsolete website URL.
    if (websiteUrl !== savedWebsiteUrl) payload.websiteUrl = websiteUrl;

    const showMsg = (text, kind) => {
      msg.textContent = text;
      msg.className = kind === 'ok'
        ? 'mb-3 p-2 bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-200 text-xs rounded'
        : 'mb-3 p-2 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-200 text-xs rounded';
      msg.classList.remove('hidden');
    };

    try {
      const res = await fetch(`${API}/profile/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');

      showMsg('Profile updated successfully.', 'ok');
      if (payload.fullName) document.getElementById('ui-profile-name').textContent = payload.fullName;
      if (payload.dealershipName) document.getElementById('ui-dealership-name').textContent = payload.dealershipName;
      document.getElementById('prof-password').value = '';
    } catch (err) {
      showMsg(err.message || 'Failed to update profile.', 'err');
    }
  });

  // Inventory feed add form
  document.getElementById('add-feed-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = document.getElementById('add-feed-url').value.trim();
    const type = document.getElementById('add-feed-type').value;
    if (url) addFeed(url, type);
  });

  // Manual sync trigger
  document.getElementById('sync-now-btn')?.addEventListener('click', syncNow);

  // Catalog search + pill filters
  document.getElementById('catalog-search')?.addEventListener('input', renderCatalog);

  document.getElementById('catalog-status-pills')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.catalog-status-pill');
    if (!btn) return;
    __catalogStatusFilter = btn.dataset.status;
    document.querySelectorAll('.catalog-status-pill').forEach(b => {
      const active = b.dataset.status === __catalogStatusFilter;
      b.className = active
        ? 'catalog-status-pill active px-3 py-1 rounded-full text-xs font-semibold bg-indigo-600 text-white transition'
        : 'catalog-status-pill px-3 py-1 rounded-full text-xs font-semibold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition';
    });
    renderCatalog();
  });


  document.getElementById('catalog-type-pills')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.catalog-type-pill');
    if (!btn) return;
    __catalogTypeFilter = btn.dataset.type;
    document.querySelectorAll('.catalog-type-pill').forEach(b => {
      const active = b.dataset.type === __catalogTypeFilter;
      b.className = active
        ? 'catalog-type-pill active px-3 py-1 rounded-full text-xs font-semibold bg-indigo-600 text-white transition'
        : 'catalog-type-pill px-3 py-1 rounded-full text-xs font-semibold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition';
    });
    renderCatalog();
  });

  document.getElementById('catalog-segment-pills')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.catalog-segment-pill');
    if (!btn) return;
    __catalogSegmentFilter = btn.dataset.seg;
    document.querySelectorAll('.catalog-segment-pill').forEach(b => {
      const active = b.dataset.seg === __catalogSegmentFilter;
      b.className = active
        ? 'catalog-segment-pill active px-3 py-1 rounded-full text-xs font-semibold bg-indigo-600 text-white transition'
        : 'catalog-segment-pill px-3 py-1 rounded-full text-xs font-semibold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition';
    });
    renderCatalog();
  });

  // Rep drill-down modal close
  document.getElementById('rep-detail-close')?.addEventListener('click', closeRepDetail);
  document.getElementById('rep-detail-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'rep-detail-modal') closeRepDetail();
  });

  // Team invite toggle + form
  const inviteForm = document.getElementById('invite-rep-form');
  const openInvite = (role) => {
    document.getElementById('invite-role').value = role;
    document.getElementById('invite-form-title').textContent = role === 'MANAGER' ? 'Invite a manager' : 'Invite a sales rep';
    document.getElementById('invite-submit-btn').textContent = role === 'MANAGER' ? 'Create Manager' : 'Create Rep';
    document.getElementById('invite-email').placeholder = role === 'MANAGER' ? 'manager@dealership.com' : 'rep@dealership.com';
    inviteForm.classList.remove('hidden');
    document.getElementById('invite-result').classList.add('hidden');
  };
  document.getElementById('invite-rep-btn')?.addEventListener('click', () => openInvite('SALES_REP'));
  document.getElementById('invite-manager-btn')?.addEventListener('click', () => openInvite('MANAGER'));
  document.getElementById('invite-cancel-btn')?.addEventListener('click', () => {
    inviteForm.classList.add('hidden');
  });
  inviteForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      full_name: document.getElementById('invite-name').value.trim(),
      email: document.getElementById('invite-email').value.trim(),
      password: document.getElementById('invite-password').value || undefined,
      role: document.getElementById('invite-role').value || 'SALES_REP'
    };
    try {
      const data = await inviteRep(payload);
      showInviteResult(
        data.invitation_sent
          ? `Invitation sent to <b>${data.email}</b> through MarketSync email.`
          : `Created <b>${data.email}</b>.`,
        'ok'
      );
      inviteForm.reset();
      inviteForm.classList.add('hidden');
      loadDealerManagementMatrix();
    } catch (err) {
      showInviteResult(err.message, 'err');
    }
  });

  // Launch Dedicated Stripe Gateway Session
  document.getElementById('launch-portal-btn')?.addEventListener('click', launchStripeLifecycle);

  // Global Session Exits — also wired via inline onclick="msSignOut()" so sign-out works
  // even if this listener never attaches. Optional chaining so a missing button can't
  // throw and abort the rest of setup.
  document.getElementById('logout-btn')?.addEventListener('click', (e) => { e.preventDefault(); msSignOut(); });
}

async function launchStripeLifecycle() {
  const btn = document.getElementById('launch-portal-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Connecting to billing...";
  }

  try {
    let res = await fetch(`${API}/billing/portal`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 400 || !res.ok) {
      res = await fetch(`${API}/billing/checkout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }

    const data = await res.json();
    if (data.complimentary) {
      alert("You're on a complimentary MarketSync plan — there's nothing to manage in billing. Reach out if you have questions.");
      return;
    }
    if (data.url) {
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } else {
      throw new Error(data.error || 'No billing URL returned');
    }
  } catch (err) {
    alert('Could not open billing settings. Please contact support.');
    if (btn) { btn.disabled = false; }
  } finally {
    if (btn) btn.textContent = 'Manage Billing';
  }
}
async function fetchInsights() {
  const response = await fetch(`${API}/dealership/team-insights`, {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
  });

  if (response.status === 402) {
    // Automatically redirect to upgrade page if subscription is inactive
    window.location.href = '/upgrade.html';
    return;
  }
  
  const data = await response.json();
  // ... render your data
}

// ──────────────────────────────────────────────────────────────────────────────
// SECURITY PANEL — extra login code (2FA), backup codes, passkeys, sign-in history
// ──────────────────────────────────────────────────────────────────────────────
async function initSecurityPanel() {
  await refreshMfaStatus();
  await loadPasskeys();

  document.getElementById('mfa-toggle-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('mfa-toggle-btn');
    const isOn = btn.textContent.toLowerCase().includes('off');  // "Turn Off" = currently on
    if (isOn) {
      if (!confirm("Turn off the extra login code? Your account will be easier for someone else to break into.")) return;
      btn.disabled = true; btn.textContent = 'Turning off…';
      try {
        await fetch(`${API}/auth/2fa/disable`, {
          method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
        });
        await refreshMfaStatus();
      } finally { btn.disabled = false; }
    } else {
      // A second click while the QR is visible means "cancel setup", not "start a
      // second factor". The next attempt safely clears the unfinished factor server-side.
      if (currentEnrollment) {
        currentEnrollment = null;
        document.getElementById('mfa-enroll-panel').classList.add('hidden');
        document.getElementById('mfa-enroll-error').classList.add('hidden');
        btn.disabled = false; btn.textContent = 'Turn On';
        return;
      }
      btn.disabled = true; btn.textContent = 'Loading…';
      try {
        const res = await fetch(`${API}/auth/2fa/enroll`, {
          method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not start.');
        currentEnrollment = { factor_id: data.factor_id, secret: data.secret };
        document.getElementById('mfa-enroll-panel').classList.remove('hidden');
        document.getElementById('mfa-secret-text').textContent = data.secret;
        const canvas = document.getElementById('mfa-qr-canvas');
        if (data.qr_code_uri && window.QRCode) {
          QRCode.toCanvas(canvas, data.qr_code_uri, { width: 180, margin: 1 }, (qrErr) => {
            if (qrErr) console.error('QR render failed:', qrErr);
          });
        } else if (data.qr_code_uri) {
          // QR library failed to load — keep enrollment usable via the typed code.
          const note = document.getElementById('mfa-qr-container');
          if (note) note.innerHTML = '<p class="text-xs text-slate-600 p-4">Can\'t show the picture right now — use the code below to add it by hand.</p>';
        }
        btn.textContent = 'Cancel';
      } catch (err) {
        alert(err.message);
        btn.disabled = false; btn.textContent = 'Turn On';
      }
    }
  });

  document.getElementById('mfa-enroll-verify-btn')?.addEventListener('click', async () => {
    const code = document.getElementById('mfa-enroll-code').value.trim();
    const errEl = document.getElementById('mfa-enroll-error');
    errEl.classList.add('hidden');
    if (!/^\d{6}$/.test(code)) {
      errEl.textContent = 'Type the 6 numbers from your app.';
      errEl.classList.remove('hidden'); return;
    }
    try {
      const res = await fetch(`${API}/auth/2fa/verify-enroll`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ factor_id: currentEnrollment.factor_id, code })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'That code did not work.');

      // verify-enroll promotes the Supabase session to aal2. Replace the old aal1
      // session immediately so MFA-protected settings work without a logout/login.
      if (data.access_token) {
        token = data.access_token;
        localStorage.setItem('token', data.access_token);
      }
      if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);

      document.getElementById('mfa-enroll-panel').classList.add('hidden');
      document.getElementById('mfa-enroll-code').value = '';
      await refreshMfaStatus();

      // Show the backup codes ONCE — user must copy or download them
      if (Array.isArray(data.recovery_codes) && data.recovery_codes.length) {
        showBackupCodes(data.recovery_codes);
      }
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  });

  // "Make new backup codes" button — visible once 2FA is on
  document.getElementById('regen-codes-btn')?.addEventListener('click', async () => {
    if (!confirm("Make a new set of backup codes? Your old codes will stop working right away.")) return;
    try {
      const res = await fetch(`${API}/auth/2fa/regenerate-recovery-codes`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not make new codes.');
      showBackupCodes(data.recovery_codes);
    } catch (err) { alert(err.message); }
  });

  // Add passkey button
  document.getElementById('add-passkey-btn')?.addEventListener('click', registerNewPasskey);
  document.getElementById('phone-mfa-start')?.addEventListener('click', () => {
    const panel = document.getElementById('phone-mfa-enroll');
    panel?.classList.toggle('hidden');
    const input = document.getElementById('phone-mfa-number');
    if (input && !input.value && profileContext?.phone) input.value = profileContext.phone;
  });
  document.getElementById('phone-mfa-send')?.addEventListener('click', startPhoneMfaEnrollment);
  document.getElementById('phone-mfa-confirm')?.addEventListener('click', verifyPhoneMfaEnrollment);

  // Dealership activity log — admins/owners only.
  initAuditLog();

  document.getElementById('show-sessions-btn')?.addEventListener('click', () => {
    const panel = document.getElementById('sessions-panel');
    const wasHidden = panel.classList.contains('hidden');
    panel.classList.toggle('hidden');
    if (wasHidden) loadSessions();
  });

  document.getElementById('revoke-sessions-btn')?.addEventListener('click', async () => {
    if (!confirm('Sign out all other devices? You will stay signed in here.')) return;
    try {
      const res = await fetch(`${API}/me/sessions/revoke-others`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      alert(data.message || 'Other devices signed out.');
      if (data.scope === 'all') {
        sessionStorage.setItem('ms_logged_out', '1');
        clearLocalStorage();
        window.location.href = '/login.html';
      }
    } catch (err) {
      alert('Could not revoke other sessions: ' + err.message);
    }
  });
}

let currentEnrollment = null;
let currentPhoneEnrollment = null;

async function startPhoneMfaEnrollment() {
  const phone = document.getElementById('phone-mfa-number')?.value.trim();
  const button = document.getElementById('phone-mfa-send');
  const errorBox = document.getElementById('phone-mfa-error');
  errorBox?.classList.add('hidden');
  if (!/^\+[1-9]\d{7,14}$/.test(String(phone || '').replace(/[\s()-]/g, ''))) {
    errorBox.textContent = 'Enter the country code and mobile number, for example +19055551234.';
    errorBox.classList.remove('hidden'); return;
  }
  button.disabled = true; button.textContent = 'Sending…';
  try {
    const res = await fetch(`${API}/auth/2fa/phone/enroll`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.code === 'PHONE_MFA_NOT_CONFIGURED'
      ? 'Text-message MFA is not enabled in this Supabase project yet. Enable Phone MFA and its SMS provider, then try again.'
      : (data.message || data.error || 'Could not send a verification text.'));
    currentPhoneEnrollment = { factor_id: data.factor_id, challenge_id: data.challenge_id };
    document.getElementById('phone-mfa-enroll')?.classList.add('hidden');
    document.getElementById('phone-mfa-verify')?.classList.remove('hidden');
    document.getElementById('phone-mfa-status').textContent = `Code sent to ${data.phone || 'your phone'}.`;
    document.getElementById('phone-mfa-code')?.focus();
  } catch (error) {
    errorBox.textContent = error.message; errorBox.classList.remove('hidden');
  } finally { button.disabled = false; button.textContent = 'Send verification text'; }
}

async function verifyPhoneMfaEnrollment() {
  const code = document.getElementById('phone-mfa-code')?.value.trim();
  const button = document.getElementById('phone-mfa-confirm');
  const errorBox = document.getElementById('phone-mfa-error');
  errorBox?.classList.add('hidden');
  if (!currentPhoneEnrollment || !/^\d{6,10}$/.test(code || '')) {
    errorBox.textContent = 'Enter the code sent to your phone.'; errorBox.classList.remove('hidden'); return;
  }
  button.disabled = true; button.textContent = 'Verifying…';
  try {
    const res = await fetch(`${API}/auth/2fa/phone/verify-enroll`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...currentPhoneEnrollment, code })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'That code did not work.');
    if (data.access_token) { token = data.access_token; localStorage.setItem('token', data.access_token); }
    if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
    currentPhoneEnrollment = null;
    document.getElementById('phone-mfa-verify')?.classList.add('hidden');
    document.getElementById('phone-mfa-code').value = '';
    await refreshMfaStatus();
    if (Array.isArray(data.recovery_codes) && data.recovery_codes.length) showBackupCodes(data.recovery_codes);
  } catch (error) {
    errorBox.textContent = error.message; errorBox.classList.remove('hidden');
  } finally { button.disabled = false; button.textContent = 'Verify and turn on'; }
}

async function refreshMfaStatus() {
  try {
    const res = await fetch(`${API}/auth/2fa/status`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const statusText = document.getElementById('mfa-status-text');
    const btn = document.getElementById('mfa-toggle-btn');
    const regenBtn = document.getElementById('regen-codes-btn');
    const phoneStatus = document.getElementById('phone-mfa-status');
    const phoneMethod = (data.methods || []).find(method => method.factor_type === 'phone');
    if (data.enabled) {
      const methods = (data.methods || []).map(method => method.factor_type === 'phone' ? 'text message' : 'authenticator app').join(' or ');
      statusText.innerHTML = `<span class="text-emerald-600 dark:text-emerald-400 font-semibold"> On</span> — protected by ${methods || 'a verified second factor'}.`;
      btn.textContent = 'Turn Off';
      btn.classList.remove('bg-indigo-600', 'hover:bg-indigo-500');
      btn.classList.add('bg-slate-200', 'dark:bg-slate-700', 'text-slate-900', 'dark:text-white', 'hover:bg-slate-300');
      regenBtn?.classList.remove('hidden');
    } else {
      statusText.textContent = 'Off. We strongly suggest turning this on — it stops people from getting in even if they know your password.';
      btn.textContent = 'Turn On';
      btn.classList.add('bg-indigo-600', 'hover:bg-indigo-500');
      btn.classList.remove('bg-slate-200', 'dark:bg-slate-700', 'text-slate-900', 'dark:text-white', 'hover:bg-slate-300');
      regenBtn?.classList.add('hidden');
    }
    if (phoneStatus) phoneStatus.textContent = phoneMethod
      ? ` Text-message MFA is on for ${phoneMethod.phone || 'your verified phone'}.`
      : 'Add a verified mobile number as another true MFA method.';
    btn.disabled = false;
  } catch (e) {
    document.getElementById('mfa-status-text').textContent = "Couldn't load status. Try refreshing the page.";
  }
}

// ── Backup codes (shown once after enrollment) ──────────────────────────────
function showBackupCodes(codes) {
  const panel = document.getElementById('backup-codes-panel');
  const grid = document.getElementById('backup-codes-grid');
  grid.innerHTML = codes.map(c => `<div class="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded px-2 py-1.5 text-center select-all">${c}</div>`).join('');
  panel.classList.remove('hidden');

  const userEmail = JSON.parse(localStorage.getItem('user') || '{}').email || 'me';
  const textContent = [
    'MarketSync Backup Codes',
    `For: ${userEmail}`,
    `Saved: ${new Date().toLocaleString()}`,
    '',
    'Keep these somewhere safe (password manager, printed copy in a drawer).',
    'If you lose your phone, type one of these instead of the 6-digit code.',
    'Each code works ONCE.',
    '',
    ...codes
  ].join('\n');

  document.getElementById('backup-codes-download').onclick = () => {
    const blob = new Blob([textContent], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'marketsync-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  document.getElementById('backup-codes-copy').onclick = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      const btn = document.getElementById('backup-codes-copy');
      const original = btn.textContent;
      btn.textContent = ' Copied!';
      setTimeout(() => { btn.textContent = original; }, 1500);
    } catch { alert('Copy did not work — please write them down or download the file.'); }
  };

  document.getElementById('backup-codes-done').onclick = () => {
    if (confirm("Did you save your backup codes somewhere safe? We won't show them again.")) {
      panel.classList.add('hidden');
    }
  };
}

// ── Dealership activity log (admins/owners) ─────────────────────────────────
// A plain-language view of the audit trail — who changed cost visibility, sent a
// document for signature, exported the customer book, changed a teammate's role.
const AUDIT_LABELS = {
  'user.login': ['Signed in', ''], 'user.login_failed': ['Failed sign-in', ''], 'user.logout': ['Signed out', ''],
  'user.register': ['Account created', '🆕'], 'user.password_changed': ['Password changed', ''],
  'user.mfa_enrolled': ['Turned on 2-step login', ''], 'user.mfa_disabled': ['Turned off 2-step login', ''],
  'user.passkey_registered': ['Added a passkey', ''], 'user.passkey_deleted': ['Removed a passkey', ''],
  'user.sessions_revoked': ['Signed out all devices', ''],
  'team.member_invited': ['Invited / changed a teammate', ''], 'team.member_removed': ['Removed a teammate', ''],
  'profile.updated': ['Updated their profile', ''], 'profile.avatar_uploaded': ['Changed their photo', ''],
  'config.updated': ['Changed dealership settings', ''], 'config.cost_visibility_changed': ['Changed cost visibility', ''],
  'esign.sent': ['Sent a document to e-sign', ''],
  'leads.exported': ['Exported the leads list', ''], 'inventory.exported': ['Exported inventory', ''],
  'admin.data_export': ['Exported data', ''],
  'billing.subscription_created': ['Started a subscription', ''], 'billing.subscription_cancelled': ['Cancelled a subscription', ''],
  'billing.subscription_updated': ['Updated billing', ''],
};
function auditLabel(action) { return AUDIT_LABELS[action] || [action, '•']; }

async function initAuditLog() {
  const block = document.getElementById('audit-log-block');
  if (!block) return;
  const isAdmin = ['DEALER_ADMIN', 'OWNER'].includes(profileContext?.role);
  if (!isAdmin) { block.classList.add('hidden'); return; }
  block.classList.remove('hidden');
  const btn = document.getElementById('show-audit-btn');
  const panel = document.getElementById('audit-panel');
  let loaded = false;
  btn?.addEventListener('click', () => {
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden') && !loaded) { loaded = true; loadAuditLog(); }
  });
  document.getElementById('audit-filter')?.addEventListener('change', (e) => loadAuditLog(e.target.value));
}

async function loadAuditLog(action) {
  const list = document.getElementById('audit-list');
  if (!list) return;
  list.innerHTML = 'Loading…';
  try {
    const qs = action ? `?limit=200&action=${encodeURIComponent(action)}` : '?limit=200';
    const data = await apiGetJson(`/audit-log${qs}`, { retries: 1 });
    const entries = data.entries || [];
    // Populate the filter dropdown once (from the unfiltered pull).
    if (!action) {
      const sel = document.getElementById('audit-filter');
      if (sel && sel.options.length <= 1) {
        const actions = [...new Set(entries.map(e => e.action))].sort();
        actions.forEach(a => { const o = document.createElement('option'); o.value = a; o.textContent = auditLabel(a)[0]; sel.appendChild(o); });
      }
    }
    if (!entries.length) { list.innerHTML = '<p class="text-slate-500 italic">Nothing logged yet.</p>'; return; }
    list.innerHTML = entries.map(e => {
      const [label, icon] = auditLabel(e.action);
      const when = new Date(e.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      const detail = auditMetaDetail(e);
      return `<div class="flex items-start gap-2 py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
        <span class="shrink-0">${icon}</span>
        <div class="min-w-0 flex-1">
          <div class="text-slate-800 dark:text-slate-100"><span class="font-semibold">${esc(e.actor_email || 'System')}</span> · ${esc(label)}</div>
          ${detail ? `<div class="text-slate-400">${esc(detail)}</div>` : ''}
          <div class="text-slate-400">${esc(when)}${e.ip ? ' · ' + esc(e.ip) : ''}</div>
        </div></div>`;
    }).join('');
  } catch (e) { list.innerHTML = `<p class="text-red-500">${esc(e.message || 'Could not load the activity log')}</p>`; }
}

// Turn the stored meta JSON into a short human sentence for the common actions.
function auditMetaDetail(e) {
  const m = e.meta || {};
  try {
    if (e.action === 'config.cost_visibility_changed') return `Tracking ${m.cost_tracking_enabled ? 'ON' : 'OFF'}, reps ${m.cost_rep_visible ? 'can' : 'cannot'} see cost`;
    if (e.action === 'config.updated' && Array.isArray(m.fields)) return 'Changed: ' + m.fields.join(', ');
    if (e.action === 'esign.sent') return [m.doc_title, m.signer_email].filter(Boolean).join(' → ');
    if (e.action === 'leads.exported') return `${m.count || 0} rows (${m.scope || ''})`;
    if (e.action === 'inventory.exported') return `${m.count || 0} vehicles`;
    if (e.action === 'team.member_invited') return m.new_role ? `New role: ${m.new_role}` : (m.invited_email || '');
  } catch {}
  return '';
}

// ── Passkeys (fingerprint / face / hardware key) ────────────────────────────
async function loadPasskeys() {
  const listEl = document.getElementById('passkey-list');
  if (!listEl) return;
  try {
    const res = await fetch(`${API}/auth/passkey/list`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const items = data.passkeys || [];
    if (!items.length) {
      listEl.innerHTML = '<p class="text-xs text-slate-500 italic">No passkeys yet. Tap "+ Add" to set up your first one.</p>';
      return;
    }
    listEl.innerHTML = items.map(p => {
      const when = new Date(p.created_at).toLocaleDateString();
      const lastUsed = p.last_used_at ? new Date(p.last_used_at).toLocaleDateString() : 'never';
      return `
        <div class="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5">
          <div class="min-w-0">
            <div class="text-xs font-semibold text-slate-900 dark:text-white truncate">${p.device_name || 'My passkey'}</div>
            <div class="text-sm text-slate-500">Added ${when} · Last used ${lastUsed}</div>
          </div>
          <button data-passkey-id="${p.id}" class="passkey-remove text-xs text-rose-600 dark:text-rose-400 hover:underline whitespace-nowrap">Remove</button>
        </div>
      `;
    }).join('');
    listEl.querySelectorAll('.passkey-remove').forEach(btn => {
      btn.addEventListener('click', () => removePasskey(btn.dataset.passkeyId));
    });
  } catch (err) {
    listEl.innerHTML = '<p class="text-xs text-red-500">Could not load passkeys.</p>';
  }
}

async function registerNewPasskey() {
  const errEl = document.getElementById('passkey-error');
  errEl.classList.add('hidden');

  if (!window.SimpleWebAuthnBrowser) {
    errEl.textContent = 'Passkeys are not loaded. Refresh the page and try again.';
    errEl.classList.remove('hidden'); return;
  }
  if (!window.PublicKeyCredential) {
    errEl.textContent = "Your browser doesn't support passkeys. Try a recent Chrome, Safari, or Edge.";
    errEl.classList.remove('hidden'); return;
  }

  const btn = document.getElementById('add-passkey-btn');
  btn.disabled = true; btn.textContent = 'Setting up…';

  try {
    const beginRes = await fetch(`${API}/auth/passkey/register/begin`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
    });
    const options = await beginRes.json();
    if (!beginRes.ok) throw new Error(options.error || 'Could not start.');

    // Browser prompts: Touch ID / Face ID / passkey picker
    const credential = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON: options });

    // Friendly name — derive from the device
    const deviceName = (navigator.userAgent.match(/Mac OS X/) ? 'Mac' :
                       navigator.userAgent.match(/Windows/) ? 'Windows PC' :
                       navigator.userAgent.match(/iPhone|iPad/) ? 'iPhone/iPad' :
                       navigator.userAgent.match(/Android/) ? 'Android' :
                       'My device') + ' (' + new Date().toLocaleDateString() + ')';

    const finishRes = await fetch(`${API}/auth/passkey/register/finish`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: credential, device_name: deviceName })
    });
    const data = await finishRes.json();
    if (!finishRes.ok) throw new Error(data.error || 'Could not save passkey.');

    await loadPasskeys();
    alert(' Passkey saved! Next time you sign in, you can tap "Use fingerprint or face" instead of typing a password.');
  } catch (err) {
    const msg = err.name === 'NotAllowedError' || err.name === 'AbortError'
      ? 'Cancelled.'
      : (err.message || 'Could not add passkey.');
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = '+ Add';
  }
}

// Biometric MFA step-up. Runs the Face ID / Touch ID / Windows Hello / fingerprint
// prompt against the signed-in user's own passkey to satisfy the server's MFA gate
// for this session (see /auth/passkey/stepup/*). Reusable across features that hit
// MFA_REQUIRED. Returns:
//   { ok: true }                       — step-up done; retry the blocked action
//   { ok: false, reason: 'no_passkey'} — no passkey enrolled; offer to add one
//   { ok: false, reason: 'cancelled' } — user dismissed the prompt
//   { ok: false, error }               — other failure (message is user-safe)
async function msPasskeyStepUp() {
  if (!window.SimpleWebAuthnBrowser || !window.PublicKeyCredential) {
    return { ok: false, error: "This device doesn't support passkeys — use your authenticator code instead." };
  }
  try {
    const beginRes = await fetch(`${API}/auth/passkey/stepup/begin`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
    });
    const options = await beginRes.json().catch(() => ({}));
    if (beginRes.status === 409 || options.error === 'NO_PASSKEY') {
      return { ok: false, reason: 'no_passkey', error: 'Add a passkey first (Settings → Security), then try again.' };
    }
    if (!beginRes.ok) return { ok: false, error: options.error || 'Could not start verification.' };

    const assertion = await SimpleWebAuthnBrowser.startAuthentication({ optionsJSON: options });

    const finishRes = await fetch(`${API}/auth/passkey/stepup/finish`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: assertion })
    });
    const data = await finishRes.json().catch(() => ({}));
    if (!finishRes.ok) return { ok: false, error: data.error || 'Verification failed.' };
    if (typeof showToast === 'function') showToast('Verified with your passkey', 'success');
    return { ok: true };
  } catch (err) {
    if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') return { ok: false, reason: 'cancelled', error: 'Cancelled.' };
    return { ok: false, error: err?.message || 'Verification failed.' };
  }
}
window.msPasskeyStepUp = msPasskeyStepUp;

async function removePasskey(passkeyId) {
  if (!confirm("Remove this passkey? You won't be able to sign in with it anymore.")) return;
  try {
    const res = await fetch(`${API}/auth/passkey/${passkeyId}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Could not remove.');
    await loadPasskeys();
  } catch (err) { alert(err.message); }
}

async function loadSessions() {
  const list = document.getElementById('sessions-list');
  list.innerHTML = '<span class="text-slate-500 italic">Loading…</span>';
  try {
    const res = await fetch(`${API}/me/sessions`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const events = data.events || [];
    if (!events.length) { list.innerHTML = '<span class="text-slate-500 italic">No sign-in history yet.</span>'; return; }
    list.innerHTML = events.map((e, idx) => {
      const friendlyTime = friendlyAgo(new Date(e.timestamp));
      return `
      <div class="flex items-start justify-between gap-2 py-1 border-b border-slate-200 dark:border-slate-800 last:border-0">
        <div class="min-w-0">
          <div class="text-slate-900 dark:text-white truncate">${e.browser} on ${e.os}${idx === 0 ? ' <span class="text-emerald-600 font-semibold">· this device</span>' : ''}</div>
          <div class="text-slate-500">${friendlyTime}${e.ip ? ' · ' + e.ip : ''}</div>
        </div>
      </div>
    `;
    }).join('');
  } catch (err) {
    list.innerHTML = '<span class="text-red-500">Could not load sign-in history.</span>';
  }
}