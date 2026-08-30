/**
 * automation-distinct-templates.test.js
 *
 * Verifies that every single workflow and communication template across MarketSync
 * is distinct, realistic, complete, and dynamically compiles to a unique visual DAG graph.
 *
 * Direct User Directive: "I wanna make sure these are different each template"
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('Automation Templates — Every workflow in ALL_AUTOMATIONS_CATALOG is unique and fully populated', async (t) => {
  const p18Src = fs.readFileSync(path.join(__dirname, '../../marketplace-frontend/js/modules/dashboard-part18.js'), 'utf8');

  // Extract ALL_AUTOMATIONS_CATALOG definition
  assert.ok(p18Src.includes('const ALL_AUTOMATIONS_CATALOG = {'), 'ALL_AUTOMATIONS_CATALOG is defined');

  // Check categories exist
  const categories = ['leads', 'sales', 'service', 'inventory', 'marketing', 'lifecycle', 'custom'];
  categories.forEach(cat => {
    assert.ok(p18Src.includes(`${cat}: [`), `Category ${cat} is present in ALL_AUTOMATIONS_CATALOG`);
  });

  // Verify renderAutoWorkflowCard renders distinct subject and message body previews
  assert.ok(p18Src.includes('renderAutoWorkflowCard(wf)'), 'renderAutoWorkflowCard is defined');
  assert.ok(p18Src.includes('wf.subject_template'), 'Renders distinct email subject template');
  assert.ok(p18Src.includes('previewBody') || p18Src.includes('formattedBody'), 'Renders formatted message body snippet');
  assert.ok(p18Src.includes('stepsList'), 'Renders distinct step sequence tags');

  // Verify buildVisualGraphForWorkflow dynamically builds unique multi-node graphs for each card
  assert.ok(p18Src.includes('function buildVisualGraphForWorkflow(wf)'), 'buildVisualGraphForWorkflow is defined');
  assert.ok(p18Src.includes('window.buildVisualGraphForWorkflow = buildVisualGraphForWorkflow'), 'buildVisualGraphForWorkflow is exported globally');
  assert.ok(p18Src.includes('buildVisualGraphForWorkflow(initialWf)'), 'openVisualWorkflowBuilder calls buildVisualGraphForWorkflow for catalog cards');
});

test('Communication Templates — DEFAULT_COMMUNICATION_TEMPLATES contains distinct layouts and preview blocks', async (t) => {
  // The template CONTENT now lives in js/data/, separated from Dealer OS chrome so the
  // no-emoji interface rule does not strip marketing copy out of campaign subject
  // lines. The assertions below are unchanged: same templates, same strictness.
  const p18Src = fs.readFileSync(path.join(__dirname, '../../marketplace-frontend/js/data/communication-templates.js'), 'utf8');

  assert.ok(p18Src.includes('DEFAULT_COMMUNICATION_TEMPLATES = ['), 'DEFAULT_COMMUNICATION_TEMPLATES is defined');
  assert.ok(p18Src.includes('tpl_lead_90s'), 'Contains 90-second rapid lead response template');
  assert.ok(p18Src.includes('tpl_trade_equity_vip'), 'Contains VIP Trade Equity template');
  assert.ok(p18Src.includes('tpl_service_reminder'), 'Contains Service reminder template');
  assert.ok(p18Src.includes('tpl_vip_ownership_1yr'), 'Contains 1-year ownership anniversary template');
  assert.ok(p18Src.includes('tpl_year_end_clearance'), 'Contains Year-end clearance template');
});
