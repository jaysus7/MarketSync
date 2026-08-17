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

async function openStudioScheduler() {
  const ov = crmOverlay(`<div class="p-5">
    <div class="flex items-center justify-between mb-3">
      <div>
        <h2 class="text-lg font-black text-slate-900 dark:text-white">Schedule</h2>
        <p class="text-[12px] text-slate-500">Post your designs to your connected accounts — built into Design Studio, nothing to add.</p>
      </div>
      <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <div id="studio-sched-body" class="space-y-2 min-h-[120px]">
      <div class="text-sm text-slate-400 italic py-6 text-center">Loading…</div>
    </div>
  </div>`, 'max-w-xl');
  await loadStudioSchedulerPosts();
  if (!document.body.contains(ov)) return;   // closed while loading
}
window.openStudioScheduler = openStudioScheduler;

async function loadStudioSchedulerPosts() {
  const body = document.getElementById('studio-sched-body');
  if (!body) return;
  try {
    const [accountsRes, postsRes] = await Promise.all([
      apiGetJson('/social/accounts').catch(() => ({ accounts: [] })),
      apiGetJson('/social/posts').catch(() => ({ posts: [] })),
    ]);
    __studioSchedulerAccounts = accountsRes.accounts || [];
    __studioSchedulerPosts = postsRes.posts || [];
    if (!document.getElementById('studio-sched-body')) return;
    renderStudioSchedulerList();
  } catch (e) {
    if (body) body.innerHTML = `<div class="text-sm text-rose-500 py-6 text-center">${esc(e.message || 'Could not load')}</div>`;
  }
}

function renderStudioSchedulerList() {
  const body = document.getElementById('studio-sched-body');
  if (!body) return;
  const accountNote = __studioSchedulerAccounts.length
    ? ''
    : `<div class="text-[12px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5 mb-2">No accounts connected yet — connect one in Settings before scheduling a post.</div>`;
  const upcoming = __studioSchedulerPosts
    .filter(p => p.status !== 'published' && p.status !== 'cancelled')
    .sort((a, b) => new Date(a.scheduled_local || 0) - new Date(b.scheduled_local || 0));
  const rows = upcoming.length
    ? upcoming.map(p => `
      <div class="flex items-start justify-between gap-3 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
        <div class="min-w-0 flex-1">
          <p class="text-sm text-slate-800 dark:text-slate-100 line-clamp-2">${esc(p.body || '(no caption)')}</p>
          <p class="text-[11px] text-slate-400 mt-1">${p.scheduled_local ? esc(new Date(p.scheduled_local).toLocaleString()) : 'Draft — not scheduled'} · ${esc(p.status || 'draft')}</p>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button onclick="studioSchedulerPublishNow('${esc(p.id)}')" title="Publish now" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 5l7 7-7 7M5 12h14"/></svg></button>
          <button onclick="studioSchedulerReschedule('${esc(p.id)}')" title="Reschedule" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></button>
          <button onclick="studioSchedulerCancelPost('${esc(p.id)}')" title="Cancel" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg></button>
        </div>
      </div>`).join('')
    : `<div class="text-sm text-slate-400 italic py-4 text-center">Nothing scheduled yet.</div>`;
  body.innerHTML = `${accountNote}${rows}
    <button onclick="studioSchedulerCompose()" class="w-full mt-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold py-2.5 rounded-lg transition">+ Schedule a post</button>`;
}

async function studioSchedulerCompose() {
  const accounts = __studioSchedulerAccounts;
  const usable = accounts.filter(a => a.can_publish);
  const refused = accounts.filter(a => !a.can_publish);
  let assets = [];
  try { assets = (await apiGetJson('/marketing/assets').catch(() => ({ assets: [] }))).assets || []; } catch {}

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
            <input type="checkbox" class="ss-media" value="${esc(a.public_url)}">
            <img src="${esc(a.public_url)}" alt="${esc(a.alt_text || '')}" class="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700">
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
