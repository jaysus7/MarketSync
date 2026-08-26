/* dashboard.js split part 5/26 — contiguous, load-order-critical. Do not reorder the <script> tags in dashboard.html. */

// Speed-to-lead KPI strip for managers — median answer time, answered %, SLA hits.
let __leadMetricsDays = 30;
async function renderLeadMetrics() {
  const box = document.getElementById('leads-metrics');
  if (!box) return;
  let m;
  try { m = await apiGetJson(`/leads/response-metrics?days=${__leadMetricsDays}`); } catch { return; }
  const dur = (s) => s == null ? '—' : fmtLeadDuration(s);
  const pct = (n, d) => d ? Math.round((n / d) * 100) : 0;
  const answeredPct = pct(m.answered, m.total);
  const tile = (label, val, cls = 'text-slate-900 dark:text-white') => `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2"><div class="text-[10px] uppercase tracking-wider text-slate-400 font-bold">${label}</div><div class="text-base font-black ${cls}">${val}</div></div>`;
  // SLA buckets are cumulative counts → show as % of answered for a clean funnel.
  const sla = (label, count) => {
    const p = pct(count, m.answered);
    return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2">
      <div class="flex items-center justify-between text-[11px]"><span class="font-bold text-slate-500 dark:text-slate-300">${label}</span><span class="font-black text-slate-900 dark:text-white">${count} <span class="text-slate-400 font-semibold">(${p}%)</span></span></div>
      <div class="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div class="h-full bg-emerald-500" style="width:${p}%"></div></div>
    </div>`;
  };
  const repRows = (m.per_rep || []).map(r => `<tr class="border-b border-slate-100 dark:border-slate-800/60">
    <td class="py-2 px-3 text-sm font-semibold text-slate-900 dark:text-white">${esc(r.rep)}</td>
    <td class="py-2 px-3 text-sm text-slate-600 dark:text-slate-300">${r.answered}</td>
    <td class="py-2 px-3 text-sm font-bold ${r.median_seconds <= 300 ? 'text-emerald-600 dark:text-emerald-400' : r.median_seconds <= 900 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'}">${dur(r.median_seconds)}</td>
  </tr>`).join('') || '<tr><td colspan="3" class="py-4 px-3 text-center text-sm text-slate-400 italic">No answered leads in this window.</td></tr>';
  const rangeBtn = (d, label) => `<button onclick="__leadMetricsDays=${d};renderLeadMetrics()" class="px-2.5 py-1 rounded-full text-xs font-bold ${__leadMetricsDays === d ? 'bg-indigo-600 text-white' : 'border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}">${label}</button>`;

  box.innerHTML = `
    <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
      <h3 class="text-sm font-bold text-slate-700 dark:text-slate-200">Speed-to-lead report</h3>
      <div class="flex items-center gap-1.5">${rangeBtn(7, '7d')}${rangeBtn(30, '30d')}${rangeBtn(90, '90d')}</div>
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      ${tile('Median answer', dur(m.median_seconds), 'text-indigo-600 dark:text-indigo-400')}
      ${tile('Avg answer', dur(m.avg_seconds))}
      ${tile('Answered', `${answeredPct}% <span class="text-xs font-semibold text-slate-400">(${m.answered}/${m.total})</span>`)}
      ${tile('Still open', m.unanswered, m.unanswered ? 'text-red-500' : 'text-slate-900 dark:text-white')}
      ${tile('Leads', m.total)}
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
      ${sla('Within 5 min', m.within_5min)}
      ${sla('Within 15 min', m.within_15min)}
      ${sla('Within 60 min', m.within_60min)}
    </div>
    <div class="mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
      <div class="overflow-x-auto"><table class="w-full text-left">
        <thead><tr class="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[11px] tracking-wider"><th class="py-2 px-3">Rep</th><th class="py-2 px-3">Answered</th><th class="py-2 px-3">Median time</th></tr></thead>
        <tbody>${repRows}</tbody>
      </table></div>
    </div>
    <div class="text-[11px] text-slate-400 mt-1.5">Last ${m.days} days · median is created→answered time · SLA % is of answered leads.</div>`;
}

// Completing a lead requires logging the outreach (call/text/email) WITH a note —
// this documents the touch on the contact's timeline and stops the clock.
function openLeadComplete(leadId, contactId) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-[70] bg-black/70 flex items-start justify-center p-4 overflow-y-auto';
  modal.innerHTML = `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md mt-16 shadow-2xl">
    <div class="flex items-center justify-between gap-3 p-5 border-b border-slate-200 dark:border-slate-800">
      <h3 class="text-base font-bold text-slate-900 dark:text-white">Log outreach &amp; complete</h3>
      <button data-x class="text-slate-400 hover:text-slate-700 dark:hover:text-white text-2xl leading-none">&times;</button>
    </div>
    <div class="p-5 space-y-4">
      <div>
        <label class="block text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">How did you reach them?</label>
        <div class="flex gap-2">
          ${['call', 'text', 'email'].map((ch, i) => `<label class="flex-1"><input type="radio" name="lc-ch" value="${ch}" class="peer sr-only" ${i === 0 ? 'checked' : ''}><div class="text-center text-sm font-semibold py-2 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer peer-checked:bg-indigo-600 peer-checked:text-white peer-checked:border-indigo-600">${ch[0].toUpperCase() + ch.slice(1)}</div></label>`).join('')}
        </div>
      </div>
      <div>
        <label class="block text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1">Note <span class="text-red-500">*</span></label>
        <textarea data-note rows="4" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white" placeholder="What was said / next step… (required)"></textarea>
      </div>
    </div>
    <div class="flex items-center justify-end gap-2 p-5 border-t border-slate-200 dark:border-slate-800">
      <button data-x class="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">Cancel</button>
      <button data-save class="text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg">Save &amp; complete</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-x]')) close(); });
  modal.querySelector('[data-note]').focus();
  modal.querySelector('[data-save]').addEventListener('click', async (ev) => {
    const note = modal.querySelector('[data-note]').value.trim();
    if (!note) { showToast('A note is required to complete.', 'error'); modal.querySelector('[data-note]').focus(); return; }
    const channel = modal.querySelector('input[name="lc-ch"]:checked')?.value || 'call';
    const btn = ev.currentTarget; btn.disabled = true; btn.textContent = 'Saving…';
    try {
      // Log the outreach on the contact's timeline (channel + note) when linked.
      if (contactId) {
        await fetch(`${API}/crm/contacts/${contactId}/log`, {
          method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel: channel === 'text' ? 'sms' : channel, direction: 'out', body: note }),
        }).catch(() => {});
      }
      const r = await fetch(`${API}/leads/${leadId}/answered`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      if (!r.ok) throw new Error((await r.json()).error || 'Failed');
      close(); showToast('Logged — lead completed.', 'success'); loadLeadsPage();
    } catch (e) { showToast(e.message || 'Could not complete', 'error'); btn.disabled = false; btn.textContent = 'Save & complete'; }
  });
}
window.openLeadComplete = openLeadComplete;

// AI reply draft for a Marketplace lead (AI Boost). Non-subscribers → upgrade modal.
async function openLeadReply(leadId) {
  if (!__aiBoostActive) { openUpgradeModal('ai_boost'); return; }
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-[60] bg-black/70 flex items-start justify-center p-4 overflow-y-auto';
  modal.innerHTML = `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg mt-16 p-6 shadow-2xl">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
        <svg viewBox="0 0 24 24" width="15" height="15" class="flex-shrink-0" aria-hidden="true"><path d="M12 2.5l2.4 6.6 6.6 2.4-6.6 2.4L12 20.5l-2.4-6.6L3 11.5l6.6-2.4z" fill="#c4b5fd" fill-opacity="0.5" stroke="#6d28d9" stroke-width="1.4" stroke-linejoin="round"/></svg>
        AI reply draft
      </h3>
      <button data-x class="text-slate-400 hover:text-slate-700 dark:hover:text-white text-2xl leading-none">&times;</button>
    </div>
    <div data-body class="text-sm text-slate-500 dark:text-slate-400 py-10 text-center italic">Drafting a reply…</div>
  </div>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-x]')) close(); });
  const body = modal.querySelector('[data-body]');
  try {
    const r = await fetch(`${API}/ai/lead-reply`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Failed to draft reply');
    body.className = 'space-y-3';
    body.innerHTML = `
      ${data.vehicle_label ? `<div class="text-xs text-slate-400">Re: ${esc(data.vehicle_label)}</div>` : ''}
      <textarea id="lead-reply-text" rows="7" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white">${esc(data.draft)}</textarea>
      <div class="flex gap-2">
        <button id="lead-reply-copy" class="flex-1 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition">Copy reply</button>
        <button data-x class="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">Close</button>
      </div>
      <p class="text-[11px] text-slate-400">Review before sending — AI can miss details. Paste into your Marketplace chat.</p>`;
    modal.querySelector('#lead-reply-copy')?.addEventListener('click', () => {
      const t = modal.querySelector('#lead-reply-text');
      t.select();
      (navigator.clipboard?.writeText(t.value) || Promise.reject()).then(() => showToast('Reply copied', 'success')).catch(() => { try { document.execCommand('copy'); showToast('Reply copied', 'success'); } catch {} });
      // Copying the reply to send = answering the lead → stop the speed-to-lead clock.
      fetch(`${API}/leads/${leadId}/answered`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } })
        .then(() => { if (document.getElementById('leads-root') && typeof loadLeadsPage === 'function') loadLeadsPage(); })
        .catch(() => {});
    });
  } catch (e) {
    body.className = 'py-8 text-center text-sm text-red-500';
    body.textContent = e.message;
  }
}

// Mobile "all pages" sheet — lists every nav page the user can access.
function setupMobileMoreMenu() {
  const btn = document.getElementById('nav-more');
  const menu = document.getElementById('nav-more-menu');
  const list = document.getElementById('nav-more-list');
  if (!btn || !menu || !list) return;
  if (btn.__moreMenuBound) return;
  btn.__moreMenuBound = true;

  const close = () => {
    menu.classList.add('hidden');
    btn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };

  btn.addEventListener('click', () => {
    btn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    // Rebuild each open so it reflects the user's current role/add-on access.
    // Mirror the desktop grouped sidebar as collapsible dropdown groups so a dealer
    // admin can reach EVERYTHING from one place.
    list.className = 'space-y-1.5';   // stacked full-width groups (was a 2-col grid)
    list.innerHTML = '';
    const mk = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

    const product = document.documentElement.getAttribute('data-product') || '';
    const headerTitle = menu.querySelector('.border-b span');
    const mktSuite = (typeof getActiveMarketingSuite === 'function') ? getActiveMarketingSuite() : null;
    const mktCfg = mktSuite && (typeof getMarketingSuiteConfig === 'function') ? getMarketingSuiteConfig(mktSuite) : null;

    if (headerTitle) {
      if (mktCfg) {
        headerTitle.textContent = mktCfg.title;
      } else if (/(marketsync_email|email_marketing|campaigns[-_]email[-_]sms|campaigns)/.test(product)) {
        headerTitle.textContent = 'Email & SMS Campaigns';
      } else {
        headerTitle.textContent = 'All pages';
      }
    }

    // Restricted tiers (Facebook-only + product tiers): the desktop sidebar is
    // stripped, so mirror exactly that tier's page set here — no legacy tree, no
    // department cards. Settings is always reachable (this list + the header gear).
    // "Upgrade plan" row for the mobile menu — same gate as the desktop CTA (hidden once
    // the account holds the full Dealer OS Pro bundle or is platform staff).
    const appendMobileUpgrade = () => {
      const a = window.__access;
      const onTop = a && Array.isArray(a.products) && ['dealer_os', 'facebook', 'ai_dealer'].every(p => a.products.includes(p));
      if (onTop || a?.isPlatformStaff || typeof openPlanUpgradeModal !== 'function') return;
      const b = mk('<button type="button" class="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-black text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition"><span aria-hidden="true">⭐</span><span>Upgrade plan</span></button>');
      b.addEventListener('click', () => { close(); openPlanUpgradeModal(); });
      list.appendChild(b);
    };
    // Sign out — the desktop header always has this reachable via #logout-btn;
    // the mobile "more" sheet is the phone equivalent of that header, so it
    // needs the same exit, not just a way further into the app.
    const appendMobileSignOut = () => {
      if (typeof window.msSignOut !== 'function') return;
      const b = mk('<button type="button" class="w-full mt-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition"><svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M18 15l3-3m0 0l-3-3m3 3H9"/></svg><span>Sign out</span></button>');
      b.addEventListener('click', () => { close(); window.msSignOut(); });
      list.appendChild(b);
    };
    if (mktCfg && Array.isArray(mktCfg.navItems) && mktCfg.navItems.length) {
      mktCfg.navItems.forEach(p => {
        const b = mk(`<button type="button" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-bold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition text-left"><span class="w-5 h-5 flex-shrink-0 text-indigo-500">${typeof svgIcon === 'function' ? svgIcon(p.icon || 'dot', 'w-5 h-5') : ''}</span><span class="truncate">${esc(p.label)}</span></button>`);
        b.addEventListener('click', () => {
          close();
          if (p.studioLaunch) { window.openMarketSyncStudio?.(); return; }
          if (typeof deptGo === 'function') deptGo(p.page, p.invmode || '', p.tab || '');
          else switchPage(p.page);
        });
        list.appendChild(b);
      });
      appendMobileSignOut();
      menu.classList.remove('hidden');
      return;
    }
    const restricted = restrictedNavPages();
    if (restricted) {
      let currentSection = null;
      restricted.forEach(p => {
        if (p.section && p.section !== currentSection) {
          currentSection = p.section;
          const secHdr = mk(`<div class="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 pt-2 pb-0.5 px-1">${esc(currentSection)}</div>`);
          list.appendChild(secHdr);
        }
        const b = mk(`<button type="button" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-bold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition text-left"><span class="w-5 h-5 flex-shrink-0 text-indigo-500">${svgIcon(p.icon || 'dot', 'w-5 h-5')}</span><span class="truncate">${esc(p.label)}</span></button>`);
        b.addEventListener('click', () => {
          close();
          if (p.studioLaunch) { if (typeof window.openMarketSyncStudio === 'function') window.openMarketSyncStudio(); return; }
          if (typeof deptGo === 'function') {
            deptGo(p.page, p.invmode, p.tab);
          } else {
            if (p.invmode) __inventoryMode = p.invmode;
            switchPage(p.page);
            if (p.tab && typeof engineTab === 'function') {
              engineTab(p.page, p.tab, true);
            }
          }
        });
        list.appendChild(b);
      });
      appendMobileUpgrade();
      appendMobileSignOut();
      menu.classList.remove('hidden');
      return;
    }
    // Guided-setup progress at the very top of the mobile menu (uses the cached
    // snapshot; hidden once complete) so the "status bar on the nav" shows on phones too.
    (() => {
      const steps = setupStepsFor(profileContext?.role);
      if (!steps.length || !__setupSnap) return;
      const dn = steps.filter(s => setupStepDone(s, __setupSnap)).length, tot = steps.length;
      if (dn >= tot) return;
      const b = mk(`<button class="w-full text-left rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 px-3 py-2.5"><div class="flex items-center justify-between"><span class="inline-flex items-center gap-1.5 text-sm font-black text-indigo-700 dark:text-indigo-300">${svgIcon('rocket', 'w-4 h-4')}Finish setup</span><span class="text-xs font-bold text-indigo-600 dark:text-indigo-400">${dn}/${tot}</span></div><div class="h-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 overflow-hidden mt-1.5"><div class="h-full bg-indigo-600 rounded-full" style="width:${Math.round(dn / tot * 100)}%"></div></div></button>`);
      b.addEventListener('click', () => { close(); openSetupCenter(); });
      list.appendChild(b);
    })();
    // A single tappable destination row (fires the desktop nav item's own click).
    const leafRow = (src, sub) => {
      const label = src.getAttribute('title') || src.querySelector('span:last-child')?.textContent || (src.textContent || '').trim();
      const svg = src.querySelector('svg')?.outerHTML || '';
      const el = mk(`<button type="button" class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left ${sub ? 'pl-4 font-medium' : 'font-semibold'}"><span class="w-5 h-5 flex-shrink-0 opacity-70">${svg}</span><span class="truncate">${esc(label)}</span></button>`);
      el.addEventListener('click', () => { close(); src.click(); });
      return el;
    };

    // Quick actions — header-only destinations that don't live in the sidebar, so
    // admins get Desk a deal + Settings right at the top of the menu.
    const isAdmin = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
    const quick = [];
    if (isAdmin && !simpleCrmActive()) quick.push(['desk', 'Desk a deal']);
    quick.push(['profile', 'Settings']);
    if (quick.length) {
      const wrap = mk('<div class="grid grid-cols-2 gap-1.5"></div>');
      quick.forEach(([page, label]) => {
        const b = mk(`<button type="button" class="px-3 py-2.5 rounded-lg text-sm font-bold text-white ${page === 'desk' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-indigo-600 hover:bg-indigo-500'} transition">${esc(label)}</button>`);
        b.addEventListener('click', () => { close(); switchPage(page); });
        wrap.appendChild(b);
      });
      list.appendChild(wrap);
    }

    // DealerOS department mode (managers/admins, and the SaaS owner back office):
    // the desktop nav is the flat department list, so mirror it EXACTLY — one
    // tappable row per department that opens it (its home page + the dept tab bar),
    // no dropdowns. Sub-pages are reached from the department's own tab bar, just
    // like desktop. Keeps the phone menu dynamic per login.
    if (__deptNavBuilt && __deptRegistry) {
      Object.entries(__deptRegistry).forEach(([id, d]) => {
        if (!deptVisible(d)) return;
        const A = ENGINE_ACCENTS[d.accent] || ENGINE_ACCENTS.indigo;
        const svg = svgIcon(d.icon || 'dot', 'w-5 h-5');
        const b = mk(`<button type="button" class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-bold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition text-left"><span class="w-5 h-5 flex-shrink-0 ${A.text}">${svg}</span><span class="truncate">${esc(d.label)}</span></button>`);
        b.addEventListener('click', () => { close(); if (typeof deptOpen === 'function') deptOpen(id); });
        list.appendChild(b);
      });
      appendMobileUpgrade();
      appendMobileSignOut();
      menu.classList.remove('hidden');
      return;
    }

    const desktop = document.getElementById('nav-desktop');
    if (desktop) {
      [...desktop.children].forEach(node => {
        if (node.classList.contains('nav-group')) {
          if (node.classList.contains('hidden')) return;         // role-hidden group
          const bodyLeaves = [...node.querySelectorAll('.nav-group-body .nav-item')].filter(el => !el.classList.contains('hidden'));
          const headerRow = node.querySelector(':scope > .flex');
          const headerBtn = headerRow ? [...headerRow.querySelectorAll('button')].find(b => !(b.getAttribute('aria-label') || '').startsWith('Toggle')) : null;
          const label = headerBtn?.getAttribute('title') || headerBtn?.querySelector('span')?.textContent || 'Menu';
          const svg = headerBtn?.querySelector('svg')?.outerHTML || '';
          if (!bodyLeaves.length) { if (headerBtn && headerBtn.hasAttribute('data-page')) list.appendChild(leafRow(headerBtn, false)); return; }
          // Collapsible group card — expanded by default so nothing feels hidden.
          const card = mk('<div class="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden"></div>');
          const head = mk(`<button type="button" class="w-full flex items-center justify-between gap-2 px-3 py-2.5 font-bold text-sm text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800"><span class="flex items-center gap-2.5"><span class="w-5 h-5 opacity-80">${svg}</span>${esc(label)}</span><svg class="ms-chev w-4 h-4 transition-transform" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg></button>`);
          const body = mk('<div class="p-1.5 space-y-1"></div>');
          if (headerBtn && headerBtn.hasAttribute('data-page')) body.appendChild(leafRow(headerBtn, true));
          bodyLeaves.forEach(sub => body.appendChild(leafRow(sub, true)));
          head.addEventListener('click', () => { const hid = body.classList.toggle('hidden'); head.querySelector('.ms-chev')?.classList.toggle('-rotate-90', hid); });
          card.appendChild(head); card.appendChild(body);
          list.appendChild(card);
        } else if (node.matches('.nav-item') && !node.classList.contains('hidden')) {
          list.appendChild(leafRow(node, false));
        }
      });
    }
    appendMobileUpgrade();
    appendMobileSignOut();
    menu.classList.remove('hidden');
  });

  document.getElementById('nav-more-close')?.addEventListener('click', close);
  menu.addEventListener('click', (e) => { if (e.target === menu) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.classList.contains('hidden')) close(); });
}

// ── Sales Pipeline (integrated page) ─────────────────────────────────────────
const PL_COLS = [
  { key: 'posted', label: 'Posted', dot: 'bg-blue-500' },
  { key: 'appointment_set', label: 'Appointment Set', dot: 'bg-indigo-500' },
  { key: 'claimed_sale', label: 'Claimed Sales', dot: 'bg-emerald-500' },
  { key: 'need_relisting', label: 'Need Relisting', dot: 'bg-amber-500' },
];
const PL_MOVE_LABEL = { posted: 'Posted', appointment_set: 'Appointment Set', claimed_sale: 'Mark Sold', need_relisting: 'Need Relisting' };
let PL_DATA = { columns: {}, counts: {} };
// Cards the user has collapsed (kept across re-renders so a move/refresh doesn't
// re-expand everything). Board-wide collapse toggles every card at once.
const PL_COLLAPSED = new Set();
// Whether we've applied the default "all collapsed" state on first render yet.
let PL_COLLAPSED_INITED = false;
const plMoney = (n) => n != null ? '$' + Number(n).toLocaleString() : '';
const plKm = (n) => n != null ? Number(n).toLocaleString() + ' km' : '';
const plPosted = (d) => { try { const days = Math.floor((Date.now() - new Date(d)) / 86400000); return days <= 0 ? 'today' : days + 'd ago'; } catch { return ''; } };
const plAppt = (d) => { try { return new Date(d).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch { return ''; } };

function plAskAppointment(label, existingAt, existingNote) {
  return new Promise(resolve => {
    const modal = document.getElementById('appt-modal');
    const dt = document.getElementById('appt-dt'), note = document.getElementById('appt-note'), err = document.getElementById('appt-err');
    document.getElementById('appt-veh').textContent = label || '';
    err.classList.add('hidden');
    const base = existingAt ? new Date(existingAt) : new Date(Date.now() + 3600000);
    dt.value = new Date(base.getTime() - base.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    note.value = existingNote || '';
    modal.classList.remove('hidden');
    const close = (val) => { modal.classList.add('hidden'); document.getElementById('appt-save').onclick = null; document.getElementById('appt-cancel').onclick = null; resolve(val); };
    document.getElementById('appt-cancel').onclick = () => close(null);
    document.getElementById('appt-save').onclick = () => {
      if (!dt.value) { err.textContent = 'Pick a date and time.'; err.classList.remove('hidden'); return; }
      close({ at: new Date(dt.value).toISOString(), note: note.value.trim() });
    };
  });
}

function plCard(c) {
  const others = PL_COLS.map(x => x.key).filter(k => k !== c.stage);
  const opts = others.map(k => `<option value="${k}">${PL_MOVE_LABEL[k]}</option>`).join('');
  const rep = c.rep ? ` · ${esc(c.rep)}` : '';
  const sub = [c.trim, c.exterior_color].filter(Boolean).join(' · ');
  const meta = [c.stocknumber ? '#' + esc(c.stocknumber) : '', c.mileage ? plKm(c.mileage) : ''].filter(Boolean).join(' · ');
  const thumb = c.image
    ? `<img src="${esc(c.image)}" alt="" loading="lazy" class="w-full h-24 object-cover rounded-md bg-slate-100 dark:bg-slate-800">`
    : `<div class="w-full h-24 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300">${msIco('car', 'w-7 h-7')}</div>`;
  const postedTag = `<span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">Posted</span>`;
  const collapsed = PL_COLLAPSED.has(c.id);
  const chevron = `<button data-collapse="${c.id}" class="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-0.5" title="${collapsed ? 'Expand' : 'Collapse'}"><svg class="w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-90'}" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg></button>`;
  return `
    <div class="pl-card group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 cursor-grab active:cursor-grabbing" draggable="true" data-card-id="${c.id}" data-card-label="${esc(c.label)}" data-card-stage="${c.stage}">
      <div class="flex items-start gap-1.5">
        ${chevron}
        <div class="min-w-0 flex-1">
          <div class="text-sm font-bold text-slate-900 dark:text-white leading-snug truncate">${esc(c.label)}</div>
          ${collapsed && c.price ? `<div class="text-xs font-black text-slate-700 dark:text-slate-200 mt-0.5">${plMoney(c.price)}</div>` : ''}
        </div>
      </div>
      <div class="pl-body ${collapsed ? 'hidden' : ''}">
      ${thumb}
      <div class="mt-2 min-w-0">
        ${sub ? `<div class="text-[11px] text-slate-500 dark:text-slate-400 truncate">${esc(sub)}</div>` : ''}
      </div>
      <div class="flex items-center justify-between gap-2 mt-1.5">
        ${postedTag}
        ${c.price ? `<span class="text-sm font-black text-slate-900 dark:text-white">${plMoney(c.price)}</span>` : ''}
      </div>
      ${meta ? `<div class="text-[11px] text-slate-400 mt-1">${meta}</div>` : ''}
      <div class="text-[11px] text-slate-400 mt-0.5">${c.posted_at ? 'Posted ' + plPosted(c.posted_at) : ''}${rep}</div>
      ${c.stage === 'appointment_set' && c.appointment_at ? `
        <div class="mt-2 flex items-center justify-between gap-2 text-xs bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded px-2 py-1.5">
          <span class="inline-flex items-center gap-1.5 font-semibold text-indigo-700 dark:text-indigo-300">${msIco('calendar', 'w-3.5 h-3.5')} ${esc(plAppt(c.appointment_at))}</span>
          <button data-appt-edit="${c.id}" data-label="${esc(c.label)}" data-at="${esc(c.appointment_at)}" data-note="${esc(c.appointment_note || '')}" class="text-indigo-500 hover:text-indigo-400 font-bold">Edit</button>
        </div>${c.appointment_note ? `<div class="text-[11px] text-slate-400 mt-1">${esc(c.appointment_note)}</div>` : ''}` : ''}
      ${c.stage === 'need_relisting' ? `<button data-relist="${c.id}" class="mt-2 w-full text-xs font-bold bg-amber-500 hover:bg-amber-400 text-white rounded px-2 py-1.5 transition">↻ Relist on Facebook</button>` : ''}
      ${(c.fb_listing_url || c.source_url) ? `
        <div class="mt-2 grid ${c.fb_listing_url && c.source_url ? 'grid-cols-2' : 'grid-cols-1'} gap-1.5">
          ${c.fb_listing_url ? `<a href="${esc(c.fb_listing_url)}" target="_blank" rel="noopener" class="text-center text-xs font-bold px-2 py-1.5 rounded bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2]/20 transition">Facebook ↗</a>` : ''}
          ${c.source_url ? `<a href="${esc(c.source_url)}" target="_blank" rel="noopener" class="text-center text-xs font-bold px-2 py-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition">Listing ↗</a>` : ''}
        </div>` : ''}
      <select data-move="${c.id}" class="mt-2 w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-600 dark:text-slate-300">
        <option value="">Move to…</option>${opts}
      </select>
      </div>
    </div>`;
}

async function plMoveCard(id, stage, label) {
  const body = { stage };
  if (stage === 'appointment_set') {
    const appt = await plAskAppointment(label, null, null);
    if (!appt) return false;
    body.appointment_at = appt.at; body.appointment_note = appt.note;
  }
  const r = await fetch(`${API}/pipeline/${id}`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error((await r.json()).error || 'Failed');
  return true;
}

function plRender() {
  const root = document.getElementById('pipeline-root');
  if (!root) return;
  const allCardIds = Object.values(PL_DATA.columns || {}).flat().map(c => c.id);
  // Start every card collapsed on first load — the user opens the ones they want.
  // Only done once so a later move/refresh doesn't re-collapse cards they opened.
  if (!PL_COLLAPSED_INITED && allCardIds.length > 0) {
    allCardIds.forEach(id => PL_COLLAPSED.add(id));
    PL_COLLAPSED_INITED = true;
  }
  const allCollapsed = allCardIds.length > 0 && allCardIds.every(id => PL_COLLAPSED.has(id));
  const cols = PL_COLS.map(col => {
    const cards = (PL_DATA.columns[col.key] || []);
    const bodyHtml = cards.length ? cards.map(plCard).join('') : '<div class="text-xs text-slate-400 italic py-6 text-center">Nothing here</div>';
    return `
      <div class="flex flex-col min-w-0">
        <div class="flex items-center justify-between mb-3 px-1">
          <div class="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200"><span class="w-2 h-2 rounded-full ${col.dot}"></span>${col.label}</div>
          <span class="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-full px-2 py-0.5">${PL_DATA.counts[col.key] || 0}</span>
        </div>
        <div class="pl-dropzone space-y-2.5 flex-1 rounded-lg p-1 -m-1 transition" data-col="${col.key}">${bodyHtml}</div>
      </div>`;
  }).join('');

  root.innerHTML = `
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">Sales Pipeline</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">${PL_DATA.can_manage_all ? 'Every posting across your store' : 'Your postings'} — move each one as the deal progresses.</p>
      </div>
      <div class="flex items-center gap-2">
        <button id="pl-collapse-all" class="text-sm font-bold px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition">${allCollapsed ? 'Expand all' : 'Collapse all'}</button>
        <button id="pl-refresh" class="text-sm font-bold px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Refresh</button>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">${cols}</div>`;

  document.getElementById('pl-refresh').addEventListener('click', loadPipelinePage);
  // Collapse / expand toggles (kept client-side; no reload needed).
  root.querySelectorAll('[data-collapse]').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = btn.dataset.collapse;
    if (PL_COLLAPSED.has(id)) PL_COLLAPSED.delete(id); else PL_COLLAPSED.add(id);
    plRender();
  }));
  document.getElementById('pl-collapse-all').addEventListener('click', () => {
    const allIds = Object.values(PL_DATA.columns || {}).flat().map(c => c.id);
    if (allIds.every(id => PL_COLLAPSED.has(id))) allIds.forEach(id => PL_COLLAPSED.delete(id));
    else allIds.forEach(id => PL_COLLAPSED.add(id));
    plRender();
  });
  root.querySelectorAll('[data-relist]').forEach(btn => btn.addEventListener('click', async () => {
    btn.disabled = true; btn.textContent = 'Relisting…';
    try {
      const r = await fetch(`${API}/pipeline/${btn.dataset.relist}/relist`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Failed');
      // Drive the extension to re-post with a fully auto-filled listing (guardrail,
      // AI copy, branded photos). Falls back to opening Facebook when it's not detected.
      if (data.inventory_id) msPostVehicle(data.inventory_id);
      else window.open('https://www.facebook.com/marketplace/create/vehicle', '_blank', 'noopener');
      loadPipelinePage();
    } catch (e) { alert(e.message); btn.disabled = false; btn.textContent = '↻ Relist on Facebook'; }
  }));
  root.querySelectorAll('[data-appt-edit]').forEach(btn => btn.addEventListener('click', async () => {
    const appt = await plAskAppointment(btn.dataset.label, btn.dataset.at, btn.dataset.note);
    if (!appt) return;
    try {
      const r = await fetch(`${API}/pipeline/${btn.dataset.apptEdit}`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: 'appointment_set', appointment_at: appt.at, appointment_note: appt.note }) });
      if (!r.ok) throw new Error((await r.json()).error || 'Failed');
      loadPipelinePage();
    } catch (e) { alert(e.message); }
  }));
  root.querySelectorAll('[data-move]').forEach(sel => sel.addEventListener('change', async () => {
    const stage = sel.value; if (!stage) return;
    const label = sel.closest('[data-card-label]')?.dataset.cardLabel;
    sel.disabled = true;
    try { const ok = await plMoveCard(sel.dataset.move, stage, label); if (ok) loadPipelinePage(); else { sel.disabled = false; sel.value = ''; } }
    catch (e) { alert(e.message); sel.disabled = false; sel.value = ''; }
  }));

  let dragId = null, dragStage = null, dragLabel = null;
  root.querySelectorAll('.pl-card').forEach(el => {
    el.addEventListener('dragstart', e => { dragId = el.dataset.cardId; dragStage = el.dataset.cardStage; dragLabel = el.dataset.cardLabel; el.classList.add('opacity-40'); e.dataTransfer.effectAllowed = 'move'; });
    el.addEventListener('dragend', () => el.classList.remove('opacity-40'));
  });
  root.querySelectorAll('.pl-dropzone').forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('bg-indigo-50', 'dark:bg-indigo-950/30'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('bg-indigo-50', 'dark:bg-indigo-950/30'));
    zone.addEventListener('drop', async e => {
      e.preventDefault(); zone.classList.remove('bg-indigo-50', 'dark:bg-indigo-950/30');
      const target = zone.dataset.col;
      if (!dragId || target === dragStage) return;
      try { const ok = await plMoveCard(dragId, target, dragLabel); if (ok) loadPipelinePage(); } catch (err) { alert(err.message); }
    });
  });
}

async function loadPipelinePage() {
  const root = document.getElementById('pipeline-root');
  if (!root) return;
  if (typeof setupExtensionBridge === 'function') setupExtensionBridge();  // so Relist can detect the extension
  root.innerHTML = `<div class="py-16 text-center text-sm text-slate-400 italic">Loading pipeline…</div>`;
  try {
    PL_DATA = await apiGetJson('/pipeline', { onRetry: (n, total) => {
      root.innerHTML = `<div class="py-16 text-center text-sm text-slate-400 italic">Still loading… retrying (${n}/${total})</div>`;
    }});
    plRender();
  } catch (e) {
    root.innerHTML = `<div class="py-16 text-center text-sm text-slate-500">Couldn't load the pipeline: ${esc(e.message)}<br><button onclick="loadPipelinePage()" class="mt-3 text-indigo-500 hover:text-indigo-400 font-bold">Retry</button></div>`;
  }
  // Leads live on the same page now — load them alongside the board.
  if (document.getElementById('leads-root')) loadLeadsPage();
}

// ── Appointments — month calendar with clickable detail modal ────────────────
let __apptData = [];            // all appointments from the API
let __apptCanManageAll = false;
let __apptMonth = new Date();   // the month currently displayed (day ignored)
let __apptView = 'calendar';    // 'calendar' | 'list'
function renderAppts() { if (__apptView === 'list') renderApptListView(); else renderApptCalendar(); }
function apptSetView(v) { __apptView = v; renderAppts(); }
window.apptSetView = apptSetView;
// A Calendar / List segmented toggle shared by the appointment views.
function apptViewToggle() {
  const b = (v, label) => `<button onclick="apptSetView('${v}')" class="text-xs font-bold px-3 h-8 rounded-lg border transition ${__apptView === v ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'}">${label}</button>`;
  return `<div class="inline-flex gap-1">${b('calendar', 'Calendar')}${b('list', 'List')}</div>`;
}
// List view of appointments (upcoming first, then past), clickable for detail.
function renderApptListView() {
  const root = document.getElementById('appointments-root'); if (!root) return;
  const sorted = __apptData.slice().sort((a, b) => new Date(a.appointment_at) - new Date(b.appointment_at));
  const upcoming = sorted.filter(a => !a.past);
  const past = sorted.filter(a => a.past).reverse();
  const row = (a, idx) => {
    const dt = new Date(a.appointment_at);
    return `<button data-appt-idx="${idx}" class="w-full text-left flex items-center gap-3 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
      <div class="w-14 flex-shrink-0 text-center"><div class="text-[11px] font-bold uppercase text-slate-400">${dt.toLocaleString(undefined, { month: 'short' })}</div><div class="text-lg font-black leading-none ${a.past ? 'text-slate-400' : 'text-indigo-600 dark:text-indigo-400'}">${dt.getDate()}</div></div>
      <div class="min-w-0 flex-1"><div class="font-semibold text-slate-900 dark:text-white truncate">${esc(a.label || 'Appointment')}</div><div class="text-xs text-slate-500 dark:text-slate-400">${dt.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}${a.customer_name ? ' · ' + esc(a.customer_name) : ''}${a.rep_name && __apptCanManageAll ? ' · ' + esc(a.rep_name) : ''}</div></div>
      ${a.past ? '<span class="text-[10px] text-slate-400">past</span>' : ''}
    </button>`;
  };
  const section = (title, arr, offset) => arr.length ? `<div class="text-[11px] font-black uppercase tracking-wider text-slate-400 px-3 pt-3 pb-1">${title}</div>${arr.map((a, i) => row(a, __apptData.indexOf(a))).join('')}` : '';
  root.innerHTML = `
    <div class="mb-4 flex items-center justify-between flex-wrap gap-3">
      <div><h2 class="text-xl font-bold text-slate-900 dark:text-white">Appointments</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">${__apptCanManageAll ? 'Every appointment your reps have booked' : 'Your booked appointments'}.</p></div>
      <div class="flex items-center gap-1.5">${apptViewToggle()}<button id="appt-add" class="inline-flex items-center gap-1.5 text-xs font-bold px-3 h-8 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition">＋ Add appointment</button></div>
    </div>
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      ${upcoming.length || past.length ? section('Upcoming', upcoming) + section('Past', past) : '<div class="py-10 text-center text-sm text-slate-400 italic">No appointments yet.</div>'}
    </div>`;
  document.getElementById('appt-add')?.addEventListener('click', () => apptAddForm(null));
  root.querySelectorAll('[data-appt-idx]').forEach(btn => btn.addEventListener('click', () => openApptDetail(__apptData[Number(btn.dataset.apptIdx)])));
}
const __apptDayKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };

async function loadAppointmentsPage() {
  const root = document.getElementById('appointments-root');
  if (!root) return;
  root.innerHTML = `<div class="py-16 text-center text-sm text-slate-400 italic">Loading appointments…</div>`;
  let data;
  try {
    data = await apiGetJson('/appointments', { onRetry: (n, total) => {
      root.innerHTML = `<div class="py-16 text-center text-sm text-slate-400 italic">Still loading… retrying (${n}/${total})</div>`;
    }});
  } catch (e) {
    root.innerHTML = `<div class="py-16 text-center text-sm text-slate-500">Couldn't load appointments: ${esc(e.message)}<br><button onclick="loadAppointmentsPage()" class="mt-3 text-indigo-500 hover:text-indigo-400 font-bold">Retry</button></div>`;
    return;
  }
  __apptData = data.appointments || [];
  __apptCanManageAll = !!data.can_manage_all;
  // Jump to the month of the soonest upcoming appointment on first load.
  const nextUp = __apptData.find(a => !a.past) || __apptData[0];
  __apptMonth = nextUp ? new Date(nextUp.appointment_at) : new Date();
  renderAppts();
}

function renderApptCalendar() {
  const root = document.getElementById('appointments-root');
  if (!root) return;

  // Group appointments by local day-key.
  const byDay = {};
  __apptData.forEach((a, idx) => {
    const k = __apptDayKey(a.appointment_at);
    (byDay[k] = byDay[k] || []).push({ ...a, _idx: idx });
  });

  const view = new Date(__apptMonth.getFullYear(), __apptMonth.getMonth(), 1);
  const monthName = view.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  const firstDow = view.getDay();                         // 0=Sun
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const todayKey = __apptDayKey(new Date());

  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push('<div class="bg-slate-50/60 dark:bg-slate-900/40 min-h-[92px]"></div>');
  for (let day = 1; day <= daysInMonth; day++) {
    const k = `${view.getFullYear()}-${view.getMonth()}-${day}`;
    const items = (byDay[k] || []).sort((a, b) => new Date(a.appointment_at) - new Date(b.appointment_at));
    const isToday = k === todayKey;
    const chips = items.slice(0, 3).map(a => {
      const t = new Date(a.appointment_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      const cls = a.past
        ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
        : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900';
      return `<button data-appt-idx="${a._idx}" class="w-full text-left truncate text-[10px] font-semibold px-1.5 py-1 rounded ${cls} transition" title="${esc(t + ' · ' + a.label)}">${esc(t)} ${esc(a.label)}</button>`;
    }).join('');
    const more = items.length > 3 ? `<div class="text-[10px] text-slate-400 px-1.5">+${items.length - 3} more</div>` : '';
    cells.push(`
      <div class="group bg-white dark:bg-slate-900 min-h-[92px] p-1.5 flex flex-col gap-1 ${isToday ? 'ring-2 ring-inset ring-indigo-400' : ''}">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-bold ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}">${day}</span>
          <button data-add-day="${k}" title="Add appointment" class="opacity-0 group-hover:opacity-100 transition text-violet-500 hover:text-violet-600 leading-none text-sm font-black">＋</button>
        </div>
        ${chips}${more}
      </div>`);
  }
  // Pad the final week so the grid stays rectangular.
  while (cells.length % 7 !== 0) cells.push('<div class="bg-slate-50/60 dark:bg-slate-900/40 min-h-[92px]"></div>');

  root.innerHTML = `
    <div class="mb-4 flex items-center justify-between flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">Appointments</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">${__apptCanManageAll ? 'Every appointment your reps have booked' : 'Your booked appointments'} — tap one for details.</p>
      </div>
      <div class="flex items-center gap-1.5 flex-wrap">
        ${apptViewToggle()}
        <button id="appt-prev" class="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Previous month"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg></button>
        <div class="text-sm font-bold text-slate-800 dark:text-slate-200 min-w-[140px] text-center">${monthName}</div>
        <button id="appt-next" class="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Next month"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg></button>
        <button id="appt-today" class="text-xs font-bold px-3 h-8 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Today</button>
        <button id="appt-add" class="inline-flex items-center gap-1.5 text-xs font-bold px-3 h-8 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition">＋ Add appointment</button>
      </div>
    </div>
    <div class="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
      ${dow.map(d => `<div class="bg-slate-50 dark:bg-slate-950 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 py-2">${d}</div>`).join('')}
      ${cells.join('')}
    </div>
    ${__apptData.length === 0 ? `<div class="py-10 text-center text-sm text-slate-400 italic">No appointments yet. Hit <b>＋ Add appointment</b>, hover a day for a quick “＋”, or book one from a customer or the pipeline.</div>` : ''}`;

  document.getElementById('appt-prev')?.addEventListener('click', () => { __apptMonth = new Date(view.getFullYear(), view.getMonth() - 1, 1); renderApptCalendar(); });
  document.getElementById('appt-next')?.addEventListener('click', () => { __apptMonth = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderApptCalendar(); });
  document.getElementById('appt-today')?.addEventListener('click', () => { __apptMonth = new Date(); renderApptCalendar(); });
  document.getElementById('appt-add')?.addEventListener('click', () => apptAddForm(null));
  root.querySelectorAll('[data-add-day]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); apptAddForm(btn.dataset.addDay); });
  });
  root.querySelectorAll('[data-appt-idx]').forEach(btn => {
    btn.addEventListener('click', () => openApptDetail(__apptData[Number(btn.dataset.apptIdx)]));
  });
}

// ── Add an appointment straight from the calendar (any customer + date/time) ──
let __apptPickedContact = null;   // { id, name } chosen in the add form
let __apptSearchTimer = null;
function apptAddForm(dayKey) {
  __apptPickedContact = null;
  // dayKey is "YYYY-M-D" (month 0-based) from a day cell, else default to today.
  let def = new Date(Date.now() + 3600000);
  if (dayKey) { const [y, m, d] = dayKey.split('-').map(Number); def = new Date(y, m, d, def.getHours(), 0); }
  const defDate = `${def.getFullYear()}-${String(def.getMonth() + 1).padStart(2, '0')}-${String(def.getDate()).padStart(2, '0')}`;
  const defTime = def.toTimeString().slice(0, 5);
  const iCls = 'w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm';
  crmOverlay(`<div class="p-5 space-y-3">
    <div class="flex items-center justify-between">
      <div class="text-lg font-black text-slate-900 dark:text-white">Add appointment</div>
      <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <div>
      <label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Customer</label>
      <input id="appt-cust-search" placeholder="Search your customers by name, phone or email" autocomplete="off" class="${iCls}">
      <div id="appt-cust-results" class="hidden mt-1 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden max-h-52 overflow-y-auto"></div>
      <div id="appt-cust-picked" class="hidden mt-1.5 text-sm font-bold text-violet-600 dark:text-violet-400"></div>
    </div>
    <div><label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Title</label><input id="appt-title" value="Appointment" class="${iCls}"></div>
    <div class="grid grid-cols-3 gap-2">
      <div><label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Date</label><input id="appt-date" type="date" value="${defDate}" class="${iCls}"></div>
      <div><label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Time</label><input id="appt-time" type="time" value="${defTime}" class="${iCls}"></div>
      <div><label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Length</label><select id="appt-dur" class="${iCls}"><option value="30">30 min</option><option value="60" selected>1 hr</option><option value="90">1.5 hr</option></select></div>
    </div>
    <div class="flex justify-end gap-2 pt-1">
      <button onclick="this.closest('.fixed').remove()" class="text-sm font-bold text-slate-500 px-4 py-2">Cancel</button>
      <button id="appt-save-btn" onclick="apptSaveNew(this)" class="text-sm font-bold bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg">Add appointment</button>
    </div>
  </div>`, 'max-w-md');
  const s = document.getElementById('appt-cust-search');
  s?.addEventListener('input', () => { clearTimeout(__apptSearchTimer); __apptSearchTimer = setTimeout(() => apptCustSearch(s.value.trim()), 220); });
}
async function apptCustSearch(q) {
  const box = document.getElementById('appt-cust-results');
  if (!box || q.length < 2) { if (box) box.classList.add('hidden'); return; }
  try {
    const d = await apiGetJson(`/crm/contacts?q=${encodeURIComponent(q)}&limit=12`, { retries: 1 });
    const rows = d?.contacts || [];
    if (!rows.length) { box.innerHTML = '<div class="px-3 py-2 text-xs text-slate-400 italic">No matches.</div>'; box.classList.remove('hidden'); return; }
    box.innerHTML = rows.map(c => `<button type="button" onclick="apptPickContact('${c.id}','${esc((c.full_name || 'Customer').replace(/'/g, ' '))}')" class="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div class="text-sm font-bold text-slate-900 dark:text-white">${esc(c.full_name || 'Customer')}</div>
      <div class="text-xs text-slate-500 dark:text-slate-400">${esc([c.email, c.phone].filter(Boolean).join(' · ') || '')}</div></button>`).join('');
    box.classList.remove('hidden');
  } catch { box.classList.add('hidden'); }
}
function apptPickContact(id, name) {
  __apptPickedContact = { id, name };
  document.getElementById('appt-cust-results')?.classList.add('hidden');
  const s = document.getElementById('appt-cust-search'); if (s) s.value = name;
  const p = document.getElementById('appt-cust-picked'); if (p) { p.textContent = ' ' + name; p.classList.remove('hidden'); }
}
async function apptSaveNew(btn) {
  if (!__apptPickedContact) { showToast('Pick a customer first', 'error'); return; }
  const title = document.getElementById('appt-title')?.value.trim() || 'Appointment';
  const date = document.getElementById('appt-date')?.value;
  const time = document.getElementById('appt-time')?.value || '09:00';
  if (!date) { showToast('Pick a date', 'error'); return; }
  const startIso = new Date(`${date}T${time}`).toISOString();
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Adding…';
  try {
    await apiSendJson('/crm/tasks', 'POST', { contact_id: __apptPickedContact.id, title, type: 'appointment', due_at: startIso });
    await apiSendJson(`/crm/contacts/${__apptPickedContact.id}`, 'PUT', { status: 'appointment' });
    showToast('Appointment added', 'success');
    btn.closest('.fixed')?.remove();
    loadAppointmentsPage();
  } catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message || 'Could not add appointment', 'error'); }
}
window.apptAddForm = apptAddForm; window.apptCustSearch = apptCustSearch; window.apptPickContact = apptPickContact; window.apptSaveNew = apptSaveNew;

function openApptDetail(a) {
  if (!a) return;
  let modal = document.getElementById('appt-detail-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'appt-detail-modal';
    modal.className = 'fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-y-auto';
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
  }
  modal.classList.remove('hidden');

  const money = n => n != null ? '$' + Number(n).toLocaleString() : null;
  // Appointments booked as CRM tasks carry an id like "task:<uuid>" — those can be
  // rescheduled / cancelled here; pipeline appointments are managed on the pipeline.
  const isTaskAppt = typeof a.id === 'string' && a.id.startsWith('task:');
  const taskId = isTaskAppt ? a.id.slice(5) : '';
  const when = new Date(a.appointment_at).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const specs = [
    a.trim ? esc(a.trim) : null,
    a.exterior_color ? esc(a.exterior_color) : null,
    a.mileage != null ? Number(a.mileage).toLocaleString() + ' km' : null,
    a.condition ? esc(a.condition) : null,
  ].filter(Boolean).join(' · ');

  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md mt-12 mb-12 overflow-hidden shadow-2xl">
      <div class="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
        <div class="text-[10px] font-bold uppercase tracking-wider text-indigo-500 flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M3 9.5h18M8 3v3m8-3v3"/></svg>
          Appointment ${a.past ? '· Past' : ''}
        </div>
        <button id="appt-detail-close" class="text-slate-400 hover:text-slate-700 dark:hover:text-white text-2xl leading-none">&times;</button>
      </div>

      <!-- Car card -->
      ${a.image ? `<img src="${esc(a.image)}" alt="" class="w-full h-44 object-cover bg-slate-100 dark:bg-slate-800">` : ''}
      <div class="p-5 space-y-4">
        <div>
          <div class="text-lg font-black text-slate-900 dark:text-white">${esc(a.label)}</div>
          ${specs ? `<div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${specs}</div>` : ''}
          <div class="flex items-center gap-3 mt-2">
            ${money(a.price) ? `<span class="text-lg font-black text-slate-900 dark:text-white">${money(a.price)}</span>` : ''}
            ${a.stocknumber ? `<span class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">#${esc(a.stocknumber)}</span>` : ''}
          </div>
        </div>

        <!-- Appointment details -->
        <div class="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3.5 space-y-2">
          <div class="flex items-start gap-2">
            <svg class="w-4 h-4 mt-0.5 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2"/><circle cx="12" cy="12" r="9"/></svg>
            <div class="text-sm font-semibold text-slate-900 dark:text-white">${esc(when)}</div>
          </div>
          ${a.rep ? `<div class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><svg class="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0"/></svg>Rep: ${esc(a.rep)}</div>` : ''}
        </div>

        <!-- Add to calendar (Google / Outlook / .ics) -->
        ${(() => {
          const { g, o, ics } = crmCalLinks(a.label ? `Appointment — ${a.label}` : 'Appointment', a.appointment_at, 60, a.appointment_note || specs || 'Booked via MarketSync');
          const b = 'inline-flex items-center gap-1.5 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-1.5 rounded-lg';
          return `<div>
            <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Add to calendar</div>
            <div class="flex flex-wrap gap-2">
              <a href="${g}" target="_blank" rel="noopener" class="${b}">${msIco('calendar','w-3.5 h-3.5')} Google</a>
              <a href="${o}" target="_blank" rel="noopener" class="${b}">${msIco('calendar','w-3.5 h-3.5')} Outlook</a>
              <a href="${ics}" download="appointment.ics" class="${b}">${msIco('download','w-3.5 h-3.5')} .ics</a>
            </div>
          </div>`;
        })()}

        <!-- Person / buyer info (from the rep's note) -->
        <div>
          <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Buyer / Notes</div>
          <div id="appt-notes-view" class="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">${a.appointment_note ? esc(a.appointment_note) : '<span class="text-slate-400 italic">No buyer details were added.</span>'}</div>
          ${a.contact_id ? `<div class="mt-2 flex gap-2">
            <input id="appt-note-input" placeholder="Add a note…" class="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm">
            <button onclick="apptAddNote('${a.contact_id}')" class="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-700">Add note</button>
          </div>` : ''}
        </div>

        <div class="flex flex-wrap gap-2 pt-1">
          ${a.contact_id ? `<button onclick="document.getElementById('appt-detail-modal').classList.add('hidden'); switchPage('crm'); openCrmContact('${a.contact_id}')" class="text-xs font-bold px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition">View customer →</button>` : ''}
          ${isTaskAppt ? `<button onclick="apptRescheduleForm('${esc(taskId)}','${a.appointment_at}')" class="text-xs font-bold px-3 py-2 rounded-lg bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 hover:bg-violet-200 transition">Reschedule</button>
          <button onclick="apptCancel('${esc(taskId)}')" class="text-xs font-bold px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition">Cancel</button>` : ''}
          ${a.fb_listing_url ? `<a href="${esc(a.fb_listing_url)}" target="_blank" rel="noopener" class="text-xs font-bold px-3 py-2 rounded-lg bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2]/20 transition">View on Facebook ↗</a>` : ''}
          ${a.source_url ? `<a href="${esc(a.source_url)}" target="_blank" rel="noopener" class="text-xs font-bold px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Vehicle page ↗</a>` : ''}
        </div>
        <div id="appt-reschedule-slot"></div>
      </div>
    </div>`;
  document.getElementById('appt-detail-close')?.addEventListener('click', () => modal.classList.add('hidden'));
}
// Add a note to the appointment's customer — posts to the CRM timeline and shows
// it inline without closing the modal.
async function apptAddNote(contactId) {
  const inp = document.getElementById('appt-note-input');
  const body = (inp?.value || '').trim();
  if (!body) { showToast('Type a note first', 'error'); return; }
  try {
    await apiSendJson(`/crm/contacts/${contactId}/log`, 'POST', { channel: 'note', direction: 'internal', subject: 'Appointment note', body });
    const view = document.getElementById('appt-notes-view');
    if (view) { const p = document.createElement('div'); p.className = 'mt-1'; p.textContent = body; if (view.querySelector('.italic')) view.innerHTML = ''; view.appendChild(p); }
    if (inp) inp.value = '';
    showToast('Note added', 'success');
  } catch (e) { showToast(e.message || 'Could not add note', 'error'); }
}
window.apptAddNote = apptAddNote;
// Reschedule / cancel apply to appointments booked as CRM tasks (id "task:<id>").
// Pipeline appointments are managed from the pipeline board.
function apptRescheduleForm(taskId, currentIso) {
  const slot = document.getElementById('appt-reschedule-slot'); if (!slot) return;
  const d = currentIso ? new Date(currentIso) : new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const time = d.toTimeString().slice(0, 5);
  const iCls = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm';
  slot.innerHTML = `<div class="mt-3 bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-900 rounded-lg p-3 flex items-end gap-2 flex-wrap">
    <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Date</label><input id="appt-re-date" type="date" value="${date}" class="${iCls}"></div>
    <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Time</label><input id="appt-re-time" type="time" value="${time}" class="${iCls}"></div>
    <button onclick="apptReschedule('${esc(taskId)}',this)" class="text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white px-3 py-2 rounded-lg">Save</button>
  </div>`;
}
async function apptReschedule(taskId, btn) {
  const date = document.getElementById('appt-re-date')?.value;
  const time = document.getElementById('appt-re-time')?.value || '09:00';
  if (!date) { showToast('Pick a date', 'error'); return; }
  const iso = new Date(`${date}T${time}`).toISOString();
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await apiSendJson(`/crm/tasks/${taskId}`, 'PUT', { due_at: iso });
    showToast('Appointment rescheduled', 'success');
    document.getElementById('appt-detail-modal')?.classList.add('hidden');
    loadAppointmentsPage();
  } catch (e) { btn.disabled = false; btn.textContent = 'Save'; showToast(e.message || 'Could not reschedule', 'error'); }
}
async function apptCancel(taskId) {
  if (!confirm('Cancel this appointment? It will be removed from the calendar.')) return;
  try {
    // Mark done + retype so it drops off the appointment calendar without deleting the record.
    await apiSendJson(`/crm/tasks/${taskId}`, 'PUT', { done: true, type: 'other' });
    showToast('Appointment cancelled', 'success');
    document.getElementById('appt-detail-modal')?.classList.add('hidden');
    loadAppointmentsPage();
  } catch (e) { showToast(e.message || 'Could not cancel', 'error'); }
}
window.apptRescheduleForm = apptRescheduleForm; window.apptReschedule = apptReschedule; window.apptCancel = apptCancel;

// Idempotent restore: makes sure leaderboard / team-insights / sales-team panels live
// in their own page wrappers. (Older code mirrored them into Insights as an overview,
// which made the admin dashboard look cluttered. We now rely on sidebar nav instead.)
function ensurePanelsInOriginalLocations() {
  // Workspace tabs borrow real page panels (engMountPage). switchPage() calls this on
  // every navigation, so this is where a borrowed page goes home — otherwise opening
  // that page directly would find it parked inside a hidden workspace and show blank.
  if (typeof engRestoreMountedPages === 'function') engRestoreMountedPages();

  const lb = document.getElementById('leaderboard-panel');
  const ti = document.getElementById('team-insights-panel');
  const st = document.getElementById('dealer-view-panel');
  const pc = document.getElementById('profile-card');

  // The Team+Global leaderboard lives on its own 'leaderboard' page for everyone —
  // the Marketing tab (DealerOS) and the home for the Facebook / fb-only tiers. Keeping
  // it in that one container means it loads wherever the nav points at 'leaderboard'.
  const lbWrap = document.querySelector('[data-page-content="leaderboard"]') || document.getElementById('dash-leaderboard-slot');
  const tiWrap = document.querySelector('[data-page-content="team-insights"]');
  const stWrap = document.querySelector('[data-page-content="sales-team"]');
  const pcWrap = document.querySelector('[data-page-content="profile"]');

  if (lb && lbWrap && lb.parentElement !== lbWrap) lbWrap.appendChild(lb);
  if (ti && tiWrap && ti.parentElement !== tiWrap) tiWrap.appendChild(ti);
  if (st && stWrap && st.parentElement !== stWrap) stWrap.appendChild(st);
  // Profile card is authored in the sidebar; move it into the profile page + reveal.
  if (pc && pcWrap && pc.parentElement !== pcWrap) { pcWrap.appendChild(pc); pc.classList.remove('hidden'); }
}

async function fetchMetrics(path) {
  const r = await fetch(`${API}${path}`, { headers: { 'Authorization': `Bearer ${token}` } });
  return r.ok ? r.json() : [];
}

// Shared insights range — persists in localStorage so the user's choice survives reload
// and applies to every page that shows insight data (Insights + Team Insights).
let insightsRange = localStorage.getItem('insightsRange') || 'lifetime';

// Sync all .range-pill buttons (across every range-toggle on the page) to the current range
function syncRangePillsUI() {
  document.querySelectorAll('.range-pill').forEach(p => {
    const active = p.dataset.range === insightsRange;
    p.classList.toggle('bg-white', active);
    p.classList.toggle('dark:bg-slate-800', active);
    p.classList.toggle('text-indigo-600', active);
    p.classList.toggle('dark:text-indigo-400', active);
    p.classList.toggle('text-slate-600', !active);
    p.classList.toggle('dark:text-slate-300', !active);
  });
}
function syncRangeLabels(label) {
  document.querySelectorAll('.range-label').forEach(el => { el.textContent = label || 'lifetime' });
}

// Surface a nudge when a Cloudflare/extension feed hasn't refreshed in a while.
async function loadSyncHealth() {
  const banner = document.getElementById('sync-health-banner');
  if (!banner) return;
  try {
    const res = await fetch(`${API}/dashboard/sync-health`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) return;
    const d = await res.json();
    if (!d.stale || sessionStorage.getItem('syncHealthDismissed') === '1') { banner.classList.add('hidden'); return; }
    const msg = document.getElementById('sync-health-msg');
    if (msg) msg.textContent = d.message || 'Open MarketSync in Chrome to sync inventory.';
    const openBtn = document.getElementById('sync-health-open');
    if (openBtn) {
      if (d.open_url) { openBtn.href = d.open_url; openBtn.classList.remove('hidden'); }
      else openBtn.classList.add('hidden');
    }
    banner.classList.remove('hidden');
    banner.classList.add('flex');
    const dismiss = document.getElementById('sync-health-dismiss');
    if (dismiss) dismiss.onclick = () => { sessionStorage.setItem('syncHealthDismissed', '1'); banner.classList.add('hidden'); banner.classList.remove('flex'); };
  } catch { /* non-fatal */ }
}

// ── Executive ROI dashboard — the "is this paying off?" view ─────────────────
// Managers see the whole store + a per-rep breakdown; a rep sees their own book.
let __execRoiRange = '90';
async function loadExecutiveRoi() {
  const root = document.getElementById('exec-roi');
  if (!root) return;
  let d;
  try { d = await apiGetJson(`/dashboard/executive?range=${encodeURIComponent(__execRoiRange)}`, { retries: 1 }); }
  catch { root.innerHTML = ''; return; }
  if (!d || d.empty) { root.innerHTML = ''; return; }
  __execData = d;
  const fin = d.finance || null;
  const money0 = n => '$' + Number(n || 0).toLocaleString();

  const tile = (label, value, sub, accent) => `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
    <div class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">${esc(label)}</div>
    <div class="text-2xl font-black ${accent || 'text-slate-900 dark:text-white'} mt-1">${value}</div>
    ${sub ? `<div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${sub}</div>` : ''}</div>`;
  const trend = d.leads.trend_pct;
  const trendHtml = `<span class="${trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} font-bold">${trend >= 0 ? '▲' : '▼'} ${Math.abs(trend)}%</span> <span class="text-slate-400">vs prior</span>`;
  const rangeBtn = (v, label) => `<button onclick="execRoiRange('${v}')" class="px-3 py-1.5 text-xs font-bold rounded-lg border ${__execRoiRange === v ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}">${label}</button>`;
  const speedAccent = d.leads.under_5min_pct >= 50 ? 'text-emerald-600 dark:text-emerald-400' : d.leads.under_5min_pct >= 25 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
  const srcMax = Math.max(1, ...(d.pipeline.sold_by_source || []).map(s => s.count));
  const srcHtml = (d.pipeline.sold_by_source || []).length
    ? d.pipeline.sold_by_source.slice(0, 6).map(s => `<div class="flex items-center gap-2 text-sm">
        <div class="w-32 shrink-0 truncate text-slate-600 dark:text-slate-300" title="${esc(s.source)}">${esc(s.source)}</div>
        <div class="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden"><div class="h-full bg-indigo-500 rounded-full" style="width:${Math.round((s.count / srcMax) * 100)}%"></div></div>
        <div class="w-8 text-right font-bold tabular-nums text-slate-700 dark:text-slate-200">${s.count}</div></div>`).join('')
    : '<div class="text-xs text-slate-400 italic">No attributed sales yet — set a “sold source” when you mark a deal delivered.</div>';

  // Per-rep breakdown (managers) — the sales-per-salesperson report.
  const perRepHtml = (d.is_manager && (d.per_rep || []).length) ? `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <div class="px-4 pt-4 pb-2 text-sm font-bold text-slate-900 dark:text-white">Sales by salesperson</div>
      <div class="overflow-x-auto"><table class="w-full text-sm text-left min-w-[520px]">
        <thead><tr class="border-y border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[11px] tracking-wider">
          <th class="py-2 px-4">Salesperson</th><th class="py-2 px-3 text-right">Sales</th><th class="py-2 px-3 text-right">Leads</th><th class="py-2 px-3 text-right">&lt; 5 min</th><th class="py-2 px-3 text-right">Follow-up</th><th class="py-2 px-3 text-right">Appraisals</th>
        </tr></thead>
        <tbody>${d.per_rep.map((r, i) => `<tr class="border-b border-slate-100 dark:border-slate-800/60">
          <td class="py-2.5 px-4 font-semibold text-slate-900 dark:text-white"><span class="inline-flex items-center gap-2">${i < 3 ? rankBadge(i + 1) : `<span class="inline-flex items-center justify-center w-7 h-7 text-[13px] font-black text-slate-400">${i + 1}</span>`}${esc(r.name)}</span></td>
          <td class="py-2.5 px-3 text-right font-black tabular-nums text-emerald-600 dark:text-emerald-400">${r.deals}</td>
          <td class="py-2.5 px-3 text-right tabular-nums text-slate-700 dark:text-slate-200">${r.leads}</td>
          <td class="py-2.5 px-3 text-right tabular-nums text-slate-700 dark:text-slate-200">${r.under_5min_pct}%</td>
          <td class="py-2.5 px-3 text-right tabular-nums text-slate-700 dark:text-slate-200">${r.followup_pct}%</td>
          <td class="py-2.5 px-3 text-right tabular-nums text-slate-700 dark:text-slate-200">${r.appraisals}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>` : '';

  root.innerHTML = `
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h2 class="text-xl font-black text-slate-900 dark:text-white">Executive summary</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">${d.is_manager ? 'Whole store' : 'Your book'} · what MarketSync moved — last ${d.range_days} days.</p>
      </div>
      <div class="flex gap-1.5 items-center">${rangeBtn('7', '7d')}${rangeBtn('30', '30d')}${rangeBtn('90', '90d')}${rangeBtn('365', '1y')}
        <button onclick="execCsv()" class="ml-1 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">${svgIcon("download","w-3.5 h-3.5 inline-block align-text-bottom mr-0.5")}CSV</button></div>
    </div>
    ${fin ? `<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      ${tile('Revenue', money0(fin.revenue), `${fin.units} sold · avg ${money0(fin.avg_price)}`, 'text-emerald-600 dark:text-emerald-400')}
      ${fin.front_gross != null ? tile('Front gross', money0(fin.front_gross), `avg ${money0(fin.avg_gross)}/unit · ${fin.units_costed} costed`, 'text-emerald-600 dark:text-emerald-400') : tile('Front gross', '—', 'turn on cost tracking in Settings → AI')}
    </div>` : ''}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      ${tile('Overall sales', d.sales.total, d.is_manager ? 'deals closed store-wide' : 'your deals closed', 'text-emerald-600 dark:text-emerald-400')}
      ${tile('New leads', d.leads.total, trendHtml)}
      ${tile('Responded &lt; 5 min', d.leads.under_5min_pct + '%', `${d.leads.responded} responded · median ${d.leads.median_response_min != null ? d.leads.median_response_min + ' min' : '—'}`, speedAccent)}
      ${tile('Conversion', d.pipeline.conversion_pct + '%', `${d.pipeline.won} of ${d.pipeline.total_contacts} contacts`)}
      ${tile('Avg days to sell', d.inventory.avg_days_to_sell != null ? d.inventory.avg_days_to_sell : '—', `${d.inventory.days_sold_count} sold via Marketplace`)}
      ${tile('Marketplace posts', d.inventory.marketplace_posted, 'vehicles posted')}
      ${tile('Trade appraisals', d.activity.appraisals, 'completed')}
      ${tile('Follow-up completion', d.activity.followup_completion_pct + '%', `${d.activity.tasks_done}/${d.activity.tasks_total} tasks`)}
    </div>
    ${perRepHtml}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div class="text-sm font-bold text-slate-900 dark:text-white mb-3">Attributed sales by source</div>
        <div class="space-y-2">${srcHtml}</div>
      </div>
      ${tile('Repricing signals', d.inventory.repricing_signals, 'off-market alerts surfaced')}
    </div>
    <div class="border-b border-slate-200 dark:border-slate-800 pt-1"></div>`;
}
function execRoiRange(v) { __execRoiRange = v; loadExecutiveRoi(); }
window.execRoiRange = execRoiRange;

// ── Shared CSV helpers for the Overview reports ──────────────────────────────
let __execData = null, __invMixData = null, __salesAnalysisData = null, __marketingRoiData = null;
function csvCell(v) { const s = (v == null ? '' : String(v)); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function csvSections(sections) {
  const out = [];
  for (const s of sections) {
    if (s.title) out.push(s.title);
    if (s.headers) out.push(s.headers.map(csvCell).join(','));
    for (const r of (s.rows || [])) out.push(r.map(csvCell).join(','));
    out.push('');
  }
  return out.join('\r\n');
}
function msDownloadCsv(name, csv) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const csvDate = () => new Date().toISOString().slice(0, 10);
function execCsv() {
  const d = __execData; if (!d) return;
  const s = [];
  const sum = [['Overall sales', d.sales?.total], ['New leads', d.leads?.total], ['Responded <5min %', d.leads?.under_5min_pct], ['Median response (min)', d.leads?.median_response_min], ['Conversion %', d.pipeline?.conversion_pct], ['Avg days to sell', d.inventory?.avg_days_to_sell], ['Marketplace posts', d.inventory?.marketplace_posted], ['Trade appraisals', d.activity?.appraisals], ['Follow-up completion %', d.activity?.followup_completion_pct]];
  if (d.finance) { sum.push(['Revenue', d.finance.revenue], ['Units sold', d.finance.units], ['Avg price', d.finance.avg_price]); if (d.finance.front_gross != null) sum.push(['Front gross', d.finance.front_gross], ['Avg gross/unit', d.finance.avg_gross], ['Units costed', d.finance.units_costed]); }
  s.push({ title: `Executive summary — last ${d.range_days} days`, headers: ['Metric', 'Value'], rows: sum });
  if ((d.per_rep || []).length) s.push({ title: 'Sales by salesperson', headers: ['Salesperson', 'Sales', 'Leads', '<5min %', 'Follow-up %', 'Appraisals'], rows: d.per_rep.map(r => [r.name, r.deals, r.leads, r.under_5min_pct, r.followup_pct, r.appraisals]) });
  if ((d.pipeline?.sold_by_source || []).length) s.push({ title: 'Attributed sales by source', headers: ['Source', 'Sales'], rows: d.pipeline.sold_by_source.map(x => [x.source, x.count]) });
  msDownloadCsv(`marketsync-executive-${csvDate()}.csv`, csvSections(s));
}
window.execCsv = execCsv;

// ── Inventory mix & aging report (managers) ──────────────────────────────────
async function loadInventoryMix() {
  const root = document.getElementById('inv-mix');
  if (!root) return;
  const isMgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
  if (!isMgr) { root.innerHTML = ''; return; }
  let d;
  try { d = await apiGetJson('/dashboard/inventory-mix', { retries: 1 }); }
  catch { root.innerHTML = ''; return; }
  if (!d || d.empty || !d.summary) { root.innerHTML = ''; return; }
  __invMixData = d;
  const money = n => n != null ? '$' + Number(n).toLocaleString() : '—';
  const compact = n => n >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? '$' + Math.round(n / 1e3) + 'k' : '$' + (n || 0);

  // Horizontal bar table for a grouped breakdown.
  const rows = (items, label, accent) => {
    const max = Math.max(1, ...items.map(i => i.count));
    return items.map(i => `<div class="flex items-center gap-2 text-sm py-0.5">
      <div class="w-24 shrink-0 truncate text-slate-600 dark:text-slate-300" title="${esc(i.key)}">${esc(i.key)}</div>
      <div class="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden"><div class="h-full ${accent} rounded-full" style="width:${Math.round((i.count / max) * 100)}%"></div></div>
      <div class="w-8 text-right font-bold tabular-nums text-slate-700 dark:text-slate-200">${i.count}</div>
      <div class="w-20 text-right tabular-nums text-slate-400 text-xs hidden sm:block">${i.avg_price != null ? money(i.avg_price) : '—'}</div>
      <div class="w-14 text-right tabular-nums text-slate-400 text-xs">${i.avg_age != null ? i.avg_age + 'd' : '—'}</div>
    </div>`).join('') || '<div class="text-xs text-slate-400 italic">No units.</div>';
  };
  const card = (title, body, extra = '') => `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 ${extra}">
    <div class="flex items-center justify-between mb-2"><div class="text-sm font-bold text-slate-900 dark:text-white">${title}</div><div class="text-[10px] uppercase tracking-wider text-slate-400 hidden sm:flex gap-4"><span class="w-20 text-right">avg price</span><span class="w-14 text-right">avg age</span></div></div>
    <div>${body}</div></div>`;
  const stat = (label, value, sub) => `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
    <div class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">${label}</div>
    <div class="text-2xl font-black text-slate-900 dark:text-white mt-1">${value}</div>${sub ? `<div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${sub}</div>` : ''}</div>`;

  // Age buckets with colour coding (fresh → stale).
  const ageColors = { '0–30': 'bg-emerald-500', '31–60': 'bg-amber-500', '61–90': 'bg-orange-500', '90+': 'bg-rose-500' };
  const ageMax = Math.max(1, ...d.by_age.map(i => i.count));
  const ageHtml = d.by_age.map(i => `<div class="flex items-center gap-2 text-sm py-0.5">
    <div class="w-16 shrink-0 text-slate-600 dark:text-slate-300 font-semibold">${esc(i.key)}d</div>
    <div class="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden"><div class="h-full ${ageColors[i.key] || 'bg-slate-400'} rounded-full" style="width:${Math.round((i.count / ageMax) * 100)}%"></div></div>
    <div class="w-8 text-right font-bold tabular-nums text-slate-700 dark:text-slate-200">${i.count}</div>
    <div class="w-24 text-right tabular-nums text-slate-400 text-xs">${compact(i.value)}</div>
  </div>`).join('');

  root.innerHTML = `
    <div class="mb-4 flex items-start justify-between gap-3 flex-wrap"><div><h2 class="text-xl font-black text-slate-900 dark:text-white">Inventory mix &amp; aging</h2>
      <p class="text-sm text-slate-500 dark:text-slate-400">Your live lot, right now — how it's aging and what it's made of.</p></div>
      <button onclick="invMixCsv()" class="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">${svgIcon("download","w-3.5 h-3.5 inline-block align-text-bottom mr-0.5")}CSV</button></div>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      ${stat('Units in stock', d.summary.total_units, 'available')}
      ${stat('Lot value', compact(d.summary.total_value), 'total asking')}
      ${stat('Avg days on lot', d.summary.avg_age + 'd', '')}
      ${stat('Aged 60+ days', d.summary.aged_over_60, d.summary.total_units ? Math.round(d.summary.aged_over_60 / d.summary.total_units * 100) + '% of lot' : '')}
    </div>
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-3">
      <div class="flex items-center justify-between mb-2"><div class="text-sm font-bold text-slate-900 dark:text-white">Aging buckets (days on lot)</div><div class="text-[10px] uppercase tracking-wider text-slate-400 w-24 text-right">value</div></div>
      ${ageHtml}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      ${card('By colour', rows(d.by_color, 'colour', 'bg-indigo-500'))}
      ${card(`By mileage (${d.distance_unit})`, rows(d.by_mileage, 'mileage', 'bg-sky-500'))}
      ${card('By make', rows(d.by_make, 'make', 'bg-violet-500'))}
      ${card('By condition', rows(d.by_condition, 'condition', 'bg-teal-500'))}
    </div>`;
}
function invMixCsv() {
  const d = __invMixData; if (!d) return;
  const grp = (arr) => (arr || []).map(i => [i.key, i.count, i.avg_price ?? '', i.avg_age ?? '']);
  const s = [
    { title: 'Inventory mix & aging', headers: ['Metric', 'Value'], rows: [['Units in stock', d.summary.total_units], ['Lot value', d.summary.total_value], ['Avg days on lot', d.summary.avg_age], ['Aged 60+ days', d.summary.aged_over_60]] },
    { title: 'Aging buckets', headers: ['Days on lot', 'Count', 'Value'], rows: (d.by_age || []).map(i => [i.key, i.count, i.value]) },
    { title: 'By colour', headers: ['Colour', 'Count', 'Avg price', 'Avg age'], rows: grp(d.by_color) },
    { title: `By mileage (${d.distance_unit || ''})`, headers: ['Band', 'Count', 'Avg price', 'Avg age'], rows: grp(d.by_mileage) },
    { title: 'By make', headers: ['Make', 'Count', 'Avg price', 'Avg age'], rows: grp(d.by_make) },
    { title: 'By condition', headers: ['Condition', 'Count', 'Avg price', 'Avg age'], rows: grp(d.by_condition) },
  ];
  msDownloadCsv(`marketsync-inventory-mix-${csvDate()}.csv`, csvSections(s));
}
window.invMixCsv = invMixCsv;

// ── Sales analysis (managers): what sold, sliced by attribute ────────────────
let __salesAnalysisRange = '90';
async function loadSalesAnalysis() {
  const root = document.getElementById('sales-analysis');
  if (!root) return;
  const isMgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
  if (!isMgr) { root.innerHTML = ''; return; }
  let d;
  try { d = await apiGetJson(`/dashboard/sales-analysis?range=${encodeURIComponent(__salesAnalysisRange)}`, { retries: 1 }); }
  catch { root.innerHTML = ''; return; }
  if (!d || d.empty || !d.summary) { root.innerHTML = ''; return; }
  __salesAnalysisData = d;
  const money = n => n != null ? '$' + Number(n).toLocaleString() : '—';
  const compact = n => n >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? '$' + Math.round(n / 1e3) + 'k' : '$' + (n || 0);

  const rows = (items, accent) => {
    const max = Math.max(1, ...items.map(i => i.count));
    return items.map(i => `<div class="flex items-center gap-2 text-sm py-0.5">
      <div class="w-24 shrink-0 truncate text-slate-600 dark:text-slate-300" title="${esc(i.key)}">${esc(i.key)}</div>
      <div class="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden"><div class="h-full ${accent} rounded-full" style="width:${Math.round((i.count / max) * 100)}%"></div></div>
      <div class="w-8 text-right font-bold tabular-nums text-slate-700 dark:text-slate-200">${i.count}</div>
      <div class="w-20 text-right tabular-nums text-slate-400 text-xs hidden sm:block">${i.avg_price != null ? money(i.avg_price) : '—'}</div>
      <div class="w-16 text-right tabular-nums text-slate-400 text-xs">${i.avg_days_to_sell != null ? i.avg_days_to_sell + 'd' : '—'}</div>
    </div>`).join('') || '<div class="text-xs text-slate-400 italic">No sales in range.</div>';
  };
  const card = (title, body) => `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
    <div class="flex items-center justify-between mb-2"><div class="text-sm font-bold text-slate-900 dark:text-white">${title}</div><div class="text-[10px] uppercase tracking-wider text-slate-400 hidden sm:flex gap-3"><span class="w-20 text-right">avg price</span><span class="w-16 text-right">avg days</span></div></div>${body}</div>`;
  const stat = (label, value, sub) => `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
    <div class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">${label}</div>
    <div class="text-2xl font-black text-slate-900 dark:text-white mt-1">${value}</div>${sub ? `<div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${sub}</div>` : ''}</div>`;
  const rangeBtn = (v, label) => `<button onclick="salesAnalysisRange('${v}')" class="px-3 py-1.5 text-xs font-bold rounded-lg border ${__salesAnalysisRange === v ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}">${label}</button>`;

  const dtsColors = { '0–30': 'bg-emerald-500', '31–60': 'bg-amber-500', '61–90': 'bg-orange-500', '90+': 'bg-rose-500', 'Unknown': 'bg-slate-400' };
  const dtsMax = Math.max(1, ...d.by_days_to_sell.map(i => i.count));
  const dtsHtml = d.by_days_to_sell.filter(i => i.count > 0).map(i => `<div class="flex items-center gap-2 text-sm py-0.5">
    <div class="w-16 shrink-0 text-slate-600 dark:text-slate-300 font-semibold">${esc(i.key)}${i.key !== 'Unknown' ? 'd' : ''}</div>
    <div class="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden"><div class="h-full ${dtsColors[i.key] || 'bg-slate-400'} rounded-full" style="width:${Math.round((i.count / dtsMax) * 100)}%"></div></div>
    <div class="w-8 text-right font-bold tabular-nums text-slate-700 dark:text-slate-200">${i.count}</div>
    <div class="w-24 text-right tabular-nums text-slate-400 text-xs">${compact(i.value)}</div>
  </div>`).join('') || '<div class="text-xs text-slate-400 italic">No sales in range.</div>';

  root.innerHTML = `
    <div class="flex items-center justify-between gap-3 flex-wrap mb-4">
      <div><h2 class="text-xl font-black text-slate-900 dark:text-white">Sales analysis</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">What left the lot — last ${d.range_days} days.</p></div>
      <div class="flex gap-1.5 items-center">${rangeBtn('30', '30d')}${rangeBtn('90', '90d')}${rangeBtn('180', '6mo')}${rangeBtn('365', '1y')}
        <button onclick="salesAnalysisCsv()" class="ml-1 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">${svgIcon("download","w-3.5 h-3.5 inline-block align-text-bottom mr-0.5")}CSV</button></div>
    </div>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      ${stat('Units sold', d.summary.units_sold, '')}
      ${stat('Gross value', compact(d.summary.total_value), 'sum of prices')}
      ${stat('Avg days to sell', d.summary.avg_days_to_sell != null ? d.summary.avg_days_to_sell + 'd' : '—', '')}
      ${stat('Median days to sell', d.summary.median_days_to_sell != null ? d.summary.median_days_to_sell + 'd' : '—', '')}
    </div>
    ${(() => {
      const s = d.summary;
      if (s.live_units == null) return '';
      const supplyCls = s.days_supply == null ? 'text-slate-900 dark:text-white'
        : s.days_supply <= 60 ? 'text-emerald-600 dark:text-emerald-400'
        : s.days_supply <= 90 ? 'text-amber-600 dark:text-amber-400'
        : 'text-rose-600 dark:text-rose-400';
      const t = (label, value, sub, cls = 'text-slate-900 dark:text-white') => `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">${label}</div>
        <div class="text-2xl font-black ${cls} mt-1">${value}</div>${sub ? `<div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${sub}</div>` : ''}</div>`;
      const byCond = Array.isArray(d.turn_by_condition) ? d.turn_by_condition : [];
      const condCard = (c) => {
        const sc = c.days_supply == null ? 'text-slate-900 dark:text-white'
          : c.days_supply <= 60 ? 'text-emerald-600 dark:text-emerald-400'
          : c.days_supply <= 90 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
        return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">${c.label}</div>
          <div class="text-2xl font-black mt-1 ${sc}">${c.days_supply != null ? c.days_supply + 'd' : '—'}<span class="text-xs font-semibold text-slate-400 ml-1">supply</span></div>
          <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${c.live} live · ${c.sales_per_month}/mo · ${c.turns_per_year != null ? c.turns_per_year + '×/yr' : '—'}</div>
        </div>`;
      };
      return `
      <div class="mb-1 text-sm font-bold text-slate-900 dark:text-white">Turn rate <span class="font-normal text-slate-400 text-xs">— how fast the lot recycles at this pace</span></div>
      <p class="text-[11px] text-slate-400 mb-2 max-w-3xl">How quickly you sell through what's on the ground. <b>Days of supply</b> = how long today's lot lasts at your recent sales pace (lower is faster — aim under 60). <b>Turns/year</b> = how many times the lot fully recycles. Use it to decide what to stock more (fast turners) or discount (slow movers).</p>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        ${t('Sales / month', s.sales_per_month != null ? s.sales_per_month : '—', 'recent pace')}
        ${t('Days of supply', s.days_supply != null ? s.days_supply + 'd' : '—', `${s.live_units} live units`, supplyCls)}
        ${t('Turns / year', s.turns_per_year != null ? s.turns_per_year + '×' : '—', 'inventory turns')}
        ${t('Live units', s.live_units, 'on the ground now')}
      </div>
      ${byCond.length ? `<div class="mb-1 text-[11px] uppercase tracking-wider text-slate-400 font-bold">By type</div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">${byCond.map(condCard).join('')}</div>` : ''}`;
    })()}
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-3">
      <div class="flex items-center justify-between mb-2"><div class="text-sm font-bold text-slate-900 dark:text-white">Days to sell</div><div class="text-[10px] uppercase tracking-wider text-slate-400 w-24 text-right">value</div></div>
      ${dtsHtml}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      ${card('Sold by colour', rows(d.by_color, 'bg-indigo-500'))}
      ${card(`Sold by mileage (${d.distance_unit})`, rows(d.by_mileage, 'bg-sky-500'))}
      ${card('Sold by make', rows(d.by_make, 'bg-violet-500'))}
      ${card('Sold by condition', rows(d.by_condition, 'bg-teal-500'))}
    </div>
    <div class="text-[11px] text-slate-400 mt-2">A "sale" = a unit that left the lot (marked sold, or dropped off your feed). Days to sell = time from lot date to sale.</div>`;
}
function salesAnalysisRange(v) { __salesAnalysisRange = v; loadSalesAnalysis(); }
window.salesAnalysisRange = salesAnalysisRange;
function salesAnalysisCsv() {
  const d = __salesAnalysisData; if (!d) return;
  const grp = (arr) => (arr || []).map(i => [i.key, i.count, i.avg_price ?? '', i.avg_days_to_sell ?? '']);
  const s = [
    { title: `Sales analysis — last ${d.range_days} days`, headers: ['Metric', 'Value'], rows: [['Units sold', d.summary.units_sold], ['Gross value', d.summary.total_value], ['Avg days to sell', d.summary.avg_days_to_sell], ['Median days to sell', d.summary.median_days_to_sell], ['Sales per month', d.summary.sales_per_month ?? ''], ['Days of supply', d.summary.days_supply ?? ''], ['Turns per year', d.summary.turns_per_year ?? ''], ['Live units', d.summary.live_units ?? '']] },
    { title: 'Turn rate by type', headers: ['Type', 'Live', 'Sold', 'Sales/mo', 'Days supply', 'Turns/yr'], rows: (d.turn_by_condition || []).map(c => [c.label, c.live, c.sold, c.sales_per_month, c.days_supply ?? '', c.turns_per_year ?? '']) },
    { title: 'Days to sell', headers: ['Band', 'Count', 'Value'], rows: (d.by_days_to_sell || []).map(i => [i.key, i.count, i.value]) },
    { title: 'By colour', headers: ['Colour', 'Sold', 'Avg price', 'Avg days'], rows: grp(d.by_color) },
    { title: `By mileage (${d.distance_unit || ''})`, headers: ['Band', 'Sold', 'Avg price', 'Avg days'], rows: grp(d.by_mileage) },
    { title: 'By make', headers: ['Make', 'Sold', 'Avg price', 'Avg days'], rows: grp(d.by_make) },
    { title: 'By condition', headers: ['Condition', 'Sold', 'Avg price', 'Avg days'], rows: grp(d.by_condition) },
  ];
  msDownloadCsv(`marketsync-sales-analysis-${csvDate()}.csv`, csvSections(s));
}
window.salesAnalysisCsv = salesAnalysisCsv;

// ── Marketing ROI — which ad channel paid off (managers) ────────────────────────
let __mktRoiRange = '90';
let __mktAvgGross = 3500;
let __mktSpendPeriod = null;   // 'YYYY-MM' being edited (defaults to current month)
const MKT_CHANNELS = ['Facebook Marketplace', 'AutoTrader', 'CarGurus', 'Kijiji', 'Google', 'Social', 'Website', 'Referral', 'Walk-in', 'Phone'];
function mktCurrentPeriod() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
async function loadMarketingRoi() {
  const root = document.getElementById('marketing-roi');
  if (!root) return;
  const isMgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
  if (!isMgr) { root.innerHTML = ''; return; }
  if (!__mktSpendPeriod) __mktSpendPeriod = mktCurrentPeriod();
  let d, spendRows = [];
  try { d = await apiGetJson(`/marketing/roi?range=${__mktRoiRange}&avg_gross=${__mktAvgGross}`, { retries: 1 }); }
  catch { root.innerHTML = ''; return; }
  __marketingRoiData = d;
  try { spendRows = (await apiGetJson(`/marketing/spend?period=${__mktSpendPeriod}`, { retries: 1 })).spend || []; } catch {}
  const money = n => n != null ? '$' + Number(n).toLocaleString() : '—';
  const compact = n => n == null ? '—' : (n >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? '$' + Math.round(n / 1e3) + 'k' : '$' + Math.round(n || 0));
  const rangeBtn = (v, label) => `<button onclick="mktRoiRange('${v}')" class="px-3 py-1.5 text-xs font-bold rounded-lg border ${__mktRoiRange === v ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}">${label}</button>`;

  const spendByChannel = {}; for (const s of spendRows) spendByChannel[s.channel] = s.amount;
  // Channels to offer in the editor: the standard set + any the ROI report detected.
  const detected = (d.rows || []).map(r => r.channel).filter(c => c && c !== 'Unattributed');
  const editorChannels = [...new Set([...MKT_CHANNELS, ...detected])];

  const roiPill = (pct) => {
    if (pct == null) return '<span class="text-slate-400">—</span>';
    const cls = pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
    return `<span class="font-black tabular-nums ${cls}">${pct >= 0 ? '+' : ''}${pct}%</span>`;
  };
  const bestChannel = (d.rows || []).filter(r => r.spend > 0 && r.roi_pct != null).sort((a, b) => b.roi_pct - a.roi_pct)[0];

  const tableRows = (d.rows || []).filter(r => r.leads || r.sales || r.spend).map(r => `<tr class="border-t border-slate-100 dark:border-slate-800">
      <td class="py-2 pr-2 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">${esc(r.channel)}${bestChannel && r.channel === bestChannel.channel ? ' <span class="text-[10px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 align-middle">best ROI</span>' : ''}</td>
      <td class="py-2 px-2 text-right tabular-nums text-slate-600 dark:text-slate-300">${r.spend ? money(r.spend) : '—'}</td>
      <td class="py-2 px-2 text-right tabular-nums text-slate-600 dark:text-slate-300">${r.leads || '—'}</td>
      <td class="py-2 px-2 text-right tabular-nums text-slate-600 dark:text-slate-300">${r.sales || '—'}</td>
      <td class="py-2 px-2 text-right tabular-nums text-slate-500 hidden sm:table-cell">${r.cost_per_lead != null ? money(r.cost_per_lead) : '—'}</td>
      <td class="py-2 px-2 text-right tabular-nums text-slate-500 hidden sm:table-cell">${r.cost_per_sale != null ? money(r.cost_per_sale) : '—'}</td>
      <td class="py-2 px-2 text-right tabular-nums text-slate-600 dark:text-slate-300 hidden md:table-cell">${r.revenue ? compact(r.revenue) : '—'}</td>
      <td class="py-2 pl-2 text-right">${roiPill(r.roi_pct)}</td>
    </tr>`).join('') || '<tr><td colspan="8" class="py-4 text-center text-xs text-slate-400 italic">No leads, sales or spend in range yet.</td></tr>';

  const t = d.totals || {};
  const totalRow = `<tr class="border-t-2 border-slate-200 dark:border-slate-700 font-black text-slate-900 dark:text-white">
      <td class="py-2 pr-2">Total</td>
      <td class="py-2 px-2 text-right tabular-nums">${money(t.spend)}</td>
      <td class="py-2 px-2 text-right tabular-nums">${t.leads || 0}</td>
      <td class="py-2 px-2 text-right tabular-nums">${t.sales || 0}</td>
      <td class="py-2 px-2 text-right tabular-nums hidden sm:table-cell">${t.cost_per_lead != null ? money(t.cost_per_lead) : '—'}</td>
      <td class="py-2 px-2 text-right tabular-nums hidden sm:table-cell">${t.cost_per_sale != null ? money(t.cost_per_sale) : '—'}</td>
      <td class="py-2 px-2 text-right tabular-nums hidden md:table-cell">${compact(t.revenue)}</td>
      <td class="py-2 pl-2 text-right">${roiPill(t.roi_pct)}</td>
    </tr>`;

  const editor = editorChannels.map(c => `<div class="flex items-center gap-2">
      <span class="flex-1 min-w-0 truncate text-sm text-slate-600 dark:text-slate-300">${esc(c)}</span>
      <div class="relative">
        <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
        <input type="number" min="0" step="1" value="${spendByChannel[c] != null ? spendByChannel[c] : ''}" placeholder="0"
          onchange="mktSaveSpend('${esc(c)}', this.value, this)"
          class="w-28 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg pl-6 pr-2 py-1.5 text-sm text-right tabular-nums">
      </div>
    </div>`).join('');

  root.innerHTML = `
    <div class="flex items-center justify-between gap-3 flex-wrap mb-4">
      <div><h2 class="text-xl font-black text-slate-900 dark:text-white">Marketing ROI</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">Which channels paid off — spend vs leads, sales & gross, last ${d.range_days} days.</p></div>
      <div class="flex gap-1.5 items-center">${rangeBtn('30', '30d')}${rangeBtn('90', '90d')}${rangeBtn('180', '6mo')}${rangeBtn('365', '1y')}
        <button onclick="marketingRoiCsv()" class="ml-1 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">${svgIcon("download","w-3.5 h-3.5 inline-block align-text-bottom mr-0.5")}CSV</button></div>
    </div>
    ${!d.has_spend ? `<div class="rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 px-4 py-3 mb-4 text-sm text-indigo-800 dark:text-indigo-200">Add your monthly ad spend per channel below to unlock cost-per-lead, cost-per-sale and ROI. Leads and sales by channel are already tracked from your CRM — no tagging needed.</div>` : ''}
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 overflow-x-auto">
        <table class="w-full text-sm min-w-[560px]">
          <thead><tr class="text-[10px] uppercase tracking-wider text-slate-400">
            <th class="text-left font-bold pb-1">Channel</th>
            <th class="text-right font-bold pb-1 px-2">Spend</th>
            <th class="text-right font-bold pb-1 px-2">Leads</th>
            <th class="text-right font-bold pb-1 px-2">Sales</th>
            <th class="text-right font-bold pb-1 px-2 hidden sm:table-cell">$/lead</th>
            <th class="text-right font-bold pb-1 px-2 hidden sm:table-cell">$/sale</th>
            <th class="text-right font-bold pb-1 px-2 hidden md:table-cell">Revenue</th>
            <th class="text-right font-bold pb-1 pl-2">ROI</th>
          </tr></thead>
          <tbody>${tableRows}${totalRow}</tbody>
        </table>
        <div class="flex items-center gap-2 mt-3 flex-wrap">
          <label class="text-[11px] text-slate-500 dark:text-slate-400">Assumed gross per sale
            <span class="relative inline-block ml-1"><span class="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
            <input type="number" min="0" step="100" value="${__mktAvgGross}" onchange="mktSetAvgGross(this.value)" class="w-24 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg pl-5 pr-2 py-1 text-xs text-right tabular-nums"></span>
          </label>
          <span class="text-[11px] text-slate-400">ROI = (sales × assumed gross − spend) ÷ spend. Revenue is real (sum of selling prices).</span>
        </div>
      </div>
      <div class="space-y-4">
      <div id="adspend-panel"></div>
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div class="flex items-center justify-between mb-2">
          <div class="text-sm font-bold text-slate-900 dark:text-white">Monthly ad spend</div>
        </div>
        <label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Month</label>
        <input type="month" value="${__mktSpendPeriod}" max="${mktCurrentPeriod()}" onchange="mktSetSpendPeriod(this.value)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm mb-3">
        <div class="space-y-2">${editor}</div>
        <p class="text-[11px] text-slate-400 mt-3">Enter what you spent on each channel that month. Blank = $0. The report sums spend across the months in your selected range. Auto-imported months fill in on their own.</p>
      </div>
      </div>
    </div>`;
  loadAdSpendPanel();
}