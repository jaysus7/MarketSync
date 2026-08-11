// ── Sales workspace — the DealerOS reference department ──────────────────────
//
// Sales is the first dealership-facing department on the shared engine shell
// (ENGINES / renderEngine / engineRail / engKpi / engCard — dashboard-part10.js).
// Every later department (Inventory, F&I, Service, Parts, Accounting, Marketing,
// People) should follow this shape rather than inventing its own.
//
// The rule this file obeys: **compose, do not rebuild.** It renders NO new business
// logic. Every action delegates to the Sales implementation that already exists —
// crmOpenForm / crmApptForm / crmLogForm / openDeskForContact / switchPage — and
// every field comes from an endpoint that already exists:
//
//   /crm/contacts          opportunities + customers (server already scopes a
//                          non-manager to assigned_rep = me OR created_by = me)
//   /crm/tasks?scope=open  tasks
//   /appointments          appointments
//   /crm/insights          funnel, sources, per-rep, is_manager   (Insights tab)
//   /delivery/queue        deliveries                             (Deliveries view)
//
// No new table, no new endpoint, no second workflow engine, no second customer,
// deal or activity log. "Next action" is DERIVED read-only from the canonical
// status + task + appointment state that already drives the CRM.

// Canonical customer stages — the backend enum. Do NOT add stages here; that is a
// schema change. (The Phase 2 brief's "Showed"/"Negotiating" do not exist yet —
// see docs/SALES_PHASE2_AUDIT.md §4.)
const SALES_STAGES = ['uncontacted', 'contacted', 'appointment', 'sold', 'fni', 'delivered', 'followup', 'lost'];
const SALES_OPEN_STAGES = ['uncontacted', 'contacted', 'appointment', 'sold', 'fni'];

const salesLabel = (s) => (typeof CRM_STATUS !== 'undefined' && CRM_STATUS[s]) || s || '—';
const salesName = (c) => c?.full_name || [c?.first_name, c?.last_name].filter(Boolean).join(' ') || 'Unnamed';
const salesHours = (iso) => { if (!iso) return null; const h = (Date.now() - new Date(iso).getTime()) / 36e5; return Number.isFinite(h) ? h : null; };

// "3h" / "2d" — compact age, or '' when unknown.
function salesAge(iso) {
  const h = salesHours(iso);
  if (h == null) return '';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

// Is the caller a Sales manager? Server-authoritative signal first (/crm/insights
// returns is_manager); role is only a presentation fallback. Never used to expose
// data the API did not return.
function salesIsManager(d) {
  if (d && typeof d.isManager === 'boolean') return d.isManager;
  return ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
}

// ── Next action ──────────────────────────────────────────────────────────────
// Derived, never stored. Maps existing state → the one thing to do next.
function salesNextAction(c, ctx) {
  const id = c.id;
  const task = (ctx?.tasksByContact || {})[id];
  const appt = (ctx?.apptByContact || {})[id];
  const now = Date.now();

  if (task && task.due_at && new Date(task.due_at).getTime() < now) {
    return { label: 'Complete task', reason: `Task overdue · ${esc(task.title || 'follow-up')}`, tone: 'rose', onclick: `switchPage('tasks')` };
  }
  switch (c.status) {
    case 'uncontacted':
      return { label: c.phone || c.phone_mobile ? 'Call' : 'Open Customer', reason: 'New lead — no first response yet', tone: 'rose',
               onclick: c.phone || c.phone_mobile ? `salesCall('${id}')` : `crmOpenForm('${id}')` };
    case 'contacted':
      return appt ? { label: 'Confirm appointment', reason: 'Appointment not confirmed', tone: 'amber', onclick: `crmApptForm('${id}')` }
                  : { label: 'Book appointment', reason: 'Contacted — no appointment set', tone: 'amber', onclick: `crmApptForm('${id}')` };
    case 'appointment':
      return appt && new Date(appt.appointment_at).getTime() < now
        ? { label: 'Log outcome', reason: 'Appointment time passed', tone: 'amber', onclick: `crmLogForm('${id}')` }
        : { label: 'Confirm appointment', reason: 'Appointment upcoming', tone: 'sky', onclick: `crmApptForm('${id}')` };
    case 'sold':
      return { label: 'Desk Deal', reason: 'Sold — send to F&I', tone: 'emerald', onclick: `openDeskForContact('${id}')` };
    case 'fni':
      return { label: 'Prepare delivery', reason: 'F&I in progress', tone: 'sky', onclick: `switchPage('delivery')` };
    case 'delivered':
      return { label: 'Follow up', reason: 'Delivered — owner follow-up', tone: 'slate', onclick: `crmLogForm('${id}')` };
    default:
      return { label: 'Open Customer', reason: 'Needs review', tone: 'slate', onclick: `crmOpenForm('${id}')` };
  }
}

// Call = reuse the existing tel: affordance; logging still happens through the CRM.
function salesCall(id) {
  const c = (__salesData?.contacts || []).find(x => x.id === id);
  const num = c && (c.phone_mobile || c.phone || c.phone_home);
  if (num) window.location.href = `tel:${String(num).replace(/[^\d+]/g, '')}`;
  if (typeof crmLogForm === 'function') crmLogForm(id);
}
window.salesCall = salesCall;

let __salesData = null;      // last engine payload (for salesCall lookups)
let __salesWorkView = 'opportunities';
let __salesDeliveries = null;   // lazily fetched — NOT part of the landing payload

// ── Attention queue ──────────────────────────────────────────────────────────
// One ranked list answering "what needs me right now", newest pain first.
function salesAttention(d) {
  const items = [];
  const now = Date.now();
  const push = (o) => items.push(o);

  for (const c of d.contacts || []) {
    const age = salesHours(c.last_activity_at || c.created_at);
    const na = salesNextAction(c, d);

    if (c.status === 'uncontacted') {
      push({ sev: age != null && age > 1 ? 0 : 1, who: salesName(c), why: 'New lead — needs first response',
             age: salesAge(c.created_at), action: na, id: c.id, sub: c.source ? `via ${c.source}` : '' });
    } else if (SALES_OPEN_STAGES.includes(c.status) && age != null && age > 24 * 7) {
      push({ sev: 3, who: salesName(c), why: 'Stale opportunity — no activity in 7+ days',
             age: salesAge(c.last_activity_at || c.created_at), action: na, id: c.id, sub: salesLabel(c.status) });
    }
  }
  for (const t of d.tasks || []) {
    if (!t.due_at) continue;
    const overdue = new Date(t.due_at).getTime() < now;
    if (!overdue) continue;
    push({ sev: 1, who: t.contact_name || t.title || 'Task', why: `Task overdue · ${t.title || 'follow-up'}`,
           age: salesAge(t.due_at), id: t.contact_id,
           action: { label: 'Complete task', onclick: `switchPage('tasks')`, tone: 'rose' } });
  }
  for (const a of d.appointments || []) {
    const at = new Date(a.appointment_at).getTime();
    if (!Number.isFinite(at)) continue;
    const inHours = (at - now) / 36e5;
    if (inHours > 0 && inHours <= 24) {
      push({ sev: 2, who: a.customer_name || 'Appointment', why: 'Appointment within 24h — confirm',
             age: '', sub: a.vehicle_label || '', id: a.contact_id,
             action: { label: 'Confirm Appointment', onclick: a.contact_id ? `crmApptForm('${a.contact_id}')` : `switchPage('appointments')`, tone: 'amber' } });
    } else if (inHours < 0 && inHours > -48 && !a.outcome) {
      push({ sev: 2, who: a.customer_name || 'Appointment', why: 'Appointment passed — log outcome',
             age: salesAge(a.appointment_at), sub: a.vehicle_label || '', id: a.contact_id,
             action: { label: 'Log outcome', onclick: a.contact_id ? `crmLogForm('${a.contact_id}')` : `switchPage('appointments')`, tone: 'amber' } });
    }
  }
  // One row per customer. A single person can trip several rules at once (stale
  // opportunity AND an overdue task, say); showing them repeatedly makes the queue
  // look longer than the work actually is. Keep the most severe reason.
  items.sort((x, y) => x.sev - y.sev);
  const seen = new Set();
  const deduped = [];
  for (const it of items) {
    const key = it.id || `${it.who}|${it.why}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(it);
  }
  return deduped.slice(0, 25);
}

const SALES_TONE = { rose: 'text-rose-600 dark:text-rose-400', amber: 'text-amber-600 dark:text-amber-400',
                     sky: 'text-sky-600 dark:text-sky-400', emerald: 'text-emerald-600 dark:text-emerald-400',
                     slate: 'text-slate-500 dark:text-slate-400' };

function salesAttentionRow(it) {
  const tone = SALES_TONE[it.action?.tone] || SALES_TONE.slate;
  return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <div class="min-w-0 flex-1">
      <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(it.who)}</div>
      <div class="text-[12px] ${tone} truncate">${esc(it.why)}${it.sub ? ` · <span class="text-slate-400">${esc(it.sub)}</span>` : ''}</div>
    </div>
    ${it.age ? `<div class="text-[11px] font-bold text-slate-400 tabular-nums shrink-0">${esc(it.age)}</div>` : ''}
    <button onclick="${it.action?.onclick || ''}" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition">${esc(it.action?.label || 'Open')}</button>
  </div>`;
}

function salesOppRow(c, d) {
  const na = salesNextAction(c, d);
  const appt = (d.apptByContact || {})[c.id];
  return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <button onclick="crmOpenForm('${c.id}')" class="min-w-0 flex-1 text-left">
      <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(salesName(c))}</div>
      <div class="text-[12px] text-slate-400 truncate">
        <span class="font-semibold text-slate-500 dark:text-slate-300">${esc(salesLabel(c.status))}</span>
        ${c.source ? ` · ${esc(c.source)}` : ''}${appt ? ` · appt ${esc(new Date(appt.appointment_at).toLocaleDateString())}` : ''}
        ${c.last_activity_at ? ` · ${esc(salesAge(c.last_activity_at))} ago` : ''}
      </div>
    </button>
    <button onclick="${na.onclick}" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition">${esc(na.label)}</button>
  </div>`;
}

// ── Work sub-views ───────────────────────────────────────────────────────────
const SALES_WORK_VIEWS = [
  ['opportunities', 'Opportunities'], ['appointments', 'Appointments'],
  ['customers', 'Customers'], ['deals', 'Deals'], ['deliveries', 'Deliveries'],
];

function salesWorkView(v) { __salesWorkView = v; engineTab('sales', 'work'); }
window.salesWorkView = salesWorkView;

async function salesRenderWork(body, d) {
  const nav = SALES_WORK_VIEWS.map(([id, label]) => {
    const on = __salesWorkView === id;
    return `<button onclick="salesWorkView('${id}')" class="px-3 py-1.5 rounded-lg text-[13px] font-bold transition ${on ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}">${esc(label)}</button>`;
  }).join('');

  let inner = '';
  if (__salesWorkView === 'opportunities') {
    const open = (d.contacts || []).filter(c => SALES_OPEN_STAGES.includes(c.status));
    const byStage = SALES_OPEN_STAGES.map(s => {
      const rows = open.filter(c => c.status === s);
      if (!rows.length) return '';
      return engCard(`${salesLabel(s)} (${rows.length})`, rows.slice(0, 12).map(c => salesOppRow(c, d)).join(''));
    }).join('');
    inner = byStage || engEmpty('No open opportunities.');
  } else if (__salesWorkView === 'appointments') {
    const now = Date.now(), day = 864e5;
    const buckets = [['Today', a => { const t = new Date(a.appointment_at) - now; return t > -day / 2 && t < day / 2; }],
                     ['Upcoming', a => new Date(a.appointment_at) - now >= day / 2],
                     ['Missed / no outcome', a => new Date(a.appointment_at) - now <= -day / 2 && !a.outcome]];
    inner = buckets.map(([label, fn]) => {
      const rows = (d.appointments || []).filter(fn);
      if (!rows.length) return '';
      return engCard(`${label} (${rows.length})`, rows.slice(0, 15).map(a => `
        <div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
          <div class="text-[12px] font-bold text-slate-500 tabular-nums shrink-0 w-24">${esc(new Date(a.appointment_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</div>
          <div class="min-w-0 flex-1"><div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(a.customer_name || '—')}</div>
            <div class="text-[12px] text-slate-400 truncate">${esc(a.vehicle_label || '')}${a.rep_name ? ` · ${esc(a.rep_name)}` : ''}</div></div>
          <button onclick="${a.contact_id ? `crmOpenForm('${a.contact_id}')` : `switchPage('appointments')`}" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Open Customer</button>
        </div>`).join(''));
    }).join('') || engEmpty('No appointments.');
    inner += `<div class="mt-3"><button onclick="switchPage('appointments')" class="text-[13px] font-bold text-indigo-500 hover:text-indigo-400">Open full calendar →</button></div>`;
  } else if (__salesWorkView === 'customers') {
    inner = engCard('Customers', (d.contacts || []).slice(0, 20).map(c => salesOppRow(c, d)).join('') || engEmpty('No customers yet.'))
      + `<div class="mt-3"><button onclick="switchPage('crm')" class="text-[13px] font-bold text-indigo-500 hover:text-indigo-400">Open full CRM →</button></div>`;
  } else if (__salesWorkView === 'deals') {
    const working = (d.contacts || []).filter(c => ['sold', 'fni'].includes(c.status));
    inner = engCard('Working deals', working.map(c => salesOppRow(c, d)).join('') || engEmpty('No deals in progress.'))
      + `<div class="mt-3 flex gap-3"><button onclick="switchPage('fni')" class="text-[13px] font-bold text-indigo-500 hover:text-indigo-400">F&amp;I workspace →</button></div>`;
  } else if (__salesWorkView === 'deliveries') {
    // Lazily fetched: deliveries are NOT part of the Sales landing payload.
    if (!__salesDeliveries) {
      body.innerHTML = `<div class="flex gap-1.5 mb-3">${nav}</div><div class="text-sm text-slate-400 py-10 text-center">Loading deliveries…</div>`;
      try { __salesDeliveries = await apiGetJson('/delivery/queue'); } catch { __salesDeliveries = { deals: [] }; }
    }
    const rows = __salesDeliveries.deals || __salesDeliveries.queue || [];
    inner = engCard('Delivery queue', rows.slice(0, 20).map(x => `
      <div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
        <div class="min-w-0 flex-1"><div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(x.customer_name || x.contact_name || 'Customer')}</div>
          <div class="text-[12px] text-slate-400 truncate">${esc(x.vehicle_label || [x.year, x.make, x.model].filter(Boolean).join(' '))}${x.blocker ? ` · <span class="text-rose-500">${esc(x.blocker)}</span>` : ''}</div></div>
        <button onclick="switchPage('delivery')" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Prepare Delivery</button>
      </div>`).join('') || engEmpty('Nothing awaiting delivery.'))
      + `<div class="mt-3"><button onclick="switchPage('delivery')" class="text-[13px] font-bold text-indigo-500 hover:text-indigo-400">Open delivery queue →</button></div>`;
  }
  body.innerHTML = `<div class="flex gap-1.5 mb-3 overflow-x-auto">${nav}</div>${inner}`;
}

// ── Engine registration ──────────────────────────────────────────────────────
ENGINES['sales'] = {
  rootId: 'sales-root', title: 'Sales', subtitle: 'Your customers, appointments and deals — what needs you first',
  icon: 'currency', accent: 'amber',
  tabLabels: { overview: 'My Day', work: 'Work' },

  // Role-aware tabs. A salesperson gets Today | Work; a manager also gets Insights;
  // Automation/Settings are management-only. Server authorization stays
  // authoritative — this only decides what is worth showing.
  get tabOrder() {
    const mgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
    return mgr ? ['overview', 'work', 'insights', 'automation', 'settings'] : ['overview', 'work'];
  },

  // ONE parallel round-trip for the landing view — no waterfall, and deliveries /
  // insights are deliberately excluded (they load inside their own tab).
  fetch: async () => {
    const [contacts, tasks, appts] = await Promise.all([
      apiGetJson('/crm/contacts?limit=200').catch(() => ({ contacts: [] })),
      apiGetJson('/crm/tasks?scope=open').catch(() => ({ tasks: [] })),
      apiGetJson('/appointments').catch(() => ({ appointments: [] })),
    ]);
    const d = {
      contacts: contacts.contacts || [],
      tasks: tasks.tasks || [],
      appointments: appts.appointments || [],
      isManager: typeof appts.can_manage_all === 'boolean' ? appts.can_manage_all : undefined,
    };
    d.tasksByContact = {}; d.apptByContact = {};
    for (const t of d.tasks) if (t.contact_id && !d.tasksByContact[t.contact_id]) d.tasksByContact[t.contact_id] = t;
    for (const a of d.appointments) if (a.contact_id && !d.apptByContact[a.contact_id]) d.apptByContact[a.contact_id] = a;
    __salesData = d;
    return d;
  },

  quickActions: [
    { label: '+ Customer', icon: 'user', onclick: 'crmOpenForm()' },
    { label: 'Book Appointment', icon: 'calendar', onclick: "switchPage('appointments')" },
    { label: 'Appraise Trade', icon: 'gem', onclick: "switchPage('appraisal')" },
    { label: 'Desk Deal', icon: 'currency', onclick: "switchPage('desk')" },
  ],

  nextActions: (d) => salesAttention(d || {}).slice(0, 5).map(it => ({
    label: `${it.who} — ${it.action?.label || 'Open'}`,
    icon: 'flame', tone: SALES_TONE[it.action?.tone] || SALES_TONE.slate, onclick: it.action?.onclick || '',
  })),

  tabs: {
    // ── TODAY — the operational command center, not analytics ──────────────
    overview(body, d) {
      const att = salesAttention(d);
      const now = Date.now(), day = 864e5;
      const todays = (d.appointments || []).filter(a => { const t = new Date(a.appointment_at) - now; return t > -day / 2 && t < day / 2; });
      const open = (d.contacts || []).filter(c => SALES_OPEN_STAGES.includes(c.status));
      const overdue = (d.tasks || []).filter(t => t.due_at && new Date(t.due_at) < now);
      const newLeads = (d.contacts || []).filter(c => c.status === 'uncontacted');

      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          ${engKpi('Needs attention', att.length, att.length ? 'text-rose-600 dark:text-rose-400' : '')}
          ${engKpi('New leads', newLeads.length, newLeads.length ? 'text-amber-600 dark:text-amber-400' : '')}
          ${engKpi("Today's appointments", todays.length)}
          ${engKpi('Overdue tasks', overdue.length, overdue.length ? 'text-rose-600 dark:text-rose-400' : '')}
        </div>
        ${engCard('Needs attention', att.length ? att.map(salesAttentionRow).join('') : engEmpty('Nothing needs you right now.'))}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
          ${engCard("Today's appointments", todays.length ? todays.map(a => `
            <div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
              <div class="text-[12px] font-bold text-slate-500 tabular-nums shrink-0">${esc(new Date(a.appointment_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))}</div>
              <div class="min-w-0 flex-1"><div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(a.customer_name || '—')}</div>
                <div class="text-[12px] text-slate-400 truncate">${esc(a.vehicle_label || '')}${a.rep_name ? ` · ${esc(a.rep_name)}` : ''}</div></div>
              <button onclick="${a.contact_id ? `crmOpenForm('${a.contact_id}')` : `switchPage('appointments')`}" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Open Customer</button>
            </div>`).join('') : engEmpty('No appointments today.'))}
          ${engCard('Active opportunities', open.length ? open.slice(0, 8).map(c => salesOppRow(c, d)).join('') : engEmpty('No open opportunities.'))}
        </div>`;
    },

    // ── WORK — Opportunities | Appointments | Customers | Deals | Deliveries ──
    work: salesRenderWork,

    // ── INSIGHTS — manager-focused, reuses the existing insights payload ─────
    async insights(body) {
      body.innerHTML = `<div class="text-sm text-slate-400 py-10 text-center">Loading insights…</div>`;
      let d;
      try { d = await apiGetJson('/crm/insights?range=30'); }
      catch (e) { body.innerHTML = engEmpty(`Couldn't load insights: ${esc(e.message)}`); return; }
      if (d.empty) { body.innerHTML = engEmpty('No data yet.'); return; }
      const bar = (items, labelFn) => {
        const mx = Math.max(1, ...items.map(i => i.count));
        return items.slice(0, 8).map(i => `<div class="flex items-center gap-2 text-sm py-0.5">
          <div class="w-28 shrink-0 truncate text-slate-600 dark:text-slate-300">${esc(labelFn(i))}</div>
          <div class="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden"><div class="h-full bg-amber-500 rounded-full" style="width:${Math.round((i.count / mx) * 100)}%"></div></div>
          <div class="w-8 text-right font-bold tabular-nums">${i.count}</div></div>`).join('') || engEmpty('No data in range.');
      };
      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          ${engKpi('New leads', d.leads.total)}
          ${engKpi('Pipeline', d.pipeline.total_contacts, '')}
          ${engKpi('Conversion', d.pipeline.conversion_pct + '%')}
          ${engKpi('Overdue tasks', d.tasks.overdue, d.tasks.overdue ? 'text-rose-600 dark:text-rose-400' : '')}
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
          ${engCard('Lead sources', bar(d.leads.by_source, i => i.key))}
          ${engCard('Pipeline funnel', bar(d.pipeline.funnel.map(f => ({ key: salesLabel(f.status), count: f.count })), i => i.key))}
          ${d.is_manager ? engCard('Leads by rep', bar(d.leads.per_rep, i => i.name), 'lg:col-span-2') : ''}
        </div>`;
    },

    // ── AUTOMATION — Sales-relevant workflows only; the engine stays global ──
    automation(body) {
      const items = ['New lead response', 'Lead assignment', 'No-response follow-up', 'Appointment confirmation',
                     'Appointment reminder', 'No-show follow-up', 'Sold follow-up', 'Delivery follow-up',
                     'Review request', 'Referral request', 'Equity / ownership follow-up'];
      body.innerHTML = engCard('Sales workflows',
        `<p class="text-[13px] text-slate-600 dark:text-slate-300 mb-3">These run on the shared Automation Engine — Sales does not own a separate one. Edit templates and rules in the builder.</p>
         <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3">${items.map(i => `<div class="text-[13px] text-slate-700 dark:text-slate-200 flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>${esc(i)}</div>`).join('')}</div>
         <button onclick="switchPage('automation-builder')" class="px-3 py-2 rounded-lg bg-amber-600 text-white text-sm font-bold">Open Automation Builder</button>`);
    },

    // ── SETTINGS — Sales-specific only. Global config lives in Settings/People ──
    settings(body) {
      body.innerHTML = engCard('Sales settings',
        `<p class="text-[13px] text-slate-600 dark:text-slate-300 mb-3">Lead assignment and routing rules, pipeline defaults and Sales notification behavior.</p>
         <div class="flex flex-wrap gap-2">
           <button onclick="switchPage('leads')" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold">Lead routing</button>
           <button onclick="switchPage('config')" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold">Dealership configuration</button>
         </div>
         <p class="text-[12px] text-slate-400 mt-3">API keys, billing, integrations, security and employee administration live in global Settings and People — not here.</p>`);
    },
  },
};

function loadSalesWorkspace() { renderEngine('sales'); }
window.loadSalesWorkspace = loadSalesWorkspace;
