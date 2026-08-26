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

const SALES_TONE = { rose: 'text-rose-600 dark:text-rose-400', amber: 'text-amber-600 dark:text-amber-400',
                     sky: 'text-sky-600 dark:text-sky-400', emerald: 'text-emerald-600 dark:text-emerald-400',
                     slate: 'text-slate-500 dark:text-slate-400' };

// "3h" / "2d" — compact age, or '' when unknown.
function salesAge(iso) {
  const h = salesHours(iso);
  if (h == null) return '';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

Object.assign(window, { SALES_TONE, salesLabel, salesName, salesHours, salesAge });

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
               onclick: c.phone || c.phone_mobile ? `salesCall('${id}')` : `openCrmContact('${id}')` };
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
      return { label: 'Open Customer', reason: 'Needs review', tone: 'slate', onclick: `openCrmContact('${id}')` };
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

function salesAttentionRow(it) {
  const onclick = it.id ? `openCrmContact('${it.id}')` : (it.action?.onclick || '');
  const sub = [it.why, it.sub, it.age].filter(Boolean).join(' · ');
  if (typeof pulseRow === 'function') {
    return pulseRow({ label: it.who, sub, onclick, actionLabel: it.action?.label || 'View' });
  }
  return `<div class="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-slate-100 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
    <div class="min-w-0 flex-1">
      <div class="font-bold text-[14px] text-slate-900 truncate">${esc(it.who)}</div>
      <div class="text-[12px] text-slate-500 mt-0.5 truncate">${esc(sub)}</div>
    </div>
    ${onclick ? `<button type="button" onclick="${onclick}" class="shrink-0 px-3.5 py-1.5 rounded-full border border-slate-200 text-[13px] font-semibold">View</button>` : ''}
  </div>`;
}

function salesOppRow(c, d) {
  const na = salesNextAction(c, d);
  const appt = (d.apptByContact || {})[c.id];
  const bits = [salesLabel(c.status), c.source, appt ? `appt ${new Date(appt.appointment_at).toLocaleDateString()}` : '', c.last_activity_at ? `${salesAge(c.last_activity_at)} ago` : ''].filter(Boolean);
  if (typeof pulseRow === 'function') {
    return pulseRow({ label: salesName(c), sub: bits.join(' · '), onclick: `openCrmContact('${c.id}')`, actionLabel: na.label || 'View' });
  }
  return pulseRow({ label: salesName(c), sub: bits.join(' · '), onclick: `openCrmContact('${c.id}')` });
}

Object.assign(window, { salesAttentionRow, salesOppRow });

// ── Work sub-views ───────────────────────────────────────────────────────────
function salesWorkView(v) { __salesWorkView = v; engineTab('sales', 'work'); }
window.salesWorkView = salesWorkView;


// ── My Day: the numbers that used to live behind an Insights tab ─────────────
// A metric you only see by opening another tab is a metric nobody acts on. These are the same
// /crm/insights figures, shown where the day is read. An unavailable read says so rather than
// rendering a zero that looks like a bad month.
function salesPerformanceStrip(d) {
  const i = d.insights;
  if (!i) return engCard('Last 30 days', engEmpty('Performance could not be loaded, so this day is not showing your numbers.'));
  const f = i.funnel || {};
  const stat = (label, v) => `<div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5">
    <div class="text-[11px] uppercase tracking-wide text-slate-800 dark:text-slate-200 font-black">${esc(label)}</div>
    <div class="text-xl font-black ${v == null ? 'text-slate-400' : 'text-slate-900 dark:text-white'}">${esc(v == null ? 'Unknown' : v)}</div></div>`;
  return engCard('Last 30 days', `<div class="grid grid-cols-2 md:grid-cols-4 gap-2">
    ${stat('Leads', f.leads ?? i.leads?.total ?? null)}
    ${stat('Appointments', f.appointments ?? null)}
    ${stat('Sold', f.sold ?? null)}
    ${stat('Close rate', f.leads && f.sold != null ? Math.round((f.sold / f.leads) * 100) + '%' : null)}
  </div>`);
}

// Deals and deliveries appear in BOTH My Day and Appointments — they are the same work seen
// from two angles (what is live today, and what is booked), so neither view is complete
// without them.
function salesDealsAndDeliveries(d) {
  const dealRow = (x) => `<div class="flex items-center gap-3 py-2 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <div class="min-w-0 flex-1"><div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(x.customer_name || x.contact_name || 'Deal')}</div>
    <div class="text-[12px] text-slate-400 truncate">${esc([x.vehicle_label || x.vehicle, x.status].filter(Boolean).join(' · '))}</div></div>
    <button onclick="switchPage('desk')" class="shrink-0 px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700">Open</button></div>`;
  const delRow = (x) => `<div class="flex items-center gap-3 py-2 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <div class="min-w-0 flex-1"><div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(x.customer_name || 'Delivery')}</div>
    <div class="text-[12px] text-slate-400 truncate">${esc([x.vehicle_label || x.vehicle, x.scheduled_for || x.status].filter(Boolean).join(' · '))}</div></div>
    <button onclick="switchPage('delivery')" class="shrink-0 px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700">Open</button></div>`;
  return `<div class="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
    ${engCard('Deals in progress', d.deals === null
      ? engEmpty('You do not have permission to see deals, or they could not be loaded.')
      : d.deals.length ? d.deals.slice(0, 8).map(dealRow).join('') : engEmpty('No deals in progress.'))}
    ${engCard('Deliveries', d.deliveries === null
      ? engEmpty('You do not have permission to see deliveries, or they could not be loaded.')
      : d.deliveries.length ? d.deliveries.slice(0, 8).map(delRow).join('') : engEmpty('Nothing is waiting to be delivered.'))}
  </div>`;
}

// ── Sales settings — real values, edited here ────────────────────────────────
// This tab used to be a paragraph and two buttons pointing elsewhere. Lead routing is the one
// setting Sales actually owns, so it is read and written here rather than signposted.
const SALES_ROUTING_MODES = [
  ['round_robin', 'Round robin', 'Each new lead goes to the next rep in turn.'],
  ['first_come', 'First to claim', 'Every rep sees a new lead; the first to claim it owns it.'],
  ['manager', 'Manager assigns', 'New leads wait in one queue until a manager assigns them.'],
];
async function salesSaveRouting(mode) {
  try {
    await apiSendJson('/launch/dealership', 'PATCH', { lead_routing: { mode } });
    showToast('Lead routing saved', 'success');
    ENGINE_DATA['sales'] = undefined;
    engineTab('sales', 'settings', true);
  } catch (e) { showToast(e.message, 'error'); }
}
window.salesSaveRouting = salesSaveRouting;

function salesTodayVideosCard(d) {
  const videos = (d && d.videosToday) || [];
  const rows = videos.slice(0, 5).map(v => {
    const isPlayed = !!v.first_played_at;
    const badgeTone = isPlayed ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    const statusTxt = isPlayed ? `Watched (${v.watch_percent}%)` : 'Sent (Unopened)';
    return `
      <div class="flex items-center justify-between gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(v.contact_name)}</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-black border uppercase ${badgeTone}">${statusTxt}</span>
          </div>
          <div class="text-[12px] text-slate-400 truncate mt-0.5">
            <span>${esc(v.vehicle)}</span>
            <span> · </span>
            <span class="font-mono text-indigo-500 dark:text-indigo-400">${v.channel.toUpperCase()}</span>
            <span> · ${new Date(v.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button onclick="openPublicVideoLink('${v.share_token}', '${v.contact_id}')" class="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition">Play Video</button>
          <button onclick="vidSendExistingVideo('${v.id}', '${v.channel === 'email' ? 'email' : 'sms'}')" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition">Resend</button>
        </div>
      </div>
    `;
  }).join('');

  return engCard("Today's Sent Customer Videos", `
    <div class="space-y-1">
      ${rows || engEmpty('No customer videos sent today. Record one on any CRM contact card!')}
      <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
        <span class="text-slate-400 font-medium">MarketSync Video Product Feed</span>
        <button onclick="switchPage('video-studio')" class="text-indigo-500 hover:text-indigo-400 font-bold">Open Full Video Studio -></button>
      </div>
    </div>
  `);
}
window.salesTodayVideosCard = salesTodayVideosCard;

// ── Engine registration ──────────────────────────────────────────────────────
ENGINES['sales'] = {
  rootId: 'sales-root', title: 'Sales Department', subtitle: 'Your customers, appointments and deals — what needs you first',
  icon: 'currency', accent: 'amber',
  // Right-rail Reports, specific to Sales.
  reports: [
    { label: 'Sales performance', icon: 'chart', onclick: "openDeptReport('sales')" },
    { label: 'Leads & sources', icon: 'users', onclick: "openDeptReport('leads')" },
    { label: 'Rep scorecard', icon: 'chart', onclick: "openDeptReport('reps')" },
  ],
  // Appraisals moved to Inventory > Acquire; desking is reached from the global header.
  // Sales composes operational work into the Work tab and leads with its Pulse/My Day.
  get tabOrder() { return ['overview', 'work', 'appraisals', 'equity', 'settings']; },
  get tabLabels() { return { overview: 'Pulse', work: 'Customers', appraisals: 'Appraise Trade', desk: 'Desk a Deal', equity: 'Equity Mining', settings: 'Settings' }; },
  quickActions: [
    { label: 'Sales Training (Academy)', icon: 'sparkles', onclick: "openMarketSyncAcademy('sales')" },
    { label: 'Add Customer', icon: 'user', onclick: "openCrmAddModal()" },
    { label: 'Desk a Deal', icon: 'currency', onclick: "switchPage('desk')" },
    { label: 'Appraise Trade', icon: 'currency', onclick: "switchPage('appraisal')" },
  ],

  fetch: async () => {
    const [contacts, tasks, appts, deals, deliveries, insights, gamification, videos] = await Promise.all([
      apiGetJson('/crm/contacts?mine=1&limit=30').catch(() => ({ contacts: [] })),
      apiGetJson('/crm/tasks?scope=open').catch(() => ({ tasks: [] })),
      apiGetJson('/appointments').catch(() => ({ appointments: [] })),
      apiGetJson('/fni/deals').catch(() => null),
      apiGetJson('/delivery/queue').catch(() => null),
      apiGetJson('/crm/insights?range=30').catch(() => null),
      apiGetJson('/gamification').catch(() => null),
      apiGetJson('/sales-videos').catch(() => ({ videos: [] })),
    ]);
    const d = {
      contacts: contacts.contacts || [],
      tasks: tasks.tasks || [],
      appointments: appts.appointments || [],
      isManager: typeof appts.can_manage_all === 'boolean' ? appts.can_manage_all : undefined,
      deals: deals?.deals || null,
      deliveries: deliveries?.queue || deliveries?.deliveries || null,
      insights, gamification,
    };
    d.tasksByContact = {}; d.apptByContact = {};
    for (const t of d.tasks) if (t.contact_id && !d.tasksByContact[t.contact_id]) d.tasksByContact[t.contact_id] = t;
    for (const a of d.appointments) if (a.contact_id && !d.apptByContact[a.contact_id]) d.apptByContact[a.contact_id] = a;

    // Real sent videos only — never sent, or sent on an earlier day, are excluded
    // from "today's videos" but nothing here is invented if the list is empty.
    const contactById = {}; for (const c of d.contacts) contactById[c.id] = c;
    const todayStr = new Date().toDateString();
    d.videosSent = (videos.videos || [])
      .filter(v => v.status !== 'draft' && v.status !== 'ready' && v.sent_at)
      .map(v => ({ ...v, contact_name: contactById[v.contact_id]?.full_name || 'Customer', vehicle: v.title || 'Video' }));
    d.videosToday = d.videosSent.filter(v => new Date(v.sent_at).toDateString() === todayStr);

    __salesData = d;
    return d;
  },

  quickActions: [
    { label: 'Opportunities', icon: 'flame', onclick: "engineTab('sales','overview')" },
    { label: '+ Customer', icon: 'user', onclick: 'crmOpenForm()' },
    { label: 'Book Appointment', icon: 'calendar', onclick: "switchPage('appointments')" },
    { label: 'Desk a Deal', icon: 'currency', onclick: "engineTab('sales', 'desk')" },
    { label: 'Appraise Trade', icon: 'gem', onclick: "engineTab('sales', 'appraisals')" },
    { label: 'Equity Mining', icon: 'gem', onclick: "engineTab('sales', 'equity')" },
  ],

  nextActions: (d) => salesAttention(d || {}).slice(0, 5).map(it => ({
    label: `${it.who} — ${it.action?.label || 'Open'}`,
    icon: 'flame', tone: SALES_TONE[it.action?.tone] || SALES_TONE.slate, onclick: it.action?.onclick || '',
  })),

  tabs: {
    overview(body, d) {
      const att = salesAttention(d);
      const now = Date.now();
      const today = new Date().toDateString();
      const todays = (d.appointments || []).filter(a => {
        const when = a.appointment_at || a.when || a.scheduled_at;
        return when && new Date(when).toDateString() === today && !['canceled', 'cancelled', 'no_show'].includes(String(a.status || '').toLowerCase());
      });
      const overdue = (d.tasks || []).filter(t => t.due_at && new Date(t.due_at) < now);
      const newLeads = (d.contacts || []).filter(c => c.status === 'uncontacted');

      const aiCard = pulseCard({
        title: 'Proactive sales assistant',
        tier: 'feature',
        inner: `<div class="text-[12px] text-slate-700 dark:text-slate-200 space-y-1.5 leading-relaxed">
          <p>• <strong>Needs attention:</strong> ${att.length ? `<span class="text-rose-600 dark:text-rose-400 font-bold">${att.length} item(s)</span>` : 'Clear.'}</p>
          <p>• <strong>New leads:</strong> ${newLeads.length ? `${newLeads.length} uncontacted` : 'None waiting.'}</p>
          <p>• <strong>Today's appointments:</strong> ${todays.length}</p>
          <p>• <strong>Overdue tasks:</strong> ${overdue.length ? `<span class="text-rose-600 dark:text-rose-400 font-bold">${overdue.length}</span>` : 'None.'}</p>
        </div>
        <div class="flex flex-wrap gap-2 mt-3">
          <button type="button" onclick="engineTab('sales','work')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900">Prioritize work</button>
          <button type="button" onclick="engineTab('sales','desk')" class="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700">Review deals</button>
        </div>`,
      });

      const cards = [
        pulseCard({
          title: 'Needs attention', count: att.length,
          tone: att.length ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300' : '',
          tier: att.length ? 'hero' : 'standard',
          inner: att.length ? att.slice(0, 8).map(salesAttentionRow).join('') : '',
          empty: 'Nothing needs you right now.',
        }),
        pulseCard({
          title: 'Deals in progress', count: d.deals == null ? '—' : d.deals.length,
          tier: (d.deals && d.deals.length) ? 'feature' : 'standard',
          onclick: "engineTab('sales','desk')",
          inner: d.deals == null ? '' : (d.deals || []).slice(0, 6).map(x => {
            const customer = x.customer_name || x.contact_name;
            const vehicle = x.vehicle_label || x.vehicle;
            return pulseRow({
              badge: '$', label: customer || vehicle || 'Deal',
              sub: customer ? [vehicle, x.status].filter(Boolean).join(' · ') : x.status || '',
              onclick: "switchPage('desk')",
            });
          }).join(''),
          empty: d.deals == null ? 'No permission to view deals.' : 'No deals in progress.',
        }),
        pulseCard({
          title: "Today's appointments", count: todays.length,
          tier: todays.length ? 'feature' : 'standard',
          onclick: "engineTab('sales','appointments')",
          inner: todays.length ? todays.slice(0, 6).map(a => pulseRow({
            badge: new Date(a.appointment_at || a.when || a.scheduled_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
            label: a.customer_name || '—',
            sub: [a.vehicle_label, a.rep_name].filter(Boolean).join(' · '),
            onclick: a.contact_id ? `openCrmContact('${a.contact_id}')` : "engineTab('sales','appointments')",
          })).join('') : '',
          empty: 'No appointments today.',
        }),
        pulseCard({
          title: 'New leads', count: newLeads.length,
          tier: 'standard',
          onclick: "engineTab('sales','work')",
          inner: newLeads.length ? newLeads.slice(0, 5).map(c => pulseRow({
            badge: '•', label: c.full_name || c.name || 'Lead', sub: c.status || '',
            onclick: c.id ? `openCrmContact('${c.id}')` : "engineTab('sales','work')",
          })).join('') : '',
          empty: 'No uncontacted leads.',
        }),
        pulseCard({
          title: 'Overdue tasks', count: overdue.length,
          tone: overdue.length ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300' : '',
          tier: 'standard',
          onclick: "engineTab('sales','work')",
          inner: overdue.length ? overdue.slice(0, 5).map(t => pulseRow({
            badge: '!', label: t.title || t.type || 'Task',
            sub: t.due_at ? new Date(t.due_at).toLocaleDateString() : '',
            onclick: "engineTab('sales','work')",
          })).join('') : '',
          empty: 'No overdue tasks.',
        }),
        aiCard,
      ].filter(Boolean);

      body.innerHTML = `
        ${pulseHeader('Sales Pulse', 'Customers, appointments and deals — what needs you first')}
        ${pulseBoard(cards)}
        ${typeof pulseDeptLeaderboard === 'function' ? pulseDeptLeaderboard(d.gamification, 'sales', { title: 'Sales leaderboard', metric: 'deals_sold' }) : ''}
        ${typeof pulseDeptLeaderboard === 'function' ? pulseDeptLeaderboard(d.gamification, 'facebook', { title: 'Facebook Marketplace', metric: 'score' }) : ''}
      `;
    },

    work(body, d) {
      const list = d.contacts || [];
      const row = (c) => {
        const name = c.full_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Customer';
        const loc = [c.address, c.city, c.province, c.postal_code, c.country].filter(Boolean).join(' · ');
        const bits = [c.email, c.phone || c.phone_mobile, loc].filter(Boolean).join(' · ');
        return `<button type="button" onclick="openCrmContact('${c.id}')" class="w-full text-left px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition">
          <div class="font-bold text-base text-slate-900 dark:text-white">${esc(name)}</div>
          <div class="text-sm text-slate-600 dark:text-slate-400 truncate">${esc(bits || 'No contact details')}</div>
        </button>`;
      };
      body.innerHTML = `
        ${typeof pulseHeader === 'function' ? pulseHeader('Customers', 'Your newest records. Search the store for anyone else.') : '<h1 class="text-2xl font-black mb-3">Customers</h1>'}
        <div class="ms-c ms-c--glass p-4 mb-4">
          <label for="sales-cust-q" class="block text-base font-black text-slate-900 dark:text-white mb-2">Search customers</label>
          <div class="flex flex-col sm:flex-row gap-2">
            <input id="sales-cust-q" type="search" placeholder="First name, last name, email, or phone" class="flex-1 min-w-0 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 text-base font-semibold text-slate-900 dark:text-white">
            <button type="button" id="sales-cust-go" class="liquid-glass-btn rounded-xl text-base font-black px-5 py-3 shrink-0">Search</button>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
            <input id="sales-cust-address" type="search" placeholder="Street / city" class="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2.5 text-base font-semibold text-slate-900 dark:text-white">
            <input id="sales-cust-province" type="search" placeholder="Province / state" class="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2.5 text-base font-semibold text-slate-900 dark:text-white">
            <input id="sales-cust-postal" type="search" placeholder="Postal / ZIP" class="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2.5 text-base font-semibold text-slate-900 dark:text-white">
            <input id="sales-cust-country" type="search" placeholder="Country" class="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2.5 text-base font-semibold text-slate-900 dark:text-white">
          </div>
        </div>
        <div id="sales-cust-results" class="ms-c ms-c--glass overflow-hidden">
          ${list.length ? list.map(row).join('') : '<div class="p-6 text-base text-slate-600">No recent customers of yours yet. Search the store above.</div>'}
        </div>`;
      window.__salesCustomerRow = row;
      const bind = (id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); salesSearchCustomers(); } });
      };
      ['sales-cust-q','sales-cust-address','sales-cust-province','sales-cust-postal','sales-cust-country'].forEach(bind);
      document.getElementById('sales-cust-go')?.addEventListener('click', () => salesSearchCustomers());
    },

    desk(body, d) {
      if (typeof engMountPage === 'function') {
        engMountPage(body, 'desk', () => {
          if (typeof loadDeskDeal === 'function') loadDeskDeal();
        });
      } else {
        body.innerHTML = engCard('Desk a Deal', `<div class="p-4 text-center"><button onclick="switchPage('desk')" class="px-4 py-2 font-bold bg-amber-600 text-white rounded-lg">Open Desking Tool</button></div>`);
      }
    },

    // ── TRADE APPRAISALS & CAR APPRAISAL TOOL ──────────────────────────────────
    appraisals(body, d) {
      if (typeof engMountPage === 'function') {
        engMountPage(body, 'appraisal', () => {
          if (typeof initAppraisal === 'function') initAppraisal();
          if (typeof loadApprList === 'function') loadApprList();
          if (typeof apprEnsureBranding === 'function') apprEnsureBranding();
        });
      } else {
        body.innerHTML = engCard('Trade Appraisals', `<div class="p-4 text-center"><button onclick="switchPage('appraisal')" class="px-4 py-2 font-bold bg-amber-600 text-white rounded-lg">Appraise a Car / View Trade Appraisals</button></div>`);
      }
    },
    appraisal(body, d) {
      this.appraisals(body, d);
    },

    // ── APPOINTMENTS — promoted out of a sub-view ───────────────────────────
    // It was one of five tabs inside Work. Booking and arrival is a top-level part of a
    // salesperson's day, not something to find two clicks in.
    appointments(body, d) {
      const now = Date.now(), day = 864e5;
      const appts = [...(d.appointments || [])].sort((a, b) => new Date(a.appointment_at) - new Date(b.appointment_at));
      const upcoming = appts.filter(a => new Date(a.appointment_at) >= now - day / 2);
      const past = appts.filter(a => new Date(a.appointment_at) < now - day / 2);

      const row = (a) => {
        const when = new Date(a.appointment_at);
        const today = Math.abs(when - now) < day / 2;
        return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
          <div class="shrink-0 text-[12px] font-bold tabular-nums ${today ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}">${esc(when.toLocaleDateString([], { month: 'short', day: 'numeric' }))} ${esc(when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))}</div>
          <div class="min-w-0 flex-1"><div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(a.customer_name || '—')}</div>
          <div class="text-[12px] text-slate-400 truncate">${esc([a.appointment_type, a.status].filter(Boolean).join(' · '))}</div></div>
          <button onclick="switchPage('appointments')" class="shrink-0 px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700">Open</button>
        </div>`;
      };

      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          ${engKpi('Upcoming', upcoming.length)}
          ${engKpi('Today', appts.filter(a => Math.abs(new Date(a.appointment_at) - now) < day / 2).length)}
          ${engKpi('Deals in progress', d.deals === null ? '—' : d.deals.length)}
          ${engKpi('Deliveries', d.deliveries === null ? '—' : d.deliveries.length)}
        </div>
        ${engCard('Upcoming appointments', upcoming.length ? upcoming.slice(0, 20).map(row).join('') : engEmpty('Nothing booked.'))}
        ${salesDealsAndDeliveries(d)}
        ${past.length ? `<div class="mt-3">${engCard('Recent', past.slice(-8).reverse().map(row).join(''))}</div>` : ''}
      `;
    },

    // ── SETTINGS — the settings themselves, not links to them ───────────────
    // Also absorbs the former Automation tab: there is ONE workflow engine, so which Sales
    // workflows run is configuration, not a department surface of its own.
    // Equity Mining is the equity page itself, moved in.
    equity(body) {
      body.innerHTML = '';
      engMountPage(body, 'equity', () => loadEquityPage());
    },

    settings(body, d) {
      const routing = d.insights?.lead_routing || window.__salesRouting || null;
      const current = routing?.mode || null;

      const modeRow = ([mode, label, why]) => `<button onclick="salesSaveRouting('${mode}')"
        class="w-full text-left flex items-start gap-3 py-3 border-t border-slate-100 dark:border-slate-800/60 first:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50">
        <span class="mt-0.5 w-4 h-4 shrink-0 rounded-full border-2 ${current === mode ? 'border-amber-500 bg-amber-500' : 'border-slate-300 dark:border-slate-600'}"></span>
        <span class="min-w-0 flex-1"><span class="block font-bold text-[13px] text-slate-900 dark:text-white">${esc(label)}</span>
        <span class="block text-[12px] text-slate-500 dark:text-slate-400">${esc(why)}</span></span>
      </button>`;

      const workflows = ['New lead response', 'Lead assignment', 'No-response follow-up', 'Appointment confirmation',
        'Appointment reminder', 'No-show follow-up', 'Sold follow-up', 'Delivery follow-up',
        'Review request', 'Referral request', 'Equity / ownership follow-up'];

      body.innerHTML = `
        ${engCard('Lead routing', `
          <p class="text-[12px] text-slate-500 mb-1">Who a new lead goes to. ${current ? '' : '<b>Not set</b> — new leads currently land in one shared queue.'}</p>
          ${SALES_ROUTING_MODES.map(modeRow).join('')}
        `)}
        <div class="mt-3"></div>
        ${engCard('Sales workflows', `
          <p class="text-[12px] text-slate-500 mb-2">These run on the shared Automation Engine. Sales does not own a separate one — editing a template here edits it everywhere.</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3">${workflows.map(i => `<div class="text-[13px] text-slate-700 dark:text-slate-200 flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>${esc(i)}</div>`).join('')}</div>
          <button onclick="switchPage('automation-builder')" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[13px] font-bold">Edit workflow templates</button>
        `)}
        <p class="text-[12px] text-slate-400 px-1 mt-3">API keys, billing, integrations, security and employee administration live in global Settings and People — not here.</p>
      `;
    },
  },
};

function loadSalesWorkspace() { renderEngine('sales'); }
window.loadSalesWorkspace = loadSalesWorkspace;


async function salesSearchCustomers() {
  const q = document.getElementById('sales-cust-q')?.value.trim() || '';
  const address = document.getElementById('sales-cust-address')?.value.trim() || '';
  const province = document.getElementById('sales-cust-province')?.value.trim() || '';
  const postal = document.getElementById('sales-cust-postal')?.value.trim() || '';
  const country = document.getElementById('sales-cust-country')?.value.trim() || '';
  const box = document.getElementById('sales-cust-results');
  if (!box) return;
  box.innerHTML = '<div class="p-6 text-sm text-slate-500">Searching…</div>';
  const params = new URLSearchParams({ limit: '50' });
  if (q) params.set('q', q);
  if (address) params.set('address', address);
  if (province) params.set('province', province);
  if (postal) params.set('postal', postal);
  if (country) params.set('country', country);
  if (!q && !address && !province && !postal && !country) params.set('mine', '1');
  try {
    const d = await apiGetJson(`/crm/contacts?${params.toString()}`);
    const rows = d.contacts || [];
    const row = window.__salesCustomerRow || ((c) => `<div class="px-4 py-3 text-sm">${esc(c.full_name || '')}</div>`);
    box.innerHTML = rows.length ? rows.map(row).join('') : '<div class="p-6 text-sm text-slate-500">No matching customers.</div>';
  } catch (e) {
    box.innerHTML = `<div class="p-6 text-sm text-rose-500">${esc(e.message || 'Search failed')}</div>`;
  }
}
window.salesSearchCustomers = salesSearchCustomers;
