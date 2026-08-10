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
function mktView(v) { __mktView = v; engineTab('marketing-overview', 'work'); }
window.mktView = mktView;

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
    showToast(`Campaign ${status.replace(/_/g, ' ')} ✓`, 'success');
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
function mktCompose() {
  const d = ENGINE_DATA['marketing-overview'] || {};
  const accounts = d.accounts || [], assets = d.assets || [];
  const usable = accounts.filter(a => a.can_publish);
  const refused = accounts.filter(a => !a.can_publish);

  crmOverlay(`
    <div class="p-5">
      <h2 class="text-lg font-black text-slate-900 dark:text-white mb-1">New post</h2>
      <p class="text-[13px] text-slate-500 mb-4">Nothing is sent until a network confirms it. You will see exactly which accounts it reached.</p>
      <textarea id="mkt-body" rows="4" placeholder="What do you want to say?"
        class="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 p-3 text-[14px] mb-3"></textarea>
      <div class="text-[12px] font-bold text-slate-700 dark:text-slate-200 mb-1">Publish to</div>
      ${usable.length ? usable.map(a => `<label class="flex items-center gap-2 py-1.5">
        <input type="checkbox" class="mkt-target" value="${esc(a.id)}">
        <span class="text-[13px] text-slate-900 dark:text-white">${esc(a.display_name)}</span>
        <span class="text-[12px] text-slate-400">${esc(a.provider)}</span>
      </label>`).join('') : `<div class="text-[13px] text-rose-600 dark:text-rose-400">You cannot publish to any connected account yet.</div>`}
      ${refused.length ? `<div class="mt-2 text-[12px] text-slate-400">${refused.map(a =>
        `${esc(a.display_name)} — ${esc(a.why || 'not available to you')}`).join('<br>')}</div>` : ''}
      ${assets.length ? `<div class="text-[12px] font-bold text-slate-700 dark:text-slate-200 mt-4 mb-1">Attach from Studio</div>
        <div class="flex gap-2 overflow-x-auto pb-1">${assets.slice(0, 20).map(a => `
          <label class="shrink-0 cursor-pointer">
            <input type="checkbox" class="mkt-media" value="${esc(a.public_url)}">
            <img src="${esc(a.public_url)}" alt="${esc(a.alt_text || '')}" class="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700">
          </label>`).join('')}</div>` : ''}
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

async function mktSavePost(btn) {
  const root = btn.closest('.fixed');
  const targets = [...root.querySelectorAll('.mkt-target:checked')].map(i => ({ social_account_id: i.value }));
  if (!targets.length) return showToast('Choose at least one account to publish to.', 'error');
  const when = root.querySelector('#mkt-when').value;
  try {
    await apiSendJson('/social/posts', 'POST', {
      body: root.querySelector('#mkt-body').value,
      media: [...root.querySelectorAll('.mkt-media:checked')].map(i => i.value),
      scheduled_for: when ? new Date(when).toISOString() : null,
      targets,
    });
    root.remove();
    showToast(when ? 'Post scheduled ✓' : 'Draft saved ✓', 'success');
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
      : `Published to ${ok} account(s) ✓`, bad.length ? 'error' : 'success');
    mktReload();
  } catch (e) { showToast(e.message, 'error'); }
}
window.mktPublishNow = mktPublishNow;

async function mktUploadAsset(input) {
  const file = input.files?.[0]; if (!file) return;
  showToast('Uploading…', 'info');
  try {
    const fd = new FormData(); fd.append('file', file);
    const r = await fetch(`${API}/marketing/assets`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Upload failed');
    showToast('Added to Studio ✓', 'success');
    mktReload();
  } catch (e) { showToast(e.message, 'error'); }
  input.value = '';
}
window.mktUploadAsset = mktUploadAsset;

async function mktTakeover(conversationId) {
  try {
    await apiSendJson(`/conversations/${conversationId}/takeover`, 'POST', {});
    showToast('You are handling this conversation ✓', 'success');
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
    const [att, camps, accounts, posts, convos, roi, assets] = await Promise.all([
      apiGetJson('/my-day').catch(() => ({ needs_attention: [], opportunities: [], failed: [{ source: 'my-day', label: 'My Day', reason: 'could not be loaded' }], not_covered: [] })),
      apiGetJson('/campaigns').catch(() => ({ campaigns: [] })),
      apiGetJson('/social/accounts').catch(() => ({ accounts: [] })),
      apiGetJson('/social/posts').catch(() => ({ posts: [] })),
      apiGetJson('/conversations').catch(() => ({ conversations: [] })),
      apiGetJson('/marketing/roi').catch(() => null),
      apiGetJson('/marketing/assets').catch(() => ({ assets: [] })),
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
      conversations: convos.conversations || [],
      assets: assets.assets || [],
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
            <label class="shrink-0 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[12px] font-bold cursor-pointer">
              Upload<input type="file" accept="image/*" class="hidden" onchange="mktUploadAsset(this)">
            </label>
          </div>
          ${engCard(`Media library (${assets.length})`, assets.length ? `
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              ${assets.map(a => `<div class="min-w-0">
                <img src="${esc(a.public_url)}" alt="${esc(a.alt_text || '')}" loading="lazy"
                     class="w-full aspect-square object-cover rounded-lg border border-slate-200 dark:border-slate-700">
                <div class="text-[11px] text-slate-400 truncate mt-1">${esc(a.title || `${a.width || '?'}×${a.height || '?'}`)}</div>
              </div>`).join('')}
            </div>` : engEmpty('Nothing in Studio yet. Upload a photo to reuse it across posts.'))}`;
      }

      if (__mktView === 'social') {
        const accounts = d.accounts || [], posts = d.posts || [];
        const broken = accounts.filter(a => a.status !== 'connected');
        // Nothing publishes until a network integration is connected. Saying so here is the
        // difference between a queue that looks healthy and one a person can act on.
        const unsent = posts.filter(p => ['scheduled', 'failed', 'partially_published'].includes(p.status)
          || (p.targets || []).some(t => t.status === 'failed'));
        inner = `
          <div class="flex items-center justify-between gap-3 mb-3">
            <div class="text-[13px] text-slate-500">Composed here, published by the dealership's connected accounts.</div>
            <button onclick="mktCompose()" class="shrink-0 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[12px] font-bold">New post</button>
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
          <div class="mt-4"></div>
          ${engCard('Scheduled and recent posts', posts.length ? posts.slice(0, 40).map(p => {
            // A post whose targets partly failed is NOT "published". Saying so would hide
            // the one account the dealership meant to reach and never did.
            const targets = p.targets || [];
            const failed = targets.filter(t => t.status === 'failed');
            const partial = failed.length > 0 && failed.length < targets.length;
            // The provider's own words. "Failed" alone tells nobody whether to reconnect an
            // account, wait, or stop expecting this post to go out at all.
            const why = failed[0]?.error || null;
            return mktRow({
              title: (p.body || 'Post').slice(0, 70),
              sub: `${mktLabel(p.status)}${p.scheduled_for ? ` · ${String(p.scheduled_for).slice(0, 16).replace('T', ' ')}` : ''}`,
              note: targets.length
                ? `${targets.length} account(s)${failed.length ? ` · ${failed.length} failed to publish` : ''}${why ? ` · ${why}` : ''}`
                : 'no accounts',
              right: partial ? 'Partly published' : failed.length ? 'Failed' : mktLabel(p.status),
              tone: failed.length || p.status === 'failed' ? 'text-rose-600 dark:text-rose-400'
                  : p.status === 'published' ? 'text-emerald-600 dark:text-emerald-400' : '',
              onclick: p.status !== 'published' && p.status !== 'needs_approval'
                ? `mktPublishNow('${p.id}')` : null,
              actionLabel: failed.length ? 'Retry' : 'Publish',
            });
          }).join('') : engEmpty('Nothing scheduled.'))}`;
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
