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
              <div class="text-[10px] font-black uppercase tracking-wider text-slate-500">On lot</div>
              <div class="text-lg font-black text-slate-900 dark:text-white mt-0.5">${veh.length}</div>
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
              <div class="text-xs font-black text-slate-900 dark:text-white mt-0.5">${prices.length ? `$${minPrice.toLocaleString()} - $${maxPrice.toLocaleString()}` : '—'}</div>
            </div>
            <div class="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-2 text-left">
              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Average Price</div>
              <div class="text-xs font-black text-slate-900 dark:text-white mt-0.5">${avgPrice ? `$${avgPrice.toLocaleString()}` : '—'}</div>
            </div>
            <div class="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-2 text-left">
              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">New / Used</div>
              <div class="text-xs font-black text-slate-900 dark:text-white mt-0.5">${newCount} new · ${usedCount} used</div>
            </div>
            <div class="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-2 text-left">
              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Turn Rate (90d)</div>
              <div class="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-0.5">${recent.length ? `${recent.length} in 30d` : 'Healthy'}</div>
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800/70">
            <div class="flex items-center gap-2">
              <button type="button" onclick="if(typeof scanAllInventory==='function')scanAllInventory();else switchPage('inv-intel')" class="ms-btn ms-btn--secondary inline-flex items-center gap-1.5 !min-h-0 !py-1.5 !px-3 !text-[12px]">
                <svg class="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>
                Scan All Inventory
              </button>
            </div>
            <button type="button" onclick="switchPage('inv-intel')" class="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
              Full Intelligence &amp; Reports &rarr;
            </button>
          </div>
        `
      });

      // 2. Needs Attention Card
      const attentionCard = pulseCard({
        title: 'Needs attention',
        count: att.length,
        tier: 'feature',
        tone: att.length ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300' : '',
        inner: att.length ? att.slice(0, 8).map(salesAttentionRow).join('') : '',
        empty: 'Every vehicle is frontline ready.'
      });

      // 3. Merchandising Readiness Card
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

      // 4. Acquisition Pipeline Card
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

      // 5. Pricing & Age Alignment Card (Pricing and age)
      const pricingCard = pulseCard({
        title: 'Pricing & Age Alignment',
        count: noPrice.length + agedVehicles.length,
        tier: 'feature',
        inner: `
          <div class="space-y-1 text-left">
            ${noPrice.slice(0, 4).map(v => invRow(v, d, '<span class="text-rose-500 font-bold">Unpriced unit</span>')).join('')}
            ${agedVehicles.slice(0, 4).map(v => invRow(v, d, `<span class="text-amber-600 dark:text-amber-400 font-bold">Aged ${invDays(v.created_at) || v.age_days || 60}d on lot</span>`)).join('')}
          </div>
        `,
        empty: 'All units are priced and within turnover targets.'
      });

      // 6. Market & Competitors Live Card
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

      // 7. AI Merchandising Card
      const aiAssistantCard = pulseCard({
        title: 'AI Merchandising',
        tier: 'feature',
        inner: proactiveAiPanel
      });

      body.innerHTML = `
        ${pulseHeader('Inventory Pulse', 'Lot health, merchandising gaps, acquisition and market position')}
        ${pulseBoard([
          intelCard,
          attentionCard,
          merchCard,
          acqCard,
          pricingCard,
          marketCard,
          aiAssistantCard
        ])}
      `;

      // Load competitor and lot status
      if (typeof loadCompetitors === 'function') loadCompetitors();
      if (typeof loadLotOverview === 'function') loadLotOverview();
    },
    work: invRenderWork,
  },
};

function loadInventoryWorkspace() { renderEngine('inventory-overview'); }
window.loadInventoryWorkspace = loadInventoryWorkspace;
