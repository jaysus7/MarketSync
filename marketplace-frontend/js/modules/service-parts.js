// ── MarketSync Frontend Module: Service Repair Orders & Parts Inventory ────────

function initServiceParts() {
  const root = document.getElementById('service-parts-root');
  if (!root) return;
}
window.initServiceParts = initServiceParts;

function openNewRepairOrderModal() {
  const modal = document.getElementById('repair-order-modal');
  if (modal) modal.classList.remove('hidden');
}
window.openNewRepairOrderModal = openNewRepairOrderModal;

function closeRepairOrderModal() {
  const modal = document.getElementById('repair-order-modal');
  if (modal) modal.classList.add('hidden');
}
window.closeRepairOrderModal = closeRepairOrderModal;

function filterPartsInventory(query = '') {
  const q = String(query).toLowerCase().trim();
  const rows = document.querySelectorAll('#parts-table-body tr');
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = (!q || text.includes(q)) ? '' : 'none';
  });
}
window.filterPartsInventory = filterPartsInventory;
