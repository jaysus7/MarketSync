/* Service check-in: key-tag label, aligned date, license scan, customer search. */
(function (global) {
  'use strict';

  function api() { return global.API || global.MS_API_BASE_URL || ''; }
  function token() { return localStorage.getItem('token') || ''; }
  function headers() { return { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' }; }

  function todayAppts() {
    const list = (global.__svcData && global.__svcData.appointments) || [];
    const today = new Date().toISOString().slice(0, 10);
    return list.filter(function (a) {
      const d = String(a.date || a.start || a.scheduled_at || a.start_at || '').slice(0, 10);
      return !d || d === today;
    });
  }

  function personLabel(p) {
    return [p.customer || p.customer_name || p.name || ((p.first_name || '') + ' ' + (p.last_name || '')).trim(), p.phone || p.customer_phone, p.vehicle || p.model]
      .filter(Boolean).join(' · ');
  }

  function fillFromPerson(p) {
    const set = function (id, val) { const el = document.getElementById(id); if (el && val != null && String(val).trim()) el.value = String(val).trim(); };
    const name = p.customer || p.customer_name || p.name || ((p.first_name || '') + ' ' + (p.last_name || '')).trim();
    set('svc-in-name', name);
    set('svc-in-phone', p.phone || p.customer_phone || p.phone1);
    set('svc-in-email', p.email || p.customer_email);
    set('svc-in-vin', p.vin);
    set('svc-in-year', p.year);
    set('svc-in-make', p.make);
    set('svc-in-model', p.model || p.vehicle);
    set('svc-in-color', p.color);
    set('svc-in-plate', p.plate || p.license || p.license_plate);
    set('svc-in-mileage', p.mileage || p.odometer);
    set('svc-in-sa', p.advisor || p.sa);
    const hidden = document.getElementById('svc-in-contact-id');
    if (hidden) hidden.value = p.contact_id || p.id || '';
  }

  function parseAamva(text) {
    const src = String(text || '');
    const grab = function (code) {
      const m = src.match(new RegExp(code + '([^\n\r]+)'));
      return m ? m[1].trim() : '';
    };
    const first = grab('DAC') || grab('DCT');
    const last = grab('DCS') || grab('DAB');
    const mid = grab('DAD');
    const name = [first, mid, last].filter(Boolean).join(' ');
    return {
      name: name,
      first_name: first,
      last_name: last,
      license: grab('DAQ'),
      street: grab('DAG'),
      city: grab('DAI'),
      state: grab('DAJ'),
      zip: grab('DAK'),
      dob: grab('DBB')
    };
  }

  async function matchOrCreateCustomer(parsed) {
    const q = encodeURIComponent(parsed.name || parsed.license || '');
    let matches = [];
    try {
      const res = await fetch(api() + '/crm/contacts?limit=50&q=' + q, { headers: headers() });
      const json = await res.json();
      matches = json.contacts || json.data || [];
    } catch (e) {}
    const nameLow = String(parsed.name || '').toLowerCase();
    const hit = matches.find(function (c) {
      const n = ((c.first_name || '') + ' ' + (c.last_name || '')).trim().toLowerCase();
      return n && nameLow && (n === nameLow || n.indexOf(nameLow.split(' ')[0]) >= 0);
    });
    if (hit) {
      fillFromPerson(Object.assign({}, hit, { name: parsed.name }));
      if (typeof global.showToast === 'function') global.showToast('Matched customer from license', 'success');
      return hit;
    }
    try {
      const res = await fetch(api() + '/crm/contacts', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          first_name: parsed.first_name || parsed.name,
          last_name: parsed.last_name || '',
          source: 'service_walkin',
          notes: parsed.license ? ('DL ' + parsed.license) : 'Walk-in from license scan'
        })
      });
      const json = await res.json();
      const created = json.contact || json;
      fillFromPerson(Object.assign({}, created, { name: parsed.name }));
      if (typeof global.showToast === 'function') global.showToast('Walk-in customer added', 'success');
      return created;
    } catch (e) {
      fillFromPerson({ name: parsed.name });
      if (typeof global.showToast === 'function') global.showToast('Filled from license — add customer if needed', 'info');
    }
  }

  function openLicenseScan() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async function () {
      const file = input.files && input.files[0];
      if (!file) return;
      if (typeof global.showToast === 'function') global.showToast('Reading license…', 'info');
      try {
        if ('BarcodeDetector' in global) {
          const bmp = await createImageBitmap(file);
          const det = new BarcodeDetector({ formats: ['pdf417', 'qr_code', 'code_128'] });
          const codes = await det.detect(bmp);
          if (codes && codes[0] && codes[0].rawValue) {
            const parsed = parseAamva(codes[0].rawValue);
            if (parsed.name || parsed.license) {
              await matchOrCreateCustomer(parsed);
              return;
            }
          }
        }
      } catch (e) {}
      const nameEl = document.getElementById('svc-in-name');
      if (nameEl && !nameEl.value) nameEl.focus();
      if (typeof global.showToast === 'function') {
        global.showToast('Could not read the barcode. Search or add the customer below.', 'info');
      }
    };
    input.click();
  }

  function enhance() {
    const modal = document.getElementById('svc-checkin-modal');
    if (!modal || modal.dataset.msCheckinUp === '1') return;
    modal.dataset.msCheckinUp = '1';

    const date = document.getElementById('svc-in-date');
    const tag = document.getElementById('svc-in-tag');
    const plate = document.getElementById('svc-in-plate');
    const name = document.getElementById('svc-in-name');
    if (date) {
      date.classList.add('h-11');
      date.style.minHeight = '44px';
    }
    if (tag) {
      tag.classList.add('h-11');
      tag.style.minHeight = '44px';
      const lab = tag.previousElementSibling;
      if (lab) {
        lab.textContent = 'Key tag #';
        lab.title = 'Number on the valet / key-board tag so the shop can find the keys.';
      }
      tag.placeholder = 'Key hanger #';
    }
    if (plate) {
      const lab = plate.previousElementSibling;
      if (lab) lab.textContent = 'Plate #';
      const wrap = plate.parentElement;
      if (wrap && !wrap.querySelector('[data-scan-license]')) {
        wrap.classList.add('space-y-1');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-scan-license', '1');
        btn.className = 'w-full mt-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black py-2';
        btn.textContent = 'Scan license';
        btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openLicenseScan(); });
        wrap.appendChild(btn);
      }
    }
    if (name && !document.getElementById('svc-in-contact-id')) {
      const hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.id = 'svc-in-contact-id';
      name.parentElement.appendChild(hidden);

      const lab = name.previousElementSibling;
      if (lab) lab.textContent = 'Customer';
      name.placeholder = 'Search today\'s appointments or add a walk-in';
      name.setAttribute('autocomplete', 'off');

      const box = document.createElement('div');
      box.id = 'svc-in-cust-results';
      box.className = 'mt-1 max-h-40 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hidden';
      name.parentElement.appendChild(box);

      const actions = document.createElement('div');
      actions.className = 'mt-1 flex gap-2';
      actions.innerHTML = '<button type="button" data-scan-license="1" class="flex-1 rounded-lg bg-indigo-600 text-white text-xs font-black py-2">Scan license</button><button type="button" data-add-walkin="1" class="flex-1 rounded-lg border border-slate-300 text-xs font-black py-2">Add walk-in</button>';
      name.parentElement.appendChild(actions);
      actions.querySelector('[data-scan-license]').addEventListener('click', function (e) { e.preventDefault(); openLicenseScan(); });
      actions.querySelector('[data-add-walkin]').addEventListener('click', async function (e) {
        e.preventDefault();
        const n = name.value.trim();
        if (!n) { name.focus(); return; }
        const parts = n.split(/\s+/);
        try {
          const res = await fetch(api() + '/crm/contacts', {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({ first_name: parts[0], last_name: parts.slice(1).join(' '), source: 'service_walkin' })
          });
          const json = await res.json();
          fillFromPerson(Object.assign({}, json.contact || json, { name: n }));
          if (typeof global.showToast === 'function') global.showToast('Walk-in added', 'success');
        } catch (err) {
          if (typeof global.showToast === 'function') global.showToast('Could not add customer', 'error');
        }
      });

      async function renderResults(q) {
        const query = String(q || '').trim().toLowerCase();
        let rows = todayAppts().map(function (a) { return Object.assign({ _kind: 'Today' }, a); });
        if (query.length >= 2) {
          try {
            const res = await fetch(api() + '/crm/contacts?limit=25&q=' + encodeURIComponent(query), { headers: headers() });
            const json = await res.json();
            (json.contacts || []).forEach(function (c) {
              rows.push(Object.assign({ _kind: 'Customer', name: ((c.first_name || '') + ' ' + (c.last_name || '')).trim(), contact_id: c.id }, c));
            });
          } catch (e) {}
        }
        if (query) {
          rows = rows.filter(function (r) { return personLabel(r).toLowerCase().indexOf(query) >= 0; });
        }
        box.innerHTML = rows.slice(0, 12).map(function (r, i) {
          return '<button type="button" data-i="' + i + '" class="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800"><div class="font-black">' + personLabel(r) + '</div><div class="text-slate-400">' + (r._kind || '') + '</div></button>';
        }).join('') || '<div class="px-3 py-2 text-xs text-slate-400">No matches — add a walk-in</div>';
        box.classList.toggle('hidden', !rows.length && !query);
        box.querySelectorAll('button[data-i]').forEach(function (b) {
          b.addEventListener('click', function () {
            fillFromPerson(rows[Number(b.getAttribute('data-i'))]);
            box.classList.add('hidden');
          });
        });
      }

      name.addEventListener('focus', function () { renderResults(name.value); });
      name.addEventListener('input', function () { renderResults(name.value); });
      renderResults('');
    }
  }

  function wrap() {
    if (typeof global.svcOpenCheckInModal !== 'function' || global.svcOpenCheckInModal.__msUp) return;
    const orig = global.svcOpenCheckInModal;
    global.svcOpenCheckInModal = function () {
      const out = orig.apply(this, arguments);
      setTimeout(enhance, 30);
      setTimeout(enhance, 200);
      return out;
    };
    global.svcOpenCheckInModal.__msUp = true;
    enhance();
  }

  const t = setInterval(wrap, 400);
  setTimeout(function () { clearInterval(t); wrap(); }, 20000);
})(window);
