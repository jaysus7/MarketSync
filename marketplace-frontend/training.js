function toggleAcademyTheme() {
  const root = document.documentElement;
  const next = root.classList.contains('dark') ? 'light' : 'dark';
  root.classList.toggle('dark', next === 'dark');
  try {
    localStorage.setItem('ms-theme', next);
    localStorage.setItem('theme', next);
  } catch (e) {}
}
window.toggleAcademyTheme = toggleAcademyTheme;

const API = location.hostname.includes('staging')
  ? 'https://marketsync-staging-backend.onrender.com'
  : 'https://vehicle-marketplace-s0e4.onrender.com';
const LOCAL_PREVIEW = window.__TRAINING_PREVIEW__ === true || (['127.0.0.1', 'localhost'].includes(location.hostname)
  && new URLSearchParams(location.search).get('preview') === '1');

let academyUser = null;
let academyAccess = null;
let allLessons = [];
let visibleLessons = [];
let completed = new Set();
let currentView = 'library';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const productLabels = { shared: 'Platform Basics', dealer_os: 'DealerOS Core', facebook: 'Facebook Marketplace', ai_dealer: 'AI Dealer Sales', marketsync_os: 'MarketSync OS' };

function completionKey() { return `ms_training_completed_${academyUser?.id || 'guest'}`; }
function loadCompletion() {
  try { completed = new Set(JSON.parse(localStorage.getItem(completionKey()) || '[]')); }
  catch { completed = new Set(); }
}
function saveCompletion() { localStorage.setItem(completionKey(), JSON.stringify([...completed])); }

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return null;
  const response = await fetch(`${API}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: refreshToken }) });
  if (!response.ok) return null;
  const data = await response.json();
  localStorage.setItem('token', data.access_token);
  if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
  return data.access_token;
}

async function authenticatedJson(path) {
  let token = localStorage.getItem('token');
  if (!token) throw new Error('NO_SESSION');
  let response = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) {
    token = await refreshAccessToken();
    if (!token) throw new Error('NO_SESSION');
    response = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  }
  if (!response.ok) throw new Error(`REQUEST_${response.status}`);
  return response.json();
}

function roleMatches(lesson) {
  if (!lesson.roles?.length) return true;
  const roles = new Set([academyUser?.role, ...(academyAccess?.roleIds || [])].filter(Boolean).map(v => String(v).toLowerCase()));
  return lesson.roles.some(role => roles.has(String(role).toLowerCase()));
}

function lessonAllowed(lesson) {
  if (academyAccess?.isPlatformStaff) return true;
  if (lesson.product === 'marketsync_os') return false;
  if (lesson.product !== 'shared' && !(academyAccess?.products || []).includes(lesson.product)) return false;
  if (lesson.features?.length && !lesson.features.every(feature => (academyAccess?.features || []).includes(feature))) return false;
  if (lesson.permissions?.length && !lesson.permissions.every(permission => (academyAccess?.permissions || []).includes('*') || (academyAccess?.permissions || []).includes(permission))) return false;
  return roleMatches(lesson);
}

function setOptions() {
  const product = document.getElementById('training-product');
  const course = document.getElementById('training-course');
  if (!product || !course) return;
  const products = [...new Set(visibleLessons.map(item => item.product))];
  const courses = [...new Set(visibleLessons.map(item => item.course))].sort();
  product.innerHTML = '<option value="">All Products</option>' + products.map(id => `<option value="${esc(id)}">${esc(productLabels[id] || id)}</option>`).join('');
  course.innerHTML = '<option value="">All Departments</option>' + courses.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
}

function filteredLessons() {
  const query = (document.getElementById('training-search')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('training-status')?.value || '';
  const product = document.getElementById('training-product')?.value || '';
  const course = document.getElementById('training-course')?.value || '';

  return visibleLessons.filter(item => {
    const isDone = completed.has(item.id);
    if (statusFilter === 'completed' && !isDone) return false;
    if (statusFilter === 'in_progress' && isDone) return false;
    if (statusFilter === 'not_started' && isDone) return false;

    const haystack = [item.id, item.title, item.summary, item.course, ...(item.keywords || []), ...(item.problems || [])].join(' ').toLowerCase();
    return (!query || haystack.includes(query)) && (!product || item.product === product) && (!course || item.course === course);
  });
}

function renderList() {
  const lessons = filteredLessons();
  const countEl = document.getElementById('lesson-result-count');
  const listEl = document.getElementById('lesson-list');
  if (countEl) countEl.textContent = `${lessons.length} module${lessons.length === 1 ? '' : 's'}`;
  
  if (!listEl) return;

  listEl.innerHTML = lessons.length ? lessons.map(item => {
    const isDone = completed.has(item.id);
    return `
    <button type="button" data-lesson="${esc(item.id)}" class="lesson-link w-full rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 text-left transition hover:border-indigo-400/60 hover:bg-indigo-50/50 dark:hover:border-indigo-500/50 dark:hover:bg-slate-800/60 ${isDone ? 'bg-slate-50 dark:bg-slate-900/40' : 'bg-white dark:bg-slate-950/60'}">
      <div class="mb-1.5 flex items-center justify-between gap-2">
        <span class="text-[10px] font-black uppercase tracking-wider ${isDone ? 'text-emerald-400' : 'text-indigo-400'}">${esc(item.id)} · ${esc(productLabels[item.product] || item.product)}</span>
        <span class="inline-flex items-center gap-1 text-[11px] font-extrabold ${isDone ? 'text-emerald-400' : 'text-slate-400'}">
          ${isDone ? '<svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Done' : '○ Pending'}
        </span>
      </div>
      <div class="text-xs font-black text-white leading-snug">${esc(item.title)}</div>
      <div class="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-400">${esc(item.summary)}</div>
      
      <!-- Progress Bar Graph Per Course Item -->
      <div class="mt-3 flex items-center gap-2">
        <div class="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
          <div class="h-full rounded-full ${isDone ? 'bg-emerald-400' : 'bg-indigo-500'}" style="width: ${isDone ? '100%' : '15%'}"></div>
        </div>
        <span class="text-[10px] font-bold text-slate-400">${isDone ? '100%' : '0%'}</span>
      </div>
    </button>`;
  }).join('') : '<div class="p-6 text-center text-xs text-slate-400">No course modules match your search filters.</div>';

  document.querySelectorAll('.lesson-link').forEach(button => button.addEventListener('click', () => openLesson(button.dataset.lesson)));
}

function section(title, body, tone = 'slate') {
  const tones = {
    slate: 'border-slate-800 bg-slate-950/60',
    indigo: 'border-indigo-500/30 bg-indigo-950/30 text-indigo-200',
    emerald: 'border-emerald-500/30 bg-emerald-950/30 text-emerald-200',
    amber: 'border-amber-500/30 bg-amber-950/30 text-amber-200'
  };
  return `<section class="rounded-xl border p-5 ${tones[tone] || tones.slate}"><h3 class="mb-3 text-xs font-black uppercase tracking-wider text-slate-300">${esc(title)}</h3>${body}</section>`;
}

function videoPlayerBox(lesson) {
  return `
  <div class="mb-6 overflow-hidden rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-slate-950 shadow-2xl relative">
    <div class="relative aspect-video w-full bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-6 text-center">
      
      <!-- Video player chrome -->
      <div class="absolute top-4 left-4 flex items-center gap-2">
        <span class="px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
          <span class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span> Video Lesson Stream
        </span>
        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">1080p HD</span>
      </div>

      <div class="absolute top-4 right-4 text-xs font-bold text-slate-400 flex items-center gap-1.5">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        ${esc(lesson.minutes)} mins
      </div>

      <!-- Play Button Overlay -->
      <div class="group relative cursor-pointer flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600/90 text-white shadow-2xl shadow-indigo-500/50 transition-all hover:scale-110 hover:bg-indigo-500">
        <svg class="w-7 h-7 ml-1 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      </div>

      <div class="mt-4 max-w-md">
        <h4 class="text-sm font-black text-white">${esc(lesson.title)}</h4>
        <p class="mt-1 text-xs text-slate-400">Video recording in production — interactive walkthrough guide active below.</p>
      </div>

      <!-- Video Control Bar Mockup -->
      <div class="absolute bottom-0 inset-x-0 h-10 bg-slate-950/80 backdrop-blur-md px-4 flex items-center justify-between border-t border-slate-800 text-xs text-slate-400">
        <div class="flex items-center gap-3">
          <button class="hover:text-white"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></button>
          <span>00:00 / ${esc(lesson.minutes)}:00</span>
        </div>
        <div class="h-1 flex-1 mx-4 rounded-full bg-slate-800 overflow-hidden cursor-pointer">
          <div class="h-full bg-indigo-500" style="width: 25%"></div>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">1.0x</span>
          <button class="hover:text-white"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5"/></svg></button>
        </div>
      </div>
    </div>
  </div>`;
}

function openLesson(id, updateUrl = true) {
  const lesson = visibleLessons.find(item => item.id === id);
  if (!lesson) return;
  
  const emptyPanel = document.getElementById('lesson-empty');
  if (emptyPanel) emptyPanel.classList.add('hidden');
  
  const panel = document.getElementById('lesson-content');
  if (!panel) return;
  panel.classList.remove('hidden');

  const isDone = completed.has(lesson.id);
  const steps = (lesson.steps || []).map(step => `<li class="lesson-step flex gap-4 py-4"><div class="flex-1"><div class="font-black text-white">${esc(step.title)}</div><p class="mt-1 text-sm text-slate-300">${esc(step.body)}</p></div></li>`).join('');

  panel.innerHTML = `
    <div class="border-b border-slate-200 dark:border-slate-800 p-6 sm:p-8 bg-slate-50 dark:bg-slate-950/40">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <span class="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-400">${esc(productLabels[lesson.product] || lesson.product)}</span>
        <span class="rounded-full bg-slate-800 px-3 py-1 text-[10px] font-bold text-slate-300">${esc(lesson.course)}</span>
        <span class="rounded-full bg-slate-800 px-3 py-1 text-[10px] font-bold text-slate-300">${esc(lesson.minutes)} mins</span>
      </div>

      <div class="text-xs font-black uppercase tracking-widest text-slate-400">${esc(lesson.id)}</div>
      <h2 class="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-white">${esc(lesson.title)}</h2>
      <p class="mt-3 max-w-3xl text-sm leading-6 text-slate-300">${esc(lesson.summary)}</p>
      
      <div id="lesson-actions" class="mt-6 flex flex-wrap items-center gap-3">
        <button id="complete-lesson" class="flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black transition ${isDone ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/30' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/30'}">
          ${isDone ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Completed' : 'Mark Lesson Complete'}
        </button>
        <button onclick="window.print()" class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white transition">Print Guide</button>
      </div>
    </div>

    <div class="lesson-copy space-y-6 p-6 sm:p-8">
      <!-- Video Player Stream Container -->
      ${videoPlayerBox(lesson)}

      ${section('What you will accomplish', `<p class="text-sm text-slate-300">${esc(lesson.outcome)}</p>`, 'indigo')}
      ${section('Target Roles & Users', `<p class="text-sm text-slate-300">${esc(lesson.who)}</p>`)}
      ${section('Prerequisites', `<ul class="list-disc space-y-1 pl-5 text-sm text-slate-300">${(lesson.before || []).map(item => `<li>${esc(item)}</li>`).join('')}</ul>`, 'amber')}
      
      <section><h3 class="mb-3 text-lg font-black text-white">Step by Step Walkthrough</h3><ol class="divide-y divide-slate-800 border-t border-b border-slate-800">${steps}</ol></section>
      
      ${section('What Success Looks Like', `<p class="text-sm font-semibold text-emerald-300">${esc(lesson.success)}</p>`, 'emerald')}
      ${section('MarketSync Automated Engine Tasks', `<ul class="list-disc space-y-1 pl-5 text-sm text-slate-300">${(lesson.automatic || []).map(item => `<li>${esc(item)}</li>`).join('')}</ul>`, 'indigo')}
      
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-5 text-xs text-slate-400">
        <span>Last verified: ${esc(lesson.verified)}</span>
        <a href="/support.html?topic=training&lesson=${encodeURIComponent(lesson.id)}" class="font-bold text-indigo-400 hover:underline">Report an issue &rarr;</a>
      </div>
    </div>`;

  const btn = document.getElementById('complete-lesson');
  if (btn) {
    btn.addEventListener('click', () => {
      completed.has(lesson.id) ? completed.delete(lesson.id) : completed.add(lesson.id);
      saveCompletion();
      renderSummary();
      renderList();
      openLesson(lesson.id, false);
    });
  }

  if (updateUrl) history.replaceState({}, '', `${location.pathname}?lesson=${encodeURIComponent(lesson.id)}`);
  document.getElementById('lesson-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderSummary() {
  const finished = visibleLessons.filter(item => completed.has(item.id)).length;
  const pct = visibleLessons.length ? Math.round((finished / visibleLessons.length) * 100) : 0;
  
  const visEl = document.getElementById('academy-visible-count');
  const compEl = document.getElementById('academy-complete-count');
  const pctEl = document.getElementById('academy-progress-percent');
  const barEl = document.getElementById('academy-progress-bar');
  const certCountEl = document.getElementById('academy-cert-count');

  if (visEl) visEl.textContent = visibleLessons.length;
  if (compEl) compEl.textContent = finished;
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (barEl) barEl.style.width = `${pct}%`;
  
  const certsEarned = Math.floor(finished / 3); // 1 cert per 3 modules
  if (certCountEl) certCountEl.textContent = certsEarned;
}

function switchAcademyView(tab) {
  currentView = tab;
  const libView = document.getElementById('academy-library-view');
  const certsView = document.getElementById('academy-certs-view');
  const libBtn = document.getElementById('tab-btn-library');
  const certsBtn = document.getElementById('tab-btn-certs');

  if (tab === 'certs') {
    if (libView) libView.classList.add('hidden');
    if (certsView) certsView.classList.remove('hidden');
    if (libBtn) libBtn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:text-white transition';
    if (certsBtn) certsBtn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white transition';
    renderCertificatesView();
  } else {
    if (certsView) certsView.classList.add('hidden');
    if (libView) libView.classList.remove('hidden');
    if (libBtn) libBtn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white transition';
    if (certsBtn) certsBtn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:text-white transition';
  }
}
window.switchAcademyView = switchAcademyView;

function renderCertificatesView() {
  const container = document.getElementById('academy-certs-grid');
  if (!container) return;

  const finishedCount = visibleLessons.filter(item => completed.has(item.id)).length;
  const studentName = academyUser?.full_name || 'Dealership Professional';

  const certificates = [
    { title: 'MarketSync DealerOS Core Certified', desc: 'Mastery of DealerOS CRM, Inventory, and Sales Pipelines.', required: 2, key: 'core' },
    { title: 'Facebook Marketplace AutoPoster Specialist', desc: 'Expertise in high-conversion vehicle posting and leaderboard tracking.', required: 4, key: 'fb' },
    { title: 'AI Dealer Sales ChatBot Operator', desc: 'Certified in 24/7 AI lead capture, live vehicle card dispatch, and human takeover.', required: 6, key: 'ai' }
  ];

  container.innerHTML = certificates.map(cert => {
    const isEarned = finishedCount >= cert.required;
    const certId = `MS-ACAD-${cert.key.toUpperCase()}-${Math.abs(studentName.length * 777)}`;

    return `
    <div class="ac-panel rounded-2xl p-6 flex flex-col justify-between ${isEarned ? 'ring-1 ring-amber-400/40' : ''}">
      <div>
        <div class="flex items-center justify-between mb-3">
          <span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${isEarned ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-600 border border-slate-200'}">
            ${isEarned ? 'Official Certification' : 'In Progress'}
          </span>
          <span class="ac-muted text-xs font-mono">${esc(certId)}</span>
        </div>
        <h3 class="ac-title text-base font-black">${esc(cert.title)}</h3>
        <p class="ac-muted text-xs mt-2 leading-relaxed">${esc(cert.desc)}</p>
      </div>

      <div class="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800/80">
        ${isEarned ? `
          <div class="mb-3 text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
            <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Issued to ${esc(studentName)}
          </div>
          <button onclick="window.print()" class="w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs py-2.5 shadow-lg shadow-amber-500/20 transition">Print Official Certificate</button>
        ` : `
          <div class="mb-2 flex justify-between text-[11px] font-bold text-slate-400">
            <span>Progress (${finishedCount}/${cert.required} Modules)</span>
            <span>${Math.round(Math.min(100, (finishedCount / cert.required) * 100))}%</span>
          </div>
          <div class="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div class="h-full bg-indigo-500" style="width: ${Math.min(100, (finishedCount / cert.required) * 100)}%"></div>
          </div>
        `}
      </div>
    </div>`;
  }).join('');
}

async function bootAcademy() {
  try {
    const previewProfile = {
      id: 'academy-preview', full_name: 'DealerOS Pro Preview', role: 'DEALER_ADMIN',
      dealership: { name: 'Training Dealership' },
      access: {
        isPlatformStaff: false, roleIds: ['dealer_owner'],
        products: ['dealer_os', 'facebook', 'ai_dealer'],
        features: ['os.dashboard', 'os.crm', 'os.inventory', 'os.sales', 'os.accounting', 'os.service', 'os.marketing', 'os.website', 'os.reports', 'os.automations', 'os.email_marketing', 'os.integrations', 'os.team', 'os.settings', 'fb.inventory', 'fb.leaderboard', 'fb.sales_reps', 'ai.overview', 'ai.conversations', 'ai.agents', 'ai.knowledge', 'ai.settings'],
        permissions: ['*'],
      },
    };
    const catalogRequest = window.__TRAINING_CATALOG__
      ? Promise.resolve(window.__TRAINING_CATALOG__)
      : Promise.all([
          fetch('/training/catalog.json?v=20260826_academy_brand_v1'),
          fetch('/training/catalog-expanded.json?v=20260826_academy_brand_v1'),
          fetch('/training/visuals.json?v=20260826_academy_brand_v1'),
        ]).then(async responses => {
          if (responses.some(response => !response.ok)) throw new Error('CATALOG');
          const [core, expanded, visualCatalog] = await Promise.all(responses.map(response => response.json()));
          return { lessons: [...(core.lessons || []), ...(expanded.lessons || [])], visuals: visualCatalog.visuals || {} };
        });
    const [profile, catalog] = await Promise.all([LOCAL_PREVIEW ? Promise.resolve(previewProfile) : authenticatedJson('/auth/me'), catalogRequest]);
    academyUser = profile;
    academyAccess = profile.access || await authenticatedJson('/access/context');
    allLessons = (catalog.lessons || []).map(lesson => ({ ...lesson, visual: catalog.visuals?.[lesson.id] || lesson.visual }));
    visibleLessons = allLessons.filter(lessonAllowed);
    loadCompletion();

    const identityEl = document.getElementById('academy-identity');
    if (identityEl) {
      identityEl.textContent = `${profile.full_name || profile.email || 'Student'} · ${profile.dealership?.name || 'Dealership Team'}`;
    }

    setOptions();
    renderSummary();
    renderList();

    ['training-search', 'training-status', 'training-product', 'training-course'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(id === 'training-search' ? 'input' : 'change', renderList);
    });

    const requested = new URLSearchParams(location.search).get('lesson');
    if (requested && visibleLessons.some(item => item.id === requested)) openLesson(requested, false);
    else if (visibleLessons[0]) openLesson(visibleLessons[0].id, false);

    document.getElementById('academy-loading')?.classList.add('hidden');
  } catch (error) {
    if (error.message === 'NO_SESSION' || error.message === 'REQUEST_401') location.replace(`/login.html?next=${encodeURIComponent('/training.html')}`);
    else {
      const loadingEl = document.getElementById('academy-loading');
      if (loadingEl) {
        loadingEl.innerHTML = '<div class="max-w-md p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm"><h1 class="text-lg font-black text-slate-900 dark:text-white">Academy could not load</h1><p class="mt-2 text-xs text-slate-500 dark:text-slate-400">Return to the dashboard and try again.</p><a href="/dashboard.html" target="_blank" rel="noopener noreferrer" class="mt-5 inline-block rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white">Back to dashboard</a></div>';
      }
    }
  }
}

bootAcademy();
