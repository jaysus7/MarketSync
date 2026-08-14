/**
 * Academy — Your Learning, and credentials that required the work (Phase 7 PR 7.3).
 *
 * Unified single-page experience: courses show their associated certifications directly
 * under each module, progress is tracked deterministically by the server, and credentials
 * are verified publicly.
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

const ACAD_STATUS = {
  not_started: 'Not started', assigned: 'Not started', in_progress: 'In progress',
  completed: 'Completed', waived: 'Waived', failed: 'Not passed', overdue: 'Overdue',
};
const acadStatus = (c) => c.overdue ? 'Overdue' : (ACAD_STATUS[c.status] || 'Not started');
const acadMins = (m) => m ? `${m} min` : '';
const acadDate = (d) => d ? String(d).slice(0, 10) : '';

/**
 * Course row with embedded certification path badges rendered directly beneath the course description.
 */
function acadCourseRow(c, certsMap = new Map(), heldByKey = new Map(), doneSet = new Set()) {
  const due = c.due_at ? `Due ${acadDate(c.due_at)}` : '';
  const isDone = c.status === 'completed' || c.status === 'waived';
  const pct = isDone ? 100 : (c.status === 'in_progress' ? 45 : 0);
  const meta = [c.department || 'Everyone', acadMins(c.estimated_minutes), due].filter(Boolean).join(' · ');
  const courseKey = c.course_key || c.id;

  // Find all certifications that require this course
  const relatedCerts = certsMap.get(courseKey) || [];
  const certHtml = relatedCerts.length ? `
    <div class="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/40 flex flex-wrap items-center gap-2">
      <span class="text-[10px] font-black uppercase tracking-wider text-slate-400">Certification Path:</span>
      ${relatedCerts.map(cert => {
        const held = heldByKey.get(cert.certification_key);
        const totalReq = (cert.courses || []).length;
        const completedReq = (cert.courses || []).filter(k => doneSet.has(k)).length;
        if (held) {
          return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span>Certification Earned: ${esc(cert.name)}</span>
            <button onclick="acadOpenCredential('${esc(held.credential_id)}')" class="underline hover:opacity-80 font-bold ml-1">View Credential</button>
          </span>`;
        }
        return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
          ${esc(cert.name)} (${completedReq}/${totalReq} completed)
        </span>`;
      }).join('')}
    </div>
  ` : '';

  return `<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <div class="min-w-0 flex-1 space-y-1">
      <div class="flex items-center gap-2">
        <span class="font-black text-[13px] text-slate-900 dark:text-white truncate">${esc(c.title)}</span>
        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">HD Video Included</span>
      </div>
      <div class="text-[12px] text-slate-400 truncate">${esc(meta)}</div>
      ${c.description ? `<div class="text-[12px] text-slate-500 dark:text-slate-400">${esc(c.description)}</div>` : ''}
      
      <!-- Progress Bar Graph -->
      <div class="mt-2 flex items-center gap-2 max-w-xs">
        <div class="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div class="h-full rounded-full ${isDone ? 'bg-emerald-500' : 'bg-indigo-600'}" style="width:${pct}%"></div>
        </div>
        <span class="text-[10px] font-extrabold ${isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}">${pct}%</span>
      </div>

      ${certHtml}
    </div>

    <div class="shrink-0 flex items-center gap-2 text-right">
      <span class="text-[12px] font-bold ${acadTone(c)}">${esc(acadStatus(c))}</span>
      <a href="/training.html?lesson=${encodeURIComponent(c.course_key || c.id || '')}" target="_blank" class="px-3 py-1.5 rounded-lg text-[12px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm">
        ${isDone ? 'Review Lesson' : 'Start Course'}
      </a>
    </div>
  </div>`;
}

function acadCertRow(cert, held, outstanding) {
  const earned = !!held;
  const tone = earned ? 'text-emerald-600 dark:text-emerald-400' : outstanding ? 'text-slate-500' : 'text-amber-600 dark:text-amber-400';
  const right = earned ? (held.valid === false ? 'Expired' : 'Earned') : outstanding ? `${outstanding} left` : 'Ready';
  const sub = earned
    ? (held.expires_on ? `Expires ${acadDate(held.expires_on)}` : 'Does not expire')
    : `${cert.department || 'MarketSync'}${cert.validity_months ? ` · valid ${cert.validity_months} months` : ''}`;

  return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <div class="min-w-0 flex-1">
      <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(cert.name)}</div>
      <div class="text-[12px] text-slate-400 truncate">${esc(sub)}</div>
      ${!earned && outstanding ? `<div class="text-[12px] text-slate-500">Complete ${outstanding} more required course${outstanding === 1 ? '' : 's'} to earn this</div>` : ''}
    </div>
    <div class="shrink-0 text-right text-[12px] font-bold ${tone}">${esc(right)}</div>
    ${earned ? `<button onclick="acadOpenCredential('${esc(held.credential_id)}')" class="shrink-0 px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Credential</button>` : ''}
  </div>`;
}

function acadLibrarySearch(v) { __acadLibraryQuery = v; }
window.acadLibrarySearch = acadLibrarySearch;
function acadLibraryDept(v) { __acadLibraryDept = v; acadRunLibrary(); }
window.acadLibraryDept = acadLibraryDept;

async function acadRunLibrary() {
  const out = document.getElementById('acad-library-results');
  if (!out) return;
  out.innerHTML = '<div class="py-6 text-center text-[13px] text-slate-400">Searching…</div>';
  try {
    const qs = new URLSearchParams();
    if (__acadLibraryQuery) qs.set('q', __acadLibraryQuery);
    if (__acadLibraryDept) qs.set('department', __acadLibraryDept);
    const d = await apiGetJson(`/academy/library${qs.toString() ? `?${qs}` : ''}`);
    const courses = d.courses || [];
    out.innerHTML = courses.length
      ? courses.map(c => acadCourseRow({ ...c, status: 'not_started' })).join('')
      : engEmpty('No course matches that search.');
  } catch (e) {
    out.innerHTML = engEmpty(`The library could not be loaded — ${esc(e.message)}`);
  }
}
window.acadRunLibrary = acadRunLibrary;

async function acadOpenCredential(credentialId) {
  try {
    const cred = await apiGetJson(`/verify/${encodeURIComponent(credentialId)}`);
    const url = `${window.location.origin}/verify.html?id=${encodeURIComponent(credentialId)}`;
    const linkedin = 'https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME'
      + `&name=${encodeURIComponent(cred.name)}`
      + '&organizationName=MarketSync'
      + `&issueYear=${String(cred.issued_on || '').slice(0, 4)}`
      + `&issueMonth=${Number(String(cred.issued_on || '').slice(5, 7)) || 1}`
      + `&certUrl=${encodeURIComponent(url)}`
      + `&certId=${encodeURIComponent(credentialId)}`
      + (cred.expires_on ? `&expirationYear=${String(cred.expires_on).slice(0, 4)}&expirationMonth=${Number(String(cred.expires_on).slice(5, 7)) || 1}` : '');

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
    `, 'max-w-lg');
  } catch (e) { showToast(e.message, 'error'); }
}
window.acadOpenCredential = acadOpenCredential;

function acadCopy(text) {
  try { navigator.clipboard.writeText(text); showToast('Link copied ', 'success'); }
  catch { showToast('Copy is not available in this browser', 'error'); }
}
window.acadCopy = acadCopy;

ENGINES['academy'] = {
  rootId: 'academy-root', title: 'Academy',
  subtitle: 'What you need to know, and credentials that required the work',
  icon: 'sparkles', accent: 'violet',
  tabLabels: { overview: 'Your Learning', work: 'Certifications' },
  get tabOrder() {
    return ['overview', 'work'];
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
    const [path, certs, mine] = await Promise.all([
      apiGetJson('/academy/my-path').catch(e => ({ error: e.message })),
      apiGetJson('/academy/certifications').catch(() => ({ certifications: [] })),
      apiGetJson('/academy/my-credentials').catch(() => ({ certifications: [] })),
    ]);
    return {
      path, error: path?.error || null,
      certifications: certs.certifications || [],
      held: (mine.certifications || []).filter(c => c.credential_id),
    };
  },

  tabs: {
    /** Your Learning — Unified single page with certifications under each course */
    overview(body, d) {
      if (d.error) {
        body.innerHTML = engCard('Your learning', engEmpty(
          `Your path could not be loaded — ${esc(d.error)}`));
        return;
      }
      const p = d.path || {};

      // Map each course key to certifications that require it
      const certsMap = new Map();
      (d.certifications || []).forEach(cert => {
        (cert.courses || []).forEach(courseKey => {
          if (!certsMap.has(courseKey)) certsMap.set(courseKey, []);
          certsMap.get(courseKey).push(cert);
        });
      });

      const heldByKey = new Map((d.held || []).map(c => [c.certification_key, c]));
      const doneSet = new Set([...(p.required || []), ...(p.foundations || []), ...(p.advanced || [])]
        .filter(c => c.status === 'completed' || c.status === 'waived').map(c => c.course_key));

      const sections = ACAD_LEVELS.map(([key, label, blurb]) => {
        const list = p[key] || [];
        return engCard(label, list.length
          ? `<p class="text-[12px] text-slate-500 mb-1">${esc(blurb)}</p>${list.map(c => acadCourseRow(c, certsMap, heldByKey, doneSet)).join('')}`
          : engEmpty(key === 'required'
            ? 'Nothing is required of you right now.'
            : 'Nothing here for your role and department yet.'));
      }).join('');

      const outstanding = p.outstanding_required || 0;
      const overdue = p.overdue_required || 0;

      const proactiveAiPanel = `
        <div class="mb-4 p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg border border-slate-800">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-sky-400">
              <span>Proactive Academy &amp; Compliance AI Assistant</span>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/20 text-sky-300 border border-sky-500/30">LIVE LEARNING TELEMETRY</span>
          </div>
          <div class="text-xs text-slate-300 space-y-1.5 mb-3">
            <p>• <strong>Required Course Status:</strong> ${outstanding ? `<span class="text-amber-300 font-bold">${outstanding} mandatory training module(s) currently assigned to your learning path.</span>` : 'All mandatory training modules are fully completed!'}</p>
            <p>• <strong>Overdue Compliance:</strong> ${overdue ? `<span class="text-rose-400 font-bold">${overdue} compliance module(s) past completion deadline!</span>` : 'No overdue training modules.'}</p>
            <p>• <strong>Active Credentials &amp; Badges:</strong> ${(d.held || []).length} active certification badge(s) earned.</p>
          </div>
          <div class="flex flex-wrap gap-2 pt-2 border-t border-slate-800/80">
            <button onclick="engineTab('academy','overview')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 transition">Start Next Course</button>
            <button onclick="engineTab('academy','work')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition">View Earned Certifications</button>
          </div>
        </div>
      `;

      // Certifications summary on main page
      const mine = (d.certifications || []).filter(c => heldByKey.has(c.certification_key));
      const available = (d.certifications || []).filter(c => !heldByKey.has(c.certification_key));
      const outstandingFor = (cert) => (cert.courses || []).filter(k => !doneSet.has(k)).length;

      const certsOverviewCard = engCard('MarketSync Certifications & Credentials', `
        <p class="text-[12px] text-slate-500 mb-3">Certifications are issued automatically once all required courses are completed.</p>
        ${mine.length ? `<div class="mb-3">
          <div class="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">Earned Credentials</div>
          ${mine.map(c => acadCertRow(c, heldByKey.get(c.certification_key), 0)).join('')}
        </div>` : ''}
        ${available.length ? `<div>
          <div class="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Available Certifications</div>
          ${available.map(c => acadCertRow(c, null, outstandingFor(c))).join('')}
        </div>` : ''}
      `);

      body.innerHTML = `
        ${proactiveAiPanel}
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          ${engKpi('Required outstanding', outstanding, outstanding ? 'text-amber-600 dark:text-amber-400' : '')}
          ${engKpi('Overdue', overdue, overdue ? 'text-rose-600 dark:text-rose-400' : '')}
          ${engKpi('Foundations', (p.foundations || []).length)}
          ${engKpi('Advanced', (p.advanced || []).length)}
        </div>
        ${sections}
        ${certsOverviewCard}
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
      `;
    },

    /** Certifications tab */
    work(body, d) {
      const heldByKey = new Map((d.held || []).map(c => [c.certification_key, c]));
      const p = d.path || {};
      const done = new Set([...(p.required || []), ...(p.foundations || []), ...(p.advanced || [])]
        .filter(c => c.status === 'completed' || c.status === 'waived').map(c => c.course_key));

      const mine = (d.certifications || []).filter(c => heldByKey.has(c.certification_key));
      const available = (d.certifications || []).filter(c => !heldByKey.has(c.certification_key));
      const outstandingFor = (cert) => (cert.courses || []).filter(k => !done.has(k)).length;

      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          ${engKpi('Credentials held', mine.length)}
          ${engKpi('Available', available.length)}
        </div>
        ${engCard('Your credentials', mine.length
          ? mine.map(c => acadCertRow(c, heldByKey.get(c.certification_key), 0)).join('')
          : engEmpty('You have not earned a MarketSync credential yet. Completing your required courses is how one is issued.'))}
        ${engCard('Available certifications', available.length
          ? available.map(c => acadCertRow(c, null, outstandingFor(c))).join('')
          : engEmpty('No certifications are published yet.'))}
        <p class="text-[12px] text-slate-500 px-1 mt-2">A MarketSync credential is issued only when every required course behind it is complete. It is a claim your dealership makes in public, so it is not something that can be granted on request.</p>
      `;
    },
  },
};

function loadAcademyWorkspace() { renderEngine('academy') }
window.loadAcademyWorkspace = loadAcademyWorkspace;
