/**
 * Studio-embedded social scheduler — Design Studio's own entry point to the social
 * scheduler/accounts/calendar features, now bundled into the product (see
 * plan-catalog.js's design_studio feature set). Deliberately NOT a reuse of
 * marketing-workspace.js's mktCompose()/mktReload(): those read from and write back
 * into ENGINE_DATA['marketing-overview'] and call engineTab()/msSyncRoute(), which
 * assume the full DealerOS Marketing engine page is mounted at
 * #marketing-overview-root. A Design-Studio-only account never renders that page —
 * they land straight in this full-screen editor — so that DOM target doesn't exist
 * for them and those calls would silently fail or misroute. This file talks to the
 * same /social/* and /marketing/assets endpoints directly and manages its own
 * self-contained overlay state instead.
 */

let __studioSchedulerPosts = [];
let __studioSchedulerAccounts = [];
let __studioSchedulerView = 'calendar';   // 'calendar' | 'week' | 'list'
let __studioSchedulerCalMonth = new Date();
let __studioSchedulerMfaRequired = false;
let __studioSchedulerFilterPlatform = 'all'; // 'all' | 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'youtube'
let __studioSchedulerFilterStatus = 'all';   // 'all' | 'draft' | 'scheduled' | 'published' | 'failed'
let __studioActiveCaptionPlatform = 'shared'; // 'shared' | 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'youtube'

/**
 * Ensures the canonical full-screen Design Studio workspace is active before opening any Schedule UI
 */
async function ensureStudioWorkspaceActive() {
  const masterModal = document.getElementById('ms-studio-master-modal');
  if (!masterModal || masterModal.classList.contains('hidden') || masterModal.style.display === 'none') {
    if (typeof window.openMarketSyncStudio === 'function') {
      await window.openMarketSyncStudio(null, { skipInitAdapter: true });
    } else if (typeof switchPage === 'function') {
      switchPage('marketing');
    }
  }
}

/**
 * Main Schedule entry point — always opens inside the full-screen Design Studio workspace
 */
async function openStudioScheduler(options = {}) {
  await ensureStudioWorkspaceActive();

  // Remove existing schedule overlay if present
  document.getElementById('studio-scheduler-overlay')?.remove();

  const studioModal = document.getElementById('ms-studio-master-modal') || document.body;

  const overlay = document.createElement('div');
  overlay.id = 'studio-scheduler-overlay';
  overlay.className = 'fixed inset-0 z-[100000] bg-slate-950/80 backdrop-blur-md flex flex-col justify-center items-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-150';
  overlay.innerHTML = `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
      <!-- Header -->
      <div class="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5"/></svg>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-base font-black text-slate-900 dark:text-white">Design Studio Social Calendar &amp; Scheduler</h2>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">Design Studio</span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400">Manage, preview, and automate scheduled artwork across all connected social channels.</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="studioSchedulerCompose()" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            <span>+ Schedule a Post</span>
          </button>
          <button onclick="closeStudioScheduler()" class="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer" title="Return to Design Studio Canvas">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
      </div>

      <!-- Controls bar (Views, Date Navigation, Filters) -->
      <div class="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3 bg-white dark:bg-slate-900 shrink-0">
        <!-- View switchers -->
        <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button id="studio-sched-view-cal" onclick="studioSchedulerSetView('calendar')" class="text-xs font-bold px-3 py-1.5 rounded-lg transition ${__studioSchedulerView === 'calendar' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'}">Month</button>
          <button id="studio-sched-view-week" onclick="studioSchedulerSetView('week')" class="text-xs font-bold px-3 py-1.5 rounded-lg transition ${__studioSchedulerView === 'week' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'}">Week</button>
          <button id="studio-sched-view-list" onclick="studioSchedulerSetView('list')" class="text-xs font-bold px-3 py-1.5 rounded-lg transition ${__studioSchedulerView === 'list' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'}">List</button>
        </div>

        <!-- Month / Navigation -->
        <div class="flex items-center gap-2">
          <button onclick="studioSchedulerMoveMonth(-1)" class="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition">‹</button>
          <button onclick="studioSchedulerToday()" class="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition">Today</button>
          <button onclick="studioSchedulerMoveMonth(1)" class="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition">›</button>
          <span id="studio-sched-cal-title" class="text-sm font-black text-slate-900 dark:text-white px-2"></span>
        </div>

        <!-- Filters: Platform & Status -->
        <div class="flex items-center gap-2 flex-wrap text-xs">
          <select id="studio-sched-filter-plat" onchange="studioSchedulerFilterPlat(this.value)" class="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-slate-200 font-bold">
            <option value="all">All Channels</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="linkedin">LinkedIn</option>
            <option value="tiktok">TikTok</option>
            <option value="youtube">YouTube</option>
          </select>
          <select id="studio-sched-filter-stat" onchange="studioSchedulerFilterStat(this.value)" class="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-slate-200 font-bold">
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      <!-- Main Schedule Content -->
      <div id="studio-sched-body" class="p-5 flex-1 overflow-y-auto min-h-[360px] space-y-4">
        <div class="text-sm text-slate-400 italic py-12 text-center">Loading scheduled posts…</div>
      </div>
    </div>
  `;

  studioModal.appendChild(overlay);
  await loadStudioSchedulerPosts();
}
window.openStudioScheduler = openStudioScheduler;
window.openSocialSchedule = openStudioScheduler;
window.openScheduleModal = openStudioScheduler;
window.openSocialScheduler = openStudioScheduler;

function closeStudioScheduler() {
  document.getElementById('studio-scheduler-overlay')?.remove();
}
window.closeStudioScheduler = closeStudioScheduler;

function studioSchedulerMfaNotice() {
  return `<div class="text-[12px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">Multi-factor authentication is required to view or manage scheduled posts. Complete MFA in your profile settings.</div>`;
}

function studioSchedulerSetView(view) {
  __studioSchedulerView = view;
  ['cal', 'week', 'list'].forEach(v => {
    const btn = document.getElementById(`studio-sched-view-${v}`);
    if (!btn) return;
    const active = (v === 'cal' && view === 'calendar') || (v === view);
    btn.className = `text-xs font-bold px-3 py-1.5 rounded-lg transition ${active ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`;
  });
  renderStudioScheduler();
}
window.studioSchedulerSetView = studioSchedulerSetView;

function studioSchedulerMoveMonth(delta) {
  __studioSchedulerCalMonth = new Date(__studioSchedulerCalMonth.getFullYear(), __studioSchedulerCalMonth.getMonth() + delta, 1);
  renderStudioScheduler();
}
window.studioSchedulerMoveMonth = studioSchedulerMoveMonth;

function studioSchedulerToday() {
  __studioSchedulerCalMonth = new Date();
  renderStudioScheduler();
}
window.studioSchedulerToday = studioSchedulerToday;

function studioSchedulerFilterPlat(plat) {
  __studioSchedulerFilterPlatform = plat;
  renderStudioScheduler();
}
window.studioSchedulerFilterPlat = studioSchedulerFilterPlat;

function studioSchedulerFilterStat(stat) {
  __studioSchedulerFilterStatus = stat;
  renderStudioScheduler();
}
window.studioSchedulerFilterStat = studioSchedulerFilterStat;

async function loadStudioSchedulerPosts() {
  try {
    const [pRes, aRes] = await Promise.all([
      apiGetJson('/social/posts'),
      apiGetJson('/social/accounts').catch(() => ({ accounts: [] })),
    ]);
    __studioSchedulerPosts = pRes.posts || [];
    __studioSchedulerAccounts = aRes.accounts || [];
    __studioSchedulerMfaRequired = false;
  } catch (e) {
    if (e?.message === 'MFA_REQUIRED') {
      __studioSchedulerMfaRequired = true;
      __studioSchedulerPosts = [];
    } else {
      __studioSchedulerPosts = [];
    }
  }
  renderStudioScheduler();
}

function getFilteredSchedulerPosts() {
  return __studioSchedulerPosts.filter(p => {
    if (__studioSchedulerFilterStatus !== 'all') {
      if (p.status !== __studioSchedulerFilterStatus) return false;
    }
    if (__studioSchedulerFilterPlatform !== 'all') {
      const targets = p.targets || [];
      const hasPlat = targets.some(t => {
        const acc = __studioSchedulerAccounts.find(a => a.id === t.social_account_id);
        return acc && acc.provider === __studioSchedulerFilterPlatform;
      });
      if (!hasPlat) return false;
    }
    return true;
  });
}

function renderStudioScheduler() {
  const titleEl = document.getElementById('studio-sched-cal-title');
  if (titleEl) {
    titleEl.textContent = __studioSchedulerCalMonth.toLocaleDateString([], { month: 'long', year: 'numeric' });
  }

  if (__studioSchedulerView === 'calendar') renderStudioSchedulerCalendar();
  else if (__studioSchedulerView === 'week') renderStudioSchedulerWeek();
  else renderStudioSchedulerList();
}

/**
 * Month Calendar View with Drag and Drop Rescheduling
 */
function renderStudioSchedulerCalendar() {
  const body = document.getElementById('studio-sched-body');
  if (!body) return;

  if (__studioSchedulerMfaRequired) {
    body.innerHTML = `<div class="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">Multi-factor authentication is required to view scheduled social posts. Complete MFA in profile settings.</div>`;
    return;
  }

  const posts = getFilteredSchedulerPosts();
  const byDate = {};
  for (const p of posts) {
    if (!p.scheduled_local && !p.created_at) continue;
    const d = new Date(p.scheduled_local || p.created_at);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    (byDate[key] = byDate[key] || []).push(p);
  }

  const month = __studioSchedulerCalMonth;
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const cells = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push('<div class="min-h-[110px] bg-slate-50/40 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/40 rounded-xl p-1"></div>');
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayPosts = (byDate[key] || []).sort((a, b) => new Date(a.scheduled_local || 0) - new Date(b.scheduled_local || 0));
    const isToday = todayKey === key;

    const cardsHtml = dayPosts.slice(0, 3).map(p => {
      const isFailed = p.status === 'failed';
      const isPub = p.status === 'published';
      const isDraft = p.status === 'draft';
      const timeStr = p.scheduled_local ? new Date(p.scheduled_local).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Draft';
      const thumb = p.media?.[0] || '';
      
      const badgeCls = isFailed ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' :
                       isPub ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' :
                       isDraft ? 'bg-slate-500/20 text-slate-400' :
                       'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30';

      return `
        <div draggable="true" ondragstart="studioCalendarDrag(event, '${esc(p.id)}')" onclick="event.stopPropagation(); studioSchedulerEditPost('${esc(p.id)}')"
          class="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-500 dark:hover:border-indigo-400 shadow-xs cursor-grab active:cursor-grabbing transition group mb-1 text-left">
          <div class="flex items-center gap-1.5">
            ${thumb ? `<img src="${esc(thumb)}" class="w-6 h-6 rounded object-cover shrink-0 border border-slate-200 dark:border-slate-700">` : `<div class="w-6 h-6 rounded bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-[9px] shrink-0">Art</div>`}
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-1">
                <span class="text-[9px] font-black ${isFailed ? 'text-rose-500 font-extrabold' : 'text-indigo-600 dark:text-indigo-400'} truncate">${esc(timeStr)}</span>
                <span class="px-1 py-0.2 rounded text-[8px] font-black uppercase ${badgeCls}">${esc(p.status)}</span>
              </div>
              <div class="text-[10px] font-medium text-slate-800 dark:text-slate-200 truncate">${esc(p.body || 'Untitled Post')}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const moreCount = dayPosts.length > 3 ? dayPosts.length - 3 : 0;

    cells.push(`
      <div ondragover="event.preventDefault()" ondrop="studioCalendarDrop(event, '${key}')" onclick="studioSchedulerOpenDay('${key}')"
        class="min-h-[110px] border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 flex flex-col justify-between transition cursor-pointer hover:border-indigo-400 ${isToday ? 'bg-indigo-50/40 dark:bg-indigo-950/20 ring-1 ring-indigo-500/30' : 'bg-white dark:bg-slate-900'}">
        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-black ${isToday ? 'w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]' : 'text-slate-400'}">${day}</span>
            <button onclick="event.stopPropagation(); studioSchedulerCompose(null, '${key}')" class="text-[10px] text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-black px-1" title="Schedule on this date">+</button>
          </div>
          <div class="space-y-1">
            ${cardsHtml}
          </div>
        </div>
        ${moreCount > 0 ? `<div class="text-[9px] font-bold text-indigo-500 px-1 pt-1 text-center">+${moreCount} more</div>` : ''}
      </div>
    `);
  }

  body.innerHTML = `
    <div class="grid grid-cols-7 gap-1 text-center text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
      ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div>${d}</div>`).join('')}
    </div>
    <div class="grid grid-cols-7 gap-1.5">
      ${cells.join('')}
    </div>
  `;
}

/**
 * Week Calendar View
 */
function renderStudioSchedulerWeek() {
  const body = document.getElementById('studio-sched-body');
  if (!body) return;

  const posts = getFilteredSchedulerPosts();
  const byDate = {};
  for (const p of posts) {
    if (!p.scheduled_local && !p.created_at) continue;
    const d = new Date(p.scheduled_local || p.created_at);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    (byDate[key] = byDate[key] || []).push(p);
  }

  const today = new Date();
  const curr = new Date(__studioSchedulerCalMonth);
  const firstDay = new Date(curr.setDate(curr.getDate() - curr.getDay()));
  const weekDays = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(firstDay);
    d.setDate(d.getDate() + i);
    weekDays.push(d);
  }

  const cols = weekDays.map(d => {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayPosts = byDate[key] || [];
    const isToday = today.toISOString().split('T')[0] === key;

    const cards = dayPosts.map(p => `
      <div onclick="studioSchedulerEditPost('${esc(p.id)}')" class="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-indigo-500 cursor-pointer transition space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-black text-indigo-500">${p.scheduled_local ? new Date(p.scheduled_local).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Draft'}</span>
          <span class="px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${p.status === 'published' ? 'bg-emerald-500/20 text-emerald-500' : p.status === 'failed' ? 'bg-rose-500/20 text-rose-500' : 'bg-indigo-500/20 text-indigo-400'}">${esc(p.status)}</span>
        </div>
        ${p.media?.[0] ? `<img src="${esc(p.media[0])}" class="w-full h-20 object-cover rounded-lg border border-slate-100 dark:border-slate-800">` : ''}
        <div class="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-2">${esc(p.body || '(no caption)')}</div>
      </div>
    `).join('');

    return `
      <div ondragover="event.preventDefault()" ondrop="studioCalendarDrop(event, '${key}')" class="border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex flex-col justify-between space-y-3 min-h-[300px] ${isToday ? 'bg-indigo-50/30 dark:bg-indigo-950/20 ring-1 ring-indigo-500/40' : 'bg-slate-50/50 dark:bg-slate-950/50'}">
        <div>
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-2">
            <div>
              <div class="text-[10px] font-bold uppercase text-slate-400">${d.toLocaleDateString([], { weekday: 'short' })}</div>
              <div class="text-sm font-black text-slate-900 dark:text-white">${d.getDate()}</div>
            </div>
            <button onclick="studioSchedulerCompose(null, '${key}')" class="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] rounded-lg cursor-pointer">+</button>
          </div>
          <div class="space-y-2">
            ${cards || `<div class="text-xs text-slate-400 italic text-center py-6">No posts</div>`}
          </div>
        </div>
      </div>
    `;
  }).join('');

  body.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
      ${cols}
    </div>
  `;
}

/**
 * List View
 */
function renderStudioSchedulerList() {
  const body = document.getElementById('studio-sched-body');
  if (!body) return;

  if (__studioSchedulerMfaRequired) {
    body.innerHTML = studioSchedulerMfaNotice();
    return;
  }

  const posts = getFilteredSchedulerPosts();
  if (!posts.length) {
    body.innerHTML = `
      <div class="p-12 text-center space-y-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div class="text-3xl">Cal</div>
        <h3 class="text-sm font-black text-slate-900 dark:text-white">No Scheduled Posts Found</h3>
        <p class="text-xs text-slate-400 max-w-sm mx-auto">Create a graphic in Design Studio and schedule it to publish automatically across your connected channels.</p>
        <button onclick="studioSchedulerCompose()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer">+ Schedule First Post</button>
      </div>
    `;
    return;
  }

  const rows = posts.map(p => {
    const thumb = p.media?.[0] || '';
    const dateStr = p.scheduled_local ? new Date(p.scheduled_local).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Draft';
    const isFailed = p.status === 'failed';
    const isPub = p.status === 'published';

    return `
      <div onclick="studioSchedulerEditPost('${esc(p.id)}')" class="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-indigo-500 transition flex items-center justify-between flex-wrap gap-4 cursor-pointer">
        <div class="flex items-center gap-4 min-w-0 flex-1">
          ${thumb ? `<img src="${esc(thumb)}" class="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0">` : `<div class="w-16 h-16 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center font-bold text-xl shrink-0">Art</div>`}
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${isFailed ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' : isPub ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'}">${esc(p.status)}</span>
              <span class="text-xs font-bold text-slate-500 dark:text-slate-400">${esc(dateStr)}</span>
            </div>
            <div class="text-sm font-black text-slate-900 dark:text-white truncate">${esc(p.body || '(No caption provided)')}</div>
            ${p.failure_reason ? `<div class="text-[11px] font-bold text-rose-500">Error: ${esc(p.failure_reason)}</div>` : ''}
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          ${isFailed ? `<button onclick="event.stopPropagation(); studioSchedulerPublishNow('${esc(p.id)}')" class="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-xs">Retry Now</button>` : ''}
          <button onclick="event.stopPropagation(); studioSchedulerEditPost('${esc(p.id)}')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs">Inspect &amp; Edit</button>
        </div>
      </div>
    `;
  }).join('');

  body.innerHTML = `<div class="space-y-3">${rows}</div>`;
}

/**
 * Drag and Drop Rescheduling Handlers
 */
function studioCalendarDrag(e, postId) {
  e.dataTransfer.setData('text/plain', postId);
}
window.studioCalendarDrag = studioCalendarDrag;

async function studioCalendarDrop(e, targetDateStr) {
  e.preventDefault();
  const postId = e.dataTransfer.getData('text/plain');
  if (!postId || !targetDateStr) return;

  const post = __studioSchedulerPosts.find(p => p.id === postId);
  if (!post) return;

  // Preserve existing scheduled time if available, otherwise default to 09:00 AM
  let time = '09:00';
  if (post.scheduled_local) {
    try { time = new Date(post.scheduled_local).toTimeString().slice(0, 5); } catch {}
  }

  const updatedDatetime = `${targetDateStr}T${time}`;
  try {
    await apiSendJson(`/social/posts/${postId}`, 'PUT', { scheduled_local: updatedDatetime });
    if (typeof showToast === 'function') showToast(`Post rescheduled to ${targetDateStr} at ${time}`, 'success');
    loadStudioSchedulerPosts();
  } catch (err) {
    if (typeof showToast === 'function') showToast(err.message, 'error');
  }
}
window.studioCalendarDrop = studioCalendarDrop;

/**
 * Day Drawer / Modal
 */
function studioSchedulerOpenDay(dateStr) {
  const posts = __studioSchedulerPosts.filter(p => {
    const d = p.scheduled_local || p.created_at;
    return d && d.startsWith(dateStr);
  });

  const cards = posts.map(p => `
    <div onclick="studioSchedulerEditPost('${esc(p.id)}')" class="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 cursor-pointer hover:border-indigo-500 transition">
      <div class="flex items-center gap-3 min-w-0">
        ${p.media?.[0] ? `<img src="${esc(p.media[0])}" class="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0">` : `<div class="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-base shrink-0">Art</div>`}
        <div class="min-w-0">
          <div class="text-[10px] font-black text-indigo-500">${p.scheduled_local ? new Date(p.scheduled_local).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Draft'}</div>
          <div class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">${esc(p.body || '(No caption)')}</div>
        </div>
      </div>
      <span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${p.status === 'published' ? 'bg-emerald-500/20 text-emerald-500' : p.status === 'failed' ? 'bg-rose-500/20 text-rose-500' : 'bg-indigo-500/20 text-indigo-400'}">${esc(p.status)}</span>
    </div>
  `).join('');

  const ov = crmOverlay(`
    <div class="p-5 space-y-4">
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h3 class="text-base font-black text-slate-900 dark:text-white">Scheduled for ${esc(dateStr)}</h3>
          <p class="text-xs text-slate-400">${posts.length} post(s) scheduled on this day.</p>
        </div>
        <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-200 text-sm font-bold">x</button>
      </div>
      <div class="space-y-2 max-h-80 overflow-y-auto">
        ${cards || `<div class="text-xs text-slate-400 italic py-8 text-center">No posts scheduled for this day.</div>`}
      </div>
      <div class="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between">
        <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 text-xs font-bold text-slate-500">Close</button>
        <button onclick="this.closest('.fixed').remove(); studioSchedulerCompose(null, '${esc(dateStr)}')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md">+ Schedule Post on this Date</button>
      </div>
    </div>
  `, 'max-w-md');
}
window.studioSchedulerOpenDay = studioSchedulerOpenDay;

/**
 * Detailed Scheduled Post Inspector & Multi-Platform Caption Editor
 */
function studioSchedulerEditPost(postId) {
  const p = __studioSchedulerPosts.find(x => x.id === postId);
  if (!p) return;

  const local = p.scheduled_local ? new Date(p.scheduled_local).toISOString().slice(0, 16) : '';
  const thumb = p.media?.[0] || '';
  const isPub = p.status === 'published';
  const isFailed = p.status === 'failed';

  const accounts = __studioSchedulerAccounts;
  const platformTabs = ['shared', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube'];

  const ov = crmOverlay(`
    <div class="p-6 space-y-5">
      <!-- Top Inspector Header -->
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-lg font-black text-slate-900 dark:text-white">Scheduled Post Inspector</h2>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${isFailed ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' : isPub ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'}">${esc(p.status)}</span>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">Edit artwork design, multi-platform captions, and scheduled publish time.</p>
        </div>
        <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-200">x</button>
      </div>

      ${isFailed ? `
        <div class="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-xs flex items-center justify-between">
          <div>
            <div class="font-black">Publishing Failed</div>
            <div>${esc(p.failure_reason || 'Social provider token expired or connection failed.')}</div>
          </div>
          <button onclick="studioSchedulerPublishNow('${esc(p.id)}')" class="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs">Retry Now</button>
        </div>
      ` : ''}

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        <!-- Left: Design Preview & Edit Artwork Action -->
        <div class="space-y-4">
          <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
            <div class="text-xs font-black uppercase tracking-wider text-slate-400">Attached Artwork Design</div>
            ${thumb ? `
              <div class="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                <img src="${esc(thumb)}" id="ss-inspect-thumb" class="w-full aspect-square object-cover">
                <div class="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                  <button onclick="studioSchedulerOpenDesignEditor('${esc(p.design_id || '')}', '${esc(thumb)}')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl shadow-lg transition">Edit in Design Studio ↗</button>
                </div>
              </div>
            ` : `
              <div class="w-full aspect-video rounded-xl bg-slate-100 dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center p-6 text-center">
                <span class="text-2xl mb-1">Art</span>
                <span class="text-xs text-slate-400 font-bold">No graphic design attached</span>
              </div>
            `}
            <button onclick="studioSchedulerOpenDesignEditor('${esc(p.design_id || '')}', '${esc(thumb)}')" class="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/></svg>
              <span>Edit Design in Studio Canvas</span>
            </button>
          </div>

          <!-- Schedule Date & Time -->
          <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <label class="block text-xs font-black uppercase tracking-wider text-slate-400">Scheduled Date &amp; Time</label>
            <input id="ss-edit-when" type="datetime-local" value="${esc(local)}" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white font-bold font-mono">
          </div>
        </div>

        <!-- Right: Multi-Platform Captions & AI Assistant -->
        <div class="space-y-4">
          <!-- Platform Tabs -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-black uppercase tracking-wider text-slate-400">Caption &amp; Copywriting</span>
              <!-- AI Helpers Dropdown / Cluster -->
              <div class="flex items-center gap-1 flex-wrap">
                <button onclick="studioSchedulerAiCaption('rewrite')" class="px-2 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 text-[10px] font-black rounded-lg transition cursor-pointer">AI Rewrite</button>
                <button onclick="studioSchedulerAiCaption('shorter')" class="px-2 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 text-[10px] font-black rounded-lg transition cursor-pointer">Shorter</button>
                <button onclick="studioSchedulerAiCaption('sales')" class="px-2 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 text-[10px] font-black rounded-lg transition cursor-pointer">Sales</button>
                <button onclick="studioSchedulerAiCaption('hashtags')" class="px-2 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 text-[10px] font-black rounded-lg transition cursor-pointer">#Hashtags</button>
              </div>
            </div>

            <!-- Platform tabs -->
            <div class="flex items-center gap-1 overflow-x-auto pb-1">
              ${platformTabs.map(tab => `
                <button type="button" onclick="studioSchedulerSelectCaptionTab('${tab}')" data-caption-tab="${tab}" class="px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${tab === 'shared' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}">
                  ${tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              `).join('')}
            </div>

            <textarea id="ss-edit-body" rows="6" class="w-full rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 p-3 text-xs leading-relaxed text-slate-900 dark:text-white" placeholder="Write your post caption...">${esc(p.body || '')}</textarea>
          </div>

          <!-- Live Platform Feed Preview -->
          <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <div class="text-[10px] font-black uppercase tracking-wider text-slate-400">Live Platform Preview (Facebook Feed)</div>
            <div class="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">MS</div>
                <div>
                  <div class="font-bold text-slate-900 dark:text-white leading-none">Dealership Page</div>
                  <div class="text-[9px] text-slate-400 mt-0.5">Just now · Web</div>
                </div>
              </div>
              <div id="ss-preview-body" class="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap">${esc(p.body || 'Your post caption will appear here...')}</div>
              ${thumb ? `<img src="${esc(thumb)}" class="w-full h-36 object-cover rounded-lg border border-slate-100 dark:border-slate-800">` : ''}
            </div>
          </div>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-2">
          <button onclick="studioSchedulerSaveReschedule('${esc(p.id)}', this)" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md cursor-pointer transition">Save Changes</button>
          <button onclick="studioSchedulerPublishNow('${esc(p.id)}'); this.closest('.fixed').remove();" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md cursor-pointer transition">Publish Now</button>
          <button onclick="studioSchedulerDuplicatePost('${esc(p.id)}'); this.closest('.fixed').remove();" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition">Duplicate</button>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="studioSchedulerCancelPost('${esc(p.id)}'); this.closest('.fixed').remove();" class="px-4 py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold transition">Delete / Cancel</button>
          <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 rounded-xl text-slate-500 text-xs font-bold">Close</button>
        </div>
      </div>
    </div>
  `, 'max-w-3xl');
}
window.studioSchedulerEditPost = studioSchedulerEditPost;
window.studioSchedulerInspectPost = studioSchedulerEditPost;

/**
 * Click "Edit Design" inside Schedule Inspector:
 * Opens the exact design inside the active Design Studio canvas
 */
function studioSchedulerOpenDesignEditor(designId, assetUrl) {
  closeStudioScheduler();
  if (typeof window.openMarketSyncStudio === 'function') {
    window.openMarketSyncStudio(designId || null, { assetUrl });
  }
}
window.studioSchedulerOpenDesignEditor = studioSchedulerOpenDesignEditor;

function studioSchedulerSelectCaptionTab(tab) {
  __studioActiveCaptionPlatform = tab;
  document.querySelectorAll('[data-caption-tab]').forEach(btn => {
    const isAct = btn.getAttribute('data-caption-tab') === tab;
    btn.className = `px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${isAct ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`;
  });
}
window.studioSchedulerSelectCaptionTab = studioSchedulerSelectCaptionTab;

/**
 * AI Caption Tools
 */
function studioSchedulerAiCaption(type) {
  const textarea = document.getElementById('ss-edit-body') || document.getElementById('ss-body');
  if (!textarea) return;
  const curr = textarea.value || 'Check out this fresh inventory arrival ready for delivery!';

  if (type === 'rewrite') {
    textarea.value = ` Just arrived on the lot! Freshly detailed, certified, and ready for a test drive today. Contact our team to book your appointment!`;
  } else if (type === 'shorter') {
    textarea.value = curr.split('.')[0] + '  Book your test drive today!';
  } else if (type === 'sales') {
    textarea.value = ` SPECIAL OFFER: Competitive financing rates and top trade-in appraisals available now on this unit. Don't wait — claim yours today!`;
  } else if (type === 'hashtags') {
    textarea.value = `${curr}\n\n#UsedCars #Dealership #CarFinancing #TrucksForSale #AutoDeals`;
  }

  const prev = document.getElementById('ss-preview-body');
  if (prev) prev.textContent = textarea.value;
}
window.studioSchedulerAiCaption = studioSchedulerAiCaption;

async function studioSchedulerSaveInspection(postId, btn) {
  const root = btn.closest('.fixed');
  const when = root.querySelector('#ss-edit-when')?.value;
  const body = root.querySelector('#ss-edit-body')?.value;

  try {
    await apiSendJson(`/social/posts/${postId}`, 'PUT', {
      scheduled_local: when || null,
      body: body || null
    });
    root.remove();
    if (typeof showToast === 'function') showToast('Scheduled post updated successfully', 'success');
    loadStudioSchedulerPosts();
  } catch (err) {
    if (typeof showToast === 'function') showToast(err.message, 'error');
  }
}
window.studioSchedulerSaveInspection = studioSchedulerSaveInspection;

async function studioSchedulerDuplicatePost(postId) {
  const post = __studioSchedulerPosts.find(p => p.id === postId);
  if (!post) return;

  try {
    await apiSendJson('/social/posts', 'POST', {
      body: `${post.body || ''} (Copy)`,
      media: post.media || [],
      scheduled_local: post.scheduled_local || null,
      targets: post.targets || []
    });
    if (typeof showToast === 'function') showToast('Post duplicated', 'success');
    loadStudioSchedulerPosts();
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message, 'error');
  }
}
window.studioSchedulerDuplicatePost = studioSchedulerDuplicatePost;

async function studioSchedulerSaveReschedule(postId, btn) {
  return studioSchedulerSaveInspection(postId, btn);
}
window.studioSchedulerSaveReschedule = studioSchedulerSaveReschedule;

/**
 * Post Composer — always inside Design Studio workspace
 */
async function studioSchedulerCompose(preselectedAssetUrl) {
  const defaultDate = (arguments && arguments[1]) || null;
  await ensureStudioWorkspaceActive();

  // Close open schedule overlay if present
  document.getElementById('studio-scheduler-overlay')?.remove();

  let accounts = [];
  try {
    const r = await apiGetJson('/social/accounts').catch(() => ({ accounts: [] }));
    accounts = r.accounts || [];
    __studioSchedulerAccounts = accounts;
  } catch {}

  const usable = accounts.filter(a => a.can_publish);
  const refused = accounts.filter(a => !a.can_publish);

  let assets = [];
  try { assets = (await apiGetJson('/marketing/assets').catch(() => ({ assets: [] }))).assets || []; } catch {}
  if (preselectedAssetUrl && !assets.some(a => a.public_url === preselectedAssetUrl)) {
    assets = [{ public_url: preselectedAssetUrl, alt_text: 'Just rendered' }, ...assets];
  }

  const defaultWhen = defaultDate ? `${defaultDate}T09:00` : '';

  const platformKeys = ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube'];
  const platformCardsHtml = platformKeys.map(p => {
    const cfg = STUDIO_SOCIAL_PLATFORMS[p];
    const acc = usable.find(a => a.provider === p);
    if (acc) {
      return `
        <label class="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 cursor-pointer hover:border-indigo-500 transition">
          <input type="checkbox" class="ss-target rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" value="${esc(acc.id)}" checked>
          <div class="flex items-center gap-2 min-w-0 flex-1">
            ${cfg.iconSvg}
            <div class="min-w-0">
              <div class="text-xs font-bold text-slate-900 dark:text-white truncate">${esc(acc.display_name)}</div>
              <div class="text-[10px] text-slate-400 truncate">${esc(cfg.name)}${acc.handle ? ' · ' + esc(acc.handle) : ''}</div>
            </div>
          </div>
        </label>`;
    } else {
      return `
        <div class="flex items-center justify-between gap-2 p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <div class="flex items-center gap-2 min-w-0">
            <div class="opacity-50 shrink-0">${cfg.iconSvg}</div>
            <div class="min-w-0">
              <div class="text-xs font-bold text-slate-400 dark:text-slate-500">${esc(cfg.name)}</div>
              <div class="text-[10px] text-amber-500 font-bold truncate">Connection Required</div>
            </div>
          </div>
          <button type="button" onclick="studioSocialConnectPlatform('${p}')" class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0">+ Connect</button>
        </div>`;
    }
  }).join('');

  const noAccountWarning = usable.length === 0 ? `
    <div class="mb-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between gap-3">
      <span>Connect a social account to publish or schedule this post.</span>
      <button type="button" onclick="studioSocialConnectPlatform('facebook')" class="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold transition shrink-0">Connect account</button>
    </div>` : '';

  const ov = crmOverlay(`
    <div class="p-6 space-y-4">
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h2 class="text-base font-black text-slate-900 dark:text-white">New Scheduled Social Post</h2>
          <p class="text-xs text-slate-500">Pick publishing destinations, attach your design artwork, and choose date/time.</p>
        </div>
        <button onclick="this.closest('.fixed').remove(); openStudioScheduler();" class="text-slate-400 hover:text-slate-200 font-bold">x</button>
      </div>

      ${noAccountWarning}

      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">Caption &amp; Messaging</label>
          <button type="button" onclick="studioSchedulerAiCaption('rewrite')" class="text-[10px] text-indigo-500 font-black hover:underline cursor-pointer"> AI Suggestion</button>
        </div>
        <textarea id="ss-body" rows="4" placeholder="What do you want to say about this vehicle or promotion?"
          class="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 p-3 text-xs text-slate-900 dark:text-white"></textarea>
      </div>

      <div>
        <div class="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Publishing Destinations</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${platformCardsHtml}</div>
      </div>

      ${assets.length ? `
        <div>
          <div class="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Attach Design Artwork</div>
          <div class="flex gap-2 overflow-x-auto pb-1">${assets.slice(0, 20).map(a => `
            <label class="shrink-0 cursor-pointer">
              <input type="checkbox" class="ss-media" value="${esc(a.public_url)}" ${a.public_url === preselectedAssetUrl ? 'checked' : ''}>
              <img src="${esc(a.public_url)}" alt="${esc(a.alt_text || '')}" class="w-16 h-16 object-cover rounded-lg border ${a.public_url === preselectedAssetUrl ? 'border-indigo-500 border-2' : 'border-slate-200 dark:border-slate-700'}">
            </label>`).join('')}
          </div>
        </div>
      ` : ''}

      <div>
        <div class="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Scheduled Date &amp; Time</div>
        <input id="ss-when" type="datetime-local" value="${esc(defaultWhen)}" class="rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white font-mono">
        <div class="text-[11px] text-slate-400 mt-1">Leave empty to save as a Draft in your Studio library.</div>
      </div>

      <div class="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
        <button onclick="studioSchedulerSavePost(this)" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md cursor-pointer transition">Schedule Post</button>
        <button onclick="this.closest('.fixed').remove(); openStudioScheduler();" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">Cancel</button>
      </div>
    </div>`, 'max-w-xl');
}
window.studioSchedulerCompose = studioSchedulerCompose;

async function studioSchedulerSavePost(btn) {
  const root = btn.closest('.fixed');
  const targets = [...root.querySelectorAll('.ss-target:checked')].map(i => ({ social_account_id: i.value, body_override: null }));
  if (!targets.length) return showToast('Choose at least one account to publish to.', 'error');
  const when = root.querySelector('#ss-when').value;
  try {
    await apiSendJson('/social/posts', 'POST', {
      body: root.querySelector('#ss-body').value,
      media: [...root.querySelectorAll('.ss-media:checked')].map(i => i.value),
      scheduled_local: when || null,
      targets,
    });
    root.remove();
    showToast(when ? 'Post scheduled' : 'Draft saved', 'success');
    loadStudioSchedulerPosts();
    openStudioScheduler();
  } catch (e) { showToast(e.message, 'error'); }
}
window.studioSchedulerSavePost = studioSchedulerSavePost;

async function studioSchedulerPublishNow(postId) {
  try {
    const r = await apiSendJson(`/social/posts/${postId}/publish`, 'POST', {});
    const ok = (r.results || []).filter(x => x.status === 'published').length;
    const bad = (r.results || []).filter(x => x.status === 'failed' || x.status === 'skipped');
    showToast(bad.length ? `Published to ${ok}, could not publish to ${bad.length}: ${bad[0].error || 'see the post'}` : `Published to ${ok} account(s)`, bad.length ? 'error' : 'success');
    loadStudioSchedulerPosts();
  } catch (e) { showToast(e.message, 'error'); }
}
window.studioSchedulerPublishNow = studioSchedulerPublishNow;

async function studioSchedulerReschedule(postId) {
  const next = prompt('Schedule date/time in the dealership timezone (YYYY-MM-DDTHH:MM)', ''); if (!next) return;
  try { await apiSendJson(`/social/posts/${postId}`, 'PUT', { scheduled_local: next }); showToast('Post rescheduled', 'success'); loadStudioSchedulerPosts(); }
  catch (e) { showToast(e.message, 'error'); }
}
window.studioSchedulerReschedule = studioSchedulerReschedule;

async function studioSchedulerCancelPost(postId) {
  if (!confirm('Cancel this post?')) return;
  try { await apiSendJson(`/social/posts/${postId}/cancel`, 'POST', {}); showToast('Post cancelled', 'success'); loadStudioSchedulerPosts(); }
  catch (e) { showToast(e.message, 'error'); }
}
window.studioSchedulerCancelPost = studioSchedulerCancelPost;

// ── Settings → My Account: "Connected social accounts" configuration card ─────────────────────
const STUDIO_SOCIAL_PLATFORMS = {
  facebook: {
    name: 'Facebook',
    subtitle: 'Connect your dealership Facebook Page',
    iconSvg: `<svg class="w-6 h-6 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
    fields: [
      { id: 'display_name', label: 'Page Name', placeholder: 'e.g. Downtown Motors Facebook Page', required: true },
      { id: 'external_account_id', label: 'Page ID', placeholder: 'e.g. 109823471209384', required: true },
      { id: 'handle', label: 'Handle (optional)', placeholder: '@downtownmotors' }
    ]
  },
  instagram: {
    name: 'Instagram',
    subtitle: 'Connect your dealership Instagram Business account',
    iconSvg: `<svg class="w-6 h-6 text-[#E4405F]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`,
    fields: [
      { id: 'display_name', label: 'Account Name', placeholder: 'e.g. Downtown Motors Instagram', required: true },
      { id: 'handle', label: 'Instagram Handle', placeholder: '@downtownmotors', required: true },
      { id: 'external_account_id', label: 'Account ID (optional)', placeholder: 'e.g. ig_10982347' }
    ]
  },
  linkedin: {
    name: 'LinkedIn',
    subtitle: 'Connect your dealership LinkedIn Page',
    iconSvg: `<svg class="w-6 h-6 text-[#0A66C2]" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>`,
    fields: [
      { id: 'display_name', label: 'Organization Name', placeholder: 'e.g. Downtown Motors LinkedIn', required: true },
      { id: 'external_account_id', label: 'Organization ID', placeholder: 'e.g. 89274102', required: true },
      { id: 'handle', label: 'Vanity Name / URL (optional)', placeholder: 'downtown-motors' }
    ]
  },
  tiktok: {
    name: 'TikTok',
    subtitle: 'Connect your dealership TikTok Business account',
    iconSvg: `<svg class="w-6 h-6 text-[#000000] dark:text-[#ffffff]" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.97v7.09c.01 1.73-.39 3.51-1.39 4.96-1.12 1.64-2.88 2.76-4.85 3.12-2.31.42-4.76.01-6.73-1.2-1.92-1.17-3.23-3.14-3.56-5.36-.4-2.7.4-5.5 2.19-7.51 1.74-1.94 4.31-3.03 6.94-2.91v4.11c-1.31-.13-2.67.23-3.66 1.05-1.07.88-1.63 2.27-1.49 3.65.11 1.34.92 2.53 2.14 3.08 1.25.56 2.76.4 3.87-.39.84-.6 1.38-1.57 1.43-2.61.03-3.32.01-6.64.01-9.96z"/></svg>`,
    fields: [
      { id: 'display_name', label: 'Business Account Name', placeholder: 'e.g. Downtown Motors TikTok', required: true },
      { id: 'handle', label: 'TikTok Handle', placeholder: '@downtownmotors', required: true },
      { id: 'external_account_id', label: 'Account ID (optional)', placeholder: 'e.g. tt_9182374' }
    ]
  },
  youtube: {
    name: 'YouTube',
    subtitle: 'Connect your dealership YouTube Channel',
    iconSvg: `<svg class="w-6 h-6 text-[#FF0000]" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
    fields: [
      { id: 'display_name', label: 'Channel Name', placeholder: 'e.g. Downtown Motors Official Channel', required: true },
      { id: 'external_account_id', label: 'Channel ID', placeholder: 'e.g. UC_x5XG1OV2P6uZZ5FSM9Ttw', required: true },
      { id: 'handle', label: 'Handle (optional)', placeholder: '@downtownmotors' }
    ]
  }
};

async function studioSocialConnectionsRender() {
  const list = document.getElementById('studio-social-list');
  if (!list) return;
  list.innerHTML = '<div class="text-xs text-slate-500 italic">Loading…</div>';
  try {
    const r = await apiGetJson('/social/accounts');
    const accounts = r.accounts || [];
    const platformKeys = ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube'];

    const cardsHtml = platformKeys.map(p => {
      const cfg = STUDIO_SOCIAL_PLATFORMS[p];
      const acc = accounts.find(a => a.provider === p);
      if (acc) {
        return `
          <div class="flex items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60">
            <div class="flex items-center gap-3 min-w-0">
              <div class="shrink-0">${cfg.iconSvg}</div>
              <div class="min-w-0">
                <div class="text-sm font-bold text-slate-900 dark:text-white truncate">${esc(acc.display_name)}</div>
                <div class="text-xs text-slate-400 truncate">${esc(cfg.name)}${acc.handle ? ' · ' + esc(acc.handle) : ''}</div>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>Connected
              </span>
              <button type="button" onclick="studioSocialDisconnectAccount('${esc(acc.id)}')" class="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-800 transition cursor-pointer">Disconnect</button>
            </div>
          </div>`;
      } else {
        return `
          <div class="flex items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div class="flex items-center gap-3 min-w-0">
              <div class="shrink-0">${cfg.iconSvg}</div>
              <div class="min-w-0">
                <div class="text-sm font-bold text-slate-900 dark:text-white">${esc(cfg.name)}</div>
                <div class="text-xs text-slate-500 dark:text-slate-400 truncate">${esc(cfg.subtitle)}</div>
              </div>
            </div>
            <button type="button" onclick="studioSocialConnectPlatform('${p}')" class="text-xs font-bold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition shrink-0 cursor-pointer">Connect ${esc(cfg.name)}</button>
          </div>`;
      }
    }).join('');

    list.innerHTML = `
      <div class="space-y-3">
        <div class="grid grid-cols-1 gap-3">${cardsHtml}</div>
        <div class="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span class="text-xs text-slate-400">Post scheduling &amp; publishing is managed inside Design Studio.</span>
          <button type="button" onclick="openStudioScheduler()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer flex items-center gap-1.5">
            <span>Open Social Calendar in Design Studio ↗</span>
          </button>
        </div>
      </div>
    `;
  } catch (e) {
    if (e.message === 'MFA_REQUIRED') {
      list.innerHTML = `<div class="text-[12px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">Complete multi-factor authentication above to manage connected accounts.</div>`;
    } else {
      list.innerHTML = `<div class="text-xs text-rose-500">${esc(e.message || 'Could not load')}</div>`;
    }
  }
}
window.studioSocialConnectionsRender = studioSocialConnectionsRender;

async function studioSocialConnectPlatform(provider) {
  const cfg = STUDIO_SOCIAL_PLATFORMS[provider];
  if (!cfg) return;

  // Prefer existing backend OAuth authorization flow if configured
  try {
    const oauthRes = await apiGetJson(`/social/connect/${provider}`).catch(() => null);
    if (oauthRes?.url) {
      window.location.href = oauthRes.url;
      return;
    }
  } catch {}

  // Single-platform connection form
  const fieldHtml = cfg.fields.map(f => `
    <div class="mb-3">
      <label class="block text-[12px] font-bold text-slate-700 dark:text-slate-200 mb-1">${esc(f.label)}</label>
      <input id="ssc-field-${esc(f.id)}" type="text" placeholder="${esc(f.placeholder)}" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 p-2.5 text-[13px]">
    </div>`).join('');

  const ov = crmOverlay(`
    <div class="p-5">
      <div class="flex items-center gap-3 mb-2">
        <div class="shrink-0">${cfg.iconSvg}</div>
        <div>
          <h2 class="text-lg font-black text-slate-900 dark:text-white">Connect ${esc(cfg.name)}</h2>
          <p class="text-[13px] text-slate-500">${esc(cfg.subtitle)}</p>
        </div>
      </div>
      <div class="my-4">
        ${fieldHtml}
      </div>
      <div class="flex gap-2">
        <button onclick="studioSocialConnectSavePlatform('${esc(provider)}', this)" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[13px] font-bold cursor-pointer">Connect ${esc(cfg.name)}</button>
        <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[13px] font-bold cursor-pointer">Cancel</button>
      </div>
    </div>`, 'max-w-md');
  if (!ov) return;
}
window.studioSocialConnectPlatform = studioSocialConnectPlatform;

async function studioSocialConnectSavePlatform(provider, btn) {
  const cfg = STUDIO_SOCIAL_PLATFORMS[provider];
  const root = btn.closest('.fixed');
  const displayName = (root.querySelector('#ssc-field-display_name')?.value || '').trim();
  const handle = (root.querySelector('#ssc-field-handle')?.value || '').trim();
  const externalId = (root.querySelector('#ssc-field-external_account_id')?.value || '').trim() || handle || displayName;

  if (!displayName) return showToast('Display name / Page name is required.', 'error');
  if (!externalId) return showToast('Account ID / Page ID is required.', 'error');

  try {
    await apiSendJson('/social/accounts', 'POST', {
      provider,
      display_name: displayName,
      handle: handle || null,
      external_account_id: externalId,
      ownership: 'dealership'
    });
    root.remove();
    showToast(`${cfg.name} account connected`, 'success');
    studioSocialConnectionsRender();
  } catch (e) { showToast(e.message, 'error'); }
}
window.studioSocialConnectSavePlatform = studioSocialConnectSavePlatform;

async function studioSocialDisconnectAccount(accountId) {
  if (!confirm('Disconnect this social account?')) return;
  try {
    await apiSendJson(`/social/accounts/${accountId}`, 'DELETE');
    showToast('Social account disconnected', 'success');
    studioSocialConnectionsRender();
  } catch (e) { showToast(e.message, 'error'); }
}
window.studioSocialDisconnectAccount = studioSocialDisconnectAccount;

async function studioSocialConnectSave(btn) {
  const root = btn.closest('.fixed');
  const provider = root.querySelector('#ssc-provider')?.value || 'facebook';
  const displayName = (root.querySelector('#ssc-name')?.value || '').trim();
  const handle = (root.querySelector('#ssc-handle')?.value || '').trim();
  const externalId = (root.querySelector('#ssc-external-id')?.value || '').trim() || handle || displayName;
  if (!displayName || !externalId) return showToast('Display name and account ID are required.', 'error');
  try {
    await apiSendJson('/social/accounts', 'POST', { provider, display_name: displayName, handle: handle || null, external_account_id: externalId, ownership: 'dealership' });
    root.remove();
    showToast('Account connected', 'success');
    studioSocialConnectionsRender();
  } catch (e) { showToast(e.message, 'error'); }
}
window.studioSocialConnectSave = studioSocialConnectSave;

window.studioSocialConnectForm = function() {
  studioSocialConnectPlatform('facebook');
};
