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
let __studioSchedulerView = 'list';   // 'list' | 'calendar'
let __studioSchedulerCalMonth = new Date();
let __studioSchedulerMfaRequired = false;

async function openStudioScheduler() {
  const ov = crmOverlay(`<div class="p-5">
    <div class="flex items-center justify-between mb-3">
      <div>
        <h2 class="text-lg font-black text-slate-900 dark:text-white">Schedule</h2>
        <p class="text-[12px] text-slate-500">Post your designs to your connected accounts — built into Design Studio, nothing to add.</p>
      </div>
      <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <div class="flex items-center gap-1 mb-3">
      <button id="studio-sched-view-list" onclick="studioSchedulerSetView('list')" class="text-xs font-bold px-2.5 py-1 rounded-lg"></button>
      <button id="studio-sched-view-cal" onclick="studioSchedulerSetView('calendar')" class="text-xs font-bold px-2.5 py-1 rounded-lg"></button>
    </div>
    <div id="studio-sched-body" class="space-y-2 min-h-[120px]">
      <div class="text-sm text-slate-400 italic py-6 text-center">Loading…</div>
    </div>
  </div>`, 'max-w-xl');
  studioSchedulerPaintViewToggle();
  await loadStudioSchedulerPosts();
  if (!document.body.contains(ov)) return;   // closed while loading
}
window.openStudioScheduler = openStudioScheduler;

function studioSchedulerPaintViewToggle() {
  const listBtn = document.getElementById('studio-sched-view-list');
  const calBtn = document.getElementById('studio-sched-view-cal');
  if (!listBtn || !calBtn) return;
  const isList = __studioSchedulerView === 'list';
  listBtn.textContent = 'List view';
  calBtn.textContent = 'Calendar view';
  listBtn.className = `text-xs font-bold px-3 py-1.5 rounded-lg transition ${isList ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`;
  calBtn.className = `text-xs font-bold px-3 py-1.5 rounded-lg transition ${!isList ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`;
}

function studioSchedulerMfaNotice() {
  return `<div class="text-[12px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">Multi-factor authentication is required to view or manage scheduled posts. Complete MFA in your profile settings.</div>`;
}

function studioSchedulerSetView(view) {
  __studioSchedulerView = view;
  studioSchedulerPaintViewToggle();
  if (view === 'calendar') renderStudioSchedulerCalendar();
  else renderStudioSchedulerList();
}
window.studioSchedulerSetView = studioSchedulerSetView;

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
  if (__studioSchedulerView === 'calendar') renderStudioSchedulerCalendar();
  else renderStudioSchedulerList();
}

function renderStudioSchedulerList() {
  const body = document.getElementById('studio-sched-body');
  if (!body) return;
  if (__studioSchedulerMfaRequired) {
    body.innerHTML = `<div class="text-[12px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">Multi-factor authentication is required to view or manage scheduled posts. Complete MFA in your profile settings.</div>`;
    return;
  }
  const accounts = __studioSchedulerAccounts;
  const usable = accounts.filter(a => a.can_publish);
  const accountNote = usable.length === 0
    ? `<div class="text-[12px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5 mb-2 flex items-center justify-between gap-2">
        <span>No connected social accounts yet.</span>
        <button onclick="this.closest('.fixed')?.remove(); switchPage('profile'); if (typeof settingsTab === 'function') settingsTab('account');" class="text-[11px] font-bold underline shrink-0">Connect in Settings</button>
       </div>`
    : '';

  const active = __studioSchedulerPosts.filter(p => p.status === 'scheduled' || p.status === 'draft');
  const rows = active.length
    ? active.map(p => `
      <div class="flex items-center justify-between gap-3 border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-white dark:bg-slate-900">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${p.status === 'scheduled' ? 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}">${esc(p.status)}</span>
            <span class="text-[11px] text-slate-400 truncate">${p.scheduled_local ? esc(new Date(p.scheduled_local).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })) : 'Draft'}</span>
          </div>
          <div class="text-[13px] font-medium text-slate-800 dark:text-slate-200 truncate">${esc(p.body || '(no caption)')}</div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button onclick="studioSchedulerEditPost('${esc(p.id)}')" title="Edit / reschedule" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></button>
          <button onclick="studioSchedulerCancelPost('${esc(p.id)}')" title="Cancel" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg></button>
        </div>
      </div>`).join('')
    : `<div class="text-sm text-slate-400 italic py-4 text-center">Nothing scheduled yet.</div>`;
  body.innerHTML = `${accountNote}${rows}
    <button onclick="studioSchedulerCompose()" class="w-full mt-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold py-2.5 rounded-lg transition">+ Schedule a post</button>`;
}

function studioSchedulerMoveMonth(delta) {
  __studioSchedulerCalMonth = new Date(__studioSchedulerCalMonth.getFullYear(), __studioSchedulerCalMonth.getMonth() + delta, 1);
  renderStudioSchedulerCalendar();
}
window.studioSchedulerMoveMonth = studioSchedulerMoveMonth;

function renderStudioSchedulerCalendar() {
  const body = document.getElementById('studio-sched-body');
  if (!body) return;
  const byDate = {};
  for (const p of __studioSchedulerPosts) {
    if (!p.scheduled_local || p.status === 'cancelled') continue;
    const d = new Date(p.scheduled_local);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    (byDate[key] = byDate[key] || []).push(p);
  }
  const month = __studioSchedulerCalMonth;
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const today = new Date();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push('<div class="min-h-[64px]"></div>');
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${month.getFullYear()}-${month.getMonth()}-${day}`;
    const posts = (byDate[key] || []).sort((a, b) => new Date(a.scheduled_local) - new Date(b.scheduled_local));
    const isToday = today.getFullYear() === month.getFullYear() && today.getMonth() === month.getMonth() && today.getDate() === day;
    const chips = posts.slice(0, 2).map(p => `<button onclick="studioSchedulerEditPost('${esc(p.id)}')" class="block w-full text-left truncate text-[10px] font-semibold px-1 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900 mb-0.5">${esc(new Date(p.scheduled_local).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))} ${esc(p.body || 'Post')}</button>`).join('');
    const more = posts.length > 2 ? `<div class="text-[9px] text-slate-400 px-1">+${posts.length - 2} more</div>` : '';
    cells.push(`<div class="min-h-[64px] border border-slate-100 dark:border-slate-800 rounded p-1 ${isToday ? 'bg-indigo-50/60 dark:bg-indigo-950/20' : ''}"><div class="text-[10px] font-bold text-slate-400 mb-0.5">${day}</div>${chips}${more}</div>`);
  }
  body.innerHTML = `
    <div class="flex items-center justify-between mb-2">
      <button onclick="studioSchedulerMoveMonth(-1)" class="text-xs font-bold px-2 py-1 rounded border border-slate-200 dark:border-slate-700">‹</button>
      <div class="text-sm font-bold text-slate-800 dark:text-slate-100">${month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</div>
      <button onclick="studioSchedulerMoveMonth(1)" class="text-xs font-bold px-2 py-1 rounded border border-slate-200 dark:border-slate-700">›</button>
    </div>
    <div class="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div>${d}</div>`).join('')}</div>
    <div class="grid grid-cols-7 gap-1">${cells.join('')}</div>
    <button onclick="studioSchedulerCompose()" class="w-full mt-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold py-2.5 rounded-lg transition">+ Schedule a post</button>`;
}

function studioSchedulerEditPost(postId) {
  const p = __studioSchedulerPosts.find(x => x.id === postId);
  if (!p) return;
  const local = p.scheduled_local ? new Date(p.scheduled_local).toISOString().slice(0, 16) : '';
  const ov = crmOverlay(`
    <div class="p-5">
      <h2 class="text-lg font-black text-slate-900 dark:text-white mb-1">Edit post</h2>
      <p class="text-[13px] text-slate-600 dark:text-slate-300 mb-3 line-clamp-3">${esc(p.body || '(no caption)')}</p>
      <div class="text-[12px] font-bold text-slate-700 dark:text-slate-200 mb-1">When</div>
      <input id="ss-edit-when" type="datetime-local" value="${esc(local)}" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 p-2 text-[13px] mb-4">
      <div class="flex flex-wrap gap-2">
        <button onclick="studioSchedulerSaveReschedule('${esc(p.id)}', this)" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[13px] font-bold">Save</button>
        <button onclick="studioSchedulerPublishNow('${esc(p.id)}'); this.closest('.fixed').remove();" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[13px] font-bold">Publish now</button>
        <button onclick="studioSchedulerCancelPost('${esc(p.id)}'); this.closest('.fixed').remove();" class="px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-[13px] font-bold">Cancel post</button>
        <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 rounded-xl text-[13px] font-bold text-slate-500">Close</button>
      </div>
    </div>`, 'max-w-md');
  if (!ov) return;
}
window.studioSchedulerEditPost = studioSchedulerEditPost;

async function studioSchedulerSaveReschedule(postId, btn) {
  const root = btn.closest('.fixed');
  const when = root.querySelector('#ss-edit-when')?.value;
  if (!when) return showToast('Pick a date and time.', 'error');
  try {
    await apiSendJson(`/social/posts/${postId}`, 'PUT', { scheduled_local: when });
    root.remove();
    showToast('Post rescheduled', 'success');
    loadStudioSchedulerPosts();
  } catch (e) { showToast(e.message, 'error'); }
}
window.studioSchedulerSaveReschedule = studioSchedulerSaveReschedule;

async function studioSchedulerCompose(preselectedAssetUrl) {
  // Ensure user is in Design Studio workspace
  if (typeof switchPage === 'function' && document.querySelector('[data-page-content="marketing"]')?.classList.contains('hidden')) {
    switchPage('marketing');
  }
  // Close open schedule modal if present
  document.getElementById('studio-sched-body')?.closest('.fixed')?.remove();

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
              <div class="text-[10px] text-slate-400/80 truncate">Not connected</div>
            </div>
          </div>
          <button type="button" onclick="this.closest('.fixed')?.remove(); switchPage('profile'); if (typeof settingsTab === 'function') settingsTab('account'); setTimeout(() => studioSocialConnectPlatform('${p}'), 200);" class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0">+ Connect</button>
        </div>`;
    }
  }).join('');

  const noAccountWarning = usable.length === 0 ? `
    <div class="mb-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between gap-3">
      <span>Connect a social account to publish or schedule this post.</span>
      <button type="button" onclick="this.closest('.fixed')?.remove(); switchPage('profile'); if (typeof settingsTab === 'function') settingsTab('account');" class="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold transition shrink-0">Connect account</button>
    </div>` : '';

  const ov = crmOverlay(`
    <div class="p-5">
      <h2 class="text-lg font-black text-slate-900 dark:text-white mb-1">New scheduled post</h2>
      <p class="text-[13px] text-slate-500 mb-4">Compose your post, pick your publishing destinations, and set the date/time.</p>
      ${noAccountWarning}
      <textarea id="ss-body" rows="4" placeholder="What do you want to say?"
        class="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 p-3 text-[14px] mb-4"></textarea>
      <div class="text-[12px] font-bold text-slate-700 dark:text-slate-200 mb-2">Publishing Destinations</div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">${platformCardsHtml}</div>
      ${refused.length ? `<div class="mb-4 text-[12px] text-slate-400">${refused.map(a => `${esc(a.display_name)} — ${esc(a.why || 'not available to you')}`).join('<br>')}</div>` : ''}
      ${assets.length ? `<div class="text-[12px] font-bold text-slate-700 dark:text-slate-200 mb-2">Attach a design</div>
        <div class="flex gap-2 overflow-x-auto pb-1 mb-4">${assets.slice(0, 20).map(a => `
          <label class="shrink-0 cursor-pointer">
            <input type="checkbox" class="ss-media" value="${esc(a.public_url)}" ${a.public_url === preselectedAssetUrl ? 'checked' : ''}>
            <img src="${esc(a.public_url)}" alt="${esc(a.alt_text || '')}" class="w-16 h-16 object-cover rounded-lg border ${a.public_url === preselectedAssetUrl ? 'border-indigo-500 border-2' : 'border-slate-200 dark:border-slate-700'}">
          </label>`).join('')}</div>` : ''}
      <div class="text-[12px] font-bold text-slate-700 dark:text-slate-200 mb-1">Date &amp; Time</div>
      <input id="ss-when" type="datetime-local" class="rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 p-2 text-[13px]">
      <div class="text-[12px] text-slate-400 mt-1">Leave empty to save as a draft.</div>
      <div class="flex gap-2 mt-5">
        <button onclick="studioSchedulerSavePost(this)" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[13px] font-bold">Schedule post</button>
        <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[13px] font-bold">Cancel</button>
      </div>
    </div>`, 'max-w-xl');
  if (!ov) return;
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
  const next = prompt('Schedule date/time in the dealership timezone', ''); if (!next) return;
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

// ── Settings → My Account: "Connected social accounts" card ─────────────────────
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
              <button type="button" onclick="studioSocialDisconnectAccount('${esc(acc.id)}')" class="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-800 transition">Disconnect</button>
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
            <button type="button" onclick="studioSocialConnectPlatform('${p}')" class="text-xs font-bold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition shrink-0">Connect ${esc(cfg.name)}</button>
          </div>`;
      }
    }).join('');

    list.innerHTML = `<div class="grid grid-cols-1 gap-3">${cardsHtml}</div>`;
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

  // Single-platform connection form without platform dropdown
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
        <button onclick="studioSocialConnectSavePlatform('${esc(provider)}', this)" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[13px] font-bold">Connect ${esc(cfg.name)}</button>
        <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[13px] font-bold">Cancel</button>
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
