// ── F&I workspace — Stage 3, built on the Sales pattern ──────────────────────
//
// Follows docs/DEALER_OS_UX_ARCHITECTURE.md §11–12: register on the shared ENGINES
// shell, compose the existing F&I pages, change no backend.
//
// Deal lifecycle:  Working → Approved → F&I → Contracted → Delivery Ready → Delivered
//
// Reads only endpoints that already exist:
//   /fni/deals       deals (deal_status, contact_id, inventory_id, fni_products,
//                    approved_at, delivery_date, selling_price)
//   /delivery/queue  delivery readiness + blockers            (Delivery view)
//   /fni/products    product catalogue                        (Products view, lazy)
//
// HANDOFF — this is the point of the department. A deal carries `contact_id` and
// `inventory_id`: the SAME customer record Sales worked and the SAME vehicle
// Inventory acquired. Nothing is re-entered and nothing is copied. Opening the
// customer from here calls the same crmOpenForm() Sales uses, and desking calls the
// same openDeskForContact(). F&I never creates a second customer, vehicle or deal.

const FNI_STAGE_LABEL = {
  working: 'Working', pending: 'Pending approval', approved: 'Approved',
  fni: 'In F&I', contracted: 'Contracted', sold: 'Sold', delivered: 'Delivered',
};
const fniStage = (x) => FNI_STAGE_LABEL[x?.deal_status] || x?.deal_status || 'Working';

let __fniWsData = null;
let __fniWorkView = 'queue';
let __fniDeliveries = null;   // lazy — not part of the landing payload
let __fniProducts = null;     // lazy
let __fniFunding = null;      // lazy — GET /fni/funding (canonical funding state)
let __fniDecisions = {};      // dealId -> lender decisions (lazy, per deal)

const fniCustomer = (x) => x.customer_name || x.contact_name || 'Customer';
const fniVehicle = (x) => x.vehicle_label || [x.year, x.make, x.model].filter(Boolean).join(' ') || '';

// Next action, derived from the deal's own status — no second workflow engine.
function fniNextAction(x) {
  switch (x.deal_status) {
    case 'pending': return { label: 'Manager review', reason: 'Waiting on approval', tone: 'rose', onclick: x.contact_id ? `openDeskForContact('${x.contact_id}')` : `switchPage('fni')` };
    case 'approved': return { label: 'Start F&I', reason: 'Approved — begin F&I', tone: 'amber', onclick: x.contact_id ? `openDeskForContact('${x.contact_id}')` : `switchPage('fni')` };
    case 'fni': return { label: 'Complete contracts', reason: 'In F&I', tone: 'sky', onclick: `switchPage('fni')` };
    case 'contracted':
    case 'sold': return { label: 'Prepare Delivery', reason: 'Contracted — prepare delivery', tone: 'emerald', onclick: `switchPage('delivery')` };
    default: return { label: 'Open Deal', reason: 'Working deal', tone: 'slate', onclick: x.contact_id ? `openDeskForContact('${x.contact_id}')` : `switchPage('fni')` };
  }
}

function fniAttention(d) {
  const items = [];
  for (const x of d.deals || []) {
    let sev = null, why = null;
    if (x.deal_status === 'pending') { sev = 0; why = 'Deal pending manager approval'; }
    else if (x.deal_status === 'approved') { sev = 1; why = 'Approved — waiting on F&I'; }
    else if (x.deal_status === 'fni' && !(x.fni_products || []).length) { sev = 2; why = 'In F&I — no products presented'; }
    else if (['contracted', 'sold'].includes(x.deal_status) && !x.delivery_date) { sev = 2; why = 'Contracted — delivery not scheduled'; }
    if (sev == null) continue;
    items.push({ sev, id: x.id, who: fniCustomer(x), why, age: '',
                 sub: fniVehicle(x) || (x.deal_number ? `#${x.deal_number}` : ''), action: fniNextAction(x) });
  }
  // Delivery blockers come from the delivery queue, which owns that state.
  for (const b of d.blocked || []) {
    items.push({ sev: 1, id: b.id, who: b.customer_name || b.contact_name || 'Delivery',
                 why: `Delivery blocked · ${b.blocker}`, age: '', sub: fniVehicle(b),
                 action: { label: 'Prepare Delivery', onclick: `switchPage('delivery')`, tone: 'rose' } });
  }
  items.sort((a, b) => a.sev - b.sev);
  const seen = new Set(); const out = [];
  for (const it of items) { if (seen.has(it.id)) continue; seen.add(it.id); out.push(it); }
  return out.slice(0, 25);
}

function fniRow(x) {
  const na = fniNextAction(x);
  return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <button onclick="${x.contact_id ? `crmOpenForm('${x.contact_id}')` : `switchPage('fni')`}" class="min-w-0 flex-1 text-left">
      <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(fniCustomer(x))}</div>
      <div class="text-[12px] text-slate-400 truncate">
        <span class="font-semibold text-slate-500 dark:text-slate-300">${esc(fniStage(x))}</span>
        ${fniVehicle(x) ? ` · ${esc(fniVehicle(x))}` : ''}${x.selling_price ? ` · $${Number(x.selling_price).toLocaleString()}` : ''}
      </div>
    </button>
    <button onclick="${na.onclick}" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">${esc(na.label)}</button>
  </div>`;
}

// ── Funding row + actions (canonical funding state, Stage 3A) ────────────────
// Every mutation goes through PUT /fni/deals/:id/funding. The UI never writes
// funding state locally and never touches the ledger: the backend emits
// `funding.received` on the transition into `funded`, and Accounting clears
// Contracts in Transit from that event.
const FNI_FUNDING_NEXT = {
  pending:    { label: 'Mark Submitted', to: 'submitted' },
  submitted:  { label: 'Mark Funded',    to: 'funded' },
  conditions: { label: 'Mark Funded',    to: 'funded' },
  exception:  { label: 'Mark Funded',    to: 'funded' },
};

function fniFundingRow(r) {
  const sel = r.selected_decision || null;
  const next = FNI_FUNDING_NEXT[r.funding_state];
  const aged = (r.days_in_funding ?? 0) >= 14;
  return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <button onclick="${r.contact_id ? `crmOpenForm('${r.contact_id}')` : ''}" class="min-w-0 flex-1 text-left">
      <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(r.customer_name || r.deal_number || 'Deal')}</div>
      <div class="text-[12px] text-slate-400 truncate">
        ${esc(salesLabel(r.funding_state))}${sel?.lender_id ? ' · lender selected' : ''}
        ${r.funding_submitted_at ? ` · submitted ${esc(new Date(r.funding_submitted_at).toLocaleDateString())}` : ''}
        ${r.days_in_funding != null ? ` · <span class="${aged ? 'text-rose-500 font-bold' : ''}">${r.days_in_funding}d outstanding</span>` : ''}
        ${sel?.conditions ? ` · <span class="text-amber-600 dark:text-amber-400">${esc(sel.conditions)}</span>` : ''}
        ${r.funded_at ? ` · funded ${esc(new Date(r.funded_at).toLocaleDateString())}` : ''}
      </div>
    </button>
    <button onclick="fniOpenLenders('${r.id}')" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Lenders</button>
    ${next ? `<button onclick="fniSetFunding('${r.id}','${next.to}')" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition">${esc(next.label)}</button>` : ''}
  </div>`;
}

// Advance funding through the canonical endpoint, then refetch server truth.
async function fniSetFunding(dealId, to) {
  try {
    await apiSendJson(`/fni/deals/${dealId}/funding`, 'PUT', { funding_status: to });
    showToast(to === 'funded' ? 'Funding recorded — Accounting notified' : `Funding marked ${to}`, 'success');
  } catch (e) { showToast(e.message || 'Could not update funding', 'error'); return; }
  __fniFunding = null;                       // never trust local state — refetch
  ENGINE_DATA['fni-overview'] = undefined;
  engineTab('fni-overview', 'work', true);
}
window.fniSetFunding = fniSetFunding;

// ── Lender decision panel ────────────────────────────────────────────────────
// Reads the canonical one-to-many model. Selection goes through the API; the
// database enforces a single selected decision per deal (partial unique index).
async function fniOpenLenders(dealId) {
  const host = document.querySelector('[data-engine-body="fni-overview"]');
  if (!host) return;
  host.innerHTML = `<div class="text-sm text-slate-400 py-10 text-center">Loading lender decisions…</div>`;
  let decisions = [];
  try { decisions = (await apiGetJson(`/fni/deals/${dealId}/lender-decisions`)).decisions || []; }
  catch (e) { host.innerHTML = engEmpty(`Couldn't load lender decisions: ${esc(e.message)}`); return; }
  const money = (v) => v == null ? '—' : '$' + Number(v).toLocaleString();
  const rows = decisions.map(d => `
    <div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
      <div class="min-w-0 flex-1">
        <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">
          ${esc(d.lender_name || d.lender_id || 'Lender')}${d.selected ? ' <span class="text-emerald-600 dark:text-emerald-400">· selected</span>' : ''}
        </div>
        <div class="text-[12px] text-slate-400 truncate">
          ${esc(d.decision || d.submission_status || 'draft')}
          ${d.rate != null ? ` · ${d.rate}%` : ''}${d.term_months ? ` · ${d.term_months}mo` : ''}
          ${d.approved_amount != null ? ` · ${money(d.approved_amount)}` : ''}
          ${d.submitted_at ? ` · sent ${esc(new Date(d.submitted_at).toLocaleDateString())}` : ''}
          ${d.responded_at ? ` · replied ${esc(new Date(d.responded_at).toLocaleDateString())}` : ''}
          ${d.approval_expires_on ? ` · expires ${esc(d.approval_expires_on)}` : ''}
          ${d.conditions ? ` · <span class="text-amber-600 dark:text-amber-400">${esc(d.conditions)}</span>` : ''}
        </div>
      </div>
      ${d.selected ? '' : `<button onclick="fniSelectLender('${dealId}','${d.id}')" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Select</button>`}
    </div>`).join('') || engEmpty('No lender decisions recorded for this deal.');
  host.innerHTML = `<button onclick="engineTab('fni-overview','work')" class="text-[13px] font-bold text-indigo-500 hover:text-indigo-400 mb-3">← Back to Funding</button>
    ${engCard('Lender decisions', rows)}
    <p class="text-[12px] text-slate-400 mt-3">One selected approval per deal — enforced by the database, not the interface.</p>`;
}
window.fniOpenLenders = fniOpenLenders;

async function fniSelectLender(dealId, decisionId) {
  try {
    await apiSendJson(`/fni/deals/${dealId}/lender-decisions/${decisionId}/select`, 'PUT', {});
    showToast('Lender approval selected', 'success');
  } catch (e) { showToast(e.message || 'Could not select lender', 'error'); return; }
  fniOpenLenders(dealId);   // refresh from the server, never toggle locally
}
window.fniSelectLender = fniSelectLender;

const FNI_WORK_VIEWS = [
  ['queue', 'Queue'], ['credit', 'Credit'], ['menu', 'Menu'],
  ['contracts', 'Contracts'], ['funding', 'Funding'],
];
function fniWorkView(v) { __fniWorkView = v; engineTab('fni-overview', 'work'); }
window.fniWorkView = fniWorkView;

async function fniRenderWork(body, d) {
  const nav = FNI_WORK_VIEWS.map(([id, label]) => {
    const on = __fniWorkView === id;
    return `<button onclick="fniWorkView('${id}')" class="px-3 py-1.5 rounded-lg text-[13px] font-bold transition ${on ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}">${esc(label)}</button>`;
  }).join('');
  const link = (page, label) => `<div class="mt-3"><button onclick="switchPage('${page}')" class="text-[13px] font-bold text-indigo-500 hover:text-indigo-400">${esc(label)} →</button></div>`;
  let inner = '';

  if (__fniWorkView === 'queue') {
    const order = ['pending', 'approved', 'fni', 'contracted', 'sold', 'working'];
    inner = order.map(st => {
      const rows = (d.deals || []).filter(x => x.deal_status === st);
      return rows.length ? engCard(`${FNI_STAGE_LABEL[st] || st} (${rows.length})`, rows.slice(0, 12).map(fniRow).join('')) : '';
    }).join('') || engEmpty('No deals in progress.');
    inner += link('fni', 'Open F&I deals');
  } else if (__fniWorkView === 'credit') {
    // There is no list endpoint for credit applications — /credit/application is
    // per-deal/per-contact. Rather than invent one, surface the deals whose credit
    // step is next and open the application from the deal (F&I owns the sensitive
    // workflow; Sales can initiate but does not see these fields).
    const need = (d.deals || []).filter(x => ['pending', 'approved', 'fni'].includes(x.deal_status));
    inner = engCard('Deals needing credit', need.slice(0, 15).map(fniRow).join('') || engEmpty('No deals awaiting credit.'))
      + `<p class="text-[12px] text-slate-400 mt-3">Credit applications open from the deal — one canonical application per deal, never a second record.</p>`;
  } else if (__fniWorkView === 'menu') {
    if (!__fniProducts) {
      body.innerHTML = `<div class="flex gap-1.5 mb-3">${nav}</div><div class="text-sm text-slate-400 py-10 text-center">Loading products…</div>`;
      try { __fniProducts = await apiGetJson('/fni/products'); } catch { __fniProducts = { products: [] }; }
    }
    const rows = __fniProducts.products || [];
    inner = engCard('F&I product catalogue', rows.slice(0, 20).map(p => `
      <div class="flex items-center gap-3 py-2 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
        <div class="min-w-0 flex-1 font-semibold text-[13px] text-slate-800 dark:text-slate-100 truncate">${esc(p.name || p.title || 'Product')}</div>
        <div class="text-[12px] text-slate-400">${p.price ? '$' + Number(p.price).toLocaleString() : ''}</div>
      </div>`).join('') || engEmpty('No products configured.'));
  } else if (__fniWorkView === 'contracts') {
    const rows = (d.deals || []).filter(x => ['contracted', 'sold'].includes(x.deal_status));
    inner = engCard('Contracted', rows.slice(0, 20).map(fniRow).join('') || engEmpty('Nothing contracted yet.')) + link('fni', 'Open F&I deals');
  } else if (__fniWorkView === 'funding') {
    // Canonical funding state (Stage 3A) — NOT inferred from delivered/unreconciled.
    // GET /fni/funding returns funding_state, funding_submitted_at, funded_at,
    // days_in_funding and the SELECTED lender decision in one read.
    if (!__fniFunding) {
      body.innerHTML = `<div class="flex gap-1.5 mb-3">${nav}</div><div class="text-sm text-slate-400 py-10 text-center">Loading funding…</div>`;
      try { __fniFunding = await apiGetJson('/fni/funding'); } catch (e) { __fniFunding = { deals: [], error: e.message }; }
    }
    const rows = __fniFunding.deals || [];
    const BUCKETS = [['pending', 'Pending'], ['submitted', 'Submitted'], ['conditions', 'Conditions'], ['exception', 'Exception'], ['funded', 'Funded']];
    inner = BUCKETS.map(([state, label]) => {
      const list = rows.filter(r => r.funding_state === state);
      if (!list.length) return '';
      return engCard(`${label} (${list.length})`, list.slice(0, 15).map(fniFundingRow).join(''));
    }).join('') || engEmpty(__fniFunding.error ? `Couldn't load funding: ${esc(__fniFunding.error)}` : 'Nothing in funding.');
  }
  body.innerHTML = `<div class="flex gap-1.5 mb-3 overflow-x-auto">${nav}</div>${inner}`;
}

ENGINES['fni-overview'] = {
  rootId: 'fni-overview-root', title: 'F&I', subtitle: 'Approvals, credit, products, contracts and delivery readiness',
  icon: 'shield', accent: 'indigo',
  tabLabels: { overview: 'Today', work: 'Work' },
  get tabOrder() {
    const mgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
    return mgr ? ['overview', 'work', 'insights', 'settings'] : ['overview', 'work'];
  },

  fetch: async () => {
    // Deals are the landing payload. The delivery queue is fetched here too because
    // blockers are the department's headline attention item, but products and the
    // full delivery view stay lazy.
    const [deals, del] = await Promise.all([
      apiGetJson('/fni/deals').catch(() => ({ deals: [] })),
      apiGetJson('/delivery/queue').catch(() => ({ deals: [] })),
    ]);
    const queue = del.deals || del.queue || [];
    const d = { deals: deals.deals || deals.items || [], blocked: queue.filter(x => x.blocker) };
    __fniWsData = d;
    return d;
  },

  quickActions: [
    { label: 'Desk Deal', icon: 'currency', onclick: "switchPage('desk')" },
    { label: 'F&I deals', icon: 'shield', onclick: "switchPage('fni')" },
    { label: 'Delivery queue', icon: 'bolt', onclick: "switchPage('delivery')" },
  ],
  nextActions: (d) => fniAttention(d || {}).slice(0, 5).map(it => ({
    label: `${it.who} — ${it.action?.label || 'Open'}`, icon: 'flame',
    tone: SALES_TONE[it.action?.tone] || SALES_TONE.slate, onclick: it.action?.onclick || '',
  })),

  tabs: {
    overview(body, d) {
      const att = fniAttention(d);
      const deals = d.deals || [];
      const pending = deals.filter(x => x.deal_status === 'pending').length;
      const inFni = deals.filter(x => x.deal_status === 'fni').length;
      const blocked = (d.blocked || []).length;
      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          ${engKpi('Needs attention', att.length, att.length ? 'text-rose-600 dark:text-rose-400' : '')}
          ${engKpi('Pending approval', pending, pending ? 'text-rose-600 dark:text-rose-400' : '')}
          ${engKpi('In F&I', inFni)}
          ${engKpi('Delivery blocked', blocked, blocked ? 'text-amber-600 dark:text-amber-400' : '')}
        </div>
        ${engCard('Needs attention', att.length ? att.map(salesAttentionRow).join('') : engEmpty('No deals need you right now.'))}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
          ${engCard('Working deals', deals.length ? deals.slice(0, 8).map(fniRow).join('') : engEmpty('No deals in progress.'))}
          ${engCard('Delivery blockers', blocked ? (d.blocked || []).slice(0, 8).map(x => `
            <div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
              <div class="min-w-0 flex-1"><div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(fniCustomer(x))}</div>
                <div class="text-[12px] text-rose-500 truncate">${esc(x.blocker || '')}</div></div>
              <button onclick="switchPage('delivery')" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Prepare Delivery</button>
            </div>`).join('') : engEmpty('No delivery blockers.'))}
        </div>`;
    },
    work: fniRenderWork,
    insights(body, d) {
      const deals = d.deals || [];
      const counts = Object.keys(FNI_STAGE_LABEL).map(k => [FNI_STAGE_LABEL[k], deals.filter(x => x.deal_status === k).length]).filter(r => r[1] > 0);
      const mx = Math.max(1, ...counts.map(r => r[1]));
      const withProducts = deals.filter(x => (x.fni_products || []).length).length;
      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          ${engKpi('Open deals', deals.length)}
          ${engKpi('With F&I products', withProducts)}
          ${engKpi('Product penetration', deals.length ? Math.round((withProducts / deals.length) * 100) + '%' : '—')}
          ${engKpi('Delivery blocked', (d.blocked || []).length)}
        </div>
        ${engCard('Deals by stage', counts.length ? counts.map(([l, n]) => `<div class="flex items-center gap-2 text-sm py-0.5">
          <div class="w-32 shrink-0 text-slate-600 dark:text-slate-300">${esc(l)}</div>
          <div class="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden"><div class="h-full bg-indigo-500 rounded-full" style="width:${Math.round((n / mx) * 100)}%"></div></div>
          <div class="w-8 text-right font-bold tabular-nums">${n}</div></div>`).join('') : engEmpty('No deals yet.'))}`;
    },
    settings(body) {
      body.innerHTML = engCard('F&I settings',
        `<p class="text-[13px] text-slate-600 dark:text-slate-300 mb-3">Lenders, F&amp;I product catalogue and approval behaviour.</p>
         <div class="flex flex-wrap gap-2">
           <button onclick="switchPage('fni')" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold">Lenders &amp; products</button>
           <button onclick="switchPage('config')" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold">Dealership configuration</button>
         </div>`);
    },
  },
};

function loadFniWorkspace() { renderEngine('fni-overview'); }
window.loadFniWorkspace = loadFniWorkspace;
