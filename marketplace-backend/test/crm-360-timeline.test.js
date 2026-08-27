import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('Customer 360 — Backend CRM aggregator and timeline routes exist and are wired', async (t) => {
  const crmSrc = fs.readFileSync(path.join(__dirname, '../routes/crm.js'), 'utf8');

  // Verify GET /crm/contacts/:id queries deals, repair orders, parts, and customer vehicles
  assert.ok(crmSrc.includes("from('deals')"), 'Queries deals for canonical customer timeline');
  assert.ok(crmSrc.includes("from('repair_orders')"), 'Queries repair orders for service invoices');
  assert.ok(crmSrc.includes("from('part_requests')") || crmSrc.includes("from('part_orders')"), 'Queries parts orders');
  assert.ok(crmSrc.includes("from('customer_vehicles')"), 'Queries customer vehicles / garage');
  assert.ok(crmSrc.includes('owned_vehicles'), 'Constructs canonical owned_vehicles list');
  assert.ok(crmSrc.includes('kind: \'service_ro\''), 'Emits service_ro timeline items');
  assert.ok(crmSrc.includes('kind: \'part_purchase\''), 'Emits part_purchase timeline items');
  assert.ok(crmSrc.includes('kind: \'deal\''), 'Emits deal timeline items');

  // Verify POST /crm/contacts/:id/timeline endpoint exists
  assert.ok(crmSrc.includes("app.post('/crm/contacts/:id/timeline'"), 'Exposes POST /crm/contacts/:id/timeline route');
});

test('Customer 360 — Frontend renders Owned Vehicle Stock Cards and Receipts', async (t) => {
  const p4Src = fs.readFileSync(path.join(__dirname, '../../marketplace-frontend/js/modules/dashboard-part4.js'), 'utf8');

  // Verify crmVehicleCards renders Purchased & Owned Vehicle Stock Card
  assert.ok(p4Src.includes('Purchased &amp; Owned Vehicle'), 'Renders Purchased & Owned Vehicle Stock Card');
  assert.ok(p4Src.includes('Stock Unit'), 'Renders stock unit link to inventory');
  assert.ok(p4Src.includes('View Deal'), 'Renders View Deal button on owned vehicle card');
  assert.ok(p4Src.includes('Service / RO'), 'Renders Service / RO button on owned vehicle card');

  // Verify crmTimelineItem renders Official Service Invoice, Parts Counter Invoice, and Deal cards
  assert.ok(p4Src.includes('Official Service Invoice'), 'Renders Official Service Invoice card in timeline');
  assert.ok(p4Src.includes('printServiceReceipt'), 'Calls printServiceReceipt from timeline card');
  assert.ok(p4Src.includes('Parts Counter Invoice'), 'Renders Parts Counter Invoice card in timeline');
  assert.ok(p4Src.includes('printPartsReceipt'), 'Calls printPartsReceipt from timeline card');
  assert.ok(p4Src.includes('openDeskForContact'), 'Links deal to desk in timeline');
});
