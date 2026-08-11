// ── Inventory workspace — Stage 3, built on the Sales pattern ────────────────
//
// Follows docs/DEALER_OS_UX_ARCHITECTURE.md §11–12 exactly: register on the shared
// ENGINES shell, compose the existing Inventory pages, change no backend, derive
// nothing that is already persisted.
//
// One vehicle lifecycle:  Acquire → Received → Recon → Priced → Published → Sold
//
// Reads only endpoints that already exist:
//   /inventory        vehicles (status, price, image_urls, description, created_at,
//                     awaiting_possession, source_appraisal_id, stocknumber,
//                     window_sticker_*, sales_pitch, invoice_amount, source_url)
//   /recon            recon rows (stage, inventory_id, deal_id, salesperson_id)
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
let __invWorkView = 'vehicles';
let __invAppraisals = null;   // lazily fetched inside the Acquire view

// Recon stage for a vehicle, if any (the recon engine owns this state).
function invReconOf(v, d) { return (d.reconByInv || {})[v.id] || null; }

// What should happen to this vehicle next — derived from existing state only.
// Anything that isn't another engine's job opens the Vehicle Record, which is the
// one place a unit is worked from.
function invNextAction(v, d) {
  const recon = invReconOf(v, d);
  if (invCanTakePossession(v)) return { label: 'Take Possession', reason: 'Awaiting possession', tone: 'amber', onclick: `invTakePossession('${v.id}')` };
  if (v.awaiting_possession) return { label: 'Open Appraisal', reason: 'Trade awaiting possession', tone: 'amber', onclick: `switchPage('appraisal')` };
  if (recon && recon.deal_id && recon.stage && recon.stage !== 'done') return { label: 'Open Recon', reason: 'Sold — still in recon', tone: 'rose', onclick: `switchPage('recon')` };
  if (recon && recon.stage && recon.stage !== 'done') return { label: 'Open Recon', reason: `In recon · ${recon.stage}`, tone: 'sky', onclick: `switchPage('recon')` };
  if (!invHasPhotos(v)) return { label: 'Add photos', reason: 'No photos — cannot merchandise', tone: 'rose', onclick: `vehicleOpen('${v.id}')` };
  if (!Number(v.price)) return { label: 'Set price', reason: 'No price set', tone: 'rose', onclick: `vehicleOpen('${v.id}')` };
  if (invMerchGaps(v).length) return { label: 'Merchandise', reason: invMerchGaps(v)[0].gap, tone: 'amber', onclick: `vehicleOpen('${v.id}')` };
  const age = invDays(v.created_at);
  if (age != null && age >= INV_AGED_DAYS) return { label: 'Review pricing', reason: `Aged ${age} days`, tone: 'amber', onclick: `switchPage('inv-intel')` };
  return { label: 'Open Vehicle', reason: 'Frontline ready', tone: 'slate', onclick: `vehicleOpen('${v.id}')` };
}

function invAttention(d) {
  const items = [];
  for (const v of d.vehicles || []) {
    const recon = invReconOf(v, d);
    const age = invDays(v.created_at);
    const inRecon = !!(recon && recon.stage && recon.stage !== 'done');
    let sev = null, why = null;
    // A sold unit still in recon is the one exception that can cost a delivery, so
    // it outranks everything else on the lot.
    if (inRecon && recon.deal_id) { sev = 0; why = `Sold — still in recon · ${recon.stage}`; }
    else if (v.awaiting_possession) { sev = 1; why = 'Awaiting possession'; }
    else if (!invHasPhotos(v)) { sev = 2; why = 'No photos — cannot merchandise'; }
    else if (!Number(v.price)) { sev = 3; why = 'No price set'; }
    else if (inRecon) { sev = 4; why = `In recon · ${recon.stage}`; }
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
    : `${Number(v.price) ? '$' + Number(v.price).toLocaleString() : '<span class="text-rose-500">no price</span>'}${age != null ? ` · ${age}d` : ''}${v.source_appraisal_id ? ' · <span class="text-indigo-500">from Sales appraisal</span>' : ''}`;
  return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <button onclick="vehicleOpen('${v.id}')" class="min-w-0 flex-1 text-left">
      <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(invName(v))}</div>
      <div class="text-[12px] text-slate-400 truncate">${v.stocknumber ? `#${esc(v.stocknumber)} · ` : ''}${detail}</div>
    </button>
    <button onclick="${na.onclick}" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">${esc(na.label)}</button>
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
const INV_WORK_VIEWS = [
  // "Cleanup" is what a dealership calls it. "Syndication" was jargon for one specific thing:
  // pushing vehicles out to Facebook Marketplace, which is the AutoPoster product — so it is
  // named for what it does rather than removed.
  ['vehicles', 'Vehicles'], ['acquire', 'Acquisition'], ['recon', 'Cleanup'],
  ['merch', 'Merchandising'], ['pricing', 'Inventory Intelligence'], ['market', 'Market & Competitors'],
];
function invWorkView(v) { __invWorkView = v; engineTab('inventory-overview', 'work'); }
window.invWorkView = invWorkView;

// ── Acquisition — the intake pipeline, in the order a unit actually arrives ───
//
//   1 · Appraised            a customer vehicle Sales is still working — not ours
//   2 · Awaiting possession   bought or traded for, but not physically received
//   3 · In your possession    on the lot, grouped by how it got here
//
// Step 2 is split in two because the halves have DIFFERENT canonical transitions:
// a purchased unit records its acquisition through POST /inventory/:id/take-possession,
// a customer trade records its receipt through the appraisal. Offering the wrong one
// would be rejected server-side, so each group offers only the action that belongs
// to it — the grouping IS the guard rail.
function invRenderAcquisition(d, appraisals) {
  const veh = d.vehicles || [];
  const awaiting = veh.filter(v => v.awaiting_possession);
  const nonTrade = awaiting.filter(invCanTakePossession);
  const tradeAwaiting = awaiting.filter(v => v.source_appraisal_id);
  const recent = veh.filter(v => !v.awaiting_possession && (invDays(v.created_at) ?? 1e9) <= INV_RECENT_DAYS);
  const byChannel = { trade: [], purchased: [], feed: [] };
  for (const v of recent) byChannel[invAcqChannel(v)].push(v);
  const tradeShare = recent.length ? Math.round((byChannel.trade.length / recent.length) * 100) : null;

  const cost = (v) => v.invoice_amount ? ` · cost $${Number(v.invoice_amount).toLocaleString()}` : '';
  const cards = [];

  cards.push(`<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
    ${engKpi('Appraisals waiting', appraisals.length)}
    ${engKpi('Awaiting possession', awaiting.length, awaiting.length ? 'text-amber-600 dark:text-amber-400' : '')}
    ${engKpi(`Acquired ${INV_RECENT_DAYS}d`, recent.length)}
    ${engKpi('Trade share', tradeShare == null ? '—' : tradeShare + '%')}
  </div>`);

  cards.push(engCard(`1 · Appraised — not yet ours (${appraisals.length})`, appraisals.slice(0, 15).map(a => `
    <div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
      <div class="min-w-0 flex-1"><div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc([a.year, a.make, a.model].filter(Boolean).join(' ') || a.vin || 'Appraisal')}</div>
        <div class="text-[12px] text-slate-400 truncate">${esc(a.status || 'pending')}${a.customer_name ? ` · ${esc(a.customer_name)}` : ''}</div></div>
      <button onclick="switchPage('appraisal')" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">View Appraisal</button>
    </div>`).join('') || engEmpty('No appraisals waiting.')));

  if (nonTrade.length) {
    cards.push(engCard(`2 · Awaiting possession — purchased (${nonTrade.length})`,
      nonTrade.slice(0, 12).map(v => invRow(v, d, `${esc(v.source || 'purchased')}${cost(v)}`)).join('')));
  }
  if (tradeAwaiting.length) {
    cards.push(engCard(`2 · Awaiting possession — customer trade (${tradeAwaiting.length})`,
      tradeAwaiting.slice(0, 12).map(v => invRow(v, d, `<span class="text-indigo-500">from Sales appraisal</span>${cost(v)}`)).join('')));
  }
  if (!awaiting.length) cards.push(engCard('2 · Awaiting possession', engEmpty('Everything bought has been received.')));

  const channelCard = (key) => {
    const list = byChannel[key];
    return list.length ? engCard(`3 · In your possession — ${INV_ACQ_LABEL[key].toLowerCase()} (${list.length})`,
      list.slice(0, 10).map(v => invRow(v, d)).join('')) : '';
  };
  const possession = ['trade', 'purchased', 'feed'].map(channelCard).filter(Boolean);
  cards.push(possession.length ? possession.join('')
    : engCard(`3 · In your possession — last ${INV_RECENT_DAYS} days`, engEmpty('Nothing acquired in the last 30 days.')));

  return `<div class="space-y-3">${cards.join('')}</div>`;
}

// ── Merchandising — what stands between a unit and the front line ────────────
// Scored off the canonical vehicle record with invMerchChecks(); nothing here is
// stored, and the Vehicle Record shows the identical checks. A unit that isn't in
// our possession yet is excluded — that's an Acquisition problem, not a
// merchandising one.
function invRenderMerch(d) {
  const scored = (d.vehicles || []).filter(v => !v.awaiting_possession)
    .map(v => ({ v, gaps: invMerchGaps(v), thin: invMerchThin(v) }));
  const blocked = scored.filter(s => s.gaps.length).sort((a, b) => b.gaps.length - a.gaps.length);
  const thin = scored.filter(s => !s.gaps.length && s.thin);
  const ready = scored.filter(s => !s.gaps.length && !s.thin);
  const missing = (key) => scored.filter(s => s.gaps.some(g => g.key === key)).length;
  const pct = (n) => scored.length ? Math.round((n / scored.length) * 100) : 0;

  const gapRow = (s) => invRow(s.v, d, `<span class="text-rose-500">${esc(s.gaps.map(g => g.gap).join(' · '))}</span>`);

  return `<div class="space-y-3">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      ${engKpi('Frontline ready', ready.length, ready.length ? 'text-emerald-600 dark:text-emerald-400' : '')}
      ${engKpi('No photos', missing('photos'), missing('photos') ? 'text-rose-600 dark:text-rose-400' : '')}
      ${engKpi('No description', missing('description'), missing('description') ? 'text-amber-600 dark:text-amber-400' : '')}
      ${engKpi('No window sticker', missing('sticker'), missing('sticker') ? 'text-amber-600 dark:text-amber-400' : '')}
    </div>
    ${engCard('Front line readiness', scored.length ? engBar([
      { pct: pct(ready.length), cls: 'bg-emerald-500', label: `Ready (${ready.length})` },
      { pct: pct(thin.length), cls: 'bg-amber-500', label: `Thin photo set (${thin.length})` },
      { pct: pct(blocked.length), cls: 'bg-rose-500', label: `Blocked (${blocked.length})` },
    ]) : engEmpty('No vehicles in your possession yet.'))}
    ${blocked.length ? engCard(`Blocked from the front line (${blocked.length})`, blocked.slice(0, 20).map(gapRow).join('')) : ''}
    ${thin.length ? engCard(`Listable, but thin — under ${INV_STRONG_PHOTOS} photos (${thin.length})`,
      thin.slice(0, 12).map(s => invRow(s.v, d, `<span class="text-amber-600 dark:text-amber-400">${esc(invMerchChecks(s.v)[0].gap)}</span>`)).join('')) : ''}
    ${!blocked.length && !thin.length && scored.length ? engCard('Merchandising', engEmpty('Every vehicle is fully merchandised.')) : ''}
    <div class="flex flex-wrap gap-3">
      <button onclick="deptGo('inventory','facebook')" class="text-[13px] font-bold text-indigo-500 hover:text-indigo-400">Facebook Marketplace →</button>
      <button onclick="switchPage('vin-sticker')" class="text-[13px] font-bold text-indigo-500 hover:text-indigo-400">Window stickers →</button>
      <button onclick="switchPage('website')" class="text-[13px] font-bold text-indigo-500 hover:text-indigo-400">Website →</button>
    </div>
  </div>`;
}

async function invRenderWork(body, d) {
  const nav = INV_WORK_VIEWS.map(([id, label]) => {
    const on = __invWorkView === id;
    return `<button onclick="invWorkView('${id}')" class="px-3 py-1.5 rounded-lg text-[13px] font-bold transition ${on ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}">${esc(label)}</button>`;
  }).join('');
  let inner = '';
  const link = (page, label) => `<div class="mt-3"><button onclick="switchPage('${page}')" class="text-[13px] font-bold text-indigo-500 hover:text-indigo-400">${esc(label)} →</button></div>`;

  if (__invWorkView === 'vehicles') {
    inner = engCard('Vehicles', (d.vehicles || []).slice(0, 20).map(v => invRow(v, d)).join('') || engEmpty('No vehicles in stock.')) + link('inventory', 'Open full inventory');
  } else if (__invWorkView === 'acquire') {
    if (!__invAppraisals) {
      body.innerHTML = `<div class="flex gap-1.5 mb-3">${nav}</div><div class="text-sm text-slate-400 py-10 text-center">Loading appraisals…</div>`;
      try { __invAppraisals = await apiGetJson('/ai/appraisals'); } catch { __invAppraisals = { appraisals: [] }; }
    }
    inner = invRenderAcquisition(d, __invAppraisals.appraisals || []) + link('appraisal', 'Open appraisals');
  } else if (__invWorkView === 'merch') {
    inner = invRenderMerch(d);
  } else if (__invWorkView === 'recon') {
    // A sold unit still in recon is holding up a delivery, so it gets its own group.
    const rows = d.recon || [];
    const atRisk = (r) => !!r.deal_id && r.stage !== 'done';
    const sold = rows.filter(atRisk), rest = rows.filter(r => !atRisk(r));
    const reconRow = (r) => {
      const v = (d.vehById || {})[r.inventory_id] || r.inventory || {};
      const sub = `${esc(r.stage || 'in progress')}${r.deal_id ? ' · <span class="text-rose-500">sold — delivery is waiting</span>' : ''}`;
      if (v.id) return invRow(v, d, sub);
      return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
        <div class="min-w-0 flex-1"><div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(invName(v))}</div>
          <div class="text-[12px] text-slate-400 truncate">${sub}</div></div>
        <button onclick="switchPage('recon')" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Open Recon</button>
      </div>`;
    };
    inner = `<div class="space-y-3">
      ${sold.length ? engCard(`Sold — still in recon (${sold.length})`, sold.slice(0, 20).map(reconRow).join('')) : ''}
      ${engCard('In recon', rest.slice(0, 20).map(reconRow).join('') || engEmpty('Nothing in recon.'))}
    </div>` + link('recon', 'Open recon board');
  } else if (__invWorkView === 'pricing') {
    const noPrice = (d.vehicles || []).filter(v => !Number(v.price));
    const aged = (d.vehicles || []).filter(v => { const a = invDays(v.created_at); return a != null && a >= INV_AGED_DAYS; });
    inner = (noPrice.length ? engCard(`No price (${noPrice.length})`, noPrice.slice(0, 10).map(v => invRow(v, d)).join('')) : '')
      + engCard(`Aged ${INV_AGED_DAYS}+ days (${aged.length})`, aged.slice(0, 15).map(v => invRow(v, d)).join('') || engEmpty('Nothing aged.'), noPrice.length ? 'mt-3' : '')
      + link('inv-intel', 'Open Inventory Intelligence');
  } else if (__invWorkView === 'market') {
    inner = `${engCard('Market & Competitors', `<div class="text-[13px] text-slate-600 dark:text-slate-300">Live market snapshots, nearby-lot pricing, competitor inventory and price-change monitoring live here as part of Inventory Intelligence.</div>`)}${link('market', 'Open Market & Competitors')}`;
  } else if (__invWorkView === 'syndication') {
    const noPhotos = (d.vehicles || []).filter(v => !invHasPhotos(v));
    inner = engCard('Not publishable yet', noPhotos.slice(0, 15).map(v => invRow(v, d)).join('') || engEmpty('Every vehicle has photos.'))
      + `<div class="mt-3 flex flex-wrap gap-3">
           <button onclick="deptGo('inventory','facebook')" class="text-[13px] font-bold text-indigo-500 hover:text-indigo-400">Facebook Marketplace →</button>
           <button onclick="switchPage('website')" class="text-[13px] font-bold text-indigo-500 hover:text-indigo-400">Website →</button>
         </div>`;
  }
  body.innerHTML = `<div class="flex gap-1.5 mb-3 overflow-x-auto">${nav}</div>${inner}`;
}

ENGINES['inventory-overview'] = {
  rootId: 'inventory-overview-root', title: 'Inventory', subtitle: 'One vehicle lifecycle — acquire, recon, price, publish',
  icon: 'gem', accent: 'sky',
  // Insights and Inventory Intelligence both folded into My Day — the numbers belong where the
  // day is read, not behind a tab. Work is named for what it holds. Appraisals takes the slot
  // Insights had, and is the appraisal page itself rather than a summary of it.
  tabLabels: { overview: 'My Day', work: 'Inventory', appraisals: 'Appraisals', settings: 'Settings' },
  get tabOrder() {
    const mgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
    return mgr ? ['overview', 'work', 'appraisals', 'settings'] : ['overview', 'work', 'appraisals'];
  },

  fetch: async () => {
    const [inv, recon] = await Promise.all([
      apiGetJson('/inventory').catch(() => ({ inventory: [], vehicles: [] })),
      apiGetJson('/recon').catch(() => ({ recon: [], rows: [] })),
    ]);
    const d = {
      vehicles: inv.inventory || inv.vehicles || inv.items || [],
      recon: recon.recon || recon.rows || recon.items || [],
    };
    d.vehById = {}; for (const v of d.vehicles) d.vehById[v.id] = v;
    d.reconByInv = {}; for (const r of d.recon) if (r.inventory_id) d.reconByInv[r.inventory_id] = r;
    __invData = d;
    return d;
  },

  quickActions: [
    // The old Inventory page led with this and the workspace lost it.
    { label: '+ Add inventory', icon: 'gem', onclick: "switchPage('inventory')" },
    { label: 'Appraise Trade', icon: 'gem', onclick: "switchPage('appraisal')" },
    { label: 'Acquisition', icon: 'truck', onclick: "invWorkView('acquire')" },
    { label: 'Merchandising', icon: 'camera', onclick: "invWorkView('merch')" },
    { label: 'Cleanup board', icon: 'wrench', onclick: "switchPage('recon')" },
    { label: 'Inventory Intelligence', icon: 'chart', onclick: "switchPage('inv-intel')" },
    { label: 'Market & Competitors', icon: 'eye', onclick: "switchPage('market')" },
  ],
  nextActions: (d) => invAttention(d || {}).slice(0, 5).map(it => ({
    label: `${it.who} — ${it.action?.label || 'Open'}`, icon: 'flame',
    tone: SALES_TONE[it.action?.tone] || SALES_TONE.slate, onclick: it.action?.onclick || '',
  })),

  tabs: {
    overview(body, d) {
      const att = invAttention(d);
      const veh = d.vehicles || [];
      const held = veh.filter(v => !v.awaiting_possession);
      const notReady = held.filter(v => invMerchGaps(v).length);
      const awaiting = veh.filter(v => v.awaiting_possession).length;
      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          ${engKpi('Needs attention', att.length, att.length ? 'text-rose-600 dark:text-rose-400' : '')}
          ${engKpi('In stock', veh.length)}
          ${engKpi('Awaiting possession', awaiting, awaiting ? 'text-amber-600 dark:text-amber-400' : '')}
          ${engKpi('Not frontline ready', notReady.length, notReady.length ? 'text-rose-600 dark:text-rose-400' : '')}
        </div>
        ${engCard('Needs attention', att.length ? att.map(salesAttentionRow).join('') : engEmpty('Every vehicle is frontline ready.'))}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
          ${engCard('Not frontline ready', notReady.length ? notReady.slice(0, 6).map(v => invRow(v, d, `<span class="text-rose-500">${esc(invMerchGaps(v).map(g => g.gap).join(' · '))}</span>`)).join('') : engEmpty('Every vehicle is merchandised.'))}
          ${engCard('In recon', (d.recon || []).length ? (d.recon || []).slice(0, 6).map(r => {
            const v = (d.vehById || {})[r.inventory_id] || r.inventory || {};
            return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
              <div class="min-w-0 flex-1"><div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(invName(v))}</div>
                <div class="text-[12px] text-slate-400 truncate">${esc(r.stage || 'in progress')}</div></div>
              <button onclick="switchPage('recon')" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Open Recon</button>
            </div>`; }).join('') : engEmpty('Nothing in cleanup.'))}
        </div>`;
      // Insights and Inventory Intelligence live here now: aging, how units were acquired and
      // the frontline picture belong in the day, not behind a tab somebody has to remember.
      const strip = document.createElement('div');
      strip.className = 'mt-4';
      ENGINES['inventory-overview'].tabs.__insightsStrip(strip, d);
      body.appendChild(strip);
    },
    work: invRenderWork,

    // ── APPRAISALS — the appraisal page itself, not a summary of it ─────────
    // "Appraise a car" is a job somebody does, so this tab is that page rather than a card
    // that sends them to it.
    appraisals(body) {
      body.innerHTML = `
        ${engCard('Appraise a vehicle', `
          <p class="text-[12px] text-slate-500 mb-2">Take an appraisal, work the numbers, and hand it to Inventory as a unit.</p>
          <button onclick="switchPage('appraisal')" class="px-4 py-2 rounded-xl bg-sky-600 text-white text-[13px] font-bold">Open the appraisal tool</button>
        `)}
        ${engCard('Equity mining', `
          <p class="text-[12px] text-slate-500 mb-2">Customers already in your book who are in a position to trade.</p>
          <button onclick="switchPage('equity')" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[13px] font-bold">Open equity mining</button>
        `)}
      `;
    },
    // The old Insights tab, now rendered INSIDE My Day. See overview().
    __insightsStrip(body, d) {
      const veh = d.vehicles || [];
      const held = veh.filter(v => !v.awaiting_possession);
      const bucket = (lo, hi) => veh.filter(v => { const a = invDays(v.created_at); return a != null && a >= lo && (hi == null || a < hi); }).length;
      const rows = [['0–30 days', bucket(0, 30)], ['30–60 days', bucket(30, 60)], ['60–90 days', bucket(60, 90)], ['90+ days', bucket(90, null)]];
      const mx = Math.max(1, ...rows.map(r => r[1]));
      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          ${engKpi('In stock', veh.length)}
          ${engKpi('Frontline ready', held.filter(v => !invMerchGaps(v).length).length)}
          ${engKpi('With photos', veh.filter(invHasPhotos).length)}
          ${engKpi('In recon', (d.recon || []).filter(r => r.stage && r.stage !== 'done').length)}
        </div>
        ${engCard('Inventory age', rows.map(([l, n]) => `<div class="flex items-center gap-2 text-sm py-0.5">
          <div class="w-24 shrink-0 text-slate-600 dark:text-slate-300">${esc(l)}</div>
          <div class="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden"><div class="h-full bg-sky-500 rounded-full" style="width:${Math.round((n / mx) * 100)}%"></div></div>
          <div class="w-8 text-right font-bold tabular-nums">${n}</div></div>`).join(''))}
        ${engCard('How units were acquired', (() => {
          const src = ['trade', 'purchased', 'feed'].map(k => [INV_ACQ_LABEL[k], veh.filter(v => invAcqChannel(v) === k).length]).filter(r => r[1] > 0);
          const total = src.reduce((a, r) => a + r[1], 0) || 1;
          const CLS = { 'Customer trade': 'bg-indigo-500', 'Purchased': 'bg-sky-500', 'Feed / sync': 'bg-slate-400' };
          return src.length ? engBar(src.map(([l, n]) => ({ pct: Math.round((n / total) * 100), cls: CLS[l], label: `${l} (${n})` }))) : engEmpty('No vehicles in stock.');
        })(), 'mt-3')}`;
    },
    settings(body) {
      body.innerHTML = engCard('Inventory settings',
        `<p class="text-[13px] text-slate-600 dark:text-slate-300 mb-3">Syndication destinations, pricing rules and recon stages.</p>
         <div class="flex flex-wrap gap-2">
           <button onclick="switchPage('recon')" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold">Recon board</button>
           <button onclick="switchPage('config')" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold">Dealership configuration</button>
         </div>`);
    },
  },
};

function loadInventoryWorkspace() { renderEngine('inventory-overview'); }
window.loadInventoryWorkspace = loadInventoryWorkspace;
