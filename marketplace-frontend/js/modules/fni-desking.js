// ── MarketSync Frontend Module: F&I Deal Manager & Desking Calculator ───────────

function initFniDesking() {
  const root = document.getElementById('fni-desking-root');
  if (!root) return;
}
window.initFniDesking = initFniDesking;

function calculatePayment(salePrice, downPayment, interestRate, termMonths) {
  const principal = Math.max(0, (Number(salePrice) || 0) - (Number(downPayment) || 0));
  const ratePerMonth = ((Number(interestRate) || 0) / 100) / 12;
  const n = Number(termMonths) || 60;
  if (ratePerMonth <= 0) return principal / n;
  const monthly = (principal * ratePerMonth * Math.pow(1 + ratePerMonth, n)) / (Math.pow(1 + ratePerMonth, n) - 1);
  return Number.isFinite(monthly) ? monthly : 0;
}
window.calculatePayment = calculatePayment;

function openDeskDealModal(dealId = null) {
  const modal = document.getElementById('desk-deal-modal');
  if (modal) modal.classList.remove('hidden');
}
window.openDeskDealModal = openDeskDealModal;

function closeDeskDealModal() {
  const modal = document.getElementById('desk-deal-modal');
  if (modal) modal.classList.add('hidden');
}
window.closeDeskDealModal = closeDeskDealModal;
