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

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const productLabels = { shared: 'Platform basics', dealer_os: 'DealerOS', facebook: 'Facebook Marketplace', ai_dealer: 'AI Dealer', marketsync_os: 'MarketSync OS' };

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
  const products = [...new Set(visibleLessons.map(item => item.product))];
  const courses = [...new Set(visibleLessons.map(item => item.course))].sort();
  product.innerHTML = '<option value="">All my products</option>' + products.map(id => `<option value="${esc(id)}">${esc(productLabels[id] || id)}</option>`).join('');
  course.innerHTML = '<option value="">All departments</option>' + courses.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
}

function filteredLessons() {
  const query = document.getElementById('training-search').value.trim().toLowerCase();
  const product = document.getElementById('training-product').value;
  const course = document.getElementById('training-course').value;
  return visibleLessons.filter(item => {
    const haystack = [item.id, item.title, item.summary, item.course, ...(item.keywords || []), ...(item.problems || [])].join(' ').toLowerCase();
    return (!query || haystack.includes(query)) && (!product || item.product === product) && (!course || item.course === course);
  });
}

function renderList() {
  const lessons = filteredLessons();
  document.getElementById('lesson-result-count').textContent = `${lessons.length} lesson${lessons.length === 1 ? '' : 's'}`;
  document.getElementById('lesson-list').innerHTML = lessons.length ? lessons.map(item => `
    <button type="button" data-lesson="${esc(item.id)}" class="lesson-link mb-1 w-full rounded-lg border border-transparent p-3 text-left hover:border-indigo-200 hover:bg-indigo-50 dark:hover:border-indigo-900 dark:hover:bg-indigo-950/30">
      <div class="mb-1 flex items-center justify-between gap-2"><span class="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">${esc(item.id)} · ${esc(productLabels[item.product] || item.product)}</span><span class="text-sm">${completed.has(item.id) ? '✅' : '○'}</span></div>
      <div class="text-sm font-black text-slate-900 dark:text-white">${esc(item.title)}</div>
      <div class="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">${esc(item.summary)}</div>
      <div class="mt-2 text-[10px] font-semibold text-slate-400">${esc(item.minutes)} min · ${esc(item.course)}</div>
    </button>`).join('') : '<div class="p-8 text-center text-sm text-slate-500">No lessons match those filters.</div>';
  document.querySelectorAll('.lesson-link').forEach(button => button.addEventListener('click', () => openLesson(button.dataset.lesson)));
}

function section(title, body, tone = 'slate') {
  const tones = { slate: 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60', indigo: 'border-indigo-200 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/30', emerald: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30', amber: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30' };
  return `<section class="rounded-xl border p-5 ${tones[tone] || tones.slate}"><h3 class="mb-3 text-sm font-black uppercase tracking-wider">${esc(title)}</h3>${body}</section>`;
}

function visualTabs(v) {
  if (!v.tabs?.length) return '';
  return `<div class="training-render-tabs">${v.tabs.map(tab => `<span class="${tab === v.activeTab ? 'is-active' : ''}">${esc(tab)}</span>`).join('')}</div>`;
}

function visualMetrics(v) {
  if (!v.metrics?.length) return '';
  return `<div class="training-render-metrics">${v.metrics.map(([label, value]) => `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div>`;
}

function visualFields(v) {
  if (!v.fields?.length) return '';
  return `<div class="training-render-fields">${v.fields.map((field, index) => {
    const [label, value] = String(field).split(' · ');
    return `<div class="${index === 0 ? 'is-focus' : ''}"><span>${esc(label)}</span><strong>${esc(value || 'Review this setting')}</strong></div>`;
  }).join('')}</div>`;
}

function visualTable(v) {
  if (!v.rows?.length) return '';
  const columns = v.columns?.length ? v.columns : ['Time', 'Activity', 'Status'];
  return `<div class="training-render-table"><div class="training-render-tr is-head">${columns.map(column => `<span>${esc(column)}</span>`).join('')}</div>${v.rows.map((row, rowIndex) => `<div class="training-render-tr ${rowIndex === 0 ? 'is-focus' : ''}">${row.map(cell => `<span>${esc(cell)}</span>`).join('')}</div>`).join('')}</div>`;
}

function visualAction(v) {
  return v.action ? `<button type="button" tabindex="-1" class="training-render-action">${esc(v.action)}</button>` : '';
}

function visualBody(v) {
  if (!v) return '';
  if (v.kind === 'login') return `<div class="training-login-card"><div class="training-login-mark">MS</div><h4>${esc(v.title)}</h4><p>${esc(v.state)}</p>${visualFields(v)}${visualAction(v)}</div>`;
  if (v.kind === 'conversation') return `<div class="training-conversation"><div class="training-conversation-list"><strong>Conversations</strong><span class="is-focus">Jordan Lee <small>Appointment intent</small></span><span>Taylor Singh <small>Vehicle question</small></span><span>Website visitor <small>New</small></span></div><div class="training-chat"><div class="training-chat-title">${esc(v.title)} <span>● Live</span></div><div class="training-messages">${(v.messages || []).map(([sender, message], i) => `<div class="${i % 2 ? 'from-customer' : ''}"><small>${esc(sender)}</small>${esc(message)}</div>`).join('')}</div><div class="training-composer">Type a reply… ${visualAction(v)}</div></div></div>`;
  if (v.kind === 'vehicle') return `<div class="training-vehicle"><div class="training-vehicle-photo"><span>Vehicle photo</span><strong>${esc(v.vehicle)}</strong></div><div class="training-vehicle-copy"><div class="training-render-pills">${(v.badges || []).map(badge => `<span>${esc(badge)}</span>`).join('')}</div><h4>${esc(v.vehicle)}</h4><div class="training-vehicle-price">${esc(v.price)} <small>Stock #${esc(v.stock)}</small></div>${visualFields(v)}${visualAction(v)}</div></div>`;
  if (v.kind === 'calendar') return `<div class="training-calendar"><div class="training-calendar-grid">${['MON 3','TUE 4','WED 5','THU 6','FRI 7'].map((day, i) => `<div><strong>${day}</strong>${i === 3 ? '<span class="is-focus">2:30<br>Test drive</span>' : '<span>Available</span>'}</div>`).join('')}</div><div class="training-sidecard"><strong>${esc(v.title)}</strong>${visualFields(v)}${visualAction(v)}</div></div>`;
  if (v.kind === 'pipeline') return `<div>${visualMetrics(v)}<div class="training-pipeline">${(v.stages || [['New','4'],['Working','7'],['Won','2']]).map(([stage, count], i) => `<div><strong>${esc(stage)} <span>${esc(count)}</span></strong>${i === 0 ? `<article class="is-focus">${esc(v.rows?.[0]?.[0] || 'Open record')}<small>${esc(v.rows?.[0]?.[1] || v.state)}</small></article>` : `<article>${esc(v.rows?.[i]?.[0] || 'No urgent items')}<small>${esc(v.rows?.[i]?.[2] || 'In progress')}</small></article>`}</div>`).join('')}</div><div class="training-render-footer">${visualAction(v)}</div></div>`;
  if (v.kind === 'builder') return `<div>${visualTabs(v)}${visualMetrics(v)}<div class="training-builder"><div class="training-builder-controls"><strong>Editor</strong>${visualFields(v)}${visualTable(v)}${visualAction(v)}</div><div class="training-builder-preview"><span>${esc(v.notice || 'Live preview')}</span><div><strong>${esc(v.title)}</strong><p>${esc(v.state)}</p><button tabindex="-1">Preview action</button></div></div></div>`;
  if (v.kind === 'security' || v.kind === 'form' || v.kind === 'integration' || v.kind === 'ai') return `<div>${visualTabs(v)}${visualMetrics(v)}<div class="training-form-layout"><div class="training-form-card"><div class="training-render-pills"><span>${esc(v.state)}</span></div>${visualFields(v)}${visualAction(v)}</div><aside><strong>${v.kind === 'security' ? 'Security check' : v.kind === 'integration' ? 'Connection status' : v.kind === 'ai' ? 'Safe AI setup' : 'Before saving'}</strong><p>${esc(v.notice || 'Review the highlighted field and confirm the current record before saving.')}</p></aside></div>${visualTable(v)}</div>`;
  if (v.kind === 'crm') return `<div>${visualTabs(v)}<div class="training-crm"><aside><div class="training-avatar">JL</div><strong>${esc(v.title)}</strong>${visualFields(v)}${visualAction(v)}</aside><div><strong>${esc(v.activeTab || 'Timeline')}</strong>${visualTable(v)}</div></div></div>`;
  if (v.kind === 'deal') return `<div>${visualTabs(v)}${visualMetrics(v)}<div class="training-deal"><div><strong>Customer & vehicle</strong><p>Jordan Lee</p><p>2025 Chevrolet Equinox RS</p></div><div class="is-focus"><strong>${esc(v.state)}</strong>${visualFields(v)}${visualTable(v)}${visualAction(v)}</div></div></div>`;
  if (v.kind === 'leaderboard') return `<div>${visualMetrics(v)}<div class="training-podium"><div>2<span>Mia</span></div><div class="first">1<span>Alex</span></div><div>3<span>Sam</span></div></div>${visualTable(v)}<div class="training-render-footer">${visualAction(v)}</div></div>`;
  if (v.kind === 'inventory') return `<div>${visualMetrics(v)}<div class="training-inventory"><div class="training-lot-score"><strong>${esc(v.metrics?.[0]?.[1] || '78')}</strong><span>Lot health</span></div>${visualTable(v)}</div><div class="training-render-footer">${visualAction(v)}</div></div>`;
  if (v.kind === 'marketing') return `<div>${visualMetrics(v)}<div class="training-marketing-chart">${[42,70,54,82,64,91,76].map((h, i) => `<span style="height:${h}%"><small>${['M','T','W','T','F','S','S'][i]}</small></span>`).join('')}</div>${visualTable(v)}<div class="training-render-footer">${visualAction(v)}</div></div>`;
  return `<div>${visualTabs(v)}${visualMetrics(v)}${visualFields(v)}${visualTable(v)}<div class="training-render-footer">${visualAction(v)}</div></div>`;
}

function lessonVisual(lesson) {
  const v = lesson.visual;
  if (!v) return '';
  const product = productLabels[lesson.product] || lesson.product;
  const nav = [product, v.nav, v.page].map((label, index) => `<div class="rounded-lg px-2.5 py-2 text-[11px] font-bold ${index === 2 ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400'}">${esc(label)}</div>`).join('');
  return `<figure class="overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm dark:border-indigo-900 dark:bg-slate-950">
    <div class="flex items-center justify-between border-b border-indigo-100 bg-white px-4 py-3 dark:border-indigo-950 dark:bg-slate-900"><div class="flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full bg-rose-400"></span><span class="h-2.5 w-2.5 rounded-full bg-amber-400"></span><span class="h-2.5 w-2.5 rounded-full bg-emerald-400"></span></div><div class="text-[10px] font-black uppercase tracking-[.18em] text-indigo-500">Lesson screen · rendered from dashboard HTML/CSS</div><div class="w-12"></div></div>
    <div class="training-screen training-screen-grid">
      <aside class="training-screen-nav border-r border-indigo-100/80 bg-white/75 p-3 dark:border-indigo-950 dark:bg-slate-950/70"><div class="mb-4 px-2 text-sm font-black">Market<span class="text-indigo-600 dark:text-indigo-400">Sync</span></div><div class="space-y-1">${nav}</div></aside>
      <div class="min-w-0 p-4 sm:p-6"><div class="training-render-header"><div><div class="text-[10px] font-black uppercase tracking-widest text-indigo-500">${esc(v.nav)} · ${esc(v.page)}</div><h3>${esc(v.title)}</h3><p>${esc(v.state)}</p></div><span class="training-step-marker">${esc(lesson.steps[0]?.title || 'Start here')}</span></div>${visualBody(v)}</div>
    </div><figcaption class="border-t border-slate-200 px-4 py-3 text-[11px] leading-4 text-slate-500 dark:border-slate-800">Lesson-specific training render based on the current MarketSync dashboard structure. Live names, counts, dates, and permissions will reflect your account.</figcaption>
  </figure>`;
}

function openLesson(id, updateUrl = true) {
  const lesson = visibleLessons.find(item => item.id === id);
  if (!lesson) return;
  document.getElementById('lesson-empty').classList.add('hidden');
  const panel = document.getElementById('lesson-content');
  panel.classList.remove('hidden');
  const steps = lesson.steps.map(step => `<li class="lesson-step flex gap-4 py-4"><div><div class="font-black text-slate-900 dark:text-white">${esc(step.title)}</div><p class="mt-1 text-sm text-slate-600 dark:text-slate-300">${esc(step.body)}</p></div></li>`).join('');
  panel.innerHTML = `
    <div class="border-b border-slate-200 p-6 dark:border-slate-800 sm:p-8">
      <div class="mb-3 flex flex-wrap gap-2"><span class="rounded-full bg-indigo-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">${esc(productLabels[lesson.product] || lesson.product)}</span><span class="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">${esc(lesson.course)}</span><span class="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">${esc(lesson.minutes)} minutes</span></div>
      <div class="text-xs font-black uppercase tracking-widest text-slate-400">${esc(lesson.id)}</div><h2 class="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">${esc(lesson.title)}</h2><p class="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">${esc(lesson.summary)}</p>
      <div id="lesson-actions" class="mt-5 flex flex-wrap gap-2"><button id="complete-lesson" class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-500">${completed.has(lesson.id) ? '✓ Completed' : 'Mark complete'}</button><button onclick="window.print()" class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold dark:border-slate-700">Print steps</button></div>
    </div>
    <div class="lesson-copy space-y-5 p-6 sm:p-8">
      ${section('What you will accomplish', `<p class="text-sm text-slate-700 dark:text-slate-300">${esc(lesson.outcome)}</p>`, 'indigo')}
      ${section('Who can do this', `<p class="text-sm text-slate-700 dark:text-slate-300">${esc(lesson.who)}</p>`)}
      ${section('Before you start', `<ul class="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">${lesson.before.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`, 'amber')}
      ${lessonVisual(lesson)}
      <section><h3 class="mb-2 text-lg font-black">Step by step</h3><ol class="divide-y divide-slate-200 dark:divide-slate-800">${steps}</ol></section>
      ${section('What success looks like', `<p class="text-sm font-semibold text-emerald-900 dark:text-emerald-200">${esc(lesson.success)}</p>`, 'emerald')}
      ${section('What MarketSync does automatically', `<ul class="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">${lesson.automatic.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`, 'indigo')}
      ${section('Common problems', `<ul class="space-y-2 text-sm text-slate-700 dark:text-slate-300">${lesson.problems.map(item => `<li class="rounded-lg bg-white p-3 shadow-sm dark:bg-slate-900">${esc(item)}</li>`).join('')}</ul>`, 'amber')}
      ${lesson.safety ? section('Safety and compliance', `<p class="text-sm text-slate-700 dark:text-slate-300">${esc(lesson.safety)}</p>`, 'slate') : ''}
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 text-xs text-slate-500 dark:border-slate-800"><span>Last verified: ${esc(lesson.verified)} · Video script: ${lesson.videoStatus === 'ready' ? 'ready to record' : 'planned'}</span><a href="/support.html?topic=training&lesson=${encodeURIComponent(lesson.id)}" class="font-bold text-indigo-600 dark:text-indigo-400">This did not match my screen →</a></div>
    </div>`;
  document.getElementById('complete-lesson').addEventListener('click', () => {
    completed.has(lesson.id) ? completed.delete(lesson.id) : completed.add(lesson.id);
    saveCompletion(); renderSummary(); renderList(); openLesson(lesson.id, false);
  });
  if (updateUrl) history.replaceState({}, '', `${location.pathname}?lesson=${encodeURIComponent(lesson.id)}`);
  document.getElementById('lesson-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderSummary() {
  const finished = visibleLessons.filter(item => completed.has(item.id)).length;
  document.getElementById('academy-visible-count').textContent = visibleLessons.length;
  document.getElementById('academy-complete-count').textContent = finished;
  document.getElementById('academy-progress').textContent = visibleLessons.length ? `${Math.round(finished / visibleLessons.length * 100)}%` : '0%';
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
          fetch('/training/catalog.json?v=20260804c'),
          fetch('/training/catalog-expanded.json?v=20260804c'),
          fetch('/training/visuals.json?v=20260804c'),
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
    document.getElementById('academy-identity').textContent = `${profile.full_name || profile.email || 'Signed in'} · ${profile.dealership?.name || (academyAccess.isPlatformStaff ? 'MarketSync OS' : 'My workspace')}`;
    setOptions(); renderSummary(); renderList();
    ['training-search', 'training-product', 'training-course'].forEach(id => document.getElementById(id).addEventListener(id === 'training-search' ? 'input' : 'change', renderList));
    const requested = new URLSearchParams(location.search).get('lesson');
    if (requested && visibleLessons.some(item => item.id === requested)) openLesson(requested, false);
    else if (visibleLessons[0]) openLesson(visibleLessons[0].id, false);
    document.getElementById('academy-loading').classList.add('hidden');
  } catch (error) {
    if (error.message === 'NO_SESSION' || error.message === 'REQUEST_401') location.replace(`/login.html?next=${encodeURIComponent('/training.html')}`);
    else document.getElementById('academy-loading').innerHTML = '<div class="max-w-md p-8 text-center"><div class="mb-3 text-4xl">⚠️</div><h1 class="text-lg font-black">Training could not load</h1><p class="mt-2 text-sm text-slate-500">Return to the dashboard and try again. If this continues, contact MarketSync support.</p><a href="/dashboard.html" class="mt-5 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white">Back to dashboard</a></div>';
  }
}

bootAcademy();
