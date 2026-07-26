/*!
 * MarketSync AI Chat — embeddable widget loader.
 * A dealer drops ONE line on any site (LeadBox, eDealer, WordPress, Wix, plain HTML):
 *   <script src="https://marketsync.link/marketsync-chat.js" data-dealer="DEALER_ID"></script>
 * It injects a floating bubble + an iframe hosting the chat UI (served from MarketSync,
 * so it works cross-site without CORS). Everything is scoped so it won't clash with the
 * host page's styles.
 */
(function () {
  var s = document.currentScript;
  if (!s) return;
  var dealer = s.getAttribute('data-dealer');
  if (!dealer) { console.warn('[marketsync-chat] missing data-dealer'); return; }
  var base = s.src.replace(/\/marketsync-chat\.js.*$/, '');
  var accent = s.getAttribute('data-color') || '#4f46e5';
  if (document.getElementById('marketsync-chat-root')) return; // once

  var root = document.createElement('div');
  root.id = 'marketsync-chat-root';
  root.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483000;font-family:system-ui,-apple-system,sans-serif;';

  var frame = document.createElement('iframe');
  frame.title = 'Chat with us';
  frame.src = base + '/chat-widget.html?dealer=' + encodeURIComponent(dealer);
  frame.style.cssText = 'display:none;width:380px;max-width:calc(100vw - 40px);height:560px;max-height:calc(100vh - 120px);border:0;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.28);background:#fff;margin-bottom:12px;';
  frame.setAttribute('allow', 'clipboard-write');

  var btn = document.createElement('button');
  btn.setAttribute('aria-label', 'Open chat');
  btn.style.cssText = 'width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;background:' + accent + ';color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;margin-left:auto;transition:transform .15s;';
  btn.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  var open = false;
  btn.onclick = function () {
    open = !open;
    frame.style.display = open ? 'block' : 'none';
    btn.style.transform = open ? 'scale(0.92)' : 'scale(1)';
  };

  root.appendChild(frame);
  root.appendChild(btn);
  (document.body || document.documentElement).appendChild(root);
})();
