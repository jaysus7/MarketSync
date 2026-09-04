/* Tap a calendar day to book. Tap an appointment to open customer + RO. */
(function (global) {
  'use strict';

  function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function dayKeyFromYmd(s) {
    const p = String(s).split('-').map(Number);
    return p[0] + '-' + (p[1] - 1) + '-' + p[2];
  }

  function bookOn(dateStr) {
    if (typeof global.apptAddForm === 'function') {
      global.apptAddForm(dayKeyFromYmd(dateStr));
      return;
    }
    if (typeof global.openServiceBooking === 'function') {
      global.openServiceBooking({ date: dateStr });
      return;
    }
    if (typeof global.showToast === 'function') global.showToast('Booking form is not available', 'error');
  }

  function openAppt(a) {
    if (!a) return;
    if (typeof global.openApptDetail === 'function') global.openApptDetail(a);
    setTimeout(function () { decorateDetail(a); }, 80);
  }

  function decorateDetail(a) {
    const modal = document.getElementById('appt-detail-modal') || document.querySelector('.fixed.inset-0.z-50, .fixed.inset-0.z-\[99999\]');
    if (!modal || modal.dataset.msApptRo === a.id) return;
    modal.dataset.msApptRo = a.id || a.when || '';
    if (modal.querySelector('[data-ms-appt-actions]')) return;
    const bar = document.createElement('div');
    bar.setAttribute('data-ms-appt-actions', '1');
    bar.className = 'px-4 pb-4 flex flex-wrap gap-2';
    const contactId = a.contact_id || a.customer_id || '';
    const roId = a.ro_id || a.repair_order_id || a.work_order_id || '';
    bar.innerHTML =
      '<button type="button" data-cust class="px-3 py-2 rounded-xl text-xs font-black bg-indigo-600 text-white">Customer</button>' +
      '<button type="button" data-ro class="px-3 py-2 rounded-xl text-xs font-black bg-teal-600 text-white">Repair order</button>';
    modal.querySelector('.p-5, .p-4, div')?.appendChild(bar);
    bar.querySelector('[data-cust]').addEventListener('click', function () {
      if (contactId && typeof global.openCustomerModal === 'function') return global.openCustomerModal(contactId);
      if (contactId && typeof global.crmOpenContact === 'function') return global.crmOpenContact(contactId);
      if (typeof global.showToast === 'function') global.showToast(a.customer || a.customer_name || 'No customer linked', 'info');
    });
    bar.querySelector('[data-ro]').addEventListener('click', function () {
      if (roId && typeof global.svcOpenEstimateDrawer === 'function') return global.svcOpenEstimateDrawer(roId);
      if (roId && typeof global.svcOpenDviModal === 'function') return global.svcOpenDviModal(roId);
      if (typeof global.showToast === 'function') global.showToast(roId ? 'Opening repair order' : 'No repair order on this appointment yet', 'info');
    });
  }

  function parseCellDate(cell, idxInGrid) {
    const label = cell.querySelector('span, .text-\[11px\], [data-day]');
    const day = Number((cell.getAttribute('data-day') || (label && label.textContent) || '').trim());
    if (!day) return null;
    const title = document.querySelector('#appt-month-label, #service-appointments-root .min-w-\[140px\], .text-sm.font-bold');
    const now = new Date();
    let year = now.getFullYear(), month = now.getMonth();
    const text = (title && title.textContent) || '';
    const m = text.match(/([A-Za-z]+)\s+(\d{4})/);
    if (m) {
      month = new Date(m[1] + ' 1, ' + m[2]).getMonth();
      year = Number(m[2]);
    }
    return ymd(new Date(year, month, day));
  }

  function bindGrid(root) {
    if (!root || root.dataset.msCalBound === '1') return;
    root.dataset.msCalBound = '1';
    const grids = root.querySelectorAll('.grid.grid-cols-7');
    const grid = grids[grids.length - 1] || root.querySelector('.grid');
    if (!grid) return;
    Array.from(grid.children).forEach(function (cell) {
      if (cell.textContent && /sun|mon|tue|wed|thu|fri|sat/i.test(cell.textContent) && cell.textContent.length < 5) return;
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', function (e) {
        const chip = e.target.closest('[data-appt-idx], [data-appt-id], .rounded');
        const dateStr = parseCellDate(cell);
        if (chip && chip.getAttribute && (chip.getAttribute('data-appt-idx') != null || chip.getAttribute('data-appt-id'))) {
          const idx = chip.getAttribute('data-appt-idx');
          const id = chip.getAttribute('data-appt-id');
          const list = global.__apptData || global.__svcApptData || [];
          const appt = (idx != null && list[Number(idx)]) || list.find(function (a) { return String(a.id) === String(id); });
          if (appt) return openAppt(appt);
        }
        if (dateStr) bookOn(dateStr);
      });
    });
  }

  function paintServiceChips() {
    const root = document.getElementById('service-appointments-root') || document.getElementById('appointments-root');
    if (!root) return;
    const list = (global.__svcApptData || []).concat(global.__apptData || []);
    if (!list.length) return;
    const byDay = {};
    list.forEach(function (a, i) {
      const when = a.when || a.appointment_at || a.start || a.scheduled_at;
      if (!when) return;
      const d = new Date(when);
      const k = ymd(d);
      (byDay[k] = byDay[k] || []).push(Object.assign({ _i: i }, a, { when: when }));
    });
    root.querySelectorAll('.grid.grid-cols-7').forEach(function (grid) {
      Array.from(grid.children).forEach(function (cell) {
        const dateStr = parseCellDate(cell);
        if (!dateStr || !byDay[dateStr]) return;
        if (cell.querySelector('[data-ms-chip]')) return;
        byDay[dateStr].slice(0, 3).forEach(function (a) {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.setAttribute('data-ms-chip', '1');
          chip.setAttribute('data-appt-id', a.id || '');
          chip.className = 'w-full truncate text-[10px] font-semibold px-1.5 py-1 rounded bg-teal-100 text-teal-800 text-left';
          const t = new Date(a.when).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
          chip.textContent = t + ' ' + (a.customer || a.customer_name || a.title || 'Appt');
          chip.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            openAppt(a);
          });
          cell.appendChild(chip);
        });
      });
    });
  }

  function wrap() {
    ['renderApptCalendar', 'renderSvcApptCalendar', 'renderAppts'].forEach(function (name) {
      if (typeof global[name] !== 'function' || global[name].__msCal) return;
      const orig = global[name];
      global[name] = function () {
        const out = orig.apply(this, arguments);
        setTimeout(function () {
          bindGrid(document.getElementById('appointments-root'));
          bindGrid(document.getElementById('service-appointments-root'));
          paintServiceChips();
        }, 40);
        return out;
      };
      global[name].__msCal = true;
    });
    bindGrid(document.getElementById('appointments-root'));
    bindGrid(document.getElementById('service-appointments-root'));
    paintServiceChips();
  }

  const t = setInterval(wrap, 500);
  setTimeout(function () { clearInterval(t); wrap(); }, 20000);
})(window);
