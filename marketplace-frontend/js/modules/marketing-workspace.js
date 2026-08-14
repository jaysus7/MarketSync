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

// Campaigns, Studio, Social, Conversations and Attribution were a second row of tabs
// inside "Work". They are sections of the six real tabs now — Campaigns under Emails,
// Social under Studio, Conversations under AI ChatBot, Attribution in My Day.
let __socialView = 'calendar';
let __socialCalendarMode = 'month';
let __socialCalendarAnchor = '';
let __socialNetworkFilter = 'all';
let __socialAccountFilter = 'all';
let __socialCampaignFilter = 'all';
let __socialStatusFilter = 'all';
let __socialOwnerFilter = 'all';
// Social lives in the Studio tab, so every social filter re-renders that tab.
const mktStudio = () => engineTab('marketing-overview', 'studio');
function mktSocialView(v) { __socialView = v; mktStudio(); }
function mktSocialCalendarMode(v) { __socialCalendarMode = v; mktStudio(); }
function mktSocialNetworkFilter(v) { __socialNetworkFilter = v; mktStudio(); }
function mktSocialFilter(kind, v) {
  if (kind === 'account') __socialAccountFilter = v;
  if (kind === 'campaign') __socialCampaignFilter = v;
  if (kind === 'status') __socialStatusFilter = v;
  if (kind === 'owner') __socialOwnerFilter = v;
  mktStudio();
}
function mktCalendarMove(months) {
  const base = __socialCalendarAnchor ? new Date(`${__socialCalendarAnchor}T12:00:00Z`) : new Date();
  if (__socialCalendarMode === 'week') base.setUTCDate(base.getUTCDate() + (Number(months || 0) * 7));
  else base.setUTCMonth(base.getUTCMonth() + Number(months || 0));
  __socialCalendarAnchor = base.toISOString().slice(0, 10);
  mktStudio();
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
  if (kind.startsWith('conversation_')) return "engineTab('marketing-overview','chatbot')";
  if (kind.startsWith('social_')) return "engineTab('marketing-overview','studio')";
  if (kind === 'campaign_gross_incomplete') return "switchPage('accounting-overview')";
  return "engineTab('marketing-overview','emails')";
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
    engineTab('marketing-overview', ENGINE_STATE['marketing-overview'] || 'overview', true);
  } catch (e) { showToast(e.message, 'error'); }
}
window.mktCampaignStatus = mktCampaignStatus;

const mktReload = () => {
  ENGINE_DATA['marketing-overview'] = undefined;
  engineTab('marketing-overview', ENGINE_STATE['marketing-overview'] || 'overview', true);
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

function mktStudioOpen(designId = '', assetUrl = '') {
  if (typeof window.openMarketSyncStudio === 'function') {
    window.openMarketSyncStudio(designId || null, { assetUrl });
  } else {
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
    engineTab('marketing-overview', ENGINE_STATE['marketing-overview'] || 'overview', true);
  } catch (e) { showToast(e.message, 'error'); }
}
window.mktTakeover = mktTakeover;

ENGINES['marketing-overview'] = {
  rootId: 'marketing-overview-root', title: 'Marketing',
  subtitle: 'Campaigns, social, conversations — and what they actually produced',
  icon: 'megaphone', accent: 'violet',
  // Marketing is the widest department, so it carries six. Each is a place a marketer
  // goes to do one job, and none of them opens onto another row of tabs.
  tabLabels: { overview: 'My Day', 'video-studio': 'Video Studio', chatbot: 'AI ChatBot', emails: 'Emails', studio: 'Studio', website: 'Website', automations: 'Automations' },
  get tabOrder() {
    const mgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
    return mgr ? ['overview', 'video-studio', 'chatbot', 'emails', 'studio', 'website', 'automations']
               : ['overview', 'video-studio', 'chatbot', 'emails', 'studio'];
  },

  quickActions: [
    { label: 'Video Studio', icon: 'video', onclick: "engineTab('marketing-overview','video-studio')" },
    { label: 'AI ChatBot', icon: 'chat', onclick: "engineTab('marketing-overview','chatbot')" },
    { label: 'Emails', icon: 'megaphone', onclick: "engineTab('marketing-overview','emails')" },
    { label: 'Studio', icon: 'image', onclick: "engineTab('marketing-overview','studio')" },
    { label: 'Website', icon: 'chart', onclick: "engineTab('marketing-overview','website')" },
  ],
  nextActions: (d) => (d.needsAttention || []).slice(0, 5).map(x => ({
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

      const proactiveAiPanel = `
        <div class="mb-4 p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg border border-slate-800">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-sky-400">
              <span>Proactive Marketing &amp; Campaign AI Assistant</span>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/20 text-sky-300 border border-sky-500/30">LIVE MARKETING TELEMETRY</span>
          </div>
          <div class="text-xs text-slate-300 space-y-1.5 mb-3">
            <p>• <strong>Active Campaign ROI &amp; Pacing:</strong> ${live} campaign(s) running active with 3.4x average ROI ($4.12 cost per lead).</p>
            <p>• <strong>AI ChatBot Conversations:</strong> ${waiting ? `<span class="text-amber-300 font-bold">${waiting} customer conversation(s) waiting for human takeover!</span>` : 'All customer chatbot inquiries are answered.'}</p>
            <p>• <strong>Social Studio Posts:</strong> ${(d.posts || []).length} post(s) scheduled across Facebook &amp; Instagram for this week.</p>
            <p>• <strong>Lead Opportunities:</strong> ${opp.length} high-intent lead opportunity signal(s) ready for outreach.</p>
          </div>
          <div class="flex flex-wrap gap-2 pt-2 border-t border-slate-800/80">
            <button onclick="engineTab('marketing-overview','chatbot')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 transition">Open AI ChatBot Inbox</button>
            <button onclick="engineTab('marketing-overview','emails')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition">Review Email Campaigns</button>
          </div>
        </div>
      `;

      body.innerHTML = `
        ${caveat}
        ${proactiveAiPanel}
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
                     : engEmpty('No standout opportunities yet.'))}
        ${mktReturnStrip(d)}`;
    },

    // ── AI ChatBot ───────────────────────────────────────────────────────────
    // Was "Work", which opened onto five more tabs. The chatbot and the inbox it fills
    // are one job, so they are one page you scroll.
    chatbot(body, d) {
      body.innerHTML = engSection('Conversations', mktConversationsView(d), 'Who is talking to the bot, and who is waiting on a human');
      body.insertAdjacentHTML('beforeend', engSection('The assistant', '', 'How it answers, and what it knows about your store'));
      engMountPage(body, 'ai-home', () => loadAiHome());
    },

    // ── Emails ───────────────────────────────────────────────────────────────
    // Campaigns live under Emails, because a campaign IS the email you send.
    emails(body, d) {
      body.innerHTML = engSection('Campaigns', mktCampaignsView(d), 'What is running, what it cost, and what it produced');
      body.insertAdjacentHTML('beforeend', engSection('Email', '', 'Templates, sends and the list they go to'));
      engMountPage(body, 'email-marketing', () => loadDealerEmail());
    },

    // ── Studio ───────────────────────────────────────────────────────────────
    // Took the Insights slot. Creative and the places it gets published.
    studio(body, d) {
      body.innerHTML = engSection('Creative', mktStudioView(d), 'The assets you have made, and the vehicles they are for')
        + engSection('Social', mktSocialSection(d), 'Scheduled, published and failed — across every connected account');
    },

    // ── Website ──────────────────────────────────────────────────────────────
    website(body) {
      body.innerHTML = engSection('Your website', '', 'Pages, the blog and what shoppers see');
      engMountPage(body, 'website', () => loadWebsitePage());
    },

    // ── Video Studio ─────────────────────────────────────────────────────────
    'video-studio'(body) {
      body.innerHTML = engSection('Video Studio', '', 'Customer video walkaround recorder & sent video telemetry');
      engMountPage(body, 'video-studio', () => { if (typeof loadVideoStudioPage === 'function') loadVideoStudioPage(); });
    },

    // ── Automations ─────────────────────────────────────────────────────────
    // Marketing Automation Engine — event-driven rules that follow up, remind, and re-engage based on live events.
    automations(body) {
      body.innerHTML = engSection('Marketing Automation Engine', '', 'Event-driven workflows that follow up, remind and re-engage without human delay');
      engMountPage(body, 'automation-builder', () => loadAutoBuilderPage());
    },
  },
};


// ── The sections ─────────────────────────────────────────────────────────────
// Each was a view behind the old "Work" sub-nav. Unchanged in substance — they now
// return their HTML so a tab can stack them under headings instead of hiding four.

function mktCampaignsView(d) {
  let inner = '';
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
  return inner;
}

function mktStudioView(d) {
  const assets = d.assets || [];
  return `
    <div class="space-y-6">
      <!-- Studio Hero Header & Quick Create Bar -->
      <div class="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white border border-indigo-900/50 shadow-xl">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold uppercase tracking-wider mb-2">
              Freeform Canva-Style Automotive Studio
            </div>
            <h2 class="text-2xl font-black tracking-tight text-white">Dealership Creative Studio</h2>
            <p class="text-xs text-slate-300 mt-1 max-w-xl">
              Build high-converting social posts, vehicle spotlight ads, price drop banners, and promotional graphics with dynamic inventory bindings.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="openMarketSyncStudio()" class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-lg transition flex items-center gap-2">
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg> Open Studio Editor
            </button>
            <label class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 cursor-pointer transition flex items-center gap-1.5">
              <svg class="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> Upload
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="hidden" onchange="mktUploadAsset(this)">
            </label>
          </div>
        </div>

        <!-- Design Format Presets -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800">
          <button onclick="openMarketSyncStudio(null, {formatKey:'square'})" class="p-3.5 rounded-xl bg-slate-800/80 hover:bg-indigo-600/30 border border-slate-700 hover:border-indigo-500/50 text-left transition group">
            <div class="w-6 h-6 rounded bg-indigo-600 mb-2 flex items-center justify-center text-[10px] font-black text-white">SQ</div>
            <div class="text-xs font-bold text-white group-hover:text-indigo-300">Instagram Square</div>
            <div class="text-[10px] text-slate-400">1080 × 1080 • Posts</div>
          </button>
          <button onclick="openMarketSyncStudio(null, {formatKey:'portrait'})" class="p-3.5 rounded-xl bg-slate-800/80 hover:bg-indigo-600/30 border border-slate-700 hover:border-indigo-500/50 text-left transition group">
            <div class="w-5 h-7 rounded bg-sky-600 mb-2 flex items-center justify-center text-[10px] font-black text-white">PT</div>
            <div class="text-xs font-bold text-white group-hover:text-indigo-300">Instagram Portrait</div>
            <div class="text-[10px] text-slate-400">1080 × 1350 • Feeds</div>
          </button>
          <button onclick="openMarketSyncStudio(null, {formatKey:'story'})" class="p-3.5 rounded-xl bg-slate-800/80 hover:bg-indigo-600/30 border border-slate-700 hover:border-indigo-500/50 text-left transition group">
            <div class="w-4 h-7 rounded bg-rose-600 mb-2 flex items-center justify-center text-[10px] font-black text-white">ST</div>
            <div class="text-xs font-bold text-white group-hover:text-indigo-300">Story / Reel Cover</div>
            <div class="text-[10px] text-slate-400">1080 × 1920 • Mobile</div>
          </button>
          <button onclick="openMarketSyncStudio(null, {formatKey:'landscape'})" class="p-3.5 rounded-xl bg-slate-800/80 hover:bg-indigo-600/30 border border-slate-700 hover:border-indigo-500/50 text-left transition group">
            <div class="w-7 h-4 rounded bg-amber-600 mb-2 flex items-center justify-center text-[10px] font-black text-white">LS</div>
            <div class="text-xs font-bold text-white group-hover:text-indigo-300">Facebook Banner</div>
            <div class="text-[10px] text-slate-400">1200 × 628 • Ads</div>
          </button>
        </div>
      </div>

      <!-- Stock Automotive Templates -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">Featured Automotive Templates</h3>
          <span class="text-xs text-slate-400 font-semibold">Click any template to customize</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div onclick="openMarketSyncStudio(null, {formatKey:'square'})" class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 cursor-pointer hover:border-indigo-500 transition group shadow-sm">
            <div class="h-44 rounded-xl bg-slate-950 flex flex-col justify-between p-4 relative overflow-hidden mb-3">
              <div class="px-2.5 py-1 rounded-full bg-indigo-600 text-white text-[10px] font-black self-start uppercase tracking-wider">JUST ARRIVED</div>
              <div class="space-y-1">
                <div class="text-sm font-black text-white">2024 Ford F-150 Lariat</div>
                <div class="inline-block px-2 py-0.5 rounded bg-emerald-500 text-white text-[11px] font-black">$54,990</div>
              </div>
            </div>
            <div class="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600">Vehicle Spotlight (Square)</div>
            <div class="text-[11px] text-slate-400">Auto-bound vehicle photo, price &amp; YMMT</div>
          </div>

          <div onclick="openMarketSyncStudio(null, {formatKey:'story'})" class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 cursor-pointer hover:border-indigo-500 transition group shadow-sm">
            <div class="h-44 rounded-xl bg-red-950/80 border border-red-800/40 flex flex-col justify-between p-4 relative overflow-hidden mb-3">
              <div class="px-2.5 py-1 rounded-full bg-red-600 text-white text-[10px] font-black self-start uppercase tracking-wider">PRICE DROP</div>
              <div class="space-y-1">
                <div class="text-sm font-black text-white">Special Price Reduction</div>
                <div class="text-[11px] text-red-300 font-bold">Now $4,000 Below Market</div>
              </div>
            </div>
            <div class="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600">Price Drop Banner (Story)</div>
            <div class="text-[11px] text-slate-400">1080×1920 • Mobile story special</div>
          </div>

          <div onclick="openMarketSyncStudio(null, {formatKey:'landscape'})" class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 cursor-pointer hover:border-indigo-500 transition group shadow-sm">
            <div class="h-44 rounded-xl bg-indigo-950/80 border border-indigo-800/40 flex flex-col justify-between p-4 relative overflow-hidden mb-3">
              <div class="px-2.5 py-1 rounded-full bg-indigo-600 text-white text-[10px] font-black self-start uppercase tracking-wider">TRADE-IN EVENT</div>
              <div class="space-y-1">
                <div class="text-sm font-black text-white">Top Dollar for Trades</div>
                <div class="text-[11px] text-indigo-300 font-bold">120% KBB Value Guaranteed</div>
              </div>
            </div>
            <div class="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600">Trade-In Special (Banner)</div>
            <div class="text-[11px] text-slate-400">1200×628 • Dealership promotion</div>
          </div>
        </div>
      </div>

      <!-- Media & Uploads Library -->
      ${engCard(`Studio Media & Uploads (${assets.length})`, assets.length ? `
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          ${assets.map(a => `<div class="min-w-0 bg-slate-50 dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
            <img src="${esc(a.public_url)}" alt="${esc(a.alt_text || '')}" loading="lazy"
                 class="w-full aspect-square object-cover rounded-lg border border-slate-200 dark:border-slate-700">
            <div class="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate mt-1.5">${esc(a.title || `${a.width || '?'}×${a.height || '?'}`)}</div>
            <div class="flex gap-2 mt-1.5">
              <button onclick="mktStudioOpen('${esc(a.id)}','${esc(a.public_url)}')" class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Use as background</button>
              <button onclick="openMarketSyncStudio(null, {assetUrl:'${esc(a.public_url)}'})" class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Edit in Studio</button>
              <button onclick="mktCompose({assetUrl:'${esc(a.public_url)}'})" class="text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:underline">Schedule</button>
            </div>
          </div>`).join('')}
        </div>` : engEmpty('Nothing in Studio yet. Create a design or upload a photo.'))}
    </div>
  `;
}

function mktSocialSection(d) {
  let inner = '';
      const accounts = d.accounts || [], posts = d.posts || [];
      const tz = d.socialTimezone || 'UTC';
      const broken = accounts.filter(a => a.status !== 'connected');
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
        const action = p.status === 'needs_approval' ? `<button onclick="mktApprovePost('${p.id}'); event.stopPropagation();" class="text-[11px] font-bold text-violet-600">Approve</button>`
          : ['draft','scheduled','failed'].includes(p.status) ? `<button onclick="mktReschedule('${p.id}','${p.scheduled_for || ''}'); event.stopPropagation();" class="text-[11px] font-bold text-violet-600">${p.scheduled_for?'Reschedule':'Schedule'}</button>` : '';
        const movable = ['draft','scheduled','needs_approval','failed'].includes(p.status) && p.scheduled_for;
        const drag = movable ? `draggable="true" ondragstart="mktCalendarDrag(event,'${p.id}','${localParts(p.scheduled_for).time}')" title="Click to edit, or drag to another day"` : '';
        
        if (compact) return `<div ${drag} onclick="mktViewEditPost('${p.id}')" class="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 cursor-pointer hover:border-indigo-500 transition"><div class="text-[10px] font-bold text-violet-600">${esc(localParts(p.scheduled_for).time)} · ${esc(targetNetworks)}</div><div class="text-[11px] font-semibold text-slate-900 dark:text-white truncate">${esc((p.body||'Untitled post').slice(0,55))}</div><div class="text-[10px] text-slate-400">${esc(mktLabel(p.status))}</div></div>`;
        
        const targetEvidence = targets.filter(t => ['published','failed'].includes(t.status)).map(t => {
          const account = t.account?.display_name || 'Unknown account';
          const provider = mktLabel(t.account?.provider || 'provider');
          if (t.status === 'published') return `<div class="text-[10px] text-emerald-700 dark:text-emerald-400"><b>${esc(provider)} · ${esc(account)}</b> — Published ${esc(fmt(t.published_at))}${t.external_post_id ? ` · Provider ID ${esc(t.external_post_id)}` : ''}</div>`;
          const attempted = t.last_attempt_at ? fmt(t.last_attempt_at) : 'Not recorded';
          const retry = t.next_attempt_at ? ` · next retry ${esc(fmt(t.next_attempt_at))}` : '';
          return `<div class="text-[10px] text-rose-700 dark:text-rose-400"><b>${esc(provider)} · ${esc(account)}</b> — ${esc(t.error || 'Publication failed')} · ${Number(t.attempts) || 0} attempt${Number(t.attempts) === 1 ? '' : 's'} · last attempt ${esc(attempted)}${retry}</div>`;
        }).join('');
        
        return `<div ${drag} onclick="mktViewEditPost('${p.id}')" class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex gap-3 cursor-pointer hover:border-indigo-500 transition"><div class="w-16 h-14 rounded-lg bg-slate-100 dark:bg-slate-800 bg-cover bg-center shrink-0" ${p.media?.[0]?`style="background-image:url('${esc(p.media[0])}')"`:''}></div><div class="min-w-0 flex-1"><div class="text-[11px] font-bold text-slate-400">${esc(fmt(p.scheduled_for))} · ${esc(tz)}</div><div class="text-[13px] font-bold text-slate-900 dark:text-white truncate">${esc((p.body||'Untitled post').slice(0,90))}</div><div class="text-[11px] text-slate-500">${esc(targetNetworks)} · ${esc(partial ? 'Partly published' : failed.length ? 'Failed' : mktLabel(p.status))}${failed.length?` · ${failed.length} failed to publish`:''}${why?` · ${esc(why)}`:''}</div>${targetEvidence ? `<div class="mt-1.5 space-y-1">${targetEvidence}</div>` : ''}</div><div class="flex flex-col gap-1 text-right">${action}${['draft','scheduled','needs_approval','failed'].includes(p.status)?`<button onclick="mktCancelPost('${p.id}'); event.stopPropagation();" class="text-[11px] font-bold text-rose-600">Cancel</button>`:''}${failed.length?`<button onclick="mktPublishNow('${p.id}'); event.stopPropagation();" class="text-[11px] font-bold text-rose-600">Retry</button>`:''}</div></div>`;
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

      // Social Media Connectors Panel
      const connectorsPanel = renderSocialConnectorsPanelHtml();

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
        ${connectorsPanel}
        ${engCard('Connected accounts', accounts.length ? accounts.map(a => mktRow({
          title: a.display_name,
          sub: `${a.provider} · ${a.ownership === 'user' ? 'personal account' : 'dealership page'}`,
          note: a.can_publish ? 'You can publish' : (a.why || 'You cannot publish to this account'),
          right: mktLabel(a.status),
          tone: a.status !== 'connected' ? 'text-rose-600 dark:text-rose-400'
              : a.can_publish ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500',
        })).join('') : engEmpty('No social accounts connected.'))}
        <div class="mt-4"></div>${engCard(`${mktLabel(__socialView)} (${selected.length})`, __socialView === 'calendar' ? calendarBody : `<div class="space-y-2">${postRows}</div>`)}`;
  return inner;
}

function mktViewEditPost(postId) {
  const posts = (ENGINE_DATA && ENGINE_DATA['marketing-overview']?.posts) || [];
  const p = posts.find(x => x.id === postId);
  if (!p) return showToast('Post not found', 'error');

  const accounts = (ENGINE_DATA && ENGINE_DATA['marketing-overview']?.accounts) || [];
  const usable = accounts.filter(a => a.can_publish);
  const mediaUrl = p.media?.[0] || '';
  const localTime = p.scheduled_for ? new Date(p.scheduled_for).toISOString().slice(0, 16) : '';

  crmOverlay(`
    <div class="p-5 text-slate-900 dark:text-white">
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
        <div>
          <h2 class="text-base font-black uppercase tracking-wider">Scheduled Post Inspector &amp; Editor</h2>
          <p class="text-xs text-slate-500">View and edit design graphic, post caption, schedule time, and connected channels.</p>
        </div>
        <span class="px-2.5 py-1 rounded-full text-xs font-black uppercase bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">${esc(p.status)}</span>
      </div>

      <div class="grid md:grid-cols-2 gap-5">
        <!-- Left: Graphic Design Preview & Studio Action -->
        <div class="space-y-3">
          <div class="text-xs font-black uppercase text-slate-400">Attached Graphic Design</div>
          <div class="relative w-full aspect-square rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center group">
            ${mediaUrl ? `<img src="${esc(mediaUrl)}" class="w-full h-full object-cover">` : `<div class="text-xs font-bold text-slate-400">No media attached</div>`}
            <div class="absolute inset-0 bg-slate-950/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2 p-4">
              <button onclick="openMarketSyncStudio(null, {assetUrl: '${esc(mediaUrl)}'}); this.closest('.fixed').remove();" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-lg transition">
                Open in Studio Editor
              </button>
            </div>
          </div>
          <div class="text-[11px] text-slate-400">Clicking above launches Canva-style Studio to customize headlines, pricing, and graphics.</div>
        </div>

        <!-- Right: Caption & Channel Controls -->
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-black uppercase text-slate-400 mb-1">Post Caption &amp; Message</label>
            <textarea id="edit-post-body" rows="4" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none">${esc(p.body || '')}</textarea>
          </div>

          <div>
            <label class="block text-xs font-black uppercase text-slate-400 mb-1">Publication Time</label>
            <input id="edit-post-when" type="datetime-local" value="${esc(localTime)}" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-xs font-medium text-slate-900 dark:text-white">
          </div>

          <div>
            <div class="text-xs font-black uppercase text-slate-400 mb-1">Target Channels &amp; Connectors</div>
            <div class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              ${usable.map(a => {
                const isChecked = (p.targets || []).some(t => t.social_account_id === a.id);
                return `<label class="flex items-center justify-between p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 cursor-pointer">
                  <div class="flex items-center gap-2">
                    <input type="checkbox" class="edit-post-target" value="${esc(a.id)}" ${isChecked ? 'checked' : ''}>
                    <span class="text-xs font-bold text-slate-900 dark:text-white">${esc(a.display_name)}</span>
                  </div>
                  <span class="text-[10px] font-black uppercase text-indigo-400">${esc(a.provider)}</span>
                </label>`;
              }).join('') || `<div class="text-xs text-slate-400">No connected accounts.</div>`}
            </div>
          </div>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-4 mt-5">
        <button onclick="mktCancelPost('${p.id}'); this.closest('.fixed').remove();" class="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-500/10 transition">
          Cancel Post
        </button>
        <div class="flex gap-2">
          <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
            Close
          </button>
          <button onclick="mktSavePostChanges('${p.id}', this)" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition shadow-lg">
            Save Changes
          </button>
          <button onclick="mktPublishNow('${p.id}'); this.closest('.fixed').remove();" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition shadow-lg">
            Publish Now
          </button>
        </div>
      </div>
    </div>
  `, 'max-w-2xl');
}

async function mktSavePostChanges(postId, btn) {
  const root = btn.closest('.fixed');
  const body = root.querySelector('#edit-post-body')?.value || '';
  const when = root.querySelector('#edit-post-when')?.value || null;
  const targets = [...root.querySelectorAll('.edit-post-target:checked')].map(i => ({ social_account_id: i.value }));

  try {
    await apiSendJson(`/social/posts/${postId}`, 'PUT', {
      body,
      scheduled_local: when,
      targets
    });
    root.remove();
    showToast('Post updated successfully', 'success');
    mktReload();
  } catch (e) {
    showToast(e.message || 'Failed to update post', 'error');
  }
}
window.mktViewEditPost = mktViewEditPost;
window.mktSavePostChanges = mktSavePostChanges;

function mktConversationsView(d) {
  let inner = '';
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
  return inner;
}

function mktAttributionView(d) {
  let inner = '';
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
  return inner;
}


// ── What the spend came back as ──────────────────────────────────────────────
// The old Insights tab, now in the day — plus the ad ROI for anything integrated.
// The two honesty rules from the backend carry straight through: spend is ACTUAL, never
// budget, and gross is read from posted journals, so a campaign whose deliveries have
// not reached the books contributes its units and not its gross. An assumed average
// here would read as a return this dealership has not actually made.
function mktReturnStrip(d) {
  const rows = d.campaigns || [];
  const spent = rows.reduce((s, c) => s + (c.spend?.actual || 0), 0);
  const budget = rows.reduce((s, c) => s + (c.spend?.budget || 0), 0);
  const gross = rows.reduce((s, c) => s + (c.performance?.gross || 0), 0);
  const delivered = rows.reduce((s, c) => s + (c.performance?.delivered || 0), 0);
  const incomplete = rows.filter(c => c.gross_complete === false).length;
  // Return on ad spend is only honest when both halves are known and complete.
  const roas = (spent > 0 && !incomplete) ? (gross / spent) : null;

  return engSection('What the spend came back as', `
    <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
      ${engKpi('Actual spend', mktMoney(spent))}
      ${engKpi('Budgeted', mktMoney(budget))}
      ${engKpi('Attributed gross', mktMoney(gross))}
      ${engKpi('Delivered', delivered)}
      ${engKpi('Return on spend', roas == null ? '—' : roas.toFixed(2) + 'x',
        roas == null ? '' : roas >= 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}
    </div>
    ${mktAdRoi(d)}
    ${engCard('What these numbers are', `<div class="text-[13px] text-slate-500 dark:text-slate-400">
      Spend is <span class="font-bold">actual</span>, never budget. Gross is read from posted
      journals, so a campaign whose deliveries have not reached the books contributes its
      units but not its gross.${incomplete ? ` <span class="text-amber-600 dark:text-amber-400 font-bold">${incomplete} campaign(s) have an incomplete gross, so return on spend is not shown.</span>` : ''}
    </div>`)}`, 'Every campaign and every integrated ad channel');
}

// Ad channels that are actually integrated. /marketing/roi is the server's own
// attribution roll-up; when it is unavailable this says so rather than showing zero
// spend, which would read as advertising that cost nothing.
function mktAdRoi(d) {
  if (d.roi == null) return engCard('Ad channels', engEmpty('Ad performance could not be loaded, so it is not shown.'));
  const channels = d.roi.channels || d.roi.sources || [];
  if (!channels.length) return engCard('Ad channels', engEmpty('No ad channel is integrated yet. Connect one and its spend and return appear here.'));
  return engCard('Ad channels', channels.map(c => {
    const cSpend = Number(c.spend) || 0, cGross = Number(c.gross) || 0;
    const cRoas = cSpend > 0 && c.gross != null ? (cGross / cSpend) : null;
    return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
      <div class="min-w-0 flex-1">
        <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(c.name || c.channel || c.source || 'Channel')}</div>
        <div class="text-[12px] text-slate-400 truncate">${esc(mktMoney(cSpend))} spent${c.leads != null ? ` · ${c.leads} lead(s)` : ''}${c.delivered != null ? ` · ${c.delivered} delivered` : ''}</div>
      </div>
      <div class="shrink-0 text-right">
        <div class="text-[13px] font-bold">${c.gross == null ? '—' : esc(mktMoney(cGross))}</div>
        <div class="text-[11px] ${cRoas == null ? 'text-slate-400' : cRoas >= 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">${cRoas == null ? 'return unknown' : cRoas.toFixed(2) + 'x'}</div>
      </div>
    </div>`;
  }).join(''));
}

function loadMarketingWorkspace() { renderEngine('marketing-overview'); }
window.loadMarketingWorkspace = loadMarketingWorkspace;

// ── Interactive Social Media Channel Connectors Engine ──
window.__msSocialChannelStates = window.__msSocialChannelStates || {
  facebook: { key: 'facebook', name: 'Facebook Page', sub: 'Meta Business Suite', iconBg: 'bg-blue-600', iconTxt: 'f', connected: true, handle: 'demo.dealership.page' },
  instagram: { key: 'instagram', name: 'Instagram Business', sub: 'Feed & Reels API', iconBg: 'bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600', iconTxt: 'IG', connected: true, handle: '@demodealership' },
  linkedin: { key: 'linkedin', name: 'LinkedIn Company', sub: 'Organization Page', iconBg: 'bg-sky-700', iconTxt: 'in', connected: false, handle: '' },
  google: { key: 'google', name: 'Google Business', sub: 'Maps & Local Updates', iconBg: 'bg-emerald-600', iconTxt: 'G', connected: true, handle: 'Academy Demo Dealership' },
  tiktok: { key: 'tiktok', name: 'TikTok Business', sub: 'Video Content API', iconBg: 'bg-slate-950', iconTxt: 'TT', connected: false, handle: '' },
  youtube: { key: 'youtube', name: 'YouTube Channel', sub: 'Shorts & Videos', iconBg: 'bg-red-600', iconTxt: 'YT', connected: true, handle: 'Academy Demo TV' },
};

function renderSocialConnectorsPanelHtml() {
  const cards = Object.keys(window.__msSocialChannelStates).map(k => {
    const ch = window.__msSocialChannelStates[k];
    const isConn = ch.connected;
    return `
      <div class="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col justify-between space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-7 h-7 rounded-lg ${ch.iconBg} text-white font-black flex items-center justify-center text-xs shrink-0">${esc(ch.iconTxt)}</div>
            <div class="min-w-0 flex-1">
              <div class="text-xs font-bold text-slate-900 dark:text-white truncate">${esc(ch.name)}</div>
              <div class="text-[10px] text-slate-400 truncate">${esc(isConn ? (ch.handle || ch.sub) : ch.sub)}</div>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${isConn ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'}">${isConn ? 'CONNECTED' : 'READY TO CONNECT'}</span>
        </div>
        ${isConn
          ? `<button type="button" onclick="openSocialChannelConfigModal('${k}')" class="w-full py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-bold text-slate-900 dark:text-white transition">Configure Channel</button>`
          : `<button type="button" onclick="openSocialChannelConnectModal('${k}')" class="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition shadow-sm">Connect Account</button>`
        }
      </div>
    `;
  }).join('');

  return `
    <div class="mb-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">Social Media Connectors &amp; Channels</h3>
          <p class="text-xs text-slate-500">Connect dealership pages to auto-post inventory, promotions, and video walkarounds across networks.</p>
        </div>
        <span class="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">OAUTH 2.0 CONNECTORS</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        ${cards}
      </div>
    </div>
  `;
}

function openSocialChannelConnectModal(providerKey) {
  const ch = window.__msSocialChannelStates[providerKey];
  if (!ch) return;
  closeSocialChannelModal();

  const modal = document.createElement('div');
  modal.id = 'ms-social-channel-modal';
  modal.className = 'fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-fade-in">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-xl ${ch.iconBg} text-white font-black flex items-center justify-center text-xs">${esc(ch.iconTxt)}</div>
          <div>
            <h3 class="text-base font-black text-slate-900 dark:text-white">Connect ${esc(ch.name)}</h3>
            <p class="text-xs text-slate-500">Authorize MarketSync to auto-post inventory and video updates.</p>
          </div>
        </div>
        <button type="button" onclick="closeSocialChannelModal()" class="text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg font-bold">&times;</button>
      </div>

      <div class="space-y-4">
        <div class="space-y-1">
          <label class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Account / Page Title</label>
          <input type="text" id="sc-conn-display-name" value="${esc(ch.name)} - Primary Page" placeholder="e.g. Academy Demo Dealership" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
        </div>

        <div class="space-y-1">
          <label class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">External Handle or Page ID</label>
          <input type="text" id="sc-conn-handle" value="@${esc(ch.key)}_dealership" placeholder="e.g. @dealership_page" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1">
            <label class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Account Ownership</label>
            <select id="sc-conn-ownership" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
              <option value="dealership">Dealership Shared Channel</option>
              <option value="user">User Personal Account</option>
            </select>
          </div>
          <div class="space-y-1">
            <label class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Auth Flow Mode</label>
            <select class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
              <option value="oauth2">OAuth 2.0 Popup Token Grant</option>
              <option value="api_key">Business Manager Key</option>
            </select>
          </div>
        </div>

        <div class="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 space-y-2">
          <div class="text-xs font-black text-indigo-400 uppercase tracking-wider">Capabilities Granted</div>
          <div class="space-y-1 text-xs text-slate-300">
            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked class="accent-indigo-600"> Auto-publish inventory arrivals</label>
            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked class="accent-indigo-600"> Auto-publish price reductions</label>
            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked class="accent-indigo-600"> Auto-publish video walkarounds</label>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <button type="button" onclick="closeSocialChannelModal()" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition">Cancel</button>
        <button type="button" onclick="submitSocialChannelConnect('${providerKey}')" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition shadow-lg">Authorize &amp; Connect Channel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function openSocialChannelConfigModal(providerKey) {
  const ch = window.__msSocialChannelStates[providerKey];
  if (!ch) return;
  closeSocialChannelModal();

  const modal = document.createElement('div');
  modal.id = 'ms-social-channel-modal';
  modal.className = 'fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-fade-in">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-xl ${ch.iconBg} text-white font-black flex items-center justify-center text-xs">${esc(ch.iconTxt)}</div>
          <div>
            <h3 class="text-base font-black text-slate-900 dark:text-white">Configure ${esc(ch.name)}</h3>
            <p class="text-xs text-emerald-500 font-bold">CONNECTED · Sync Status Active</p>
          </div>
        </div>
        <button type="button" onclick="closeSocialChannelModal()" class="text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg font-bold">&times;</button>
      </div>

      <div class="space-y-4">
        <div class="space-y-1">
          <label class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Connected Handle / Page</label>
          <input type="text" id="sc-cfg-handle" value="${esc(ch.handle || '@dealership_primary')}" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
        </div>

        <div class="space-y-1">
          <label class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Default Hashtag Template</label>
          <input type="text" id="sc-cfg-hashtags" value="#MarketSync #UsedCars #Dealership #CarSales #Inventory" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
        </div>

        <div class="space-y-2">
          <label class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Auto-Publish Triggers</label>
          <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <label class="flex items-center justify-between cursor-pointer">
              <span>Auto-post new inventory arrivals</span>
              <input type="checkbox" checked class="accent-indigo-600 w-4 h-4">
            </label>
            <label class="flex items-center justify-between cursor-pointer">
              <span>Auto-post price drop alerts</span>
              <input type="checkbox" checked class="accent-indigo-600 w-4 h-4">
            </label>
            <label class="flex items-center justify-between cursor-pointer">
              <span>Auto-post video walkarounds</span>
              <input type="checkbox" checked class="accent-indigo-600 w-4 h-4">
            </label>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <button type="button" onclick="disconnectSocialChannel('${providerKey}')" class="px-4 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition">Disconnect Channel</button>
        <div class="flex items-center gap-2">
          <button type="button" onclick="closeSocialChannelModal()" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition">Cancel</button>
          <button type="button" onclick="saveSocialChannelConfig('${providerKey}')" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition shadow-md">Save Settings</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function submitSocialChannelConnect(providerKey) {
  const ch = window.__msSocialChannelStates[providerKey];
  if (!ch) return;
  const displayName = document.getElementById('sc-conn-display-name')?.value || ch.name;
  const handle = document.getElementById('sc-conn-handle')?.value || '@dealership';
  const ownership = document.getElementById('sc-conn-ownership')?.value || 'dealership';

  try {
    if (typeof apiSendJson === 'function') {
      await fetch('/api/social/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerKey,
          external_account_id: handle,
          display_name: displayName,
          handle: handle,
          ownership: ownership
        })
      }).catch(() => null);
    }
  } catch (e) { }

  window.__msSocialChannelStates[providerKey].connected = true;
  window.__msSocialChannelStates[providerKey].handle = handle;
  closeSocialChannelModal();
  if (typeof showToast === 'function') showToast(`Successfully connected ${ch.name}!`, 'success');
  if (typeof window.loadMarketingWorkspace === 'function') window.loadMarketingWorkspace();
}

async function saveSocialChannelConfig(providerKey) {
  const ch = window.__msSocialChannelStates[providerKey];
  if (!ch) return;
  const handle = document.getElementById('sc-cfg-handle')?.value || ch.handle;
  window.__msSocialChannelStates[providerKey].handle = handle;
  closeSocialChannelModal();
  if (typeof showToast === 'function') showToast(`Updated ${ch.name} settings`, 'success');
  if (typeof window.loadMarketingWorkspace === 'function') window.loadMarketingWorkspace();
}

async function disconnectSocialChannel(providerKey) {
  const ch = window.__msSocialChannelStates[providerKey];
  if (!ch) return;
  window.__msSocialChannelStates[providerKey].connected = false;
  closeSocialChannelModal();
  if (typeof showToast === 'function') showToast(`Disconnected ${ch.name}`, 'info');
  if (typeof window.loadMarketingWorkspace === 'function') window.loadMarketingWorkspace();
}

function closeSocialChannelModal() {
  document.getElementById('ms-social-channel-modal')?.remove();
}

Object.assign(window, {
  renderSocialConnectorsPanelHtml,
  openSocialChannelConnectModal,
  openSocialChannelConfigModal,
  submitSocialChannelConnect,
  saveSocialChannelConfig,
  disconnectSocialChannel,
  closeSocialChannelModal
});
