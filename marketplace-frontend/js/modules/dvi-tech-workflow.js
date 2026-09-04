/* DVI is how the tech works the car after check-in. */
(function (global) {
  'use strict';

  const MPI = [
    'Battery / charging',
    'Belts & hoses',
    'Engine oil leaks',
    'Coolant level',
    'Brake pads front',
    'Brake pads rear',
    'Brake fluid',
    'Rotors / drums',
    'Tires tread & pressure',
    'Steering / suspension',
    'Lights / wipers',
    'Cabin filter',
    'Air filter',
    'Exhaust',
    'Undercarriage'
  ];

  function roFromId(id) {
    const lists = []
      .concat((global.__svcData && global.__svcData.ros) || [])
      .concat(global.__svcWorkOrders || [])
      .concat((global.__svcData && global.__svcData.appointments) || []);
    return lists.find(function (r) { return String(r.id) === String(id); }) || {};
  }

  function concernFrom(ro) {
    return ro.concern || ro.complaint || ro.customer_concern || ro.notes || ro.reason || '';
  }

  function decorate(modal, roId) {
    if (!modal || modal.dataset.msDviJob === '1') return;
    modal.dataset.msDviJob = '1';
    const ro = roFromId(roId);
    const checkin = global.__lastServiceWalkaround || {};

    const banner = document.createElement('div');
    banner.className = 'rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-xs space-y-1';
    banner.innerHTML =
      '<div class="font-black uppercase tracking-wider text-indigo-700">How the tech gets this</div>' +
      '<ol class="list-decimal pl-4 text-slate-700 space-y-1">' +
      '<li>Advisor check-in writes the customer concern and records the arrival video.</li>' +
      '<li>You open this DVI from the repair order assigned to you.</li>' +
      '<li>Inspect the car. Record the inspection video. Tap each item Red / Yellow / Green.</li>' +
      '<li>Write the cause and the correction. Request parts if needed.</li>' +
      '<li>Save. Service writes the estimate from these findings.</li>' +
      '</ol>';
    const box = modal.querySelector('.relative') || modal.firstElementChild;
    if (box && box.children[1]) box.insertBefore(banner, box.children[1]);
    else if (box) box.prepend(banner);

    const concern = modal.querySelector('textarea, input');
    const fields = modal.querySelectorAll('textarea, input[type="text"]');
    if (fields[0]) {
      const pulled = concernFrom(ro) || checkin.notes || fields[0].value;
      fields[0].value = pulled;
      fields[0].placeholder = 'Comes from check-in — edit if the customer added more';
    }
    if (fields[1] && /front brake pads worn/i.test(fields[1].value)) {
      fields[1].value = '';
      fields[1].placeholder = 'What you found on the car';
    }
    if (fields[2] && /replace front brake pads/i.test(fields[2].value)) {
      fields[2].value = '';
      fields[2].placeholder = 'What you recommend';
    }

    const listHost = Array.from(modal.querySelectorAll('h4')).find(function (h) {
      return /multi-point/i.test(h.textContent || '');
    });
    if (listHost && listHost.parentElement) {
      const wrap = listHost.parentElement.querySelector('.space-y-2') || listHost.parentElement;
      wrap.innerHTML = MPI.map(function (item, i) {
        return '<div class="p-3 rounded-xl border border-slate-200 flex flex-col gap-2" data-mpi="' + i + '">' +
          '<div class="text-sm font-black">' + item + '</div>' +
          '<div class="flex gap-2">' +
          '<button type="button" data-g="red" class="flex-1 py-2 rounded-lg text-[10px] font-black bg-rose-100 text-rose-800">Red</button>' +
          '<button type="button" data-g="yellow" class="flex-1 py-2 rounded-lg text-[10px] font-black bg-amber-100 text-amber-800">Yellow</button>' +
          '<button type="button" data-g="green" class="flex-1 py-2 rounded-lg text-[10px] font-black bg-emerald-100 text-emerald-800">Green</button>' +
          '</div></div>';
      }).join('');
      wrap.querySelectorAll('[data-g]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const row = btn.closest('[data-mpi]');
          row.querySelectorAll('[data-g]').forEach(function (b) { b.style.outline = ''; });
          btn.style.outline = '2px solid currentColor';
          row.dataset.grade = btn.getAttribute('data-g');
        });
      });
    }

    const rec = Array.from(modal.querySelectorAll('button')).find(function (b) {
      return /record inspection video/i.test(b.textContent || '');
    });
    if (rec && !rec.dataset.msBound) {
      rec.dataset.msBound = '1';
      rec.addEventListener('click', function (e) {
        e.preventDefault();
        if (typeof global.svcOpenTechVideoWalkaround === 'function') {
          global.svcOpenTechVideoWalkaround(roId, ro.customer_id || ro.contact_id);
        } else if (typeof global.svcOpenVideoWalkaround === 'function') {
          global.svcOpenVideoWalkaround(roId, ro.customer_id || ro.contact_id);
        }
      });
    }
  }

  function wrap() {
    if (typeof global.svcOpenDviModal !== 'function' || global.svcOpenDviModal.__msJob) return;
    const orig = global.svcOpenDviModal;
    global.svcOpenDviModal = function (roId) {
      const out = orig.apply(this, arguments);
      setTimeout(function () {
        decorate(document.getElementById('svc-dvi-modal'), roId);
      }, 40);
      return out;
    };
    global.svcOpenDviModal.__msJob = true;
    if (document.getElementById('svc-dvi-modal')) decorate(document.getElementById('svc-dvi-modal'));
  }

  const t = setInterval(wrap, 400);
  setTimeout(function () { clearInterval(t); wrap(); }, 20000);
})(window);
