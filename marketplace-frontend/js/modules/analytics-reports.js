// ── MarketSync Frontend Module: Sales Leaderboards & Market Reports ─────────────

function initAnalyticsReports() {
  const root = document.getElementById('analytics-reports-root');
  if (!root) return;
}
window.initAnalyticsReports = initAnalyticsReports;

function renderLeaderboardTable(data = []) {
  const tbody = document.getElementById('leaderboard-tbody');
  if (!tbody) return;
  if (!Array.isArray(data) || !data.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-slate-400">No leaderboard activity for this period</td></tr>';
    return;
  }
  tbody.innerHTML = data.map((item, idx) => `
    <tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
      <td class="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">#${idx + 1}</td>
      <td class="px-4 py-3 text-slate-800 dark:text-slate-200">${typeof esc === 'function' ? esc(item.name || 'Sales Rep') : (item.name || 'Sales Rep')}</td>
      <td class="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">${item.units || 0} units</td>
      <td class="px-4 py-3 text-right font-bold text-indigo-600 dark:text-indigo-400">$${(Number(item.gross) || 0).toLocaleString()}</td>
    </tr>
  `).join('');
}
window.renderLeaderboardTable = renderLeaderboardTable;
