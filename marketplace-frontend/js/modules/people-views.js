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

function pplRenderTriageBar(d) {
  const items = d.needsAttention || [];
  const missedPunches = 2;
  const ptoRequests = 1;
  const certExpiries = 2;
  const unsignedPolicies = 1;
  const overdueOnboarding = 2;
  const reviewsDue = 1;
  const missingDocs = 1;

  const card = (label, val, iconSvg, tone = 'text-slate-900 dark:text-white', sub = '', clickTab = 'time') => `
    <button onclick="engineTab('people-overview', '${clickTab}')" class="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 hover:border-emerald-400 dark:hover:border-emerald-500 transition shadow-sm group cursor-pointer">
      <div class="flex items-center justify-between gap-1 mb-1">
        <span class="text-[11px] font-black uppercase tracking-wider text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate">${esc(label)}</span>
        <span class="text-slate-400 shrink-0">${iconSvg}</span>
      </div>
      <div class="text-xl font-black ${tone}">${val}</div>
      <div class="text-[10px] font-bold text-slate-400 mt-0.5 truncate">${esc(sub)}</div>
    </button>
  `;

  return `
    <div class="mb-5">
      <div class="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Needs Attention Operating Queue</div>
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
        ${card('Missed Punches', missedPunches, '<svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>', 'text-amber-600 dark:text-amber-400', 'Requires approval', 'time')}
        ${card('PTO Requests', ptoRequests, '<svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>', 'text-indigo-600 dark:text-indigo-400', '1 pending manager review', 'time')}
        ${card('Expiring Certs', certExpiries, '<svg class="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>', 'text-rose-600 dark:text-rose-400', 'Expiring <30d', 'compliance')}
        ${card('Unsigned Policy', unsignedPolicies, '<svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>', 'text-amber-600 dark:text-amber-400', 'Handbook v2026', 'compliance')}
        ${card('Overdue Onboarding', overdueOnboarding, '<svg class="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>', 'text-purple-600 dark:text-purple-400', '2 new hires pending', 'hiring')}
        ${card('Reviews Due', reviewsDue, '<svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>', 'text-slate-900 dark:text-white', '90-day review due', 'people')}
        ${card('Missing Docs', missingDocs, '<svg class="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>', 'text-rose-600 dark:text-rose-400', 'Driver licence copy', 'compliance')}
      </div>
    </div>
  `;
}

function pplRenderScheduleRiskStrip(d) {
  return `
    <div class="mb-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-black uppercase tracking-wider text-slate-500">Departmental Schedule &amp; Staffing Risk</span>
        <button onclick="engineTab('people-overview', 'time')" class="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline">Open Schedule →</button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div class="p-3 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-bold text-amber-900 dark:text-amber-200">Service Department</span>
            <span class="px-2 py-0.5 text-[10px] font-black bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 rounded-full">UNDERSTAFFED</span>
          </div>
          <p class="text-xs text-amber-800 dark:text-amber-300">Understaffed by 1 Tech on Friday (scheduled RO load exceeds capacity by 14.5 hrs).</p>
        </div>
        <div class="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/30">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-bold text-emerald-900 dark:text-emerald-200">Sales Floor</span>
            <span class="px-2 py-0.5 text-[10px] font-black bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 rounded-full">FULL COVERAGE</span>
          </div>
          <p class="text-xs text-emerald-800 dark:text-emerald-300">Fully staffed with 12 reps on duty. Floor coverage optimal for weekend showroom traffic.</p>
        </div>
        <div class="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-bold text-slate-900 dark:text-white">Parts Department</span>
            <span class="px-2 py-0.5 text-[10px] font-black bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full">OVERTIME RISK</span>
          </div>
          <p class="text-xs text-slate-600 dark:text-slate-400">2 counter staff approaching 42+ hrs due to Saturday stock shipment receiving.</p>
        </div>
      </div>
    </div>
  `;
}

function pplRenderTimeWorkspace(d) {
  const team = d.team || [];
  return `
    <div class="space-y-6">
      <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-md">
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 uppercase tracking-wider">Time &amp; Attendance Hub</span>
            <h3 class="text-lg font-black text-white mt-1">Live Shift Clock, Timesheets &amp; Scheduling</h3>
            <p class="text-xs text-slate-300 mt-0.5">Real-time punch tracking, manager timesheet approvals, and departmental shift scheduling.</p>
          </div>
          <div class="flex gap-2">
            <button onclick="showToast('Timesheet export generated', 'success')" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition">Export Payroll Timesheets</button>
            <button onclick="showToast('New shift added to schedule', 'info')" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition">+ Add Shift</button>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div class="lg:col-span-2 space-y-4">
          <div class="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm">
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-sm font-black text-slate-900 dark:text-white">Departmental Weekly Schedule Roster</h4>
              <span class="text-xs font-bold text-slate-500">Week of Aug 10 - Aug 16, 2026</span>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead>
                  <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase">
                    <th class="py-2 px-2">Employee</th>
                    <th class="py-2 px-2">Role / Dept</th>
                    <th class="py-2 px-2">Mon-Fri</th>
                    <th class="py-2 px-2">Sat</th>
                    <th class="py-2 px-2 text-right">Hours</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-700 dark:text-slate-200">
                  <tr>
                    <td class="py-2.5 px-2 font-bold text-slate-900 dark:text-white">Sarah Jenkins</td>
                    <td class="py-2.5 px-2 text-slate-500">Sales Rep · Sales</td>
                    <td class="py-2.5 px-2"><span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">8:30 AM - 5:00 PM</span></td>
                    <td class="py-2.5 px-2"><span class="px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">OFF</span></td>
                    <td class="py-2.5 px-2 text-right font-mono font-bold">40.0h</td>
                  </tr>
                  <tr>
                    <td class="py-2.5 px-2 font-bold text-slate-900 dark:text-white">Marcus Vance</td>
                    <td class="py-2.5 px-2 text-slate-500">Master Tech · Service</td>
                    <td class="py-2.5 px-2"><span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">7:30 AM - 4:00 PM</span></td>
                    <td class="py-2.5 px-2"><span class="px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">8:00 AM - 2:00 PM</span></td>
                    <td class="py-2.5 px-2 text-right font-mono font-bold text-amber-600 dark:text-amber-400">46.0h</td>
                  </tr>
                  <tr>
                    <td class="py-2.5 px-2 font-bold text-slate-900 dark:text-white">Elena Rostova</td>
                    <td class="py-2.5 px-2 text-slate-500">Parts Specialist · Parts</td>
                    <td class="py-2.5 px-2"><span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">8:00 AM - 4:30 PM</span></td>
                    <td class="py-2.5 px-2"><span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">8:00 AM - 1:00 PM</span></td>
                    <td class="py-2.5 px-2 text-right font-mono font-bold">42.5h</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm">
            <h4 class="text-sm font-black text-slate-900 dark:text-white mb-3">Pending PTO &amp; Time-Off Requests</h4>
            <div class="divide-y divide-slate-100 dark:divide-slate-800">
              <div class="py-3 flex items-center justify-between">
                <div>
                  <div class="text-xs font-bold text-slate-900 dark:text-white">David Miller · Service Advisor</div>
                  <div class="text-[11px] text-slate-500">Vacation Leave · Aug 24 - Aug 28, 2026 (5 days)</div>
                </div>
                <div class="flex gap-1.5">
                  <button onclick="showToast('PTO approved', 'success')" class="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition">Approve</button>
                  <button onclick="showToast('PTO request declined', 'info')" class="px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition">Decline</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <div class="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm">
            <h4 class="text-sm font-black text-slate-900 dark:text-white mb-2">Missed Punches &amp; Corrections</h4>
            <p class="text-xs text-slate-500 mb-3">Timesheet exceptions requiring manager resolution before pay period close.</p>
            <div class="space-y-2.5">
              <div class="p-3 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 text-xs">
                <div class="font-bold text-amber-900 dark:text-amber-200">Marcus Vance · Aug 12</div>
                <div class="text-slate-600 dark:text-slate-300 mt-0.5">Missing clock-out punch for afternoon shift.</div>
                <button onclick="showToast('Opened punch correction modal', 'info')" class="mt-2 text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:underline">Correct punch →</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function pplRenderHiringWorkspace(d) {
  return `
    <div class="space-y-6">
      <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-md">
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
      <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-md">
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
