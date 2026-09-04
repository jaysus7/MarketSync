/* DVI concern / cause / correction must show the full sentence. */
(function () {
  function convert(input) {
    if (!input || input.tagName === 'TEXTAREA' || input.dataset.msWrap === '1') return;
    const ta = document.createElement('textarea');
    ta.className = input.className;
    ta.value = input.value;
    ta.id = input.id;
    ta.name = input.name;
    ta.rows = 3;
    ta.style.width = '100%';
    ta.style.minHeight = '4.5rem';
    ta.style.whiteSpace = 'pre-wrap';
    ta.style.overflowWrap = 'anywhere';
    ta.style.wordBreak = 'break-word';
    ta.style.resize = 'vertical';
    ta.dataset.msWrap = '1';
    input.replaceWith(ta);
  }

  function run() {
    document.querySelectorAll('label, .block, h4, div').forEach(function (lab) {
      const t = (lab.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!/customer concern|complaint|technician cause|recommended correction/.test(t)) return;
      const field = lab.parentElement && lab.parentElement.querySelector('input, textarea');
      if (field) convert(field);
    });
    document.querySelectorAll('input[type="text"]').forEach(function (input) {
      if ((input.value || '').length > 48) convert(input);
    });
  }

  setInterval(run, 600);
  run();
})();
