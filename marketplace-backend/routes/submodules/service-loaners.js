// ── Service Loaner Fleet Management Submodule ─────────────────────────────────
// Manages loaner vehicles, stock number links, mileage/fuel out & in tracking.

import { getConfig, setConfig } from '../config-engine.js';
import { requireAuth, requirePermission } from '../auth.js';

const DEFAULT_LOANERS = [
  {
    id: 'lnr-101',
    stock_number: 'STK-L101',
    year: 2024,
    make: 'Ford',
    model: 'Escape SEL AWD',
    vin: '1FMCU0F90RUA12345',
    plate: 'LNR-501',
    status: 'available',
    kms: 14250,
    fuel: '100%',
    kms_out: null,
    fuel_out: null,
    customer_name: null,
    ro_id: null,
    checkout_time: null,
    notes: 'Clean condition, routine maintenance up to date.'
  },
  {
    id: 'lnr-102',
    stock_number: 'STK-L102',
    year: 2024,
    make: 'Lincoln',
    model: 'Corsair Reserve',
    vin: '5LMCJ1C90RUL67890',
    plate: 'LNR-502',
    status: 'checked_out',
    kms: 18920,
    fuel: '75%',
    kms_out: 18850,
    fuel_out: '100%',
    customer_name: 'Robert Vance',
    ro_id: 'ro-1002',
    checkout_time: '2026-08-13T09:30:00Z',
    notes: 'Checked out for multi-day transmission service.'
  },
  {
    id: 'lnr-103',
    stock_number: 'STK-L103',
    year: 2023,
    make: 'Ford',
    model: 'Edge ST-Line',
    vin: '2FMPK4J80PBA54321',
    plate: 'LNR-503',
    status: 'available',
    kms: 22100,
    fuel: '100%',
    kms_out: null,
    fuel_out: null,
    customer_name: null,
    ro_id: null,
    checkout_time: null,
    notes: 'All-wheel drive, includes child seat anchor.'
  },
  {
    id: 'lnr-104',
    stock_number: 'STK-L104',
    year: 2025,
    make: 'Ford',
    model: 'Explorer XLT',
    vin: '1FMSK8DH5RGB98765',
    plate: 'LNR-504',
    status: 'available',
    kms: 8400,
    fuel: '75%',
    kms_out: null,
    fuel_out: null,
    customer_name: null,
    ro_id: null,
    checkout_time: null,
    notes: '7 passenger seating, fleet unit.'
  }
];

export async function getLoanerFleet(dealershipId) {
  const cfg = await getConfig(dealershipId, 'service_loaners', null);
  let list = Array.isArray(cfg) ? cfg : (cfg?.value || null);
  if (!list || !list.length) {
    list = DEFAULT_LOANERS;
    await setConfig(dealershipId, 'service_loaners', list);
  }
  return list;
}

export async function saveLoanerFleet(dealershipId, loaners, req) {
  await setConfig(dealershipId, 'service_loaners', loaners, req);
  return loaners;
}

export function registerLoanerRoutes(app, { guard, canRead, canWork, canDesk }) {
  app.get('/service-engine/loaners', requireAuth, canRead, async (req, res) => {
    if (!guard(req, res)) return;
    try {
      const fleet = await getLoanerFleet(req.dealershipId);
      res.json({ loaners: fleet });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/service-engine/loaners', requireAuth, canWork, async (req, res) => {
    if (!guard(req, res)) return;
    try {
      const body = req.body || {};
      const fleet = await getLoanerFleet(req.dealershipId);
      const stockNo = String(body.stock_number || '').trim().toUpperCase();
      if (!stockNo) {
        return res.status(400).json({ error: 'Stock number is required for loaner vehicles.' });
      }

      let loaner = fleet.find(l => l.id === body.id || l.stock_number === stockNo);
      if (loaner) {
        // Update existing
        loaner.stock_number = stockNo;
        if (body.year) loaner.year = Number(body.year);
        if (body.make) loaner.make = String(body.make).trim();
        if (body.model) loaner.model = String(body.model).trim();
        if (body.vin) loaner.vin = String(body.vin).trim().toUpperCase();
        if (body.plate) loaner.plate = String(body.plate).trim().toUpperCase();
        if (body.kms != null) loaner.kms = Number(body.kms);
        if (body.fuel) loaner.fuel = String(body.fuel).trim();
        if (body.notes !== undefined) loaner.notes = String(body.notes).trim();
      } else {
        // Create new
        loaner = {
          id: 'lnr-' + Date.now().toString(36),
          stock_number: stockNo,
          year: Number(body.year) || new Date().getFullYear(),
          make: String(body.make || 'Ford').trim(),
          model: String(body.model || 'Loaner').trim(),
          vin: String(body.vin || '').trim().toUpperCase(),
          plate: String(body.plate || '').trim().toUpperCase(),
          status: 'available',
          kms: Number(body.kms) || 0,
          fuel: String(body.fuel || '100%').trim(),
          kms_out: null,
          fuel_out: null,
          customer_name: null,
          ro_id: null,
          checkout_time: null,
          notes: String(body.notes || '').trim()
        };
        fleet.unshift(loaner);
      }

      await saveLoanerFleet(req.dealershipId, fleet, req);
      res.json({ ok: true, loaner, fleet });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/service-engine/loaners/:id/checkout', requireAuth, canWork, async (req, res) => {
    if (!guard(req, res)) return;
    try {
      const { id } = req.params;
      const { kms_out, fuel_out, customer_name, ro_id, stock_number, notes } = req.body || {};
      const fleet = await getLoanerFleet(req.dealershipId);
      
      let loaner = fleet.find(l => l.id === id || l.stock_number === id || l.stock_number === stock_number);
      if (!loaner) {
        return res.status(404).json({ error: 'Loaner vehicle not found.' });
      }
      if (loaner.status === 'checked_out') {
        return res.status(400).json({ error: `Loaner ${loaner.stock_number} is already checked out to ${loaner.customer_name || 'a customer'}.` });
      }

      const parsedKms = Number(kms_out);
      loaner.status = 'checked_out';
      loaner.kms_out = Number.isFinite(parsedKms) ? parsedKms : loaner.kms;
      loaner.fuel_out = String(fuel_out || loaner.fuel || '100%').trim();
      loaner.customer_name = String(customer_name || 'Customer').trim();
      loaner.ro_id = ro_id ? String(ro_id).trim() : null;
      loaner.checkout_time = new Date().toISOString();
      if (notes) loaner.notes = String(notes).trim();

      await saveLoanerFleet(req.dealershipId, fleet, req);
      res.json({ ok: true, loaner, fleet });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/service-engine/loaners/:id/checkin', requireAuth, canWork, async (req, res) => {
    if (!guard(req, res)) return;
    try {
      const { id } = req.params;
      const { kms_in, fuel_in, notes } = req.body || {};
      const fleet = await getLoanerFleet(req.dealershipId);

      const loaner = fleet.find(l => l.id === id || l.stock_number === id);
      if (!loaner) {
        return res.status(404).json({ error: 'Loaner vehicle not found.' });
      }

      const parsedKmsIn = Number(kms_in);
      if (Number.isFinite(parsedKmsIn)) {
        loaner.kms = parsedKmsIn;
      }
      if (fuel_in) {
        loaner.fuel = String(fuel_in).trim();
      }

      loaner.status = 'available';
      loaner.kms_out = null;
      loaner.fuel_out = null;
      loaner.customer_name = null;
      loaner.ro_id = null;
      loaner.checkout_time = null;
      if (notes) loaner.notes = String(notes).trim();

      await saveLoanerFleet(req.dealershipId, fleet, req);
      res.json({ ok: true, loaner, fleet });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}
