/* dashboard.js split part 23/26 — contiguous, load-order-critical. Do not reorder the <script> tags in dashboard.html. */

// Rename the "Ask MarketSync" dock (launcher, header, greeting) to the dealer's
// chosen assistant name. Falls back to "MarketSync" when blank.
function applyAssistantName(name) {
  __aiAssistantName = (name || '').trim() || 'MarketSync';
  const label = document.getElementById('ai-dock-btn-label'); if (label) label.textContent = `Ask ${__aiAssistantName}`;
  const title = document.getElementById('ai-dock-title'); if (title) title.textContent = `Ask ${__aiAssistantName}`;
  const btn = document.getElementById('ai-dock-btn'); if (btn) btn.setAttribute('aria-label', `Ask ${__aiAssistantName}`);
  if (!aiDockMessages.length) renderAiDockMessages();   // refresh the greeting if still on the intro
}
window.applyAssistantName = applyAssistantName;

// ── Reports rail — fixed right-edge quick access to every lot-wide report ─────
let __reportRailWired = false;

function updateReportRailVisibility() {
  const rail = document.getElementById('report-rail');
  if (!rail) return;
  // All four reports are Inventory Intelligence features, so the rail rides on
  // that entitlement (owner already resolves to active in /ai/config).
  // Step aside while the AI chat panel is open — it occupies the same right edge.
  const panel = document.getElementById('ai-dock-panel');
  const panelOpen = panel && !panel.classList.contains('hidden');
  const isMgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
  const show = !!__invIntelActive && isMgr && !panelOpen;   // reports are manager-only
  rail.classList.toggle('lg:flex', show);   // lg:flex + base `hidden` = desktop-only when shown
  if (__invIntelActive) wireReportRail();
}

function toggleReportRail() {
  const rail = document.getElementById('report-rail');
  if (!rail) return;
  const open = rail.classList.toggle('rr-open');
  try { localStorage.setItem('reportRailOpen', open ? '1' : '0'); } catch {}
}
window.toggleReportRail = toggleReportRail;

function wireReportRail() {
  if (__reportRailWired) return;
  const rail = document.getElementById('report-rail');
  if (!rail) return;
  __reportRailWired = true;
  // Minimized (icon-only) by default; remember the user's preference.
  try { if (localStorage.getItem('reportRailOpen') === '1') rail.classList.add('rr-open'); } catch {}

  // Briefly ring-highlight a control after we jump to its page, so the user can
  // see where the rail took them.
  const flash = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-indigo-500', 'ring-offset-2', 'dark:ring-offset-slate-900', 'rounded-lg');
    setTimeout(() => el.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-2', 'dark:ring-offset-slate-900', 'rounded-lg'), 2200);
  };

  rail.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-report]');
    if (!btn) return;
    const kind = btn.dataset.report;
    if (kind === 'lot') {
      // Lot Average Report opens as a modal — works from any page.
      if (typeof openLotReport === 'function') openLotReport();
    } else if (kind === 'scan') {
      switchPage('inv-intel');
      setTimeout(() => flash('inv-scan-controls'), 120);
    } else if (kind === 'snapshot') {
      switchPage('inv-intel');
      setTimeout(() => flash('msnap-run'), 120);
    } else if (kind === 'weekly') {
      switchPage('profile');
      setTimeout(() => flash('weekly-report-btn'), 120);
    } else if (kind === 'speed') {
      // Speed-to-lead lives in the Leads report (median response, under-5-min %).
      switchPage('reports');
      setTimeout(() => { if (typeof reportsTab === 'function') reportsTab('leads'); }, 150);
    } else if (kind === 'equity') {
      switchPage('equity');
    } else if (['sales', 'fni', 'leads', 'reps', 'appraisals', 'appointments', 'service', 'esign', 'marketing', 'activity', 'customers'].includes(kind)) {
      // Open the full Reports hub straight on the requested tab.
      switchPage('reports');
      setTimeout(() => { if (typeof reportsTab === 'function') reportsTab(kind); }, 150);
    } else if (kind === 'all') {
      switchPage('reports');
    }
  });
}

function updateAiDockVisibility() {
  const btn = document.getElementById('ai-dock-btn');
  const panel = document.getElementById('ai-dock-panel');
  if (!btn) return;
  const show = !!(__aiBoostActive || __invIntelActive);
  const panelOpen = panel && !panel.classList.contains('hidden');
  // Launcher hides while the panel is open, or when not entitled.
  btn.classList.toggle('hidden', !show || panelOpen);
  if (!show && panel) panel.classList.add('hidden');
  const attach = document.getElementById('ai-dock-attach');
  const canImportCommission = profileContext?.workspace !== 'saas_admin' && ['DEALER_ADMIN', 'OWNER', 'MANAGER', 'ACCOUNTING'].includes(profileContext?.role);
  if (attach) attach.classList.toggle('hidden', !canImportCommission);
}

function renderAiDockMessages() {
  const box = document.getElementById('ai-dock-messages');
  if (!box) return;
  box.innerHTML = '';
  if (!aiDockMessages.length) {
    const intro = document.createElement('div');
    intro.className = 'text-slate-500 dark:text-slate-400';
    const isMgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
    // Managers get the cross-data "brain" prompts; reps get lot/lead prompts.
    const suggestions = isMgr
      ? ['What should I focus on today?', 'Are we up or down vs last month?', "Who's my top salesperson?", 'Why did leads change this month?', 'Which cars should I discount or wholesale?']
      : ['What should I focus on today?', 'Which units are aging 60+ days?', 'How many leads need follow-up?', 'Anything priced off market?'];
    intro.innerHTML =
      `<div class="mb-3 leading-relaxed">Hi 👋 I'm ${esc(__aiAssistantName)} — I can see your whole store live: inventory, leads, sales, F&amp;I, commissions, reconditioning and today's tasks. Ask me anything.</div>` +
      '<div class="flex flex-wrap gap-1.5">' +
      suggestions
        .map(s => `<button type="button" data-ai-suggest="${s}" class="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-1.5 text-slate-700 dark:text-slate-200 transition">${s}</button>`)
        .join('') +
      // Lookups need a name/stock #, so these chips pre-fill the box instead of sending.
      `<button type="button" data-ai-fill="What's the status on " class="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-1.5 text-slate-700 dark:text-slate-200 transition">Look up a customer…</button>` +
      `<button type="button" data-ai-fill="What's the story on stock #" class="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-1.5 text-slate-700 dark:text-slate-200 transition">Look up a vehicle…</button>` +
      (isMgr ? `<button type="button" data-ai-attach="1" class="text-xs bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 rounded-full px-3 py-1.5 text-indigo-700 dark:text-indigo-300 transition">Build commission plan from a document…</button>` : '') +
      '</div>';
    box.appendChild(intro);
  }
  aiDockMessages.forEach((m, idx) => {
    const row = document.createElement('div');
    row.className = m.role === 'user' ? 'flex justify-end' : 'flex flex-col items-start';
    const bubble = document.createElement('div');
    bubble.className = m.role === 'user'
      ? 'max-w-[85%] bg-indigo-600 text-white rounded-2xl rounded-br-sm px-3.5 py-2 whitespace-pre-wrap break-words'
      : 'max-w-[85%] bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl rounded-bl-sm px-3.5 py-2 break-words leading-relaxed';
    if (m.role === 'user') bubble.textContent = m.content;
    else bubble.innerHTML = aiDockRichText(m.content);
    row.appendChild(bubble);
    // Agentic action: a confirm chip under the assistant bubble (nothing runs until clicked).
    if (m.role === 'assistant' && m.action && !m.action_done) {
      const a = m.action;
      let label = 'Confirm';
      if (a.action === 'create_task') label = `✓ Create task: "${a.title}"${a.due_hours ? ` (due in ${a.due_hours}h)` : ''}`;
      else if (a.action === 'bulk_outreach') label = `✉️ Set up: "${a.instruction}"`;
      else if (a.action === 'book_appointment') { let w = a.when_iso; try { w = new Date(a.when_iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch {} label = `📅 Book appointment — ${a.customer} (${w})`; }
      else if (a.action === 'reassign_lead') label = `🔄 Reassign ${a.customer} → ${a.to_rep}`;
      else if (a.action === 'review_commission_plans') label = 'Review commission-plan drafts';
      const wrap = document.createElement('div');
      wrap.className = 'mt-1.5 flex items-center gap-2';
      wrap.innerHTML = `<button onclick="aiDockRunAction(${idx})" class="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg">${esc(label)}</button><button onclick="aiDockCancelAction(${idx})" class="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">Cancel</button>`;
      row.appendChild(wrap);
    } else if (m.role === 'assistant' && m.action_done) {
      const done = document.createElement('div');
      done.className = 'mt-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400';
      done.textContent = m.action_done === 'handoff' ? '✓ Opened for review' : '✓ Done';
      row.appendChild(done);
    }
    box.appendChild(row);
  });
  if (aiDockBusy) {
    const row = document.createElement('div');
    row.className = 'flex justify-start';
    const b = document.createElement('div');
    b.className = 'bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-2xl px-3.5 py-2 text-xs';
    b.textContent = 'Thinking…';
    row.appendChild(b);
    box.appendChild(row);
  }
  box.scrollTop = box.scrollHeight;
}

let __mammothPromise = null;
function loadMammothJs() {
  if (window.mammoth) return Promise.resolve(window.mammoth);
  if (__mammothPromise) return __mammothPromise;
  __mammothPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mammoth@1.9.1/mammoth.browser.min.js';
    script.onload = () => window.mammoth ? resolve(window.mammoth) : reject(new Error('Word document reader did not load'));
    script.onerror = () => { __mammothPromise = null; reject(new Error('Word document reader did not load')); };
    document.head.appendChild(script);
  });
  return __mammothPromise;
}
function aiDockRtfText(raw) {
  return String(raw || '')
    .replace(/\\par[d]?\b/g, '\n')
    .replace(/\\'[0-9a-f]{2}/gi, match => { try { return String.fromCharCode(parseInt(match.slice(2), 16)); } catch { return ' '; } })
    .replace(/\\[a-z]+-?\d*\s?/gi, '')
    .replace(/[{}]/g, '')
    .replace(/\n{3,}/g, '\n\n');
}
async function readAiCommissionFile(file) {
  if (!file) throw new Error('Choose a commission plan document.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Keep the commission document under 8 MB.');
  const lower = file.name.toLowerCase();
  let text = '';
  if (lower.endsWith('.pdf')) text = await extractPdfText(file, { maxChars: 60000, maxPages: 80 });
  else if (lower.endsWith('.docx')) {
    const mammoth = await loadMammothJs();
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    text = result?.value || '';
  } else if (lower.endsWith('.rtf')) text = aiDockRtfText(await file.text());
  else if (/\.(txt|md|csv|json)$/i.test(lower) || /^text\//i.test(file.type || '')) text = await file.text();
  else if (lower.endsWith('.doc')) throw new Error('Older .doc files are not supported. Save it as DOCX or PDF, then drop it here.');
  else throw new Error('Use a PDF, DOCX, RTF, TXT, Markdown, CSV, or JSON document.');
  text = String(text || '').replace(/[ \t]{3,}/g, ' ').replace(/\n{4,}/g, '\n\n').trim().slice(0, 60000);
  if (text.length < 80) throw new Error('I could not read enough text. Use a text-based PDF or DOCX, or paste the plan into chat.');
  return text;
}
function setAiDockFileStatus(message, kind = 'info') {
  const status = document.getElementById('ai-dock-file-status');
  if (!status) return;
  if (!message) { status.textContent = ''; status.classList.add('hidden'); return; }
  status.textContent = message;
  status.className = `border-t px-3 py-2 text-xs ${kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300' : kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300'}`;
}
async function sendAiCommissionImport(file, answers = '') {
  if (aiDockBusy) return;
  let state = aiDockPendingCommissionImport;
  try {
    if (file) {
      setAiDockFileStatus(`Reading ${file.name}…`);
      const text = await readAiCommissionFile(file);
      state = { name: file.name, text, questions: [] };
      aiDockPendingCommissionImport = state;
      aiDockMessages.push({ role: 'user', content: `Attached commission plan: ${file.name}` });
    } else if (state && answers.trim()) {
      aiDockMessages.push({ role: 'user', content: answers.trim() });
    } else return;
    aiDockBusy = true;
    setAiDockFileStatus(`Building an inactive commission-plan draft from ${state.name}…`);
    renderAiDockMessages();
    const response = await fetch(`${API}/ai/assistant/commission-plan-import`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: state.name, text: state.text, questions: state.questions || [], answers: answers.trim() }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not build the commission plan.');
    aiDockMessages.push({ role: 'assistant', content: data.reply || 'The commission document was processed.', action: data.action || null });
    if (data.status === 'needs_clarification') {
      aiDockPendingCommissionImport = { ...state, questions: data.questions || [] };
      setAiDockFileStatus('Answer the important question in chat. I will build the draft from your answer.');
    } else {
      aiDockPendingCommissionImport = null;
      setAiDockFileStatus('Inactive commission-plan draft created. Review it before activation or assignment.', 'success');
    }
  } catch (error) {
    aiDockMessages.push({ role: 'assistant', content: error.message || 'Could not read that commission document.' });
    setAiDockFileStatus(error.message || 'Could not read that commission document.', 'error');
    if (file) aiDockPendingCommissionImport = null;
  } finally {
    aiDockBusy = false;
    const input = document.getElementById('ai-dock-input');
    if (input) { input.value = ''; input.style.height = 'auto'; }
    renderAiDockMessages();
  }
}

async function sendAiDock(text) {
  text = (text || '').trim();
  if (!text || aiDockBusy) return;
  if (aiDockPendingCommissionImport) return sendAiCommissionImport(null, text);
  aiDockMessages.push({ role: 'user', content: text });
  aiDockBusy = true;
  renderAiDockMessages();
  const input = document.getElementById('ai-dock-input');
  if (input) { input.value = ''; input.style.height = 'auto'; }
  try {
    // MarketSync HQ (saas_admin) gets its own copilot; dealers get the dealership assistant.
    const aiEndpoint = (profileContext?.workspace === 'saas_admin') ? '/saas/assistant' : '/ai/assistant';
    const r = await fetch(`${API}${aiEndpoint}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: aiDockMessages.slice(-10) }),
    });
    const d = await r.json().catch(() => ({}));
    aiDockMessages.push({ role: 'assistant', content: r.ok ? (d.reply || 'No reply.') : (d.error || 'Something went wrong. Try again.'), action: r.ok ? (d.action || null) : null });
  } catch {
    aiDockMessages.push({ role: 'assistant', content: 'Network error — please try again.' });
  } finally {
    aiDockBusy = false;
    renderAiDockMessages();
  }
}

// Execute an agentic action the assistant proposed (only on the user's click).
async function aiDockRunAction(idx) {
  const m = aiDockMessages[idx]; if (!m || !m.action || m.action_done) return;
  const a = m.action;
  try {
    if (a.action === 'create_task') {
      const due_at = a.due_hours ? new Date(Date.now() + a.due_hours * 3600000).toISOString() : null;
      await apiSendJson('/crm/tasks', 'POST', { title: a.title, type: 'followup', due_at });
      m.action_done = 'done';
      showToast('Task created ✓', 'success');
    } else if (a.action === 'bulk_outreach') {
      // Hand off to the safe bulk-outreach flow (its own preview + confirm before send).
      m.action_done = 'handoff';
      closeAiDock();
      openBulkOutreach(a.instruction);
    } else if (a.action === 'book_appointment' || a.action === 'reassign_lead') {
      // Server executes these with strict matching; show its message back in the thread.
      const r = await apiSendJson('/ai/assistant/action', 'POST', a);
      m.action_done = 'done';
      aiDockMessages.push({ role: 'assistant', content: r.message || 'Done ✓' });
      showToast(r.message || 'Done ✓', 'success');
    } else if (a.action === 'review_commission_plans') {
      m.action_done = 'handoff';
      closeAiDock();
      switchPage('acct-settings');
      setTimeout(() => document.getElementById('acct-comm-box')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }
  } catch (e) { showToast(e.message || 'Could not do that', 'error'); return; }
  renderAiDockMessages();
}
function aiDockCancelAction(idx) { const m = aiDockMessages[idx]; if (m) { m.action = null; renderAiDockMessages(); } }
window.aiDockRunAction = aiDockRunAction;
window.aiDockCancelAction = aiDockCancelAction;

function openAiDock() {
  const p = document.getElementById('ai-dock-panel');
  if (!p) return;
  p.classList.remove('hidden');
  document.getElementById('ai-dock-btn')?.classList.add('hidden');
  updateReportRailVisibility();   // hide the reports rail while the chat covers the right edge
  renderAiDockMessages();
  setTimeout(() => document.getElementById('ai-dock-input')?.focus(), 50);
}

function closeAiDock() {
  document.getElementById('ai-dock-panel')?.classList.add('hidden');
  updateAiDockVisibility();
  updateReportRailVisibility();   // restore the reports rail
}
window.openAiDock = openAiDock;
window.closeAiDock = closeAiDock;

function initAiDock() {
  const btn = document.getElementById('ai-dock-btn');
  if (!btn || btn.dataset.wired) return;
  btn.dataset.wired = '1';
  btn.addEventListener('click', openAiDock);
  document.getElementById('ai-dock-close')?.addEventListener('click', closeAiDock);
  document.getElementById('ai-dock-clear')?.addEventListener('click', () => {
    aiDockMessages = [];
    aiDockPendingCommissionImport = null;
    setAiDockFileStatus('');
    renderAiDockMessages();
    document.getElementById('ai-dock-input')?.focus();
  });
  const form = document.getElementById('ai-dock-form');
  const input = document.getElementById('ai-dock-input');
  const fileInput = document.getElementById('ai-dock-file');
  document.getElementById('ai-dock-attach')?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) sendAiCommissionImport(file);
    fileInput.value = '';
  });
  const panel = document.getElementById('ai-dock-panel');
  panel?.addEventListener('dragover', (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; panel.classList.add('ring-2', 'ring-indigo-500'); });
  panel?.addEventListener('dragleave', (e) => { if (!panel.contains(e.relatedTarget)) panel.classList.remove('ring-2', 'ring-indigo-500'); });
  panel?.addEventListener('drop', (e) => {
    e.preventDefault(); panel.classList.remove('ring-2', 'ring-indigo-500');
    const file = e.dataTransfer?.files?.[0];
    if (file) sendAiCommissionImport(file);
  });
  form?.addEventListener('submit', (e) => { e.preventDefault(); sendAiDock(input?.value); });
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiDock(input.value); }
  });
  input?.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 112) + 'px';
  });
  document.getElementById('ai-dock-messages')?.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-ai-suggest]');
    if (chip) { sendAiDock(chip.getAttribute('data-ai-suggest')); return; }
    // Fill chips pre-load the input (e.g. customer lookup needs a name typed in).
    const fill = e.target.closest('[data-ai-fill]');
    if (fill) {
      const input = document.getElementById('ai-dock-input');
      if (input) { input.value = fill.getAttribute('data-ai-fill'); input.focus(); input.dispatchEvent(new Event('input')); }
    }
    const attach = e.target.closest('[data-ai-attach]');
    if (attach) fileInput?.click();
  });
}
document.addEventListener('DOMContentLoaded', initAiDock);

// ── Market Snapshot (Inventory Intelligence) ─────────────────────────────────
// On-demand days-on-market + price stats for any make/model, via /ai/market-snapshot.
async function runMarketSnapshot() {
  const btn = document.getElementById('msnap-run');
  const out = document.getElementById('msnap-result');
  if (!btn || !out) return;
  const make = document.getElementById('msnap-make')?.value.trim();
  const model = document.getElementById('msnap-model')?.value.trim();
  const year = document.getElementById('msnap-year')?.value.trim();
  const trim = document.getElementById('msnap-trim')?.value.trim();
  if (!make || !model) { out.innerHTML = '<div class="text-xs text-amber-600 dark:text-amber-400">Enter at least a make and model.</div>'; return; }
  btn.disabled = true; btn.textContent = 'Loading…'; out.innerHTML = '';
  try {
    const q = new URLSearchParams({ make, model });
    if (year) q.set('year', year);
    if (trim) q.set('trim', trim);
    const r = await fetch(`${API}/ai/market-snapshot?${q.toString()}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { out.innerHTML = `<div class="text-xs text-rose-500">${esc(d.error || 'Lookup failed.')}</div>`; return; }
    if (!d.found) { out.innerHTML = `<div class="text-xs text-slate-500 dark:text-slate-400">No active listings found for ${esc([year, make, model, trim].filter(Boolean).join(' '))}.</div>`; return; }
    const money = n => n != null ? '$' + Math.round(Number(n)).toLocaleString() : '—';
    const days = n => n != null ? Math.round(Number(n)) + ' days' : '—';
    const tile = (label, val, sub) => `<div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
      <div class="text-[10px] uppercase font-bold tracking-wider text-slate-400">${label}</div>
      <div class="text-lg font-black text-slate-900 dark:text-white mt-0.5">${val}</div>
      ${sub ? `<div class="text-[11px] text-slate-400">${sub}</div>` : ''}</div>`;
    out.innerHTML = `
      <div class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">${esc([d.year, d.make, d.model, d.trim].filter(Boolean).join(' '))} · ${esc(d.currency || '')}</div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        ${tile('Active listings', d.count != null ? d.count.toLocaleString() : '—', 'in market')}
        ${tile('Median price', money(d.price?.median), d.price ? `${money(d.price.min)}–${money(d.price.max)}` : '')}
        ${tile('Avg days on market', days(d.dom?.mean ?? d.dom?.median), 'lower = hotter')}
        ${tile('Median mileage', d.miles?.median != null ? Math.round(d.miles.median).toLocaleString() : '—', 'across comps')}
      </div>`;
  } catch {
    out.innerHTML = '<div class="text-xs text-rose-500">Network error — try again.</div>';
  } finally {
    btn.disabled = false; btn.textContent = 'Get snapshot';
  }
}
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('msnap-run')?.addEventListener('click', runMarketSnapshot);
  ['msnap-make', 'msnap-model', 'msnap-year', 'msnap-trim'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') runMarketSnapshot(); });
  });
});

// ── Trade appraisal: Deal Details (customer, disclosure, salesperson, PDFs) ───
const APPR_FEATURES = ['Power Windows', 'Power Door Locks', 'Power Seats', 'DVD Player', 'Navigation System', 'Air Conditioning', 'Sunroof', 'Alloy Wheels', 'Leather', 'Heated Seats', 'Ventilated Seats', 'MP3 Player', 'Park Assist', 'Towing Package', 'Snow Tires', '2 Keyless Remotes', 'Backup Camera', 'Remote Start', 'Apple CarPlay / Android Auto', 'Blind Spot Monitor', 'Adaptive Cruise'];

// The full trade-in disclosure — every question from the standard statement,
// grouped into sections. Types: 'yesno' (default), 'select', 'money'.
const APPR_DISCLOSURE_SECTIONS = [
  { title: 'Vehicle History', items: [
    { id: 'accident', q: 'Has the vehicle been in an accident?', money: true, moneyLabel: 'Amount $', detail: true },
    { id: 'panels', q: 'Have any panels been repaired, repainted or replaced?', detail: true },
    { id: 'abs', q: 'Is the ABS operational?', detail: true, detailLabel: 'If "No," details' },
    { id: 'accident_type', q: 'Vehicle accident type', type: 'select', options: ['None', 'Salvage', 'Irreparable', 'Rebuilt', 'Other'], detail: true, detailLabel: 'If "Other," details' },
    { id: 'original_owner', q: 'Customer is original owner?', detail: true, detailLabel: 'If "No," where was it purchased' },
    { id: 'airbags', q: 'Are all of the air bags operational?', detail: true, detailLabel: 'If "No," details' },
    { id: 'import', q: 'Is this a US or out-of-province vehicle?', where: true, whereLabel: 'Which province / state', detail: true },
    { id: 'odometer', q: 'Odometer broken, faulty, replaced, repaired, disconnected or rolled back?', detail: true },
    { id: 'factory_warranty', q: 'Does the vehicle have a factory warranty?', detail: true },
    { id: 'extended_warranty', q: 'Does the vehicle have an extended warranty?', detail: true },
    { id: 'mechanical', q: 'Mechanical issues?', detail: true },
    { id: 'maintenance_6mo', q: 'Dollar value of maintenance in the last 6 months', type: 'money' },
  ] },
  { title: 'Disclosure Declaration', intro: 'Has this vehicle…', items: [
    { id: 'decl_rental', q: 'Been used as a daily rental, police cruiser, emergency services vehicle, taxi or limousine?' },
    { id: 'decl_flood_fire', q: 'Sustained damage caused by flood or fire?' },
    { id: 'decl_modified', q: 'Been modified, including badging or decals, from its original specifications?' },
    { id: 'decl_total_loss', q: 'Been declared a total loss by an insurer?' },
    { id: 'decl_stolen', q: 'Been recovered after being reported stolen?' },
    { id: 'decl_warranty_cancelled', q: "Had the manufacturer's warranty cancelled?" },
    { id: 'decl_damage_3000', q: 'Had any previous damage repaired exceeding $3,000?' },
  ] },
  { title: 'Structural', items: [
    { id: 'structural', q: 'Does this vehicle have any structural parts that are damaged, altered or repaired?', detail: true },
  ] },
  { title: 'Repairs required', intro: 'Does this vehicle require any repairs to the…', items: [
    { id: 'rep_engine', q: 'Engine, transmission, or powertrain?' },
    { id: 'rep_suspension', q: 'Subframe or suspension?' },
    { id: 'rep_computer', q: 'Computer equipment?' },
    { id: 'rep_electrical', q: 'Electrical system?' },
    { id: 'rep_fuel', q: 'Fuel operating system?' },
    { id: 'rep_ac', q: 'Air conditioning system?' },
  ] },
  { title: 'Other', items: [
    { id: 'other', q: 'Are there any other important facts about this vehicle that need to be disclosed?', detail: true },
  ] },
];
const APPR_DISCLOSURE_ITEMS = APPR_DISCLOSURE_SECTIONS.flatMap(s => s.items);
const APPR_INPUT_CLS = 'w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm';

// One disclosure row in the form.
function apprDiscItemHtml(item) {
  if (item.type === 'money') {
    return `<div class="flex items-center justify-between gap-3">
      <label class="text-sm text-slate-700 dark:text-slate-200">${esc(item.q)}</label>
      <input id="disc-${item.id}" inputmode="numeric" placeholder="$" class="w-32 flex-shrink-0 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>`;
  }
  let control;
  if (item.type === 'select') {
    control = `<select id="disc-${item.id}" class="w-40 flex-shrink-0 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm"><option value="">—</option>${item.options.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>`;
  } else {
    control = `<select id="disc-${item.id}" class="w-24 flex-shrink-0 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm"><option value="">—</option><option value="yes">Yes</option><option value="no">No</option></select>`;
  }
  const extras = [];
  if (item.money) extras.push(`<input id="disc-${item.id}-amount" inputmode="numeric" placeholder="${esc(item.moneyLabel || 'Amount $')}" class="${APPR_INPUT_CLS}">`);
  if (item.where) extras.push(`<input id="disc-${item.id}-where" placeholder="${esc(item.whereLabel || 'Which province / state')}" class="${APPR_INPUT_CLS}">`);
  if (item.detail) extras.push(`<input id="disc-${item.id}-details" placeholder="${esc(item.detailLabel || 'Details (optional)')}" class="${APPR_INPUT_CLS}">`);
  const cols = extras.length >= 2 ? 'sm:grid-cols-2' : '';
  return `<div>
    <div class="flex items-center justify-between gap-3"><label class="text-sm text-slate-700 dark:text-slate-200">${esc(item.q)}</label>${control}</div>
    ${extras.length ? `<div class="grid ${cols} gap-2 mt-2">${extras.join('')}</div>` : ''}
  </div>`;
}

// Answer cell for the disclosure PDF.
function apprDiscAns(item, q) {
  if (!q) return '—';
  if (item.type === 'money') return q.value ? '$' + esc(q.value) : '—';
  if (item.type === 'select') return q.answer ? esc(q.answer) : '—';
  return q.answer === 'yes' ? '<span class="yes">YES</span>' : q.answer === 'no' ? '<span class="no">No</span>' : '—';
}

let __apprDealWired = false;
function initApprDeal() {
  const sp = document.getElementById('appr-salesperson-input');
  if (sp && !sp.value) sp.value = (typeof profileContext !== 'undefined' && profileContext?.full_name) ? profileContext.full_name : (profileContext?.email || '');

  const fWrap = document.getElementById('appr-features');
  if (fWrap && !fWrap.children.length) {
    fWrap.innerHTML = APPR_FEATURES.map(f => `<label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" value="${esc(f)}" class="accent-indigo-600"> <span>${esc(f)}</span></label>`).join('');
  }

  const qWrap = document.getElementById('appr-disclosure-qa');
  if (qWrap && !qWrap.children.length) {
    qWrap.innerHTML = APPR_DISCLOSURE_SECTIONS.map(sec => `
      <div class="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800 first:pt-0 first:border-0">
        <div class="text-xs font-bold uppercase tracking-wider text-slate-400">${esc(sec.title)}</div>
        ${sec.intro ? `<div class="text-sm font-medium text-slate-600 dark:text-slate-300">${esc(sec.intro)}</div>` : ''}
        ${sec.items.map(apprDiscItemHtml).join('')}
      </div>`).join('');
  }

  loadApprAppraisers();

  if (__apprDealWired) return;
  __apprDealWired = true;
  document.getElementById('appr-save-deal')?.addEventListener('click', apprSaveDeal);
  document.getElementById('appr-pdf-summary')?.addEventListener('click', apprCustomerSummaryPdf);
  document.getElementById('appr-pdf-disclosure')?.addEventListener('click', apprDisclosurePdf);
}

async function loadApprAppraisers() {
  const box = document.getElementById('appr-notify-list');
  if (!box) return;
  try {
    const r = await fetch(`${API}/ai/appraisers`, { headers: { 'Authorization': `Bearer ${token}` } });
    const list = await r.json().catch(() => []);
    if (!Array.isArray(list) || !list.length) { box.innerHTML = '<div class="text-xs text-slate-400 italic col-span-full">No managers to notify.</div>'; return; }
    box.innerHTML = list.map(m => `<label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" class="appr-notify accent-indigo-600" value="${esc(m.id)}"> <span>${esc(m.name)}</span></label>`).join('');
  } catch { box.innerHTML = '<div class="text-xs text-rose-500 col-span-full">Could not load managers.</div>'; }
}

function apprDealMsg(msg, kind) {
  const el = document.getElementById('appr-deal-msg');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  el.className = 'text-sm rounded-lg px-3 py-2 ' + (kind === 'error'
    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900');
}

function apprCollectDeal() {
  const val = id => (document.getElementById(id)?.value || '').trim();
  const disposition = document.querySelector('input[name="appr-disposition"]:checked')?.value || 'retail';
  const features = [...document.querySelectorAll('#appr-features input:checked')].map(c => c.value);
  const qa = APPR_DISCLOSURE_ITEMS.map(item => {
    const o = { id: item.id, question: item.q, type: item.type || 'yesno' };
    if (item.type === 'money') o.value = val('disc-' + item.id) || null;
    else o.answer = val('disc-' + item.id) || null;
    if (item.money) o.amount = val('disc-' + item.id + '-amount') || null;
    if (item.where) o.where = val('disc-' + item.id + '-where') || null;
    if (item.detail) o.details = val('disc-' + item.id + '-details') || null;
    return o;
  });
  return {
    disposition,
    customer: {
      first_name: val('cust-first'), last_name: val('cust-last'),
      home_phone: val('cust-home-phone'), mobile_phone: val('cust-mobile-phone'),
      email: val('cust-email'), address: val('cust-address'), postal_code: val('cust-postal'),
    },
    disclosure: { features, qa, notes: val('disc-notes') },
  };
}

function apprVehicleForSave() {
  const specs = __apprDecodedSpecs || {};
  if (__apprData && __apprData.vehicle) return { ...specs, ...__apprData.vehicle };
  const g = id => (document.getElementById(id)?.value || '').trim();
  return { ...specs, vin: g('appr-vin').toUpperCase() || null, year: g('appr-year'), make: g('appr-make'), model: g('appr-model'), trim: g('appr-trim'), mileage: g('appr-mileage') };
}

async function apprSaveDeal() {
  const btn = document.getElementById('appr-save-deal');
  const deal = apprCollectDeal();
  const notify = [...document.querySelectorAll('#appr-notify-list input:checked')].map(c => c.value);
  const payload = {
    id: __apprDealId || undefined,
    vehicle: apprVehicleForSave(),
    appraisal: __apprData?.appraisal ? { ...__apprData.appraisal } : null,
    currency: __apprData?.currency || null,
    disposition: deal.disposition, customer: deal.customer, disclosure: deal.disclosure,
    contact_id: __apprContactId || undefined,
    notify,
    salesperson_name: (document.getElementById('appr-salesperson-input')?.value || '').trim() || null,
  };
  if (!payload.vehicle.make || !payload.vehicle.model) { apprDealMsg('Add at least the vehicle make and model (or run an appraisal) before saving.', 'error'); return; }
  btn.disabled = true; const t = btn.textContent; btn.textContent = 'Saving…';
  try {
    const r = await fetch(`${API}/ai/appraisals`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Save failed');
    __apprDealId = j.id;
    apprDealMsg('Saved and attached to ' + ((profileContext?.full_name) || 'you') + '.' + (j.notified ? ` Notified ${j.notified} appraiser${j.notified > 1 ? 's' : ''}.` : ''), 'success');
  } catch (e) { apprDealMsg(e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = t; }
}

// Shared print-to-PDF window (mirrors generateAppraisalPdf's approach).
function apprPrintWindow(title, inner) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
    @media print { .no-print{display:none!important} @page{margin:0.55in} }
    *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#0f172a;background:#fff;margin:0 auto;padding:24px;max-width:780px;font-size:13px;line-height:1.45}
    h1{font-size:21px;margin:0} h2{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin:22px 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
    .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:12px}
    table{width:100%;border-collapse:collapse} td{padding:4px 0;vertical-align:top}
    .kv td:first-child{color:#64748b;width:40%} .kv td:last-child{font-weight:600}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:4px 28px}
    .offer{background:#4f46e5;color:#fff;border-radius:10px;padding:14px 18px;margin-top:6px}
    .offer .n{font-size:26px;font-weight:900}
    .feat{display:grid;grid-template-columns:1fr 1fr 1fr;gap:2px 16px;font-size:12px}
    .qa td{border-bottom:1px solid #f1f5f9;padding:6px 0}
    .yes{color:#b91c1c;font-weight:700} .no{color:#15803d;font-weight:700}
    .sig{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:34px}
    .sig div{border-top:1px solid #94a3b8;padding-top:4px;font-size:11px;color:#64748b}
    .btn{padding:9px 18px;border-radius:8px;border:none;cursor:pointer;font-weight:700;font-size:13px;background:#4f46e5;color:#fff}
    .muted{font-size:11px;color:#94a3b8}
  </style></head><body>
    <div class="no-print" style="display:flex;justify-content:flex-end;gap:10px;margin-bottom:14px">
      <button class="btn" onclick="window.print()">Print / Save as PDF</button>
      <button class="btn" style="background:#e2e8f0;color:#0f172a" onclick="window.close()">Close</button>
    </div>
    ${inner}
    <div style="margin-top:24px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px">Powered by Market<span style="color:#6366f1;font-weight:700">Sync</span></div>
  </body></html>`;
  const w = window.open('', '_blank');
  if (!w) { showToast('Allow pop-ups to open the PDF view', 'error'); return; }
  w.document.write(html); w.document.close();
}

function apprDealMeta() {
  const deal = apprCollectDeal();
  const v = apprVehicleForSave();
  const cust = deal.customer;
  const custName = [cust.first_name, cust.last_name].filter(Boolean).join(' ') || '—';
  const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const dealer = (typeof profileContext !== 'undefined' && profileContext?.dealership?.name) || 'Dealership';
  // Salesperson = whatever's in the (editable) salesperson field, else the loaded
  // record's salesperson, else the logged-in user's name.
  const sales = (document.getElementById('appr-salesperson-input')?.value || '').trim()
    || __apprSalesperson || (profileContext?.full_name) || (profileContext?.email) || '—';
  const vlabel = [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ') || 'Vehicle';
  const info = __apprDealerInfo || {};
  const dealerAddr = [info.city, info.province, info.postal_code].filter(Boolean).join(', ');
  const logo = __apprBranding?.logo_url || null;
  return { deal, v, cust, custName, today, dealer, dealerAddr, logo, sales, vlabel };
}

// Fetch dealership branding (logo) once, for the PDF header.
async function apprEnsureBranding() {
  if (__apprBranding !== null) return __apprBranding;
  try {
    const r = await fetch(`${API}/branding`, { headers: { 'Authorization': `Bearer ${token}` } });
    const d = await r.json().catch(() => ({}));
    __apprBranding = (d && d.branding) ? d.branding : {};
  } catch { __apprBranding = {}; }
  return __apprBranding;
}

// Branded PDF header: dealership logo (their logo) left, title center, dealership
// name + address right. MarketSync wordmark sits in the footer of apprPrintWindow.
function apprBrandedHeader(title, subtitle, dealer, dealerAddr, logo, today) {
  const left = logo
    ? `<img src="${logo}" alt="logo" style="max-height:52px;max-width:190px;object-fit:contain">`
    : `<div style="font-size:20px;font-weight:900;letter-spacing:-.02em;color:#0f172a">Market<span style="color:#4f46e5">Sync</span></div>`;
  return `<div class="head" style="align-items:center">
    <div style="flex:0 0 auto">${left}</div>
    <div style="flex:1;text-align:center;padding:0 12px"><h1 style="font-size:19px">${esc(title)}</h1>${subtitle ? `<div style="font-size:11px;color:#64748b">${esc(subtitle)}</div>` : ''}</div>
    <div style="flex:0 0 auto;text-align:right;font-size:11px;color:#334155"><div style="font-weight:800;color:#0f172a">${esc(dealer)}</div>${dealerAddr ? `<div>${esc(dealerAddr)}</div>` : ''}${today ? `<div style="color:#94a3b8;margin-top:2px">${esc(today)}</div>` : ''}</div>
  </div>`;
}

// Customer Appraisal Summary — laid out like the vAuto sheet, branded MarketSync
// with the dealership's logo. Pre-fills what we know; leaves the rest as blank lines.
function apprCustomerSummaryPdf() {
  const { deal, v, cust, custName, dealer, dealerAddr, logo, sales, vlabel } = apprDealMeta();
  const d = __apprData, ap = d?.appraisal;
  const money2 = n => n != null ? '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  const short = new Date().toLocaleDateString();
  const goodUntil = new Date(Date.now() + 7 * 86400000).toLocaleDateString();
  const qById = Object.fromEntries((deal.disclosure.qa || []).map(q => [q.id, q]));
  const ynv = id => { const q = qById[id]; return q ? (q.answer === 'yes' ? 'Yes' : q.answer === 'no' ? 'No' : '') : ''; };
  const mi = v.mileage ? Number(String(v.mileage).replace(/[^0-9]/g, '')).toLocaleString() : '';
  const fld = (label, value, w) => `<div class="fld" style="${w ? 'flex:0 0 ' + w : 'flex:1'}"><span class="fl">${label}</span><span class="fv">${value != null ? esc(String(value)) : ''}</span></div>`;
  const style = `<style>
    .sec{font-size:15px;font-weight:800;border-bottom:2px solid #0f172a;margin:16px 0 8px;padding-bottom:2px}
    .row{display:flex;gap:18px;margin:6px 0;align-items:flex-end;flex-wrap:wrap}
    .fld{display:flex;align-items:flex-end;gap:6px;min-width:0}
    .fl{font-size:12px;color:#0f172a;white-space:nowrap;text-align:right}
    .fv{flex:1;border-bottom:1px solid #0f172a;min-width:60px;min-height:15px;font-size:12px;padding:0 3px;font-weight:600}
    .consent{border:1.5px solid #0f172a;padding:10px 12px;font-size:11px}
    .consent .ln{border-bottom:1px solid #0f172a;height:22px;margin-top:14px}
    .consent .cap{font-size:10px;color:#334155;text-align:center;margin-top:2px}
    .amt{background:#e5e7eb;border:1px solid #cbd5e1;padding:12px 14px;display:flex;gap:24px;align-items:flex-end;margin-top:26px}
  </style>`;
  const inner = style + `
    ${apprBrandedHeader('Customer Appraisal Summary', vlabel + (v.vin ? ' - ' + v.vin : ''), dealer, dealerAddr, logo, '')}
    <div style="display:flex;gap:20px;margin-top:14px">
      <div style="flex:0 0 40%">
        <div class="consent">
          <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:8px"><span>You may drive and appraise my vehicle</span><span style="border-bottom:1px solid #0f172a;width:64px">&nbsp;</span></div>
          <div style="text-align:right;font-size:9px;color:#334155">Initials</div>
          <div class="ln"></div><div class="cap">Customer signature${custName !== '—' ? ' — ' + esc(custName) : ''}</div>
          <div class="ln"></div><div class="cap">Manager signature</div>
        </div>
      </div>
      <div style="flex:1">
        <div class="sec" style="text-align:center">Customer Information</div>
        <div class="row">${fld('Name:', custName === '—' ? '' : custName)}</div>
        <div class="row">${fld('Address:', cust.address)}</div>
        <div class="row">${fld('City:', '')}</div>
        <div class="row">${fld('Province/Territory:', '', '52%')}${fld('Postal Code:', cust.postal_code)}</div>
        <div class="row">${fld('Email:', cust.email)}</div>
        <div class="row">${fld('Phone (Home):', cust.home_phone)}</div>
        <div class="row">${fld('Phone (Work):', '')}</div>
        <div class="row">${fld('Phone (Mobile):', cust.mobile_phone)}</div>
      </div>
    </div>
    <div class="sec">Vehicle Information</div>
    <div style="display:flex;gap:24px">
      <div style="flex:1">
        <div class="row">${fld('VIN:', v.vin)}</div>
        <div class="row">${fld('Year:', v.year)}</div>
        <div class="row">${fld('Make:', v.make)}</div>
        <div class="row">${fld('Model:', v.model)}</div>
        <div class="row">${fld('Series:', v.trim)}</div>
      </div>
      <div style="flex:1">
        <div class="row">${fld('Odometer:', mi)}</div>
        <div class="row">${fld('Interior Colour:', '')}</div>
        <div class="row">${fld('Exterior Colour:', v.color)}</div>
        <div class="row">${fld('Transmission:', v.transmission)}</div>
        <div class="row">${fld('Condition:', '')}</div>
      </div>
    </div>
    <div class="sec">Additional Information</div>
    <div class="row">${fld('Comments:', deal.disclosure.notes)}</div>
    <div class="row">${fld('Extended Warranty:', ynv('extended_warranty'), '30%')}${fld('Factory Warranty:', ynv('factory_warranty'), '30%')}</div>
    <div class="row">${fld('Vehicle Salvaged:', ynv('decl_total_loss'), '30%')}${fld('Flood Damage:', ynv('decl_flood_fire'), '30%')}${fld('Odometer Replaced:', ynv('odometer'), '30%')}</div>
    <div class="row">${fld('Improvements:', '')}</div>
    <div class="row">${fld('Lien Holder:', '', '58%')}${fld('Phone:', '')}</div>
    <div class="row">${fld('Lien Payoff:', '', '38%')}${fld('Good Until:', '', '26%')}${fld('Per Diem:', '', '26%')}</div>
    <div class="row" style="margin-top:12px;border-top:1px solid #cbd5e1;padding-top:12px">${fld('Salesperson:', sales, '33%')}${fld('Appraisal Date:', short, '30%')}${fld('Est. Recond.:', ap && ap.recon != null ? '$' + Number(ap.recon).toLocaleString() : '')}</div>
    <div class="amt">
      ${fld('Appraiser:', '', '38%')}
      ${fld('Good Until:', goodUntil, '26%')}
      <div class="fld" style="flex:1"><span class="fl" style="font-weight:800">Appraisal Amount:</span><span class="fv" style="font-weight:800">${ap ? money2(ap.suggested_offer) : ''}</span></div>
    </div>`;
  apprPrintWindow('Customer Summary — ' + vlabel, inner);
}

// Trade-In Disclosure Statement — EVERY question, grouped by section, branded, with
// customer + dealer signature lines that carry their printed names.
function apprDisclosurePdf() {
  const { deal, v, cust, custName, today, dealer, dealerAddr, logo, sales, vlabel } = apprDealMeta();
  const d = __apprData;
  const kv = (l, value) => `<tr><td>${esc(l)}</td><td>${value ? esc(value) : '—'}</td></tr>`;
  const feats = deal.disclosure.features;
  const mi = v.mileage ? String(v.mileage).replace(/[^0-9]/g, '') + ' ' + (d?.distance_unit || 'km') : '';
  const qById = Object.fromEntries((deal.disclosure.qa || []).map(q => [q.id, q]));
  const sections = APPR_DISCLOSURE_SECTIONS.map(sec => {
    const rows = sec.items.map(item => {
      const q = qById[item.id];
      const extra = [q?.amount ? 'Est. $' + q.amount : '', q?.where || '', q?.details || ''].filter(Boolean).join(' — ');
      return `<tr><td>${esc(item.q)}${extra ? `<div class="muted">${esc(extra)}</div>` : ''}</td><td style="text-align:right;white-space:nowrap">${apprDiscAns(item, q)}</td></tr>`;
    }).join('');
    return `<h2>${esc(sec.title)}</h2>${sec.intro ? `<div style="font-size:12px;color:#334155;margin:-2px 0 4px">${esc(sec.intro)}</div>` : ''}<table class="qa">${rows}</table>`;
  }).join('');
  const inner = `
    ${apprBrandedHeader('Trade-In Disclosure Statement', vlabel + (v.vin ? ' · ' + v.vin : ''), dealer, dealerAddr, logo, today)}
    <div style="text-align:right;font-size:11px;color:#64748b;margin-top:4px">Salesperson: <b>${esc(sales)}</b></div>
    <h2>Vehicle</h2>
    <div class="grid2"><table class="kv">${kv('Vehicle', vlabel)}${kv('VIN', v.vin)}${kv('Odometer', mi)}</table>
      <table class="kv">${kv('Engine', v.engine)}${kv('Transmission', v.transmission)}${kv('Drivetrain', v.drivetrain)}</table></div>
    <h2>Customer</h2>
    <div class="grid2"><table class="kv">${kv('Name', custName)}${kv('Home phone', cust.home_phone)}${kv('Mobile', cust.mobile_phone)}</table>
      <table class="kv">${kv('Email', cust.email)}${kv('Address', cust.address)}${kv('Postal / ZIP', cust.postal_code)}</table></div>
    ${feats.length ? `<h2>Equipment &amp; features</h2><div class="feat">${feats.map(f => `<div>✓ ${esc(f)}</div>`).join('')}</div>` : ''}
    ${sections}
    ${deal.disclosure.notes ? `<h2>Additional notes</h2><div>${esc(deal.disclosure.notes)}</div>` : ''}
    <div class="muted" style="margin-top:16px">The customer certifies the above is true and complete to the best of their knowledge.</div>
    <div class="sig">
      <div>${custName !== '—' ? esc(custName) + ' — ' : ''}Customer signature / date</div>
      <div>${esc(sales)} — Dealer representative signature / date</div>
    </div>`;
  apprPrintWindow('Disclosure — ' + vlabel, inner);
}

// ── Appraisals list (team-wide, filterable, with rep-visibility toggle) ───────
let __apprListWired = false;
let __apprListDebounce = null;
let __apprSalespeopleLoaded = false;
function initApprList() {
  if (__apprListWired) return;
  __apprListWired = true;
  const reload = () => loadApprList();
  document.getElementById('appr-list-search')?.addEventListener('input', () => { clearTimeout(__apprListDebounce); __apprListDebounce = setTimeout(reload, 300); });
  document.getElementById('appr-list-salesperson')?.addEventListener('change', reload);
  document.getElementById('appr-list-disposition')?.addEventListener('change', reload);
  document.getElementById('appr-list')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-appr-id]');
    if (btn) loadAppraisalRecord(btn.getAttribute('data-appr-id'));
  });
}

async function loadApprList() {
  initApprList();
  const box = document.getElementById('appr-list');
  if (!box) return;
  const q = document.getElementById('appr-list-search')?.value.trim() || '';
  const sp = document.getElementById('appr-list-salesperson')?.value || '';
  const disp = document.getElementById('appr-list-disposition')?.value || '';
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (sp) params.set('salesperson', sp);
  if (disp) params.set('disposition', disp);
  try {
    const r = await fetch(`${API}/ai/appraisals?${params.toString()}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { box.innerHTML = `<div class="text-xs text-rose-500 py-4">${esc(d.error || 'Could not load appraisals.')}</div>`; return; }
    const meta = d.meta || {};
    const scope = document.getElementById('appr-list-scope');
    if (scope) {
      scope.textContent = '· ' + (meta.restricted ? 'your appraisals only' : 'all salespeople');
      scope.classList.remove('hidden');
    }
    const spSel = document.getElementById('appr-list-salesperson');
    if (spSel) {
      if (meta.salespeople && meta.salespeople.length && !meta.restricted) {
        spSel.classList.remove('hidden');
        if (!__apprSalespeopleLoaded) {
          const cur = spSel.value;
          spSel.innerHTML = '<option value="">All salespeople</option>' + meta.salespeople.map(p => `<option value="${esc(p.id)}">${esc(p.name || '—')}</option>`).join('');
          spSel.value = cur;
          __apprSalespeopleLoaded = true;
        }
      } else {
        spSel.classList.add('hidden');
      }
    }
    const items = d.items || [];
    if (!items.length) { box.innerHTML = '<div class="text-xs text-slate-400 italic py-4">No appraisals match.</div>'; return; }
    box.innerHTML = items.map(it => {
      const date = it.created_at ? new Date(it.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
      const offer = it.offer != null ? '$' + Number(it.offer).toLocaleString() + (it.currency ? ' ' + esc(it.currency) : '') : '—';
      const disp2 = it.disposition === 'wholesale'
        ? '<span class="text-[9px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full leading-none">Wholesale</span>'
        : '<span class="text-[9px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full leading-none">Retail</span>';
      return `<button type="button" data-appr-id="${esc(it.id)}" class="w-full text-left py-2.5 px-2 -mx-2 rounded flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-slate-900 dark:text-white truncate flex items-center gap-2">${esc(it.label || 'Vehicle')} ${disp2}</div>
          <div class="text-xs text-slate-400 truncate">${esc(it.customer_name || 'No customer')} · ${esc(it.salesperson || '—')} · ${esc(date)}</div>
        </div>
        <div class="text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap">${offer}</div>
      </button>`;
    }).join('');
  } catch {
    box.innerHTML = '<div class="text-xs text-rose-500 py-4">Network error loading appraisals.</div>';
  }
}

async function loadAppraisalRecord(id) {
  try {
    const r = await fetch(`${API}/ai/appraisals/${encodeURIComponent(id)}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const row = await r.json().catch(() => ({}));
    if (!r.ok) { showToast(row.error || 'Could not load appraisal', 'error'); return; }
    const setv = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = (val != null ? val : ''); };
    setv('appr-vin', row.vin); setv('appr-year', row.year); setv('appr-make', row.make);
    setv('appr-model', row.model); setv('appr-trim', row.trim); setv('appr-mileage', row.mileage);
    __apprDecodedSpecs = { body_type: row.body_type || null, engine: row.engine || null, transmission: row.transmission || null, drivetrain: row.drivetrain || null, fuel_type: row.fuel_type || null, color: row.color || null };
    const c = row.customer || {};
    setv('cust-first', c.first_name); setv('cust-last', c.last_name); setv('cust-home-phone', c.home_phone);
    setv('cust-mobile-phone', c.mobile_phone); setv('cust-email', c.email); setv('cust-address', c.address); setv('cust-postal', c.postal_code);
    const dispInput = document.querySelector(`input[name="appr-disposition"][value="${row.disposition === 'wholesale' ? 'wholesale' : 'retail'}"]`);
    if (dispInput) dispInput.checked = true;
    const disc = row.disclosure || {};
    document.querySelectorAll('#appr-features input[type=checkbox]').forEach(cb => { cb.checked = Array.isArray(disc.features) && disc.features.includes(cb.value); });
    (disc.qa || []).forEach(qq => {
      setv('disc-' + qq.id, qq.type === 'money' ? (qq.value || '') : (qq.answer || ''));
      if (qq.details != null) setv('disc-' + qq.id + '-details', qq.details || '');
      if (qq.amount != null) setv('disc-' + qq.id + '-amount', qq.amount || '');
      if (qq.where != null) setv('disc-' + qq.id + '-where', qq.where || '');
    });
    setv('disc-notes', disc.notes || '');
    __apprDealId = row.id;
    // Restore the linked-customer badge if this appraisal is tied to a CRM contact.
    __apprContactId = row.contact_id || null;
    const linkBadge = document.getElementById('appr-cust-linked');
    if (linkBadge) { linkBadge.classList.toggle('hidden', !__apprContactId); linkBadge.classList.toggle('inline-flex', !!__apprContactId); }
    const linkName = document.getElementById('appr-cust-linked-name');
    if (linkName && __apprContactId) linkName.textContent = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Linked';
    __apprSalesperson = row.salesperson_name || null;  // print the record's salesperson, not the viewer
    const spEl = document.getElementById('appr-salesperson-input');
    if (spEl) spEl.value = row.salesperson_name || '';
    __apprData = row.appraisal ? {
      vehicle: { vin: row.vin, year: row.year, make: row.make, model: row.model, trim: row.trim, mileage: row.mileage, engine: row.engine, transmission: row.transmission, drivetrain: row.drivetrain, body_type: row.body_type, fuel_type: row.fuel_type },
      appraisal: row.appraisal, currency: row.currency, distance_unit: row.currency === 'USD' ? 'mi' : 'km',
    } : null;
    const money = n => n != null ? '$' + Number(n).toLocaleString() : '—';
    const resEl = document.getElementById('appr-result');
    if (resEl) {
      const label = [row.year, row.make, row.model, row.trim].filter(Boolean).join(' ') || 'Vehicle';
      const isMgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
      // Push-to-website control (#16). Gated to managers; the unit stays hidden from
      // the public site until the customer's deal is delivered (possession).
      let acquireCtrl = '';
      if (isMgr) {
        if (!row.inventory_id) {
          acquireCtrl = `<button onclick="acquireAppraisal('${row.id}')" class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            Add to website inventory</button>
          <div class="text-[10px] text-slate-400 mt-1 text-right max-w-[180px]">Hidden until the deal is delivered (possession).</div>`;
        } else if (!row.acquired_at) {
          acquireCtrl = `<div class="text-right"><span class="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[11px] font-bold px-2.5 py-1">Awaiting possession</span>
            <div><button onclick="takePossession('${row.id}')" class="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold px-3 py-1.5">Mark in possession → go live</button></div></div>`;
        } else {
          acquireCtrl = `<span class="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold px-2.5 py-1">Live on website</span>`;
        }
      }
      resEl.innerHTML = `<div class="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
        <div><div class="text-xs font-bold uppercase tracking-wider text-indigo-500">Loaded saved appraisal</div>
        <div class="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">${esc(label)}</div></div>
        ${row.appraisal ? `<div class="text-right"><div class="text-[10px] uppercase tracking-wider text-slate-400">Suggested offer</div><div class="text-lg font-black text-slate-900 dark:text-white">${money(row.appraisal.suggested_offer)} ${esc(row.currency || '')}</div></div>` : ''}
        ${acquireCtrl ? `<div class="w-full flex justify-end pt-1 border-t border-slate-100 dark:border-slate-800 mt-1">${acquireCtrl}</div>` : ''}
      </div>`;
    }
    apprDealMsg('Loaded — edit and Save to update, or print a PDF. Salesperson: ' + (row.salesperson_name || '—') + '.', 'success');
    document.getElementById('appr-result')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch { showToast('Could not load appraisal', 'error'); }
}

// Push an acquired trade onto the website inventory — created hidden, released to
// the public site once the deal is delivered (or via "Mark in possession"). (#16)
async function acquireAppraisal(id) {
  if (!confirm('Add this vehicle to your website inventory?\n\nIt stays HIDDEN from the public site until the customer’s deal is Delivered (you take possession). You can also flip it live manually.')) return;
  try {
    const r = await fetch(`${API}/ai/appraisals/${encodeURIComponent(id)}/acquire`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { showToast(d.error || 'Could not add to inventory', 'error'); return; }
    showToast(d.already ? 'Already on your inventory.' : 'Added — hidden until possession.', 'success');
    loadAppraisalRecord(id);
  } catch { showToast('Network error', 'error'); }
}
async function takePossession(id) {
  if (!confirm('Mark this trade as in your possession?\n\nThe unit goes LIVE on your website inventory now.')) return;
  try {
    const r = await fetch(`${API}/ai/appraisals/${encodeURIComponent(id)}/take-possession`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { showToast(d.error || 'Could not update', 'error'); return; }
    showToast('Live on your website inventory.', 'success');
    loadAppraisalRecord(id);
  } catch { showToast('Network error', 'error'); }
}