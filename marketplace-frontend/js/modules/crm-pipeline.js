// ─────────────────────────────────────────────────────────────────────────────
// MarketSync CRM — Frontend Submodule: Sales Pipeline Board & CRM Workflow
// ─────────────────────────────────────────────────────────────────────────────

const PL_COLS = [
  { key: 'posted', label: 'Posted', dot: 'bg-blue-500' },
  { key: 'appointment_set', label: 'Appointment Set', dot: 'bg-indigo-500' },
  { key: 'claimed_sale', label: 'Claimed Sales', dot: 'bg-emerald-500' },
  { key: 'need_relisting', label: 'Need Relisting', dot: 'bg-amber-500' },
];
const PL_MOVE_LABEL = { posted: 'Posted', appointment_set: 'Appointment Set', claimed_sale: 'Mark Sold', need_relisting: 'Need Relisting' };
let PL_DATA = { columns: {}, counts: {} };
const PL_COLLAPSED = new Set();
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
          ${c.fb_listing_url ? `<a href="${esc(c.fb_listing_url)}" target="_blank" rel="noopener" class="text-center text-xs font-bold bg-blue-500 hover:bg-blue-600 text-white rounded py-1 px-2 transition">Marketplace ↗</a>` : ''}
          ${c.source_url ? `<a href="${esc(c.source_url)}" target="_blank" rel="noopener" class="text-center text-xs font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded py-1 px-2 transition">Site Page ↗</a>` : ''}
        </div>` : ''}
      <div class="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
        <label class="text-slate-400 text-[11px]">Move to</label>
        <select data-move-id="${c.id}" class="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500">
          <option value="" disabled selected>Select stage...</option>
          ${opts}
        </select>
      </div>
      </div>
    </div>
  `;
}

// Export functions to window
window.plAskAppointment = plAskAppointment;
window.plCard = plCard;
