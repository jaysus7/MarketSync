// ── MarketSync Frontend Module: Inventory Intelligence & Appraisals ────────────

function initInventoryIntel() {
  const root = document.getElementById('inventory-intel-root');
  if (!root) return;
}
window.initInventoryIntel = initInventoryIntel;

function openAppraisalModal(vin = '') {
  const modal = document.getElementById('appraisal-modal');
  if (modal) {
    const vinInput = document.getElementById('appraisal-vin-input');
    if (vinInput) vinInput.value = vin;
    modal.classList.remove('hidden');
  }
}
window.openAppraisalModal = openAppraisalModal;

function closeAppraisalModal() {
  const modal = document.getElementById('appraisal-modal');
  if (modal) modal.classList.add('hidden');
}
window.closeAppraisalModal = closeAppraisalModal;

async function decodeVinDetails(vin) {
  if (!vin || vin.length !== 17) {
    if (typeof toast === 'function') toast('Please enter a valid 17-character VIN', 'error');
    return null;
  }
  try {
    const res = await apiGetJson(`/inventory/decode-vin?vin=${encodeURIComponent(vin)}`);
    return res;
  } catch (err) {
    if (typeof toast === 'function') toast('Failed to decode VIN: ' + err.message, 'error');
    return null;
  }
}
window.decodeVinDetails = decodeVinDetails;

function loadEquityMiningData() {
  const container = document.getElementById('equity-mining-list');
  if (!container) return;
}
window.loadEquityMiningData = loadEquityMiningData;
