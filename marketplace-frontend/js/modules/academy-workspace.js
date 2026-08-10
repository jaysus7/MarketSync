/**
 * Academy — Your Learning, and credentials that required the work (Phase 7 PR 7.3).
 *
 * WHAT THIS REPLACES: five hard-coded courses and a "Complete Course & Issue Diploma" button
 * that issued a certificate because somebody clicked it. Nothing was assigned, nothing was
 * tracked, and the diploma meant nothing — which is worse than having no diploma, because the
 * dealership was publishing a claim about a person that nobody had checked.
 *
 * Three rules carried through from the backend:
 *
 *   • **Your Learning is what YOU need.** Required, then your department's foundations, then
 *     advanced material offered rather than pushed. The full library is searchable on demand
 *     and is never the default view — a wall of courses is not a learning experience.
 *
 *   • **Progress is the server's answer, not this file's.** Nothing here marks a course
 *     complete or a credential earned. `issueCertification` refuses unless every required
 *     course is actually completed, and this screen renders that refusal rather than routing
 *     around it.
 *
 *   • **A credential page is public.** The verification link is shared on LinkedIn, so it
 *     carries the credential and nothing about the employment record behind it.
 */

const ACAD_LEVELS = [
  ['required', 'Required', 'What you must complete'],
  ['foundations', 'Department Foundations', 'Competent operation of your department'],
  ['advanced', 'Advanced', 'Deeper capability — offered, never forced'],
];

let __acadLibraryQuery = '';
let __acadLibraryDept = '';

const acadTone = (c) => c.overdue ? 'text-rose-600 dark:text-rose-400'
  : c.status === 'completed' ? 'text-emerald-600 dark:text-emerald-400'
  : c.status === 'in_progress' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500';

// Storage states are written for a database, not for somebody standing at a desk.
const ACAD_STATUS = {
  not_started: 'Not started', assigned: 'Not started', in_progress: 'In progress',
  completed: 'Completed', waived: 'Waived', failed: 'Not passed', overdue: 'Overdue',
};
const acadStatus = (c) => c.overdue ? 'Overdue' : (ACAD_STATUS[c.status] || 'Not started');
const acadMins = (m) => m ? `${m} min` : '';
const acadDate = (d) => d ? String(d).slice(0, 10) : '';

function acadCourseRow(c) {
  const due = c.due_at ? `Due ${acadDate(c.due_at)}` : ''
  const meta = [c.department || 'Everyone', acadMins(c.estimated_minutes), due].filter(Boolean).join(' · ')
  return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <div class="min-w-0 flex-1">
      <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(c.title)}</div>
      <div class="text-[12px] text-slate-400 truncate">${esc(meta)}</div>
      ${c.description ? `<div class="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">${esc(c.description)}</div>` : ''}
    </div>
    <div class="shrink-0 text-right text-[12px] font-bold ${acadTone(c)}">${esc(acadStatus(c))}</div>
  </div>`
}

/**
 * A certification, and honestly how far off it is.
 *
 * The outstanding count is what the server would refuse on, so the button and the refusal can
 * never disagree.
 */
function acadCertRow(cert, held, outstanding) {
  const earned = !!held
  const tone = earned ? 'text-emerald-600 dark:text-emerald-400' : outstanding ? 'text-slate-500' : 'text-amber-600 dark:text-amber-400'
  const right = earned ? (held.valid === false ? 'Expired' : 'Earned') : outstanding ? `${outstanding} left` : 'Ready'
  // The credential ID is deliberately NOT in this row. Found by rendering at 390px: it landed
  // in a truncating line and came out as "Credential MS-SALES-8fJq2…", which reads as a whole
  // identifier and is not one. An ID somebody might read out or paste has to be shown in full
  // or not at all, so it lives in the credential modal where it can wrap.
  const sub = earned
    ? (held.expires_on ? `Expires ${acadDate(held.expires_on)}` : 'Does not expire')
    : `${cert.department || 'MarketSync'}${cert.validity_months ? ` · valid ${cert.validity_months} months` : ''}`

  return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <div class="min-w-0 flex-1">
      <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(cert.name)}</div>
      <div class="text-[12px] text-slate-400 truncate">${esc(sub)}</div>
      ${!earned && outstanding ? `<div class="text-[12px] text-slate-500">Complete ${outstanding} more required course${outstanding === 1 ? '' : 's'} to earn this</div>` : ''}
    </div>
    <div class="shrink-0 text-right text-[12px] font-bold ${tone}">${esc(right)}</div>
    ${earned ? `<button onclick="acadOpenCredential('${esc(held.credential_id)}')" class="shrink-0 px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Credential</button>` : ''}
  </div>`
}

function acadLibrarySearch(v) { __acadLibraryQuery = v; }
window.acadLibrarySearch = acadLibrarySearch;
function acadLibraryDept(v) { __acadLibraryDept = v; acadRunLibrary(); }
window.acadLibraryDept = acadLibraryDept;

/**
 * The library is fetched only when somebody asks for it. Loading 189 courses to render a path
 * of nine is how the old screen became a wall.
 */
async function acadRunLibrary() {
  const out = document.getElementById('acad-library-results')
  if (!out) return
  out.innerHTML = '<div class="py-6 text-center text-[13px] text-slate-400">Searching…</div>'
  try {
    const qs = new URLSearchParams()
    if (__acadLibraryQuery) qs.set('q', __acadLibraryQuery)
    if (__acadLibraryDept) qs.set('department', __acadLibraryDept)
    const d = await apiGetJson(`/academy/library${qs.toString() ? `?${qs}` : ''}`)
    const courses = d.courses || []
    out.innerHTML = courses.length
      ? courses.map(c => acadCourseRow({ ...c, status: 'not_started' })).join('')
      : engEmpty('No course matches that search.')
  } catch (e) {
    out.innerHTML = engEmpty(`The library could not be loaded — ${esc(e.message)}`)
  }
}
window.acadRunLibrary = acadRunLibrary;

/**
 * The credential. Rendered from the PUBLIC verification endpoint, deliberately: what the
 * holder sees here is exactly what anybody following the link sees, so nobody shares a URL
 * expecting it to show more or less than it does.
 */
async function acadOpenCredential(credentialId) {
  try {
    const cred = await apiGetJson(`/verify/${encodeURIComponent(credentialId)}`)
    const url = `${window.location.origin}/verify.html?id=${encodeURIComponent(credentialId)}`
    const linkedin = 'https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME'
      + `&name=${encodeURIComponent(cred.name)}`
      + '&organizationName=MarketSync'
      + `&issueYear=${String(cred.issued_on || '').slice(0, 4)}`
      + `&issueMonth=${Number(String(cred.issued_on || '').slice(5, 7)) || 1}`
      + `&certUrl=${encodeURIComponent(url)}`
      + `&certId=${encodeURIComponent(credentialId)}`
      + (cred.expires_on ? `&expirationYear=${String(cred.expires_on).slice(0, 4)}&expirationMonth=${Number(String(cred.expires_on).slice(5, 7)) || 1}` : '')

    automationModal(`
      <div class="space-y-4">
        <div class="text-center space-y-2 p-6 rounded-2xl border border-amber-300/60 dark:border-amber-700/50 bg-amber-50/60 dark:bg-amber-950/20">
          <div class="text-[11px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">MarketSync Credential</div>
          <div class="text-lg font-black text-slate-900 dark:text-white">${esc(cred.name)}</div>
          <div class="text-[13px] text-slate-600 dark:text-slate-300">${esc(cred.holder || '')}</div>
          <div class="text-[12px] text-slate-500">Issued ${esc(acadDate(cred.issued_on))}${cred.expires_on ? ` · Expires ${esc(acadDate(cred.expires_on))}` : ''}</div>
          <div class="text-[12px] font-bold ${cred.valid ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">${cred.valid ? 'Valid' : `Not valid — ${esc(cred.status)}`}</div>
        </div>
        <div class="space-y-1">
          <div class="text-[11px] font-black uppercase tracking-wider text-slate-400">Credential ID</div>
          <div class="font-mono text-[13px] text-slate-900 dark:text-white break-all">${esc(cred.credential_id)}</div>
        </div>
        <div class="space-y-1">
          <div class="text-[11px] font-black uppercase tracking-wider text-slate-400">Verification link</div>
          <div class="text-[12px] text-slate-600 dark:text-slate-300 break-all">${esc(url)}</div>
          <p class="text-[12px] text-slate-500">Anyone with this link can confirm the credential. It shows what is above and nothing else about you or your dealership.</p>
        </div>
        <div class="flex flex-wrap gap-2 pt-1">
          <a href="${esc(linkedin)}" target="_blank" rel="noopener noreferrer" class="px-4 py-2 rounded-xl bg-[#0a66c2] text-white text-[13px] font-bold">Add to LinkedIn</a>
          <button onclick="acadCopy('${esc(url)}')" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[13px] font-bold">Copy link</button>
        </div>
      </div>
    `, 'max-w-lg')
  } catch (e) { showToast(e.message, 'error') }
}
window.acadOpenCredential = acadOpenCredential;

function acadCopy(text) {
  try { navigator.clipboard.writeText(text); showToast('Link copied ✓', 'success') }
  catch { showToast('Copy is not available in this browser', 'error') }
}
window.acadCopy = acadCopy;

ENGINES['academy'] = {
  rootId: 'academy-root', title: 'Academy',
  subtitle: 'What you need to know, and credentials that required the work',
  icon: 'sparkles', accent: 'violet',
  tabLabels: { overview: 'Your Learning', work: 'Certifications', insights: 'Team' },
  get tabOrder() {
    const mgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role)
    return mgr ? ['overview', 'work', 'insights'] : ['overview', 'work']
  },

  quickActions: [
    { label: 'Your Learning', icon: 'sparkles', onclick: "engineTab('academy','overview')" },
    { label: 'Certifications', icon: 'shield', onclick: "engineTab('academy','work')" },
  ],
  nextActions: (d) => (d?.path?.required || [])
    .filter(c => c.status !== 'completed' && c.status !== 'waived')
    .slice(0, 5)
    .map(c => ({
      label: c.overdue ? `${c.title} — overdue` : c.title,
      icon: c.overdue ? 'flame' : 'sparkles',
      tone: c.overdue ? 'text-rose-600 dark:text-rose-400' : '',
      onclick: "engineTab('academy','overview')",
    })),

  fetch: async () => {
    // Each read is allowed to fail on its own. A person without `staff.training.view` has no
    // team data, and that is not an error worth blanking their own path over.
    const [path, certs, mine, attention] = await Promise.all([
      apiGetJson('/academy/my-path').catch(e => ({ error: e.message })),
      apiGetJson('/academy/certifications').catch(() => ({ certifications: [] })),
      apiGetJson('/academy/my-credentials').catch(() => ({ certifications: [] })),
      apiGetJson('/academy/attention').catch(() => null),
    ])
    return {
      path, error: path?.error || null,
      certifications: certs.certifications || [],
      held: (mine.certifications || []).filter(c => c.credential_id),
      attention: attention?.items || null,
    }
  },

  tabs: {
    /** Your Learning — Required, then your department's foundations, then advanced. */
    overview(body, d) {
      if (d.error) {
        body.innerHTML = engCard('Your learning', engEmpty(
          `Your path could not be loaded — ${esc(d.error)}`))
        return
      }
      const p = d.path || {}
      const sections = ACAD_LEVELS.map(([key, label, blurb]) => {
        const list = p[key] || []
        return engCard(label, list.length
          ? `<p class="text-[12px] text-slate-500 mb-1">${esc(blurb)}</p>${list.map(acadCourseRow).join('')}`
          : engEmpty(key === 'required'
            ? 'Nothing is required of you right now.'
            : 'Nothing here for your role and department yet.'))
      }).join('')

      const outstanding = p.outstanding_required || 0
      const overdue = p.overdue_required || 0
      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          ${engKpi('Required outstanding', outstanding, outstanding ? 'text-amber-600 dark:text-amber-400' : '')}
          ${engKpi('Overdue', overdue, overdue ? 'text-rose-600 dark:text-rose-400' : '')}
          ${engKpi('Foundations', (p.foundations || []).length)}
          ${engKpi('Advanced', (p.advanced || []).length)}
        </div>
        ${sections}
        ${engCard('Reference library', `
          <p class="text-[12px] text-slate-500 mb-2">Everything else MarketSync has written, searchable. It is not part of your path — nothing here is required of you.</p>
          <div class="flex flex-wrap gap-2 mb-2">
            <input id="acad-library-q" oninput="acadLibrarySearch(this.value)"
              onkeydown="if(event.key==='Enter')acadRunLibrary()"
              placeholder="Search the library" class="flex-1 min-w-[180px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[13px]">
            <button onclick="acadRunLibrary()" class="px-3 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-bold">Search</button>
          </div>
          <div id="acad-library-results"></div>
        `)}
      `
    },

    /** What you hold, and what you could earn — with the work each one still needs. */
    work(body, d) {
      const heldByKey = new Map((d.held || []).map(c => [c.certification_key, c]))
      const p = d.path || {}
      // Everything still outstanding on this person's path, by key — the same fact the server
      // refuses on, so the screen never promises a credential the API would decline.
      const done = new Set([...(p.required || []), ...(p.foundations || []), ...(p.advanced || [])]
        .filter(c => c.status === 'completed' || c.status === 'waived').map(c => c.course_key))

      const mine = (d.certifications || []).filter(c => heldByKey.has(c.certification_key))
      const available = (d.certifications || []).filter(c => !heldByKey.has(c.certification_key))
      const outstandingFor = (cert) => (cert.courses || []).filter(k => !done.has(k)).length

      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          ${engKpi('Credentials held', mine.length)}
          ${engKpi('Available', available.length)}
        </div>
        ${engCard('Your credentials', mine.length
          ? mine.map(c => acadCertRow(c, heldByKey.get(c.certification_key), 0)).join('')
          : engEmpty('You have not earned a MarketSync credential yet. Completing your required courses is how one is issued.'))}
        ${engCard('Available certifications', available.length
          ? available.map(c => acadCertRow(c, null, outstandingFor(c))).join('')
          : engEmpty('No certifications are published yet.'))}
        <p class="text-[12px] text-slate-500 px-1">A MarketSync credential is issued only when every required course behind it is complete. It is a claim your dealership makes in public, so it is not something that can be granted on request.</p>
      `
    },

    /** Team — required training that is late, and credentials about to lapse. */
    insights(body, d) {
      if (!d.attention) {
        body.innerHTML = engCard('Team', engEmpty('You do not have permission to see team training.'))
        return
      }
      const items = d.attention
      const overdue = items.filter(x => x.kind === 'training_overdue')
      const expiring = items.filter(x => x.kind === 'certification_expiring')
      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          ${engKpi('Training overdue', overdue.length, overdue.length ? 'text-rose-600 dark:text-rose-400' : '')}
          ${engKpi('Credentials expiring', expiring.length, expiring.length ? 'text-amber-600 dark:text-amber-400' : '')}
        </div>
        ${engCard('Needs attention', items.length
          ? items.map(x => `<div class="py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
              <div class="font-bold text-[13px] text-slate-900 dark:text-white">${esc(x.subject)}</div>
              <div class="text-[12px] text-slate-400">${esc(x.reason || '')}</div>
              <div class="text-[12px] font-semibold mt-0.5 text-amber-600 dark:text-amber-400">${esc(x.action || 'Review')}</div>
            </div>`).join('')
          : engEmpty('Nobody is behind on required training.'))}
      `
    },
  },
}

function loadAcademyWorkspace() { renderEngine('academy') }
window.loadAcademyWorkspace = loadAcademyWorkspace;
