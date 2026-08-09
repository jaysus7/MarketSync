// ── Vehicle Record workspace — Stage 3B.2 ────────────────────────────────────
//
// ONE vehicle, ONE surface. Everything the dealership knows about a unit, in the
// order it actually happens:
//
//   Acquisition → Recon → Merchandising → Pricing → Deal & delivery
//
// This is a composition, not a new model. It creates no vehicle, no appraisal, no
// deal and no second copy of anything: it reads the canonical records and hands
// every action back to the engine that owns it (recon → the recon board, pricing →
// pricing intelligence, the deal → desking, possession → the canonical Stage 3A
// endpoint). Follows docs/DEALER_OS_UX_ARCHITECTURE.md §11–12.
//
// Reads:
//   GET /inventory/:id   the canonical vehicle — always refetched, never trusted
//                        from a list that may be stale
//   GET /recon           recon state (owned by the recon engine)
//   GET /fni/deals       the deal on this unit
//
// The last two are OPTIONAL context owned by other departments. A user without
// those permissions gets a 403, which is correct — that section is simply not
// shown rather than faked or degraded into a guess.

let __vrOverlay = null;     // the open record, so a second open replaces it
let __vrId = null;

const VR_OK    = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400';
const VR_BAD   = 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400';
const VR_WARN  = 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400';
const VR_MUTED = 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400';

const vrChip = (text, tone) => `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${tone}">${esc(text)}</span>`;
const vrBtn = (label, onclick, primary) => `<button onclick="${onclick}" class="px-3 py-1.5 rounded-lg text-[12px] font-bold whitespace-nowrap transition ${primary ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90' : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}">${esc(label)}</button>`;
const vrFact = (label, value) => `<div class="min-w-0">
  <div class="text-[11px] text-slate-400 font-semibold">${esc(label)}</div>
  <div class="text-[13px] font-bold text-slate-800 dark:text-slate-100 truncate">${value}</div></div>`;
const vrFacts = (rows) => `<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">${rows.join('')}</div>`;
const vrActions = (btns) => { const b = btns.filter(Boolean); return b.length ? `<div class="flex flex-wrap gap-2 mt-3">${b.join('')}</div>` : ''; };

function vrSection(title, inner) {
  return `<div class="border-t border-slate-200 dark:border-slate-800 pt-4 mt-4">
    <div class="text-[11px] uppercase tracking-wide text-slate-400 font-bold mb-2">${esc(title)}</div>${inner}</div>`;
}

// ── Open / close ─────────────────────────────────────────────────────────────

function vehicleClose() {
  if (__vrOverlay) __vrOverlay.remove();
  __vrOverlay = null; __vrId = null;
}
window.vehicleClose = vehicleClose;

// Leaving the record for the page that owns the next step. The record closes
// first so the user lands on that page, not underneath an overlay.
function vehicleGo(page, invmode) { vehicleClose(); if (invmode) deptGo(page, invmode); else switchPage(page); }
window.vehicleGo = vehicleGo;

function vehicleEdit(id) {
  const v = (__vrData && __vrData.id === id) ? __vrData : null;
  if (!v) return;
  openVehicleForm(v);        // the existing vehicle editor — one form, one record
}
window.vehicleEdit = vehicleEdit;

function vehicleHistory(id) {
  const v = (__vrData && __vrData.id === id) ? __vrData : null;
  if (!v) return;
  openVehicleHistory({ inventory_id: v.id, vin: v.vin || '', label: invName(v) });
}
window.vehicleHistory = vehicleHistory;

// Possession is a canonical transition, so it goes through the ONE producer path
// (invTakePossession → POST /inventory/:id/take-possession). On success the record
// reopens against server truth rather than patching what is on screen.
async function vehicleTakePossession(id) {
  const ok = await invTakePossession(id);
  if (ok) vehicleOpen(id);
}
window.vehicleTakePossession = vehicleTakePossession;

let __vrData = null;        // the vehicle currently on screen (for Edit / History)

async function vehicleOpen(id) {
  if (!id) return;
  vehicleClose();
  __vrId = id;
  const el = crmOverlay(`<div class="p-6"><div class="text-sm text-slate-400 py-10 text-center">Loading vehicle…</div></div>`, 'max-w-3xl');
  __vrOverlay = el;
  el.addEventListener('click', () => { if (__vrOverlay === el) { __vrOverlay = null; __vrId = null; __vrData = null; } });
  const panel = el.firstElementChild;

  let v;
  try { v = await apiGetJson(`/inventory/${id}`); }
  catch (e) {
    if (__vrOverlay === el) panel.innerHTML = `<div class="p-6">${engEmpty(`Couldn't open that vehicle: ${e?.message || e}`)}</div>`;
    return;
  }
  const [recon, deals] = await Promise.all([
    apiGetJson('/recon').then(r => r.recon || r.rows || r.items || []).catch(() => null),
    apiGetJson('/fni/deals').then(r => r.deals || r.items || []).catch(() => null),
  ]);
  if (__vrOverlay !== el) return;      // closed or replaced while loading
  __vrData = v;
  panel.innerHTML = vrRender(v, {
    recon: recon ? recon.find(r => r.inventory_id === v.id) || null : null,
    deal: deals ? deals.find(x => x.inventory_id === v.id) || null : null,
    dealsVisible: !!deals,
  });
}
window.vehicleOpen = vehicleOpen;

// ── Render ───────────────────────────────────────────────────────────────────

function vrRender(v, ctx) {
  const days = invDays(v.created_at);
  const checks = invMerchChecks(v);
  const gaps = checks.filter(c => !c.ok);
  const money = (n) => Number(n) ? '$' + Number(n).toLocaleString() : '—';
  const photos = invPhotoCount(v);
  const hero = photos && Array.isArray(v.image_urls) ? v.image_urls[0] : null;

  const chips = [
    v.awaiting_possession ? vrChip('Awaiting possession', VR_WARN) : vrChip('In your possession', VR_OK),
    ctx.recon && ctx.recon.stage && ctx.recon.stage !== 'done' ? vrChip(`Recon · ${ctx.recon.stage}`, VR_MUTED) : '',
    ctx.deal ? vrChip('On a deal', VR_MUTED) : '',
    days != null && days >= INV_AGED_DAYS ? vrChip(`Aged ${days}d`, VR_WARN) : '',
    gaps.length ? vrChip(`${gaps.length} merchandising gap${gaps.length === 1 ? '' : 's'}`, VR_BAD) : vrChip('Frontline ready', VR_OK),
  ].filter(Boolean).join(' ');

  const header = `<div class="flex items-start gap-3 p-5 pb-0">
    ${hero ? `<img src="${esc(hero)}" alt="" class="hidden sm:block w-24 h-20 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 shrink-0">` : ''}
    <div class="min-w-0 flex-1">
      <div class="text-lg font-black text-slate-900 dark:text-white truncate">${esc(invName(v))}</div>
      <div class="text-[12px] text-slate-400 truncate">${v.stocknumber ? `#${esc(v.stocknumber)} · ` : ''}${v.vin ? `VIN ${esc(v.vin)}` : 'No VIN on file'}${v.mileage ? ` · ${Number(v.mileage).toLocaleString()} km` : ''}</div>
      <div class="flex flex-wrap gap-1.5 mt-2">${chips}</div>
    </div>
    <button onclick="vehicleClose()" class="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="Close">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
  </div>`;

  // 1 · Acquisition — where this unit came from and whether we actually have it.
  const channel = INV_ACQ_LABEL[invAcqChannel(v)];
  const acquisition = vrSection('Acquisition', vrFacts([
    vrFact('Channel', esc(channel)),
    vrFact('Cost', money(v.invoice_amount)),
    vrFact('In stock', days != null ? `${days} day${days === 1 ? '' : 's'}` : '—'),
    vrFact('Possession', v.awaiting_possession ? '<span class="text-amber-600 dark:text-amber-400">Awaiting</span>' : 'Received'),
    v.source_appraisal_id
      ? vrFact('Continues', '<span class="text-indigo-500">the Sales appraisal</span>')
      : vrFact('Source', esc(v.source || 'entered manually')),
  ]) + (v.source_appraisal_id
      ? `<p class="text-[12px] text-slate-400 mt-3">This is the same appraisal record Sales created — the trade was never re-entered as a new vehicle.</p>`
      : '')
    + vrActions([
      invCanTakePossession(v) ? vrBtn('Take Possession', `vehicleTakePossession('${v.id}')`, true) : '',
      v.awaiting_possession && v.source_appraisal_id ? vrBtn('Open Appraisal', `vehicleGo('appraisal')`, true) : '',
      vrBtn('Edit vehicle', `vehicleEdit('${v.id}')`),
      v.vin ? vrBtn('Vehicle history', `vehicleHistory('${v.id}')`) : '',
    ]));

  // 2 · Recon — owned by the recon engine; shown here, never re-implemented.
  const r = ctx.recon;
  const reconInner = r
    ? vrFacts([
        vrFact('Stage', esc(r.stage || 'in progress')),
        vrFact('Status', r.stage === 'done' ? 'Complete' : '<span class="text-sky-600 dark:text-sky-400">In recon</span>'),
        vrFact('Sold', r.deal_id ? '<span class="text-rose-500">Yes — delivery is waiting</span>' : 'No'),
      ]) + vrActions([vrBtn('Open Recon board', `vehicleGo('recon')`)])
    : `<div class="text-[13px] text-slate-500 dark:text-slate-400">Not in recon.</div>`
      + vrActions([vrBtn('Open Recon board', `vehicleGo('recon')`)]);
  const recon = vrSection('Recon', reconInner);

  // 3 · Merchandising — every gap that keeps this unit off the front line.
  const merch = vrSection('Merchandising', `<div class="flex flex-wrap gap-1.5">
      ${checks.map(c => vrChip(c.label, c.ok ? (c.strong === false ? VR_WARN : VR_OK) : VR_BAD)).join(' ')}
    </div>
    ${gaps.length ? `<p class="text-[12px] text-slate-400 mt-2">${esc(gaps.map(c => c.gap).join(' · '))}</p>` : ''}
    ${vrActions([
      vrBtn(photos ? 'Edit photos & copy' : 'Add photos', `vehicleEdit('${v.id}')`, !photos),
      vrBtn('Window sticker', `vehicleGo('vin-sticker')`),
      vrBtn('Publish to Facebook', `vehicleGo('inventory','facebook')`),
    ])}`);

  // 4 · Pricing — the numbers, and the engine that owns them.
  const gross = Number(v.price) && Number(v.invoice_amount) ? Number(v.price) - Number(v.invoice_amount) : null;
  const pricing = vrSection('Pricing', vrFacts([
      vrFact('Asking', Number(v.price) ? money(v.price) : '<span class="text-rose-500">Not priced</span>'),
      vrFact('Cost', money(v.invoice_amount)),
      vrFact('Front gross', gross == null ? '—' : `<span class="${gross < 0 ? 'text-rose-500' : ''}">${money(gross)}</span>`),
    ]) + vrActions([
      vrBtn('Pricing intelligence', `vehicleGo('inv-intel')`),
      vrBtn('Market data', `vehicleGo('market')`),
    ]));

  // 5 · Deal & delivery — the handoff into F&I, on the SAME vehicle id.
  const x = ctx.deal;
  let dealInner;
  if (!ctx.dealsVisible) {
    dealInner = `<div class="text-[13px] text-slate-500 dark:text-slate-400">Deal information is F&amp;I-only — you don't have access to it.</div>`;
  } else if (!x) {
    dealInner = `<div class="text-[13px] text-slate-500 dark:text-slate-400">No open deal on this vehicle.</div>`;
  } else {
    dealInner = vrFacts([
      vrFact('Customer', esc(x.customer || 'Customer')),
      vrFact('Stage', esc(fniStage(x))),
      vrFact('Selling price', money(x.selling_price)),
      x.delivery_date ? vrFact('Delivery', esc(x.delivery_date)) : vrFact('Delivery', '<span class="text-amber-600 dark:text-amber-400">Not scheduled</span>'),
    ]) + vrActions([
      x.contact_id ? vrBtn('Open customer', `vehicleClose(); crmOpenForm('${x.contact_id}')`) : '',
      x.contact_id ? vrBtn('Desk the deal', `vehicleClose(); openDeskForContact('${x.contact_id}')`) : '',
      vrBtn('Delivery queue', `vehicleGo('delivery')`),
    ]);
  }
  const deal = vrSection('Deal & delivery', dealInner);

  return `${header}<div class="p-5 pt-3">${acquisition}${recon}${merch}${pricing}${deal}
    <p class="text-[11px] text-slate-400 mt-4">One vehicle, one record. Every action above hands off to the engine that owns it — this workspace stores nothing of its own.</p>
  </div>`;
}
