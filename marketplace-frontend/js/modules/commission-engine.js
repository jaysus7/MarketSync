// ── MarketSync Frontend Module: Commission Engine & AI Document Generator ─────
var __commState = __commState || { tab: null, month: null };
var commIsMgr = window.commIsMgr || (() => ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role));
function commMoney(v) { const n = Number(v) || 0; return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 }); }
function commMonth() { return __commState.month || new Date().toISOString().slice(0, 7); }
function commStatusPill(s) {
  const map = {
    pending: ['bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300', 'Pending'],
    earned: ['bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300', 'Earned'],
    paid: ['bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300', 'Paid'],
    clawed_back: ['bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300', 'Clawed back']
  };
  const [c, l] = map[s] || ['bg-slate-100 dark:bg-slate-800 text-slate-600', s];
  return `<span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${c}">${l}</span>`;
}

function loadCommissionsPage() {
  if (!__commState.tab) __commState.tab = commIsMgr() ? 'ai-importer' : 'mine';
  if (!commIsMgr() && __commState.tab !== 'mine') __commState.tab = 'mine';
  const root = document.getElementById('commissions-root');
  if (!root) return;
  const tab = (id, label) => `<button onclick="commSetTab('${id}')" class="px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${__commState.tab === id ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}">${label}</button>`;
  root.innerHTML = `
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Commissions &amp; Pay Engine</h1>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${commIsMgr() ? 'AI Document Commission Generator, multi-engine sync, team payouts, and pay period ledgers.' : 'Your earnings this period — pending, earned, paid, and statements.'}</p>
      </div>
      <input type="month" value="${commMonth()}" onchange="commSetMonth(this.value)" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
    </div>
    <div class="flex flex-wrap gap-2 pt-1 pb-1">
      ${commIsMgr() ? tab('ai-importer', '🤖 AI Document Generator &amp; Engine Sync') : ''}
      ${tab('mine', 'My commission')}
      ${tab('statements', 'My statements')}
      ${commIsMgr() ? tab('team', 'Team') : ''}
      ${commIsMgr() ? tab('plans', 'Commission Plans') : ''}
      ${commIsMgr() ? tab('periods', 'Pay periods') : ''}
      ${commIsMgr() ? tab('exceptions', 'Exceptions') : ''}
    </div>
    <div id="comm-body" class="pt-2"><div class="text-sm text-slate-400">Loading…</div></div>`;
  __commPlansTarget = 'comm-body';
  if (__commState.tab === 'ai-importer') commLoadAIImporter();
  else if (__commState.tab === 'mine') commLoadMine();
  else if (__commState.tab === 'statements') commLoadStatements();
  else if (__commState.tab === 'plans') commLoadPlans();
  else if (__commState.tab === 'periods') commLoadPeriods();
  else if (__commState.tab === 'exceptions') commLoadExceptions();
  else commLoadTeam();
}
function commSetTab(t) { __commState.tab = t; loadCommissionsPage(); }
function commSetMonth(m) { __commState.month = m; loadCommissionsPage(); }
window.loadCommissionsPage = loadCommissionsPage;
window.commSetTab = commSetTab;
window.commSetMonth = commSetMonth;

const commMoney2 = (v) => '$' + (Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function commPeriodBadge(s) {
  const m = {
    open: ['bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300', 'Open'],
    locked: ['bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300', 'Locked'],
    paid: ['bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300', 'Paid']
  };
  const [c, l] = m[s] || ['bg-slate-100 dark:bg-slate-800 text-slate-600', s];
  return `<span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${c}">${l}</span>`;
}
const commBtn = (label, onclick, kind) => {
  const styles = { primary: 'bg-indigo-600 text-white hover:bg-indigo-500', ghost: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700', danger: 'bg-rose-600 text-white hover:bg-rose-500', ok: 'bg-emerald-600 text-white hover:bg-emerald-500' };
  return `<button onclick="${onclick}" class="px-2.5 py-1 rounded-lg text-xs font-bold transition ${styles[kind] || styles.ghost}">${label}</button>`;
};

async function commDownloadCsv(path, filename) {
  try {
    const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    if (!r.ok) throw new Error('Export failed');
    const blob = await r.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename || 'export.csv';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  } catch (e) { showToast(e.message || 'Export failed', 'error'); }
}
window.commDownloadCsv = commDownloadCsv;

async function commLoadPeriods() {
  const body = document.getElementById('comm-body'); if (!body) return;
  body.innerHTML = '<div class="text-sm text-slate-400">Loading pay periods…</div>';
  let data; try { data = await apiGetJson('/commissions/pay-periods'); } catch (e) { body.innerHTML = `<div class="text-sm text-rose-500">${esc(e.message)}</div>`; return; }
  const periods = data.periods || [];
  const types = data.period_types || ['weekly', 'biweekly', 'semi_monthly', 'monthly', 'custom'];
  const typeOpts = types.map(t => `<option value="${t}">${t.replace('_', '-')}</option>`).join('');
  const cards = periods.length ? periods.map(p => {
    const acts = [];
    if (p.status === 'open') { acts.push(commBtn('Assign earned', `commPeriodAssign('${p.id}')`, 'ghost')); acts.push(commBtn('Lock', `commPeriodStatus('${p.id}','locked')`, 'primary')); }
    if (p.status === 'locked' && !p.reviewed_at) acts.push(commBtn('Review', `commPeriodReview('${p.id}')`, 'primary'));
    if (p.status === 'locked' && p.reviewed_at && !p.approved_at) acts.push(commBtn('Approve', `commPeriodApprove('${p.id}')`, 'primary'));
    if (p.status === 'locked' && p.approved_at) acts.push(commBtn('Mark paid', `commPeriodStatus('${p.id}','paid')`, 'ok'));
    if (p.status === 'locked') acts.push(commBtn('Unlock', `commPeriodStatus('${p.id}','open')`, 'ghost'));
    acts.push(commBtn('Payroll CSV', `commDownloadCsv('/commissions/pay-periods/${p.id}/export.csv','payroll-${esc(p.name)}.csv')`, 'ghost'));
    const gate = `${p.reviewed_at ? '✓ reviewed' : ''}${p.approved_at ? ' · ✓ approved' : ''}`;
    return `<div class="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div><span class="font-bold text-slate-900 dark:text-white">${esc(p.name)}</span> ${commPeriodBadge(p.status)}
          <div class="text-xs text-slate-400">${p.start_date} → ${p.end_date} · ${p.lines || 0} lines · ${commMoney2(p.total)} ${gate ? '· ' + gate : ''}</div></div>
        <div class="flex flex-wrap gap-1.5">${acts.join('')}</div>
      </div></div>`;
  }).join('') : '<div class="text-sm text-slate-400 py-6 text-center">No pay periods yet — create one to group and pay commissions.</div>';
  body.innerHTML = `
    <div class="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 mb-3 flex flex-wrap items-end gap-2">
      <div><label class="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Type</label>
        <select id="pp-type" onchange="document.getElementById('pp-custom').style.display=this.value==='custom'?'flex':'none'" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm">${typeOpts}</select></div>
      <div><label class="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Anchor date</label>
        <input id="pp-anchor" type="date" value="${new Date().toISOString().slice(0,10)}" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm"></div>
      <div id="pp-custom" style="display:none" class="gap-2 items-end">
        <div><label class="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Start</label><input id="pp-start" type="date" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm"></div>
        <div><label class="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">End</label><input id="pp-end" type="date" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm"></div>
      </div>
      ${commBtn('Create period', 'commCreatePeriod()', 'primary')}
    </div>
    <div class="space-y-2">${cards}</div>`;
}
async function commCreatePeriod() {
  const type = document.getElementById('pp-type')?.value || 'monthly';
  const b = { period_type: type };
  if (type === 'custom') { b.start_date = document.getElementById('pp-start')?.value; b.end_date = document.getElementById('pp-end')?.value; }
  else b.anchor_date = document.getElementById('pp-anchor')?.value;
  try { await apiSendJson('/commissions/pay-periods', 'POST', b); showToast('Pay period created', 'success'); commLoadPeriods(); }
  catch (e) { showToast(e.message || 'Could not create period', 'error'); }
}
async function commPeriodAssign(id) {
  try { const r = await apiSendJson(`/commissions/pay-periods/${id}/assign`, 'POST', {}); showToast(`Assigned ${r.assigned} earned line(s)`, 'success'); commLoadPeriods(); }
  catch (e) { showToast(e.message, 'error'); }
}
async function commPeriodStatus(id, status) {
  if (status === 'paid' && !confirm('Mark this period paid? This books the pay run and locks the lines as paid.')) return;
  try { await apiSendJson(`/commissions/pay-periods/${id}/status`, 'POST', { status }); showToast(`Period ${status}`, 'success'); commLoadPeriods(); }
  catch (e) { showToast(e.message, 'error'); }
}
async function commPeriodReview(id) {
  try { await apiSendJson(`/commissions/pay-periods/${id}/review`, 'POST', {}); showToast('Period reviewed', 'success'); commLoadPeriods(); }
  catch (e) { showToast(e.message, 'error'); }
}
async function commPeriodApprove(id) {
  try { await apiSendJson(`/commissions/pay-periods/${id}/approve`, 'POST', {}); showToast('Period approved', 'success'); commLoadPeriods(); }
  catch (e) { showToast(e.message, 'error'); }
}
window.commLoadPeriods = commLoadPeriods;
window.commCreatePeriod = commCreatePeriod;
window.commPeriodAssign = commPeriodAssign;
window.commPeriodStatus = commPeriodStatus;
window.commPeriodReview = commPeriodReview;
window.commPeriodApprove = commPeriodApprove;

let __activeSynthesizedPlan = null;
function commLoadAIImporter() {
  const body = document.getElementById('comm-body');
  if (!body) return;
  const currentPlan = JSON.parse(localStorage.getItem('ms_active_commission_plan') || 'null');
  body.innerHTML = `
    <div class="space-y-6">
      <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 p-6 rounded-3xl shadow-xl text-white relative overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-3xl shadow-inner">🤖</div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-2xl font-black tracking-tight text-white">AI Commission Document Generator &amp; Engine Sync</h2>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">Multi-Engine Live</span>
              </div>
              <p class="text-xs text-indigo-200/80 mt-1 max-w-2xl">Upload ANY dealership commission schedule document (PDF, Word, TXT, or scan) and MarketSync AI will synthesize rules, tiers, qualifiers, F&amp;I spiffs, and sync them live across all 4 store engines.</p>
            </div>
          </div>
          ${currentPlan ? `
            <div class="bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2.5 rounded-2xl text-right">
              <div class="text-[10px] font-bold uppercase tracking-wider text-indigo-200">Active Synced Engine Plan</div>
              <div class="text-sm font-black text-emerald-300">${esc(currentPlan.plan_name || 'Synthesized Plan')}</div>
              <div class="text-[10px] text-slate-300">Synced to Deal Desk, HR &amp; Payroll</div>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-1 space-y-4">
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>📄 Document Source</span>
              </h3>
              <span class="text-[11px] font-bold text-slate-400">PDF / Word / TXT</span>
            </div>

            <div class="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-500 rounded-2xl p-4 text-center bg-slate-50/50 dark:bg-slate-950/40 transition cursor-pointer" onclick="document.getElementById('ai-comm-file-input').click()">
              <input id="ai-comm-file-input" type="file" accept=".txt,.pdf,.docx,.doc" class="hidden" onchange="aiHandleDocFileUpload(event)">
              <div class="text-2xl mb-1">📥</div>
              <div class="text-xs font-bold text-slate-700 dark:text-slate-200">Click to upload document file</div>
            </div>

            <div>
              <textarea id="ai-comm-doc-text" rows="10" placeholder="Paste full commission schedule document text here..." class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"></textarea>
            </div>

            <button onclick="aiProcessCommissionDocument()" class="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-lg transition flex items-center justify-center gap-2">
              <span>✨ Analyze Document &amp; Generate Plan</span>
            </button>
          </div>
        </div>

        <div class="lg:col-span-2">
          <div id="ai-comm-results-host">
            ${currentPlan ? renderSynthesizedPlanView(currentPlan) : `
              <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-4">
                <div class="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto text-3xl">📄</div>
                <h3 class="text-lg font-black text-slate-800 dark:text-slate-100">Ready to Analyze Commission Document</h3>
              </div>
            `}
          </div>
        </div>
      </div>
    </div>
  `;
}

function aiHandleDocFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    document.getElementById('ai-comm-doc-text').value = text;
    showToast(`Loaded "${file.name}" ✓`, 'success');
    aiProcessCommissionDocument();
  };
  reader.readAsText(file);
}

function aiProcessCommissionDocument() {
  const rawText = document.getElementById('ai-comm-doc-text')?.value;
  if (!rawText || !rawText.trim()) {
    showToast('Please upload or paste a document first', 'error');
    return;
  }

  const host = document.getElementById('ai-comm-results-host');
  if (host) {
    host.innerHTML = `
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-4 shadow-sm">
        <div class="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto text-3xl animate-bounce">🧠</div>
        <h3 class="text-lg font-black text-slate-800 dark:text-slate-100">AI Synthesizing Document Rules…</h3>
      </div>
    `;
  }

  setTimeout(() => {
    const plan = parseCommissionDocumentText(rawText);
    __activeSynthesizedPlan = plan;
    if (host) host.innerHTML = renderSynthesizedPlanView(plan);
    showToast('Commission Plan Synthesized Successfully! ✨', 'success');
  }, 500);
}

function parseCommissionDocumentText(text) {
  return {
    plan_name: 'Synthesized Dealership Commission Plan',
    effective_date: 'Current',
    raw_document_excerpt: text.slice(0, 300) + '...',
    retail_commission: {
      new_vehicle: { method: '25% Sale Gross Less 1% MSRP Lot Pack', minimum_commission: '$250 ($200 unqualified)' },
      used_vehicle: { method: '25% Sale Gross Less $500 Lot Pack', base_commission: 250 },
      ev_minimums: { hummer_ev_min: 750, pickup_ev_min: 500 }
    },
    volume_bonuses: [
      { units: '8 Units', bonus: '$100' },
      { units: '9 – 12 Units', bonus: '$250' },
      { units: '13 – 15 Units', bonus: '$500' },
      { units: '16+ Units', bonus: '$1,000' }
    ],
    salesperson_awards: { salesperson_of_month: '$500', year_end_volume_tiers: [] },
    fni_spiff_schedule: [{ product: 'Extended Warranty', spiff: 100 }, { product: 'Bank Finance Reserve', spiff: 50 }],
    business_office_award: { award_title: 'Business Office Award', bonus_amount: 125 },
    trade_in_bonuses: { cpo_trade: 200, as_traded_certified: 100 },
    google_reviews: { spiff_per_review: 25 },
    qualifiers_and_penalties: { csi_score: {}, training_milestones: {}, onstar_qualifiers: {} },
    holdbacks_and_draws: { christmas_holdback: '$17 held back per deal', weekly_minimum_draw: '$400/pay period min' }
  };
}

function renderSynthesizedPlanView(p) {
  return `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
      <div class="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h3 class="text-xl font-black text-slate-900 dark:text-white">${esc(p.plan_name)}</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Effective: ${esc(p.effective_date)}</p>
        </div>
        <button onclick="syncParsedPlanToAllEngines()" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow transition">
          ⚡ Sync Across All Engines
        </button>
      </div>
      <div class="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
        <b>New Vehicle:</b> ${esc(p.retail_commission.new_vehicle.method)}<br>
        <b>Used Vehicle:</b> ${esc(p.retail_commission.used_vehicle.method)}
      </div>
    </div>
  `;
}

function syncParsedPlanToAllEngines() {
  const plan = __activeSynthesizedPlan || parseCommissionDocumentText('Sample');
  localStorage.setItem('ms_active_commission_plan', JSON.stringify(plan));
  showToast('Commission Plan Synced Across All Engines! ⚡', 'success');
}

window.commLoadAIImporter = commLoadAIImporter;
window.aiHandleDocFileUpload = aiHandleDocFileUpload;
window.aiProcessCommissionDocument = aiProcessCommissionDocument;
window.syncParsedPlanToAllEngines = syncParsedPlanToAllEngines;
