// ── MarketSync Department Wizards Controller ───────────────────────

let __activeOpenDeptId = 'crm';

function openDepartmentSetupWizard(deptId) {
  if (typeof DEPARTMENTS_CONFIG === 'undefined') return;
  const config = DEPARTMENTS_CONFIG[deptId || __activeOpenDeptId] || DEPARTMENTS_CONFIG['crm'];
  if (!config) return;
  __activeOpenDeptId = config.id;

  const tagEl = document.getElementById('dsw-dept-tag');
  if (tagEl) tagEl.textContent = `${config.title} · Setup Wizard`;
  const titleEl = document.getElementById('dsw-dept-title');
  if (titleEl) titleEl.textContent = `Configure ${config.title}`;

  let sharedStore = {};
  try { sharedStore = JSON.parse(localStorage.getItem('ms_shared_dealer_data') || '{}'); } catch {}

  const fieldsContainer = document.getElementById('dsw-fields-container');
  if (fieldsContainer) {
    if (config.fields && config.fields.length > 0) {
      fieldsContainer.innerHTML = (config.fields || []).map(f => {
        const val = (f.sharedKey && sharedStore[f.sharedKey]) ? sharedStore[f.sharedKey] : '';
        return `
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              ${f.label} ${f.sharedKey ? '<span class="text-[10px] text-amber-500 font-semibold">(Auto-Synced)</span>' : ''}
            </label>
            <input type="text" data-field-key="${f.key}" data-shared-key="${f.sharedKey || ''}" value="${val}" placeholder="${f.placeholder || ''}" oninput="handleSharedDataInput('${f.sharedKey || ''}', this)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white">
          </div>
        `;
      }).join('');
    } else {
      fieldsContainer.innerHTML = `
        <div class="p-4 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 text-center space-y-2">
          <div class="text-3xl">🏆</div>
          <div class="font-black text-sm text-violet-900 dark:text-violet-200">No Configuration Inputs Required</div>
          <div class="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            Use the top tabs on the Leaderboard page to switch between <b>Dealership Store View</b> (internal team rankings) and <b>Global Network View</b> (store vs store nationwide). Click <b>Done</b> below to complete overview.
          </div>
        </div>
      `;
    }
  }

  const modal = document.getElementById('dept-setup-wizard-modal');
  if (modal) modal.classList.remove('hidden');
}
window.openDepartmentSetupWizard = openDepartmentSetupWizard;

function openSetupCenter() {
  const deptId = typeof __activeOpenDeptId !== 'undefined' && __activeOpenDeptId ? __activeOpenDeptId : (typeof window.activePageId !== 'undefined' ? window.activePageId : 'crm');
  openDepartmentSetupWizard(deptId);
}
window.openSetupCenter = openSetupCenter;

function closeSetupWizardModal() {
  const modal = document.getElementById('dept-setup-wizard-modal');
  if (modal) modal.classList.add('hidden');
}
window.closeSetupWizardModal = closeSetupWizardModal;

function handleSharedDataInput(sharedKey, el) {
  if (!sharedKey || !el) return;
  syncSharedDealerData(sharedKey, el.value);
}
window.handleSharedDataInput = handleSharedDataInput;

function syncSharedDealerData(key, value) {
  if (!key) return;
  try {
    let sharedStore = JSON.parse(localStorage.getItem('ms_shared_dealer_data') || '{}');
    sharedStore[key] = value;
    localStorage.setItem('ms_shared_dealer_data', JSON.stringify(sharedStore));
    document.querySelectorAll(`input[data-shared-key="${key}"]`).forEach(inp => {
      if (inp !== document.activeElement) inp.value = value;
    });
  } catch {}
}
window.syncSharedDealerData = syncSharedDealerData;

function completeDepartmentWizard() {
  closeSetupWizardModal();
  const deptId = __activeOpenDeptId;
  if (!deptId) return;
  try { localStorage.setItem(`ms_dept_opened_${deptId}`, '1'); } catch {}
  awardDealerBadge(deptId);
  renderSetupBar();
}
window.completeDepartmentWizard = completeDepartmentWizard;

function awardDealerBadge(deptId) {
  if (typeof DEPARTMENTS_CONFIG === 'undefined') return;
  const config = DEPARTMENTS_CONFIG[deptId];
  if (!config) return;

  try {
    let badges = JSON.parse(localStorage.getItem('ms_unlocked_badges') || '[]');
    if (!badges.includes(deptId)) {
      badges.push(deptId);
      localStorage.setItem('ms_unlocked_badges', JSON.stringify(badges));
    }
  } catch {}

  const iconEl = document.getElementById('dbr-badge-icon');
  if (iconEl) iconEl.textContent = config.badgeIcon || '🛡️';
  const titleEl = document.getElementById('dbr-badge-title');
  if (titleEl) titleEl.textContent = config.badgeTitle || 'Department Specialist';
  const descEl = document.getElementById('dbr-badge-desc');
  if (descEl) descEl.textContent = config.badgeDesc || `You have completed setup for ${config.title}!`;

  const modal = document.getElementById('dealer-badge-reveal-modal');
  if (modal) modal.classList.remove('hidden');

  if (typeof window.fireConfetti === 'function') {
    window.fireConfetti();
  }
}
window.awardDealerBadge = awardDealerBadge;

function closeBadgeRevealModal() {
  const modal = document.getElementById('dealer-badge-reveal-modal');
  if (modal) modal.classList.add('hidden');
}
window.closeBadgeRevealModal = closeBadgeRevealModal;

function renderSetupBar() {
  const host = document.getElementById('setup-bar-host');
  if (!host) return;

  let badges = [];
  try { badges = JSON.parse(localStorage.getItem('ms_unlocked_badges') || '[]'); } catch {}

  const total = 42;
  const done = Math.min(badges.length, total);
  const pct = Math.round((done / total) * 100);

  host.innerHTML = `
    <button type="button" onclick="openSetupCenter()" title="Finish setting up" class="w-full text-left rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 px-3 py-2 mb-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition">
      <div class="flex items-center justify-between gap-2">
        <span class="inline-flex items-center gap-1.5 text-[12px] font-black text-indigo-700 dark:text-indigo-300">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 0012 3.75a14.98 14.98 0 00-9.75 3.5 14.98 14.98 0 006.16 12.12M15.59 14.37a6 6 0 01-3.59 1.63"/></svg>
          Department Setup
        </span>
        <span class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 shrink-0">${done}/${total}</span>
      </div>
      <div class="h-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 overflow-hidden mt-1.5">
        <div class="h-full bg-indigo-600 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
      </div>
    </button>
  `;
}
window.renderSetupBar = renderSetupBar;