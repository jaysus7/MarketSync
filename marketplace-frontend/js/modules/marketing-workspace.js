/**
 * Marketing workspace — the department's operating surface (Phase 6 PR 6.5).
 *
 * My Day is an exception and opportunity queue, COMPOSED by the server from what each
 * Phase 6 slice already produces — campaigns, social, conversations. This file re-derives
 * nothing: a second opinion about "what needs attention" would drift from the department
 * that owns the fact.
 *
 * Two honesty rules carried through from the backend:
 *   • Attribution by ID is LINKED; a legacy free-text source is INFERRED, and the two are
 *     never shown as the same kind of number.
 *   • Gross comes from the posted ledger. A campaign whose deliveries have no posted
 *     journal shows its units with the gross marked incomplete, never an assumed average.
 */

const MKT_VIEWS = [
  ['campaigns', 'Campaigns'], ['studio', 'Studio'], ['social', 'Social'],
  ['conversations', 'Conversations'], ['attribution', 'Attribution'],
];
let __mktView = 'campaigns';
let __socialView = 'calendar';
let __socialCalendarMode = 'month';
let __socialCalendarAnchor = '';
let __socialNetworkFilter = 'all';
let __socialAccountFilter = 'all';
let __socialCampaignFilter = 'all';
let __socialStatusFilter = 'all';
let __socialOwnerFilter = 'all';
function mktView(v) { __mktView = v; engineTab('marketing-overview', 'work'); }
window.mktView = mktView;
function mktSocialView(v) { __socialView = v; mktView('social'); }
function mktSocialCalendarMode(v) { __socialCalendarMode = v; mktView('social'); }
function mktSocialNetworkFilter(v) { __socialNetworkFilter = v; mktView('social'); }
function mktSocialFilter(kind, v) {
  if (kind === 'account') __socialAccountFilter = v;
  if (kind === 'campaign') __socialCampaignFilter = v;
  if (kind === 'status') __socialStatusFilter = v;
  if (kind === 'owner') __socialOwnerFilter = v;
  mktView('social');
}
function mktCalendarMove(months) {
  const base = __socialCalendarAnchor ? new Date(`${__socialCalendarAnchor}T12:00:00Z`) : new Date();
  if (__socialCalendarMode === 'week') base.setUTCDate(base.getUTCDate() + (Number(months || 0) * 7));
  else base.setUTCMonth(base.getUTCMonth() + Number(months || 0));
  __socialCalendarAnchor = base.toISOString().slice(0, 10);
  mktView('social');
}
Object.assign(window, { mktSocialView, mktSocialCalendarMode, mktSocialNetworkFilter, mktSocialFilter, mktCalendarMove });

const mktMoney = (v) => {
  const x = Number(v) || 0;
  return (x < 0 ? '-$' : '$') + Math.abs(x).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};
const MKT_TONE = { 3: 'text-rose-600 dark:text-rose-400', 2: 'text-amber-600 dark:text-amber-400', 1: 'text-emerald-600 dark:text-emerald-400' };
// Machine states are written for storage, not for a person standing at a desk.
const mktLabel = (s) => { const t = String(s || '').replace(/_/g, ' '); return t ? t[0].toUpperCase() + t.slice(1) : ''; };

// Where an item sends you. Marketing's items stay here; a conversation belongs to Sales and
// a gross gap belongs to Accounting, so those hand off rather than pretending to be ours.
function mktGo(kind) {
  if (kind.startsWith('conversation_')) return "mktView('conversations')";
  if (kind.startsWith('social_')) return "mktView('social')";
  if (kind === 'campaign_gross_incomplete') return "switchPage('accounting-overview')";
  return "mktView('campaigns')";
}

function mktAttentionRow(x) {
  return `<div class="py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <button onclick="${mktGo(x.kind)}" class="w-full text-left">
      <div class="flex items-start gap-3">
        <div class="min-w-0 flex-1">
          <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(x.subject || x.kind)}</div>
          <div class="text-[12px] text-slate-400">${esc(x.reason || '')}</div>
        </div>
        ${x.amount != null ? `<div class="shrink-0 text-[13px] font-bold ${MKT_TONE[x.severity] || ''}">${esc(mktMoney(x.amount))}</div>` : ''}
      </div>
      <div class="text-[12px] font-semibold mt-1 ${MKT_TONE[x.severity] || ''}">${esc(x.action || 'Review')}${x.owner ? ` · ${esc(x.owner)}` : ''}</div>
    </button>
  </div>`;
}

function mktRow({ title, sub, right, tone, note, onclick, actionLabel = 'Open' }) {
  return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <div class="min-w-0 flex-1">
      <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(title)}</div>
      <div class="text-[12px] text-slate-400 truncate">${esc(sub || '')}</div>
      ${note ? `<div class="text-[12px] ${tone || 'text-slate-400'}">${esc(note)}</div>` : ''}
    </div>
    <div class="shrink-0 text-right text-[13px] font-bold ${tone || ''}">${esc(right || '')}</div>
    ${onclick ? `<button onclick="${onclick}" class="shrink-0 px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">${esc(actionLabel)}</button>` : ''}
  </div>`;
}

const MKT_STATUS_TONE = {
  active: 'text-emerald-600 dark:text-emerald-400',
  needs_approval: 'text-amber-600 dark:text-amber-400',
  exception: 'text-rose-600 dark:text-rose-400',
  paused: 'text-slate-500',
};

async function mktCampaignStatus(id, status) {
  try {
    await apiSendJson(`/campaigns/${id}/status`, 'POST', { status });
    showToast(`Campaign ${status.replace(/_/g, ' ')} `, 'success');
    ENGINE_DATA['marketing-overview'] = undefined;
    engineTab('marketing-overview', ENGINE_STATE['marketing-overview'] || 'work', true);
  } catch (e) { showToast(e.message, 'error'); }
}
window.mktCampaignStatus = mktCampaignStatus;

const mktReload = () => {
  ENGINE_DATA['marketing-overview'] = undefined;
  engineTab('marketing-overview', ENGINE_STATE['marketing-overview'] || 'work', true);
};

/**
 * Compose a post. Only accounts the SERVER said this user may publish to are offered — the
 * list is filtered on `can_publish`, and an account it refused is shown with the refusal
 * rather than hidden, so nobody wonders where their page went.
 */
function mktCompose(prefill = {}) {
  const d = ENGINE_DATA['marketing-overview'] || {};
  const accounts = d.accounts || [], assets = d.assets || [], campaigns = d.campaigns || [], inventory = d.inventory || [];
  const usable = accounts.filter(a => a.can_publish);
  const refused = accounts.filter(a => !a.can_publish);

  crmOverlay(`
    <div class="p-5">
      <h2 class="text-lg font-black text-slate-900 dark:text-white mb-1">New post</h2>
      <p class="text-[13px] text-slate-500 mb-4">Nothing is sent until a network confirms it. You will see exactly which accounts it reached.</p>
      <textarea id="mkt-body" rows="4" placeholder="What do you want to say?"
        class="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 p-3 text-[14px] mb-3">${esc(prefill.body || '')}</textarea>
      <div class="text-[12px] font-bold text-slate-700 dark:text-slate-200 mb-1">Publish to</div>
      ${usable.length ? usable.map(a => `<div class="py-1.5">
        <label class="flex items-center gap-2"><input type="checkbox" class="mkt-target" value="${esc(a.id)}" onchange="mktToggleVariant(this)">
          <span class="text-[13px] text-slate-900 dark:text-white">${esc(a.display_name)}</span><span class="text-[12px] text-slate-400">${esc(a.provider)}</span>
        </label>
        <label class="mkt-variant-wrap hidden ml-6 mt-1 text-[11px] font-bold text-slate-500">Caption for ${esc(a.provider)}
          <textarea rows="2" class="mkt-variant mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 p-2 text-[12px] font-normal" data-account-id="${esc(a.id)}" placeholder="Optional — leave blank to use the shared caption"></textarea>
        </label>
      </div>`).join('') : `<div class="text-[13px] text-rose-600 dark:text-rose-400">You cannot publish to any connected account yet.</div>`}
      ${refused.length ? `<div class="mt-2 text-[12px] text-slate-400">${refused.map(a =>
        `${esc(a.display_name)} — ${esc(a.why || 'not available to you')}`).join('<br>')}</div>` : ''}
      ${assets.length ? `<div class="text-[12px] font-bold text-slate-700 dark:text-slate-200 mt-4 mb-1">Attach from Studio</div>
        <div class="flex gap-2 overflow-x-auto pb-1">${assets.slice(0, 20).map(a => `
          <label class="shrink-0 cursor-pointer">
            <input type="checkbox" class="mkt-media" value="${esc(a.public_url)}" ${prefill.assetUrl === a.public_url ? 'checked' : ''}>
            <img src="${esc(a.public_url)}" alt="${esc(a.alt_text || '')}" class="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700">
          </label>`).join('')}</div>` : ''}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        <label class="text-[12px] font-bold text-slate-700 dark:text-slate-200">Campaign<select id="mkt-campaign" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 p-2 text-[13px]"><option value="">No campaign</option>${campaigns.map(c=>`<option value="${esc(c.id)}" ${prefill.campaignId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>
        <label class="text-[12px] font-bold text-slate-700 dark:text-slate-200">Vehicle<select id="mkt-vehicle" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 p-2 text-[13px]"><option value="">No vehicle</option>${inventory.map(v=>`<option value="${esc(v.id)}">${esc(`${v.year||''} ${v.make||''} ${v.model||''} · ${v.stocknumber||'no stock #'}`.trim())}</option>`).join('')}</select></label>
      </div>
      <div class="text-[12px] font-bold text-slate-700 dark:text-slate-200 mt-4 mb-1">When</div>
      <input id="mkt-when" type="datetime-local" class="rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 p-2 text-[13px]">
      <div class="text-[12px] text-slate-400 mt-1">Leave empty to save as a draft you can publish by hand.</div>
      <div class="flex gap-2 mt-5">
        <button onclick="mktSavePost(this)" class="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[13px] font-bold">Save post</button>
        <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[13px] font-bold">Cancel</button>
      </div>
    </div>`, 'max-w-lg');
}
window.mktCompose = mktCompose;

function mktToggleVariant(input) {
  input.closest('div')?.querySelector('.mkt-variant-wrap')?.classList.toggle('hidden', !input.checked);
}
window.mktToggleVariant = mktToggleVariant;

async function mktSavePost(btn) {
  const root = btn.closest('.fixed');
  const targets = [...root.querySelectorAll('.mkt-target:checked')].map(i => {
    const bodyOverride = [...root.querySelectorAll('.mkt-variant')].find(v => v.dataset.accountId === i.value)?.value.trim();
    return { social_account_id: i.value, body_override: bodyOverride || null };
  });
  if (!targets.length) return showToast('Choose at least one account to publish to.', 'error');
  const when = root.querySelector('#mkt-when').value;
  try {
    await apiSendJson('/social/posts', 'POST', {
      body: root.querySelector('#mkt-body').value,
      media: [...root.querySelectorAll('.mkt-media:checked')].map(i => i.value),
      campaign_id: root.querySelector('#mkt-campaign')?.value || null,
      inventory_id: root.querySelector('#mkt-vehicle')?.value || null,
      scheduled_local: when || null,
      targets,
    });
    root.remove();
    showToast(when ? 'Post scheduled ' : 'Draft saved ', 'success');
    mktReload();
  } catch (e) { showToast(e.message, 'error'); }
}
window.mktSavePost = mktSavePost;

/**
 * Publish now. The response says what actually happened per account, so a partial result is
 * reported as one — never rounded up to "published".
 */
async function mktPublishNow(postId) {
  try {
    const r = await apiSendJson(`/social/posts/${postId}/publish`, 'POST', {});
    const ok = (r.results || []).filter(x => x.status === 'published').length;
    const bad = (r.results || []).filter(x => x.status === 'failed' || x.status === 'skipped');
    showToast(bad.length
      ? `Published to ${ok}, could not publish to ${bad.length}: ${bad[0].error || 'see the post'}`
      : `Published to ${ok} account(s) `, bad.length ? 'error' : 'success');
    mktReload();
  } catch (e) { showToast(e.message, 'error'); }
}
window.mktPublishNow = mktPublishNow;

async function mktReschedule(postId, current) {
  const next = prompt('Schedule date/time in the dealership timezone', ''); if (!next) return;
  try { await apiSendJson(`/social/posts/${postId}`, 'PUT', { scheduled_local: next }); showToast('Post rescheduled', 'success'); mktReload(); }
  catch (e) { showToast(e.message, 'error'); }
}
function mktCalendarDrag(ev, postId, localTime) { ev.dataTransfer.setData('text/plain', JSON.stringify({ postId, localTime })); ev.dataTransfer.effectAllowed = 'move'; }
async function mktCalendarDrop(ev, date, localTime) {
  ev.preventDefault();
  let postId;
  try { ({ postId, localTime } = JSON.parse(ev.dataTransfer.getData('text/plain'))); }
  catch { postId = ev.dataTransfer.getData('text/plain'); }
  if (!postId || !date) return;
  try {
    await apiSendJson(`/social/posts/${postId}`, 'PUT', { scheduled_local: `${date}T${localTime || '09:00'}` });
    showToast('Post rescheduled', 'success');
    mktReload();
  } catch (e) { showToast(e.message, 'error'); }
}
async function mktApprovePost(postId) {
  try { await apiSendJson(`/social/posts/${postId}/approve`, 'POST', {}); showToast('Post approved', 'success'); mktReload(); }
  catch (e) { showToast(e.message, 'error'); }
}
async function mktCancelPost(postId) {
  if (!confirm('Cancel this post?')) return;
  try { await apiSendJson(`/social/posts/${postId}/cancel`, 'POST', {}); showToast('Post cancelled', 'success'); mktReload(); }
  catch (e) { showToast(e.message, 'error'); }
}
Object.assign(window, { mktReschedule, mktApprovePost, mktCancelPost, mktCalendarDrag, mktCalendarDrop });

async function mktUploadAsset(input) {
  const file = input.files?.[0]; if (!file) return;
  showToast('Uploading…', 'info');
  try {
    const fd = new FormData(); fd.append('file', file);
    const r = await fetch(`${API}/marketing/assets`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Upload failed');
    showToast('Added to Studio ', 'success');
    mktReload();
  } catch (e) { showToast(e.message, 'error'); }
  input.value = '';
}
window.mktUploadAsset = mktUploadAsset;

function mktStudioOpen(assetId = '', assetUrl = '') {
  crmOverlay(`<div class="p-5">
    <div class="flex items-start justify-between gap-3 mb-4"><div><h2 class="text-lg font-black text-slate-900 dark:text-white">Create in Studio</h2><p class="text-[12px] text-slate-500">Build a reusable social creative, then schedule it through the same Social composer.</p></div></div>
    <div class="grid md:grid-cols-[1fr_260px] gap-4">
      <div id="mkt-design-preview" class="relative overflow-hidden rounded-xl bg-violet-700 aspect-square bg-cover bg-center" style="${assetUrl ? `background-image:url('${esc(assetUrl)}')` : ''}">
        <div data-shade class="absolute inset-0 bg-black/50"></div><div data-copy class="absolute inset-0 p-[7%] flex flex-col justify-end text-white"><div data-head class="text-2xl md:text-3xl font-black leading-tight">Your headline</div><div data-sub class="text-sm mt-2">Supporting details</div><div data-cta class="self-start mt-4 rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold">Learn more</div></div>
      </div>
      <div class="space-y-2">
        <label class="block text-[11px] font-bold text-slate-500">Format<select id="mkt-design-format" class="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 p-2 text-[13px]" onchange="mktStudioPreview()"><option value="square">Square post</option><option value="portrait">Portrait post</option><option value="story">Story</option><option value="landscape">Landscape</option></select></label>
        <label class="block text-[11px] font-bold text-slate-500">Headline<input id="mkt-design-head" maxlength="140" value="Your headline" class="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 p-2 text-[13px]" oninput="mktStudioPreview()"></label>
        <label class="block text-[11px] font-bold text-slate-500">Supporting text<textarea id="mkt-design-sub" maxlength="220" rows="2" class="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 p-2 text-[13px]" oninput="mktStudioPreview()">Supporting details</textarea></label>
        <label class="block text-[11px] font-bold text-slate-500">Button text<input id="mkt-design-cta" maxlength="60" value="Learn more" class="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 p-2 text-[13px]" oninput="mktStudioPreview()"></label>
        <div class="grid grid-cols-2 gap-2"><label class="text-[11px] font-bold text-slate-500">Accent<input id="mkt-design-accent" type="color" value="#6d28d9" class="mt-1 block w-full h-9" oninput="mktStudioPreview()"></label><label class="text-[11px] font-bold text-slate-500">Text<input id="mkt-design-text" type="color" value="#ffffff" class="mt-1 block w-full h-9" oninput="mktStudioPreview()"></label></div>
        <input id="mkt-design-asset" type="hidden" value="${esc(assetId)}">
      </div>
    </div>
    <div class="flex flex-wrap gap-2 mt-5"><button onclick="mktStudioRender(this, false)" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[13px] font-bold">Save to library</button><button onclick="mktStudioRender(this, true)" class="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[13px] font-bold">Save & schedule</button><button onclick="this.closest('.fixed').remove()" class="px-4 py-2 text-[13px] font-bold text-slate-500">Cancel</button></div>
  </div>`, 'max-w-3xl');
}
function mktStudioPreview() {
  const root = document.querySelector('#mkt-design-preview')?.closest('.fixed'); if (!root) return;
  const preview = root.querySelector('#mkt-design-preview'), format = root.querySelector('#mkt-design-format').value;
  preview.className = `relative overflow-hidden rounded-xl bg-violet-700 bg-cover bg-center ${format === 'story' ? 'aspect-[9/16] max-h-[58vh]' : format === 'portrait' ? 'aspect-[4/5]' : format === 'landscape' ? 'aspect-[1.91/1]' : 'aspect-square'}`;
  preview.querySelector('[data-head]').textContent = root.querySelector('#mkt-design-head').value || 'Headline';
  preview.querySelector('[data-sub]').textContent = root.querySelector('#mkt-design-sub').value;
  const cta = preview.querySelector('[data-cta]'); cta.textContent = root.querySelector('#mkt-design-cta').value; cta.style.backgroundColor = root.querySelector('#mkt-design-accent').value;
  preview.querySelector('[data-copy]').style.color = root.querySelector('#mkt-design-text').value;
}
async function mktStudioRender(btn, schedule) {
  const root = btn.closest('.fixed'); btn.disabled = true;
  try {
    const body = { asset_id: root.querySelector('#mkt-design-asset').value || null, format: root.querySelector('#mkt-design-format').value, headline: root.querySelector('#mkt-design-head').value, subheadline: root.querySelector('#mkt-design-sub').value, cta: root.querySelector('#mkt-design-cta').value, accent_color: root.querySelector('#mkt-design-accent').value, text_color: root.querySelector('#mkt-design-text').value };
    const result = await apiSendJson('/marketing/studio/render', 'POST', body);
    root.remove(); ENGINE_DATA['marketing-overview'] = undefined;
    if (schedule) { await ENGINES['marketing-overview'].fetch().then(d => { ENGINE_DATA['marketing-overview'] = d; mktCompose({ assetUrl: result.asset.public_url, body: body.headline }); }); }
    else { showToast('Design saved to Studio', 'success'); mktReload(); }
  } catch (e) { btn.disabled = false; showToast(e.message, 'error'); }
}
Object.assign(window, { mktStudioOpen, mktStudioPreview, mktStudioRender });

async function mktTakeover(conversationId) {
  try {
    await apiSendJson(`/conversations/${conversationId}/takeover`, 'POST', {});
    showToast('You are handling this conversation ', 'success');
    ENGINE_DATA['marketing-overview'] = undefined;
    engineTab('marketing-overview', ENGINE_STATE['marketing-overview'] || 'work', true);
  } catch (e) { showToast(e.message, 'error'); }
}
window.mktTakeover = mktTakeover;

ENGINES['marketing-overview'] = {
  rootId: 'marketing-overview-root', title: 'Marketing',
  subtitle: 'Campaigns, social, conversations — and what they actually produced',
  icon: 'megaphone', accent: 'violet',
  tabLabels: { overview: 'My Day', work: 'Work', insights: 'Insights' },
  get tabOrder() {
    const mgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
    return mgr ? ['overview', 'work', 'insights'] : ['overview', 'work'];
  },

  quickActions: [
    { label: 'Studio', icon: 'image', onclick: "mktView('studio')" },
    { label: 'Campaigns', icon: 'megaphone', onclick: "mktView('campaigns')" },
    { label: 'Social', icon: 'chart', onclick: "mktView('social')" },
    { label: 'Conversations', icon: 'chat', onclick: "mktView('conversations')" },
    { label: 'Attribution', icon: 'currency', onclick: "mktView('attribution')" },
  ],
  nextActions: (d) => (d?.needsAttention || []).slice(0, 5).map(x => ({
    label: `${x.subject} — ${x.action}`, icon: 'flame',
    tone: MKT_TONE[x.severity] || MKT_TONE[2], onclick: mktGo(x.kind),
  })),

  fetch: async () => {
    const [att, camps, accounts, posts, convos, roi, assets, inventory] = await Promise.all([
      apiGetJson('/my-day').catch(() => ({ needs_attention: [], opportunities: [], failed: [{ source: 'my-day', label: 'My Day', reason: 'could not be loaded' }], not_covered: [] })),
      apiGetJson('/campaigns').catch(() => ({ campaigns: [] })),
      apiGetJson('/social/accounts').catch(() => ({ accounts: [] })),
      apiGetJson('/social/posts').catch(() => ({ posts: [], timezone: 'UTC' })),
      apiGetJson('/conversations').catch(() => ({ conversations: [] })),
      apiGetJson('/marketing/roi').catch(() => null),
      apiGetJson('/marketing/assets').catch(() => ({ assets: [] })),
      apiGetJson('/inventory').catch(() => []),
    ]);
    return {
      needsAttention: att.needs_attention || [],
      opportunities: att.opportunities || [],
      // What the day could NOT see. Rendered, never swallowed — a calm morning caused by a
      // failed department is worse than one that says so.
      dayFailed: att.failed || [],
      dayNotCovered: att.not_covered || [],
      campaigns: camps.campaigns || [],
      accounts: accounts.accounts || [],
      posts: posts.posts || [],
      socialTimezone: posts.timezone || 'UTC',
      conversations: convos.conversations || [],
      assets: assets.assets || [],
      inventory: Array.isArray(inventory) ? inventory : [],
      roi,
    };
  },

  tabs: {
    overview(body, d) {
      const att = d.needsAttention || [], opp = d.opportunities || [];
      const waiting = (d.conversations || []).filter(c => c.status === 'waiting_dealer').length;
      const live = (d.campaigns || []).filter(c => c.status === 'active').length;
      const failed = d.dayFailed || [], notCovered = d.dayNotCovered || [];
      const caveat = (failed.length || notCovered.length) ? `
        <div class="mb-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-3">
          ${failed.length ? `<div class="text-[13px] font-bold text-amber-800 dark:text-amber-300">This day is incomplete.</div>
            <div class="text-[12px] text-amber-700 dark:text-amber-400">${failed.map(f => `${esc(f.label || f.source)} could not be loaded (${esc(f.reason || 'unknown')})`).join(' · ')}</div>` : ''}
          ${notCovered.length ? `<div class="text-[12px] text-amber-700 dark:text-amber-400 ${failed.length ? 'mt-1' : ''}">Not covered here yet: ${esc(notCovered.join(', '))}.</div>` : ''}
        </div>` : '';
      body.innerHTML = `
        ${caveat}
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          ${engKpi('Needs attention', att.length, att.length ? 'text-rose-600 dark:text-rose-400' : '')}
          ${engKpi('Opportunities', opp.length, opp.length ? 'text-emerald-600 dark:text-emerald-400' : '')}
          ${engKpi('Live campaigns', live)}
          ${engKpi('Customers waiting', waiting, waiting ? 'text-amber-600 dark:text-amber-400' : '')}
        </div>
        ${engCard(`Needs attention (${att.length})`,
          att.length ? att.slice(0, 25).map(mktAttentionRow).join('')
                     : engEmpty('Nothing needs marketing right now.'))}
        <div class="mt-4"></div>
        ${engCard(`Opportunities (${opp.length})`,
          opp.length ? opp.slice(0, 15).map(mktAttentionRow).join('')
                     : engEmpty('No standout opportunities yet.'))}`;
    },

    work(body, d) {
      const nav = MKT_VIEWS.map(([v, label]) => `<button onclick="mktView('${v}')"
        class="px-3 py-1.5 rounded-lg text-[12px] font-bold whitespace-nowrap transition ${__mktView === v
          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
          : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}">${esc(label)}</button>`).join('');
      let inner = '';

      if (__mktView === 'campaigns') {
        const rows = d.campaigns || [];
        const spent = rows.reduce((s, c) => s + (c.spend?.actual || 0), 0);
        inner = `
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            ${engKpi('Campaigns', rows.length)}
            ${engKpi('Active', rows.filter(c => c.status === 'active').length)}
            ${engKpi('Spent', mktMoney(spent))}
            ${engKpi('Awaiting approval', rows.filter(c => c.status === 'needs_approval').length,
              rows.some(c => c.status === 'needs_approval') ? 'text-amber-600 dark:text-amber-400' : '')}
          </div>
          ${engCard('Campaigns', rows.length ? rows.map(c => {
            const p = c.performance || {}, s = c.spend || {};
            // ROI is only shown when it is real: actual spend AND posted gross. An
            // incomplete gross is said out loud rather than quietly averaged away.
            const roi = c.roi == null ? '—' : `${c.roi > 0 ? '+' : ''}${c.roi}%`;
            return mktRow({
              title: c.name,
              sub: `${(c.channels || []).join(', ') || 'no channel'} · ${mktLabel(c.status)}`,
              note: `${p.leads || 0} leads · ${p.delivered || 0} delivered · spent ${mktMoney(s.actual || 0)} of ${mktMoney(s.budget || 0)} budget`
                    + (c.gross_complete === false ? ' · gross incomplete' : ''),
              right: roi,
              tone: c.gross_complete === false ? 'text-amber-600 dark:text-amber-400' : (MKT_STATUS_TONE[c.status] || ''),
              onclick: c.status === 'needs_approval' ? `mktCampaignStatus('${c.id}','approved')` : null,
            });
          }).join('') : engEmpty('No campaigns yet.'))}`;
      }

      if (__mktView === 'studio') {
        const assets = d.assets || [];
        inner = `
          <div class="flex items-center justify-between gap-3 mb-3">
            <div class="text-[13px] text-slate-500">The dealership's own images, reusable across posts and campaigns.</div>
            <div class="flex gap-2"><button onclick="mktStudioOpen()" class="shrink-0 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-[12px] font-bold">Create design</button><label class="shrink-0 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[12px] font-bold cursor-pointer">
              Upload<input type="file" accept="image/*" class="hidden" onchange="mktUploadAsset(this)">
            </label></div>
          </div>
          ${engCard(`Media library (${assets.length})`, assets.length ? `
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              ${assets.map(a => `<div class="min-w-0">
                <img src="${esc(a.public_url)}" alt="${esc(a.alt_text || '')}" loading="lazy"
                     class="w-full aspect-square object-cover rounded-lg border border-slate-200 dark:border-slate-700">
                <div class="text-[11px] text-slate-400 truncate mt-1">${esc(a.title || `${a.width || '?'}×${a.height || '?'}`)}</div>
                <div class="flex gap-2 mt-1"><button onclick="mktStudioOpen('${esc(a.id)}','${esc(a.public_url)}')" class="text-[11px] font-bold text-violet-600">Use as background</button><button onclick="mktCompose({assetUrl:'${esc(a.public_url)}'})" class="text-[11px] font-bold text-slate-600 dark:text-slate-300">Schedule</button></div>
              </div>`).join('')}
            </div>` : engEmpty('Nothing in Studio yet. Create a design or upload a photo.'))}`;
      }

      if (__mktView === 'social') {
        const accounts = d.accounts || [], posts = d.posts || [];
        const tz = d.socialTimezone || 'UTC';
        const broken = accounts.filter(a => a.status !== 'connected');
        // Nothing publishes until a network integration is connected. Saying so here is the
        // difference between a queue that looks healthy and one a person can act on.
        const unsent = posts.filter(p => ['scheduled', 'failed', 'partially_published'].includes(p.status)
          || (p.targets || []).some(t => t.status === 'failed'));
        const socialTabs = [['calendar','Calendar'],['queue','Queue'],['drafts','Drafts'],['approvals','Approvals'],['published','Published'],['failed','Failed']]
          .map(([v,l]) => `<button onclick="mktSocialView('${v}')" class="px-3 py-1.5 rounded-lg text-[12px] font-bold ${__socialView===v?'bg-violet-600 text-white':'border border-slate-200 dark:border-slate-700'}">${l}</button>`).join('');
        const viewPosts = posts.filter(p => __socialView === 'drafts' ? p.status === 'draft'
          : __socialView === 'approvals' ? p.status === 'needs_approval'
          : __socialView === 'published' ? p.status === 'published'
          : __socialView === 'failed' ? (p.status === 'failed' || p.status === 'partially_published' || (p.targets||[]).some(t=>t.status==='failed'))
          : __socialView === 'queue' ? ['scheduled','publishing','needs_approval'].includes(p.status)
          : !!p.scheduled_for);
        const networks = [...new Set(posts.flatMap(p => (p.targets || []).map(t => t.account?.provider).filter(Boolean)))].sort();
        const selected = viewPosts.filter(p => (__socialNetworkFilter === 'all'
          || (p.targets || []).some(t => t.account?.provider === __socialNetworkFilter))
          && (__socialAccountFilter === 'all' || (p.targets || []).some(t => t.social_account_id === __socialAccountFilter))
          && (__socialCampaignFilter === 'all' || p.campaign_id === __socialCampaignFilter)
          && (__socialStatusFilter === 'all' || p.status === __socialStatusFilter)
          && (__socialOwnerFilter === 'all' || p.created_by === __socialOwnerFilter));
        const campaignOptions = (d.campaigns || []).filter(c => posts.some(p => p.campaign_id === c.id));
        const ownerOptions = [...new Map(posts.filter(p => p.created_by).map(p => [p.created_by, p.creator?.full_name || 'Unknown user'])).entries()];
        const statusOptions = [...new Set(posts.map(p => p.status).filter(Boolean))].sort();
        const fmt = (iso) => { if (!iso) return 'Unscheduled'; try { return new Intl.DateTimeFormat(undefined,{timeZone:tz,month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(iso)); } catch { return new Date(iso).toLocaleString(); } };
        const localParts = (iso) => {
          try {
            const values = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(new Date(iso)).map(x => [x.type, x.value]));
            return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
          } catch { return { date: String(iso || '').slice(0, 10), time: String(iso || '').slice(11, 16) || '09:00' }; }
        };
        const postCard = (p, compact = false) => {
          const targets = p.targets || [], failed = targets.filter(t=>t.status==='failed');
          const why = failed[0]?.error || null;
          const partial = failed.length > 0 && failed.length < targets.length;
          const targetNetworks = [...new Set(targets.map(t=>t.account?.provider).filter(Boolean))].join(', ') || 'No network';
          const action = p.status === 'needs_approval' ? `<button onclick="mktApprovePost('${p.id}')" class="text-[11px] font-bold text-violet-600">Approve</button>`
            : ['draft','scheduled','failed'].includes(p.status) ? `<button onclick="mktReschedule('${p.id}','${p.scheduled_for || ''}')" class="text-[11px] font-bold text-violet-600">${p.scheduled_for?'Reschedule':'Schedule'}</button>` : '';
          const movable = ['draft','scheduled','needs_approval','failed'].includes(p.status) && p.scheduled_for;
          const drag = movable ? `draggable="true" ondragstart="mktCalendarDrag(event,'${p.id}','${localParts(p.scheduled_for).time}')" title="Drag to another day to reschedule"` : '';
          if (compact) return `<div ${drag} class="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 cursor-${movable?'move':'default'}"><div class="text-[10px] font-bold text-violet-600">${esc(localParts(p.scheduled_for).time)} · ${esc(targetNetworks)}</div><div class="text-[11px] font-semibold text-slate-900 dark:text-white truncate">${esc((p.body||'Untitled post').slice(0,55))}</div><div class="text-[10px] text-slate-400">${esc(mktLabel(p.status))}</div></div>`;
          const targetEvidence = targets.filter(t => ['published','failed'].includes(t.status)).map(t => {
            const account = t.account?.display_name || 'Unknown account';
            const provider = mktLabel(t.account?.provider || 'provider');
            if (t.status === 'published') return `<div class="text-[10px] text-emerald-700 dark:text-emerald-400"><b>${esc(provider)} · ${esc(account)}</b> — Published ${esc(fmt(t.published_at))}${t.external_post_id ? ` · Provider ID ${esc(t.external_post_id)}` : ''}</div>`;
            const attempted = t.last_attempt_at ? fmt(t.last_attempt_at) : 'Not recorded';
            const retry = t.next_attempt_at ? ` · next retry ${esc(fmt(t.next_attempt_at))}` : '';
            return `<div class="text-[10px] text-rose-700 dark:text-rose-400"><b>${esc(provider)} · ${esc(account)}</b> — ${esc(t.error || 'Publication failed')} · ${Number(t.attempts) || 0} attempt${Number(t.attempts) === 1 ? '' : 's'} · last attempt ${esc(attempted)}${retry}</div>`;
          }).join('');
          return `<div ${drag} class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex gap-3"><div class="w-16 h-14 rounded-lg bg-slate-100 dark:bg-slate-800 bg-cover bg-center shrink-0" ${p.media?.[0]?`style="background-image:url('${esc(p.media[0])}')"`:''}></div><div class="min-w-0 flex-1"><div class="text-[11px] font-bold text-slate-400">${esc(fmt(p.scheduled_for))} · ${esc(tz)}</div><div class="text-[13px] font-bold text-slate-900 dark:text-white truncate">${esc((p.body||'Untitled post').slice(0,90))}</div><div class="text-[11px] text-slate-500">${esc(targetNetworks)} · ${esc(partial ? 'Partly published' : failed.length ? 'Failed' : mktLabel(p.status))}${failed.length?` · ${failed.length} failed to publish`:''}${why?` · ${esc(why)}`:''}</div>${targetEvidence ? `<div class="mt-1.5 space-y-1">${targetEvidence}</div>` : ''}</div><div class="flex flex-col gap-1 text-right">${action}${['draft','scheduled','needs_approval','failed'].includes(p.status)?`<button onclick="mktCancelPost('${p.id}')" class="text-[11px] font-bold text-rose-600">Cancel</button>`:''}${failed.length?`<button onclick="mktPublishNow('${p.id}')" class="text-[11px] font-bold text-rose-600">Retry</button>`:''}</div></div>`;
        };
        const postRows = selected.length ? selected.slice(0, 100).map(p => postCard(p)).join('') : engEmpty(`No ${__socialView} posts.`);
        const anchorParts = localParts(__socialCalendarAnchor ? `${__socialCalendarAnchor}T12:00:00Z` : new Date().toISOString());
        if (!__socialCalendarAnchor) __socialCalendarAnchor = anchorParts.date;
        const logical = new Date(`${__socialCalendarAnchor}T12:00:00Z`);
        const start = new Date(logical);
        if (__socialCalendarMode === 'month') { start.setUTCDate(1); start.setUTCDate(start.getUTCDate() - start.getUTCDay()); }
        else { start.setUTCDate(start.getUTCDate() - start.getUTCDay()); }
        const dayCount = __socialCalendarMode === 'month' ? 42 : 7;
        const calendarDays = Array.from({ length: dayCount }, (_, i) => { const x = new Date(start); x.setUTCDate(x.getUTCDate() + i); return x; });
        const calendarGrid = `<div class="grid grid-cols-7 text-[10px] font-bold text-slate-400 mb-1">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>`<div class="px-1">${x}</div>`).join('')}</div><div class="grid grid-cols-7 border-l border-t border-slate-200 dark:border-slate-700">${calendarDays.map(day => {
          const date = day.toISOString().slice(0,10), inMonth = day.getUTCMonth() === logical.getUTCMonth();
          const items = selected.filter(p => localParts(p.scheduled_for).date === date);
          const defaultTime = items[0] ? localParts(items[0].scheduled_for).time : '09:00';
          return `<div ondragover="event.preventDefault()" ondrop="mktCalendarDrop(event,'${date}','${defaultTime}')" class="min-h-[92px] md:min-h-[130px] border-r border-b border-slate-200 dark:border-slate-700 p-1 ${inMonth || __socialCalendarMode==='week'?'':'bg-slate-50 dark:bg-slate-950/40 text-slate-400'}"><div class="text-[10px] font-bold mb-1">${day.getUTCDate()}</div><div class="space-y-1">${items.slice(0,4).map(p=>postCard(p,true)).join('')}${items.length>4?`<div class="text-[10px] text-slate-400">${items.length-4} more</div>`:''}</div></div>`;
        }).join('')}</div>`;
        const calendarBody = __socialCalendarMode === 'agenda' ? `<div class="space-y-2">${postRows}</div>` : calendarGrid;
        inner = `
          <div class="flex items-center justify-between gap-3 mb-3">
            <div class="text-[13px] text-slate-500">Dealer timezone: <b>${esc(tz)}</b></div>
            <button onclick="mktCompose()" class="shrink-0 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[12px] font-bold">New post</button>
          </div>
          <div class="flex gap-2 overflow-x-auto pb-2 mb-3">${socialTabs}</div>
          <div class="flex flex-wrap items-center gap-2 mb-3">
            ${__socialView==='calendar'?`${['month','week','agenda'].map(v=>`<button onclick="mktSocialCalendarMode('${v}')" class="text-[11px] font-bold px-2 py-1 rounded ${__socialCalendarMode===v?'bg-slate-900 text-white dark:bg-white dark:text-slate-900':'border border-slate-200 dark:border-slate-700'}">${mktLabel(v)}</button>`).join('')}<span class="h-5 border-l border-slate-200 dark:border-slate-700"></span><button onclick="mktCalendarMove(-1)" class="text-[11px] font-bold px-2 py-1 rounded border border-slate-200 dark:border-slate-700">Previous</button><button onclick="mktCalendarMove(1)" class="text-[11px] font-bold px-2 py-1 rounded border border-slate-200 dark:border-slate-700">Next</button>`:''}
            <label class="text-[11px] font-bold text-slate-500">Network <select onchange="mktSocialNetworkFilter(this.value)" class="ml-1 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 px-2 py-1"><option value="all">All</option>${networks.map(n=>`<option value="${esc(n)}" ${__socialNetworkFilter===n?'selected':''}>${esc(mktLabel(n))}</option>`).join('')}</select></label>
            <label class="text-[11px] font-bold text-slate-500">Account <select onchange="mktSocialFilter('account',this.value)" class="ml-1 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 px-2 py-1"><option value="all">All</option>${accounts.map(a=>`<option value="${esc(a.id)}" ${__socialAccountFilter===a.id?'selected':''}>${esc(a.display_name)}</option>`).join('')}</select></label>
            <label class="text-[11px] font-bold text-slate-500">Campaign <select onchange="mktSocialFilter('campaign',this.value)" class="ml-1 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 px-2 py-1"><option value="all">All</option>${campaignOptions.map(c=>`<option value="${esc(c.id)}" ${__socialCampaignFilter===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>
            <label class="text-[11px] font-bold text-slate-500">Status <select onchange="mktSocialFilter('status',this.value)" class="ml-1 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 px-2 py-1"><option value="all">All</option>${statusOptions.map(s=>`<option value="${esc(s)}" ${__socialStatusFilter===s?'selected':''}>${esc(mktLabel(s))}</option>`).join('')}</select></label>
            <label class="text-[11px] font-bold text-slate-500">Owner <select onchange="mktSocialFilter('owner',this.value)" class="ml-1 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 px-2 py-1"><option value="all">All</option>${ownerOptions.map(([id,name])=>`<option value="${esc(id)}" ${__socialOwnerFilter===id?'selected':''}>${esc(name)}</option>`).join('')}</select></label>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            ${engKpi('Accounts', accounts.length)}
            ${engKpi('Disconnected', broken.length, broken.length ? 'text-rose-600 dark:text-rose-400' : '')}
            ${engKpi('Not delivered', unsent.length, unsent.length ? 'text-amber-600 dark:text-amber-400' : '')}
          </div>
          ${engCard('Connected accounts', accounts.length ? accounts.map(a => mktRow({
            title: a.display_name,
            sub: `${a.provider} · ${a.ownership === 'user' ? 'personal account' : 'dealership page'}`,
            // What THIS user may do, decided by the server — the UI only reports it.
            note: a.can_publish ? 'You can publish' : (a.why || 'You cannot publish to this account'),
            right: mktLabel(a.status),
            tone: a.status !== 'connected' ? 'text-rose-600 dark:text-rose-400'
                : a.can_publish ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500',
          })).join('') : engEmpty('No social accounts connected.'))}
          <div class="mt-4"></div>${engCard(`${mktLabel(__socialView)} (${selected.length})`, __socialView === 'calendar' ? calendarBody : `<div class="space-y-2">${postRows}</div>`)}`;
      }

      if (__mktView === 'conversations') {
        const rows = d.conversations || [];
        const waiting = rows.filter(c => c.status === 'waiting_dealer');
        inner = `
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            ${engKpi('Open', rows.filter(c => c.status !== 'closed').length)}
            ${engKpi('Waiting on us', waiting.length, waiting.length ? 'text-amber-600 dark:text-amber-400' : '')}
            ${engKpi('With a person', rows.filter(c => c.status === 'handoff').length)}
          </div>
          ${engCard('Customer conversations', rows.length ? rows.slice(0, 50).map(c => mktRow({
            title: `${c.lead_type ? c.lead_type : 'Conversation'}${c.channel ? ` · ${c.channel}` : ''}`,
            sub: `${mktLabel(c.status)}${c.last_message_at ? ` · ${String(c.last_message_at).slice(0, 16).replace('T', ' ')}` : ''}`,
            note: c.lead_score != null ? `lead score ${c.lead_score}` : null,
            right: c.status === 'waiting_dealer' ? 'Reply' : mktLabel(c.status),
            tone: c.status === 'waiting_dealer' ? 'text-amber-600 dark:text-amber-400'
                : c.status === 'handoff' ? 'text-sky-600 dark:text-sky-400' : '',
            onclick: c.status !== 'handoff' && c.status !== 'closed' ? `mktTakeover('${c.id}')` : null,
          })).join('') : engEmpty('No conversations yet.'))}`;
      }

      if (__mktView === 'attribution') {
        const rows = d.campaigns || [];
        const linked = rows.filter(c => (c.performance?.leads || 0) + (c.performance?.customers || 0) > 0);
        const roi = d.roi;
        inner = `
          ${engCard('Two kinds of number, kept apart', `<div class="text-[13px] text-slate-500 dark:text-slate-400">
            <span class="font-bold text-slate-700 dark:text-slate-200">Linked</span> attribution follows a
            campaign id from lead to delivered deal, and its gross comes from the posted ledger.
            <span class="font-bold text-slate-700 dark:text-slate-200">Inferred</span> attribution reads a
            free-text lead source and estimates gross from a per-unit average. They are never added together.
          </div>`)}
          <div class="mt-4"></div>
          ${engCard(`Linked to a campaign (${linked.length})`, linked.length ? linked.map(c => {
            const p = c.performance || {}, s = c.spend || {};
            return mktRow({
              title: c.name,
              sub: `${p.leads || 0} leads · ${p.customers || 0} customers · ${p.delivered || 0} delivered`,
              note: c.gross_complete === false
                ? `gross ${mktMoney(p.gross || 0)} — incomplete, some deliveries have no posted journal`
                : `gross ${mktMoney(p.gross || 0)} on ${mktMoney(s.actual || 0)} spent`,
              right: c.roi == null ? '—' : `${c.roi > 0 ? '+' : ''}${c.roi}%`,
              tone: c.gross_complete === false ? 'text-amber-600 dark:text-amber-400' : '',
            });
          }).join('') : engEmpty('No campaign-linked attribution yet.'))}
          <div class="mt-4"></div>
          ${roi && (roi.rows || []).length ? engCard('Inferred from lead sources — estimated', `
            <div class="text-[12px] text-slate-400 mb-1">${esc(roi.note || '')}</div>
            ${roi.rows.slice(0, 15).map(r => mktRow({
              title: r.channel,
              sub: `${r.leads || 0} leads · ${r.sales || 0} sales`,
              note: `estimated gross ${mktMoney(r.est_gross || 0)} on ${mktMoney(r.spend || 0)} spent`,
              right: r.est_roi_pct == null ? '—' : `~${r.est_roi_pct}%`,
              tone: 'text-slate-500',
            })).join('')}`) : ''}`;
      }

      body.innerHTML = `<div class="flex gap-1.5 mb-3 overflow-x-auto">${nav}</div>${inner}`;
    },

    insights(body, d) {
      const rows = d.campaigns || [];
      const spent = rows.reduce((s, c) => s + (c.spend?.actual || 0), 0);
      const budget = rows.reduce((s, c) => s + (c.spend?.budget || 0), 0);
      const gross = rows.reduce((s, c) => s + (c.performance?.gross || 0), 0);
      const delivered = rows.reduce((s, c) => s + (c.performance?.delivered || 0), 0);
      const incomplete = rows.filter(c => c.gross_complete === false).length;
      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          ${engKpi('Actual spend', mktMoney(spent))}
          ${engKpi('Budgeted', mktMoney(budget))}
          ${engKpi('Attributed gross', mktMoney(gross))}
          ${engKpi('Delivered', delivered)}
        </div>
        ${engCard('What these numbers are', `<div class="text-[13px] text-slate-500 dark:text-slate-400">
          Spend is <span class="font-bold">actual</span>, never budget. Gross is read from posted
          journals, so a campaign whose deliveries have not reached the books contributes its
          units but not its gross.${incomplete ? ` <span class="text-amber-600 dark:text-amber-400 font-bold">${incomplete} campaign(s) have an incomplete gross.</span>` : ''}
        </div>`)}`;
    },
  },
};

function loadMarketingWorkspace() { renderEngine('marketing-overview'); }
window.loadMarketingWorkspace = loadMarketingWorkspace;
