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
  return `<div class="grid grid-cols-1 md:grid-cols-[minmax(12rem,2fr)_repeat(4,minmax(7rem,1fr))] gap-2 md:gap-3 py-3 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
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
  rootId: 'people-overview-root', title: 'People',
  subtitle: 'Who works here, what they owe, and what is not being measured',
  icon: 'user', accent: 'emerald',
  tabLabels: { overview: 'My Day', work: 'Team', insights: 'Compliance' },
  get tabOrder() { return ['overview', 'work', 'insights'] },

  quickActions: [
    { label: 'Team', icon: 'user', onclick: "engineTab('people-overview','work')" },
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
    const [day, team, compliance] = await Promise.all([
      apiGetJson('/my-day').catch(() => ({ needs_attention: [], failed: [{ source: 'my-day', label: 'My Day', reason: 'could not be loaded' }], not_covered: [] })),
      apiGetJson('/hr/team').catch(() => ({ team: [] })),
      apiGetJson('/hr/compliance').catch(() => null),
    ])
    // People's own sources, not the whole store's day — this is the People screen.
    const mine = ['people', 'academy', 'time', 'compliance', 'setup']
    return {
      needsAttention: (day.needs_attention || []).filter(x => mine.includes(x.source)),
      allAttention: day.needs_attention || [],
      dayFailed: day.failed || [],
      team: team.team || [],
      compliance,
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
        ${unlinked.length ? engCard('Can sign in, but not on the team', `
          <p class="text-[12px] text-slate-500 mb-1">These logins have no employment record. Until they do, nothing can be assigned to them and they appear in no report.</p>
          ${unlinked.map(pplPersonRow).join('')}
        `) : ''}
        ${engCard('Team', rest.length ? rest.map(pplPersonRow).join('') : engEmpty('Nobody has an employment record yet.'))}
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
  },
}

function loadPeopleWorkspace() { renderEngine('people-overview') }
window.loadPeopleWorkspace = loadPeopleWorkspace;
