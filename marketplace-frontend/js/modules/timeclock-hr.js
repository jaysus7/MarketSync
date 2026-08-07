// ── MarketSync Frontend Module: Time Clock & HR Shift Tracker ──────────────────
var __shiftTimerInterval = window.__shiftTimerInterval || null;

function getTimeClockState() {
  let state = { status: 'out', startTime: null, breakTotalMs: 0, breakStartTime: null, time: null };
  try {
    const raw = localStorage.getItem('ms_timeclock_state');
    if (raw) state = JSON.parse(raw);
  } catch (e) {}
  return state;
}
window.getTimeClockState = getTimeClockState;

function formatDurationHMS(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = n => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
window.formatDurationHMS = formatDurationHMS;

function updateShiftClockUI() {
  const clockChip = document.getElementById('header-shift-clock-chip');
  const timerDisplay = document.getElementById('header-shift-timer-display');
  const clockState = getTimeClockState();

  if (clockChip && timerDisplay) {
    if (clockState.status === 'in' || clockState.status === 'break') {
      clockChip.classList.remove('hidden');
      clockChip.classList.add('flex');

      const now = Date.now();
      const startTime = clockState.startTime || now;
      const breakTotalMs = clockState.breakTotalMs || 0;

      if (clockState.status === 'in') {
        const elapsedMs = Math.max(0, now - startTime - breakTotalMs);
        clockChip.className = 'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black transition border shadow-sm cursor-pointer whitespace-nowrap bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20';
        timerDisplay.innerHTML = `🟢 SHIFT: <span class="font-mono font-bold">${formatDurationHMS(elapsedMs)}</span>`;
      } else if (clockState.status === 'break') {
        const currentBreakMs = clockState.breakStartTime ? (now - clockState.breakStartTime) : 0;
        const elapsedMs = Math.max(0, (clockState.breakStartTime || now) - startTime - breakTotalMs);
        clockChip.className = 'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black transition border shadow-sm cursor-pointer whitespace-nowrap bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20';
        timerDisplay.innerHTML = `☕ BREAK (${formatDurationHMS(currentBreakMs)}): <span class="font-mono font-bold">${formatDurationHMS(elapsedMs)}</span>`;
      }
    } else {
      clockChip.classList.add('hidden');
      clockChip.classList.remove('flex');
    }
  }

  const widgetLiveTimer = document.getElementById('workstation-live-timer');
  if (widgetLiveTimer) {
    const now = Date.now();
    const startTime = clockState.startTime || now;
    const breakTotalMs = clockState.breakTotalMs || 0;

    if (clockState.status === 'in') {
      const elapsedMs = Math.max(0, now - startTime - breakTotalMs);
      widgetLiveTimer.textContent = formatDurationHMS(elapsedMs);
    } else if (clockState.status === 'break') {
      const elapsedMs = Math.max(0, (clockState.breakStartTime || now) - startTime - breakTotalMs);
      widgetLiveTimer.textContent = formatDurationHMS(elapsedMs) + ' (Paused)';
    } else {
      widgetLiveTimer.textContent = '00:00:00';
    }
  }
}
window.updateShiftClockUI = updateShiftClockUI;

function startShiftClockTimer() {
  if (__shiftTimerInterval) clearInterval(__shiftTimerInterval);
  __shiftTimerInterval = setInterval(updateShiftClockUI, 1000);
  updateShiftClockUI();
}
window.startShiftClockTimer = startShiftClockTimer;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startShiftClockTimer);
} else {
  startShiftClockTimer();
}

function checkLoginPunchClockPrompt() {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const lastPromptDate = localStorage.getItem('ms_timeclock_prompt_date');
    const clockState = getTimeClockState();

    if (lastPromptDate !== todayStr && clockState.status === 'out') {
      localStorage.setItem('ms_timeclock_prompt_date', todayStr);

      let userName = 'Team Member';
      try {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        userName = u.first_name || u.full_name || 'Team Member';
      } catch {}

      const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateNow = new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

      setTimeout(() => {
        const modalHtml = `
          <div class="space-y-5">
            <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-indigo-500/30">⏱️</div>
                <div>
                  <h3 class="text-lg font-black text-slate-900 dark:text-white">Good Morning, ${esc(userName)}!</h3>
                  <p class="text-xs text-indigo-600 dark:text-indigo-400 font-bold">${esc(dateNow)} · ${esc(timeNow)}</p>
                </div>
              </div>
              <button data-close class="text-slate-400 hover:text-slate-600 text-2xl font-bold">×</button>
            </div>
            <div class="bg-gradient-to-br from-indigo-50 to-slate-50 dark:from-indigo-950/40 dark:to-slate-900 border border-indigo-100 dark:border-indigo-900/40 p-4 rounded-2xl text-xs space-y-2">
              <div class="font-black text-indigo-950 dark:text-indigo-200 text-sm flex items-center gap-1.5">
                <span>📋</span><span>Daily Shift Punch Clock</span>
              </div>
              <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
                Welcome to MarketSync! Please record your shift start time for HR attendance and automated payroll logs.
              </p>
            </div>
            <div class="space-y-2 pt-1">
              <button onclick="handleTimeClockAction('in'); document.querySelector('#automation-modal [data-close]')?.click();" class="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-md shadow-emerald-600/30 transition flex items-center justify-center gap-2">
                <span>🟢</span><span>Clock In Now (${esc(timeNow)})</span>
              </button>
              <div class="grid grid-cols-2 gap-2">
                <button onclick="handleTimeClockAction('break'); document.querySelector('#automation-modal [data-close]')?.click();" class="py-2.5 px-3 rounded-xl bg-amber-500/10 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 font-bold text-xs border border-amber-200 dark:border-amber-800 transition">
                  ☕ Start on Break
                </button>
                <button onclick="document.querySelector('#automation-modal [data-close]')?.click();" class="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 font-bold text-xs transition">
                  Remind Me Later
                </button>
              </div>
            </div>
          </div>
        `;
        if (typeof automationModal === 'function') {
          automationModal(modalHtml, 'max-w-md');
        }
      }, 1200);
    }
  } catch (e) {
    console.warn('Login punch clock check failed:', e);
  }
}
window.checkLoginPunchClockPrompt = checkLoginPunchClockPrompt;

function openSignOutClockModal() {
  const clockState = getTimeClockState();
  const modalHtml = `
    <div class="space-y-5">
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-500 flex items-center justify-center text-xl font-black">⏱️</div>
          <div>
            <h3 class="text-base font-black text-slate-900 dark:text-white">Clock Out & Sign Out</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Shift Clock Out Prompt on Exit</p>
          </div>
        </div>
        <button data-close class="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
      </div>
      <div class="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-4 rounded-2xl text-xs space-y-2">
        <div class="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
          <span>⚠️</span><span>You are currently clocked in!</span>
        </div>
        <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
          Your shift is active (clocked in at <strong>${esc(clockState.time || 'Today')}</strong>). Would you like to clock out of your shift before signing out?
        </p>
      </div>
      <div class="space-y-2 pt-1">
        <button onclick="handleTimeClockAction('out'); executeActualSignOut();" class="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-md shadow-rose-600/30 transition flex items-center justify-center gap-2">
          <span>🔴</span><span>Clock Out & Sign Out</span>
        </button>
        <button onclick="executeActualSignOut();" class="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition">
          Sign Out Only (Stay Clocked In)
        </button>
      </div>
    </div>
  `;
  if (typeof automationModal === 'function') {
    automationModal(modalHtml, 'max-w-md');
  } else {
    executeActualSignOut();
  }
}
window.openSignOutClockModal = openSignOutClockModal;

function handleTimeClockAction(action) {
  let state = getTimeClockState();
  const now = Date.now();
  const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (action === 'in') {
    state = {
      status: 'in',
      startTime: now,
      breakTotalMs: 0,
      breakStartTime: null,
      time: timeNow
    };
    try { apiSendJson('/hr/timeclock/in', 'POST', { notes: 'Shift Started' }).catch(() => {}); } catch(e) {}
    toast(`🟢 Clocked in for shift at ${timeNow}! Live clock active in top header.`);
  } else if (action === 'break') {
    if (state.status === 'break') {
      const currentBreakMs = state.breakStartTime ? (now - state.breakStartTime) : 0;
      state.breakTotalMs = (state.breakTotalMs || 0) + currentBreakMs;
      state.breakStartTime = null;
      state.status = 'in';
      toast(`🟢 Resumed shift from break at ${timeNow}`);
    } else {
      state.status = 'break';
      state.breakStartTime = now;
      toast(`☕ Started lunch break at ${timeNow}`);
    }
  } else if (action === 'out') {
    const elapsedMs = state.startTime ? Math.max(0, now - state.startTime - (state.breakTotalMs || 0)) : 0;
    const finalDurationStr = formatDurationHMS(elapsedMs);
    state = { status: 'out', startTime: null, breakTotalMs: 0, breakStartTime: null, time: timeNow };
    try { apiSendJson('/hr/timeclock/out', 'POST', { notes: 'Shift Completed' }).catch(() => {}); } catch(e) {}
    toast(`🔴 Clocked out from shift at ${timeNow}. Total shift duration: ${finalDurationStr}. Have a great day!`);
  }

  try { localStorage.setItem('ms_timeclock_state', JSON.stringify(state)); } catch {}
  startShiftClockTimer();
  if (typeof renderPeopleCompliance === 'function') {
    try { renderPeopleCompliance(); } catch (e) {}
  }
}
window.handleTimeClockAction = handleTimeClockAction;
