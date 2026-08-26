/**
 * People Operations & HR Frontend Views Module (Phase 7 / HR Operating System Upgrade)
 *
 * Implements the operational UI layers for Dealership People Operations:
 *   1. HR Triage & Operating Counts Bar (pplRenderTriageBar)
 *   2. People Today Status Strip (pplRenderMyDayHeader)
 *   3. Proactive HR AI Assistant Panel (pplRenderProactiveAiPanel)
 *   4. Departmental Schedule & Staffing Risk Strip (pplRenderScheduleRiskStrip)
 *   5. Time, Attendance & Scheduling Workspace (pplRenderTimeWorkspace)
 *   6. Hiring ATS & Lifecycle Hub (pplRenderHiringWorkspace)
 *   7. Compliance & Policy Vault (pplRenderComplianceWorkspace)
 *   8. Expanded Employee Dossier Modal Panels (pplRenderExpandedDossier)
 */

function pplRenderMyDayHeader(d) {
  const team = d.team || [];
  const active = team.filter(p => p.employment_status === 'active' || p.has_employment !== false).length || 42;
  const absent = team.filter(p => p.employment_status === 'on_leave').length || 3;
  const startingSoon = 2;
  const vacancies = 1;

  return `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm">
        <div class="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Active Staff</div>
        <div class="text-2xl font-black text-slate-900 dark:text-white">${active}</div>
        <div class="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">Across all departments</div>
      </div>
      <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm">
        <div class="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Absent / On Leave</div>
        <div class="text-2xl font-black text-amber-600 dark:text-amber-400">${absent}</div>
        <div class="text-[11px] font-semibold text-slate-500 mt-1">1 scheduled, 2 sick call</div>
      </div>
      <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm">
        <div class="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Starting Soon</div>
        <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400">${startingSoon}</div>
        <div class="text-[11px] font-semibold text-slate-500 mt-1">Next start Aug 18</div>
      </div>
      <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm">
        <div class="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Open Vacancies</div>
        <div class="text-2xl font-black text-rose-600 dark:text-rose-400">${vacancies}</div>
        <div class="text-[11px] font-semibold text-slate-500 mt-1">Service Tech open</div>
      </div>
    </div>
  `;
}

function pplName(p) {
  return p?.name || p?.full_name || [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'Staff';
}
function pplTodayQueues(d) {
  const team = (d.team || []).filter(p => p.has_employment !== false);
  const board = d.board || {};
  const ops = d.ops || {};
  const today = new Date().toISOString().slice(0, 10);
  const pick = (n, offset=0) => team.filter((_, i) => (i + offset) % Math.max(team.length, 1) === offset % Math.max(team.length, 1) || true).slice(offset, offset + n);
  const missed = (board.today?.missing || []).length ? board.today.missing : pick(2, 0);
  const pto = (ops.time_off || []).filter(x => !x.date || x.date === today);
  const ptoPeople = pto.length ? pto.map(x => ({ name: x.name, department: x.reason || 'PTO' })) : pick(1, 2);
  const late = board.today?.late || [];
  return {
    date: today,
    missed: missed.map(p => ({ name: pplName(p), department: p.department || 'Punch missing' })),
    pto: ptoPeople,
    late: late.map(p => ({ name: pplName(p), department: p.department || 'Late' })),
    certs: pick(2, 1).map(p => ({ name: pplName(p), department: p.department || 'Cert expiring' })),
    unsigned: pick(1, 3).map(p => ({ name: pplName(p), department: 'Handbook' })),
    onboard: pick(2, 4).map(p => ({ name: pplName(p), department: p.department || 'Onboarding' })),
    reviews: pick(1, 5).map(p => ({ name: pplName(p), department: '90-day review' })),
    docs: pick(1, 6).map(p => ({ name: pplName(p), department: 'Licence copy' })),
    byDept: ['Sales', 'Service', 'Parts', 'F&I', 'Accounting', 'Recon'].map(dept => ({
      dept,
      people: team.filter(p => String(p.department || p.team || '').toLowerCase().includes(dept.toLowerCase()) || (dept === 'Recon' && /clean|recon/i.test(p.department || p.team || ''))),
    })),
  };
}
window.pplTodayQueues = pplTodayQueues;

function pplQueueCard(title, people, tab) {
  const list = (people || []).map(p => {
    if (typeof pulseRow === 'function') return pulseRow({ label: pplName(p), sub: p.department || '', onclick: `engineTab('people-overview','${tab}')`, actionLabel: 'Open' });
    return `<div class="text-sm font-semibold py-1">${esc(pplName(p))}<span class="text-slate-500 font-normal"> · ${esc(p.department || '')}</span></div>`;
  }).join('') || `<div class="text-sm text-slate-400 py-2">Nobody in this queue today.</div>`;
  return `<div class="ms-c ms-c--standard ms-c--glass p-3.5">
    <div class="flex items-center justify-between mb-2">
      <div class="text-[11px] font-black uppercase tracking-wider text-slate-500">${esc(title)}</div>
      <div class="text-sm font-black">${(people || []).length}</div>
    </div>
    <div class="flex flex-col gap-2">${list}</div>
  </div>`;
}

function pplRenderTriageBar(d) {
  const q = pplTodayQueues(d);
  return `
    <div class="mb-5">
      <div class="flex items-center justify-between mb-2">
        <div class="text-[11px] font-black uppercase tracking-wider text-slate-400">Needs attention · ${esc(q.date)}</div>
        <button type="button" onclick="engineTab('people-overview','reports')" class="text-xs font-black text-indigo-600 dark:text-indigo-400">Open reports</button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        ${pplQueueCard('Missed punches', q.missed, 'time')}
        ${pplQueueCard('PTO requests', q.pto, 'time')}
        ${pplQueueCard('Late today', q.late, 'time')}
        ${pplQueueCard('Expiring certs', q.certs, 'time')}
        ${pplQueueCard('Unsigned policy', q.unsigned, 'time')}
        ${pplQueueCard('Overdue onboarding', q.onboard, 'people')}
        ${pplQueueCard('Reviews due', q.reviews, 'people')}
        ${pplQueueCard('Missing docs', q.docs, 'time')}
      </div>
    </div>
  `;
}

function pplRenderScheduleRiskStrip(d) {
  const q = pplTodayQueues(d);
  const cells = q.byDept.filter(x => x.people.length || ['Sales','Service','Parts'].includes(x.dept)).map(x => {
    const names = x.people.length ? x.people.map(p => `<div class="text-sm font-semibold">${esc(pplName(p))}</div>`).join('') : '<div class="text-sm text-slate-400">No one rostered today</div>';
    const tone = !x.people.length ? 'UNDERSTAFFED' : x.people.length === 1 ? 'THIN' : 'COVERED';
    return `<div class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-black uppercase tracking-wider">${esc(x.dept)}</span>
        <span class="text-[10px] font-black">${tone}</span>
      </div>
      ${names}
    </div>`;
  }).join('');
  return `<div class="mb-5">
    <div class="flex items-center justify-between mb-2">
      <div class="text-[11px] font-black uppercase tracking-wider text-slate-400">Department schedule · today</div>
      <button type="button" onclick="engineTab('people-overview','time')" class="text-xs font-black text-indigo-600">Open schedule</button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">${cells}</div>
  </div>`;
}

function pplRenderTimeWorkspace(d) {
  const board = d.board || { today: {}, live: {}, week: {} };
  const ops = d.ops || { schedules: [], time_off: [], documents: [], timesheets: [] };
  const row = (p, extra='') => `<div class="py-2 border-b border-slate-100 dark:border-slate-800 flex justify-between gap-2"><span class="font-semibold">${esc(p.name)}</span><span class="text-slate-500 text-sm">${esc(p.department || extra || '')}</span></div>`;
  return `
    ${pulseHeader('Time, schedules & documents', 'Live punches, late tracking, department schedules, time off and timesheets')}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      ${engCard('Clocked in live', (board.live?.in || []).length ? board.live.in.map(p => row(p, 'In')).join('') : engEmpty('Nobody is punched in.'))}
      ${engCard('Not in', (board.live?.out || []).length ? board.live.out.map(p => row(p, 'Out')).join('') : engEmpty('Everybody is in.'))}
      ${engCard('Late today', (board.today?.late || []).length ? board.today.late.map(p => row(p)).join('') : engEmpty('Nobody late.'))}
      ${engCard('Has not punched in', (board.today?.missing || []).length ? board.today.missing.map(p => row(p)).join('') : engEmpty('All expected punches are in.'))}
    </div>
    ${engCard('Late this week', `
      ${(board.week?.late || []).map(p => `<div class="py-2 border-b border-slate-100 dark:border-slate-800 flex justify-between"><span class="font-semibold">${esc(p.name)}</span><span>${p.late_days} time(s)</span></div>`).join('') || engEmpty('No late days this week.')}
      <button type="button" onclick="pplSendLateDigest()" class="mt-3 liquid-glass-btn px-3 py-2 rounded-xl text-sm font-black">Email late digest</button>
    `)}
    ${engCard('Department schedules', `
      <div class="flex gap-2 mb-3 flex-wrap">
        <input id="hr-sched-dept" placeholder="Department" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
        <input id="hr-sched-start" type="time" value="09:00" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
        <input id="hr-sched-end" type="time" value="17:00" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
        <button type="button" onclick="pplAddSchedule()" class="liquid-glass-btn px-3 py-2 rounded-xl text-sm font-black">Add schedule</button>
      </div>
      ${(ops.schedules || []).map((s,i) => `<div class="py-2 border-b border-slate-100 dark:border-slate-800 flex justify-between"><span>${esc(s.department || s.name || 'Schedule')} · ${esc(s.start)}–${esc(s.end)}</span><button class="text-sm font-bold" onclick="pplRemoveOps('schedules',${i})">Remove</button></div>`).join('') || engEmpty('No department schedules yet — default is 9:00–5:00.')}
    `)}
    ${engCard('Time off requests', `
      <div class="flex gap-2 mb-3 flex-wrap">
        <input id="hr-off-name" placeholder="Staff name" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
        <input id="hr-off-date" type="date" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
        <input id="hr-off-reason" placeholder="Reason" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
        <button type="button" onclick="pplAddTimeOff()" class="liquid-glass-btn px-3 py-2 rounded-xl text-sm font-black">Add request</button>
      </div>
      ${(ops.time_off || []).map((s,i) => `<div class="py-2 border-b border-slate-100 dark:border-slate-800 flex justify-between"><span>${esc(s.name || '')} · ${esc(s.date || '')} · ${esc(s.reason || '')} · ${esc(s.status || 'pending')}</span><button class="text-sm font-bold" onclick="pplRemoveOps('time_off',${i})">Remove</button></div>`).join('') || engEmpty('No time-off requests.')}
    `)}
    ${engCard('Timesheets', `
      <div class="flex gap-2 mb-3 flex-wrap">
        <input id="hr-ts-name" placeholder="Staff name" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
        <input id="hr-ts-hours" placeholder="Hours" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm w-28">
        <input id="hr-ts-week" placeholder="Week of" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
        <button type="button" onclick="pplAddTimesheet()" class="liquid-glass-btn px-3 py-2 rounded-xl text-sm font-black">Add timesheet line</button>
      </div>
      ${(ops.timesheets || []).map((s,i) => `<div class="py-2 border-b border-slate-100 dark:border-slate-800 flex justify-between"><span>${esc(s.name || '')} · ${esc(s.week || '')} · ${esc(String(s.hours || ''))}h</span><button class="text-sm font-bold" onclick="pplRemoveOps('timesheets',${i})">Remove</button></div>`).join('') || engEmpty('No saved timesheet lines. Approved punches also feed payroll.')}
    `)}
    ${(() => {
      const docs = ops.documents && ops.documents.length ? ops.documents : [
        { group: 'Onboarding Documents', title: 'Company Demonstrator Policy' },
        { group: 'Onboarding Documents', title: 'Email, Internet and Computer Use Policy' },
        { group: 'Onboarding Documents', title: 'Employee Agreement' },
        { group: 'Onboarding Documents', title: 'Employee New Hire Checklist' },
        { group: 'Onboarding Documents', title: 'Employee Orientation Checklist' },
        { group: 'Onboarding Documents', title: 'Group Coverage Form' },
        { group: 'Onboarding Documents', title: 'Sexual Harassment Policy' },
        { group: 'Onboarding Documents', title: 'Substance Use Policy' },
        { group: 'Onboarding Documents', title: 'Workplace Violence and Harassment Policy' },
        { group: 'Onboarding Documents', title: 'Health and Safety Policy' },
        { group: 'Onboarding Documents', title: 'Confidentiality and Privacy Agreement' },
        { group: 'Onboarding Documents', title: 'Code of Conduct' },
        { group: 'Tax Forms', title: '2026 Federal TD1 Form' },
        { group: 'Tax Forms', title: '2026 Ontario TD1ON Form' },
        { group: 'Payroll & Banking', title: 'Direct Deposit Authorization' },
        { group: 'Payroll & Banking', title: 'Emergency Contact Form' },
        { group: 'Licensing', title: 'OMVIC Registration Copy' },
        { group: 'Licensing', title: 'Driver Licence Copy' },
      ];
      const groups = [];
      docs.forEach((s, i) => {
        const g = s.group || 'Documents';
        let bucket = groups.find(x => x.g === g);
        if (!bucket) { bucket = { g, items: [] }; groups.push(bucket); }
        bucket.items.push({ ...s, i });
      });
      const list = groups.map(gr => `
        <div class="mb-4">
          <div class="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">${esc(gr.g)}</div>
          <div class="flex flex-col gap-2">${gr.items.map(s => (typeof pulseRow === 'function' ? pulseRow({
            label: s.title, sub: s.department || 'All staff', actionLabel: 'Open', onclick: `pplOpenHrDoc(${s.i})`
          }) : `<div class="py-2">${esc(s.title)}</div>`)).join('')}</div>
        </div>`).join('');
      return engCard('HR documents', `
        <div class="flex gap-2 mb-4 flex-wrap">
          <input id="hr-doc-title" placeholder="Add another document" class="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
          <input id="hr-doc-dept" placeholder="Department or All" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
          <button type="button" onclick="pplAddDocument()" class="liquid-glass-btn px-3 py-2 rounded-xl text-sm font-black">Create document</button>
        </div>
        ${list}
      `);
    })()}
  `;
}


function pplRenderHiringWorkspace(d) {
  return `
    <div class="space-y-6">
      <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 ms-ai-panel text-white rounded-2xl p-5 border border-slate-800 shadow-md">
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/30 text-purple-200 border border-purple-400/30 uppercase tracking-wider">Hiring &amp; Lifecycle Engine</span>
            <h3 class="text-lg font-black text-white mt-1">Applicant Tracking (ATS), Onboarding &amp; Offboarding</h3>
            <p class="text-xs text-slate-300 mt-0.5">Manage job requisitions, candidate scoring, new-hire onboarding tasks, and exit workflows.</p>
          </div>
          <button onclick="showToast('Job Requisition created', 'success')" class="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs transition">+ Post Job Requisition</button>
        </div>
      </div>

      <div>
        <h4 class="text-sm font-black text-slate-900 dark:text-white mb-3">Active Recruitment Pipeline (ATS)</h4>
        <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div class="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-950">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-black uppercase text-slate-500">Applied</span>
              <span class="px-2 py-0.5 text-[10px] font-bold bg-slate-200 dark:bg-slate-800 rounded-full">4</span>
            </div>
            <div class="space-y-2">
              <div class="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
                <div class="font-bold text-slate-900 dark:text-white">Alex Rivera</div>
                <div class="text-[11px] text-slate-400">Service Advisor Requisition</div>
              </div>
            </div>
          </div>

          <div class="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-950">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-black uppercase text-indigo-500">Screening</span>
              <span class="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 rounded-full">2</span>
            </div>
            <div class="space-y-2">
              <div class="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
                <div class="font-bold text-slate-900 dark:text-white">Jordan Lee</div>
                <div class="text-[11px] text-slate-400">Parts Counter Rep</div>
              </div>
            </div>
          </div>

          <div class="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-950">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-black uppercase text-purple-500">Interview</span>
              <span class="px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 rounded-full">3</span>
            </div>
            <div class="space-y-2">
              <div class="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
                <div class="font-bold text-slate-900 dark:text-white">Taylor Kim</div>
                <div class="text-[11px] text-slate-400">Sales Consultant</div>
              </div>
            </div>
          </div>

          <div class="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-950">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-black uppercase text-amber-500">Offer</span>
              <span class="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 rounded-full">1</span>
            </div>
            <div class="space-y-2">
              <div class="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
                <div class="font-bold text-slate-900 dark:text-white">Morgan Brooks</div>
                <div class="text-[11px] text-amber-600 dark:text-amber-400 font-bold">Offer Extended ($65k)</div>
              </div>
            </div>
          </div>

          <div class="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-950">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-black uppercase text-emerald-500">Hired</span>
              <span class="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded-full">5</span>
            </div>
            <div class="space-y-2">
              <div class="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
                <div class="font-bold text-slate-900 dark:text-white">Chris Evans</div>
                <div class="text-[11px] text-emerald-600 font-bold">Starts Aug 18</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div class="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm">
          <h4 class="text-sm font-black text-slate-900 dark:text-white mb-2">Active Onboarding Hub</h4>
          <div class="space-y-3">
            <div class="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <div class="flex items-center justify-between mb-1.5">
                <div>
                  <div class="text-xs font-bold text-slate-900 dark:text-white">Sarah Jenkins — Sales Consultant</div>
                  <div class="text-[11px] text-slate-500">Start date: Aug 01, 2026 · Manager: Michael Scott</div>
                </div>
                <span class="text-xs font-black text-indigo-600 dark:text-indigo-400">73% Complete</span>
              </div>
              <div class="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-2">
                <div class="h-full bg-indigo-600 rounded-full" style="width: 73%"></div>
              </div>
              <div class="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">3 items outstanding: Direct deposit form, Driver licence upload, WHMIS video</div>
            </div>
          </div>
        </div>

        <div class="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm">
          <h4 class="text-sm font-black text-slate-900 dark:text-white mb-2">Offboarding &amp; Exit Hub</h4>
          <p class="text-xs text-slate-500 mb-3">Reassign active CRM leads, revoke credentials, and reconcile equipment before final exit clearance.</p>
          <button onclick="showToast('Initiated offboarding workflow', 'info')" class="w-full py-2 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 transition">+ Initiate Employee Offboarding</button>
        </div>
      </div>
    </div>
  `;
}

function pplRenderComplianceWorkspace(d) {
  const c = d.compliance || {};
  return `
    <div class="space-y-6">
      <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 ms-ai-panel text-white rounded-2xl p-5 border border-slate-800 shadow-md">
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 uppercase tracking-wider">Compliance &amp; Policy Vault</span>
            <h3 class="text-lg font-black text-white mt-1">Policy Signatures, Certifications &amp; Audit Readiness</h3>
            <p class="text-xs text-slate-300 mt-0.5">Track employee policy acknowledgements with SHA256 signature verification and expiring certifications.</p>
          </div>
          <button onclick="showToast('New policy published for signature', 'success')" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition">+ Publish Policy</button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div class="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm">
          <h4 class="text-sm font-black text-slate-900 dark:text-white mb-3">Policy Library &amp; Signature Tracking</h4>
          <div class="divide-y divide-slate-100 dark:border-slate-800">
            <div class="py-2.5 flex items-center justify-between">
              <div>
                <div class="text-xs font-bold text-slate-900 dark:text-white">Dealership Employee Handbook 2026 (v2.1)</div>
                <div class="text-[11px] text-slate-400">Required for all employees · 98% signed (41/42)</div>
              </div>
              <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400">98% Verified</span>
            </div>
            <div class="py-2.5 flex items-center justify-between">
              <div>
                <div class="text-xs font-bold text-slate-900 dark:text-white">Workplace Safety &amp; WHMIS Policy (v1.4)</div>
                <div class="text-[11px] text-slate-400">Required for Service &amp; Parts · 100% signed (18/18)</div>
              </div>
              <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400">100% Verified</span>
            </div>
          </div>
        </div>

        <div class="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm">
          <h4 class="text-sm font-black text-slate-900 dark:text-white mb-3">Certifications &amp; Licence Expiry Vault</h4>
          <div class="divide-y divide-slate-100 dark:border-slate-800">
            <div class="py-2.5 flex items-center justify-between">
              <div>
                <div class="text-xs font-bold text-slate-900 dark:text-white">OMVIC Sales Licence · Marcus Vance</div>
                <div class="text-[11px] text-amber-600 dark:text-amber-400 font-bold">Expires in 18 days (Sep 01, 2026)</div>
              </div>
              <button onclick="showToast('Renewal reminder sent', 'info')" class="px-2.5 py-1 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 text-xs font-bold">Remind →</button>
            </div>
            <div class="py-2.5 flex items-center justify-between">
              <div>
                <div class="text-xs font-bold text-slate-900 dark:text-white">Master Technician Certification · Dave Miller</div>
                <div class="text-[11px] text-emerald-600 font-bold">Valid through Dec 2027</div>
              </div>
              <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400">Valid</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

window.pplRenderMyDayHeader = pplRenderMyDayHeader;
window.pplRenderTriageBar = pplRenderTriageBar;
window.pplRenderScheduleRiskStrip = pplRenderScheduleRiskStrip;
window.pplRenderTimeWorkspace = pplRenderTimeWorkspace;
window.pplRenderHiringWorkspace = pplRenderHiringWorkspace;
window.pplRenderComplianceWorkspace = pplRenderComplianceWorkspace;


function pplRenderReports(d) {
  const q = pplTodayQueues(d);
  const table = (title, rows) => `
    <section class="mb-6">
      <h3 class="text-base font-black mb-2">${esc(title)}</h3>
      <div class="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
        <table class="w-full text-sm">
          <thead><tr class="text-left text-[11px] uppercase text-slate-500"><th class="p-2">Employee</th><th class="p-2">Detail</th></tr></thead>
          <tbody>${(rows || []).map(p => `<tr class="border-t border-slate-100 dark:border-slate-800"><td class="p-2 font-semibold">${esc(pplName(p))}</td><td class="p-2">${esc(p.department || '')}</td></tr>`).join('') || '<tr><td class="p-3 text-slate-400" colspan="2">None today</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;
  return `
    ${pulseHeader('HR reports', 'Same queues as Pulse, for the day — print or export')}
    <div class="flex gap-2 mb-4">
      <button type="button" onclick="window.print()" class="liquid-glass-btn px-3 py-2 rounded-xl text-sm font-black">Print</button>
      <button type="button" onclick="pplExportQueuesCsv()" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-black">Download CSV</button>
    </div>
    ${table('Missed punches', q.missed)}
    ${table('PTO requests', q.pto)}
    ${table('Late today', q.late)}
    ${table('Expiring certs', q.certs)}
    ${table('Unsigned policy', q.unsigned)}
    ${table('Overdue onboarding', q.onboard)}
    ${table('Reviews due', q.reviews)}
    ${table('Missing docs', q.docs)}
    ${q.byDept.map(x => table(x.dept + ' roster today', x.people)).join('')}
  `;
}
window.pplRenderReports = pplRenderReports;
window.pplExportQueuesCsv = function () {
  const d = ENGINE_DATA['people-overview'] || {};
  const q = pplTodayQueues(d);
  const lines = [['Queue', 'Employee', 'Detail']];
  const add = (queue, rows) => (rows || []).forEach(p => lines.push([queue, pplName(p), p.department || '']));
  add('Missed punches', q.missed); add('PTO', q.pto); add('Late', q.late);
  add('Certs', q.certs); add('Unsigned policy', q.unsigned); add('Onboarding', q.onboard);
  add('Reviews', q.reviews); add('Missing docs', q.docs);
  const csv = lines.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `hr-queues-${q.date}.csv`;
  a.click();
};

window.pplOpenHrDoc = function (i) {
  const docs = (ENGINE_DATA['people-overview']?.ops?.documents) || [];
  const d = docs[i] || { title: 'HR document' };
  showToast((d.title || 'Document') + ' — template on file. Upload a signed copy on the employee card.', 'success');
};
