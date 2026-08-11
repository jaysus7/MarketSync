/**
 * People — the department's operating surface (Phase 7 PR 7.7).
 *
 * People was the last department with real capabilities and no workspace: the team directory,
 * the time clock, compliance coverage and the employee lifecycle all worked and none of them
 * had a screen that led with what needs attention today.
 *
 * It composes, it does not derive. Every number here comes from the endpoint that owns it —
 * `/my-day` for attention, `/hr/team` for the directory, `/hr/compliance` for coverage. A
 * second opinion about whether somebody is behind on training would drift from the department
 * that owns the fact, and then two screens would disagree about the same person.
 *
 * Two honesty rules carried from the backend:
 *
 *   • A login with no employment record is SHOWN, flagged, not hidden. A person who can sign
 *     in and does not appear in their own team list is how a dealership loses track of who
 *     works there.
 *   • Compliance reports coverage, not just counts. All zeros with nothing measured is not a
 *     clean bill of health, and this screen says which it is.
 */

const PPL_TONE = { 3: 'text-rose-600 dark:text-rose-400', 2: 'text-amber-600 dark:text-amber-400', 1: 'text-emerald-600 dark:text-emerald-400' }

// Storage states are written for a database, not for somebody standing at a desk.
const PPL_STATUS = {
  invited: 'Invited', active: 'Active', on_leave: 'On leave',
  suspended: 'Suspended', terminated: 'No longer here',
}
const pplStatus = (s) => PPL_STATUS[s] || (s ? String(s).replace(/_/g, ' ') : 'Unknown')

function pplAttentionRow(x) {
  return `<div class="py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <div class="font-bold text-[13px] text-slate-900 dark:text-white">${esc(x.subject || x.kind)}</div>
    <div class="text-[12px] text-slate-400">${esc(x.reason || '')}</div>
    <div class="text-[12px] font-semibold mt-0.5 ${PPL_TONE[x.severity] || ''}">${esc(x.action || 'Review')}${x.source_label ? ` · ${esc(x.source_label)}` : ''}</div>
  </div>`
}

function pplPersonRow(p) {
  const missingEmployment = p.has_employment === false
  const account = p.account_status || (p.has_account ? (p.can_sign_in ? 'Active' : 'Paused') : 'Not invited')
  const training = p.training_status
  const trainingLabel = !training ? 'Unavailable'
    : training.overdue ? `${training.overdue} overdue`
      : training.total ? `${training.completed}/${training.total} complete` : 'Not assigned'
  // The whole row opens the person. HR's first question about anybody is "show me
  // everything", and that should not be a hunt for a link.
  return `<div onclick="pplOpenPerson('${p.staff_member_id || p.id || ''}')" role="button" tabindex="0"
    class="grid grid-cols-1 md:grid-cols-[minmax(12rem,2fr)_repeat(4,minmax(7rem,1fr))] gap-2 md:gap-3 py-3 border-t border-slate-100 dark:border-slate-800/60 first:border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
    <div class="min-w-0 flex-1">
      <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(p.name || p.email || 'Unnamed')}</div>
      <div class="text-[12px] text-slate-400 truncate">${esc([p.job_title || p.login_role, p.department, p.location_name].filter(Boolean).join(' · '))}</div>
      ${missingEmployment ? '<div class="text-[12px] text-amber-600 dark:text-amber-400">Can sign in, but has no employment record</div>' : ''}
    </div>
    <div><div class="text-[10px] uppercase tracking-wide text-slate-400">Employment</div><div class="text-[12px] font-bold ${missingEmployment ? 'text-amber-600 dark:text-amber-400' : p.employment_status === 'active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}">${esc(missingEmployment ? 'Missing' : pplStatus(p.employment_status))}</div></div>
    <div><div class="text-[10px] uppercase tracking-wide text-slate-400">Account</div><div class="text-[12px] font-bold ${account === 'Active' ? 'text-emerald-600 dark:text-emerald-400' : account === 'Not invited' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}">${esc(account)}</div></div>
    <div><div class="text-[10px] uppercase tracking-wide text-slate-400">Training</div><div class="text-[12px] font-semibold ${training?.overdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'}">${esc(trainingLabel)}</div></div>
    <div><div class="text-[10px] uppercase tracking-wide text-slate-400">Manager / start</div><div class="text-[12px] text-slate-600 dark:text-slate-300">${esc(p.manager_name || 'Not assigned')}</div><div class="text-[11px] text-slate-400">${esc(p.start_date ? `Started ${p.start_date}` : 'Start date not recorded')}</div></div>
  </div>`
}

ENGINES['people-overview'] = {
  rootId: 'people-overview-root', title: 'HR',
  subtitle: 'Who works here, what they owe, and what is not being measured',
  icon: 'user', accent: 'emerald',
  // Team is Staff — the people, not an abstraction. Settings is HR's own configuration.
  tabLabels: { overview: 'My Day', work: 'Staff', insights: 'Compliance', settings: 'Settings' },
  get tabOrder() {
    const mgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role)
    return mgr ? ['overview', 'work', 'insights', 'settings'] : ['overview', 'work', 'insights']
  },

  quickActions: [
    { label: 'Staff', icon: 'user', onclick: "engineTab('people-overview','work')" },
    { label: 'Compliance', icon: 'shield', onclick: "engineTab('people-overview','insights')" },
    { label: 'Academy', icon: 'sparkles', onclick: "switchPage('academy')" },
  ],
  nextActions: (d) => (d?.needsAttention || []).slice(0, 5).map(x => ({
    label: `${x.subject} — ${x.action}`, icon: 'flame',
    tone: PPL_TONE[x.severity] || PPL_TONE[2],
    onclick: "engineTab('people-overview','overview')",
  })),

  fetch: async () => {
    // Each read fails on its own. Somebody without compliance permission still gets their team.
    const [day, team, compliance, policies, templates] = await Promise.all([
      apiGetJson('/my-day').catch(() => ({ needs_attention: [], failed: [{ source: 'my-day', label: 'My Day', reason: 'could not be loaded' }], not_covered: [] })),
      apiGetJson('/hr/team').catch(() => ({ team: [] })),
      apiGetJson('/hr/compliance').catch(() => null),
      apiGetJson('/hr/policies').catch(() => null),
      apiGetJson('/hr/lifecycle/templates').catch(() => null),
    ])
    // People's own sources, not the whole store's day — this is the People screen.
    const mine = ['people', 'academy', 'time', 'compliance', 'setup']
    return {
      needsAttention: (day.needs_attention || []).filter(x => mine.includes(x.source)),
      allAttention: day.needs_attention || [],
      dayFailed: day.failed || [],
      team: team.team || [],
      compliance,
      // null means "could not read", which Settings renders differently from "none".
      policies: policies ? (policies.policies || []) : null,
      lifecycleTemplates: templates ? (templates.templates || []) : null,
    }
  },

  tabs: {
    overview(body, d) {
      const team = d.team || []
      const unlinked = team.filter(p => p.has_employment === false).length
      const items = d.needsAttention || []

      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          ${engKpi('People', team.length)}
          ${engKpi('Needs attention', items.length, items.length ? 'text-amber-600 dark:text-amber-400' : '')}
          ${engKpi('Not linked', unlinked, unlinked ? 'text-amber-600 dark:text-amber-400' : '')}
          ${engKpi('Active', team.filter(p => p.employment_status === 'active').length)}
        </div>
        ${(d.dayFailed || []).length ? engCard('Could not be loaded', (d.dayFailed).map(f =>
          `<div class="py-1.5 text-[13px] text-rose-600 dark:text-rose-400">${esc(f.label)} — ${esc(f.reason)}</div>`).join('')) : ''}
        ${engCard('Needs attention', items.length
          ? items.map(pplAttentionRow).join('')
          : engEmpty('Nothing in People needs you right now.'))}
      `
    },

    work(body, d) {
      const team = d.team || []
      const unlinked = team.filter(p => p.has_employment === false)
      const rest = team.filter(p => p.has_employment !== false)
      body.innerHTML = `
        ${unlinked.length ? engSection('Can sign in, but not on the staff list', engCard('', `
          <p class="text-[12px] text-slate-500 mb-1">These logins have no employment record. Until they do, nothing can be assigned to them and they appear in no report.</p>
          ${unlinked.map(pplPersonRow).join('')}
        `), 'Fix these first — they are invisible to every other screen') : ''}
        ${engSection('Staff', engCard('', rest.length ? rest.map(pplPersonRow).join('') : engEmpty('Nobody has an employment record yet.')),
          'Open anybody to see their whole record')}
      `
    },

    insights(body, d) {
      const c = d.compliance
      if (!c) {
        body.innerHTML = engCard('Compliance', engEmpty('You do not have permission to see compliance.'))
        return
      }
      const cov = c.coverage || {}
      const areas = cov.areas || []
      body.innerHTML = `
        ${cov.headline ? `<div class="rounded-xl border ${cov.fully_measured ? 'border-emerald-300/60 dark:border-emerald-800/50' : 'border-amber-300/60 dark:border-amber-700/50 bg-amber-50/60 dark:bg-amber-950/20'} p-3">
          <div class="text-[13px] font-bold ${cov.fully_measured ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}">${esc(cov.headline)}</div>
        </div>` : ''}
        ${engCard('What is being measured', areas.length ? areas.map(a => `
          <div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
            <div class="min-w-0 flex-1">
              <div class="font-bold text-[13px] text-slate-900 dark:text-white">${esc(a.label)}</div>
              <div class="text-[12px] text-slate-400">${esc(a.means)}</div>
            </div>
            <div class="shrink-0 text-[12px] font-bold ${a.measured ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}">${a.measured ? 'Measured' : 'No records'}</div>
          </div>`).join('') : engEmpty('No coverage answer was returned.'))}
        ${engCard('Per employee', (c.rows || []).length ? (c.rows).map(r => `
          <div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
            <div class="min-w-0 flex-1">
              <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(r.name)}</div>
              <div class="text-[12px] text-slate-400">${esc([r.department, r.job_title].filter(Boolean).join(' · '))}</div>
            </div>
            <div class="shrink-0 text-[12px] font-bold ${(r.overdue_training_count || r.overdue_policy_count || r.expired_certification_count) ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}">
              ${esc([
                r.overdue_training_count ? `${r.overdue_training_count} training` : '',
                r.overdue_policy_count ? `${r.overdue_policy_count} policy` : '',
                r.expired_certification_count ? `${r.expired_certification_count} expired` : '',
              ].filter(Boolean).join(' · ') || 'Clear')}
            </div>
          </div>`).join('') : engEmpty('No employees to report on yet.'))}
      `
    },
    settings: pplRenderSettings,
  },
}


// ══ The person ═══════════════════════════════════════════════════════════════
// Everything on record about one employee, from GET /hr/employees/:id/dossier — one
// server read rather than the screen fetching eight things and cross-joining them in
// the browser, which is how two screens end up disagreeing about the same person.
//
// The rule this modal will not break: a section that could NOT be read renders
// differently from a section that is empty. "No training completed" and "training
// could not be loaded" mean opposite things to somebody about to have a conversation
// with an employee.

let __pplPerson = null;      // the open dossier
let __pplPanel = null;       // the overlay panel it is drawn into
let __pplTab = 'summary';

const PPL_MODAL_TABS = [
  ['summary', 'Summary'], ['training', 'Training'], ['policies', 'Signed'],
  ['standing', 'Standing'], ['details', 'Details'],
];

async function pplOpenPerson(staffId) {
  if (!staffId) { showToast('That row has no employment record to open yet.', 'error'); return; }
  __pplTab = 'summary';
  const el = crmOverlay(`<div class="p-6"><div class="text-sm text-slate-400 py-10 text-center">Loading the employee record…</div></div>`, 'max-w-4xl');
  __pplPanel = el.firstElementChild;
  try {
    const r = await apiGetJson(`/hr/employees/${staffId}/dossier`);
    __pplPerson = r.dossier;
  } catch (e) {
    __pplPanel.innerHTML = `<div class="p-6">${engEmpty(`Couldn't open that employee: ${e?.message || e}`)}</div>`;
    return;
  }
  pplRenderPerson();
}
window.pplOpenPerson = pplOpenPerson;

function pplPersonTab(t) { __pplTab = t; pplRenderPerson(); }
window.pplPersonTab = pplPersonTab;

function pplRenderPerson() {
  const d = __pplPerson;
  const panel = __pplPanel;
  // The overlay can have been closed between the fetch starting and finishing.
  if (!d || !panel || !panel.isConnected) return;
  const p = d.person;
  const nav = PPL_MODAL_TABS.map(([id, label]) => {
    const on = __pplTab === id;
    return `<button onclick="pplPersonTab('${id}')" class="px-3 py-2 -mb-px border-b-2 text-[13px] font-bold whitespace-nowrap transition ${on ? 'border-current text-slate-900 dark:text-white' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}">${esc(label)}</button>`;
  }).join('');

  panel.innerHTML = `
    <div class="flex items-start gap-3 p-5 pb-0">
      <div class="min-w-0 flex-1">
        <div class="text-lg font-black text-slate-900 dark:text-white truncate">${esc(p.name || 'Employee')}</div>
        <div class="text-[12px] text-slate-400 truncate">${esc([p.job_title, p.department, p.location_name].filter(Boolean).join(' · ') || 'No role recorded')}</div>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">${esc(pplStatus(p.employment_status))}</span>
          ${p.employee_number ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">#${esc(p.employee_number)}</span>` : ''}
          ${p.user_id ? '' : '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300">No login linked</span>'}
        </div>
      </div>
      <button onclick="this.closest('.fixed').remove()" class="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="Close">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
    ${(d.unavailable || []).length ? `<div class="mx-5 mt-3 rounded-xl border border-amber-300/70 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5">
      <div class="text-[12px] font-bold text-amber-900 dark:text-amber-200">This record is incomplete.</div>
      <div class="text-[11px] text-amber-700 dark:text-amber-400">${esc(d.unavailable.join(' · '))}</div>
    </div>` : ''}
    <div class="px-5 mt-3 flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">${nav}</div>
    <div class="p-5 max-h-[65vh] overflow-y-auto">${pplModalBody(d)}</div>`;
}

function pplModalBody(d) {
  if (__pplTab === 'training') return pplTrainingPanel(d);
  if (__pplTab === 'policies') return pplSignedPanel(d);
  if (__pplTab === 'standing') return pplStandingPanel(d);
  if (__pplTab === 'details') return pplDetailsPanel(d);
  return pplSummaryPanel(d);
}

// A list that knows the difference between empty and unreadable.
function pplList(sec, emptyMsg, rowFn) {
  if (sec.items == null) return `<div class="text-[13px] text-amber-600 dark:text-amber-400 py-3">${esc(sec.unavailable || 'This could not be loaded.')}</div>`;
  if (!sec.items.length) return engEmpty(emptyMsg);
  return sec.items.map(rowFn).join('');
}

const pplDate = (v) => v ? new Date(v).toLocaleDateString() : '—';

function pplSummaryPanel(d) {
  const t = d.training, c = d.certifications, po = d.policies, lc = d.lifecycle;
  const count = (sec, fn) => sec.items == null ? '—' : sec.items.filter(fn).length;
  const onboarding = lc.items == null ? null
    : { done: lc.items.filter(x => x.status === 'complete').length, total: lc.items.length };

  return `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      ${engKpi('Training done', count(t, x => !!x.completed_at))}
      ${engKpi('Overdue', count(t, x => x.overdue), count(t, x => x.overdue) ? 'text-rose-600 dark:text-rose-400' : '')}
      ${engKpi('Certifications', count(c, () => true))}
      ${engKpi('Onboarding', onboarding ? `${onboarding.done}/${onboarding.total}` : '—')}
    </div>

    ${engCard('What we would do next', (d.recommendations || []).map(r => `
      <div class="py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
        <div class="font-bold text-[13px] ${r.severity >= 3 ? 'text-rose-600 dark:text-rose-400' : r.severity === 2 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}">${esc(r.headline)}</div>
        <div class="text-[12px] text-slate-500 dark:text-slate-400">${esc(r.why)}</div>
        <div class="text-[12px] text-slate-600 dark:text-slate-300 mt-0.5">${esc(r.action)}</div>
        <div class="text-[11px] text-slate-400 mt-0.5">Based on: ${esc(r.basis)}</div>
      </div>`).join(''))}
    <p class="text-[11px] text-slate-400 mt-2">Every line above names the records it came from. There is no employee score here — a number nobody can explain is not something to make a decision about a person with.</p>

    <div class="mt-4">${engCard('Onboarding', pplList(lc, 'No onboarding tasks were ever assigned.', x => `
      <div class="flex items-center gap-3 py-2 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
        <div class="min-w-0 flex-1">
          <div class="font-semibold text-[13px] text-slate-800 dark:text-slate-100 truncate">${esc(x.title)}</div>
          <div class="text-[12px] text-slate-400">${esc(x.category || '')}${x.due_on ? ` · due ${esc(pplDate(x.due_on))}` : ''}${x.blocked_reason ? ` · <span class="text-rose-500">${esc(x.blocked_reason)}</span>` : ''}</div>
        </div>
        <div class="shrink-0 text-[12px] font-bold ${x.status === 'complete' ? 'text-emerald-600 dark:text-emerald-400' : x.status === 'blocked' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}">${esc(x.status || 'open')}</div>
      </div>`))}</div>`;
}

function pplTrainingPanel(d) {
  return `
    ${engCard('Training', pplList(d.training, 'No training has ever been assigned to this employee.', x => `
      <div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
        <div class="min-w-0 flex-1">
          <div class="font-semibold text-[13px] text-slate-800 dark:text-slate-100 truncate">${esc(x.title)}</div>
          <div class="text-[12px] text-slate-400">${esc(x.category || 'Course')}${x.due_at ? ` · due ${esc(pplDate(x.due_at))}` : ''}${x.score != null ? ` · scored ${esc(String(x.score))}` : ''}</div>
        </div>
        <div class="shrink-0 text-right">
          <div class="text-[12px] font-bold ${x.completed_at ? 'text-emerald-600 dark:text-emerald-400' : x.overdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}">${x.completed_at ? `Completed ${esc(pplDate(x.completed_at))}` : x.overdue ? 'Overdue' : `${x.progress_percent ?? 0}%`}</div>
          ${x.verification_status ? `<div class="text-[11px] text-slate-400">${esc(x.verification_status)}</div>` : ''}
        </div>
      </div>`))}
    <div class="mt-4">${engCard('Certifications', pplList(d.certifications, 'No certification has ever been issued to this employee.', c => {
      const expired = c.expires_on && new Date(c.expires_on) < new Date();
      return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
        <div class="min-w-0 flex-1">
          <div class="font-semibold text-[13px] text-slate-800 dark:text-slate-100 truncate">${esc(c.certification_name || c.certification_key || 'Certification')}</div>
          <div class="text-[12px] text-slate-400 truncate">${esc([c.issuer, c.certificate_number, c.source].filter(Boolean).join(' · '))}</div>
          <div class="text-[12px] text-slate-400">Issued ${esc(pplDate(c.issued_on))}${c.expires_on ? ` · ${expired ? '<span class="text-rose-500 font-semibold">expired</span>' : 'expires'} ${esc(pplDate(c.expires_on))}` : ''}</div>
        </div>
        <div class="shrink-0 text-[12px] font-bold ${expired ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}">${esc(c.status || (expired ? 'expired' : 'valid'))}</div>
      </div>`;
    }))}</div>`;
}

function pplSignedPanel(d) {
  return `
    ${engCard('Signed policies and contracts', pplList(d.policies, 'Nothing has ever been sent to this employee to sign.', a => {
      const signed = a.status === 'acknowledged' && a.acknowledged_at;
      return `<div class="py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
        <div class="flex items-center gap-3">
          <div class="min-w-0 flex-1">
            <div class="font-semibold text-[13px] text-slate-800 dark:text-slate-100 truncate">${esc(a.title)}${a.version_number ? ` <span class="text-slate-400 font-normal">v${esc(String(a.version_number))}</span>` : ''}</div>
            <div class="text-[12px] text-slate-400">${esc(a.category || 'Policy')}${a.due_at ? ` · due ${esc(pplDate(a.due_at))}` : ''}</div>
          </div>
          <div class="shrink-0 text-[12px] font-bold ${signed ? 'text-emerald-600 dark:text-emerald-400' : a.waived_at ? 'text-slate-400' : 'text-rose-600 dark:text-rose-400'}">${signed ? `Signed ${esc(pplDate(a.acknowledged_at))}` : a.waived_at ? 'Waived' : 'Not signed'}</div>
        </div>
        ${a.acknowledged_checksum_sha256 ? `<div class="text-[11px] text-slate-400 mt-0.5 font-mono truncate">Signed against document ${esc(a.acknowledged_checksum_sha256.slice(0, 16))}… — this is the exact version they agreed to</div>` : ''}
        ${a.waiver_reason ? `<div class="text-[11px] text-slate-400 mt-0.5">Waived: ${esc(a.waiver_reason)}</div>` : ''}
      </div>`;
    }))}
    <div class="mt-4">${engCard('Documents on file', pplList(d.documents, 'No documents are on file for this employee.', doc => `
      <div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
        <div class="min-w-0 flex-1">
          <div class="font-semibold text-[13px] text-slate-800 dark:text-slate-100 truncate">${esc(doc.title || doc.document_type)}</div>
          <div class="text-[12px] text-slate-400">${esc(doc.document_type || '')} · added ${esc(pplDate(doc.created_at))}${doc.expires_on ? ` · expires ${esc(pplDate(doc.expires_on))}` : ''}${doc.employee_visible ? '' : ' · not visible to them'}</div>
        </div>
        <div class="shrink-0 text-[12px] font-bold text-slate-400">${esc(doc.status || '')}</div>
      </div>`))}</div>`;
}

function pplStandingPanel(d) {
  const s = d.standing || {};
  const board = (title, sub, body) => engCard(title, `<p class="text-[12px] text-slate-400 mb-2">${esc(sub)}</p>${body}`);
  const stat = (label, v) => `<div><div class="text-[11px] uppercase tracking-wide text-slate-400 font-bold">${esc(label)}</div><div class="text-lg font-black text-slate-900 dark:text-white">${esc(String(v))}</div></div>`;

  return `
    ${s.unavailable ? `<div class="mb-3 text-[13px] text-amber-600 dark:text-amber-400">${esc(s.unavailable)}</div>` : ''}
    ${board('Internal — this dealership', 'Won customers attributed to them here.',
      s.internal ? `<div class="grid grid-cols-3 gap-3">
        ${stat('Sold', s.internal.sold)}
        ${stat('Rank', s.internal.rank ? `#${s.internal.rank}` : '—')}
        ${stat('Of', s.internal.of)}
      </div>${s.internal.note ? `<p class="text-[12px] text-slate-400 mt-2">${esc(s.internal.note)}</p>` : ''}`
        : engEmpty('Internal standing is not available for this employee.'))}
    <div class="mt-4">${board('Facebook AutoPoster — global', 'Listings posted and sold across every MarketSync dealership.',
      s.autoposter ? `<div class="grid grid-cols-4 gap-3">
        ${stat('Posted', s.autoposter.posted)}
        ${stat('Sold', s.autoposter.sold)}
        ${stat('Rank', s.autoposter.rank ? `#${s.autoposter.rank}` : '—')}
        ${stat('Of', s.autoposter.of)}
      </div>${s.autoposter.note ? `<p class="text-[12px] text-slate-400 mt-2">${esc(s.autoposter.note)}</p>` : ''}`
        : engEmpty('AutoPoster standing is not available for this employee.'))}</div>
    <p class="text-[11px] text-slate-400 mt-3">These are two different boards measuring two different jobs, so they are never merged into one rank. Being first on one and absent from the other is information, not a contradiction.</p>`;
}

// ── Details: their information, and what HR can do about it ──────────────────
const PPL_EDIT_FIELDS = [
  ['name', 'Full name', 'text'], ['email', 'Email on the HR record', 'email'],
  ['phone', 'Phone', 'tel'], ['job_title', 'Job title', 'text'],
  ['department', 'Department', 'text'], ['team', 'Team', 'text'],
  ['location_name', 'Location', 'text'], ['employee_number', 'Employee number', 'text'],
  ['start_date', 'Start date', 'date'],
];

function pplDetailsPanel(d) {
  const p = d.person;
  const fields = PPL_EDIT_FIELDS.map(([k, label, type]) => `
    <label class="block">
      <span class="block text-[12px] font-bold text-slate-600 dark:text-slate-300">${esc(label)}</span>
      <input id="ppl-edit-${k}" type="${type}" value="${esc(String(p[k] ?? ''))}"
        class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
    </label>`).join('');

  return `
    ${engCard('Their information', `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${fields}</div>
      <div class="flex flex-wrap items-center gap-2 mt-4">
        <button onclick="pplSavePerson('${esc(p.id)}')" class="px-3 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:opacity-90 transition">Save changes</button>
        <span class="text-[12px] text-slate-400">Editing the HR record does not change their login email — that only changes from their own profile.</span>
      </div>`)}

    <div class="mt-4">${engCard('Pay', d.employment_withheld
      ? `<div class="text-[13px] text-slate-500 dark:text-slate-400">${esc(d.employment_withheld)}</div>`
      : d.employment
        ? `<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><div class="text-[11px] uppercase tracking-wide text-slate-400 font-bold">Type</div><div class="text-[13px] font-bold">${esc(d.employment.pay_type || '—')}</div></div>
            <div><div class="text-[11px] uppercase tracking-wide text-slate-400 font-bold">Rate</div><div class="text-[13px] font-bold">${d.employment.pay_rate != null ? '$' + Number(d.employment.pay_rate).toLocaleString() : '—'}</div></div>
            <div><div class="text-[11px] uppercase tracking-wide text-slate-400 font-bold">Schedule</div><div class="text-[13px] font-bold">${esc(d.employment.pay_schedule || '—')}</div></div>
            <div><div class="text-[11px] uppercase tracking-wide text-slate-400 font-bold">Employment</div><div class="text-[13px] font-bold">${esc(d.employment.employment_type || '—')}</div></div>
          </div>`
        : engEmpty('No employment record has been created for this person.'))}</div>

    <div class="mt-4">${engCard('Account', `
      <div class="flex flex-wrap items-center gap-2">
        ${p.user_id
          ? `<button onclick="pplResetPassword('${esc(p.id)}')" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition">Send a password reset</button>`
          : '<span class="text-[13px] text-amber-600 dark:text-amber-400">No login is linked, so there is no password to reset.</span>'}
        <button onclick="pplOffboard('${esc(p.id)}')" class="px-3 py-2 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 text-sm font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 transition">Offboard</button>
      </div>
      <p class="text-[12px] text-slate-400 mt-2">A reset emails <em>them</em> a link — it never shows you a password. An admin who could set a colleague's password could sign in as them, and every action would be logged as theirs.</p>`)}</div>`;
}

async function pplSavePerson(staffId) {
  const body = {};
  for (const [k] of PPL_EDIT_FIELDS) {
    const el = document.getElementById(`ppl-edit-${k}`);
    if (el) body[k] = el.value;
  }
  if (!String(body.name || '').trim()) { showToast('An employee needs a name.', 'error'); return; }
  try {
    await apiSendJson(`/hr/employees/${staffId}`, 'PATCH', body);
    showToast('Employee updated', 'success');
    ENGINE_DATA['people-overview'] = undefined;
    await pplOpenPerson(staffId);
    engineTab('people-overview', ENGINE_STATE['people-overview'] || 'work', true);
  } catch (e) { showToast(e.message, 'error'); }
}
window.pplSavePerson = pplSavePerson;

async function pplResetPassword(staffId) {
  if (!confirm('Email this employee a password reset link? It expires in 15 minutes and can be used once.')) return;
  try {
    const r = await apiSendJson(`/hr/employees/${staffId}/password-reset`, 'POST', {});
    showToast(`Reset link sent to ${r.sent_to}`, 'success');
  } catch (e) { showToast(e.message, 'error'); }
}
window.pplResetPassword = pplResetPassword;

// Offboarding names what the person still owns BEFORE anything is revoked — leaving
// their customers and open work unassigned is how a departure loses a pipeline.
async function pplOffboard(staffId) {
  let owned = null;
  try { owned = await apiGetJson(`/hr/employees/${staffId}/owned-work`); }
  catch (e) { showToast(`Could not check what they still own: ${e.message}. Nothing was offboarded.`, 'error'); return; }
  const lines = Object.entries(owned?.owned || owned || {})
    .filter(([, v]) => Number(v) > 0).map(([k, v]) => `${v} ${k.replace(/_/g, ' ')}`);
  const warning = lines.length
    ? `They still own:\n\n${lines.join('\n')}\n\nOffboarding revokes their access. Reassign this work first, or it becomes nobody's.\n\nOffboard anyway?`
    : 'They own no open work. Offboarding revokes their access and closes their employment record.\n\nContinue?';
  if (!confirm(warning)) return;
  const reason = prompt('Why are they leaving? (recorded on the employment record)');
  if (!reason || !reason.trim()) { showToast('Offboarding needs a reason on the record.', 'error'); return; }
  try {
    await apiSendJson(`/hr/employees/${staffId}/offboard`, 'POST', { reason: reason.trim() });
    showToast('Offboarded — access revoked and the record closed', 'success');
    document.querySelectorAll('.fixed.inset-0.z-\\[9998\\]').forEach(n => n.remove());
    ENGINE_DATA['people-overview'] = undefined;
    engineTab('people-overview', 'work', true);
  } catch (e) { showToast(e.message, 'error'); }
}
window.pplOffboard = pplOffboard;

// ── HR settings ──────────────────────────────────────────────────────────────
// The policies everybody signs and the onboarding templates every new hire runs. Both
// are HR configuration in the plainest sense: they decide what the department asks of
// people. Editing them stays where each is authored — this says what exists and what
// each one costs somebody, which is what was missing.
function pplRenderSettings(body, d) {
  const policies = d.policies, templates = d.lifecycleTemplates;
  const list = (sec, emptyMsg, rowFn) => sec == null
    ? `<div class="text-[13px] text-amber-600 dark:text-amber-400 py-3">This could not be loaded, so it is not shown.</div>`
    : (sec.length ? sec.map(rowFn).join('') : engEmpty(emptyMsg));

  body.innerHTML = `
    ${engSection('Policies everybody signs', engCard('', list(policies,
      'No policies exist yet. Nothing is being asked of anybody to sign.', p => `
      <div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
        <div class="min-w-0 flex-1">
          <div class="font-semibold text-[13px] text-slate-800 dark:text-slate-100 truncate">${esc(p.title || p.policy_key)}</div>
          <div class="text-[12px] text-slate-400">${esc(p.category || 'Policy')}${p.next_review_on ? ` · review due ${esc(pplDate(p.next_review_on))}` : ''}</div>
        </div>
        <div class="shrink-0 text-[12px] font-bold ${p.requires_acknowledgement ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400'}">${p.requires_acknowledgement ? 'Signature required' : 'Reference only'}</div>
      </div>`)), 'What every employee is asked to acknowledge')}

    ${engSection('Onboarding templates', engCard('', list(templates,
      'No onboarding template exists, so a new hire gets no task list at all.', t => `
      <div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
        <div class="min-w-0 flex-1">
          <div class="font-semibold text-[13px] text-slate-800 dark:text-slate-100 truncate">${esc(t.name || t.template_key || 'Template')}</div>
          <div class="text-[12px] text-slate-400">${esc(t.lifecycle_type || 'onboarding')}${t.task_count != null ? ` · ${t.task_count} task(s)` : ''}</div>
        </div>
      </div>`)), 'What a new hire is walked through on day one')}

    ${engSection('Elsewhere', engCard('', `
      <div class="flex flex-wrap gap-2">
        <button onclick="switchPage('academy')" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold">Academy — courses and certifications</button>
        <button onclick="switchPage('people-compliance')" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold">Compliance workstation</button>
        <button onclick="switchPage('config')" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold">Dealership configuration</button>
      </div>`), 'Where each of these is authored')}`;
}

function loadPeopleWorkspace() { renderEngine('people-overview') }
window.loadPeopleWorkspace = loadPeopleWorkspace;
