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
  ['campaigns', 'Campaigns'], ['social', 'Social'],
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

function mktRow({ title, sub, right, tone, note, onclick }) {
  return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <div class="min-w-0 flex-1">
      <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(title)}</div>
      <div class="text-[12px] text-slate-400 truncate">${esc(sub || '')}</div>
      ${note ? `<div class="text-[12px] ${tone || 'text-slate-400'}">${esc(note)}</div>` : ''}
    </div>
    <div class="shrink-0 text-right text-[13px] font-bold ${tone || ''}">${esc(right || '')}</div>
    ${onclick ? `<button onclick="${onclick}" class="shrink-0 px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Open</button>` : ''}
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
    const [att, camps, accounts, posts, convos, roi] = await Promise.all([
      apiGetJson('/marketing/attention').catch(() => ({ needs_attention: [], opportunities: [] })),
      apiGetJson('/campaigns').catch(() => ({ campaigns: [] })),
      apiGetJson('/social/accounts').catch(() => ({ accounts: [] })),
      apiGetJson('/social/posts').catch(() => ({ posts: [] })),
      apiGetJson('/conversations').catch(() => ({ conversations: [] })),
      apiGetJson('/marketing/roi').catch(() => null),
    ]);
    return {
      needsAttention: att.needs_attention || [],
      opportunities: att.opportunities || [],
      campaigns: camps.campaigns || [],
      accounts: accounts.accounts || [],
      posts: posts.posts || [],
      conversations: convos.conversations || [],
      roi,
    };
  },

  tabs: {
    overview(body, d) {
      const att = d.needsAttention || [], opp = d.opportunities || [];
      const waiting = (d.conversations || []).filter(c => c.status === 'waiting_dealer').length;
      const live = (d.campaigns || []).filter(c => c.status === 'active').length;
      body.innerHTML = `
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

      if (__mktView === 'social') {
        const accounts = d.accounts || [], posts = d.posts || [];
        const broken = accounts.filter(a => a.status !== 'connected');
        inner = `
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            ${engKpi('Accounts', accounts.length)}
            ${engKpi('Disconnected', broken.length, broken.length ? 'text-rose-600 dark:text-rose-400' : '')}
            ${engKpi('Awaiting approval', posts.filter(p => p.status === 'needs_approval').length)}
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
            const failed = targets.filter(t => t.status === 'failed').length;
            const partial = failed > 0 && failed < targets.length;
            return mktRow({
              title: (p.body || 'Post').slice(0, 70),
              sub: `${mktLabel(p.status)}${p.scheduled_for ? ` · ${String(p.scheduled_for).slice(0, 16).replace('T', ' ')}` : ''}`,
              note: targets.length
                ? `${targets.length} account(s)${failed ? ` · ${failed} failed to publish` : ''}`
                : 'no accounts',
              right: partial ? 'Partly published' : failed ? 'Failed' : mktLabel(p.status),
              tone: failed || p.status === 'failed' ? 'text-rose-600 dark:text-rose-400'
                  : p.status === 'published' ? 'text-emerald-600 dark:text-emerald-400' : '',
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
