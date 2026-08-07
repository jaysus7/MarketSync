/* dashboard.js split part 7/26 — contiguous, load-order-critical. Do not reorder the <script> tags in dashboard.html. */

// Pull the customer's saved trade appraisal(s) into the trade-in section.
async function deskPullTrade() {
  const cid = __deskDeal?.contact_id || __deskBuyer?.id;
  const hint = document.getElementById('desk-trade-hint');
  const picker = document.getElementById('desk-trade-picker');
  if (!cid) { if (hint) hint.textContent = 'Select a customer first.'; return; }
  if (hint) hint.textContent = 'Loading…';
  try {
    const d = await apiGetJson(`/deals/trades?contact_id=${encodeURIComponent(cid)}`, { retries: 1 });
    const rows = d?.rows || [];
    if (!rows.length) { if (hint) hint.textContent = 'No saved appraisals for this customer.'; if (picker) picker.classList.add('hidden'); return; }
    if (rows.length === 1) { deskApplyTrade(rows[0]); if (hint) hint.textContent = 'Pulled from saved appraisal.'; return; }
    // Multiple → let the manager pick which one.
    if (hint) hint.textContent = 'Pick an appraisal:';
    if (picker) {
      picker.classList.remove('hidden');
      picker.innerHTML = rows.map(r => {
        const label = [r.year, r.make, r.model, r.trim].filter(Boolean).join(' ') || 'Trade';
        const j = encodeURIComponent(JSON.stringify(r));
        return `<button type="button" onclick="deskApplyTrade(JSON.parse(decodeURIComponent('${j}')))" class="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg mb-1">${esc(label)}${r.suggested_offer ? ' — ' + deskM(r.suggested_offer) : ''}<span class="text-xs text-slate-400"> · ${new Date(r.created_at).toLocaleDateString()}</span></button>`;
      }).join('');
    }
  } catch (e) { if (hint) hint.textContent = 'Could not load appraisals.'; }
}
function deskApplyTrade(r) {
  if (!r) return;
  const set = (id, v) => { const el = document.getElementById(id); if (el && v != null && v !== '') el.value = v; };
  const desc = [r.year, r.make, r.model, r.trim].filter(Boolean).join(' ');
  set('dk-trade_desc', desc);
  set('dk-trade_vin', r.vin);
  if (r.suggested_offer != null) set('dk-trade_value', r.suggested_offer);
  const picker = document.getElementById('desk-trade-picker'); if (picker) picker.classList.add('hidden');
  const hint = document.getElementById('desk-trade-hint'); if (hint) hint.textContent = 'Pulled from saved appraisal.';
  deskRenderSummary();
}

// ── Collect + compute ────────────────────────────────────────────────────────
function deskCollect(contactId) {
  const g = (id) => document.getElementById(id);
  // Comma-tolerant: data-money fields carry "26,626.00" — strip before parsing.
  const num = (id) => { const el = g(id); if (!el || el.value === '') return null; const n = msNum(el.value); return Number.isFinite(n) ? n : null; };
  const val = (id) => { const el = g(id); return el ? (el.value.trim() || null) : null; };
  const chk = (id) => { const el = g(id); return !!(el && el.checked); };
  const clean = (arr, amtKey) => arr.map(r => ({ name: (r.name || '').trim(), [amtKey]: Number(r[amtKey]) || 0 })).filter(r => r.name || r[amtKey]);
  const fees = __deskFees.map(r => ({ name: (r.name || '').trim(), amount: Number(r.amount) || 0, taxable: r.taxable !== false })).filter(r => r.name || r.amount);
  const d = {
    // Preserve the deal's current lifecycle status — a plain Save must never knock a
    // Sold/Delivered deal back to Working (that also dropped it from Cleanup).
    contact_id: contactId, deal_status: __deskDeal?.deal_status || 'working', inventory_id: __deskDeal.inventory_id || null,
    retail: num('dk-retail'), rebate_before_tax: num('dk-rebate_before_tax'), adjustment: num('dk-adjustment'),
    selling_price: num('dk-selling_price'),
    sale_type: val('dk-sale_type'), program: val('dk-program'), co_buyer: val('dk-co_buyer'),
    balloon: num('dk-balloon'), deferral_days: num('dk-deferral_days'),
    trade_value: num('dk-trade_value'), trade_payoff: num('dk-trade_payoff'), trade_desc: val('dk-trade_desc'), trade_vin: val('dk-trade_vin'),
    down_payment: num('dk-down_payment'), deposit_amount: num('dk-deposit_amount'), rebate: num('dk-rebate'),
    apr: num('dk-apr'), term: num('dk-term'), payment_freq: val('dk-payment_freq'), deal_type: val('dk-deal_type'),
    buy_rate: num('dk-buy_rate'), residual_amount: num('dk-residual_amount'), mileage_allowance: num('dk-mileage_allowance'),
    finance_company: val('dk-finance_company'), first_payment_date: val('dk-first_payment_date'),
    tax_province: val('dk-tax_province'), tax_rate: num('dk-tax_rate'), tax_on_difference: chk('dk-tax_on_difference'),
    addons: clean(__deskAddons, 'price'),
    // F&I lines keep cost + catalog product_id (when picked from the catalog) so the
    // back-end gross is true and the deal references the product.
    fni_items: __deskFni.map(r => {
      const o = { name: (r.name || '').trim(), price: Number(r.price) || 0 };
      if (r.cost != null && Number.isFinite(Number(r.cost))) o.cost = Number(r.cost);
      if (r.product_id) o.product_id = r.product_id;
      return o;
    }).filter(r => r.name || r.price),
    fees,
    insurance: { company: val('dk-ins-company'), policy: val('dk-ins-policy'), agent: val('dk-ins-agent'), phone: val('dk-ins-phone'), expiry: val('dk-ins-expiry') },
    vehicle: { year: val('dk-veh-year'), make: val('dk-veh-make'), model: val('dk-veh-model'), trim: val('dk-veh-trim'), vin: val('dk-veh-vin'), mileage: num('dk-veh-mileage'), color: val('dk-veh-color'), stock: val('dk-veh-stock') },
    // F&I tracking
    cost: num('dk-cost'),   // internal vehicle cost (only present when the field is shown; backend ignores it unless cost tracking is on)
    delivery_date: val('dk-delivery_date'), delivery_time: val('dk-delivery_time'), plates: val('dk-plates'),
    vehicle_commission: num('dk-vehicle_commission'), fni_commission: num('dk-fni_commission'), notes: val('dk-notes'),
    google_review: chk('dk-google_review'), gm_survey: chk('dk-gm_survey'), fni_gross_1500: chk('dk-fni_gross_1500'), split_deal: chk('dk-split_deal'),
    // Commission attribution — store the rep IDs plus their names for the printed docs.
    fni_manager_id: val('dk-fni_manager_id') || null, split_rep_id: val('dk-split_rep_id') || null, split_pct: num('dk-split_pct'),
    fni_manager: deskRepName(val('dk-fni_manager_id')), split_with: deskRepName(val('dk-split_rep_id')),
  };
  return d;
}
function deskRepName(id) { if (!id) return null; const r = (__crmReps || []).find(x => x.id === id); return r ? r.name : null; }
// ── Credit application ───────────────────────────────────────────────────────
// Full lender-grade applicant/co-applicant/employment/financing capture. SIN & DOB
// are encrypted server-side; masks show without decrypting; export produces the
// STAR credit-app XML to upload to RouteOne / Dealertrack.
function creditSetPath(obj, path, val) {
  const parts = path.split('.'); let o = obj;
  for (let i = 0; i < parts.length - 1; i++) { const k = parts[i]; o[k] = o[k] || {}; o = o[k]; }
  o[parts[parts.length - 1]] = val;
}
async function openCreditApp(contactId) {
  if (!contactId) { showToast('Select a customer first.', 'error'); return; }
  const d = deskCollect(contactId); const c = deskCompute(d);
  let app = null;
  try { const r = await apiGetJson(`/credit/application?contact_id=${encodeURIComponent(contactId)}`); app = r?.application || null; }
  catch (e) { if (/Manager access/.test(e.message || '')) { showToast('Manager access required for credit apps.', 'error'); return; } }
  const rnd = (x) => x == null ? '' : Math.round(Number(x) * 100) / 100;
  const dv = (id) => (document.getElementById(id)?.value || '').trim();
  const veh = (app?.vehicle && Object.keys(app.vehicle).length) ? app.vehicle
    : { year: dv('dk-veh-year'), make: dv('dk-veh-make'), model: dv('dk-veh-model'), trim: dv('dk-veh-trim'), vin: dv('dk-veh-vin'), mileage: dv('dk-veh-mileage'), stock: dv('dk-veh-stock'), inventory_id: __deskDeal.inventory_id || null };
  const fin = (app?.financing && Object.keys(app.financing).length) ? app.financing
    : { selling_price: rnd(c.sellingPrice), tax_amount: rnd(c.taxAmount), fees_total: rnd(c.feesTotal), trade_value: rnd(c.tradeValue), trade_payoff: rnd(c.tradePayoff), down_payment: rnd(c.down), rebate: rnd(c.rebate), amount_financed: rnd(c.amountFinanced), apr: c.apr, term: c.term, payment_freq: c.freq, payment: rnd(c.payment), first_payment_date: d.first_payment_date, lender: d.finance_company, program: d.program };
  let A = app?.applicant || {};
  const CO = app?.co_applicant || null;
  const hasCo = !!CO;
  // New application → prefill the applicant with everything we already have on file for
  // this customer (name, phones, email, address) so the F&I manager isn't re-typing it.
  if (!A.first && !A.last) {
    try {
      const cr = await apiGetJson(`/deals/customer?id=${encodeURIComponent(contactId)}`, { retries: 1 });
      const b = cr?.contact || {};
      A = {
        ...A,
        first: A.first || b.first_name || '',
        last: A.last || b.last_name || '',
        email: A.email || b.email || '',
        phone: A.phone || b.phone_mobile || b.phone || '',
        phone_home: A.phone_home || b.phone_home || '',
        address: {
          street: b.address || '', city: b.city || '',
          province: b.province || '', postal: b.postal_code || '',
          ...(A.address || {}),
        },
        employment: A.employment || {}, other_income: A.other_income || {},
      };
    } catch {}
  }

  const CI = 'w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-900 dark:text-white';
  const F = (label, inner) => `<label class="block"><span class="block text-[10.5px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">${label}</span>${inner}</label>`;
  const IN = (path, val, ph, num) => `<input data-f="${path}"${num ? ' data-num inputmode="decimal"' : ''} value="${esc(val == null ? '' : val)}" placeholder="${ph || ''}" class="${CI}">`;
  const SEL = (path, opts, val) => `<select data-f="${path}" class="${CI}">${opts.map(o => `<option ${o === (val || '') ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  const sinField = (path, mask, hasVal) => `<div class="flex gap-1"><input data-f="${path}" value="" placeholder="${hasVal ? (mask || '•••• on file') + ' — reveal or re-enter' : '123-456-789'}" class="${CI}">${hasVal ? `<button type="button" data-reveal="${path}" class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 px-2 rounded border border-slate-200 dark:border-slate-700 whitespace-nowrap">Reveal</button>` : ''}</div>`;

  const person = (pre, p, sinPath, dobPath, sinMask, hasSin, hasDob) => {
    const ad = p.address || {}, pad = p.prev_address || {}, em = p.employment || {}, oi = p.other_income || {};
    const hasPrev = !!(pad.street || pad.city || pad.province || pad.postal);
    return `
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
      ${F('First name', IN(pre + '.first', p.first))}${F('Middle', IN(pre + '.middle', p.middle))}${F('Last name', IN(pre + '.last', p.last))}
      ${F('Email', IN(pre + '.email', p.email))}${F('Cell phone', IN(pre + '.phone', p.phone))}${F('Home phone', IN(pre + '.phone_home', p.phone_home))}
      ${F('SIN', sinField(sinPath, sinMask, hasSin))}${F('Date of birth', `<input data-f="${dobPath}" type="date" value="" class="${CI}" placeholder="${hasDob ? 'on file' : ''}">`)}${F('Marital status', SEL(pre + '.marital', ['', 'Single', 'Married', 'Common-law', 'Divorced', 'Widowed', 'Separated'], p.marital))}
    </div>
    <div class="mt-2 text-[11px] font-black uppercase tracking-wider text-slate-400">Residence</div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      ${F('Street', IN(pre + '.address.street', ad.street))}${F('City', IN(pre + '.address.city', ad.city))}${F('Province', IN(pre + '.address.province', ad.province))}${F('Postal', IN(pre + '.address.postal', ad.postal))}
      ${F('Status', SEL(pre + '.address.status', ['', 'Own', 'Rent', 'Live with family', 'Other'], ad.status))}${F('Monthly pmt', IN(pre + '.address.payment', ad.payment, '', true))}${F('Years', IN(pre + '.address.years', ad.years, '', true))}${F('Months', IN(pre + '.address.months', ad.months, '', true))}
    </div>
    <label class="flex items-center gap-2 text-[12px] font-semibold text-slate-500 dark:text-slate-400 mt-1.5"><input type="checkbox" data-prev-toggle="${pre}" ${hasPrev ? 'checked' : ''} class="rounded"> Add previous address <span class="font-normal text-slate-400">(required by lenders if under 3 years at current)</span></label>
    <div data-prev-section="${pre}" class="${hasPrev ? '' : 'hidden'} grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
      ${F('Prev street', IN(pre + '.prev_address.street', pad.street))}${F('Prev city', IN(pre + '.prev_address.city', pad.city))}${F('Prev province', IN(pre + '.prev_address.province', pad.province))}${F('Prev postal', IN(pre + '.prev_address.postal', pad.postal))}
      ${F('Prev status', SEL(pre + '.prev_address.status', ['', 'Own', 'Rent', 'Live with family', 'Other'], pad.status))}${F('Years', IN(pre + '.prev_address.years', pad.years, '', true))}${F('Months', IN(pre + '.prev_address.months', pad.months, '', true))}
    </div>
    <div class="mt-2 text-[11px] font-black uppercase tracking-wider text-slate-400">Employment &amp; income</div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      ${F('Employer', IN(pre + '.employment.employer', em.employer))}${F('Occupation', IN(pre + '.employment.occupation', em.occupation))}${F('Status', SEL(pre + '.employment.status', ['', 'Full-time', 'Part-time', 'Self-employed', 'Retired', 'Unemployed'], em.status))}${F('Work phone', IN(pre + '.employment.phone', em.phone))}
      ${F('Years', IN(pre + '.employment.years', em.years, '', true))}${F('Months', IN(pre + '.employment.months', em.months, '', true))}${F('Gross monthly $', IN(pre + '.employment.income_monthly', em.income_monthly, '', true))}${F('Other income $', IN(pre + '.other_income.amount', oi.amount, '', true))}
    </div>`;
  };

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-[75] bg-black/70 flex items-start justify-center p-4 overflow-y-auto';
  modal.innerHTML = `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl my-8 shadow-2xl">
    <div class="flex items-center justify-between gap-3 p-5 border-b border-slate-200 dark:border-slate-800">
      <div><h3 class="text-base font-bold text-slate-900 dark:text-white">Credit application</h3><div class="text-xs text-slate-400">SIN &amp; DOB are encrypted · export to RouteOne / Dealertrack</div></div>
      <button data-x class="text-slate-400 hover:text-slate-700 dark:hover:text-white text-2xl leading-none">&times;</button>
    </div>
    <div class="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
      <div class="text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Applicant</div>
      ${person('applicant', A, 'applicant_sin', 'applicant_dob', app?.applicant_sin_mask, app?.has_applicant_sin, app?.has_applicant_dob)}
      <label class="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 pt-1"><input type="checkbox" data-co-toggle ${hasCo ? 'checked' : ''} class="rounded"> Add co-applicant</label>
      <div data-co-section class="${hasCo ? '' : 'hidden'} space-y-2 border-l-2 border-slate-200 dark:border-slate-700 pl-3">
        ${person('co_applicant', CO || {}, 'co_sin', 'co_dob', app?.co_sin_mask, app?.has_co_sin, app?.has_co_dob)}
      </div>
      <div class="text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 pt-1">Vehicle</div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        ${F('Year', IN('vehicle.year', veh.year))}${F('Make', IN('vehicle.make', veh.make))}${F('Model', IN('vehicle.model', veh.model))}${F('Trim', IN('vehicle.trim', veh.trim))}
        ${F('VIN', IN('vehicle.vin', veh.vin))}${F('Mileage', IN('vehicle.mileage', veh.mileage, '', true))}${F('Stock #', IN('vehicle.stock', veh.stock))}
      </div>
      <div class="text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 pt-1">Financing</div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        ${F('Lender', IN('financing.lender', fin.lender))}${F('Program', IN('financing.program', fin.program))}${F('Selling price', IN('financing.selling_price', fin.selling_price, '', true))}${F('Tax', IN('financing.tax_amount', fin.tax_amount, '', true))}
        ${F('Fees', IN('financing.fees_total', fin.fees_total, '', true))}${F('Trade allowance', IN('financing.trade_value', fin.trade_value, '', true))}${F('Trade payoff', IN('financing.trade_payoff', fin.trade_payoff, '', true))}${F('Cash down', IN('financing.down_payment', fin.down_payment, '', true))}
        ${F('Rebate', IN('financing.rebate', fin.rebate, '', true))}${F('Amount financed', IN('financing.amount_financed', fin.amount_financed, '', true))}${F('APR %', IN('financing.apr', fin.apr, '', true))}${F('Term (mo)', IN('financing.term', fin.term, '', true))}
        ${F('Frequency', SEL('financing.payment_freq', ['monthly', 'biweekly', 'weekly', 'semimonthly'], fin.payment_freq))}${F('Payment', IN('financing.payment', fin.payment, '', true))}${F('First payment', `<input data-f="financing.first_payment_date" type="date" value="${esc(fin.first_payment_date || '')}" class="${CI}">`)}
      </div>
      <label class="flex items-start gap-2 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-[12.5px] text-slate-700 dark:text-slate-300"><input type="checkbox" data-f="consent" ${app?.consent ? 'checked' : ''} class="rounded mt-0.5"><span>The applicant authorizes ${esc(profileContext?.dealershipName || 'the dealership')} and its lenders to obtain a consumer credit report. ${app?.consent_at ? `<em class="text-emerald-600 dark:text-emerald-400 not-italic font-semibold">Consent recorded ${new Date(app.consent_at).toLocaleDateString()}.</em>` : ''}</span></label>
    </div>
    <div class="flex flex-wrap items-center justify-between gap-2 p-4 border-t border-slate-200 dark:border-slate-800">
      <div class="flex items-center gap-2">
        <select data-provider class="${CI} w-auto"><option value="routeone">RouteOne</option><option value="dealertrack">Dealertrack</option></select>
        <button data-submit class="text-sm font-bold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">Submit to lender</button>
      </div>
      <div class="flex items-center gap-2">
        <button data-pdf class="text-sm font-bold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">Print / PDF</button>
        <button data-export class="text-sm font-bold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">Export XML</button>
        <button data-save class="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg">Save</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(modal);
  let appId = app?.id || null;
  const close = () => modal.remove();
  modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-x]')) close(); });
  modal.querySelector('[data-co-toggle]').addEventListener('change', e => modal.querySelector('[data-co-section]').classList.toggle('hidden', !e.target.checked));
  modal.querySelectorAll('[data-prev-toggle]').forEach(t => t.addEventListener('change', e => {
    const sec = modal.querySelector(`[data-prev-section="${e.target.dataset.prevToggle}"]`);
    if (sec) sec.classList.toggle('hidden', !e.target.checked);
  }));

  // Reveal a masked SIN/DOB (audited server-side) into its field.
  modal.querySelectorAll('[data-reveal]').forEach(b => b.addEventListener('click', async () => {
    if (!appId) { showToast('Save the application first, then reveal.', 'error'); return; }
    try {
      const r = await fetch(`${API}/credit/application/${appId}/reveal`, { headers: { 'Authorization': `Bearer ${token}` } });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Failed');
      const path = b.dataset.reveal; const map = { applicant_sin: j.applicant_sin, co_sin: j.co_sin };
      const el = modal.querySelector(`[data-f="${path}"]`); if (el && map[path] != null) el.value = map[path];
    } catch (e) { showToast(e.message || 'Could not reveal', 'error'); }
  }));

  const collect = () => {
    const out = { contact_id: contactId };
    if (__deskDeal?.inventory_id) out.vehicle = { inventory_id: __deskDeal.inventory_id };
    modal.querySelectorAll('[data-f]').forEach(el => {
      const path = el.dataset.f;
      let val = el.type === 'checkbox' ? el.checked : el.value.trim();
      if (el.type !== 'checkbox' && val === '') { if (!/^(applicant_sin|applicant_dob|co_sin|co_dob)$/.test(path)) creditSetPath(out, path, ''); return; }
      if (el.hasAttribute('data-num')) { const nn = msNum(val); val = Number.isFinite(nn) ? nn : val; }
      creditSetPath(out, path, val);
    });
    if (!modal.querySelector('[data-co-toggle]').checked) { out.co_applicant = null; delete out.co_sin; delete out.co_dob; }
    // Drop previous-address blocks when their toggle is off so stale data isn't persisted.
    modal.querySelectorAll('[data-prev-toggle]').forEach(t => {
      if (!t.checked) { const tgt = t.dataset.prevToggle === 'co_applicant' ? out.co_applicant : out.applicant; if (tgt) tgt.prev_address = null; }
    });
    return out;
  };

  const save = async () => {
    const body = collect();
    const r = await fetch(`${API}/credit/application`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Save failed');
    appId = j.application?.id || appId;
    return j.application;
  };
  modal.querySelector('[data-save]').addEventListener('click', async (ev) => {
    const btn = ev.currentTarget; btn.disabled = true; btn.textContent = 'Saving…';
    try { await save(); showToast('Credit application saved.', 'success'); close(); }
    catch (e) { showToast(e.message || 'Save failed', 'error'); btn.disabled = false; btn.textContent = 'Save'; }
  });
  modal.querySelector('[data-export]').addEventListener('click', async (ev) => {
    const btn = ev.currentTarget; btn.disabled = true;
    try {
      await save();
      const r = await fetch(`${API}/credit/application/${appId}/export`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ format: 'xml' }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Export failed');
      const blob = new Blob([j.xml], { type: 'application/xml' }); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = j.filename || 'credit-app.xml'; a.click(); URL.revokeObjectURL(url);
      showToast('Credit application XML downloaded.', 'success');
    } catch (e) { showToast(e.message || 'Export failed', 'error'); }
    btn.disabled = false;
  });
  modal.querySelector('[data-pdf]').addEventListener('click', () => {
    // Build the printable application from the live form state (reflects unsaved
    // edits; only includes SIN/DOB if they were revealed/typed into the form).
    try { creditAppPrintDoc(collect()); }
    catch (e) { showToast(e.message || 'Could not open the print view', 'error'); }
  });
  modal.querySelector('[data-submit]').addEventListener('click', async (ev) => {
    const btn = ev.currentTarget; btn.disabled = true; btn.textContent = 'Submitting…';
    try {
      await save();
      const provider = modal.querySelector('[data-provider]').value;
      const r = await fetch(`${API}/credit/application/${appId}/submit`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ provider }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Submit failed');
      showToast(j.message || 'Submitted.', j.mode === 'manual' ? 'info' : 'success');
    } catch (e) { showToast(e.message || 'Submit failed', 'error'); }
    btn.disabled = false; btn.textContent = 'Submit to lender';
  });
}
window.openCreditApp = openCreditApp;

// Printable credit application → opens a clean print window (Print / Save as PDF).
// Built from the live form object so it reflects unsaved edits; SIN/DOB appear only
// if they were revealed/typed into the form (otherwise shown as "on file").
function creditAppPrintDoc(d) {
  d = d || {};
  const esc2 = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const dealer = esc2(profileContext?.dealershipName || 'Dealership');
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const money = v => { const n = Number(v); return Number.isFinite(n) && String(v).trim() !== '' ? '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'; };
  const val = v => (v == null || String(v).trim() === '') ? '—' : esc2(v);
  // A labelled field cell.
  const cell = (label, v, wide) => `<div class="cell${wide ? ' wide' : ''}"><span class="lbl">${label}</span><span class="val">${v}</span></div>`;
  const tenure = o => { const y = o?.years, m = o?.months; if (!y && !m) return '—'; return `${y ? y + ' yr' : ''}${y && m ? ' ' : ''}${m ? m + ' mo' : ''}`.trim(); };

  const personBlock = (title, p) => {
    if (!p) return '';
    const ad = p.address || {}, em = p.employment || {}, oi = p.other_income || {};
    const sin = title.startsWith('Applicant') ? d.applicant_sin : d.co_sin;
    const dob = title.startsWith('Applicant') ? d.applicant_dob : d.co_dob;
    return `
    <div class="sec">
      <h2>${title}</h2>
      <div class="grid">
        ${cell('First name', val(p.first))}${cell('Middle', val(p.middle))}${cell('Last name', val(p.last))}
        ${cell('SIN', sin ? val(sin) : '•••• on file')}${cell('Date of birth', dob ? val(dob) : '•••• on file')}${cell('Marital status', val(p.marital))}
        ${cell('Email', val(p.email))}${cell('Cell phone', val(p.phone))}${cell('Home phone', val(p.phone_home))}
      </div>
      <h3>Residence</h3>
      <div class="grid">
        ${cell('Street', val(ad.street), true)}${cell('City', val(ad.city))}
        ${cell('Province', val(ad.province))}${cell('Postal', val(ad.postal))}${cell('Status', val(ad.status))}
        ${cell('Monthly payment', money(ad.payment))}${cell('Time at address', tenure(ad))}
      </div>
      <h3>Employment &amp; income</h3>
      <div class="grid">
        ${cell('Employer', val(em.employer), true)}${cell('Occupation', val(em.occupation))}
        ${cell('Status', val(em.status))}${cell('Work phone', val(em.phone))}${cell('Time employed', tenure(em))}
        ${cell('Gross monthly income', money(em.income_monthly))}${cell('Other income', money(oi.amount))}${cell('Other income source', val(oi.source))}
      </div>
    </div>`;
  };

  const veh = d.vehicle || {}, fin = d.financing || {};
  const vehicleBlock = `
    <div class="sec">
      <h2>Vehicle</h2>
      <div class="grid">
        ${cell('Year', val(veh.year))}${cell('Make', val(veh.make))}${cell('Model', val(veh.model))}${cell('Trim', val(veh.trim))}
        ${cell('VIN', val(veh.vin), true)}${cell('Mileage', val(veh.mileage))}${cell('Stock #', val(veh.stock))}
      </div>
    </div>`;
  const financeBlock = `
    <div class="sec">
      <h2>Financing</h2>
      <div class="grid">
        ${cell('Lender', val(fin.lender))}${cell('Program', val(fin.program))}${cell('Selling price', money(fin.selling_price))}${cell('Tax', money(fin.tax_amount))}
        ${cell('Fees', money(fin.fees_total))}${cell('Trade allowance', money(fin.trade_value))}${cell('Trade payoff', money(fin.trade_payoff))}${cell('Cash down', money(fin.down_payment))}
        ${cell('Rebate', money(fin.rebate))}${cell('Amount financed', money(fin.amount_financed))}${cell('APR', fin.apr ? esc2(fin.apr) + '%' : '—')}${cell('Term', fin.term ? esc2(fin.term) + ' mo' : '—')}
        ${cell('Frequency', val(fin.payment_freq))}${cell('Payment', money(fin.payment))}${cell('First payment', val(fin.first_payment_date))}
      </div>
    </div>`;

  const consentBlock = `
    <div class="sec consent">
      <h2>Consent &amp; authorization</h2>
      <p>The applicant${d.co_applicant ? ' and co-applicant' : ''} authorize ${dealer} and its lenders to obtain a consumer credit report and to verify the information provided in this application. ${d.consent ? '<b>Consent acknowledged electronically.</b>' : 'Consent must be provided by signature below.'}</p>
      <div class="sign">
        <div class="sigline"><span>Applicant signature</span><span>Date</span></div>
        ${d.co_applicant ? '<div class="sigline"><span>Co-applicant signature</span><span>Date</span></div>' : ''}
      </div>
    </div>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Credit Application — ${dealer}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 32px; font-size: 12px; }
    .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 16px; }
    .head h1 { font-size: 20px; margin: 0; color: #1e3a8a; }
    .head .sub { font-size: 11px; color: #64748b; margin-top: 2px; }
    .head .meta { text-align: right; font-size: 11px; color: #475569; }
    .sec { margin-bottom: 14px; break-inside: avoid; }
    .sec h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: #fff; background: #1e3a8a; padding: 4px 8px; margin: 0 0 8px; border-radius: 3px; }
    .sec h3 { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #64748b; margin: 8px 0 4px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 10px; }
    .cell { border-bottom: 1px solid #e2e8f0; padding: 2px 0 3px; min-height: 30px; }
    .cell.wide { grid-column: span 2; }
    .cell .lbl { display: block; font-size: 8.5px; text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; font-weight: 700; }
    .cell .val { display: block; font-size: 12px; color: #0f172a; min-height: 14px; }
    .consent p { font-size: 11px; line-height: 1.5; color: #334155; }
    .sign { margin-top: 22px; }
    .sigline { display: flex; gap: 24px; margin-top: 26px; }
    .sigline span { border-top: 1px solid #0f172a; padding-top: 3px; font-size: 10px; color: #64748b; }
    .sigline span:first-child { flex: 2; } .sigline span:last-child { flex: 1; }
    .foot { margin-top: 18px; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 6px; }
    .printbar { position: fixed; top: 10px; right: 10px; }
    .printbar button { background: #1e3a8a; color: #fff; border: 0; padding: 8px 14px; border-radius: 6px; font-weight: 700; cursor: pointer; }
    @media print { .printbar { display: none; } body { padding: 0; } }
  </style></head><body>
    <div class="printbar"><button onclick="window.print()">🖨 Print / Save as PDF</button></div>
    <div class="head">
      <div><h1>${dealer}</h1><div class="sub">Credit Application</div></div>
      <div class="meta">Date: ${today}</div>
    </div>
    ${personBlock('Applicant', d.applicant)}
    ${d.co_applicant ? personBlock('Co-applicant', d.co_applicant) : ''}
    ${vehicleBlock}
    ${financeBlock}
    ${consentBlock}
    <div class="foot">Generated by MarketSync · ${today}. This document contains confidential personal financial information — handle per your privacy policy.</div>
  </body></html>`;

  const w = window.open('', '_blank');
  if (!w) { showToast('Allow pop-ups to open the printable application.', 'error'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}
window.creditAppPrintDoc = creditAppPrintDoc;

function deskCompute(d) {
  const n = (v) => Number(v) || 0;
  // Selling price = Retail − rebate(before tax) + adjustment when a Retail/MSRP is
  // entered; otherwise a directly-typed selling price. Mirrors a DMS deal screen.
  const retail = n(d.retail), rebateBeforeTax = n(d.rebate_before_tax), adjustment = n(d.adjustment);
  const sellingPrice = retail > 0 ? Math.max(0, retail - rebateBeforeTax + adjustment) : n(d.selling_price);
  const addonsTotal = (d.addons || []).reduce((s, a) => s + n(a.price), 0);
  const fniTotal = (d.fni_items || []).reduce((s, a) => s + n(a.price), 0);
  const taxableFees = (d.fees || []).filter(f => f.taxable !== false).reduce((s, f) => s + n(f.amount), 0);
  const feesTotal = (d.fees || []).reduce((s, f) => s + n(f.amount), 0);
  const tradeValue = n(d.trade_value), tradePayoff = n(d.trade_payoff);
  const rate = n(d.tax_rate);
  // Component-based tax: a known jurisdiction itemises GST/PST/HST or state tax, each
  // on its own base ('diff' = trade-in reduces it). Unknown/custom → single manual rate.
  const baseFull = sellingPrice + addonsTotal + fniTotal + taxableFees;
  const baseDiff = Math.max(0, baseFull - tradeValue);
  const comps = (typeof deskTaxComps === 'function') ? deskTaxComps(d.tax_country, d.tax_province) : null;
  let taxAmount = 0; const taxBreakdown = [];
  if (comps && comps.length) {
    for (const c of comps) { const b = c.base === 'full' ? baseFull : baseDiff; const amt = b * c.rate / 100; taxAmount += amt; taxBreakdown.push({ label: c.label, rate: c.rate, amount: amt }); }
  } else {
    const b = d.tax_on_difference ? baseDiff : baseFull;
    taxAmount = b * rate / 100;
    taxBreakdown.push({ label: 'Tax', rate, amount: taxAmount });
  }
  const anyDiff = comps ? comps.some(c => c.base === 'diff') : !!d.tax_on_difference;
  const taxableBase = anyDiff ? baseDiff : baseFull;
  const cashPrice = sellingPrice + addonsTotal + fniTotal + feesTotal;
  const total = cashPrice + taxAmount;
  const down = n(d.down_payment), deposit = n(d.deposit_amount), rebate = n(d.rebate);
  const tradeEquity = tradeValue - tradePayoff;
  const amountFinanced = Math.max(0, total - down - deposit - rebate - tradeEquity);
  const apr = n(d.apr), term = n(d.term), freq = d.payment_freq || 'monthly';
  const perYear = freq === 'weekly' ? 52 : freq === 'biweekly' ? 26 : 12;
  const nPer = freq === 'monthly' ? term : Math.round(term / 12 * perYear);
  const r = apr / 100 / perYear;
  // Balloon / residual: a lump owed at the end of term. The regular payment amortises
  // only the financed amount net of the discounted balloon, so payments come down.
  const balloon = Math.min(n(d.balloon), amountFinanced);
  let payment = 0;
  if (amountFinanced > 0 && nPer > 0) {
    if (r > 0) {
      const pvBalloon = balloon / Math.pow(1 + r, nPer);
      payment = (r * (amountFinanced - pvBalloon)) / (1 - Math.pow(1 + r, -nPer));
    } else {
      payment = (amountFinanced - balloon) / nPer;
    }
  }
  const costOfBorrowing = payment * nPer + balloon - amountFinanced;
  const totalPayment = payment * nPer;
  // Cash the customer still brings at delivery = cash down not yet covered by the deposit.
  const dueOnDelivery = Math.max(0, down - deposit);
  const deferralDays = n(d.deferral_days);

  // F&I reserve — the finance charge kept from selling above the lender's buy rate.
  const buyRate = n(d.buy_rate);
  let reserve = 0;
  if (amountFinanced > 0 && nPer > 0 && buyRate > 0 && apr > buyRate) {
    const payAt = (rt) => { const rr = rt / 100 / perYear; if (rr > 0) { const pv = balloon / Math.pow(1 + rr, nPer); return (rr * (amountFinanced - pv)) / (1 - Math.pow(1 + rr, -nPer)); } return (amountFinanced - balloon) / nPer; };
    reserve = Math.max(0, (payment - payAt(buyRate)) * nPer);
  }

  // Lease — depreciation + finance (money factor = APR/2400), tax per payment.
  const isLease = (d.deal_type === 'Lease');
  const residual = n(d.residual_amount);
  let leasePayment = 0, leaseDepreciation = 0, leaseFinance = 0, leaseTaxAmt = 0, adjCap = 0;
  if (isLease) {
    const months = term > 0 ? term : 0;
    const capReduction = down + deposit + rebate + tradeEquity;
    adjCap = Math.max(0, cashPrice - capReduction);
    if (months > 0) {
      const mf = apr / 2400;
      leaseDepreciation = (adjCap - residual) / months;
      leaseFinance = (adjCap + residual) * mf;
      const base = Math.max(0, leaseDepreciation + leaseFinance);
      leaseTaxAmt = base * rate / 100;
      leasePayment = base + leaseTaxAmt;
    }
  }

  return { sellingPrice, retail, rebateBeforeTax, adjustment, addonsTotal, fniTotal, taxableFees, feesTotal, taxableBase, taxAmount, taxBreakdown, cashPrice, total, tradeValue, tradePayoff, tradeEquity, down, deposit, rebate, balloon, amountFinanced, apr, term, freq, perYear, nPer, payment, costOfBorrowing, totalPayment, dueOnDelivery, deferralDays, rate, buyRate, reserve, isLease, residual, adjCap, leasePayment, leaseDepreciation, leaseFinance, leaseTaxAmt };
}

// Multi-jurisdiction sales-tax engine. Each region lists its tax COMPONENTS
// [label, rate%, base] where base 'diff' = trade-in reduces the taxable amount,
// 'full' = taxed on the whole price. Canada is modelled precisely (GST + PST/QST or
// HST, itemised on the bill of sale). U.S. entries are the STATE base rate — add your
// local/county rate and verify the vehicle-specific rate + trade-in rule.
const US_STATE_TAX = [
  // code, name, state base rate %, trade-in credit? (true = tax on difference), avg local/county add-on %
  // The 5th column is the state's AVERAGE combined local (county+city) sales-tax rate
  // (Tax Foundation). It's an editable estimate so US deals default to a realistic
  // combined rate instead of the bare state base — the exact local rate depends on the
  // buyer's registration address and should be confirmed per deal.
  ['AL', 'Alabama', 4, true, 5.29], ['AK', 'Alaska', 0, true, 1.82], ['AZ', 'Arizona', 5.6, true, 2.80], ['AR', 'Arkansas', 6.5, true, 2.95],
  ['CA', 'California', 7.25, false, 1.57], ['CO', 'Colorado', 2.9, true, 4.91], ['CT', 'Connecticut', 6.35, true, 0], ['DE', 'Delaware', 0, true, 0],
  ['DC', 'District of Columbia', 6, false, 0], ['FL', 'Florida', 6, true, 1.00], ['GA', 'Georgia', 4, true, 3.38], ['HI', 'Hawaii', 4, false, 0.50],
  ['ID', 'Idaho', 6, true, 0.02], ['IL', 'Illinois', 6.25, true, 2.60], ['IN', 'Indiana', 7, true, 0], ['IA', 'Iowa', 6, true, 0.94],
  ['KS', 'Kansas', 6.5, true, 2.25], ['KY', 'Kentucky', 6, false, 0], ['LA', 'Louisiana', 4.45, true, 5.11], ['ME', 'Maine', 5.5, true, 0],
  ['MD', 'Maryland', 6, false, 0], ['MA', 'Massachusetts', 6.25, true, 0], ['MI', 'Michigan', 6, false, 0], ['MN', 'Minnesota', 6.875, true, 0.66],
  ['MS', 'Mississippi', 7, true, 0.06], ['MO', 'Missouri', 4.225, true, 4.09], ['MT', 'Montana', 0, true, 0], ['NE', 'Nebraska', 5.5, true, 1.47],
  ['NV', 'Nevada', 6.85, true, 1.39], ['NH', 'New Hampshire', 0, true, 0], ['NJ', 'New Jersey', 6.625, true, 0], ['NM', 'New Mexico', 4.875, true, 2.72],
  ['NY', 'New York', 4, true, 4.53], ['NC', 'North Carolina', 4.75, true, 2.25], ['ND', 'North Dakota', 5, true, 2.04], ['OH', 'Ohio', 5.75, true, 1.49],
  ['OK', 'Oklahoma', 4.5, true, 4.49], ['OR', 'Oregon', 0, true, 0], ['PA', 'Pennsylvania', 6, true, 0.34], ['RI', 'Rhode Island', 7, true, 0],
  ['SC', 'South Carolina', 6, true, 1.50], ['SD', 'South Dakota', 4.2, true, 1.91], ['TN', 'Tennessee', 7, true, 2.55], ['TX', 'Texas', 6.25, true, 1.95],
  ['UT', 'Utah', 4.85, true, 1.15], ['VT', 'Vermont', 6, true, 0.36], ['VA', 'Virginia', 4.3, false, 0.47], ['WA', 'Washington', 6.5, true, 2.87],
  ['WV', 'West Virginia', 6, true, 0.57], ['WI', 'Wisconsin', 5, true, 0.44], ['WY', 'Wyoming', 4, true, 1.44],
];
const DESK_TAX = {
  CA: { label: 'Canada', regions: {
    AB: { label: 'Alberta', comp: [['GST', 5, 'diff']] },
    BC: { label: 'British Columbia', comp: [['GST', 5, 'diff'], ['PST', 7, 'diff']] },
    MB: { label: 'Manitoba', comp: [['GST', 5, 'diff'], ['RST', 7, 'diff']] },
    NB: { label: 'New Brunswick', comp: [['HST', 15, 'diff']] },
    NL: { label: 'Newfoundland & Labrador', comp: [['HST', 15, 'diff']] },
    NS: { label: 'Nova Scotia', comp: [['HST', 14, 'diff']] },
    NT: { label: 'Northwest Territories', comp: [['GST', 5, 'diff']] },
    NU: { label: 'Nunavut', comp: [['GST', 5, 'diff']] },
    ON: { label: 'Ontario', comp: [['HST', 13, 'diff']] },
    PE: { label: 'Prince Edward Island', comp: [['HST', 15, 'diff']] },
    QC: { label: 'Quebec', comp: [['GST', 5, 'diff'], ['QST', 9.975, 'diff']] },
    SK: { label: 'Saskatchewan', comp: [['GST', 5, 'diff'], ['PST', 6, 'diff']] },
    YT: { label: 'Yukon', comp: [['GST', 5, 'diff']] },
  } },
  // US: state tax + an average local/county line (both on the same base). The local
  // line is an editable estimate — override the combined rate per deal for the buyer's
  // exact jurisdiction.
  US: { label: 'United States', regions: Object.fromEntries(US_STATE_TAX.map(([c, n, r, credit, local]) => {
    const base = credit ? 'diff' : 'full';
    const comp = [['State tax', r, base]];
    if (local > 0) comp.push(['Local (avg)', local, base]);
    return [c, { label: n, comp }];
  })) },
};
function deskTaxComps(country, region) {
  const j = DESK_TAX[country]; const r = j && j.regions[region];
  return r ? r.comp.map(([label, rate, base]) => ({ label, rate, base: base === 'full' ? 'full' : 'diff' })) : null;
}
// Country change rebuilds the region list; region change auto-fills the combined rate.
function deskSetCountry() {
  const country = document.getElementById('dk-tax_country')?.value || '';
  const sel = document.getElementById('dk-tax_province');
  if (sel) {
    const regions = DESK_TAX[country]?.regions || {};
    sel.innerHTML = '<option value="">— Select —</option>' + Object.entries(regions).map(([code, r]) => `<option value="${code}">${esc(r.label)}</option>`).join('');
  }
  deskSetJurisdiction();
}
window.deskSetCountry = deskSetCountry;
function deskSetJurisdiction() {
  const country = document.getElementById('dk-tax_country')?.value || '';
  const region = document.getElementById('dk-tax_province')?.value || '';
  const comps = deskTaxComps(country, region);
  if (comps && comps.length) {
    const sum = comps.reduce((s, c) => s + c.rate, 0);
    const rt = document.getElementById('dk-tax_rate'); if (rt) rt.value = Math.round(sum * 1000) / 1000;
    const td = document.getElementById('dk-tax_on_difference'); if (td) td.checked = comps.every(c => c.base === 'diff');
  }
  deskRenderSummary();
}
window.deskSetJurisdiction = deskSetJurisdiction;
function deskRenderSummary() {
  const box = document.getElementById('desk-summary');
  if (!box) return;
  const d = deskCollect(null);
  const c = deskCompute(d);
  const freqLabel = c.freq === 'weekly' ? '/wk' : c.freq === 'biweekly' ? '/2wk' : '/mo';
  const row = (l, v, strong) => `<div class="flex justify-between ${strong ? 'font-black text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}"><span>${l}</span><span>${v}</span></div>`;
  box.innerHTML = `
    <div class="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-3">Deal summary</div>
    <div class="space-y-1.5 text-sm">
      ${c.retail ? row('Retail / MSRP', deskM(c.retail)) : ''}
      ${c.rebateBeforeTax ? row('Rebate (before tax)', '−' + deskM(c.rebateBeforeTax)) : ''}
      ${c.adjustment ? row('Adjustment', (c.adjustment >= 0 ? '+' : '−') + deskM(Math.abs(c.adjustment))) : ''}
      ${row('Selling price', deskM(c.sellingPrice), true)}
      ${c.addonsTotal ? row('Add-ons', deskM(c.addonsTotal)) : ''}
      ${c.fniTotal ? row('F&I products', deskM(c.fniTotal)) : ''}
      ${c.feesTotal ? row('Fees', deskM(c.feesTotal)) : ''}
      ${c.tradeValue ? row('Trade allowance', '−' + deskM(c.tradeValue)) : ''}
      <div class="border-t border-slate-200 dark:border-slate-800 my-1.5"></div>
      ${row(`Taxable amount`, deskM(c.taxableBase))}
      ${(c.taxBreakdown || []).map(t => row(`${esc(t.label)} (${t.rate}%)`, deskM(t.amount))).join('')}
      ${row('Total', deskM(c.total), true)}
      <div class="border-t border-slate-200 dark:border-slate-800 my-1.5"></div>
      ${c.down ? row('Cash down', '−' + deskM(c.down)) : ''}
      ${c.rebate ? row('Rebate (after tax)', '−' + deskM(c.rebate)) : ''}
      ${(c.tradeValue || c.tradePayoff) ? row('Net trade', (c.tradeEquity >= 0 ? '−' : '+') + deskM(Math.abs(c.tradeEquity))) : ''}
      ${row('Amount financed', deskM(c.amountFinanced), true)}
      ${c.balloon ? row('Balloon / residual', deskM(c.balloon)) : ''}
      ${(__deskDealer?.costOn && Number(d.cost) > 0) ? (() => {
        const cost = Number(d.cost);
        const frontGross = c.sellingPrice - cost;
        // Net out F&I product cost when the lines carry it (catalog products do).
        const fniCost = __deskFni.reduce((s, r) => s + (Number(r.cost) || 0), 0);
        const fniGross = (c.fniTotal || 0) - fniCost;
        const backGross = fniGross + (c.reserve || 0);
        const totalGross = frontGross + backGross;
        const costKnown = fniCost > 0;
        return `
      <div class="mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-3 py-2 space-y-1">
        <div class="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-bold">Internal — not shown to customer</div>
        ${row('Vehicle cost', deskM(cost))}
        <div class="text-[10px] uppercase tracking-wider text-slate-400 font-bold pt-1">Front-end</div>
        ${row('Front gross', deskM(frontGross), true)}
        ${(c.fniTotal || c.reserve) ? `<div class="text-[10px] uppercase tracking-wider text-slate-400 font-bold pt-1">Back-end (F&amp;I)</div>` : ''}
        ${c.fniTotal ? row('F&I products', deskM(c.fniTotal)) : ''}
        ${costKnown ? row('− F&I product cost', '−' + deskM(fniCost)) : ''}
        ${c.reserve ? row('Finance reserve', deskM(c.reserve)) : ''}
        ${(c.fniTotal || c.reserve) ? row('Back gross', deskM(backGross), true) : ''}
        <div class="border-t border-amber-200 dark:border-amber-900 my-1"></div>
        ${row('Total gross', deskM(totalGross), true)}
        ${(c.fniTotal && !costKnown) ? `<p class="text-[9.5px] text-amber-600/80 dark:text-amber-400/70 leading-snug">F&amp;I shown at retail — add product cost in the catalog for true back gross.</p>` : ''}
      </div>`; })() : ''}
    </div>
    ${c.isLease ? `
    <div class="mt-3 bg-violet-600 text-white rounded-lg px-4 py-3">
      <div class="text-[11px] uppercase tracking-wider opacity-80">Lease payment</div>
      <div class="text-2xl font-black">${deskM(c.leasePayment)}<span class="text-sm font-bold opacity-80"> /mo</span></div>
      <div class="text-[11px] opacity-80 mt-0.5">${c.term} mo · residual ${deskM(c.residual)} · depr ${deskM(c.leaseDepreciation)} + finance ${deskM(c.leaseFinance)} + tax ${deskM(c.leaseTaxAmt)} per mo</div>
    </div>` : `
    <div class="mt-3 bg-indigo-600 text-white rounded-lg px-4 py-3">
      <div class="text-[11px] uppercase tracking-wider opacity-80">Estimated payment</div>
      <div class="text-2xl font-black">${deskM(c.payment)}<span class="text-sm font-bold opacity-80">${freqLabel}</span></div>
      <div class="text-[11px] opacity-80 mt-0.5">${c.apr}% APR · ${c.nPer} payments · total ${deskM(c.totalPayment)} · cost of borrowing ${deskM(Math.max(0, c.costOfBorrowing))}${c.deferralDays ? ` · ${c.deferralDays}-day deferral` : ''}</div>
    </div>`}
    ${c.reserve > 0 ? `<div class="mt-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2 flex items-center justify-between"><span class="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-bold">F&amp;I reserve · internal</span><span class="font-black text-amber-700 dark:text-amber-300">${deskM(c.reserve)}</span></div>` : ''}
    <div class="mt-2 grid grid-cols-2 gap-2 text-sm">
      <div class="bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-2"><div class="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Deposit</div><div class="font-black text-slate-900 dark:text-white">${deskM(c.deposit)}</div></div>
      <div class="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-3 py-2"><div class="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold">Due on delivery</div><div class="font-black text-emerald-700 dark:text-emerald-300">${deskM(c.dueOnDelivery)}</div></div>
    </div>
    <p class="text-[10px] text-slate-400 mt-2 leading-snug">Estimate only, on approved credit. Rate is an example, not a lender commitment. Tax auto-filled from the selected jurisdiction (U.S. = state base rate — add local/county rate); verify vehicle-specific rates and trade-in rules before contract.</p>`;
  deskScheduleCommPreview();
}
// The rep touched a commission field → respect the manual number, stop auto-filling.
function deskCommTouch() { __deskCommTouched = true; }
window.deskCommTouch = deskCommTouch;
// Debounced live commission estimate. Asks the backend what the plan would pay on
// the current draft and drops it into the Vehicle/F&I commission fields — unless the
// rep has manually overridden them. Silent no-op when the store has no plan.
function deskScheduleCommPreview() {
  clearTimeout(__deskCommTimer);
  __deskCommTimer = setTimeout(deskPreviewCommission, 500);
}
async function deskPreviewCommission() {
  if (__deskCommTouched) return;
  const veh = document.getElementById('dk-vehicle_commission');
  const fni = document.getElementById('dk-fni_commission');
  if (!veh && !fni) return;
  const d = deskCollect(null);
  try {
    const r = await apiSendJson('/commissions/preview', 'POST', {
      selling_price: d.selling_price, cost: d.cost,
      fni_items: d.fni_items, fni_manager_id: d.fni_manager_id,
    });
    if (!r?.has_plan || __deskCommTouched) return;   // re-check: rep may have typed while we waited
    if (veh) veh.value = r.vehicle_commission != null ? r.vehicle_commission : '';
    if (fni) fni.value = r.fni_commission != null ? r.fni_commission : '';
  } catch {}
}
window.deskPreviewCommission = deskPreviewCommission;
// Retail/MSRP → Selling price: keep the selling-price input in sync as the manager
// types Retail, before-tax rebate or adjustment (matches a DMS deal screen).
function deskPriceRecalc() {
  const n = (id) => { const el = document.getElementById(id); const v = el ? msNum(el.value) : NaN; return Number.isFinite(v) ? v : 0; };
  const retail = n('dk-retail');
  const sp = document.getElementById('dk-selling_price');
  if (sp && retail > 0) sp.value = msFmtMoney(Math.max(0, retail - n('dk-rebate_before_tax') + n('dk-adjustment')).toFixed(2));
  deskRenderSummary();
}
window.deskPriceRecalc = deskPriceRecalc;

// Persist the current form to the deal record (no toast / re-render) — shared by
// Save deal and the status actions so a status change always saves the latest edits.
async function deskPersist(contactId) {
  const d = deskCollect(contactId);
  const c = deskCompute(d);
  d.tax_amount = Math.round(c.taxAmount * 100) / 100;
  d.total_price = Math.round(c.total * 100) / 100;
  d.amount_financed = Math.round(c.amountFinanced * 100) / 100;
  d.payment = Math.round(c.payment * 100) / 100;
  const res = await fetch(`${API}/reports/deal`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Save failed');
  const body = await res.json();
  __deskDeal = { ...__deskDeal, ...(body.deal || {}) };
  if (body.customer_number) __deskCustomerNumber = body.customer_number;
  if (body.salesperson) __deskSalesperson = body.salesperson;
  return body;
}
async function deskSave(contactId) {
  const btn = document.getElementById('desk-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    const body = await deskPersist(contactId);
    showToast(`Deal saved · Deal #${body.deal?.deal_number || '—'}${body.vehicle_pending ? ' · vehicle marked pending' : ''}`, 'success');
    deskRenderForm(contactId);   // re-render so the new Customer #/Deal # show
    if (btn) { btn.disabled = false; btn.textContent = 'Saved ✓'; setTimeout(() => { if (btn) btn.textContent = 'Save deal'; }, 1500); }
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Save deal'; }
    showToast(e.message || 'Could not save the deal', 'error');
  }
}
// The deal-lifecycle action bar on the desk (managers + F&I). Renders the current
// status chip plus the next-step buttons: Pending credit app → Sold → Delivered.
function deskStatusBar(contactId) {
  if (!['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role)) return '';
  const st = __deskDeal?.deal_status || 'working';
  const CHIP = {
    working: ['Working', 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'],
    pending_credit: ['Pending credit app', 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300'],
    sold: ['Sold · Not delivered', 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300'],
    delivered: ['Delivered', 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'],
  };
  const chip = CHIP[st] || CHIP.working;
  const btn = (action, label, cls) => `<button type="button" onclick="deskSetStatus('${action}','${contactId}')" class="${cls} text-sm font-bold px-3 py-2 rounded-lg transition">${label}</button>`;
  let actions = '';
  if (st === 'working') {
    actions = `<div class="grid grid-cols-2 gap-2">
        ${btn('pending_credit', 'Pending credit app', 'bg-orange-600 hover:bg-orange-500 text-white')}
        ${btn('cash', 'Cash deal — Sold', 'bg-emerald-600 hover:bg-emerald-500 text-white')}
      </div>
      <div class="mt-2">${btn('sold', 'Financed — Mark sold', 'w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200')}</div>`;
  } else if (st === 'pending_credit') {
    actions = `<div>${btn('sold', 'Credit approved — Mark sold', 'w-full bg-emerald-600 hover:bg-emerald-500 text-white')}</div>`;
  } else if (st === 'sold') {
    actions = `<div>${btn('delivered', 'Mark delivered', 'w-full bg-emerald-600 hover:bg-emerald-500 text-white')}</div>`;
  } else if (st === 'delivered') {
    actions = `<div class="text-center text-sm font-bold text-emerald-600 dark:text-emerald-400 py-1">Delivered ✓</div>`;
  }
  return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
      <div class="flex items-center justify-between mb-2">
        <span class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Deal status</span>
        <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${chip[1]}">${chip[0]}</span>
      </div>
      ${actions}
      <p class="text-[10px] text-slate-400 mt-2 leading-snug">Marking sold moves the customer to your Sold list; the vehicle status updates automatically.</p>
    </div>`;
}
// Advance the deal through its lifecycle. Saves the latest form first, transitions
// the deal + vehicle, then moves the customer's CRM status so pipeline tags update.
async function deskSetStatus(action, contactId) {
  const CONTACT_STATUS = { pending_credit: 'turnover', cash: 'sold', sold: 'sold', delivered: 'delivered' };
  const DONE = { pending_credit: 'Marked pending credit app', cash: 'Cash deal closed — Sold', sold: 'Marked sold', delivered: 'Marked delivered' };
  const cStatus = CONTACT_STATUS[action];
  // Capture where a sale came from (feeds the ROI "sales by source" report).
  const soldSource = (action === 'cash' || action === 'sold') ? askSoldSource() : null;
  const bar = document.getElementById('desk-status-bar');
  if (bar) bar.style.opacity = '0.5';
  try {
    await deskPersist(contactId);   // ensure the deal row + numbers exist and are current
    const r = await apiSendJson('/reports/deal/status', 'POST', { contact_id: contactId, action });
    if (cStatus) {
      const body = { status: cStatus };
      if (soldSource) body.sold_source = soldSource;
      await apiSendJson(`/crm/contacts/${contactId}`, 'PUT', body);
    }
    __deskDeal.deal_status = r.deal_status || __deskDeal.deal_status;
    showToast(DONE[action] + ' ✓', 'success');
    deskRenderForm(contactId);
  } catch (e) {
    if (bar) bar.style.opacity = '1';
    showToast(e.message || 'Could not update the deal', 'error');
  }
}

// Save the dealer legal details used on the documents (admins only).
async function deskSaveDealer(btn) {
  const g = (id) => (document.getElementById(id)?.value || '').trim();
  const payload = { legal_name: g('dlr-legal_name'), street_address: g('dlr-street_address'), phone: g('dlr-phone'), fax: g('dlr-fax'), hst_number: g('dlr-hst_number'), omvic_reg: g('dlr-omvic_reg') };
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    const res = await fetch(`${API}/ai/config`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Save failed');
    __deskDealer = { ...__deskDealer, name: payload.legal_name || __deskDealer.name, street: payload.street_address || null, phone: payload.phone || null, fax: payload.fax || null, hst: payload.hst_number || null, omvic: payload.omvic_reg || null };
    // Once the required doc fields are complete, this one-time setup block leaves the
    // desk — it now lives in Settings › Dealer Management for future edits.
    const complete = !!(__deskDealer.hst && __deskDealer.omvic && __deskDealer.street);
    if (complete) {
      document.getElementById('desk-dealer-setup')?.remove();
      showToast('Dealer details saved — you can edit them anytime in Settings › Dealer Management', 'success');
    } else {
      showToast('Saved. Add the HST #, OMVIC # and street address to finish setup.', 'success');
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Saved ✓'; setTimeout(() => { if (btn) btn.textContent = 'Save dealer details'; }, 1500); }
  } catch (e) { if (btn) { btn.disabled = false; btn.textContent = 'Save dealer details'; } showToast(e.message || 'Could not save', 'error'); }
}

// ── Printed documents: Estimate + OMVIC-style Bill of Sale ───────────────────
function deskPrint(kind, opts = {}) {
  const d = deskCollect(null);
  const c = deskCompute(d);
  if (!(c.sellingPrice > 0)) { showToast('Enter a selling price first', 'error'); return; }
  const dealer = __deskDealer || {};
  const b = __deskBuyer || {};
  const veh = d.vehicle || {};
  const ins = d.insurance || {};
  const money = (n) => deskM(n);
  const today = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
  const buyerName = b.full_name || [b.first_name, b.last_name].filter(Boolean).join(' ') || 'Customer';
  const coBuyer = (d.co_buyer || '').trim();
  const vlabel = [veh.year, veh.make, veh.model, veh.trim].filter(Boolean).join(' ') || '—';
  const isNew = String(veh.year) === String(new Date().getFullYear() + 1) || String(veh.year) === String(new Date().getFullYear());
  const condLabel = isNew ? 'New' : 'Used';
  const dealerLine = [dealer.street, dealer.city, dealer.province, dealer.postal].filter(Boolean).join(', ') + (dealer.phone ? ` · Tel: ${dealer.phone}` : '') + (dealer.fax ? ` · Fax: ${dealer.fax}` : '');
  const km = (v) => v != null && v !== '' ? Number(v).toLocaleString() + ' km' : '';
  const dealNo = __deskDeal.deal_number ? String(__deskDeal.deal_number) : (__deskDeal.id ? String(__deskDeal.id).replace(/-/g, '').slice(0, 8).toUpperCase() : '—');
  const custNo = __deskCustomerNumber ? String(__deskCustomerNumber) : '—';
  const sp = __deskSalesperson || {};

  // A boxed field (label above value) — the OMVIC face-sheet look.
  const F = (label, val) => `<div class="fx"><div class="fl">${label}</div><div class="fv">${val != null && val !== '' ? esc(String(val)) : '&nbsp;'}</div></div>`;
  const priceRow = (l, v, opts = {}) => `<tr${opts.strong ? ' style="font-weight:800"' : ''}${opts.top ? ' class="ptop"' : ''}><td>${l}</td><td style="text-align:right">${v}</td></tr>`;

  // ── Price information (matches a dealer bill of sale ordering) ──────────────
  const taxRows = [];
  taxRows.push(priceRow('Total vehicle price', money(c.sellingPrice)));
  (d.addons || []).forEach(a => taxRows.push(priceRow(esc(a.name || 'Add-on'), money(a.price))));
  (d.fni_items || []).forEach(a => taxRows.push(priceRow(esc(a.name || 'F&I product'), money(a.price))));
  (d.fees || []).filter(f => f.taxable !== false).forEach(f => taxRows.push(priceRow(esc(f.name), money(f.amount))));
  if (c.tradeValue) taxRows.push(priceRow('Less trade-in allowance', '−' + money(c.tradeValue)));
  const nonTaxFees = (d.fees || []).filter(f => f.taxable === false);

  const priceInfo = `
    <table class="ptbl"><tbody>
      ${taxRows.join('')}
      ${priceRow('Subtotal (taxable)', money(c.taxableBase), { top: true })}
      ${(c.taxBreakdown || []).map(t => priceRow(`${esc(t.label)} (${t.rate}%)`, money(t.amount))).join('')}
      ${priceRow('Subtotal', money(c.taxableBase + c.taxAmount), { top: true })}
      ${nonTaxFees.map(f => priceRow(esc(f.name) + ' <span class="mut">(no tax)</span>', money(f.amount))).join('')}
      ${priceRow('Total', money(c.total), { strong: true, top: true })}
      ${c.tradePayoff ? priceRow('Trade-in lien payoff', money(c.tradePayoff)) : ''}
      ${c.down ? priceRow('Cash down', '−' + money(c.down)) : ''}
      ${c.deposit ? priceRow('Deposit', '−' + money(c.deposit)) : ''}
      ${c.rebate ? priceRow('Rebate / incentive', '−' + money(c.rebate)) : ''}
      ${priceRow(d.deal_type === 'Cash' ? 'Balance due' : 'Amount financed', money(c.amountFinanced), { strong: true, top: true })}
    </tbody></table>`;

  const financeTerms = (d.deal_type === 'Cash') ? '' : `
    <div class="sec"><div class="sech">Finance terms — estimate</div>
      <div class="fgrid">
        ${F('Lender', d.finance_company || '')}${F('APR', (c.apr || 0) + '%')}${F('Amortization', (c.term || 0) + ' mo')}
        ${F('Frequency', c.freq === 'weekly' ? 'Weekly' : c.freq === 'biweekly' ? 'Bi-weekly' : 'Monthly')}${F('# Payments', c.nPer)}${F('Payment', money(c.payment))}
        ${F('Cost of borrowing', money(Math.max(0, c.costOfBorrowing)))}${F('Total of payments', money(c.payment * c.nPer))}${F('1st payment', d.first_payment_date || '')}
      </div>
      <p class="mut" style="margin-top:6px">Financing is arranged through a third-party lender. Payment, rate and term are estimates on approved credit and are not a commitment to lend; final terms are set by the lender and the signed finance contract.</p>
    </div>`;

  const tradeBlock = (d.trade_desc || d.trade_value) ? `
    <div class="sec"><div class="sech">Trade-in vehicle</div>
      <div class="fgrid">
        ${F('Description', d.trade_desc || '')}${F('VIN', d.trade_vin || '')}${F('Allowance', d.trade_value ? money(d.trade_value) : '')}
        ${F('Lien / payoff', d.trade_payoff ? money(d.trade_payoff) : '')}
      </div>
    </div>` : '';

  // ── Estimate: single clean page, non-binding ───────────────────────────────
  if (kind !== 'bill') {
    const header = (typeof apprBrandedHeader === 'function')
      ? apprBrandedHeader('Purchase Estimate', 'Working estimate — not a contract', dealer.name || 'Dealership', [dealer.city, dealer.province, dealer.postal].filter(Boolean).join(', '), dealer.logo || null, today)
      : `<div class="head"><div><h1>${esc(dealer.name || 'Dealership')}</h1></div><div style="text-align:right"><h1>Purchase Estimate</h1><div class="mut">${today}</div></div></div>`;
    const inner = `<style>${DESK_DOC_CSS}</style>${header}
      <div class="grid2" style="margin-top:12px">
        <div class="sec"><div class="sech">Buyer</div><div class="fgrid">${F('Name', buyerName)}${coBuyer ? F('Co-buyer', coBuyer) : ''}${F('Phone', b.phone || b.phone_mobile)}${F('Email', b.email)}</div></div>
        <div class="sec"><div class="sech">Vehicle</div><div class="fgrid">${F('Vehicle', vlabel)}${F('VIN', veh.vin)}${F('Odometer', km(veh.mileage))}</div></div>
      </div>
      <div class="sec"><div class="sech">Price information</div>${priceInfo}</div>
      ${financeTerms}
      <p class="mut" style="margin-top:12px">This is a working estimate prepared for the customer's convenience and is <b>not a contract or an offer to sell</b>. Prices, taxes, fees, rates and availability are subject to change and to final verification. Figures assume approved credit.</p>`;
    if (opts.returnHtml) return { title: 'Purchase Estimate', doc_type: 'estimate', html: inner };
    if (typeof apprPrintWindow === 'function') apprPrintWindow('Purchase Estimate', inner);
    return;
  }

  // ── Bill of Sale: OMVIC-style multi-page agreement ─────────────────────────
  const idBand = `
    <div class="band">
      <div class="bandtitle">${condLabel.toUpperCase()} MOTOR VEHICLE PURCHASE AGREEMENT</div>
      <div class="idline">${[dealer.hst ? 'HST# ' + esc(dealer.hst) : '', dealer.omvic ? 'Dealer Reg# ' + esc(dealer.omvic) : '', 'Deal# ' + dealNo, 'Customer# ' + custNo, veh.stock ? 'Stock# ' + esc(veh.stock) : ''].filter(Boolean).join(' &nbsp;|&nbsp; ')}</div>
      <div class="idline"><b>${esc(dealer.name || 'Dealership')}</b> — ${esc(dealerLine)}</div>
      ${d.fni_manager ? `<div class="idline">F&amp;I Manager: <b>${esc(d.fni_manager)}</b></div>` : ''}
    </div>`;

  const face = `
    ${idBand}
    <div class="grid2" style="margin-top:10px">
      <div class="sec"><div class="sech">Buyer</div><div class="fgrid">
        ${F('Name', buyerName)}${coBuyer ? F('Co-buyer', coBuyer) : ''}${F('Phone', b.phone || b.phone_mobile)}${F('Driver’s licence', b.dl_number)}
        ${F('Address', [b.address, [b.city, b.province, b.postal_code].filter(Boolean).join(', ')].filter(Boolean).join(', '))}${F('Email', b.email)}${F('Date of sale', today)}
      </div>
      <div class="fgrid" style="margin-top:6px">${F('Insurance company', ins.company)}${F('Policy no.', ins.policy)}${F('Expiry', ins.expiry)}</div></div>
      <div class="sec"><div class="sech">Vehicle</div><div class="fgrid">
        ${F('Year', veh.year)}${F('Type', condLabel)}${F('Make', veh.make)}
        ${F('Model', veh.model)}${F('Trim', veh.trim)}${F('Ext. colour', veh.color)}
        ${F('VIN', veh.vin)}${F('Odometer', km(veh.mileage))}${F('Delivery date', d.delivery_date || today)}
      </div></div>
    </div>

    <p class="ack">I, the purchaser, <b>${esc(buyerName)}</b>, agree to purchase the following vehicle from the dealer on the terms set out in this agreement, including the vehicle information document which forms part of this agreement.</p>

    <div class="grid2">
      <div class="sec"><div class="sech">Price information</div>${priceInfo}
        <p class="mut" style="margin-top:6px">All-in price includes all fees and charges required to be disclosed, excluding HST and licensing, per the Ontario Motor Vehicle Dealers Act, 2002. Vehicle to be registered in Canada only.</p>
      </div>
      <div>
        <div class="initbox"><b>Privacy Statement:</b> By signing this contract you consent to the dealer contacting you in the future to the sharing of information with associated businesses so that they may provide you with timely information about their services. You may withdraw your consent in writing at any time. <span class="init">Initials ______</span></div>
        <div class="initbox"><b>Incentive:</b> The dealership receives a fee from the institution that is providing my financing. <span class="init">Initials ______</span></div>
        <div class="initbox"><b>Financing Information:</b> I confirm that the financial institution providing financing for the purchase of this vehicle has provided me with the initial disclosure statement regarding financial information as required under the Consumer Protection Act, 2002. <span class="init">Initials ______</span></div>
        <div class="initbox">I have received the vehicle information required under the Motor Vehicle Dealers Act, 2002. <span class="init">Initials ______</span></div>
        <div class="initbox"><b>Service Plan:</b> This vehicle was sold with a service plan? &nbsp;&nbsp;YES&nbsp;&nbsp;/&nbsp;&nbsp;NO <span class="init">Initials ______</span></div>
      </div>
    </div>

    ${tradeBlock}
    ${financeTerms}

    <p class="ack" style="margin-top:10px">This vehicle to be acquired for registration in Canada only. I acknowledge having read all the terms of the contract, including the pages that make up the entire contract. I understand these terms make up the entire contract.</p>
    <div class="sech" style="margin-top:8px">Sales Final</div>
    <p class="dis">Please review the entire contract, including all attached statements, before signing. This contract is final and binding once you have signed it unless the motor vehicle dealer has failed to comply with certain legal obligations.</p>
    <div class="sig">
      <div>${esc(buyerName)} — Purchaser Signature &amp; date</div>
      ${coBuyer ? `<div>${esc(coBuyer)} — Co-Purchaser Signature &amp; date</div>` : ''}
      <div>${esc(sp.name || '')}${sp.registration_id ? ' &nbsp; Prov License #' + esc(sp.registration_id) : ''} — Authorized Rep, signature &amp; date</div>
    </div>`;

  // Standard Ontario disclosure checklist (unchecked boxes for manual completion).
  const box = '<span class="ck">☐</span>';
  const disclosure = (heading) => `
    <div class="sech">${heading}</div>
    <p class="dis"><b>1. Odometer.</b> The vehicle is used and has been driven approximately ______ km. ${box} We cannot determine the total distance driven prior to a date. ${box} We do not know the total distance driven. ${box} The odometer is broken/faulty. ${box} The odometer has been replaced. ${box} The odometer has been rolled back. ${box} The odometer accurately records the true distance travelled.</p>
    <p class="dis"><b>2. Prior use.</b> ${box} Previously a daily rental. ${box} Previously a police/emergency vehicle. ${box} Previously a taxi or limousine.</p>
    <p class="dis"><b>3. Prior damage.</b> ${box} Fire damage. ${box} Immersion/flood to the interior floorboards. ${box} Structural damage. ${box} Structural repairs/alterations. ${box} Requires repair to engine, transmission/powertrain, subframe/suspension, computer, electrical, fuel or A/C. ${box} Total repair cost from accident/incident exceeds $3,000 (if known: ______). ${box} Anti-lock brakes not operational. ${box} Airbags missing/not operational. ${box} Two or more adjacent non-bumper panels replaced. ${box} Current/prior model-year panels repainted. ${box} Declared a total loss by an insurer. ${box} Badge relates to a different model. ${box} Manufacturer's warranty cancelled. ${box} Classified irreparable/salvage/rebuilt. ${box} Recovered after being reported stolen. ${box} Previously registered/traded outside Ontario. ${box} Subject to a prior Repair and Storage lien. ${box} Materially different from advertised specifications. ${box} To the best of the seller's knowledge, none of the statements in this Part 3 apply.</p>`;

  // Per-page footer — dealer identity, address, timestamp and "Page N of 5".
  const nowStamp = new Date().toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).replace(',', '');
  const footAddr = [dealer.street, [dealer.city, dealer.province, dealer.postal].filter(Boolean).join(', ')].filter(Boolean).join(', ');
  const foot = (n) => `<div class="foot"><div><b>${esc(dealer.name || 'Dealership')}</b>${dealer.phone ? ' | Tel:' + esc(dealer.phone) : ''}${dealer.fax ? ' | Fax:' + esc(dealer.fax) : ''}${footAddr ? '<br>' + esc(footAddr) : ''}</div><div class="footpg">${esc(nowStamp)} &nbsp; Page ${n} of 6</div></div>`;
  const dn = esc(dealer.name || 'the Dealer');

  // ── Page 2 — Important Information Respecting Motor Vehicle Sales ────────────
  const page2 = `<div class="page">
    <div class="ptop">Contract for Sale of a ${condLabel} Vehicle</div>
    <h2 class="doch">Important Information Respecting Motor Vehicle Sales</h2>
    <div class="lh">Ontario Motor Vehicle Industry Council</div>
    <p class="tc">In case of any concerns with this sale, you should first contact your motor vehicle dealer. If concerns persist, you may contact the Ontario Motor Vehicle Industry Council as the administrative authority designated for administering the Motor Vehicle Dealers Act, 2002.</p>
    <p class="tc">You may be eligible for compensation from the Motor Vehicle Dealers Compensation Fund if you suffer a financial loss from this trade and if your dealer is unable or unwilling to make good on the loss.</p>
    <p class="tc">You may have additional rights at law.</p>
    <p class="tc">Telephone: 416-226-4500 or 1-800-943-6002<br>Web site: www.omvic.on.ca</p>
    <div class="lh">Canadian Motor Vehicle Arbitration Plan</div>
    <p class="tc">The Canadian Motor Vehicle Arbitration Plan (CAMVAP) allows consumers to resolve disputes with participating manufacturers about possible defects in a vehicle’s assembly or materials, or how the manufacturer is applying or administering its new vehicle warranty. Please contact CAMVAP for more information about the program and to see if your vehicle qualifies.</p>
    <div class="lh">Vehicle Sold "AS-IS"</div>
    <p class="tc">The motor vehicle sold under this contract is being sold "as-is" and is not represented as being in road worthy condition, mechanically sound or maintained at any guaranteed level of quality. The vehicle may not be fit for use as a means of transportation and may require substantial repairs at the purchaser's expense. It may not be possible to register the vehicle to be driven in its current condition. &nbsp;INIT. __________ &nbsp;DATE: __________</p>
    <div class="lh">Safety Standards Certificate</div>
    <p class="tc">A safety certificate is only an indication that the motor vehicle met certain basic standards of vehicle safety on the date of inspection.</p>
    ${foot(2)}
  </div>`;

  // ── Page 3 — Disclosures of New Motor Vehicle Purchase ──────────────────────
  const page3 = `<div class="page">
    <div class="ptop">DISCLOSURES OF NEW MOTOR VEHICLE PURCHASE <span class="ptop-r">VIN: ${esc(veh.vin || '')}</span></div>
    <p class="tc">The dealer declares the following statements are true to the best of their knowledge and belief.</p>
    <p class="tc">☐&nbsp; The Vehicle is new, and the maximum distance that will be shown on the Vehicle’s odometer when it is delivered is __________________</p>
    <p class="tc">☐&nbsp; The Vehicle is new, and the contract does not specify the maximum distance that will be shown on the Vehicle’s odometer when it is delivered.</p>
    <p class="tc">☐&nbsp; The Vehicle’s odometer in __________________</p>
    <p class="tc">☐&nbsp; The odometer of the Motor Vehicle accurately records the true distance traveled.</p>
    <div class="sig" style="grid-template-columns:1fr;max-width:280px;margin-top:34px"><div>Signature</div></div>
    ${foot(3)}
  </div>`;

  const tc = (n, h, body) => `<p class="tc"><b>${n}. ${h}</b><br>${body}</p>`;

  // ── Page 4 — Terms and Conditions, clauses 1–11 ─────────────────────────────
  const page4 = `<div class="page">
    <h2 class="doch">TERMS AND CONDITIONS</h2>
    ${tc(1, 'PRIVACY NOTICE', `The personal information collected on this form and on other documents relating to this transaction is collected in accordance with applicable privacy legislation and is governed by the Dealer’s privacy policy. Such information is collected and used by the Dealer for and is necessary to: (i) sell or lease the Vehicle; (ii) provide products and services related to the Vehicle; (iii) assist the Buyer in the financing or lease of the Vehicle; (iv) provide service or repair the Vehicle; and/or (v) provide other information, products and services.<br>The Dealer may disclose the personal information collected to the Dealer’s parent organization, if applicable, to enable the parent organization to: (i) administer the transaction; (ii) provide services such as warranties and extended service plans; (iii) administer customer notification programs; and/or provide the Buyer with other information, products and services.<br>Subject to the Buyer’s consent to receiving updates and information unrelated to this transaction with the Dealer, by signing this Agreement, you consent to the collection, use and disclosure of your personal information for the foregoing purposes.<br>Contact the Dealer to obtain a copy of the Dealer’s privacy policy, including information on how to access or request the correction of your personal information, or to ask a question about the collection, use and disclosure of your personal information.`)}
    ${tc(2, 'Definition of the Vehicle', `The Vehicle as described in this Agreement includes all accessories and additional equipment attached or installed on the Vehicle before or after the date of this Agreement. It furthermore includes any proceeds arising from any dealings in the Vehicle, including but not limited to all forms of personal property.`)}
    ${tc(3, 'Pollution Equipment', `The Vehicle as described in this Agreement includes all accessories and additional equipment attached or installed on the Vehicle before or after the date of this Agreement. It furthermore includes any proceeds arising from any dealings in the Vehicle, including but not limited to all forms of personal property.`)}
    ${tc(4, 'Distance Travelled', `The Dealer confirms that to the best of the Dealer's knowledge, the distance travelled by the Vehicle as shown on the face of this Agreement will be the odometer reading on the day the Vehicle is delivered to the Buyer. In the case of a trade-in vehicle, the Buyer confirms that to the best of the Buyer's knowledge the distance travelled by the trade-in vehicle is as shown on the face of this Agreement. The Buyer acknowledges that the Dealer is relying on the accuracy of same and agrees to indemnify the Dealer and hold the Dealer harmless from any losses, damages or other expenses caused by any inaccuracy or incorrect representation of same.`)}
    ${tc(5, 'Title', `The right and title to the Vehicle shall remain in the Dealer until the unpaid cash balance stated on the face of this Agreement is paid in full. The Buyer will not at any time suffer or permit any charge, lien or encumbrance to exist against the Vehicle until the unpaid cash balance stated on the face of this Agreement is paid in full. The Dealer reserves the right to repossess and to resell the Vehicle upon default of payment of the unpaid cash balance. The right and title of the Vehicle shall remain in the Dealer until all other sums owing by the Buyer to the Dealer according to these terms and conditions are paid in full to the Dealer.`)}
    ${tc(6, 'Transfer Documents', `The Buyer authorizes the Dealer to make all applications and obtain all permits required to transfer the Vehicle in accordance with this Agreement.`)}
    ${tc(7, 'Safety Standards Certificate', `The Buyer acknowledges that the motor vehicle permit for the Vehicle cannot be transferred to the Buyer unless the Buyer obtains a Safety Standards Certificate. The Buyer acknowledges that if the Buyer does not request a Safety Standards Certificate the Dealer will deliver the Vehicle with an Unfit Motor Vehicle Permit and the responsibility for removing the Vehicle from the Dealer's premises will be borne by the Buyer at the Buyer's own cost.`)}
    ${tc(8, 'Failure of Payment', `If any form of payment for any whole or partial amount due under this Agreement is dishonoured, refused or misrepresented, then such payment will be deemed to be unpaid. In the event of such occurrence, the Buyer and the Dealer agree that:<br>a. the unpaid payment is a breach of a fundamental terms of this Agreement and the Dealer is immediately released from any obligations under this Agreement;<br>b. the Dealer is entitled to immediate possession of the Vehicle as if the Dealer had never parted with possession of the Vehicle, and the Dealer may exercise all rights to possession;<br>c. the Buyer appoints the Dealer as the Buyer’s lawful attorney to transfer title and ownership of the Vehicle to or to the order of the Dealer, and to execute all documents on behalf of the Buyer to transfer title and ownership of the vehicle; and<br>d. the Buyer will immediately reimburse the Dealer for all costs, charges and expenses incurred by the Dealer that arise out of such refusal, dishonour or misrepresentation including but not limited to all costs of taking possession, any reasonable cost of repairs, parts, lien payouts, handling and storage expenses, a reasonable selling commission and full indemnity for all legal costs.`)}
    ${tc(9, 'Entire Amount Due if Buyer Defaults', `Subject to clause 6 of this Agreement, if:<br>a. the Buyer defaults in the payment of any amount due or fails to comply with any requirement under this Agreement; or<br>b. any proceeding is commenced by or against the Buyer under bankruptcy or insolvency laws, then the entire amount due from the Buyer to the Dealer will become immediately due and payable at the option of the Dealer.`)}
    ${tc(10, 'Cancellation', `If the Dealer is unable to deliver the Vehicle within 120 days of the date of this Agreement for any reason through no fault of the Dealer, the Dealer will forthwith notify the Buyer on expiration of the 120 day period and this Agreement may be extended within 5 days of notification by mutual consent of the parties evidenced in writing. If the 5 day period has expired or on express notification by either party, this Agreement may be cancelled. Where this Agreement is so cancelled:<br>a. the Dealer will return any partial payment or deposit;<br>b. the Dealer will return the trade-in vehicle or other vehicle accepted as part payment or if such vehicle has been sold, the Dealer will pay the Buyer either:<br>&nbsp;&nbsp;i. the net proceeds of the sale calculated as the actual selling cost less the reasonable cost of repairs, parts, lien payouts, handling and storage expenses and a reasonable selling commission; or<br>&nbsp;&nbsp;ii. the allowance for a trade-in vehicle or the value of a vehicle accepted as part payment as indicated in this Agreement, whichever is the lesser amount;<br>c. the Dealer’s compliance with the requirements in subclauses (a) and (b) above will be a full release of any claims that the Buyer may have or claim to have against the Buyer resulting from such non-delivery, without any further or other releases from the Buyer.`)}
    ${tc(11, 'Acceptance of Delivery', `The Buyer agrees to accept delivery of the Vehicle and to comply with the terms of payment within seven days after notification to the Buyer that the Vehicle is ready for delivery. In the event that the Buyer does not so comply within seven days from the date of such notification, then the Dealer may charge his or her reasonable expenses (including loss of profit) to the Buyer in connection with this Agreement covering the Vehicle, and the Buyer hereby agrees to pay same. In addition to any other remedy which the Dealer may have against the Buyer for such expenses, the Dealer may set off such expenses against any deposit paid or any trade-in vehicle accepted as part payment or the proceeds therefrom if and when sold, and the Dealer shall be entitled to dispose of the Vehicle without any liability whatsoever to the Buyer.`)}
    ${foot(4)}
  </div>`;

  // ── Page 5 — Terms and Conditions (continued), clauses 12–26 ────────────────
  const page5 = `<div class="page">
    <h2 class="doch">TERMS AND CONDITIONS (CONTINUED)</h2>
    ${tc(12, 'Misrepresentation of Trade-In Vehicle', `In the event of any misrepresentation by the Buyer of any fact or matter relating to the trade-in vehicle as represented by the Buyer to the Dealer, either:<br>a. the Dealer may rescind this Agreement upon notification to the Buyer, and in such event:<br>&nbsp;&nbsp;i. the Buyer shall return the Vehicle to the Dealer forthwith (and failing such forthwith return, the Dealer may repossess the Vehicle at the expense of the Buyer), and forthwith pay to the Dealer all reasonable costs, charges and expenses:<br>&nbsp;&nbsp;&nbsp;&nbsp;I. for the use, repair and re-conditioning, if necessary, of the Vehicle; and<br>&nbsp;&nbsp;&nbsp;&nbsp;II. of the Dealer to recover possession of the Vehicle and to restore, repair and recondition the trade-in vehicle; and<br>&nbsp;&nbsp;&nbsp;&nbsp;III. for any other expenses of the Dealer arising out of the misrepresentation, and<br>&nbsp;&nbsp;ii. upon receipt of the Vehicle and the monies referred to in subclause 8(a)(i), the Dealer shall return to the Buyer:<br>&nbsp;&nbsp;&nbsp;&nbsp;I. the deposit paid, if any; and<br>&nbsp;&nbsp;&nbsp;&nbsp;II. any trade-in vehicle accepted as part payment; or<br>&nbsp;&nbsp;&nbsp;&nbsp;III. if such trade-in vehicle has been sold, the net proceeds therefrom based upon the actual selling price thereof less reasonable costs, repairs, handling and storage expenses and reasonable selling commission, or<br>b. the Dealer may reappraise the trade-in vehicle and upon such reappraisal may notify the Buyer of the difference between the value of the trade-in vehicle as stated in this Agreement and the value of the trade-in vehicle upon such reappraisal and upon receipt of such notification, the Buyer shall forthwith pay to the Dealer the amount of such difference.`)}
    ${tc(13, 'Trade-In Disclosures', `In the event that one or more of the provisions contained in this Agreement shall be invalid, illegal or unenforceable in any respect under any applicable law, the validity, legality or enforceability of the remaining provisions hereof shall not be affected or impaired thereby.`)}
    ${tc(14, 'Delivery of Trade-In Vehicle', `The Buyer agrees that if the trade-in vehicle accepted as part payment is not delivered to the Dealer on or before the execution of this Agreement, the Dealer may reappraise the trade-in vehicle upon actual delivery of such trade-in vehicle so as to ensure that there is no material change in the condition of such trade-in vehicle either physically or economically between the date of the signing hereof and the date of such actual delivery. In the event that, in the sole opinion of the Dealer, there is such a material change, the amount allowed for the trade-in vehicle shall be its reappraised value and the Buyer shall pay to the Dealer the difference between the amount for such trade-in vehicle stated in this Agreement and the amount of such reappraised value.<br>If the Buyer is not satisfied with such reappraisal, then the Buyer may cancel this Agreement and thereupon shall forthwith pay to the Dealer the Dealer’s reasonable costs, charges and expenses of an incidental to this Agreement, and failing such payment the Dealer may, in addition to any other rights and remedies the Dealer may have against the Buyer, set off such reasonable costs, charges and expenses against any deposit paid and against any other trade-in vehicle accepted as part payment.`)}
    ${tc(15, 'Title to Trade-In Vehicle Agreement', `The Buyer agrees to transfer title of the trade-in vehicle (if any) at such time and to such person as the Dealer shall specify, free and clear of all liens (other than as disclosed on the face of this Agreement).`)}
    ${tc(16, 'Financing &amp; Payment', `The Buyer acknowledges that this Agreement is an agreement to purchase the Vehicle. If there is an unpaid balance, the Dealer's obligation to sell the Buyer the Vehicle is conditional upon financing for the unpaid balance. The Buyer will have two business days from the date of this Agreement to obtain such financing.<br>If financing is to be provided to the Buyer, the Dealer represents to the Buyer that the lender has complied with Section 79 of the Consumer Protection Act of Ontario, as amended, by providing the Buyer with the information that must be disclosed in any initial disclosure statement with respect to the financing. The Buyer authorizes the Dealer and the lender to check the Buyer's credit and that of any co-signer. The Buyer understands and acknowledges that any interest rate offered is On Approved Credit ("OAC") and is therefore subject to approval by the financing institution. The Buyer acknowledges that the rate of financing received will be decided by the financing institution and will be based on the Buyer's creditworthiness. The Buyer consents to a credit investigation and the exchange of credit information concerning the Buyer's personal credit history. The Buyer agrees that the Dealer may register a financing statement confirming the Dealer's interest in the Vehicle to the extent that any such interest exists. The Dealer may register any financing or financing change statement made hereunder for a period up to the term of this Agreement plus one year. Where the law permits, the Buyer waives the Buyer's rights to sign or receive a copy of any financing, financing change or verification or confirmation statement in connection with this Agreement. The Buyer agrees that copies of any documents which are required to be sent to the Buyer pursuant to the Personal Property Security laws of Ontario may be sent by ordinary mail.`)}
    ${tc(17, 'Leasing', `If leasing is to be provided to the Buyer, the Dealer represents to the Buyer that the lease service provider has complied with subsection 89(2) of the Consumer Protection Act of Ontario by providing the Buyer with the information that must be disclosed in any initial disclosure statement with respect to the lease.`)}
    ${tc(18, 'Late Payments, NSF Charges &amp; Interest', `If the Buyer pays the Dealer with a cheque that is dishonoured or unpaid for any reason, the Dealer may, at the Dealer's sole option, declare this Agreement null and void and retake the Vehicle, or make claims against the Buyer on the cheque. In addition, to the extent permitted by law, the Dealer will charge the Buyer a $24.00 returned cheque charge.`)}
    ${tc(19, 'WARRANTIES', `ALL WARRANTIES, IF ANY, BY A MANUFACTURER OR SUPPLIER OTHER THAN THE DEALER ARE THEIRS, NOT THE DEALER'S. ONLY SUCH MANUFACTURER OR OTHER SUPPLIER SHALL BE LIABLE FOR PERFORMANCE UNDER SUCH WARRANTIES, UNLESS THE DEALER FURNISHES THE BUYER WITH A SEPARATE WRITTEN WARRANTY OR SERVICE CONTRACT MADE BY THE DEALER ON ITS OWN BEHALF. THE DEALER NEITHER ASSUMES NOR AUTHORIZES ANY PERSON TO ASSUME FOR IT ANY LIABILITY IN CONNECTION WITH THE SALE OF ANY PRODUCTS.<br>UNLESS THE DEALER MAKES A WRITTEN WARRANTY ON ITS OWN BEHALF, OR ENTERS INTO A SERVICE CONTRACT WITHIN 90 DAYS FROM THE DATE OF THIS ORDER, THE DEALER MAKES NO WARRANTIES ON THE VEHICLE EXCEPT AS REQUIRED BY LAW. THIS PROVISION DOES NOT AFFECT ANY WARRANTIES COVERING THE VEHICLE THAT THE MANUFACTURER OR SUPPLIER MAY PROVIDE.`)}
    ${tc(20, 'Changes in Tax Payable', `Should any change in taxes levied by any level of government between the date of this Agreement and the actual delivery date of the Vehicle have the effect of altering the purchase price of the Vehicle, then the Buyer and the Dealer agree that the purchase price will be adjusted to reflect the change in tax.`)}
    ${tc(21, 'Used Vehicle Odometer Reading', `The Dealer does not warrant or guarantee the odometer reading on any used vehicle sold under this Agreement.`)}
    ${tc(22, 'Governing Law', `This Agreement and each of the documents contemplated by or delivered under or in connection with this Agreement are governed by and are to be construed and interpreted in accordance with the laws of the Province of Ontario and the laws of Canada applicable in the Province of Ontario.`)}
    ${tc(23, 'English Language', `It is the express wish of the parties that this form and any related documents be drawn up and executed in English. Les parties on expressément exigé que le présent formulaire et tous les documents s'y rattachant soient rédigés en anglais.`)}
    ${tc(24, 'Error', `If there is an error in the calculation of the purchase price or in any other matter documented in or connected with this Agreement, the Buyer and the Dealer agree to amend the Agreement to correct the error. If the correction results in monies being owed to the Buyer or the Dealer, the Buyer and Dealer agree that such monies will be paid promptly.`)}
    ${tc(25, 'Assignment', `The Buyer may not assign this Agreement without the prior written consent of the Dealer. The Dealer may assign this Agreement without notice to the Buyer.`)}
    ${tc(26, '', `Ontario law requires ${dn} to collect and process used tires to reduce Ontario’s tire waste. We charge a separate fee which will be used to pay a third party to perform such collection and processing.`)}
    ${foot(5)}
  </div>`;

  const inner = `<style>${DESK_DOC_CSS}</style><div class="page">${face}${foot(1)}</div>${page2}${page3}${page4}${page5}`;
  const billTitle = condLabel + ' Motor Vehicle Purchase Agreement';
  if (opts.returnHtml) return { title: billTitle, doc_type: 'bill_of_sale', html: inner };
  if (typeof apprPrintWindow === 'function') apprPrintWindow(billTitle, inner);
  else { const w = window.open('', '_blank'); if (w) { w.document.write(`<html><head><title>Bill of Sale</title></head><body>${inner}</body></html>`); w.document.close(); } }
}

// Print styles for the deal documents (injected into the print window).
const DESK_DOC_CSS = `
  .band{border:2px solid #0f172a;border-radius:6px;padding:8px 12px;margin-top:6px}
  .bandtitle{font-size:15px;font-weight:900;letter-spacing:.02em}
  .idline{font-size:11px;color:#334155;margin-top:2px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .sec{border:1px solid #cbd5e1;border-radius:6px;padding:8px 10px;margin-top:10px}
  .sech{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#475569;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:6px}
  .fgrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px 10px}
  .fx{border-bottom:1px solid #f1f5f9;min-height:30px}
  .fl{font-size:8.5px;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8}
  .fv{font-size:12px;font-weight:600;color:#0f172a}
  .ack{font-size:11px;margin:10px 0 4px;line-height:1.4}
  .ptbl{width:100%;border-collapse:collapse;font-size:12px}
  .ptbl td{padding:3px 0}
  .ptbl tr.ptop td{border-top:1px solid #cbd5e1;font-weight:600}
  .mut{font-size:10px;color:#94a3b8}
  .initbox{border:1px solid #e2e8f0;border-radius:6px;padding:7px 9px;margin-top:10px;font-size:10.5px;line-height:1.35;color:#334155}
  .init{display:block;margin-top:4px;font-weight:700;color:#0f172a}
  .dis{font-size:10px;line-height:1.45;color:#334155;margin:6px 0}
  .ck{font-size:12px;margin-right:1px}
  .sig{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:34px}
  .sig div{border-top:1px solid #94a3b8;padding-top:4px;font-size:10px;color:#64748b}
  .pb{page-break-before:always;height:0}
  /* Paged document: each .page fills the printable sheet; footer sits at the bottom;
     a hard page break after every page except the last. Readable but legal. */
  .page{display:flex;flex-direction:column;min-height:9.1in;page-break-after:always;box-sizing:border-box}
  .page:last-child{page-break-after:auto}
  .foot{margin-top:auto;padding-top:10px;border-top:1px solid #cbd5e1;display:flex;justify-content:space-between;align-items:flex-end;font-size:8.5px;color:#64748b;line-height:1.35}
  .footpg{white-space:nowrap;text-align:right}
  .ptop{font-size:11px;font-weight:800;color:#0f172a;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-bottom:8px}
  .ptop-r{float:right;font-weight:700}
  .doch{font-size:15px;font-weight:900;text-align:center;letter-spacing:.02em;margin:2px 0 10px}
  .lh{font-size:12px;font-weight:800;color:#0f172a;margin-top:10px;margin-bottom:2px}
  .tc{font-size:9px;line-height:1.4;color:#1f2937;margin:5px 0;text-align:justify}
  .tc b{font-size:9.5px}
  .copytag{text-align:right;font-size:11px;font-weight:900;letter-spacing:.08em;color:#64748b;border:1px solid #cbd5e1;border-radius:4px;padding:2px 8px;align-self:flex-end;margin-bottom:4px}
`;

// ── Native e-signature: send the desk's own document out for a legal e-sign ──
// Reuses the exact bill-of-sale / estimate HTML the desk already renders, so the
// customer signs the same paper the rep sees. Never includes internal-only cost.
function deskEsign(contactId, kind) {
  const doc = deskPrint(kind || 'bill', { returnHtml: true });
  if (!doc) return;   // deskPrint already toasted (e.g. no selling price yet)
  const b = __deskBuyer || {};
  const signerName = b.full_name || [b.first_name, b.last_name].filter(Boolean).join(' ') || '';
  const signerEmail = b.email || '';
  crmOverlay(`<div class="p-5 space-y-4">
    <div class="flex items-center justify-between">
      <div><div class="text-lg font-black text-slate-900 dark:text-white">Send for e-signature</div>
        <div class="text-xs text-slate-500 dark:text-slate-400">${esc(doc.title)}</div></div>
      <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <div class="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 p-3 flex items-center gap-3">
      <svg class="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
      <div class="text-xs text-emerald-800 dark:text-emerald-200">The customer opens a secure link, reviews the document, and signs on any device. You'll get the signed copy with a certificate.</div>
    </div>
    <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Customer name</label>
      <input id="esign-name" value="${esc(signerName)}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
    <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Email <span class="font-normal text-slate-400">(for a text-only send, leave blank and copy the link)</span></label>
      <input id="esign-email" type="email" value="${esc(signerEmail)}" placeholder="name@email.com" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
    <div id="esign-modal-result" class="hidden"></div>
    <div class="flex justify-end gap-2 pt-1">
      <button onclick="deskEsignSubmit('${contactId || ''}','${kind || 'bill'}','copy', this)" class="text-sm font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg">Create &amp; copy link</button>
      <button onclick="deskEsignSubmit('${contactId || ''}','${kind || 'bill'}','send', this)" class="text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg">Email the link</button>
    </div>
  </div>`, 'max-w-lg');
}
async function deskEsignSubmit(contactId, kind, mode, btn) {
  const doc = deskPrint(kind || 'bill', { returnHtml: true });
  if (!doc) { btn.closest('.fixed')?.remove(); return; }
  const name = document.getElementById('esign-name')?.value.trim() || '';
  const email = mode === 'send' ? (document.getElementById('esign-email')?.value.trim() || '') : '';
  if (mode === 'send' && !/.+@.+\..+/.test(email)) { showToast('Enter a valid email, or use “Create & copy link”.', 'error'); return; }
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Creating…';
  try {
    const r = await apiSendJson('/esign/create', 'POST', {
      doc_html: doc.html, doc_title: doc.title, doc_type: doc.doc_type,
      contact_id: contactId || __deskContactId || null,
      deal_id: (__deskDeal && __deskDeal.id) || null,
      signer_name: name, signer_email: email,
    });
    const box = document.getElementById('esign-modal-result');
    if (box) {
      box.classList.remove('hidden');
      box.innerHTML = `<div class="rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-2">
        <div class="text-[11px] font-semibold text-slate-500 mb-1">${email ? 'Emailed — you can also share this link:' : 'Secure signing link:'}</div>
        <div class="flex gap-1.5"><input readonly value="${esc(r.url)}" onclick="this.select()" class="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs">
        <button onclick="navigator.clipboard.writeText('${esc(r.url)}');showToast('Link copied','success')" class="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 rounded">Copy</button></div></div>`;
    }
    if (mode === 'copy') { try { await navigator.clipboard.writeText(r.url); } catch {} }
    showToast(email ? 'Signing link emailed' : 'Signing link ready', 'success');
    btn.disabled = false; btn.textContent = orig;
  } catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message || 'Could not create the signing request', 'error'); }
}
window.deskEsignSubmit = deskEsignSubmit;

function esignShowLink(url, emailed) {
  const wrap = document.createElement('div');
  wrap.className = 'fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 p-4';
  wrap.innerHTML = `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
    <div class="flex items-center gap-3 mb-3"><div class="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 text-xl">✍️</div>
      <div><div class="font-bold text-slate-900 dark:text-white">Signing link ready</div><div class="text-xs text-slate-500 dark:text-slate-400">${emailed ? 'Emailed to the customer. You can also copy it below.' : 'Copy the link and text/email it to the customer.'}</div></div></div>
    <input id="esign-link-in" readonly value="${esc(url)}" class="w-full text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-200">
    <div class="flex gap-2 mt-4">
      <button id="esign-copy" class="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2.5 rounded-lg">Copy link</button>
      <button id="esign-close" class="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold px-4 py-2.5 rounded-lg">Done</button>
    </div></div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  wrap.querySelector('#esign-close').onclick = close;
  wrap.querySelector('#esign-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(url); } catch { const i = wrap.querySelector('#esign-link-in'); i.select(); document.execCommand('copy'); }
    showToast('Link copied', 'success');
  };
}

// A lightweight status board for signing requests (optionally filtered to one customer).
async function openEsignStatus(contactId) {
  const wrap = document.createElement('div');
  wrap.className = 'fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 p-4';
  wrap.innerHTML = `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl">
    <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800"><div class="font-bold text-slate-900 dark:text-white">E-signature status</div><button id="es-x" class="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button></div>
    <div id="es-body" class="p-5 overflow-y-auto text-sm text-slate-500 dark:text-slate-400">Loading…</div></div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  wrap.querySelector('#es-x').onclick = close;
  const body = wrap.querySelector('#es-body');
  try {
    const r = await apiGetJson('/esign', { retries: 1 });
    let reqs = r.requests || [];
    if (contactId) reqs = reqs.filter(x => x.contact_id === contactId);
    if (!reqs.length) { body.innerHTML = '<div class="text-center py-8">No signing requests yet. Use “Send for e-signature” on the desk to create one.</div>'; return; }
    const badge = (s) => {
      const map = { signed: ['Signed', 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'], viewed: ['Viewed', 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'], sent: ['Sent', 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'], declined: ['Declined', 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'], void: ['Void', 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'] };
      const [t, cls] = map[s] || [s, 'bg-slate-100 text-slate-600'];
      return `<span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${cls}">${t}</span>`;
    };
    body.innerHTML = reqs.map(x => {
      const when = x.signed_at ? 'Signed ' + new Date(x.signed_at).toLocaleString('en-US') : 'Created ' + new Date(x.created_at).toLocaleDateString('en-US');
      return `<div class="flex items-center justify-between gap-3 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
        <div class="min-w-0"><div class="font-semibold text-slate-800 dark:text-slate-100 truncate">${esc(x.doc_title || 'Document')}</div>
          <div class="text-xs text-slate-400">${esc(x.signer_name || x.signer_email || '—')} · ${esc(when)}</div></div>
        <div class="flex items-center gap-2 shrink-0">${badge(x.status)}
          ${x.status === 'signed' ? `<button onclick="openEsignDetail('${x.id}')" class="text-xs font-bold text-indigo-600 hover:text-indigo-500">View</button>` : `<button onclick="esignCopyLink('${esc(x.url)}')" class="text-xs font-bold text-indigo-600 hover:text-indigo-500">Copy link</button>`}</div>
      </div>`;
    }).join('');
  } catch (e) { body.innerHTML = `<div class="text-red-500 py-6">${esc(e.message || 'Could not load signing requests')}</div>`; }
}

async function esignCopyLink(url) {
  try { await navigator.clipboard.writeText(url); } catch {}
  showToast('Link copied', 'success');
}

// Open the signed document + signature image + audit trail (the record of signing).
async function openEsignDetail(id) {
  try {
    const r = await apiGetJson(`/esign/${encodeURIComponent(id)}/detail`, { retries: 1 });
    const req = r.request || {};
    const audit = (req.audit || []).map(a => `${esc(a.event)} — ${a.at ? new Date(a.at).toLocaleString('en-US') : ''}${a.ip ? ' · IP ' + esc(a.ip) : ''}`).join('<br>');
    const cert = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;border:1px solid #cbd5e1;border-radius:10px;padding:16px;margin:16px 0;background:#f8fafc;color:#0f172a">
      <div style="font-weight:800;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#475569;margin-bottom:8px">Signature certificate</div>
      <div style="font-size:13px;line-height:1.7">
        <b>Signed by:</b> ${esc(req.signature_name || '—')}<br>
        <b>Signed at:</b> ${req.signed_at ? new Date(req.signed_at).toLocaleString('en-US') : '—'}<br>
        <b>IP address:</b> ${esc(req.signed_ip || '—')}<br>
        <b>Device:</b> ${esc(req.signed_ua || '—')}<br>
        <b>Consent:</b> ${esc(req.consent_text || '')}
      </div>
      ${req.signature_image ? `<div style="margin-top:12px"><div style="font-size:12px;color:#64748b;margin-bottom:4px">Drawn signature</div><img src="${esc(req.signature_image)}" alt="signature" style="max-width:320px;border:1px solid #e2e8f0;border-radius:6px;background:#fff"></div>` : ''}
      ${audit ? `<div style="margin-top:12px"><div style="font-size:12px;color:#64748b;margin-bottom:4px">Audit trail</div><div style="font-size:12px;color:#334155;line-height:1.6">${audit}</div></div>` : ''}
    </div>`;
    const html = `<div style="max-width:820px;margin:0 auto;padding:20px">${cert}${req.doc_html || ''}</div>`;
    if (typeof apprPrintWindow === 'function') apprPrintWindow('Signed: ' + (req.doc_title || 'Document'), html);
    else { const w = window.open('', '_blank'); if (w) { w.document.write(`<html><head><title>Signed document</title></head><body>${html}</body></html>`); w.document.close(); } }
  } catch (e) { showToast(e.message || 'Could not open the signed document', 'error'); }
}