/* Inventory action row: Desk a Deal, owner-linked history, open vehicle page. */
(function (global) {
  'use strict';

  function deskVehicle(id, vin) {
    try { sessionStorage.setItem('ms_desk_inventory_id', id || ''); sessionStorage.setItem('ms_desk_vin', vin || ''); } catch (e) {}
    if (typeof global.openDeskForContact === 'function') {
      global.openDeskForContact(null, null);
      return;
    }
    if (typeof global.switchPage === 'function') global.switchPage('desk');
  }
  global.deskVehicleFromInventory = deskVehicle;

  function injectButtons() {
    document.querySelectorAll('button').forEach(function (btn) {
      if (btn.dataset.msDesk) return;
      if ((btn.textContent || '').trim() !== 'History') return;
      const wrap = btn.parentElement;
      if (!wrap) return;
      btn.dataset.msDesk = '1';
      const onclick = btn.getAttribute('onclick') || '';
      const idMatch = onclick.match(/inventory_id:'([^']+)'/);
      const vinMatch = onclick.match(/vin:'([^']*)'/);
      const id = idMatch ? idMatch[1] : (btn.getAttribute('data-id') || '');
      const vin = vinMatch ? vinMatch[1] : '';
      const desk = document.createElement('button');
      desk.type = 'button';
      desk.className = btn.className.replace('bg-slate-600', 'bg-violet-700').replace('hover:bg-slate-500', 'hover:bg-violet-600');
      if (desk.className === btn.className) desk.className = 'text-[10px] font-bold px-2 py-1 rounded transition bg-violet-700 hover:bg-violet-600 text-white';
      desk.textContent = 'Desk a Deal';
      desk.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        deskVehicle(id, vin);
      });
      wrap.appendChild(desk);
    });
  }

  function wireCardOpens() {
    document.querySelectorAll('[data-id], article, a, div').forEach(function (el) {
      if (el.dataset.msVehOpen) return;
      if (!el.className || String(el.className).indexOf('rounded') === -1) return;
    });
    document.querySelectorAll('.inv-vin-btn').forEach(function (btn) {
      const card = btn.closest('a, article, div.group, div[class*="rounded"]');
      if (!card || card.dataset.msVehOpen) return;
      card.dataset.msVehOpen = '1';
      const id = btn.getAttribute('data-id');
      if (!id) return;
      card.addEventListener('click', function (e) {
        if (e.target.closest('button, a, input, select')) return;
        e.preventDefault();
        if (typeof global.vehicleOpen === 'function') global.vehicleOpen(id);
      });
    });
  }

  function wrapHistory() {
    if (typeof global.openVehicleHistory !== 'function' || global.openVehicleHistory.__msOwners) return;
    const orig = global.openVehicleHistory;
    global.openVehicleHistory = function (opts) {
      const result = orig.apply(this, arguments);
      setTimeout(function () {
        const list = document.querySelector('[data-list]');
        if (!list) return;
        fetch((global.API || '') + '/history?' + new URLSearchParams({
          inventory_id: (opts && opts.inventory_id) || '',
          vin: (opts && opts.vin) || '',
          contact_id: (opts && opts.contact_id) || ''
        }).toString(), { headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') } })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            const owners = (data && data.owners) || [];
            if (!owners.length || list.parentElement.querySelector('[data-owners]')) return;
            const box = document.createElement('div');
            box.setAttribute('data-owners', '1');
            box.innerHTML = '<div class="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">Owners</div>' +
              owners.map(function (o) {
                const label = o.name || 'Customer';
                const state = o.current ? 'Current' : 'Past';
                return '<div class="flex items-center justify-between gap-2 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 mb-1.5">' +
                  '<div><div class="font-semibold text-sm">' + label + '</div><div class="text-[11px] text-slate-400">' + state + (o.stage ? ' · ' + o.stage : '') + '</div></div>' +
                  (o.contact_id && typeof global.openDeskForContact === 'function'
                    ? '<button type="button" class="text-xs font-black text-violet-700" onclick="openDeskForContact(\'' + o.contact_id + '\')">Desk</button>'
                    : '') +
                  '</div>';
              }).join('');
            list.parentElement.insertBefore(box, list);
          }).catch(function () {});
      }, 400);
      return result;
    };
    global.openVehicleHistory.__msOwners = true;
  }

  const tick = setInterval(function () {
    injectButtons();
    wireCardOpens();
    wrapHistory();
  }, 600);
  setTimeout(function () { clearInterval(tick); }, 60000);
  document.addEventListener('click', function () {
    setTimeout(injectButtons, 50);
  });
})(window);
