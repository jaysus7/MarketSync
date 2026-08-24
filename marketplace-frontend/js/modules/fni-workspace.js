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
let __fniDeliveries = null;   // lazy — not part of the landing payload
let __fniProducts = null;     // lazy
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
  ENGINE_DATA['fni-overview'] = undefined;
  engineTab('fni-overview', 'overview', true);
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
  host.innerHTML = `<button onclick="engineTab('fni-overview','overview')" class="text-[13px] font-bold text-indigo-500 hover:text-indigo-400 mb-3">← Back to Funding</button>
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

// Credit and Menu are gone as views. Both are things you do ON a deal — the credit
// application opens from the deal, and the menu is part of desking one — so a department-level
// list of them was a second way in to work that already has a home.
// Contracts and Funding move up into My Day: they are what is outstanding today, not a place
// to browse.

// ── Contracts and Funding — outstanding today, in My Day ─────────────────────
// They were two browse views inside Work. What matters about a contract is that it is not back
// yet, and what matters about funding is that the money has not arrived — both are "today"
// facts, so they belong in the day rather than in a list somebody opens on purpose.
function fniContractsAndFunding(d) {
  const deals = d.deals || [];
  const awaitingContract = deals.filter(x => /sold|delivered/i.test(x.deal_status || '') && !x.contract_signed_at);
  const row = (x, note) => `<div class="flex items-center gap-3 py-2 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <div class="min-w-0 flex-1"><div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(fniCustomer(x))}</div>
    <div class="text-[12px] text-slate-400 truncate">${esc(note)}</div></div>
    <button onclick="switchPage('fni')" class="shrink-0 px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700">Open deal</button></div>`;

  // Funding is CANONICAL state (Stage 3A) — funding_state, funding_submitted_at,
  // funded_at, days_in_funding and the selected lender decision, all from /fni/funding.
  // Deriving it from "contract signed but not funded" on the deal row would be a second
  // opinion about the same fact, and the two would eventually disagree.
  let funding;
  if (d.funding == null) {
    funding = engCard('Awaiting funding', engEmpty('Funding state could not be loaded, so it is not shown.'));
  } else {
    const open = d.funding.filter(r => r.funding_state !== 'funded');
    const BUCKETS = [['exception', 'Exception'], ['conditions', 'Conditions'], ['submitted', 'Submitted'], ['pending', 'Pending']];
    const inner = BUCKETS.map(([state, label]) => {
      const list = open.filter(r => r.funding_state === state);
      return list.length ? `<div class="text-[11px] uppercase tracking-wide text-slate-400 font-bold mt-2 first:mt-0">${label} (${list.length})</div>${list.slice(0, 6).map(fniFundingRow).join('')}` : '';
    }).join('');
    funding = engCard(`Awaiting funding (${open.length})`, inner || engEmpty('Nothing is waiting to be funded.'));
  }

  return `<div class="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
    ${engCard(`Contracts outstanding (${awaitingContract.length})`, awaitingContract.length
      ? awaitingContract.slice(0, 8).map(x => row(x, 'Sold, contract not signed')).join('')
      : engEmpty('Every sold deal has a signed contract.'))}
    ${funding}
  </div>`;
}

// ── Deals — the department's whole book, folded into Pulse (see overview() below) ──
// This was a sub-nav of five (queue, credit, menu, contracts, funding), then a separate
// "Deals" tab. Credit and the menu belong on the deal you are desking, not beside it;
// contracts and funding moved into My Day; the remaining grouped list and the F&I deal
// page itself now render inside overview() directly — one F&I header, not two.

ENGINES['fni-overview'] = {
  rootId: 'fni-overview-root', title: 'F&I Department', subtitle: 'Approvals, credit, products, contracts and delivery readiness',
  icon: 'shield', accent: 'indigo',
  // Right-rail Reports, specific to F&I.
  reports: [
    { label: 'F&I performance', icon: 'chart', onclick: "openDeptReport('fni')" },
    { label: 'E-signatures', icon: 'document', onclick: "openDeptReport('esign')" },
  ],
  // Insights and Deals both folded into My Day/Pulse — one F&I header, not several.
  tabLabels: { overview: 'Pulse', settings: 'Settings' },
  get tabOrder() {
    const mgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
    return mgr ? ['overview', 'settings'] : ['overview'];
  },

  fetch: async () => {
    // Deals are the landing payload. The delivery queue is fetched here too because
    // blockers are the department's headline attention item, but products and the
    // full delivery view stay lazy.
    const [deals, del, products, lenders, funding, gamification] = await Promise.all([
      apiGetJson('/fni/deals').catch(() => ({ deals: [] })),
      apiGetJson('/delivery/queue').catch(() => ({ deals: [] })),
      apiGetJson('/fni/products').catch(() => null),
      apiGetJson('/fni/lenders').catch(() => null),
      // Canonical funding state, so My Day reads the fact rather than inferring it.
      apiGetJson('/fni/funding').catch(() => null),
      apiGetJson('/gamification').catch(() => null),
    ]);
    const queue = del.deals || del.queue || [];
    const d = { deals: deals.deals || deals.items || [], deliveryQueue: queue, blocked: queue.filter(x => x.blocker),
      // null means "could not read", which the Settings tab renders differently from "none".
      products: products ? (products.products || products.items || []) : null,
      lenders: lenders ? (lenders.lenders || lenders.items || []) : null,
      funding: funding ? (funding.deals || []) : null, gamification };
    __fniWsData = d;
    return d;
  },

  quickActions: [
    { label: 'F&I Training (Academy)', icon: 'sparkles', onclick: "openMarketSyncAcademy('fni')" },
    { label: 'Desk Deal', icon: 'currency', onclick: "switchPage('desk')" },
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
      const now = Date.now();
      const oneHourMs = 3600 * 1000;
      
      // Incoming deals desked within 1 hour (or recent deals)
      const incomingDeals = deals.filter(x => {
        const ts = new Date(x.desked_at || x.created_at || x.updated_at || 0).getTime();
        return (now - ts) <= oneHourMs;
      });
      const deskedToShow = incomingDeals.length ? incomingDeals : deals.slice(0, 5);

      const pending = deals.filter(x => x.deal_status === 'pending').length;
      const inFni = deals.filter(x => x.deal_status === 'fni').length;
      const blocked = (d.blocked || []).length;

      const formatTimeAgo = (tsStr) => {
        if (!tsStr) return 'Just now';
        const diffMs = Date.now() - new Date(tsStr).getTime();
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
      };

      const funding = d.funding || deals.filter(x => x.deal_status === 'fni');
      const products = d.products || [];

      // ── Pulse grid — the at-a-glance widget wall ────────────────────────────
      const grid = pulseGrid([
        pulseCard({
          title: 'Deliveries', count: (d.deliveryQueue || []).length,
          onclick: "switchPage('delivery')",
          inner: (d.deliveryQueue || []).length ? d.deliveryQueue.slice(0, 5).map(x => pulseRow({
            badge: x.blocker ? '!' : undefined, icon: x.blocker ? undefined : 'check', badgeTone: x.blocker ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300' : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300',
            label: fniCustomer(x), sub: x.blocker || 'Ready', onclick: "switchPage('delivery')",
          })).join('') : '', empty: 'Nothing in the delivery queue.',
        }),
        pulseCard({
          title: 'Deals in funding', count: funding.length, tone: funding.length ? 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300' : '',
          onclick: "switchPage('fni')",
          inner: funding.length ? funding.slice(0, 5).map(x => pulseRow({
            badge: '$', label: fniCustomer(x), sub: fniVehicle(x) || fniStage(x), onclick: "switchPage('fni')",
          })).join('') : '', empty: 'No deals currently in funding.',
        }),
        pulseCard({
          title: 'Incomplete deals', count: pending, tone: pending ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300' : '',
          onclick: "switchPage('fni')",
          inner: pending ? deals.filter(x => x.deal_status === 'pending').slice(0, 5).map(x => pulseRow({
            badge: '…', label: fniCustomer(x), sub: fniVehicle(x), onclick: "switchPage('fni')",
          })).join('') : '', empty: 'No deals awaiting a decision.',
        }),
        pulseCard({
          title: 'F&I products', count: products.length,
          onclick: "engineTab('fni-overview','settings')",
          inner: products.length ? products.slice(0, 5).map(p => pulseRow({
            badge: p.active === false ? '–' : undefined, icon: p.active === false ? undefined : 'check', badgeTone: p.active === false ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300',
            label: p.name || p.product_name || 'Product', sub: p.provider || '', done: p.active === false,
          })).join('') : '', empty: 'No F&I products set up yet.',
        }),
        pulseCard({
          title: 'Needs attention', count: att.length, tone: att.length ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300' : '', span: 'tall',
          inner: att.length ? att.slice(0, 8).map(salesAttentionRow).join('') : '', empty: 'No deals need immediate attention.',
        }),
        pulseCard({
          title: 'Deals by stage', count: deals.length,
          inner: Object.entries(FNI_STAGE_LABEL).map(([st, label]) => {
            const n = deals.filter(x => x.deal_status === st).length;
            return n ? pulseRow({ badge: n, label, onclick: "switchPage('fni')" }) : '';
          }).filter(Boolean).join('') || '', empty: 'No deals yet.',
        }),
        pulseLeaderboardCard(d.gamification, 'fni', { title: 'F&I leaderboard', metric: 'pvr_avg' }),
      ]);

      const proactiveAiPanel = `
        <div class="mb-4 p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg border border-slate-800">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-sky-400">
              <span>Proactive F&amp;I Manager AI Assistant</span>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/20 text-sky-300 border border-sky-500/30">LIVE F&amp;I ACTIVITY</span>
          </div>
          <div class="text-xs text-slate-300 space-y-1.5 mb-3">
            <p>• <strong>Desked Deals Incoming:</strong> ${incomingDeals.length ? `<span class="text-emerald-400 font-bold">${incomingDeals.length} deal(s) desked in the last 60 minutes ready for lender submission.</span>` : 'No new deals desked in the past hour.'}</p>
            <p>• <strong>Lender Approvals Pending:</strong> ${pending ? `<span class="text-amber-300 font-bold">${pending} deal(s) awaiting lender credit decision or stipulation check-in.</span>` : 'All submitted deals have received lender decisions.'}</p>
            <p>• <strong>Delivery Queue Blockers:</strong> ${blocked ? `<span class="text-rose-400 font-bold">${blocked} delivery unit(s) blocked on missing insurance, stips, or funding approval!</span>` : 'No delivery queue blockers.'}</p>
            <p>• <strong>F&amp;I Product Index:</strong> ${(d.products || []).length} active protection &amp; warranty products available for menu presentation.</p>
          </div>
          <div class="flex flex-wrap gap-2 pt-2 border-t border-slate-800/80">
            <button onclick="switchPage('delivery')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition">Check Delivery Blockers</button>
          </div>
        </div>
      `;

      body.innerHTML = `
        ${pulseHeader('F&I Pulse', 'Approvals, credit, products, contracts and delivery readiness')}
        ${grid}

        <div class="mt-5">${proactiveAiPanel}</div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          ${engKpi('Needs attention', att.length, att.length ? 'text-rose-600 dark:text-rose-400' : '')}
          ${engKpi('Incoming (Last 1h)', incomingDeals.length, incomingDeals.length ? 'text-indigo-600 dark:text-indigo-400 font-bold' : '')}
          ${engKpi('Pending approval', pending, pending ? 'text-amber-600 dark:text-amber-400' : '')}
          ${engKpi('In F&I', inFni)}
        </div>

        <!-- Incoming Deals (Desked within 1 hour) -->
        <div class="mb-4">
          ${engCard('Incoming Desked Deals (Last 1 Hour)', deskedToShow.length ? deskedToShow.map(x => {
            const timeAgoStr = formatTimeAgo(x.desked_at || x.created_at || x.updated_at);
            return `<div class="flex items-center justify-between py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
              <div class="min-w-0 flex-1">
                <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(fniCustomer(x))}</div>
                <div class="text-[12px] text-slate-400 truncate">
                  <span class="font-semibold text-slate-600 dark:text-slate-300">${esc(fniStage(x))}</span>
                  ${fniVehicle(x) ? ` · ${esc(fniVehicle(x))}` : ''}
                  ${x.selling_price ? ` · $${Number(x.selling_price).toLocaleString()}` : ''}
                  · <span class="text-indigo-600 dark:text-indigo-400 font-semibold">${esc(timeAgoStr)}</span>
                </div>
              </div>
              <button onclick="switchPage('fni')" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition">Open Deal</button>
            </div>`;
          }).join('') : engEmpty('No deals desked in the last hour.'))}
        </div>

        <!-- F&I Worklist & Delivery Blockers -->
        ${engCard('F&I Worklist', att.length ? att.map(salesAttentionRow).join('') : engEmpty('No deals need immediate attention.'))}

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
          ${engCard('Delivery blockers', blocked ? (d.blocked || []).slice(0, 8).map(x => `
            <div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
              <div class="min-w-0 flex-1">
                <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(fniCustomer(x))}</div>
                <div class="text-[12px] text-rose-500 truncate">${esc(x.blocker || '')}</div>
              </div>
              <button onclick="switchPage('delivery')" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Prepare Delivery</button>
            </div>`).join('') : engEmpty('No delivery blockers.'))}
          ${(() => {
            // The department's whole book, folded in here rather than a separate Deals
            // tab — one F&I header, not two. A delivered deal drops off the list.
            const order = ['pending', 'approved', 'fni', 'contracted', 'sold', 'working'];
            const inner = order.map(st => {
              const rows = deals.filter(x => x.deal_status === st && !/delivered/i.test(x.deal_status || '') && !x.delivered_at);
              return rows.length ? engCard(`${FNI_STAGE_LABEL[st] || st} (${rows.length})`, rows.slice(0, 12).map(fniRow).join('')) : '';
            }).join('') || engCard('', engEmpty('No deals in progress.'));
            return engSection('In progress', inner, 'Sold and in funding — a deal leaves here when it is delivered');
          })()}
        </div>

        ${fniContractsAndFunding(d)}`;

      const esignSection = document.createElement('div');
      esignSection.className = 'mt-4';
      body.appendChild(esignSection);
      engMountPage(esignSection, 'fni-esignatures', () => {
        if (typeof window.renderFniEsign === 'function') window.renderFniEsign();
      });

      // The full F&I deal list, with everything you can do to one — mounted here
      // instead of behind a second "Deals" tab.
      body.insertAdjacentHTML('beforeend', engSection('All F&I deals', '', 'The full deal list, with everything you can do to one'));
      engMountPage(body, 'fni', () => loadFniPage());
    },
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
    // ── SETTINGS — the settings themselves ──────────────────────────────────
    // Was a paragraph and two buttons pointing elsewhere. Most F&I work runs through third
    // parties, so what this department actually configures is WHO those parties are and what
    // is on the menu — so those are listed here, with their real state.
    settings(body, d) {
      const products = d.products || null;
      const lenders = d.lenders || null;

      const list = (rows, empty, render) => rows === null
        ? engEmpty('This could not be loaded, so it is not shown as empty.')
        : rows.length ? rows.map(render).join('') : engEmpty(empty);

      body.innerHTML = `
        ${engCard(`F&I products (${products === null ? 'unknown' : products.length})`, list(products,
          'No products are set up yet, so nothing can be presented on a menu.',
          (p) => `<div class="flex items-center gap-3 py-2 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
            <div class="min-w-0 flex-1"><div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(p.name || p.product_name || 'Product')}</div>
            <div class="text-[12px] text-slate-400 truncate">${esc([p.provider, p.category].filter(Boolean).join(' · ') || 'No provider recorded')}</div></div>
            <div class="shrink-0 text-[12px] font-bold ${p.active === false ? 'text-slate-400' : 'text-emerald-600 dark:text-emerald-400'}">${p.active === false ? 'Inactive' : 'Active'}</div>
          </div>`))}
        <div class="mt-3"></div>
        ${engCard(`Lenders (${lenders === null ? 'unknown' : lenders.length})`, list(lenders,
          'No lenders are set up. Funding cannot be tracked against a lender until one exists.',
          (l) => `<div class="flex items-center gap-3 py-2 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
            <div class="min-w-0 flex-1"><div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(l.name || 'Lender')}</div>
            <div class="text-[12px] text-slate-400 truncate">${esc(l.notes || l.tier || '')}</div></div>
          </div>`))}
        <div class="mt-3"></div>
        ${engCard('Where the rest lives', `<p class="text-[12px] text-slate-500">Most F&amp;I work runs through third parties — lenders, credit bureaux and contract providers — and those connections are configured under Settings &rsaquo; Integrations, not here. Dealership legal name, tax registration and disclosures live in Setup.</p>
          <button onclick="switchPage('config')" class="mt-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[13px] font-bold">Open integrations</button>`)}
      `;
    },
  },
};

function loadFniWorkspace() { renderEngine('fni-overview'); }
window.loadFniWorkspace = loadFniWorkspace;
