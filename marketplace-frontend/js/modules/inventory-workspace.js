// ── Inventory workspace — Stage 3, built on the Sales pattern ────────────────
//
// Follows docs/DEALER_OS_UX_ARCHITECTURE.md §11–12 exactly: register on the shared
// ENGINES shell, compose the existing Inventory pages, change no backend, derive
// nothing that is already persisted.
//
// One vehicle lifecycle:  Acquire → Received → Recon → Priced → Published → Sold
//
// Reads only endpoints that already exist:
//   /inventory        vehicles (status, price, image_urls, created_at,
//                     awaiting_possession, source_appraisal_id, stocknumber)
//   /recon            recon rows (stage, inventory_id, deal_id, salesperson_id)
//   /ai/appraisals    appraisal queue                      (Acquire view, lazy)
//
// HANDOFF: `inventory.source_appraisal_id` is the Sales trade/appraisal this
// vehicle came from — the SAME appraisal record, never a copy. Surfacing it here
// is what makes Sales → Inventory continuous.

const INV_AGED_DAYS = 60;

const invName = (v) => [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ') || v.stocknumber || 'Vehicle';
const invDays = (iso) => { if (!iso) return null; const d = (Date.now() - new Date(iso).getTime()) / 864e5; return Number.isFinite(d) ? Math.floor(d) : null; };
const invHasPhotos = (v) => Array.isArray(v.image_urls) ? v.image_urls.length > 0 : !!v.image_urls;

let __invData = null;
let __invWorkView = 'vehicles';
let __invAppraisals = null;   // lazily fetched inside the Acquire view

// Recon stage for a vehicle, if any (the recon engine owns this state).
function invReconOf(v, d) { return (d.reconByInv || {})[v.id] || null; }

// What should happen to this vehicle next — derived from existing state only.
function invNextAction(v, d) {
  const recon = invReconOf(v, d);
  if (v.awaiting_possession) return { label: 'Mark received', reason: 'Awaiting possession', tone: 'amber', onclick: `switchPage('inventory')` };
  if (recon && recon.stage && recon.stage !== 'done') return { label: 'Open Recon', reason: `In recon · ${recon.stage}`, tone: 'sky', onclick: `switchPage('recon')` };
  if (!invHasPhotos(v)) return { label: 'Add photos', reason: 'No photos — cannot merchandise', tone: 'rose', onclick: `switchPage('inventory')` };
  if (!Number(v.price)) return { label: 'Set price', reason: 'No price set', tone: 'rose', onclick: `switchPage('inv-intel')` };
  const age = invDays(v.created_at);
  if (age != null && age >= INV_AGED_DAYS) return { label: 'Review pricing', reason: `Aged ${age} days`, tone: 'amber', onclick: `switchPage('inv-intel')` };
  return { label: 'Open Vehicle', reason: 'Frontline ready', tone: 'slate', onclick: `switchPage('inventory')` };
}

function invAttention(d) {
  const items = [];
  for (const v of d.vehicles || []) {
    const recon = invReconOf(v, d);
    const age = invDays(v.created_at);
    let sev = null, why = null;
    if (v.awaiting_possession) { sev = 1; why = 'Awaiting possession'; }
    else if (!invHasPhotos(v)) { sev = 1; why = 'No photos — cannot merchandise'; }
    else if (!Number(v.price)) { sev = 0; why = 'No price set'; }
    else if (recon && recon.stage && recon.stage !== 'done') { sev = 2; why = `In recon · ${recon.stage}`; }
    else if (age != null && age >= INV_AGED_DAYS) { sev = 3; why = `Aged ${age} days — review pricing`; }
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

function invRow(v, d) {
  const na = invNextAction(v, d);
  const age = invDays(v.created_at);
  return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <div class="min-w-0 flex-1">
      <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(invName(v))}</div>
      <div class="text-[12px] text-slate-400 truncate">${v.stocknumber ? `#${esc(v.stocknumber)} · ` : ''}${Number(v.price) ? '$' + Number(v.price).toLocaleString() : '<span class="text-rose-500">no price</span>'}${age != null ? ` · ${age}d` : ''}${v.source_appraisal_id ? ' · <span class="text-indigo-500">from Sales appraisal</span>' : ''}</div>
    </div>
    <button onclick="${na.onclick}" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">${esc(na.label)}</button>
  </div>`;
}

const INV_WORK_VIEWS = [
  ['vehicles', 'Vehicles'], ['acquire', 'Acquire'], ['recon', 'Recon'],
  ['pricing', 'Pricing'], ['syndication', 'Syndication'],
];
function invWorkView(v) { __invWorkView = v; engineTab('inventory-overview', 'work'); }
window.invWorkView = invWorkView;

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
    const rows = __invAppraisals.appraisals || [];
    // Vehicles already acquired FROM an appraisal — proof the handoff kept one record.
    const fromSales = (d.vehicles || []).filter(v => v.source_appraisal_id);
    inner = engCard('Appraisal queue', rows.slice(0, 15).map(a => `
        <div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
          <div class="min-w-0 flex-1"><div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc([a.year, a.make, a.model].filter(Boolean).join(' ') || a.vin || 'Appraisal')}</div>
            <div class="text-[12px] text-slate-400 truncate">${esc(a.status || 'pending')}${a.customer_name ? ` · ${esc(a.customer_name)}` : ''}</div></div>
          <button onclick="switchPage('appraisal')" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">View Appraisal</button>
        </div>`).join('') || engEmpty('No appraisals waiting.'))
      + (fromSales.length ? engCard('Acquired from a Sales appraisal', fromSales.slice(0, 10).map(v => invRow(v, d)).join(''), 'mt-3') : '')
      + link('appraisal', 'Open appraisals') ;
  } else if (__invWorkView === 'recon') {
    const rows = d.recon || [];
    inner = engCard('In recon', rows.slice(0, 20).map(r => {
      const v = (d.vehById || {})[r.inventory_id] || r.inventory || {};
      return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
        <div class="min-w-0 flex-1"><div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(invName(v))}</div>
          <div class="text-[12px] text-slate-400 truncate">${esc(r.stage || 'in progress')}${r.deal_id ? ' · <span class="text-emerald-600 dark:text-emerald-400">sold — needed for delivery</span>' : ''}</div></div>
        <button onclick="switchPage('recon')" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Open Recon</button>
      </div>`;
    }).join('') || engEmpty('Nothing in recon.')) + link('recon', 'Open recon board');
  } else if (__invWorkView === 'pricing') {
    const noPrice = (d.vehicles || []).filter(v => !Number(v.price));
    const aged = (d.vehicles || []).filter(v => { const a = invDays(v.created_at); return a != null && a >= INV_AGED_DAYS; });
    inner = (noPrice.length ? engCard(`No price (${noPrice.length})`, noPrice.slice(0, 10).map(v => invRow(v, d)).join('')) : '')
      + engCard(`Aged ${INV_AGED_DAYS}+ days (${aged.length})`, aged.slice(0, 15).map(v => invRow(v, d)).join('') || engEmpty('Nothing aged.'), noPrice.length ? 'mt-3' : '')
      + link('inv-intel', 'Open pricing intelligence');
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
  tabLabels: { overview: 'Today', work: 'Work' },
  get tabOrder() {
    const mgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
    return mgr ? ['overview', 'work', 'insights', 'settings'] : ['overview', 'work'];
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
    { label: 'Appraise Trade', icon: 'gem', onclick: "switchPage('appraisal')" },
    { label: 'Recon board', icon: 'wrench', onclick: "switchPage('recon')" },
    { label: 'Pricing', icon: 'chart', onclick: "switchPage('inv-intel')" },
    { label: 'Publish to Facebook', icon: 'megaphone', onclick: "deptGo('inventory','facebook')" },
  ],
  nextActions: (d) => invAttention(d || {}).slice(0, 5).map(it => ({
    label: `${it.who} — ${it.action?.label || 'Open'}`, icon: 'flame',
    tone: SALES_TONE[it.action?.tone] || SALES_TONE.slate, onclick: it.action?.onclick || '',
  })),

  tabs: {
    overview(body, d) {
      const att = invAttention(d);
      const veh = d.vehicles || [];
      const noPhotos = veh.filter(v => !invHasPhotos(v)).length;
      const inRecon = (d.recon || []).filter(r => r.stage && r.stage !== 'done').length;
      const aged = veh.filter(v => { const a = invDays(v.created_at); return a != null && a >= INV_AGED_DAYS; }).length;
      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          ${engKpi('Needs attention', att.length, att.length ? 'text-rose-600 dark:text-rose-400' : '')}
          ${engKpi('In stock', veh.length)}
          ${engKpi('In recon', inRecon, inRecon ? 'text-sky-600 dark:text-sky-400' : '')}
          ${engKpi(`Aged ${INV_AGED_DAYS}d+`, aged, aged ? 'text-amber-600 dark:text-amber-400' : '')}
        </div>
        ${engCard('Needs attention', att.length ? att.map(salesAttentionRow).join('') : engEmpty('Every vehicle is frontline ready.'))}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
          ${engCard('Missing photos', noPhotos ? veh.filter(v => !invHasPhotos(v)).slice(0, 6).map(v => invRow(v, d)).join('') : engEmpty('All vehicles have photos.'))}
          ${engCard('In recon', (d.recon || []).length ? (d.recon || []).slice(0, 6).map(r => {
            const v = (d.vehById || {})[r.inventory_id] || r.inventory || {};
            return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
              <div class="min-w-0 flex-1"><div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(invName(v))}</div>
                <div class="text-[12px] text-slate-400 truncate">${esc(r.stage || 'in progress')}</div></div>
              <button onclick="switchPage('recon')" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Open Recon</button>
            </div>`; }).join('') : engEmpty('Nothing in recon.'))}
        </div>`;
    },
    work: invRenderWork,
    insights(body, d) {
      const veh = d.vehicles || [];
      const bucket = (lo, hi) => veh.filter(v => { const a = invDays(v.created_at); return a != null && a >= lo && (hi == null || a < hi); }).length;
      const rows = [['0–30 days', bucket(0, 30)], ['30–60 days', bucket(30, 60)], ['60–90 days', bucket(60, 90)], ['90+ days', bucket(90, null)]];
      const mx = Math.max(1, ...rows.map(r => r[1]));
      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          ${engKpi('In stock', veh.length)}
          ${engKpi('Priced', veh.filter(v => Number(v.price)).length)}
          ${engKpi('With photos', veh.filter(invHasPhotos).length)}
          ${engKpi('In recon', (d.recon || []).filter(r => r.stage && r.stage !== 'done').length)}
        </div>
        ${engCard('Inventory age', rows.map(([l, n]) => `<div class="flex items-center gap-2 text-sm py-0.5">
          <div class="w-24 shrink-0 text-slate-600 dark:text-slate-300">${esc(l)}</div>
          <div class="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden"><div class="h-full bg-sky-500 rounded-full" style="width:${Math.round((n / mx) * 100)}%"></div></div>
          <div class="w-8 text-right font-bold tabular-nums">${n}</div></div>`).join(''))}`;
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
