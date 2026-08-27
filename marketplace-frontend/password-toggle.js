/**
 * MarketSync Universal Password Visibility Toggle
 * Automatically attaches an eye icon button to all password inputs across the application.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function createEyeSvg(isPassword) {
    if (isPassword) {
      // Eye Icon (Click to show password)
      return '<svg style="width:1.25rem;height:1.25rem;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>';
    }
    // Eye Slash / Off Icon (Click to hide password)
    return '<svg style="width:1.25rem;height:1.25rem;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.046 10.046 0 012.122-.063c4.478 0 8.268 2.943 9.542 7a9.97 9.97 0 01-1.563 3.029m-5.858 5.908L3 3l18 18"/></svg>';
  }

  function attachPasswordToggle(input) {
    if (!input || input.dataset.msEyeAttached) return;
    input.dataset.msEyeAttached = 'true';

    var parent = input.parentElement;
    if (!parent) return;

    if (!parent.classList.contains('relative') && getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    input.style.paddingRight = '2.75rem';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ms-eye-toggle-btn';
    btn.setAttribute('aria-label', 'Toggle password visibility');
    btn.setAttribute('tabindex', '-1');
    btn.style.cssText = 'position:absolute; right:0.75rem; top:50%; transform:translateY(-50%); background:none; border:none; padding:0.25rem; color:#94a3b8; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; z-index:10; border-radius:0.375rem; transition:color 0.15s ease;';

    btn.innerHTML = createEyeSvg(input.type === 'password');

    btn.addEventListener('mouseenter', function () {
      btn.style.color = '#2563EB';
    });
    btn.addEventListener('mouseleave', function () {
      btn.style.color = '#94a3b8';
    });

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      btn.setAttribute('aria-label', isPass ? 'Hide password' : 'Show password');
      btn.innerHTML = createEyeSvg(input.type === 'password');
    });

    parent.appendChild(btn);
  }

  function scanPasswordInputs() {
    var inputs = document.querySelectorAll('input[type="password"], input[data-is-password="true"]');
    for (var i = 0; i < inputs.length; i++) {
      attachPasswordToggle(inputs[i]);
    }
  }

  window.attachPasswordToggle = attachPasswordToggle;
  window.scanPasswordInputs = scanPasswordInputs;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanPasswordInputs);
  } else {
    scanPasswordInputs();
  }

  if (typeof MutationObserver !== 'undefined') {
    var timer = null;
    var observer = new MutationObserver(function () {
      if (timer) return;
      timer = requestAnimationFrame(function () {
        timer = null;
        scanPasswordInputs();
      });
    });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }
})();
