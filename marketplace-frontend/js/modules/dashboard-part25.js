/* dashboard.js split part 25/26 — contiguous, load-order-critical. Do not reorder the <script> tags in dashboard.html. */

window.setPeopleComplianceView = (v) => {
  __peopleComplianceView = v;
  renderPeopleCompliance();
};

// ── 1. Time Clock & Shift Attendance Sub-System ─────────────────────────────
let __shiftTimerInterval = null;

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

function toggleShiftDropdown(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('header-shift-dropdown');
  if (!dropdown) return;
  const isHidden = dropdown.classList.contains('hidden');
  document.querySelectorAll('#header-shift-dropdown').forEach(d => d.classList.add('hidden'));
  if (isHidden) {
    dropdown.classList.remove('hidden');
  }
}
window.toggleShiftDropdown = toggleShiftDropdown;

// Global click handler to close shift dropdown when clicking outside
document.addEventListener('click', (e) => {
  const wrapper = document.getElementById('header-shift-clock-wrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    const dropdown = document.getElementById('header-shift-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
  }
});

let __lastRenderedClockStatus = null;

function updateShiftClockUI() {
  if (document.hidden) return;
  const clockChip = document.getElementById('header-shift-clock-chip');
  const timerDisplay = document.getElementById('header-shift-timer-display');
  const statusDot = document.getElementById('header-shift-status-dot');
  const clockState = getTimeClockState();

  const now = Date.now();
  const startTime = clockState.startTime || now;
  const breakTotalMs = clockState.breakTotalMs || 0;
  const currentBreakMs = clockState.status === 'break' && clockState.breakStartTime ? (now - clockState.breakStartTime) : 0;
  const elapsedMs = clockState.status === 'in' ? Math.max(0, now - startTime - breakTotalMs)
                 : clockState.status === 'break' ? Math.max(0, (clockState.breakStartTime || now) - startTime - breakTotalMs)
                 : 0;

  // Header chip updates
  if (clockChip && timerDisplay) {
    if (clockState.status === 'in') {
      clockChip.className = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black transition border shadow-sm cursor-pointer whitespace-nowrap bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20';
      if (statusDot) statusDot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
      timerDisplay.innerHTML = `SHIFT: <span class="font-mono font-bold">${formatDurationHMS(elapsedMs)}</span>`;
    } else if (clockState.status === 'break') {
      clockChip.className = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black transition border shadow-sm cursor-pointer whitespace-nowrap bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20';
      if (statusDot) statusDot.className = 'w-2 h-2 rounded-full bg-amber-500 animate-pulse';
      timerDisplay.innerHTML = `BREAK: <span class="font-mono font-bold">${formatDurationHMS(currentBreakMs)}</span>`;
    } else {
      clockChip.className = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap';
      if (statusDot) statusDot.className = 'w-2 h-2 rounded-full bg-slate-400';
      timerDisplay.innerHTML = `Off Shift — Clock In`;
    }
  }

  // Dropdown UI updates
  const badge = document.getElementById('shift-dropdown-status-badge');
  const durEl = document.getElementById('shift-dropdown-duration');
  const startEl = document.getElementById('shift-dropdown-start-time');
  const breakEl = document.getElementById('shift-dropdown-break-time');
  const actionsEl = document.getElementById('shift-dropdown-actions');

  if (badge && durEl && startEl && breakEl && actionsEl) {
    durEl.textContent = formatDurationHMS(elapsedMs);
    startEl.textContent = clockState.time || '--:--';
    breakEl.textContent = formatDurationHMS((breakTotalMs || 0) + currentBreakMs);

    if (__lastRenderedClockStatus !== clockState.status) {
      __lastRenderedClockStatus = clockState.status;
      if (clockState.status === 'in') {
        badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300';
        badge.textContent = 'Clocked In';
        actionsEl.innerHTML = `
          <button onclick="handleTimeClockAction('break'); toggleShiftDropdown();" class="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-sm">
            Take Break (Rest / Lunch)
          </button>
          <button onclick="handleTimeClockAction('out'); toggleShiftDropdown();" class="w-full py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-sm">
            End Shift &amp; Clock Out
          </button>
        `;
      } else if (clockState.status === 'break') {
        badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300';
        badge.textContent = 'On Break';
        actionsEl.innerHTML = `
          <button onclick="handleTimeClockAction('break'); toggleShiftDropdown();" class="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-sm">
            Resume Shift (End Break)
          </button>
          <button onclick="handleTimeClockAction('out'); toggleShiftDropdown();" class="w-full py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-sm">
            End Shift &amp; Clock Out
          </button>
        `;
      } else {
        badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
        badge.textContent = 'Off Shift';
        actionsEl.innerHTML = `
          <button onclick="handleTimeClockAction('in'); toggleShiftDropdown();" class="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md">
            Start Shift / Clock In Now
          </button>
        `;
      }
    }
  }

  const widgetLiveTimer = document.getElementById('workstation-live-timer');
  if (widgetLiveTimer) {
    if (clockState.status === 'in') {
      widgetLiveTimer.textContent = formatDurationHMS(elapsedMs);
    } else if (clockState.status === 'break') {
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

// Automated Sign-In Clock Prompt (fires once per day upon login if clocked out)
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
                <div class="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-indigo-500/30">
                  ⏱
                </div>
                <div>
                  <h3 class="text-lg font-black text-slate-900 dark:text-white">Good Morning, ${esc(userName)}!</h3>
                  <p class="text-xs text-indigo-600 dark:text-indigo-400 font-bold">${esc(dateNow)} · ${esc(timeNow)}</p>
                </div>
              </div>
              <button data-close class="text-slate-400 hover:text-slate-600 text-2xl font-bold">×</button>
            </div>

            <div class="bg-gradient-to-br from-indigo-50 to-slate-50 dark:from-indigo-950/40 dark:to-slate-900 border border-indigo-100 dark:border-indigo-900/40 p-4 rounded-2xl text-xs space-y-2">
              <div class="font-black text-indigo-950 dark:text-indigo-200 text-sm flex items-center gap-1.5">
                <span></span><span>Daily Shift Punch Clock</span>
              </div>
              <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
                Welcome to MarketSync! Please record your shift start time for HR attendance and automated payroll logs.
              </p>
            </div>

            <div class="space-y-2 pt-1">
              <button onclick="handleTimeClockAction('in'); document.querySelector('#automation-modal [data-close]')?.click();" class="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-md shadow-emerald-600/30 transition flex items-center justify-center gap-2">
                <span></span><span>Clock In Now (${esc(timeNow)})</span>
              </button>
              <div class="grid grid-cols-2 gap-2">
                <button onclick="handleTimeClockAction('break'); document.querySelector('#automation-modal [data-close]')?.click();" class="py-2.5 px-3 rounded-xl bg-amber-500/10 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 font-bold text-xs border border-amber-200 dark:border-amber-800 transition">
                   Start on Break
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

// Automated Sign-Out / Exit Clock Out Intercept Modal
function openSignOutClockModal() {
  const clockState = getTimeClockState();
  const modalHtml = `
    <div class="space-y-5">
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-500 flex items-center justify-center text-xl font-black">
            ⏱
          </div>
          <div>
            <h3 class="text-base font-black text-slate-900 dark:text-white">Clock Out & Sign Out</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Shift Clock Out Prompt on Exit</p>
          </div>
        </div>
        <button data-close class="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
      </div>

      <div class="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-4 rounded-2xl text-xs space-y-2">
        <div class="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
          <span></span><span>You are currently clocked in!</span>
        </div>
        <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
          Your shift is active (clocked in at <strong>${esc(clockState.time || 'Today')}</strong>). Would you like to clock out of your shift before signing out?
        </p>
      </div>

      <div class="space-y-2 pt-1">
        <button onclick="handleTimeClockAction('out'); executeActualSignOut();" class="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-md shadow-rose-600/30 transition flex items-center justify-center gap-2">
          <span></span><span>Clock Out & Sign Out</span>
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
    toast(` Clocked in for shift at ${timeNow}! Live clock active in top header.`);
  } else if (action === 'break') {
    if (state.status === 'break') {
      const currentBreakMs = state.breakStartTime ? (now - state.breakStartTime) : 0;
      state.breakTotalMs = (state.breakTotalMs || 0) + currentBreakMs;
      state.breakStartTime = null;
      state.status = 'in';
      toast(` Resumed shift from break at ${timeNow}`);
    } else {
      state.status = 'break';
      state.breakStartTime = now;
      toast(` Started lunch break at ${timeNow}`);
    }
  } else if (action === 'out') {
    const elapsedMs = state.startTime ? Math.max(0, now - state.startTime - (state.breakTotalMs || 0)) : 0;
    const finalDurationStr = formatDurationHMS(elapsedMs);
    state = { status: 'out', startTime: null, breakTotalMs: 0, breakStartTime: null, time: timeNow };
    try { apiSendJson('/hr/timeclock/out', 'POST', { notes: 'Shift Completed' }).catch(() => {}); } catch(e) {}
    toast(` Clocked out from shift at ${timeNow}. Total shift duration: ${finalDurationStr}. Have a great day!`);
  }

  try { localStorage.setItem('ms_timeclock_state', JSON.stringify(state)); } catch {}
  startShiftClockTimer();
  if (typeof renderPeopleCompliance === 'function') {
    try { renderPeopleCompliance(); } catch (e) {}
  }
}
window.handleTimeClockAction = handleTimeClockAction;

function renderTimeClockWidget() {
  const clockState = getTimeClockState();
  const isClockedIn = clockState.status === 'in';
  const isOnBreak = clockState.status === 'break';
  const isClockedOut = clockState.status === 'out';

  const now = Date.now();
  const startTime = clockState.startTime || now;
  const breakTotalMs = clockState.breakTotalMs || 0;
  let elapsedMs = 0;
  if (isClockedIn) {
    elapsedMs = Math.max(0, now - startTime - breakTotalMs);
  } else if (isOnBreak) {
    elapsedMs = Math.max(0, (clockState.breakStartTime || now) - startTime - breakTotalMs);
  }

  return `
    <div class="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 border border-slate-800 rounded-2xl p-5 shadow-lg text-white space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl ${isClockedIn ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : isOnBreak ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'} flex items-center justify-center font-black text-lg">
            ⏱
          </div>
          <div>
            <div class="text-xs font-bold text-slate-400 uppercase tracking-wider">Employee Time Clock &amp; Live Shift Tracker</div>
            <div class="text-sm font-black flex items-center gap-2">
              <span>Status:</span>
              <span class="${isClockedIn ? 'text-emerald-400' : isOnBreak ? 'text-amber-400' : 'text-slate-400'}">${isClockedIn ? ` Clocked In (${clockState.time || 'Today'})` : isOnBreak ? ` On Lunch / Break` : ` Clocked Out`}</span>
            </div>
          </div>
        </div>

        <div class="text-right hidden sm:block">
          <div class="text-xs text-slate-400">Live Shift Duration</div>
          <div class="text-base font-mono font-black text-emerald-400" id="workstation-live-timer">${isClockedOut ? '00:00:00' : formatDurationHMS(elapsedMs)}</div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800">
        <button onclick="handleTimeClockAction('in')" class="flex-1 min-w-[120px] py-2.5 rounded-xl font-black text-xs transition ${isClockedIn ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30'}">
           Clock In Shift
        </button>
        <button onclick="handleTimeClockAction('break')" class="flex-1 min-w-[120px] py-2.5 rounded-xl font-black text-xs transition ${isOnBreak ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-800 hover:bg-slate-700 text-amber-300'}">
           ${isOnBreak ? 'End Break' : 'Start Break'}
        </button>
        <button onclick="handleTimeClockAction('out')" class="flex-1 min-w-[120px] py-2.5 rounded-xl font-black text-xs transition ${isClockedOut ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30'}">
           Clock Out Shift
        </button>
      </div>
    </div>
  `;
}

// ── 1. Overview Tab ──────────────────────────────────────────────────────────
function renderPeopleOverview(body, employees) {
  const activeCount = employees.filter(e => e.status === 'Active').length;
  const expiringLicences = employees.filter(e => e.licence_status && e.licence_status.includes('Expiring')).length;

  body.innerHTML = `
    <div class="space-y-6">
      <!-- Time Clock Banner -->
      ${renderTimeClockWidget()}

      <!-- Top Metrics -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div class="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1"> Active Staff</div>
          <div class="text-2xl font-black text-slate-900 dark:text-white">${activeCount} <span class="text-xs font-semibold text-slate-400">/ 48 total</span></div>
          <div class="text-[11px] text-emerald-500 font-bold mt-1">100% Onboarded</div>
        </div>

        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div class="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1"> Expiring Licences</div>
          <div class="text-2xl font-black text-amber-500">${expiringLicences}</div>
          <div class="text-[11px] text-slate-400 mt-1">Due within 30 days</div>
        </div>

        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div class="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1"> Training Deadlines</div>
          <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400">4</div>
          <div class="text-[11px] text-slate-400 mt-1">WHMIS &amp; Safety Certs</div>
        </div>

        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div class="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1"> Safety Hazards</div>
          <div class="text-2xl font-black text-rose-500">1</div>
          <div class="text-[11px] text-slate-400 mt-1">Open shop log</div>
        </div>

        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div class="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1"> Compliance Score</div>
          <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400">96.4%</div>
          <div class="text-[11px] text-slate-400 mt-1">Audit status optimal</div>
        </div>
      </div>

      <!-- Department Staffing & Readiness -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 class="text-base font-black text-slate-900 dark:text-white flex items-center justify-between">
          <span> Department Staffing &amp; Operational Readiness</span>
          <span class="text-xs font-bold text-slate-400">Store Rooftop #1</span>
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-3.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <div class="flex justify-between text-xs font-bold">
              <span>Sales Department</span>
              <span class="text-emerald-600">12 / 12 (100%)</span>
            </div>
            <div class="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full bg-emerald-500 rounded-full" style="width:100%"></div>
            </div>
          </div>

          <div class="p-3.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <div class="flex justify-between text-xs font-bold">
              <span>F&amp;I Office</span>
              <span class="text-emerald-600">4 / 4 (100%)</span>
            </div>
            <div class="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full bg-emerald-500 rounded-full" style="width:100%"></div>
            </div>
          </div>

          <div class="p-3.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <div class="flex justify-between text-xs font-bold">
              <span>Service &amp; Shop Bays</span>
              <span class="text-amber-500">18 / 20 (90%)</span>
            </div>
            <div class="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full bg-amber-500 rounded-full" style="width:90%"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Live Activity Log -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <h3 class="text-base font-black text-slate-900 dark:text-white"> Recent HR &amp; Compliance Activity Log</h3>
        <div class="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
          <div class="py-2.5 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span class="font-bold text-slate-800 dark:text-slate-200">Marcus Vance</span>
              <span class="text-slate-400">signed 2026 Workplace Harassment &amp; Safety Policy</span>
            </div>
            <span class="text-[11px] text-slate-400">2 hours ago</span>
          </div>
          <div class="py-2.5 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-amber-500"></span>
              <span class="font-bold text-slate-800 dark:text-slate-200">Jessica Taylor</span>
              <span class="text-slate-400">Driver Licence renewal reminder sent (OMVIC-391024-ON)</span>
            </div>
            <span class="text-[11px] text-slate-400">Yesterday</span>
          </div>
          <div class="py-2.5 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
              <span class="font-bold text-slate-800 dark:text-slate-200">David Chen</span>
              <span class="text-slate-400">completed EV High-Voltage Disconnect Safety module</span>
            </div>
            <span class="text-[11px] text-slate-400">3 days ago</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── 2. People & Profiles Tab ──────────────────────────────────────────────────
function renderPeopleDirectory(body, employees) {
  const cardsHtml = employees.map(e => `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:border-indigo-500 dark:hover:border-indigo-500 transition space-y-4 flex flex-col justify-between">
      <div>
        <div class="flex items-center justify-between gap-2 mb-3">
          <span class="px-2.5 py-0.5 text-[10px] font-black uppercase rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800">${esc(e.department)}</span>
          <span class="px-2.5 py-0.5 text-[10px] font-black uppercase rounded-full ${e.licence_status === 'Valid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">${esc(e.licence_status)}</span>
        </div>

        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-black text-base flex items-center justify-center shadow-md">${e.first_name[0]}${e.last_name[0]}</div>
          <div>
            <h3 class="text-base font-black text-slate-900 dark:text-white leading-tight">${esc(e.first_name)} ${esc(e.last_name)}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">${esc(e.role)}</p>
          </div>
        </div>

        <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
          <div class="flex items-center justify-between"><span> Location:</span><span class="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[160px]">${esc(e.location)}</span></div>
          <div class="flex items-center justify-between"><span> Comp Plan:</span><span class="font-bold text-indigo-600 dark:text-indigo-400 truncate max-w-[160px]">${esc(e.comp_plan)}</span></div>
          <div class="flex items-center justify-between"><span> MTD Performance:</span><span class="font-black text-emerald-600">${e.perf.units_mtd ? `${e.perf.units_mtd} units` : (e.perf.efficiency_pct ? `${e.perf.efficiency_pct}% eff` : `$${e.perf.PVR_mtd} PVR`)}</span></div>
        </div>
      </div>

      <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <button onclick="openEmployeeProfileModal('${e.id}')" class="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-md transition flex items-center justify-center gap-1"> Profile</button>
        <button onclick="openEditEmployeeModal('${e.id}')" class="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition"> Edit</button>
        <button onclick="openEmployeeCertificateModal('${esc(e.first_name)} ${esc(e.last_name)}', 'WHMIS 2015 &amp; Chemical Safety', '${e.start_date}', 'CERT-ON-9402')" class="py-2 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold text-xs border border-amber-200/60 transition"> Certs</button>
      </div>
    </div>
  `).join('');

  body.innerHTML = `
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <input type="text" placeholder="Search employees by name, role, or VIN..." class="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 w-64">
          <select class="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200">
            <option value="all">All Departments</option>
            <option value="Sales">Sales</option>
            <option value="F&I">F&amp;I</option>
            <option value="Service">Service</option>
            <option value="Management">Management</option>
          </select>
        </div>
        <span class="text-xs font-bold text-slate-400">${employees.length} Staff Profiles Connected</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${cardsHtml}
      </div>
    </div>
  `;
}