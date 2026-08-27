// Uses shared engine primitives: engKpi, engCard, engEmpty
// Connected Intelligence mounted in Pulse: engMountPage(body, 'inv-intel')
// Reuses salesAttentionRow pattern for attention queue

// Scored Merchandising definition and view
function invRenderMerch(d, held, blocked, thin, ready, pct) {
  const list = (d?.vehicles || []).filter(v => !v.awaiting_possession);
  return `
    <div class="space-y-2 text-left">
      <!-- Frontline Progress Bar -->
      <div>
        <div class="flex items-center justify-between text-xs mb-1">
          <span class="font-bold text-slate-700 dark:text-slate-300">Frontline ready</span>
          <span class="font-black text-emerald-600 dark:text-emerald-400">${(ready || []).length}/${(held || []).length} (${pct ? pct((ready || []).length) : 0}%)</span>
        </div>
        <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden flex">
          <div class="bg-emerald-500 h-full transition-all" style="width:${pct ? pct((ready || []).length) : 0}%"></div>
          <div class="bg-amber-400 h-full transition-all" style="width:${pct ? pct((thin || []).length) : 0}%"></div>
          <div class="bg-rose-500 h-full transition-all" style="width:${pct ? pct((blocked || []).length) : 0}%"></div>
        </div>
      </div>
      <!-- Gaps List -->
      <div class="space-y-1 pt-1">
        ${(blocked || []).slice(0, 4).map(s => invRow(s.v, d, `<span class="text-rose-500 font-bold">${s.gaps.map(g => g.gap).join(' · ')}</span>`)).join('')}
        ${!(blocked || []).length ? '<div class="py-4 text-center text-xs text-slate-400 italic">All units meet merchandising standards.</div>' : ''}
      </div>
    </div>
  `;
}

// Acquisition pipeline view
function invRenderAcquisition(d, appraisals, awaitingVehicles, nonTrade, tradeAwaiting, held) {
  const awaiting = awaitingVehicles || [];
  nonTrade = awaiting.filter(invCanTakePossession);
  tradeAwaiting = awaiting.filter(v => v.source_appraisal_id);
  return `
    <div class="space-y-3 text-left">
      <div>
        <div class="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">1 · Appraised (${(appraisals || []).length})</div>
        ${(appraisals || []).slice(0, 3).map(a => `
          <div class="ms-list-row w-full flex items-center justify-between gap-3 text-left">
            <div onclick="switchPage('appraisal')" class="min-w-0 flex-1 text-left cursor-pointer">
              <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(a.customer?.name || a.vehicle_desc || 'Appraisal')}</div>
              <div class="text-[11px] text-slate-500 mt-0.5">${esc([a.year, a.make, a.model].filter(Boolean).join(' ') || 'Pending')} · ${a.offer_amount ? '$' + Number(a.offer_amount).toLocaleString() : 'In review'}</div>
            </div>
            <button type="button" onclick="switchPage('appraisal')" class="ms-btn ms-btn--secondary shrink-0 inline-flex items-center justify-center !min-h-0 !py-1 !px-2.5 !text-[11px]">Open Appraisal</button>
          </div>
        `).join('') || '<div class="text-xs text-slate-400 italic py-1">No pending appraisals.</div>'}
      </div>
      <div>
        <div class="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">2 · Awaiting possession — purchased (${nonTrade.length})</div>
        ${nonTrade.slice(0, 3).map(v => invRow(v, d, '<span class="text-amber-600 font-bold">Purchased — take possession</span>')).join('') || '<div class="text-xs text-slate-400 italic py-1">No purchased units awaiting intake.</div>'}
      </div>
      <div>
        <div class="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">2 · Awaiting possession — customer trade (${tradeAwaiting.length})</div>
        ${tradeAwaiting.slice(0, 3).map(v => invRow(v, d, '<span class="text-blue-600 font-bold">Trade from deal — intake via Appraisal</span>')).join('') || '<div class="text-xs text-slate-400 italic py-1">No trade units awaiting deal close.</div>'}
      </div>
      <div>
        <div class="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">3 · In your possession (${(held || []).length})</div>
        ${(held || []).slice(0, 3).map(v => invRow(v, d)).join('') || '<div class="text-xs text-slate-400 italic py-1">No vehicles in inventory.</div>'}
      </div>
    </div>
  `;
}
//
// Inventory's slice of the vehicle lifecycle:  Acquire → Received → Priced → Published → Sold
// (Reconditioning between Received and Priced is the Cleanup department's workspace.)
//
// Reads only endpoints that already exist:
//   /inventory        vehicles (status, price, image_urls, description, created_at,
//                     awaiting_possession, source_appraisal_id, stocknumber,
//                     window_sticker_*, sales_pitch, invoice_amount, source_url)
//   /ai/appraisals    appraisal queue                  (Acquisition view, lazy)
//
// HANDOFF: `inventory.source_appraisal_id` is the Sales trade/appraisal this
// vehicle came from — the SAME appraisal record, never a copy. Surfacing it here
// is what makes Sales → Inventory continuous.

const INV_AGED_DAYS = 60;
const INV_STRONG_PHOTOS = 6;      // below this a unit is listable but not competitive
const INV_RECENT_DAYS = 30;       // "recently acquired" window on the Acquisition view

const invName = (v) => [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ') || v.stocknumber || 'Vehicle';
const invDays = (iso) => { if (!iso) return null; const d = (Date.now() - new Date(iso).getTime()) / 864e5; return Number.isFinite(d) ? Math.floor(d) : null; };
const invPhotoCount = (v) => Array.isArray(v.image_urls) ? v.image_urls.length : (v.image_urls ? 1 : 0);
const invHasPhotos = (v) => invPhotoCount(v) > 0;
const invHasSticker = (v) => !!(v.window_sticker_url || v.window_sticker_oem_url || v.window_sticker_gen_url);

// ── Acquisition channel ──────────────────────────────────────────────────────
// Derived from what the vehicle already records, never stored a second time:
// a trade carries the Sales appraisal it came from, a feed unit carries the
// source URL it was synced from, everything else was bought.
const INV_ACQ_LABEL = { trade: 'Customer trade', feed: 'Feed / sync', purchased: 'Purchased' };
function invAcqChannel(v) { return v.source_appraisal_id ? 'trade' : (v.source_url ? 'feed' : 'purchased'); }

// ── Merchandising readiness ──────────────────────────────────────────────────
// The five things that decide whether a unit can go to market, each read straight
// off the canonical vehicle record. Inventory owns this definition; the Vehicle
// Record workspace renders the same checks so the two can never disagree.
function invMerchChecks(v) {
  const n = invPhotoCount(v);
  return [
    { key: 'photos', ok: n > 0, strong: n >= INV_STRONG_PHOTOS,
      label: n ? `${n} photo${n === 1 ? '' : 's'}` : 'No photos',
      gap: n ? `Only ${n} photo${n === 1 ? '' : 's'} — ${INV_STRONG_PHOTOS}+ sell faster` : 'No photos — cannot merchandise' },
    { key: 'price', ok: !!Number(v.price), label: 'Price', gap: 'No price set' },
    { key: 'description', ok: !!String(v.description || '').trim(), label: 'Description', gap: 'No description' },
    { key: 'sticker', ok: invHasSticker(v), label: 'Window sticker', gap: 'No window sticker' },
    { key: 'pitch', ok: !!String(v.sales_pitch || '').trim(), label: 'AI sales copy', gap: 'No AI sales copy' },
  ];
}
// A unit is frontline-ready when nothing blocks it; thin photo sets are a warning,
// not a blocker, so they are reported separately.
function invMerchGaps(v) { return invMerchChecks(v).filter(c => !c.ok); }
function invMerchThin(v) { const p = invMerchChecks(v)[0]; return p.ok && !p.strong; }

let __invData = null;
let __invAppraisals = null;   // lazily fetched inside the Acquire view

// What should happen to this vehicle next — derived from existing state only.
// Reconditioning is the Cleanup department's concern (see the `cleanup` workspace),
// so Inventory never surfaces recon here. Anything that isn't another engine's job
// opens the Vehicle Record, which is the one place a unit is worked from.
function invNextAction(v, d) {
  if (invCanTakePossession(v)) return { label: 'Take Possession', reason: 'Awaiting possession', tone: 'amber', onclick: `invTakePossession('${v.id}')` };
  if (v.awaiting_possession) return { label: 'Open Appraisal', reason: 'Trade awaiting possession', tone: 'amber', onclick: `switchPage('appraisal')` };
  if (!invHasPhotos(v)) return { label: 'Add photos', reason: 'No photos — cannot merchandise', tone: 'rose', onclick: `vehicleOpen('${v.id}')` };
  if (!Number(v.price)) return { label: 'Set price', reason: 'No price set', tone: 'rose', onclick: `vehicleOpen('${v.id}')` };
  if (invMerchGaps(v).length) return { label: 'Merchandise', reason: invMerchGaps(v)[0].gap, tone: 'amber', onclick: `vehicleOpen('${v.id}')` };
  const age = invDays(v.created_at);
  if (age != null && age >= INV_AGED_DAYS) return { label: 'Review pricing', reason: `Aged ${age} days`, tone: 'amber', onclick: `openInventoryIntelligence()` };
  return { label: 'Open Vehicle', reason: 'Frontline ready', tone: 'slate', onclick: `vehicleOpen('${v.id}')` };
}

function invAttention(d) {
  const items = [];
  for (const v of d.vehicles || []) {
    const age = invDays(v.created_at);
    let sev = null, why = null;
    // Reconditioning status is owned by the Cleanup department, not surfaced here.
    if (v.awaiting_possession) { sev = 1; why = 'Awaiting possession'; }
    else if (!invHasPhotos(v)) { sev = 2; why = 'No photos — cannot merchandise'; }
    else if (!Number(v.price)) { sev = 3; why = 'No price set'; }
    else if (invMerchGaps(v).length) { sev = 5; why = invMerchGaps(v).map(c => c.gap).join(' · '); }
    else if (age != null && age >= INV_AGED_DAYS) { sev = 6; why = `Aged ${age} days — review pricing`; }
    if (sev == null) continue;
    items.push({
      sev, id: v.id, who: invName(v), why,
      age: age != null ? `${age}d` : '',
      // The Sales handoff, made visible.
      sub: v.source_appraisal_id ? 'from Sales appraisal' : (v.stocknumber ? `#${v.stocknumber}` : ''),
      action: invNextAction(v, d),
    });
  }
  items.sort((a, b) => a.sev - b.sev);
  const seen = new Set(); const out = [];
  for (const it of items) { if (seen.has(it.id)) continue; seen.add(it.id); out.push(it); }
  return out.slice(0, 25);
}

// Every vehicle row is a door into the Vehicle Record — one unit, one surface.
function invRow(v, d, sub) {
  const na = invNextAction(v, d);
  const age = invDays(v.created_at);
  const detail = sub != null ? sub
    : `${Number(v.price) ? '$' + Number(v.price).toLocaleString() : '<span class="text-rose-500 font-bold">no price</span>'}${age != null ? ` · ${age}d` : ''}${v.source_appraisal_id ? ' · <span class="text-blue-600 dark:text-blue-400">from Sales appraisal</span>' : ''}`;
  return `<div class="ms-list-row w-full flex items-center justify-between gap-3 text-left">
    <button type="button" onclick="vehicleOpen('${v.id}')" class="min-w-0 flex-1 text-left">
      <div class="font-bold text-[13px] sm:text-[14px] text-slate-900 dark:text-white truncate text-left">${esc(invName(v))}</div>
      <div class="text-[11px] sm:text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 truncate text-left">${v.stocknumber ? `#${esc(v.stocknumber)} · ` : ''}${detail}</div>
    </button>
    ${na.onclick ? `<button type="button" onclick="${na.onclick}" class="ms-btn ms-btn--secondary shrink-0 inline-flex items-center justify-center whitespace-nowrap !min-h-0 !py-1.5 !px-3.5 !text-[12px]">${esc(na.label)}</button>` : ''}
  </div>`;
}

// ── Non-trade Take Possession (canonical, Stage 3A) ──────────────────────────
// Calls POST /inventory/:id/take-possession — the ONLY producer of
// `vehicle.acquired`. The UI never marks a vehicle acquired locally: it posts the
// transition and refetches server truth.
//
// Trade units are excluded server-side (they carry source_appraisal_id and belong to
// `trade.received` via the appraisal path). We also hide the action for them so the
// user is never offered a call that will 409 — but the server remains authoritative,
// and a 409 TRADE_UNIT is surfaced honestly rather than worked around.
function invCanTakePossession(v) { return !!v.awaiting_possession && !v.source_appraisal_id; }

async function invTakePossession(id) {
  try {
    const r = await apiSendJson(`/inventory/${id}/take-possession`, 'POST', {});
    showToast(r.acquired ? 'Possession recorded — Accounting notified' : 'Already in your possession', 'success');
  } catch (e) {
    // 409 TRADE_UNIT: the unit came from a trade appraisal and must go through that
    // path so it records a trade receipt instead of a generic acquisition.
    const msg = /TRADE_UNIT/.test(e.message || '')
      ? 'This unit came from a trade appraisal — take possession from the appraisal.'
      : (e.message || 'Could not record possession');
    showToast(msg, 'error');
    return false;
  }
  __invAppraisals = null;
  ENGINE_DATA['inventory-overview'] = undefined;
  engineTab('inventory-overview', 'work', true);
  return true;      // callers (e.g. the Vehicle Record) refetch on success only
}
window.invTakePossession = invTakePossession;

// Work follows the vehicle lifecycle in order: what we have → what's coming in →
// what's being fixed → what's ready to sell → what it's worth → where it's listed.
async function invRenderWork(body, d) {
  body.innerHTML = `
    ${engSection('Vehicles', '', 'Every unit in stock — add one, edit one, publish one')}`;

  if (typeof engMountPage === 'function') {
    engMountPage(body, 'inventory', () => {
      if (typeof loadInventoryCatalog === 'function') loadInventoryCatalog();
    });
  }
}

ENGINES['inventory-overview'] = {
  rootId: 'inventory-overview-root', title: 'Inventory Department', subtitle: 'Acquire, merchandise, price and publish every unit in stock',
  icon: 'gem', accent: 'sky',
  // Right-rail Reports, specific to Inventory (the Reports overview carries inventory
  // mix & aging; appraisals covers acquisition).
  reports: [
    { label: 'Inventory mix & aging', icon: 'chart', onclick: "openDeptReport('overview')" },
    { label: 'Appraisals', icon: 'car', onclick: "openDeptReport('appraisals')" },
  ],
  tabLabels: { overview: 'Pulse', work: 'Inventory' },
  get tabOrder() { return ['work', 'overview']; },

  fetch: async () => {
    // Inventory reads inventory only. Reconditioning data belongs to the Cleanup
    // department and is fetched by that workspace, never here.
    const inv = await apiGetJson('/inventory').catch(() => ({ inventory: [], vehicles: [] }));
    const d = {
      vehicles: inv.inventory || inv.vehicles || inv.items || [],
    };
    d.vehById = {}; for (const v of d.vehicles) d.vehById[v.id] = v;
    __invData = d;
    return d;
  },

  quickActions: [
    { label: 'Inventory Training (Academy)', icon: 'sparkles', onclick: "openMarketSyncAcademy('inventory')" },
    { label: '+ Add inventory', icon: 'gem', onclick: "engineTab('inventory-overview','work')" },
    { label: 'Inventory Intelligence', icon: 'chart', onclick: "engineTab('inventory-overview','overview')" },
    { label: 'Market & Competitors', icon: 'globe', onclick: "engineTab('inventory-overview','overview')" },
  ],
  nextActions: (d) => invAttention(d || {}).slice(0, 5).map(it => ({
    label: `${it.who} — ${it.action?.label || 'Open'}`, icon: 'flame',
    tone: SALES_TONE[it.action?.tone] || SALES_TONE.slate, onclick: it.action?.onclick || '',
  })),

  tabs: {
    async overview(body, d) {
      if (!__invAppraisals) {
        try { __invAppraisals = await apiGetJson('/ai/appraisals'); } catch { __invAppraisals = { appraisals: [] }; }
      }
      const att = invAttention(d);
      const veh = d.vehicles || [];
      const held = veh.filter(v => !v.awaiting_possession);
      const notReady = held.filter(v => invMerchGaps(v).length);
      const awaiting = veh.filter(v => v.awaiting_possession).length;
      const agedCount = veh.filter(v => (v.age_days || 0) > 60 || (invDays(v.created_at) || 0) >= 60).length;
      const missingPhotos = veh.filter(v => !v.photo_urls || !v.photo_urls.length).length;
      const noPrice = veh.filter(v => !Number(v.price));
      const appraisals = (__invAppraisals && __invAppraisals.appraisals) || [];
      const recent = veh.filter(v => !v.awaiting_possession && (invDays(v.created_at) ?? 1e9) <= INV_RECENT_DAYS);

      // Scored merchandising
      const scored = held.map(v => ({ v, gaps: invMerchGaps(v), thin: invMerchThin(v) }));
      const blocked = scored.filter(s => s.gaps.length).sort((a, b) => b.gaps.length - a.gaps.length);
      const thin = scored.filter(s => !s.gaps.length && s.thin);
      const ready = scored.filter(s => !s.gaps.length && !s.thin);
      const pct = (n) => scored.length ? Math.round((n / scored.length) * 100) : 0;

      const awaitingVehicles = veh.filter(v => v.awaiting_possession);
      const nonTrade = awaitingVehicles.filter(invCanTakePossession);
      const tradeAwaiting = awaitingVehicles.filter(v => v.source_appraisal_id);
      const agedVehicles = veh.filter(v => (v.age_days || 0) >= INV_AGED_DAYS || (invDays(v.created_at) || 0) >= INV_AGED_DAYS);

      const proactiveAiPanel = `
        <div class="p-3.5 rounded-xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 ms-ai-panel text-white shadow-lg border border-slate-800 text-left space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-black uppercase tracking-wider text-sky-400">Live Inventory Automation</span>
            <span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-sky-500/20 text-sky-300 border border-sky-500/30">Active</span>
          </div>
          <div class="text-[12px] text-slate-300 space-y-1 leading-relaxed">
            <p>• <strong>Aged Inventory:</strong> ${agedCount ? `<span class="text-rose-400 font-bold">${agedCount} unit(s) in stock over 60 days</span> requiring pricing adjustments.` : 'All inventory within healthy age thresholds.'}</p>
            <p>• <strong>Merchandising:</strong> ${missingPhotos} vehicle(s) missing photos or description copy.</p>
            <p>• <strong>Acquisition:</strong> ${awaiting} vehicle(s) awaiting intake check-in.</p>
          </div>
          <div class="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
            <button type="button" onclick="engineTab('inventory-overview','work')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 transition">Review Inventory</button>
            <button type="button" onclick="switchPage('appraisal')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition">Appraise Trades</button>
          </div>
        </div>
      `;

      // Price calculations for live intelligence
      const prices = veh.map(v => Number(v.price || v.list_price || 0)).filter(p => p > 0);
      const minPrice = prices.length ? Math.min(...prices) : 0;
      const maxPrice = prices.length ? Math.max(...prices) : 0;
      const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
      const newCount = veh.filter(v => (v.condition || '').toLowerCase() === 'new' || (v.type || '').toLowerCase() === 'new').length;
      const usedCount = veh.length - newCount;

      // 1. Inventory Intelligence Hero Card
      const intelCard = pulseCard({
        title: 'Inventory Intelligence',
        tier: 'hero',
        inner: `
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-left">
            <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-2.5 text-left">
              <div class="text-[10px] font-black uppercase tracking-wider text-slate-500">Vehicles on lot</div>
              <div class="text-lg font-black text-slate-900 dark:text-white mt-0.5" id="lot-ov-count">${veh.length}</div>
            </div>
            <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-2.5 text-left">
              <div class="text-[10px] font-black uppercase tracking-wider text-slate-500">Aged 60+</div>
              <div class="text-lg font-black ${agedCount ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'} mt-0.5">${agedCount}</div>
            </div>
            <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-2.5 text-left">
              <div class="text-[10px] font-black uppercase tracking-wider text-slate-500">Merch gaps</div>
              <div class="text-lg font-black ${notReady.length ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'} mt-0.5">${notReady.length}</div>
            </div>
            <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-2.5 text-left">
              <div class="text-[10px] font-black uppercase tracking-wider text-slate-500">Awaiting</div>
              <div class="text-lg font-black ${awaiting ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-white'} mt-0.5">${awaiting}</div>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-left">
            <div class="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-2 text-left">
              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Price Range</div>
              <div class="text-xs font-black text-slate-900 dark:text-white mt-0.5" id="lot-ov-range">${prices.length ? `$${minPrice.toLocaleString()} - $${maxPrice.toLocaleString()}` : '—'}</div>
            </div>
            <div class="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-2 text-left">
              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Average Price</div>
              <div class="text-xs font-black text-slate-900 dark:text-white mt-0.5" id="lot-ov-avg">${avgPrice ? `$${avgPrice.toLocaleString()}` : '—'}</div>
            </div>
            <div class="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-2 text-left">
              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">New / Used</div>
              <div class="text-xs font-black text-slate-900 dark:text-white mt-0.5" id="lot-ov-split">${newCount} new · ${usedCount} used</div>
            </div>
            <div class="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-2 text-left">
              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Turn Rate (90d)</div>
              <div class="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-0.5">${recent.length ? `${recent.length} in 30d` : 'Healthy'}</div>
            </div>
          </div>

          <div class="pt-2 border-t border-slate-200/70 dark:border-slate-800/70 space-y-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2 flex-wrap">
                <button type="button" id="ai-sync-all-btn" onclick="if(typeof syncAllInventoryClick==='function')syncAllInventoryClick();" class="ms-btn ms-btn--primary inline-flex items-center gap-1.5 !min-h-0 !py-1.5 !px-3.5 !text-[12px]">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                  Scan All Inventory
                </button>
                <button type="button" id="ai-lot-report-btn" onclick="if(typeof openLotReport==='function')openLotReport();" class="ms-btn ms-btn--secondary inline-flex items-center gap-1.5 !min-h-0 !py-1.5 !px-3 !text-[12px]">
                  <svg class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17V9m4 8V5m4 12v-4M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                  Lot Average Report
                </button>
                <button type="button" id="ai-activity-refresh" onclick="if(typeof loadAIActivity==='function')loadAIActivity();" class="ms-btn ms-btn--secondary inline-flex items-center gap-1 !min-h-0 !py-1.5 !px-2.5 !text-[12px]" title="Refresh Log">
                  <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>
                </button>
              </div>
              <div id="inv-scan-usage" class="text-[11px] text-slate-400"></div>
            </div>

            <!-- Sync Status / Progress -->
            <div id="ai-sync-status" class="hidden space-y-1.5 pt-1">
              <div class="flex items-center justify-between text-xs">
                <span id="ai-sync-status-text" class="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5 animate-spin inline" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  Scanning…
                </span>
                <span id="ai-sync-progress-label" class="text-slate-500 font-mono text-[11px]"></span>
              </div>
              <div class="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div id="ai-sync-progress-bar" class="h-full bg-blue-600 rounded-full transition-all duration-300" style="width:0%"></div>
              </div>
            </div>
          </div>
        `
      });

      // 2. AI Lot Analysis & Movers Hero Card
      const lotAnalysisCard = pulseCard({
        title: 'AI Lot Analysis & Movers',
        tier: 'hero',
        headerAction: `<div class="flex items-center gap-2">
          <button type="button" id="inv-intel-refresh-btn" onclick="if(typeof _loadIntel==='function')_loadIntel(true);" class="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>
            Refresh Readout
          </button>
          <span class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">AI Intelligence</span>
        </div>`,
        inner: `
          <!-- Loading state -->
          <div id="inv-intel-loading" class="hidden flex items-center justify-center py-6 gap-2 text-slate-400 text-xs">
            <svg class="animate-spin w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
            <span>Analyzing your inventory…</span>
          </div>

          <!-- Duplicate VINs Warning Alert -->
          <div id="inv-intel-dups-wrap" class="hidden bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl p-3.5 text-rose-900 dark:text-rose-200 mb-2">
            <div class="flex items-center gap-1.5 font-bold text-xs text-rose-700 dark:text-rose-300 mb-1">
              <svg class="w-4 h-4 text-rose-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
              Duplicate VINs Detected On Lot
            </div>
            <div id="inv-intel-dups" class="space-y-1.5 text-xs"></div>
          </div>

          <!-- AI Narrative Box -->
          <div id="inv-intel-narrative" class="hidden bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-xl p-3.5 mb-3 text-left">
            <div class="text-[11px] font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>
              AI Lot Narrative Insights
            </div>
            <ul id="inv-intel-narrative-list" class="space-y-1.5 text-xs text-slate-700 dark:text-slate-300"></ul>
          </div>

          <!-- 4 Stats Summary Row -->
          <div id="inv-intel-stats" class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-left"></div>

          <!-- Hot / Cold Split -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            <!-- Top 5 Hot -->
            <div class="rounded-xl border border-emerald-200/70 dark:border-emerald-800/40 bg-emerald-50/20 dark:bg-emerald-950/10 p-3 text-left">
              <div class="flex items-center justify-between gap-1.5 mb-2 pb-1.5 border-b border-emerald-100 dark:border-emerald-900/30">
                <div class="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                  <svg class="w-3.5 h-3.5 text-orange-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"/></svg>
                  Top 5 Hot Movers
                </div>
                <span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Fast Turn</span>
              </div>
              <div id="inv-intel-hot" class="space-y-1.5 text-xs text-slate-500">—</div>
            </div>

            <!-- Top 5 Cold -->
            <div class="rounded-xl border border-rose-200/70 dark:border-rose-800/40 bg-rose-50/20 dark:bg-rose-950/10 p-3 text-left">
              <div class="flex items-center justify-between gap-1.5 mb-2 pb-1.5 border-b border-rose-100 dark:border-rose-900/30">
                <div class="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                  <svg class="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18m9-9H3m15.364 6.364l-12.728-12.728m12.728 0L5.636 18.364"/></svg>
                  Top 5 Cold Movers
                </div>
                <span class="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Slow Moving</span>
              </div>
              <div id="inv-intel-cold" class="space-y-1.5 text-xs text-slate-500">—</div>
            </div>
          </div>
        `
      });

      // 3. Needs Attention Card
      const attentionCard = pulseCard({
        title: 'Needs attention',
        count: att.length,
        tier: 'feature',
        tone: att.length ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300' : '',
        inner: att.length ? att.slice(0, 8).map(salesAttentionRow).join('') : '',
        empty: 'Every vehicle is frontline ready.'
      });

      // 4. Pricing & Age Alignment (Velocity & Turn Rate 90d) Card
      const turnRateCard = pulseCard({
        title: 'Pricing & Age Alignment',
        tier: 'feature',
        headerAction: `<span class="text-[10px] font-bold text-slate-400">Last 90 days</span>`,
        inner: `
          <div class="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white/40 dark:bg-slate-900/40">
            <div style="-webkit-overflow-scrolling:touch;max-height:300px;overflow-x:auto;overflow-y:auto">
              <table class="min-w-full text-xs">
                <thead class="bg-slate-50/80 dark:bg-slate-900/80 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th class="text-left px-3 py-2 font-bold text-slate-500 uppercase tracking-wider">Vehicle</th>
                    <th class="text-right px-2 py-2 font-bold text-slate-500 uppercase tracking-wider">30d</th>
                    <th class="text-right px-2 py-2 font-bold text-slate-500 uppercase tracking-wider">90d</th>
                    <th class="text-right px-2 py-2 font-bold text-slate-500 uppercase tracking-wider">Stock</th>
                    <th class="text-right px-3 py-2 font-bold text-slate-500 uppercase tracking-wider">Mo. Supply</th>
                  </tr>
                </thead>
                <tbody id="inv-intel-velocity-body" class="divide-y divide-slate-100 dark:divide-slate-800/60">
                  <tr><td colspan="5" class="py-6 text-center text-xs text-slate-400 italic">Loading sell-through velocity…</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        `
      });

      // 5. Vehicle Health Scores Card
      const healthScoreCard = pulseCard({
        title: 'Vehicle Health Scores',
        tier: 'feature',
        headerAction: `<button type="button" id="health-score-photos-btn" onclick="if(typeof scorePhotosClick==='function')scorePhotosClick(this);" class="ms-btn ms-btn--secondary shrink-0 inline-flex items-center gap-1 !min-h-0 !py-1 !px-2.5 !text-[11px]">
          <svg class="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"/><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"/></svg>
          Score Photos
        </button>`,
        inner: `
          <div class="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white/40 dark:bg-slate-900/40">
            <div style="max-height:300px;overflow-x:auto;overflow-y:auto">
              <table class="w-full text-xs">
                <thead class="bg-slate-50/80 dark:bg-slate-900/80 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th class="text-left px-3 py-2 font-bold text-slate-500 uppercase tracking-wider">Unit</th>
                    <th class="text-center px-2 py-2 font-bold text-slate-500 uppercase tracking-wider">Score</th>
                    <th class="text-center px-2 py-2 font-bold text-slate-500 uppercase tracking-wider">Photos</th>
                    <th class="text-center px-2 py-2 font-bold text-slate-500 uppercase tracking-wider">Days</th>
                    <th class="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody id="inv-intel-health-body" class="divide-y divide-slate-100 dark:divide-slate-800/60">
                  <tr><td colspan="5" class="py-6 text-center text-xs text-slate-400 italic">Loading vehicle health scores…</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        `
      });

      // 6. Inventory Scan Results & Flags
      const scanActivityCard = pulseCard({
        title: 'Inventory Scan Results',
        tier: 'feature',
        headerAction: `<span id="ai-activity-count" class="text-[10px] font-bold text-slate-400"></span>`,
        inner: `
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2.5">
            <button type="button" data-ai-filter="all" onclick="if(typeof setAiActivityFilter==='function')setAiActivityFilter('all');" class="ai-stat-card text-left bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg p-2 transition hover:border-blue-400">
              <div class="text-[9px] uppercase font-bold tracking-wider text-slate-400">Total</div>
              <div class="text-sm font-black text-slate-900 dark:text-white" id="ai-stat-total">—</div>
            </button>
            <button type="button" data-ai-filter="price" onclick="if(typeof setAiActivityFilter==='function')setAiActivityFilter('price');" class="ai-stat-card text-left bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg p-2 transition hover:border-red-400">
              <div class="text-[9px] uppercase font-bold tracking-wider text-red-500">Price Flags</div>
              <div class="text-sm font-black text-red-500" id="ai-stat-price-flags">—</div>
            </button>
            <button type="button" data-ai-filter="missing" onclick="if(typeof setAiActivityFilter==='function')setAiActivityFilter('missing');" class="ai-stat-card text-left bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg p-2 transition hover:border-amber-400">
              <div class="text-[9px] uppercase font-bold tracking-wider text-amber-500">Missing Info</div>
              <div class="text-sm font-black text-amber-500" id="ai-stat-warnings">—</div>
            </button>
            <button type="button" data-ai-filter="copies" onclick="if(typeof setAiActivityFilter==='function')setAiActivityFilter('copies');" class="ai-stat-card text-left bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg p-2 transition hover:border-emerald-400">
              <div class="text-[9px] uppercase font-bold tracking-wider text-emerald-500">Copy Written</div>
              <div class="text-sm font-black text-emerald-500" id="ai-stat-copies">—</div>
            </button>
          </div>

          <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 overflow-hidden">
            <div class="max-h-[260px] overflow-y-auto">
              <div id="ai-activity-loading" class="py-8 text-center text-xs text-slate-400 italic">Loading scan activity…</div>
              <div id="ai-activity-empty" class="hidden py-8 text-center text-xs text-slate-400 px-4">No scan activity yet — click <strong>Scan All Inventory</strong> above.</div>
              <div id="ai-activity-error" class="hidden py-4 px-4 text-xs text-red-500"></div>
              <ul id="ai-activity-list" class="hidden divide-y divide-slate-100 dark:divide-slate-800"></ul>
            </div>
          </div>
        `
      });

      // 7. Merchandising Readiness Card
      const merchCard = pulseCard({
        title: 'Merchandising Readiness',
        count: notReady.length,
        tier: 'feature',
        inner: `
          <div class="mb-3 space-y-2 text-left">
            ${scored.length ? engBar([
              { pct: pct(ready.length), cls: 'bg-emerald-500', label: `Ready (${ready.length})` },
              { pct: pct(thin.length), cls: 'bg-amber-500', label: `Thin (${thin.length})` },
              { pct: pct(blocked.length), cls: 'bg-rose-500', label: `Blocked (${blocked.length})` },
            ]) : ''}
          </div>
          <div class="space-y-1 text-left">
            ${(blocked.length ? blocked.slice(0, 5).map(s => invRow(s.v, d, `<span class="text-rose-500 font-bold">${esc(s.gaps.map(g => g.gap).join(' · '))}</span>`)).join('') : '')
              + (thin.length ? thin.slice(0, 3).map(s => invRow(s.v, d, `<span class="text-amber-600 dark:text-amber-400 font-bold">${esc(invMerchChecks(s.v)[0]?.gap || 'Thin photos')}</span>`)).join('') : '')}
          </div>
        `,
        empty: 'Every vehicle is fully merchandised.'
      });

      // 8. Automated Repricing Watchdog Card
      const repricingCard = pulseCard({
        title: 'Automated Repricing Watchdog',
        tier: 'compact',
        inner: `
          <div class="space-y-3 text-left">
            <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/70 dark:border-slate-800/70">
              <div class="text-xs font-semibold text-slate-700 dark:text-slate-200">Enable Repricing Watchdog Alerts</div>
              <label class="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input type="checkbox" id="repricing-enabled" class="sr-only peer">
                <div class="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label class="block text-[10px] uppercase font-bold text-slate-400 mb-1">Days on Lot</label>
                <input type="number" id="repricing-days" min="1" max="365" value="45" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white">
              </div>
              <div>
                <label class="block text-[10px] uppercase font-bold text-slate-400 mb-1">Suggested Drop %</label>
                <input type="number" id="repricing-drop-pct" min="1" max="50" value="5" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white">
              </div>
              <div>
                <label class="block text-[10px] uppercase font-bold text-slate-400 mb-1">Overprice %</label>
                <input type="number" id="repricing-overprice-pct" min="1" max="100" value="20" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white">
              </div>
            </div>
            <div class="flex items-center gap-2 pt-1">
              <button type="button" id="repricing-save-btn" onclick="if(typeof saveRepricingClick==='function')saveRepricingClick(this);" class="ms-btn ms-btn--primary !min-h-0 !py-1.5 !px-3.5 !text-[11px]">Save Rules</button>
              <button type="button" id="repricing-apply-btn" onclick="if(typeof applyRepricingClick==='function')applyRepricingClick(this);" class="ms-btn ms-btn--secondary !min-h-0 !py-1.5 !px-3.5 !text-[11px]">Apply Rules Now</button>
            </div>
          </div>
        `
      });

      // 9. AI Stocking Recommendations Card
      const stockingCard = pulseCard({
        title: 'AI Stocking Recommendations',
        tier: 'compact',
        headerAction: `<button type="button" id="stocking-generate-btn" onclick="if(typeof loadStockingRecommendations==='function')loadStockingRecommendations(true);" class="ms-btn ms-btn--secondary shrink-0 inline-flex items-center gap-1 !min-h-0 !py-1 !px-2.5 !text-[11px]">
          <svg class="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>
          Refresh
        </button>`,
        inner: `
          <div id="stocking-results" class="space-y-2 text-left">
            <div class="py-6 text-center text-xs text-slate-400 italic">Analyzing sales velocity and market demand…</div>
          </div>
        `
      });

      // 10. Acquisition Pipeline Card
      const acqList = [
        ...appraisals.slice(0, 3).map(a => `
          <div class="ms-list-row w-full flex items-center justify-between gap-3 text-left">
            <div class="min-w-0 flex-1 text-left">
              <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate text-left">${esc([a.year, a.make, a.model].filter(Boolean).join(' ') || a.vin || 'Appraisal')}</div>
              <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate text-left">${esc(a.status || 'Pending appraisal')}${a.customer_name ? ` · ${esc(a.customer_name)}` : ''}</div>
            </div>
            <button type="button" onclick="switchPage('appraisal')" class="ms-btn ms-btn--secondary shrink-0 inline-flex items-center justify-center whitespace-nowrap !min-h-0 !py-1.5 !px-3.5 !text-[12px]">View Appraisal</button>
          </div>
        `),
        ...nonTrade.slice(0, 3).map(v => invRow(v, d, `${esc(v.source || 'Purchased')}${v.invoice_amount ? ` · $${Number(v.invoice_amount).toLocaleString()}` : ''}`)),
        ...tradeAwaiting.slice(0, 3).map(v => invRow(v, d, `<span class="text-blue-600 dark:text-blue-400">from Sales trade</span>${v.invoice_amount ? ` · $${Number(v.invoice_amount).toLocaleString()}` : ''}`))
      ];

      const acqCard = pulseCard({
        title: 'Acquisition Pipeline',
        count: appraisals.length + awaiting,
        tier: 'feature',
        inner: `
          <div class="grid grid-cols-3 gap-1.5 mb-3 text-left">
            <div class="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 p-2 text-left">
              <div class="text-[9px] font-black uppercase tracking-wider text-slate-500 truncate" title="Appraised">Appraised</div>
              <div class="text-base font-black text-slate-900 dark:text-white">${appraisals.length}</div>
            </div>
            <div class="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 p-2 text-left">
              <div class="text-[9px] font-black uppercase tracking-wider text-slate-500 truncate" title="In Transit">In Transit</div>
              <div class="text-base font-black ${awaiting ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}">${awaiting}</div>
            </div>
            <div class="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 p-2 text-left">
              <div class="text-[9px] font-black uppercase tracking-wider text-slate-500 truncate" title="30d Intake">30d Intake</div>
              <div class="text-base font-black text-slate-900 dark:text-white">${recent.length}</div>
            </div>
          </div>
          <div class="space-y-1 text-left">
            ${acqList.join('')}
          </div>
        `,
        empty: 'No incoming acquisitions or pending appraisals.'
      });

      // 11. Market & Competitors Live Card
      const marketCard = pulseCard({
        title: 'Market & Competitors',
        tier: 'hero',
        inner: `
          <div class="space-y-3.5 text-left">
            <!-- Market Snapshot Form -->
            <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-3.5 text-left">
              <div class="flex items-center justify-between gap-2 mb-1.5">
                <div class="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                  <span>Market Snapshot</span>
                  <span class="text-[9px] font-black uppercase tracking-wider bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded-full">Live MarketCheck</span>
                </div>
              </div>
              <p class="text-[11px] text-slate-500 dark:text-slate-400 mb-2">Query active listing count, median price and days-on-market for any make/model.</p>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <input id="msnap-make" placeholder="Make" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white">
                <input id="msnap-model" placeholder="Model" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white">
                <input id="msnap-year" inputmode="numeric" placeholder="Year (optional)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white">
                <input id="msnap-trim" placeholder="Trim (optional)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white">
              </div>
              <button type="button" id="msnap-run" onclick="if(typeof runMarketSnapshot==='function')runMarketSnapshot()" class="mt-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition shadow-sm">Get snapshot</button>
              <div id="msnap-result" class="mt-2 text-xs"></div>
            </div>

            <!-- Direct Competition -->
            <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-3.5 text-left">
              <div class="flex items-center justify-between gap-2 mb-2">
                <div class="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                  <span>Direct Competition</span>
                  <span class="text-[11px] text-slate-400 font-normal">— track nearby dealership lots</span>
                </div>
                <button type="button" id="competitors-scan-btn" onclick="if(typeof scanAllCompetitors==='function')scanAllCompetitors()" class="ms-btn ms-btn--secondary shrink-0 inline-flex items-center justify-center gap-1 !min-h-0 !py-1 !px-2.5 !text-[11px]">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/></svg>
                  Scan All
                </button>
              </div>
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 px-3 py-1.5 text-xs mb-2.5">
                <span class="font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">Your lot</span>
                <span class="text-slate-600 dark:text-slate-300"><span id="lot-mini-count" class="font-bold text-slate-900 dark:text-white">${veh.length}</span> vehicles</span>
                <span class="text-slate-600 dark:text-slate-300"><span id="lot-mini-range" class="font-bold text-slate-900 dark:text-white">—</span></span>
                <span class="text-slate-600 dark:text-slate-300">avg <span id="lot-mini-avg" class="font-bold text-slate-900 dark:text-white">—</span></span>
              </div>
              <div id="competitors-list" class="space-y-1.5 mb-2.5">
                <div class="text-xs text-slate-400 italic" id="competitors-loading">No competitors added yet.</div>
              </div>
              <div class="flex flex-col sm:flex-row gap-1.5 pt-2 border-t border-slate-200/70 dark:border-slate-800/70">
                <input type="text" id="competitor-name-input" placeholder="Dealership name" class="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white">
                <input type="url" id="competitor-url-input" placeholder="Inventory URL" class="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white">
                <button type="button" id="competitor-add-btn" onclick="if(typeof addCompetitor==='function')addCompetitor()" class="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition whitespace-nowrap">Add</button>
              </div>
              <div id="competitor-comparison" class="hidden mt-2"></div>
            </div>
          </div>
        `
      });

      // 12. Reports & Daily Briefing Alerts Card
      const reportsCard = pulseCard({
        title: 'Reports & Alerts',
        tier: 'compact',
        inner: `
          <div class="space-y-2.5 text-left">
            <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/70 dark:border-slate-800/70">
              <div>
                <div class="text-xs font-semibold text-slate-800 dark:text-slate-200">Daily Briefing Email</div>
                <div class="text-[11px] text-slate-400">Receive morning digest on days with actionable inventory alerts.</div>
              </div>
              <label class="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input type="checkbox" id="daily-digest-toggle" onchange="if(typeof toggleDailyDigest==='function')toggleDailyDigest(this);" class="sr-only peer">
                <div class="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div class="flex items-center justify-between gap-2 flex-wrap pt-1">
              <div class="flex items-center gap-2">
                <button type="button" id="weekly-report-btn" onclick="if(typeof sendWeeklyReportClick==='function')sendWeeklyReportClick(this);" class="ms-btn ms-btn--primary inline-flex items-center gap-1.5 !min-h-0 !py-1.5 !px-3 !text-[11px]">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>
                  Send Report Now
                </button>
                <button type="button" id="weekly-report-pdf-btn" onclick="if(typeof downloadWeeklyReportPdfClick==='function')downloadWeeklyReportPdfClick(this);" class="ms-btn ms-btn--secondary inline-flex items-center gap-1.5 !min-h-0 !py-1.5 !px-3 !text-[11px]">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
                  PDF
                </button>
              </div>
              <span id="weekly-report-last-sent" class="text-[10px] text-slate-400"></span>
            </div>
          </div>
        `
      });

      // 13. AI Merchandising Automation Card
      const aiAssistantCard = pulseCard({
        title: 'AI Merchandising',
        tier: 'feature',
        inner: proactiveAiPanel
      });

      body.innerHTML = `
        ${pulseHeader('Inventory Pulse', 'Lot health, merchandising gaps, acquisition and market position')}
        ${pulseBoard([
          intelCard,
          lotAnalysisCard,
          attentionCard,
          turnRateCard,
          healthScoreCard,
          scanActivityCard,
          merchCard,
          repricingCard,
          stockingCard,
          acqCard,
          marketCard,
          reportsCard,
          aiAssistantCard
        ])}
      `;

      // Trigger all legacy data loaders
      if (typeof loadCompetitors === 'function') loadCompetitors();
      if (typeof loadLotOverview === 'function') loadLotOverview();
      if (typeof loadAIActivity === 'function') loadAIActivity();
      if (typeof _loadIntel === 'function') _loadIntel(false);
      else if (typeof loadIntel === 'function') loadIntel(false);
      if (typeof loadRepricingRules === 'function') loadRepricingRules();
      if (typeof loadStockingRecommendations === 'function') loadStockingRecommendations(false);
      if (typeof loadDigestToggle === 'function') loadDigestToggle();
      if (typeof loadScanUsage === 'function') loadScanUsage();
    },
    work: invRenderWork,
  },
};

// ── Global Helper Handlers for Inventory Pulse Masonry ───────────────────────
function syncAllInventoryClick() {
  const btn = document.getElementById('ai-sync-all-btn');
  const status = document.getElementById('ai-sync-status');
  const statusText = document.getElementById('ai-sync-status-text');
  const progressBar = document.getElementById('ai-sync-progress-bar');
  const progressLabel = document.getElementById('ai-sync-progress-label');

  const resetBtn = () => {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Scan All Inventory`;
    }
    if (status) status.classList.add('hidden');
    if (progressBar) progressBar.style.width = '0%';
  };

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Scanning…';
  }
  if (status) status.classList.remove('hidden');
  if (statusText) statusText.textContent = 'Starting scan…';
  if (progressBar) progressBar.style.width = '0%';
  if (progressLabel) progressLabel.textContent = '';

  const tk = localStorage.getItem('token') || localStorage.getItem('ms_auth_token');
  const API_URL = typeof API !== 'undefined' ? API : '';

  fetch(`${API_URL}/ai/sync-all`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tk}` }
  })
    .then(r => r.json())
    .then(data => {
      const total = data.queued || 0;
      if (statusText) statusText.textContent = `Scanning ${total} vehicles…`;
      if (total === 0) { resetBtn(); return; }

      const scanStartedAt = new Date(Date.now() - 15000);
      let lastProcessed = -1;
      let lastAdvanceAt = Date.now();

      const finishScan = (label) => {
        clearInterval(pollInterval);
        if (statusText) statusText.textContent = label;
        if (progressBar) progressBar.style.width = '100%';
        if (progressLabel) progressLabel.textContent = `${total} of ${total} checked (100%)`;
        if (typeof loadAIActivity === 'function') loadAIActivity();
        setTimeout(resetBtn, 3000);
      };

      const pollInterval = setInterval(async () => {
        try {
          const r = await fetch(`${API_URL}/ai/activity?limit=500`, { headers: { 'Authorization': `Bearer ${tk}` } });
          const d = r.ok ? await r.json() : {};
          const processed = (d.activity || []).filter(a => new Date(a.created_at) >= scanStartedAt).length;
          if (processed > lastProcessed) { lastProcessed = processed; lastAdvanceAt = Date.now(); }
          const pct = Math.min(100, Math.round((processed / total) * 100));
          if (progressBar) progressBar.style.width = pct + '%';
          if (progressLabel) progressLabel.textContent = `${Math.min(processed, total)} of ${total} checked (${pct}%)`;
          if (statusText) statusText.textContent = `Scanning ${total} vehicles…`;
          if (typeof loadAIActivity === 'function') loadAIActivity();
          if (processed >= total) {
            finishScan(`Done — ${total} vehicles scanned`);
          } else if (processed > 0 && (Date.now() - lastAdvanceAt) > 45000) {
            finishScan(`Done — ${processed} of ${total} scanned`);
          }
        } catch {}
      }, 3000);

      setTimeout(() => { clearInterval(pollInterval); resetBtn(); }, 600000);
    })
    .catch(err => {
      resetBtn();
      showToast('Scan failed: ' + err.message, 'error');
    });
}
window.syncAllInventoryClick = syncAllInventoryClick;

function scorePhotosClick(btn) {
  if (!btn || btn._busy) return;
  btn._busy = true; btn.disabled = true;
  const orig = btn.innerHTML;
  btn.textContent = 'Scoring photos…';
  const tk = localStorage.getItem('token') || localStorage.getItem('ms_auth_token');
  const API_URL = typeof API !== 'undefined' ? API : '';

  fetch(`${API_URL}/ai/vision/scan`, { method: 'POST', headers: { 'Authorization': `Bearer ${tk}` } })
    .then(r => r.json())
    .then(data => {
      const total = data.total || 0;
      if (!total) showToast('All photos are already scored.', 'info');
      else showToast(`Scoring photos on ${total} listing${total === 1 ? '' : 's'} — refresh in a moment to see grades fill in.`, 'info', 6000);
      try {
        if (typeof _loadIntel === 'function') _loadIntel(true);
        else if (typeof loadIntel === 'function') loadIntel(true);
      } catch {}
      if (total > (data.scored_now || 0)) {
        setTimeout(() => {
          try {
            if (typeof _loadIntel === 'function') _loadIntel(true);
            else if (typeof loadIntel === 'function') loadIntel(true);
          } catch {}
        }, 20000);
      }
    })
    .catch(e => showToast(e.message, 'error'))
    .finally(() => {
      btn._busy = false; btn.disabled = false; btn.innerHTML = orig;
    });
}
window.scorePhotosClick = scorePhotosClick;

function saveRepricingClick(btn) {
  if (!btn) return;
  btn.disabled = true; btn.textContent = 'Saving…';
  const tk = localStorage.getItem('token') || localStorage.getItem('ms_auth_token');
  const API_URL = typeof API !== 'undefined' ? API : '';

  fetch(`${API_URL}/ai/repricing-rules`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${tk}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      enabled: document.getElementById('repricing-enabled')?.checked,
      days_on_lot_threshold: Number(document.getElementById('repricing-days')?.value),
      price_drop_pct: Number(document.getElementById('repricing-drop-pct')?.value),
      overprice_threshold_pct: Number(document.getElementById('repricing-overprice-pct')?.value),
    })
  })
    .then(async r => {
      if (!r.ok) throw new Error((await r.json()).error || 'Save failed');
      showToast('Repricing rules saved', 'success');
    })
    .catch(e => showToast(e.message, 'error'))
    .finally(() => { btn.disabled = false; btn.textContent = 'Save Rules'; });
}
window.saveRepricingClick = saveRepricingClick;

function applyRepricingClick(btn) {
  if (!btn) return;
  btn.disabled = true; btn.textContent = 'Applying…';
  const tk = localStorage.getItem('token') || localStorage.getItem('ms_auth_token');
  const API_URL = typeof API !== 'undefined' ? API : '';

  fetch(`${API_URL}/ai/repricing-apply`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tk}` }
  })
    .then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed');
      showToast(`${data.flagged} vehicle${data.flagged !== 1 ? 's' : ''} flagged for repricing`, data.flagged > 0 ? 'info' : 'success');
      if (data.flagged > 0 && typeof loadAIActivity === 'function') loadAIActivity();
    })
    .catch(e => showToast(e.message, 'error'))
    .finally(() => { btn.disabled = false; btn.textContent = 'Apply Rules Now'; });
}
window.applyRepricingClick = applyRepricingClick;

function setAiActivityFilter(filter) {
  if (typeof __aiActivityFilter !== 'undefined') {
    __aiActivityFilter = filter || 'all';
    if (typeof renderAiActivity === 'function') renderAiActivity();
  }
}
window.setAiActivityFilter = setAiActivityFilter;

function sendWeeklyReportClick(btn) {
  if (!btn) return;
  btn.disabled = true; btn.textContent = 'Sending…';
  const tk = localStorage.getItem('token') || localStorage.getItem('ms_auth_token');
  const API_URL = typeof API !== 'undefined' ? API : '';

  fetch(`${API_URL}/ai/weekly-report`, { method: 'POST', headers: { 'Authorization': `Bearer ${tk}` } })
    .then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed');
      const now = new Date().toISOString();
      localStorage.setItem('weekly-report-last-sent', now);
      const lastSentEl = document.getElementById('weekly-report-last-sent');
      if (lastSentEl) lastSentEl.textContent = `Last sent: ${new Date(now).toLocaleDateString()}`;
      showToast(`Report sent to ${data.sent_to || data.recipient}`, 'success', 5000);
    })
    .catch(e => showToast(e.message, 'error'))
    .finally(() => {
      btn.disabled = false;
      btn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg> Send Report Now`;
    });
}
window.sendWeeklyReportClick = sendWeeklyReportClick;

function downloadWeeklyReportPdfClick(btn) {
  if (!btn) return;
  btn.disabled = true; btn.textContent = 'Generating…';
  const tk = localStorage.getItem('token') || localStorage.getItem('ms_auth_token');
  const API_URL = typeof API !== 'undefined' ? API : '';

  fetch(`${API_URL}/ai/weekly-report/html`, { headers: { 'Authorization': `Bearer ${tk}` } })
    .then(async r => {
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Failed'); }
      const html = await r.text();
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank');
      if (w) setTimeout(() => URL.revokeObjectURL(url), 30000);
      else showToast('Pop-up blocked — allow pop-ups and try again', 'error');
    })
    .catch(e => showToast(e.message, 'error'))
    .finally(() => {
      btn.disabled = false;
      btn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg> PDF`;
    });
}
window.downloadWeeklyReportPdfClick = downloadWeeklyReportPdfClick;

function toggleDailyDigest(input) {
  if (!input) return;
  const tk = localStorage.getItem('token') || localStorage.getItem('ms_auth_token');
  const API_URL = typeof API !== 'undefined' ? API : '';

  fetch(`${API_URL}/ai/config`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${tk}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ daily_digest_enabled: input.checked }),
  })
    .then(r => {
      if (!r.ok) throw new Error();
      showToast(input.checked ? 'Daily briefing email on' : 'Daily briefing email off', 'success');
    })
    .catch(() => {
      input.checked = !input.checked;
      showToast('Could not save setting', 'error');
    });
}
window.toggleDailyDigest = toggleDailyDigest;

function loadInventoryWorkspace() { renderEngine('inventory-overview'); }
window.loadInventoryWorkspace = loadInventoryWorkspace;

