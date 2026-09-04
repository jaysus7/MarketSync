/* Replace cartoon walkaround boxes with sedan silhouettes. */
(function () {
  const CARS = {
    left: '<g fill="none" stroke="currentColor" stroke-linejoin="round" stroke-linecap="round">\
      <path d="M18 52 C20 40 28 32 42 30 L58 18 H104 L122 30 C136 32 146 40 148 52 L148 58 H18 Z" stroke-width="2"/>\
      <path d="M58 18 L66 30 H108 L122 30" stroke-width="1.6"/>\
      <path d="M78 18 V52" stroke-width="1.2"/>\
      <path d="M42 30 L42 52" stroke-width="1.2"/>\
      <path d="M122 30 L122 52" stroke-width="1.2"/>\
      <path d="M18 52 H148" stroke-width="1.4"/>\
      <circle cx="40" cy="60" r="9" stroke-width="2"/>\
      <circle cx="40" cy="60" r="4" stroke-width="1.4"/>\
      <circle cx="126" cy="60" r="9" stroke-width="2"/>\
      <circle cx="126" cy="60" r="4" stroke-width="1.4"/>\
      <path d="M148 46 h6 v4 h-6" stroke-width="1.4"/>\
      <path d="M24 38 h10" stroke-width="1.4"/>\
      <path d="M54 26 h8" stroke-width="1.5"/>\
    </g>',
    right: '<g fill="none" stroke="currentColor" stroke-linejoin="round" stroke-linecap="round">\
      <path d="M142 52 C140 40 132 32 118 30 L102 18 H56 L38 30 C24 32 14 40 12 52 L12 58 H142 Z" stroke-width="2"/>\
      <path d="M102 18 L94 30 H52 L38 30" stroke-width="1.6"/>\
      <path d="M82 18 V52" stroke-width="1.2"/>\
      <path d="M118 30 L118 52" stroke-width="1.2"/>\
      <path d="M38 30 L38 52" stroke-width="1.2"/>\
      <path d="M12 52 H142" stroke-width="1.4"/>\
      <circle cx="34" cy="60" r="9" stroke-width="2"/>\
      <circle cx="34" cy="60" r="4" stroke-width="1.4"/>\
      <circle cx="120" cy="60" r="9" stroke-width="2"/>\
      <circle cx="120" cy="60" r="4" stroke-width="1.4"/>\
      <path d="M12 46 h-6 v4 h6" stroke-width="1.4"/>\
      <path d="M126 38 h10" stroke-width="1.4"/>\
      <path d="M98 26 h8" stroke-width="1.5"/>\
    </g>',
    front: '<g fill="none" stroke="currentColor" stroke-linejoin="round" stroke-linecap="round">\
      <path d="M44 58 L48 34 C52 18 108 18 112 34 L116 58 Z" stroke-width="2"/>\
      <path d="M54 34 H106 C104 24 56 24 54 34 Z" stroke-width="1.6"/>\
      <rect x="46" y="50" width="16" height="7" rx="2" stroke-width="1.4"/>\
      <rect x="98" y="50" width="16" height="7" rx="2" stroke-width="1.4"/>\
      <rect x="62" y="52" width="36" height="5" rx="1.5" stroke-width="1.3"/>\
      <circle cx="52" cy="64" r="7" stroke-width="2"/>\
      <circle cx="108" cy="64" r="7" stroke-width="2"/>\
      <path d="M59 64 H101" stroke-width="1.5"/>\
      <path d="M70 28 h20" stroke-width="1.6"/>\
    </g>',
    rear: '<g fill="none" stroke="currentColor" stroke-linejoin="round" stroke-linecap="round">\
      <path d="M44 58 L48 32 C54 16 106 16 112 32 L116 58 Z" stroke-width="2"/>\
      <path d="M56 32 H104 C102 22 58 22 56 32 Z" stroke-width="1.6"/>\
      <rect x="46" y="46" width="18" height="8" rx="2" stroke-width="1.4"/>\
      <rect x="96" y="46" width="18" height="8" rx="2" stroke-width="1.4"/>\
      <rect x="68" y="50" width="24" height="6" rx="1.5" stroke-width="1.3"/>\
      <circle cx="52" cy="64" r="7" stroke-width="2"/>\
      <circle cx="108" cy="64" r="7" stroke-width="2"/>\
      <path d="M59 64 H101" stroke-width="1.5"/>\
    </g>',
    top: '<g fill="none" stroke="currentColor" stroke-linejoin="round" stroke-linecap="round">\
      <path d="M28 40 C30 18 130 18 132 40 C130 62 30 62 28 40 Z" stroke-width="2"/>\
      <path d="M46 28 H114 C118 40 118 40 114 52 H46 C42 40 42 40 46 28 Z" stroke-width="1.6"/>\
      <path d="M80 28 V52" stroke-width="1.2"/>\
      <path d="M46 40 H114" stroke-width="1.1"/>\
      <rect x="118" y="34" width="10" height="12" rx="2" stroke-width="1.3"/>\
      <rect x="32" y="34" width="10" height="12" rx="2" stroke-width="1.3"/>\
      <path d="M54 24 h12" stroke-width="1.4"/>\
      <path d="M94 24 h12" stroke-width="1.4"/>\
    </g>'
  };

  function paint() {
    Object.keys(CARS).forEach(function (id) {
      const svg = document.getElementById('svc-walk-' + id);
      if (!svg) return;
      svg.setAttribute('viewBox', '0 0 160 80');
      svg.classList.add('h-28');
      svg.style.height = '7rem';
      svg.innerHTML = CARS[id];
    });
  }

  const obs = new MutationObserver(paint);
  obs.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(paint, 800);
  paint();
})();
