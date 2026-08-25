// ── Staff Internal Chat Dock (Hangouts / Messenger Style) ──────────────────────
// Floating popup texting windows, staff directory list, emoji reactions & picker,
// and browser/in-app popup notifications.

(function () {
  let staffList = [];
  let channels = [];
  let openWindows = new Map(); // targetId -> { target, minimized: boolean, messages: [] }
  let unreadCounts = {};
  let pollInterval = null;
  let activeEmojiPicker = null;
  let disabled = false;

  // Internal staff messaging only makes sense inside a dealership with a team.
  // Independent single-product programs (Video, AI ChatBot, etc.) have no staff to
  // message — they must never see team chat. Facebook Dealer is a real dealership
  // team, so it keeps it. This is evaluated defensively at every entry point because
  // this dock boots on DOMContentLoaded, which can fire before data-product is set.
  function shouldHideStaffChat() {
    // applyProductNav sets this once the canonical DealerOS entitlement resolves.
    // It must win over a stale disabled state from an earlier provisional pass.
    if (window.__teamChatAllowed === true) return false;
    if (window.__teamChatAllowed === false) return true;
    // The rendered full department navigation is the final shell-level signal
    // when older access payloads do not expose dealer_os in their product array.
    // Standalone tools replace this list and set data-product instead.
    const dataProduct = (document.documentElement.getAttribute('data-product') || '').trim();
    const hasFullDealerShell = !dataProduct
      && !!document.querySelector('#dept-nav [data-dept="sales"]')
      && !!document.querySelector('#dept-nav [data-dept="inventory"]')
      && !!document.querySelector('#dept-nav [data-dept="service"]');
    if (hasFullDealerShell) return false;
    // Resolve the canonical access context before consulting provisional workspace
    // classification. DealerOS can be the account's only product and is still the
    // full dealership operating system with Team Chat.
    const accessProducts = window.__access?.products;
    if (Array.isArray(accessProducts) && accessProducts.length) {
      const hasDealerOs = accessProducts.includes('dealer_os');
      const hasFbDealer = accessProducts.includes('facebook_dealer') || accessProducts.includes('facebook');
      if (hasDealerOs || hasFbDealer) return false;
      return true;
    }
    if (disabled) return true;
    if (typeof window.isSingleProductWorkspace === 'function' && window.isSingleProductWorkspace()) {
      const products = (document.documentElement.getAttribute('data-product') || '').trim();
      const list = products ? products.split(/\s+/) : [];
      if (!list.includes('facebook_dealer') && !list.includes('dealer_os')) return true;
    }
    const products = (document.documentElement.getAttribute('data-product') || '').trim();
    if (!products) return false;
    const list = products.split(/\s+/);
    return list.length === 1 && !['facebook_dealer', 'dealer_os'].includes(list[0]);
  }

  // Called by applyProductNav once the tier is known (covers the case where this dock
  // booted before data-product was set): tears the dock down for good.
  window.disableStaffChatDock = function () {
    disabled = true;
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    document.getElementById('staff-chat-dock-bar')?.classList.add('hidden');
  };

  function startStaffChatDock() {
    if (shouldHideStaffChat()) return;
    // A provisional product pass can add `hidden` before canonical access settles.
    // Starting an entitled dock must always clear that stale presentation state.
    ensureDockContainer().classList.remove('hidden');
    initLauncherUI();
    fetchMembers();
    pollUnread();
    if (!pollInterval) pollInterval = setInterval(pollUnread, 5000);
  }

  window.enableStaffChatDock = function () {
    window.__teamChatAllowed = true;
    disabled = false;
    document.getElementById('staff-chat-dock-bar')?.classList.remove('hidden');
    startStaffChatDock();
  };

  const EMOJI_LIST = ['\u{1F44D}', '\u{2764}', '\u{1F525}', '\u{1F602}', '\u{1F44F}', '\u{1F680}', '\u{1F389}', '\u{1F697}', '\u{1F4AF}', '\u{1F64F}', '\u{2705}', '\u{1F440}', '\u{2B50}', '\u{1F4A1}', '\u{1F4AA}', '\u{1F91D}', '\u{26A1}', '\u{1F3AF}'];

  // Initialize Desktop/Browser Notification permissions
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  function getApi() {
    // dashboard.js declares API with top-level `const`, which is shared with later
    // classic scripts but intentionally is not a window property. Falling back to
    // `/api` here targets the static frontend origin and returns 404, causing the
    // dock to disable itself. Prefer the canonical dashboard backend identifier.
    if (typeof API !== 'undefined' && API) return API;
    return window.MS_API_BASE_URL || window.API || '/api';
  }
  function getToken() {
    return localStorage.getItem('token');
  }

  function disableWhenUnavailable(res) {
    if (res.status !== 403 && res.status !== 404) return false;
    disabled = true;
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    document.getElementById('staff-chat-dock-bar')?.classList.add('hidden');
    return true;
  }

  function renderDirectoryError(msg) {
    const dirList = document.getElementById('staff-chat-directory-list');
    if (dirList) dirList.innerHTML = `<div class="text-center py-4 px-3 text-xs text-slate-400">${esc(msg)}</div>`;
  }

  async function fetchMembers() {
    if (shouldHideStaffChat()) return;
    try {
      const res = await fetch(`${getApi()}/staff-chat/members`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      // Never leave the popover stuck on "Loading team…": surface a real state on failure.
      if (!res.ok) {
        if (disableWhenUnavailable(res)) return;
        renderDirectoryError(res.status === 403
          ? 'Team Messaging is included with DealerOS.'
          : 'Could not load your team right now.');
        return;
      }
      const data = await res.json();
      staffList = data.members || [];
      channels = data.channels || [];
      renderDirectory();
    } catch { renderDirectoryError('Could not load your team right now.'); }
  }

  async function pollUnread() {
    if (shouldHideStaffChat()) return;
    try {
      const res = await fetch(`${getApi()}/staff-chat/unread`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) { disableWhenUnavailable(res); return; }
      const data = await res.json();
      if (data.count > 0) {
        updateGlobalBadge(data.count);
        // Trigger popup toast & notification for new incoming messages
        (data.messages || []).forEach(msg => {
          if (!msg._notified) {
            msg._notified = true;
            triggerIncomingPopup(msg);
          }
        });
      } else {
        updateGlobalBadge(0);
      }
    } catch {}
  }

  function triggerIncomingPopup(msg) {
    if (shouldHideStaffChat()) return;
    const sender = staffList.find(s => s.id === msg.sender_id) || { name: msg.sender_name || 'Staff Member' };

    // 1. In-App Toast Alert
    if (typeof showToast === 'function') {
      showToast(`New message from ${sender.name}: ${msg.content}`, 'info');
    }

    // 2. Desktop Browser Popup Notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(`MarketSync Chat: ${sender.name}`, {
          body: msg.content,
          icon: '/favicon2.0.png'
        });
        notif.onclick = () => {
          window.focus();
          openChatWindow(sender.id);
        };
      } catch {}
    }

    // Auto open or refresh popup chat window if open
    if (openWindows.has(msg.sender_id)) {
      loadMessages(msg.sender_id);
    }
  }

  function updateGlobalBadge(count) {
    const badge = document.getElementById('staff-chat-global-badge');
    if (badge) {
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  }

  function ensureDockContainer() {
    let container = document.getElementById('staff-chat-dock-bar');
    if (!container) {
      container = document.createElement('div');
      container.id = 'staff-chat-dock-bar';
      container.className = 'staff-chat-dock-bar';
      document.body.appendChild(container);
    }
    return container;
  }

  function renderDirectory() {
    const dirList = document.getElementById('staff-chat-directory-list');
    if (!dirList) return;

    let html = '';

    // Department Channels
    if (channels.length) {
      html += `<div class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-3 py-1.5 mt-1">Team Channels</div>`;
      html += channels.map(c => `
        <button type="button" onclick="window.openStaffChat('${c.id}')" class="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition">
          <span class="w-6 h-6 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">#</span>
          <span class="truncate flex-1 text-left">${esc(c.name)}</span>
        </button>
      `).join('');
    }

    // Staff Members
    html += `<div class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-3 py-1.5 mt-2">Staff Members (${staffList.length})</div>`;
    if (staffList.length === 0) {
      html += `<div class="text-xs text-slate-400 px-3 py-2">No other staff online</div>`;
    } else {
      html += staffList.map(s => `
        <button type="button" onclick="window.openStaffChat('${s.id}')" class="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition">
          <span class="relative flex-shrink-0">
            <span class="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold text-[11px]">${esc(s.initials)}</span>
            <span class="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"></span>
          </span>
          <div class="flex-1 text-left min-w-0">
            <div class="font-bold truncate text-slate-900 dark:text-white">${esc(s.name)}</div>
            <div class="text-[10px] text-slate-400 truncate">${esc(s.department || s.role)}</div>
          </div>
        </button>
      `).join('');
    }

    dirList.innerHTML = html;
  }

  window.openStaffChat = function (targetId) {
    // Hide directory panel
    document.getElementById('staff-chat-directory-popover')?.classList.add('hidden');
    openChatWindow(targetId);
  };

  function openChatWindow(targetId) {
    const target = [...channels, ...staffList].find(x => x.id === targetId) || { id: targetId, name: 'Staff Chat' };

    let winState = openWindows.get(targetId);
    if (!winState) {
      winState = { target, minimized: false, messages: [] };
      openWindows.set(targetId, winState);
      renderChatWindow(targetId);
    } else {
      winState.minimized = false;
      const winEl = document.getElementById(`staff-chat-win-${targetId}`);
      if (winEl) winEl.classList.remove('minimized');
    }

    loadMessages(targetId);
  }

  async function loadMessages(targetId) {
    try {
      const res = await fetch(`${getApi()}/staff-chat/messages?target_id=${encodeURIComponent(targetId)}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) return;
      const msgs = await res.json();
      const winState = openWindows.get(targetId);
      if (winState) {
        winState.messages = msgs || [];
        updateChatMessagesUI(targetId);
      }
    } catch {}
  }

  function renderChatWindow(targetId) {
    const dock = ensureDockContainer();
    const winState = openWindows.get(targetId);
    if (!winState) return;

    const target = winState.target;
    const isChannel = target.type === 'channel';

    const winId = `staff-chat-win-${targetId}`;
    let winEl = document.getElementById(winId);

    if (!winEl) {
      winEl = document.createElement('div');
      winEl.id = winId;
      winEl.className = 'staff-chat-window';
      dock.insertBefore(winEl, dock.firstChild);
    }

    winEl.innerHTML = `
      <!-- Window Header (Messenger / Hangouts style) -->
      <div class="staff-chat-header" onclick="window.toggleStaffChatMinimize('${targetId}')">
        <div class="flex items-center gap-2 min-w-0">
          <span class="w-2.5 h-2.5 rounded-full ${isChannel ? 'bg-indigo-400' : 'bg-emerald-400'} flex-shrink-0"></span>
          <span class="font-bold text-xs truncate text-white">${esc(target.name)}</span>
        </div>
        <div class="flex items-center gap-1.5 text-slate-300" onclick="event.stopPropagation()">
          <button type="button" onclick="window.toggleStaffChatMinimize('${targetId}')" class="hover:text-white p-1 text-xs">_</button>
          <button type="button" onclick="window.closeStaffChatWindow('${targetId}')" class="hover:text-white p-1 text-xs">\u{2715}</button>
        </div>
      </div>

      <!-- Messages Area -->
      <div id="staff-chat-body-${targetId}" class="staff-chat-messages bg-slate-50 dark:bg-slate-900/90">
        <div class="text-center py-4 text-xs text-slate-400">Loading messages…</div>
      </div>

      <!-- Footer & Input Bar -->
      <div class="p-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 relative">
        <form onsubmit="window.sendStaffChatMessage(event, '${targetId}')" class="flex items-center gap-1.5">
          <button type="button" onclick="window.toggleEmojiPicker(event, '${targetId}')" class="p-1.5 text-slate-400 hover:text-indigo-500 rounded transition text-base" title="Add emoji">\u{1F600}</button>
          <input type="text" id="staff-chat-input-${targetId}" placeholder="Type a message…" autocomplete="off" class="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-xs px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-indigo-500 outline-none" />
          <button type="submit" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3 py-2 rounded-lg transition">Send</button>
        </form>
        <div id="emoji-picker-${targetId}" class="emoji-picker-popover hidden">
          ${EMOJI_LIST.map(e => `<span class="emoji-picker-item" onclick="window.insertEmoji('${targetId}', '${e}')">${e}</span>`).join('')}
        </div>
      </div>
    `;

    updateChatMessagesUI(targetId);
  }

  function updateChatMessagesUI(targetId) {
    const bodyEl = document.getElementById(`staff-chat-body-${targetId}`);
    const winState = openWindows.get(targetId);
    if (!bodyEl || !winState) return;

    const msgs = winState.messages || [];
    const myId = parseJwtUser()?.id;

    if (msgs.length === 0) {
      bodyEl.innerHTML = `<div class="text-center py-8 text-xs text-slate-400">Start the conversation with ${esc(winState.target.name)}</div>`;
      return;
    }

    bodyEl.innerHTML = msgs.map(m => {
      const isMine = m.sender_id === myId;
      const rxKeys = Object.keys(m.reactions || {});
      const rxHtml = rxKeys.length ? `<div class="staff-chat-reactions">${rxKeys.map(k => `<span class="staff-chat-reaction-pill" onclick="window.reactStaffMessage('${targetId}', '${m.id}', '${k}')">${k} ${(m.reactions[k] || []).length}</span>`).join('')}</div>` : '';

      return `
        <div class="flex flex-col ${isMine ? 'items-end' : 'items-start'}">
          ${!isMine ? `<span class="text-[10px] text-slate-400 mb-0.5 ml-1 font-semibold">${esc(m.sender_name || 'Staff')}</span>` : ''}
          <div class="staff-chat-bubble ${isMine ? 'mine' : 'theirs'}">
            ${esc(m.content)}
          </div>
          ${rxHtml}
          <div class="flex items-center gap-1 text-[9px] text-slate-400 mt-0.5 px-1">
            <span>${new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <button type="button" onclick="window.reactStaffMessage('${targetId}', '${m.id}', '\u{1F44D}')" class="hover:text-indigo-500 font-bold ml-1">+\u{1F44D}</button>
          </div>
        </div>
      `;
    }).join('');

    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  window.toggleStaffChatMinimize = function (targetId) {
    const winState = openWindows.get(targetId);
    const winEl = document.getElementById(`staff-chat-win-${targetId}`);
    if (winState && winEl) {
      winState.minimized = !winState.minimized;
      winEl.classList.toggle('minimized', winState.minimized);
    }
  };

  window.closeStaffChatWindow = function (targetId) {
    openWindows.delete(targetId);
    document.getElementById(`staff-chat-win-${targetId}`)?.remove();
  };

  window.sendStaffChatMessage = async function (e, targetId) {
    e.preventDefault();
    const input = document.getElementById(`staff-chat-input-${targetId}`);
    if (!input || !input.value.trim()) return;

    const text = input.value.trim();
    input.value = '';

    try {
      const res = await fetch(`${getApi()}/staff-chat/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ recipient_id: targetId, content: text })
      });
      if (res.ok) {
        loadMessages(targetId);
      }
    } catch {}
  };

  window.toggleEmojiPicker = function (e, targetId) {
    e.stopPropagation();
    const picker = document.getElementById(`emoji-picker-${targetId}`);
    if (picker) {
      picker.classList.toggle('hidden');
    }
  };

  window.insertEmoji = function (targetId, emoji) {
    const input = document.getElementById(`staff-chat-input-${targetId}`);
    if (input) {
      input.value += emoji;
      input.focus();
    }
    document.getElementById(`emoji-picker-${targetId}`)?.classList.add('hidden');
  };

  window.reactStaffMessage = async function (targetId, messageId, emoji) {
    try {
      await fetch(`${getApi()}/staff-chat/react`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message_id: messageId, emoji })
      });
      loadMessages(targetId);
    } catch {}
  };

  function parseJwtUser() {
    try {
      const token = getToken();
      if (!token) return null;
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(window.atob(base64));
    } catch {
      return null;
    }
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Create floating trigger button (Launcher head & Directory Popover)
  function initLauncherUI() {
    if (shouldHideStaffChat()) return;
    if (document.getElementById('staff-chat-launcher-btn')) return;

    const dock = ensureDockContainer();

    const launcherWrap = document.createElement('div');
    launcherWrap.className = 'relative';

    launcherWrap.innerHTML = `
      <!-- Launcher Button -->
      <button type="button" id="staff-chat-launcher-btn" onclick="window.toggleStaffDirectoryPopover()" class="staff-chat-head-btn bg-gradient-to-tr from-indigo-600 to-violet-600 text-white" title="Internal Staff Messaging">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.7 9.7 0 01-4-.85L3 21l1.85-4.5A8 8 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
        <span id="staff-chat-global-badge" class="hidden absolute -top-1 -right-1 bg-rose-500 text-white font-extrabold text-[10px] w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white">0</span>
      </button>

      <!-- Staff Directory Popover -->
      <div id="staff-chat-directory-popover" class="hidden absolute bottom-14 left-0 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-[10000]">
        <div class="p-3 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div class="font-bold text-xs flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            Internal Staff Chat
          </div>
          <button type="button" onclick="window.toggleStaffDirectoryPopover()" class="text-slate-400 hover:text-white text-xs p-1">\u{2715}</button>
        </div>
        <div id="staff-chat-directory-list" class="max-h-80 overflow-y-auto p-2">
          <div class="text-center py-4 text-xs text-slate-400">Loading team...</div>
        </div>
      </div>
    `;

    dock.appendChild(launcherWrap);
  }

  window.toggleStaffDirectoryPopover = function () {
    const popover = document.getElementById('staff-chat-directory-popover');
    if (popover) {
      popover.classList.toggle('hidden');
      if (!popover.classList.contains('hidden')) {
        fetchMembers();
      }
    }
  };

  function bootStaffChatDock() {
    startStaffChatDock();
    // Role-aware department navigation resolves asynchronously and can finish
    // after fixed boot delays. Reconcile on the actual nav mutation so the full
    // DealerOS shell—not timing—decides whether Team Chat is visible.
    const nav = document.getElementById('dept-nav');
    if (nav && typeof MutationObserver === 'function') {
      const observer = new MutationObserver(() => startStaffChatDock());
      observer.observe(nav, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), 15000);
    }
    setTimeout(startStaffChatDock, 1200);
  }

  // Start immediately when this late dashboard module arrives after DOM ready.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootStaffChatDock, { once: true });
  } else {
    bootStaffChatDock();
  }

  // Global click to close emoji pickers
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.emoji-picker-popover') && !e.target.closest('[title="Add emoji"]')) {
      document.querySelectorAll('.emoji-picker-popover').forEach(el => el.classList.add('hidden'));
    }
  });
})();
