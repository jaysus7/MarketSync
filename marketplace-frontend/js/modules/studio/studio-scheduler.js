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
// Every /social/* route requires step-up MFA (posting to a dealership's own social
// accounts is sensitive enough to warrant it) — set once a load hits it, so the UI
// can tell "you truly have zero accounts" apart from "we couldn't check".
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

function studioSchedulerSetView(view) {
  __studioSchedulerView = view;
  studioSchedulerPaintViewToggle();
  renderStudioSchedulerList();
}
window.studioSchedulerSetView = studioSchedulerSetView;

function studioSchedulerPaintViewToggle() {
  const on = 'bg-indigo-600 text-white';
  const off = 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800';
  const list = document.getElementById('studio-sched-view-list');
  const cal = document.getElementById('studio-sched-view-cal');
  if (list) { list.textContent = 'List'; list.className = `text-xs font-bold px-2.5 py-1 rounded-lg transition ${__studioSchedulerView === 'list' ? on : off}`; }
  if (cal) { cal.textContent = 'Calendar'; cal.className = `text-xs font-bold px-2.5 py-1 rounded-lg transition ${__studioSchedulerView === 'calendar' ? on : off}`; }
}

async function loadStudioSchedulerPosts() {
  const body = document.getElementById('studio-sched-body');
  if (!body) return;
  __studioSchedulerMfaRequired = false;
  const isMfaError = (e) => e?.message === 'MFA_REQUIRED';
  try {
    const [accountsRes, postsRes] = await Promise.all([
      apiGetJson('/social/accounts').catch(e => { if (isMfaError(e)) __studioSchedulerMfaRequired = true; return { accounts: [] }; }),
      apiGetJson('/social/posts').catch(e => { if (isMfaError(e)) __studioSchedulerMfaRequired = true; return { posts: [] }; }),
    ]);
    __studioSchedulerAccounts = accountsRes.accounts || [];
    __studioSchedulerPosts = postsRes.posts || [];
    if (!document.getElementById('studio-sched-body')) return;
    renderStudioSchedulerList();
  } catch (e) {
    if (body) body.innerHTML = `<div class="text-sm text-rose-500 py-6 text-center">${esc(e.message || 'Could not load')}</div>`;
  }
}

function studioSchedulerMfaNotice() {
  return `<div class="text-[12px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-2">
    <b>Complete multi-factor authentication to schedule posts.</b> Posting to your connected accounts needs step-up verification for this session.
    <button onclick="this.closest('.fixed').remove(); if (typeof switchPage === 'function') { switchPage('profile'); settingsTab('account'); }" class="block mt-1.5 font-bold text-amber-800 dark:text-amber-200 underline">Go verify in Settings →</button>
  </div>`;
}

function renderStudioSchedulerList() {
  const body = document.getElementById('studio-sched-body');
  if (!body) return;
  if (__studioSchedulerMfaRequired) { body.innerHTML = studioSchedulerMfaNotice(); return; }
  if (__studioSchedulerView === 'calendar') { renderStudioSchedulerCalendar(); return; }

  const accountNote = __studioSchedulerAccounts.length
    ? ''
    : `<div class="text-[12px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5 mb-2">No accounts connected yet — connect one in Settings before scheduling a post.</div>`;
  const upcoming = __studioSchedulerPosts
    .filter(p => p.status !== 'published' && p.status !== 'cancelled')
    .sort((a, b) => new Date(a.scheduled_local || 0) - new Date(b.scheduled_local || 0));
  const rows = upcoming.length
    ? upcoming.map(p => `
      <div class="flex items-start justify-between gap-3 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
        <div class="min-w-0 flex-1 cursor-pointer" onclick="studioSchedulerEditPost('${esc(p.id)}')">
          <p class="text-sm text-slate-800 dark:text-slate-100 line-clamp-2">${esc(p.body || '(no caption)')}</p>
          <p class="text-[11px] text-slate-400 mt-1">${p.scheduled_local ? esc(new Date(p.scheduled_local).toLocaleString()) : 'Draft — not scheduled'} · ${esc(p.status || 'draft')}</p>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button onclick="studioSchedulerPublishNow('${esc(p.id)}')" title="Publish now" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 5l7 7-7 7M5 12h14"/></svg></button>
          <button onclick="studioSchedulerEditPost('${esc(p.id)}')" title="Edit / reschedule" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></button>
          <button onclick="studioSchedulerCancelPost('${esc(p.id)}')" title="Cancel" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg></button>
        </div>
      </div>`).join('')
    : `<div class="text-sm text-slate-400 italic py-4 text-center">Nothing scheduled yet.</div>`;
  body.innerHTML = `${accountNote}${rows}
    <button onclick="studioSchedulerCompose()" class="w-full mt-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold py-2.5 rounded-lg transition">+ Schedule a post</button>`;
}

// ── Calendar view: same posts, laid out on a month grid. Clicking a post opens the
// same edit popover the list view uses, so either view can reschedule/cancel/publish.
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

// Compact edit popover for an existing post — reschedule, publish now, or cancel,
// without leaving whichever view (list or calendar) the user opened it from.
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
  const accounts = __studioSchedulerAccounts;
  const usable = accounts.filter(a => a.can_publish);
  const refused = accounts.filter(a => !a.can_publish);
  let assets = [];
  try { assets = (await apiGetJson('/marketing/assets').catch(() => ({ assets: [] }))).assets || []; } catch {}
  // A design just rendered from the editor may not have propagated into
  // /marketing/assets yet — pin it to the front of the picker either way so it's
  // always selectable and pre-checked.
  if (preselectedAssetUrl && !assets.some(a => a.public_url === preselectedAssetUrl)) {
    assets = [{ public_url: preselectedAssetUrl, alt_text: 'Just rendered' }, ...assets];
  }

  const ov = crmOverlay(`
    <div class="p-5">
      <h2 class="text-lg font-black text-slate-900 dark:text-white mb-1">New post</h2>
      <p class="text-[13px] text-slate-500 mb-4">Nothing is sent until a network confirms it.</p>
      <textarea id="ss-body" rows="4" placeholder="What do you want to say?"
        class="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 p-3 text-[14px] mb-3"></textarea>
      <div class="text-[12px] font-bold text-slate-700 dark:text-slate-200 mb-1">Publish to</div>
      ${usable.length ? usable.map(a => `<label class="flex items-center gap-2 py-1">
          <input type="checkbox" class="ss-target" value="${esc(a.id)}">
          <span class="text-[13px] text-slate-900 dark:text-white">${esc(a.display_name)}</span><span class="text-[12px] text-slate-400">${esc(a.provider)}</span>
        </label>`).join('') : `<div class="text-[13px] text-rose-600 dark:text-rose-400">You cannot publish to any connected account yet.</div>`}
      ${refused.length ? `<div class="mt-2 text-[12px] text-slate-400">${refused.map(a => `${esc(a.display_name)} — ${esc(a.why || 'not available to you')}`).join('<br>')}</div>` : ''}
      ${assets.length ? `<div class="text-[12px] font-bold text-slate-700 dark:text-slate-200 mt-4 mb-1">Attach a design</div>
        <div class="flex gap-2 overflow-x-auto pb-1">${assets.slice(0, 20).map(a => `
          <label class="shrink-0 cursor-pointer">
            <input type="checkbox" class="ss-media" value="${esc(a.public_url)}" ${a.public_url === preselectedAssetUrl ? 'checked' : ''}>
            <img src="${esc(a.public_url)}" alt="${esc(a.alt_text || '')}" class="w-16 h-16 object-cover rounded-lg border ${a.public_url === preselectedAssetUrl ? 'border-indigo-500 border-2' : 'border-slate-200 dark:border-slate-700'}">
          </label>`).join('')}</div>` : ''}
      <div class="text-[12px] font-bold text-slate-700 dark:text-slate-200 mt-4 mb-1">When</div>
      <input id="ss-when" type="datetime-local" class="rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 p-2 text-[13px]">
      <div class="text-[12px] text-slate-400 mt-1">Leave empty to save as a draft.</div>
      <div class="flex gap-2 mt-5">
        <button onclick="studioSchedulerSavePost(this)" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[13px] font-bold">Save post</button>
        <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[13px] font-bold">Cancel</button>
      </div>
    </div>`, 'max-w-lg');
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
// The real thing, reading/writing the actual /social/accounts API — not
// marketing-workspace.js's renderSocialConnectorsPanelHtml(), which is fixed demo
// data (Academy training scenario) with no backend behind it.
const STUDIO_SOCIAL_PROVIDERS = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin'];
const STUDIO_SOCIAL_PROVIDER_LABEL = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', linkedin: 'LinkedIn' };

async function studioSocialConnectionsRender() {
  const list = document.getElementById('studio-social-list');
  if (!list) return;
  list.innerHTML = '<div class="text-xs text-slate-500 italic">Loading…</div>';
  try {
    const r = await apiGetJson('/social/accounts');
    const accounts = r.accounts || [];
    list.innerHTML = accounts.length
      ? accounts.map(a => `
        <div class="flex items-center justify-between gap-3 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2">
          <div class="min-w-0">
            <div class="text-sm font-bold text-slate-900 dark:text-white truncate">${esc(a.display_name)}</div>
            <div class="text-[11px] text-slate-400">${esc(STUDIO_SOCIAL_PROVIDER_LABEL[a.provider] || a.provider)}${a.handle ? ' · ' + esc(a.handle) : ''}</div>
          </div>
          <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${a.status === 'connected' ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}">${esc(a.status || 'connected')}</span>
        </div>`).join('')
      : '<div class="text-xs text-slate-500 italic">No accounts connected yet.</div>';
  } catch (e) {
    if (e.message === 'MFA_REQUIRED') {
      list.innerHTML = `<div class="text-[12px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">Complete multi-factor authentication above to manage connected accounts.</div>`;
    } else {
      list.innerHTML = `<div class="text-xs text-rose-500">${esc(e.message || 'Could not load')}</div>`;
    }
  }
}
window.studioSocialConnectionsRender = studioSocialConnectionsRender;

function studioSocialConnectForm() {
  const ov = crmOverlay(`
    <div class="p-5">
      <h2 class="text-lg font-black text-slate-900 dark:text-white mb-1">Connect an account</h2>
      <p class="text-[13px] text-slate-500 mb-4">Enter the account's details as they appear on that platform.</p>
      <div class="text-[12px] font-bold text-slate-700 dark:text-slate-200 mb-1">Platform</div>
      <select id="ssc-provider" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 p-2 text-[13px] mb-3">
        ${STUDIO_SOCIAL_PROVIDERS.map(p => `<option value="${esc(p)}">${esc(STUDIO_SOCIAL_PROVIDER_LABEL[p])}</option>`).join('')}
      </select>
      <div class="text-[12px] font-bold text-slate-700 dark:text-slate-200 mb-1">Display name</div>
      <input id="ssc-name" type="text" placeholder="e.g. Downtown Motors" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 p-2 text-[13px] mb-3">
      <div class="text-[12px] font-bold text-slate-700 dark:text-slate-200 mb-1">Handle (optional)</div>
      <input id="ssc-handle" type="text" placeholder="@downtownmotors" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 p-2 text-[13px] mb-3">
      <div class="text-[12px] font-bold text-slate-700 dark:text-slate-200 mb-1">Account ID on that platform</div>
      <input id="ssc-external-id" type="text" placeholder="Page/profile ID" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 p-2 text-[13px] mb-4">
      <div class="flex gap-2">
        <button onclick="studioSocialConnectSave(this)" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[13px] font-bold">Connect</button>
        <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[13px] font-bold">Cancel</button>
      </div>
    </div>`, 'max-w-md');
  if (!ov) return;
}
window.studioSocialConnectForm = studioSocialConnectForm;

async function studioSocialConnectSave(btn) {
  const root = btn.closest('.fixed');
  const provider = root.querySelector('#ssc-provider').value;
  const displayName = root.querySelector('#ssc-name').value.trim();
  const handle = root.querySelector('#ssc-handle').value.trim();
  const externalId = root.querySelector('#ssc-external-id').value.trim();
  if (!displayName || !externalId) return showToast('Display name and account ID are required.', 'error');
  try {
    await apiSendJson('/social/accounts', 'POST', { provider, display_name: displayName, handle: handle || null, external_account_id: externalId, ownership: 'dealership' });
    root.remove();
    showToast('Account connected', 'success');
    studioSocialConnectionsRender();
  } catch (e) { showToast(e.message, 'error'); }
}
window.studioSocialConnectSave = studioSocialConnectSave;
