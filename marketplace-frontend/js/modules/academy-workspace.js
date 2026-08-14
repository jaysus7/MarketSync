/**
 * Academy — Full-Page Dealership Training & Certification Workspace (Phase 7 PR 7.3).
 *
 * Full-page studio-style learning experience: courses organized by department,
 * mandatory HR new-hire onboarding hub, deterministic progress tracking with
 * percentage bars, role-based gating, and downloadable official certificates.
 */

const ACAD_LEVELS = [
  ['required', 'Required', 'What you must complete for your role'],
  ['foundations', 'Department Foundations', 'Competent operation of your department'],
  ['advanced', 'Advanced', 'Deeper capability — offered, never forced'],
];

let __acadLibraryQuery = '';
let __acadLibraryDept = '';
let __acadActiveDeptFilter = 'all';

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

// ── Department Catalog Structure & Mandatory HR Curriculum ───────────────────
const ACAD_DEPARTMENTS = [
  { key: 'hr', name: 'Mandatory HR & Onboarding', icon: 'shield', color: 'rose', description: 'Mandatory compliance & safety training required to start your position' },
  { key: 'sales', name: 'Sales Department', icon: 'crm', color: 'amber', description: 'CRM, lead handling, appraisals, video walkarounds & pipeline execution' },
  { key: 'inventory', name: 'Inventory & Merchandising', icon: 'car', color: 'cyan', description: 'Inventory ingestion, photos, market pricing, turn rate & syndication' },
  { key: 'fni', name: 'F&I (Finance & Insurance)', icon: 'credit', color: 'emerald', description: 'Credit compliance, lender submissions, CIT funding & aftermarket disclosure' },
  { key: 'service', name: 'Service Department', icon: 'wrench', color: 'teal', description: 'Appointments, repair order lifecycle, labor dispatch & authorizations' },
  { key: 'parts', name: 'Parts Department', icon: 'tag', color: 'orange', description: 'Parts requisitions, pick lists, physical audits & stock management' },
  { key: 'accounting', name: 'Accounting & Finance', icon: 'coin', color: 'blue', description: 'General ledger, deal settlement, month-end close controls & bank matching' },
  { key: 'marketing', name: 'Marketing & Studio', icon: 'megaphone', color: 'purple', description: 'Campaign attribution, multi-platform social scheduling & Design Studio' },
  { key: 'management', name: 'Management & Leadership', icon: 'building', color: 'indigo', description: 'My Day dealership pulse, staff onboarding, approval matrix & store analytics' },
];

const ACAD_MANDATORY_HR_COURSES = [
  { course_key: 'hr_workplace_safety', title: 'Workplace Safety & OSHA Compliance', department: 'HR', level: 'required', estimated_minutes: 15, description: 'Dealership lot safety, hazard communication, fire safety, and incident reporting protocols.', is_hr_mandatory: true },
  { course_key: 'hr_anti_harassment', title: 'Anti-Harassment & Non-Discrimination Policy', department: 'HR', level: 'required', estimated_minutes: 20, description: 'Equal opportunity standards, harassment prevention, bystander intervention, and reporting channels.', is_hr_mandatory: true },
  { course_key: 'ms_privacy_basics', title: 'Customer Privacy, FTC Safeguards & CASL / Consent Laws', department: 'HR', level: 'required', estimated_minutes: 15, description: 'Handling customer NPI, lawful consent before contact, FTC Safeguards compliance, and opt-out rules.', is_hr_mandatory: true },
  { course_key: 'hr_cyber_security', title: 'Cyber Hygiene & Information Security Safeguards', department: 'HR', level: 'required', estimated_minutes: 15, description: 'Phishing defense, multi-factor authentication, password hygiene, and safeguarding dealer credentials.', is_hr_mandatory: true },
  { course_key: 'hr_code_of_conduct', title: 'Dealership Code of Conduct & Ethics', department: 'HR', level: 'required', estimated_minutes: 10, description: 'Professional conduct, conflict of interest, honesty in advertising, and core values.', is_hr_mandatory: true },
];

// Role to allowed department tabs mapping
const ROLE_DEPARTMENT_ACCESS = {
  SALES_REP: ['all', 'hr', 'sales', 'inventory', 'marketing'],
  FNI: ['all', 'hr', 'fni', 'sales', 'inventory'],
  SERVICE_TECH: ['all', 'hr', 'service', 'parts'],
  SERVICE: ['all', 'hr', 'service', 'parts'],
  PARTS: ['all', 'hr', 'parts', 'service'],
  ACCOUNTING: ['all', 'hr', 'accounting', 'fni'],
  CLEANUP: ['all', 'hr', 'inventory'],
  MARKETER: ['all', 'hr', 'marketing', 'inventory'],
  MANAGER: ['all', 'hr', 'sales', 'inventory', 'fni', 'service', 'parts', 'accounting', 'marketing', 'management'],
  OWNER: ['all', 'hr', 'sales', 'inventory', 'fni', 'service', 'parts', 'accounting', 'marketing', 'management'],
  DEALER_ADMIN: ['all', 'hr', 'sales', 'inventory', 'fni', 'service', 'parts', 'accounting', 'marketing', 'management'],
  HQ_STAFF: ['all', 'hr', 'sales', 'inventory', 'fni', 'service', 'parts', 'accounting', 'marketing', 'management'],
};

/**
 * Course card with progress bar, percentage readout, status badges, and certification links.
 */
function acadCourseRow(c, certsMap = new Map(), heldByKey = new Map(), doneSet = new Set()) {
  const due = c.due_at ? `Due ${acadDate(c.due_at)}` : '';
  const isDone = c.status === 'completed' || c.status === 'waived';
  const pct = isDone ? 100 : (c.status === 'in_progress' ? 45 : 0);
  const meta = [c.department || 'Everyone', acadMins(c.estimated_minutes), due].filter(Boolean).join(' · ');
  const courseKey = c.course_key || c.id;

  // Level badge styling
  const isMandatoryHr = c.is_hr_mandatory || c.department === 'HR';
  const levelBadge = isMandatoryHr
    ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/40">🚨 Mandatory HR</span>`
    : c.level === 'required'
    ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">Required</span>`
    : c.level === 'foundation' || c.level === 'foundations'
    ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-500/20 text-sky-400 border border-sky-500/30">Foundation</span>`
    : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-400 border border-purple-500/30">Advanced</span>`;

  // Find all certifications that require this course
  const relatedCerts = certsMap.get(courseKey) || [];
  const certHtml = relatedCerts.length ? `
    <div class="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
      <span class="text-[10px] font-black uppercase tracking-wider text-slate-400">Certification Path:</span>
      ${relatedCerts.map(cert => {
        const held = heldByKey.get(cert.certification_key);
        const totalReq = (cert.courses || []).length;
        const completedReq = (cert.courses || []).filter(k => doneSet.has(k)).length;
        if (held) {
          return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <span>Certification Earned: ${esc(cert.name)}</span>
            <button onclick="acadOpenCredential('${esc(held.credential_id)}')" class="underline hover:text-white font-bold ml-1">View Diploma</button>
          </span>`;
        }
        return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
          ${esc(cert.name)} (${completedReq}/${totalReq} done)
        </span>`;
      }).join('')}
    </div>
  ` : '';

  return `<div class="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div class="min-w-0 flex-1 space-y-1.5">
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-black text-sm text-white">${esc(c.title)}</span>
        ${levelBadge}
        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">HD Video + Interactive</span>
      </div>
      <div class="text-xs text-slate-400">${esc(meta)}</div>
      ${c.description ? `<div class="text-xs text-slate-300 leading-relaxed">${esc(c.description)}</div>` : ''}
      
      <!-- Progress Bar Graph with exact Percentage -->
      <div class="mt-2.5 flex items-center gap-3 max-w-sm">
        <div class="h-2 flex-1 rounded-full bg-slate-800 overflow-hidden border border-slate-700/50">
          <div class="h-full rounded-full transition-all duration-500 ${isDone ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-700'}" style="width:${pct}%"></div>
        </div>
        <span class="text-[11px] font-mono font-black ${isDone ? 'text-emerald-400' : pct > 0 ? 'text-amber-400' : 'text-slate-400'}">${pct}%</span>
        <span class="text-[11px] font-bold ${acadTone(c)}">${esc(acadStatus(c))}</span>
      </div>

      ${certHtml}
    </div>

    <div class="shrink-0 flex items-center gap-2 sm:self-center">
      <a href="/training.html?lesson=${encodeURIComponent(c.course_key || c.id || '')}" target="_blank" class="px-4 py-2 rounded-xl text-xs font-bold ${isDone ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'} transition flex items-center gap-1.5">
        <span>${isDone ? 'Review Lesson' : pct > 0 ? 'Continue Lesson' : 'Start Course'}</span>
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/></svg>
      </a>
    </div>
  </div>`;
}

function acadCertRow(cert, held, outstanding) {
  const earned = !!held;
  const tone = earned ? 'text-emerald-400' : outstanding ? 'text-slate-400' : 'text-amber-400';
  const right = earned ? (held.valid === false ? 'Expired' : 'Earned ✅') : outstanding ? `${outstanding} left` : 'Ready to Issue';
  const sub = earned
    ? (held.expires_on ? `Expires ${acadDate(held.expires_on)}` : 'Valid indefinitely')
    : `${cert.department || 'MarketSync'}${cert.validity_months ? ` · valid ${cert.validity_months} months` : ''}`;

  return `<div class="p-4 rounded-2xl bg-slate-900/80 border ${earned ? 'border-emerald-500/40 bg-emerald-950/10' : 'border-slate-800'} flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <div class="min-w-0 flex-1 space-y-1">
      <div class="flex items-center gap-2">
        <span class="font-black text-sm text-white truncate">${esc(cert.name)}</span>
        ${earned ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">OFFICIAL CERTIFICATION</span>' : ''}
      </div>
      <div class="text-xs text-slate-400">${esc(sub)}</div>
      ${cert.description ? `<p class="text-xs text-slate-300">${esc(cert.description)}</p>` : ''}
      ${!earned && outstanding ? `<div class="text-xs text-amber-400 font-semibold pt-1">Complete ${outstanding} more required course${outstanding === 1 ? '' : 's'} to unlock this official diploma</div>` : ''}
    </div>
    <div class="shrink-0 flex items-center gap-3">
      <div class="text-right text-xs font-black ${tone}">${esc(right)}</div>
      ${earned ? `<button onclick="acadOpenCredential('${esc(held.credential_id)}')" class="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition flex items-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>Download Certificate</button>` : ''}
    </div>
  </div>`;
}

function acadLibrarySearch(v) { __acadLibraryQuery = v; acadFilterWorkspaceCourses(); }
window.acadLibrarySearch = acadLibrarySearch;
function acadLibraryDept(v) { __acadLibraryDept = v; acadRunLibrary(); }
window.acadLibraryDept = acadLibraryDept;

function setAcadDeptFilter(deptKey) {
  __acadActiveDeptFilter = deptKey;
  const buttons = document.querySelectorAll('[data-acad-filter]');
  buttons.forEach(b => {
    const active = b.dataset.acadFilter === deptKey;
    b.className = `px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'}`;
  });
  acadFilterWorkspaceCourses();
}
window.setAcadDeptFilter = setAcadDeptFilter;

function acadFilterWorkspaceCourses() {
  const query = (__acadLibraryQuery || '').toLowerCase().trim();
  const filter = __acadActiveDeptFilter;
  const cards = document.querySelectorAll('[data-course-dept]');
  let visibleCount = 0;

  cards.forEach(card => {
    const dept = (card.dataset.courseDept || '').toLowerCase();
    const title = (card.dataset.courseTitle || '').toLowerCase();
    const matchDept = filter === 'all' || dept === filter || (filter === 'hr' && (card.dataset.courseIsHr === 'true' || dept === 'hr'));
    const matchQuery = !query || title.includes(query) || dept.includes(query);

    const show = matchDept && matchQuery;
    card.classList.toggle('hidden', !show);
    if (show) visibleCount++;
  });

  const emptyMsg = document.getElementById('acad-filtered-empty');
  if (emptyMsg) emptyMsg.classList.toggle('hidden', visibleCount > 0);
}
window.acadFilterWorkspaceCourses = acadFilterWorkspaceCourses;

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

/**
 * Downloadable & Printable Official Certificate Modal
 */
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
      <div class="space-y-6 text-left">
        <!-- Printable Certificate Card -->
        <div id="printable-credential-frame" class="p-8 sm:p-10 rounded-2xl border-4 border-double border-amber-500/60 bg-gradient-to-b from-[#fffdfa] to-[#fbf8f0] text-slate-900 shadow-2xl relative overflow-hidden text-center">
          <div class="flex justify-between items-start mb-6">
            <img src="/Logo 2.0.png" alt="MarketSync" class="h-7 w-auto">
            <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-800 border border-amber-500/40">OFFICIAL CERTIFICATION</span>
          </div>

          <div class="space-y-3">
            <div class="text-[11px] font-black uppercase tracking-widest text-amber-700">MarketSync DealerOS Academy</div>
            <div class="text-xs text-slate-500 uppercase tracking-widest">This certifies that</div>
            <h2 class="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">${esc(cred.holder || profileContext?.name || 'Staff Member')}</h2>
            <p class="text-xs text-slate-600 max-w-md mx-auto">has successfully completed all required modules, assessments, and operational standards to be recognized as</p>
            <h3 class="text-xl sm:text-2xl font-black text-indigo-900 pt-1">${esc(cred.name)}</h3>
            <div class="text-xs text-slate-500 pt-2">Issued ${esc(acadDate(cred.issued_on))}${cred.expires_on ? ` · Valid Through ${esc(acadDate(cred.expires_on))}` : ''}</div>
          </div>

          <div class="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div class="text-left font-mono">
              <span class="text-[10px] uppercase tracking-wider text-slate-400 block">Credential Identifier</span>
              <span class="font-bold text-slate-800 break-all">${esc(cred.credential_id)}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-10 h-10 rounded-full border-2 border-amber-600 flex items-center justify-center font-serif text-amber-700 font-bold text-xs">SEAL</span>
              <div class="text-right">
                <span class="font-bold text-slate-900 block">MarketSync Certified</span>
                <span class="text-[10px]">Authorized Registrar</span>
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-2 bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div class="text-[11px] font-black uppercase tracking-wider text-slate-400">Public Verification Link</div>
          <div class="text-xs text-sky-400 font-mono break-all">${esc(url)}</div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div class="flex gap-2">
            <a href="${esc(linkedin)}" target="_blank" rel="noopener noreferrer" class="px-4 py-2 rounded-xl bg-[#0a66c2] hover:bg-[#095196] text-white text-xs font-bold transition flex items-center gap-1.5">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.88a1.66 1.66 0 1 0 0 3.32 1.66 1.66 0 0 0 0-3.32z"/></svg>
              <span>Add to LinkedIn</span>
            </a>
            <button onclick="acadCopy('${esc(url)}')" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition">Copy link</button>
          </div>
          <button onclick="window.print()" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg transition flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24-1.077-.42-2.235-.42-3.429 0-4.639 3.582-8.4 8-8.4s8 3.761 8 8.4c0 1.194-.18 2.352-.42 3.429M9 17.5h6m-7.5 3h9"/></svg>
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>
    `, 'max-w-2xl');
  } catch (e) { showToast(e.message, 'error'); }
}
window.acadOpenCredential = acadOpenCredential;

function acadCopy(text) {
  try { navigator.clipboard.writeText(text); showToast('Link copied ', 'success'); }
  catch { showToast('Copy is not available in this browser', 'error'); }
}
window.acadCopy = acadCopy;

// ── Full-Page Studio-Style Master Modal ──────────────────────────────────────
window.openMarketSyncAcademy = function() {
  switchPage('academy');
};

window.closeMarketSyncAcademy = function() {
  const last = localStorage.getItem('ms_last_page');
  const target = (last && last !== 'academy') ? last : 'command';
  switchPage(target);
};

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
    /** Your Learning — Full-Page Workspace with Department Organization */
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

      // Combine API courses with mandatory HR training modules
      const hrCoursesWithState = ACAD_MANDATORY_HR_COURSES.map(h => ({
        ...h,
        status: doneSet.has(h.course_key) ? 'completed' : 'not_started',
      }));

      // Calculate progress stats
      const totalCourses = (p.required || []).length + (p.foundations || []).length + (p.advanced || []).length;
      const totalDone = doneSet.size;
      const overallPct = totalCourses > 0 ? Math.round((totalDone / totalCourses) * 100) : 100;
      const outstanding = p.outstanding_required || 0;
      const overdue = p.overdue_required || 0;

      // Role-based Department Access Filtering
      const userRole = profileContext?.role || 'SALES_REP';
      const allowedDepts = ROLE_DEPARTMENT_ACCESS[userRole] || ROLE_DEPARTMENT_ACCESS.SALES_REP;

      const deptFilterButtons = ACAD_DEPARTMENTS
        .filter(dept => allowedDepts.includes('all') || allowedDepts.includes(dept.key))
        .map(dept => `
          <button type="button" data-acad-filter="${dept.key}" onclick="setAcadDeptFilter('${dept.key}')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${__acadActiveDeptFilter === dept.key ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'}">
            <span>${esc(dept.name)}</span>
          </button>
        `).join('');

      // Top Header & Studio-Style Action Bar
      const fullPageHeader = `
        <div class="mb-6 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border border-slate-800 shadow-2xl space-y-5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3 min-w-0">
              <button onclick="closeMarketSyncAcademy()" class="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-2 text-xs font-bold shrink-0">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"/></svg>
                <span>← Back to Dashboard</span>
              </button>
              <div class="h-6 w-px bg-slate-800"></div>
              <div>
                <h1 class="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  <span>MarketSync Academy</span>
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Dealership OS</span>
                </h1>
                <p class="text-xs text-slate-400">Department curriculum, mandatory HR onboarding &amp; verifiable certifications</p>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <div class="text-right pr-2">
                <div class="text-xs font-bold text-white">${esc(profileContext?.name || 'Staff Member')}</div>
                <div class="text-[11px] font-mono text-indigo-400">${esc(profileContext?.role || 'SALES_REP')}</div>
              </div>
            </div>
          </div>

          <!-- Quick Metrics Bar -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80">
            <div class="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div class="text-[10px] font-black uppercase tracking-wider text-slate-400">Mandatory HR Status</div>
              <div class="text-sm font-black ${outstanding > 0 ? 'text-amber-400' : 'text-emerald-400'} flex items-center gap-1.5 mt-0.5">
                <span>${outstanding > 0 ? `${outstanding} Pending` : '100% Compliant ✅'}</span>
              </div>
            </div>
            <div class="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div class="text-[10px] font-black uppercase tracking-wider text-slate-400">Overall Progress</div>
              <div class="text-sm font-black text-sky-400 font-mono mt-0.5">${overallPct}% (${totalDone}/${totalCourses})</div>
            </div>
            <div class="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div class="text-[10px] font-black uppercase tracking-wider text-slate-400">Overdue Modules</div>
              <div class="text-sm font-black ${overdue > 0 ? 'text-rose-400' : 'text-slate-300'} font-mono mt-0.5">${overdue}</div>
            </div>
            <div class="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div class="text-[10px] font-black uppercase tracking-wider text-slate-400">Certificates Earned</div>
              <div class="text-sm font-black text-emerald-400 font-mono mt-0.5">${(d.held || []).length} of ${(d.certifications || []).length}</div>
            </div>
          </div>

          <!-- Department Filter Bar & Search Input -->
          <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
            <div class="flex flex-wrap items-center gap-1.5">
              <button type="button" data-acad-filter="all" onclick="setAcadDeptFilter('all')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${__acadActiveDeptFilter === 'all' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'}">
                All Departments
              </button>
              ${deptFilterButtons}
            </div>

            <div class="relative min-w-[240px]">
              <input type="text" id="acad-search-input" oninput="acadLibrarySearch(this.value)" placeholder="Search courses &amp; topics…" class="w-full bg-slate-950/90 text-xs text-white px-3.5 py-2 pl-9 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-500" />
              <svg class="w-4 h-4 text-slate-500 absolute left-3 top-2.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z"/></svg>
            </div>
          </div>
        </div>
      `;

      // ── Section 1: Mandatory HR & Onboarding Training ───────────────────────
      const hrSection = `
        <div data-course-dept="hr" data-course-is-hr="true" class="mb-8 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center font-bold text-sm">🚨</span>
              <div>
                <h2 class="text-base font-black text-white">Mandatory HR &amp; New Hire Onboarding Training</h2>
                <p class="text-xs text-slate-400">Required compliance, safety &amp; conduct courses to start your position at the dealership</p>
              </div>
            </div>
            <span class="px-3 py-1 rounded-full text-xs font-black bg-rose-500/10 text-rose-400 border border-rose-500/30">MANDATORY TO START</span>
          </div>

          <div class="grid grid-cols-1 gap-3">
            ${hrCoursesWithState.map(c => acadCourseRow(c, certsMap, heldByKey, doneSet)).join('')}
          </div>
        </div>
      `;

      // ── Section 2: Department-Organized Course Catalog ──────────────────────
      const levelsSections = ACAD_LEVELS.map(([key, label, blurb]) => {
        const list = p[key] || [];
        if (!list.length) return '';
        return `
          <div class="mb-8 space-y-3" data-level-group="${key}">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-base font-black text-white">${esc(label)}</h2>
                <p class="text-xs text-slate-400">${esc(blurb)}</p>
              </div>
              <span class="text-xs font-bold text-slate-400 font-mono">${list.length} module${list.length === 1 ? '' : 's'}</span>
            </div>
            <div class="grid grid-cols-1 gap-3">
              ${list.map(c => `
                <div data-course-dept="${(c.department || 'general').toLowerCase()}" data-course-title="${esc(c.title)}">
                  ${acadCourseRow(c, certsMap, heldByKey, doneSet)}
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('');

      // ── Section 3: Official Certifications & Credentials ─────────────────────
      const mine = (d.certifications || []).filter(c => heldByKey.has(c.certification_key));
      const available = (d.certifications || []).filter(c => !heldByKey.has(c.certification_key));
      const outstandingFor = (cert) => (cert.courses || []).filter(k => !doneSet.has(k)).length;

      const certsSection = `
        <div class="mb-8 p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 class="text-base font-black text-white flex items-center gap-2">
                <span>Official MarketSync Certifications</span>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">PUBLICLY VERIFIABLE</span>
              </h2>
              <p class="text-xs text-slate-400">Complete all required modules in a discipline to unlock your verifiable diploma and printable certificate</p>
            </div>
          </div>

          ${mine.length ? `
            <div class="space-y-2">
              <div class="text-xs font-black uppercase tracking-wider text-emerald-400">Earned Credentials</div>
              <div class="grid grid-cols-1 gap-3">
                ${mine.map(c => acadCertRow(c, heldByKey.get(c.certification_key), 0)).join('')}
              </div>
            </div>
          ` : ''}

          ${available.length ? `
            <div class="space-y-2 pt-2">
              <div class="text-xs font-black uppercase tracking-wider text-slate-400">Available Certifications</div>
              <div class="grid grid-cols-1 gap-3">
                ${available.map(c => acadCertRow(c, null, outstandingFor(c))).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;

      body.innerHTML = `
        <div class="max-w-6xl mx-auto space-y-6">
          ${fullPageHeader}
          <div id="acad-filtered-empty" class="hidden py-12 text-center text-slate-400 text-sm">
            No courses found matching that department filter or search query.
          </div>
          ${hrSection}
          ${levelsSections}
          ${certsSection}

          <!-- Reference Library Search Dropdown -->
          <div class="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 class="text-sm font-black text-white">Full Reference Library</h3>
            <p class="text-xs text-slate-400">Search the entire library of all 180+ automotive operational guides and standard operating procedures.</p>
            <div class="flex gap-2">
              <input id="acad-library-q" oninput="acadLibrarySearch(this.value)" onkeydown="if(event.key==='Enter')acadRunLibrary()" placeholder="Search all operational reference materials…" class="flex-1 px-4 py-2 rounded-xl border border-slate-800 bg-slate-950 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button onclick="acadRunLibrary()" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition">Search</button>
            </div>
            <div id="acad-library-results"></div>
          </div>
        </div>
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
        <div class="max-w-5xl mx-auto space-y-6">
          <div class="flex items-center justify-between p-6 rounded-3xl bg-slate-900 border border-slate-800">
            <div>
              <h1 class="text-xl font-black text-white">Official Dealership Certifications</h1>
              <p class="text-xs text-slate-400">Publicly verifiable credentials issued by MarketSync Academy</p>
            </div>
            <button onclick="closeMarketSyncAcademy()" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition">
              ← Back to Dashboard
            </button>
          </div>

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
          <p class="text-[12px] text-slate-500 px-1 mt-2">A MarketSync credential is issued only when every required course behind it is complete. It is a claim your dealership makes in public, so it is not something that can be granted on request.</p>
        </div>
      `;
    },
  },
};

function loadAcademyWorkspace() { renderEngine('academy') }
window.loadAcademyWorkspace = loadAcademyWorkspace;
