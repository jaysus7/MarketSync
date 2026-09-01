import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Email & SMS — Split Full-Screen Builders Architecture', () => {
  const part18Path = path.join(__dirname, '../../marketplace-frontend/js/modules/dashboard-part18.js');
  const part18Content = fs.readFileSync(part18Path, 'utf8');

  it('preserves the 6 internal dashboard tabs in Email & SMS', () => {
    assert.ok(part18Content.includes("tabBtn('overview', 'Overview'"), 'Includes Overview tab');
    assert.ok(part18Content.includes("tabBtn('automations', 'Automations'"), 'Includes Automations tab');
    assert.ok(part18Content.includes("tabBtn('campaigns', 'Campaigns'"), 'Includes Campaigns tab');
    assert.ok(part18Content.includes("tabBtn('templates', 'Templates'"), 'Includes Templates tab');
    assert.ok(part18Content.includes("tabBtn('audiences', 'Audiences'"), 'Includes Audiences tab');
    assert.ok(part18Content.includes("tabBtn('performance', 'Performance'"), 'Includes Performance tab');
  });

  // Both buttons still sit in the page header; the email one was relabelled
  // "Create Email" and now opens the builder as a new template that returns to the
  // Templates tab, which is a fuller call than the bare `{ mode: 'email' }` this
  // once pinned. Assert the two actions and where they go, not the wording.
  it('exposes the two top primary builder action buttons in the page header', () => {
    const header = part18Content.slice(
      part18Content.indexOf('Email &amp; SMS Communication Engine'),
      part18Content.indexOf('Core Navigation Launch Cards'));
    assert.ok(header, 'the Email & SMS header block must exist');
    assert.ok(header.includes('onclick="openVisualWorkflowBuilder()"'), 'Contains the automation builder button');
    assert.ok(header.includes('Build Automation'), 'Label Build Automation present');
    assert.match(header, /onclick="openEmailSmsBuilder\(\{ mode: 'email'[^"]*\}\)"/,
      'Contains a button that opens the Email/SMS builder in email mode');
    assert.ok(header.includes('Create Email'), 'the email builder button must be labelled');
  });

  it('implements openVisualWorkflowBuilder for n8n-style DAG logic and journeys', () => {
    assert.ok(part18Content.includes('function openVisualWorkflowBuilder('), 'openVisualWorkflowBuilder function exists');
    assert.ok(part18Content.includes('window.openVisualWorkflowBuilder = openVisualWorkflowBuilder'), 'openVisualWorkflowBuilder exported to window');
    assert.ok(part18Content.includes('VISUAL_NODE_LIBRARY'), 'Node library exists with triggers, actions, logic');
  });

  it('implements openEmailSmsBuilder with Email Designer, SMS Simulator, and Sequence planner', () => {
    assert.ok(part18Content.includes('function openEmailSmsBuilder('), 'openEmailSmsBuilder function exists');
    assert.ok(part18Content.includes('window.openEmailSmsBuilder = openEmailSmsBuilder'), 'openEmailSmsBuilder exported to window');
    assert.ok(part18Content.includes('switchEsbMode'), 'Supports mode switching');
    assert.ok(part18Content.includes('renderEsbEmailStudio'), 'Implements Email Designer');
    assert.ok(part18Content.includes('renderEsbSmsStudio'), 'Implements SMS Simulator');
    assert.ok(part18Content.includes('renderEsbSequenceStudio'), 'Implements Sequence planner');
  });

  it('provides rich automotive blocks for the Email visual canvas', () => {
    assert.ok(part18Content.includes('vehicle_card:'), 'Contains Vehicle Showcase Card');
    assert.ok(part18Content.includes('inventory_grid:'), 'Contains Inventory Grid');
    assert.ok(part18Content.includes('service_offer:'), 'Contains Service Coupon');
    assert.ok(part18Content.includes('trade_cta:'), 'Contains Trade-In Equity Banner');
    assert.ok(part18Content.includes('finance_cta:'), 'Contains Finance Pre-Qualify CTA');
    assert.ok(part18Content.includes('rep_card:'), 'Contains Sales Rep VIP Card');
    assert.ok(part18Content.includes('review_request:'), 'Contains Google Review Request');
    assert.ok(part18Content.includes('video_message:'), 'Contains Video Walkaround Card');
  });

  it('provides live GSM-7/UCS-2 segment and cost calculation for SMS simulator', () => {
    assert.ok(part18Content.includes('function calcSmsSegments('), 'calcSmsSegments function exists');
    assert.ok(part18Content.includes('applySmsAiTone'), 'AI tone rewriter exists');
    assert.ok(part18Content.includes('includeOptOut'), 'Opt-out compliance toggle exists');
  });

  it('supports Simple Mode cards with on/off and Quick Edit, and Advanced Mode visual builder', () => {
    assert.ok(part18Content.includes('Simple Mode'), 'Contains Simple Mode selector/button');
    assert.ok(part18Content.includes('Advanced Mode'), 'Contains Advanced Mode selector/button');
    assert.ok(part18Content.includes('openQuickEditAutoModal'), 'Provides Quick Edit modal for Simple Mode');
    assert.ok(part18Content.includes('saveQuickEditAutoModal'), 'Provides save handler for Quick Edit modal');
    assert.ok(part18Content.includes('Edit in Advanced Builder'), 'Contains Edit in Advanced Builder button');
  });

  it('exposes comprehensive node library across CRM, Website, Inventory, Service, Marketing, AI, and Integrations', () => {
    assert.ok(part18Content.includes('trigger_crm_new_lead'), 'Contains New Lead trigger');
    assert.ok(part18Content.includes('trigger_web_credit_app'), 'Contains Credit App trigger');
    assert.ok(part18Content.includes('trigger_inv_price_changed'), 'Contains Price Changed trigger');
    assert.ok(part18Content.includes('trigger_svc_maintenance_due'), 'Contains Maintenance Due trigger');
    assert.ok(part18Content.includes('trigger_mkt_email_opened'), 'Contains Email Opened trigger');
    assert.ok(part18Content.includes('trigger_ai_human_requested'), 'Contains AI Human Requested trigger');
    assert.ok(part18Content.includes('action_send_sms'), 'Contains Send SMS action');
    assert.ok(part18Content.includes('action_assign_rep'), 'Contains Assign Rep action');
    assert.ok(part18Content.includes('action_send_webhook'), 'Contains Webhook action');
    assert.ok(part18Content.includes('logic_if_else'), 'Contains If/Else condition node');
    assert.ok(part18Content.includes('logic_wait'), 'Contains Wait delay node');
    assert.ok(part18Content.includes('logic_stop'), 'Contains Stop terminal node');
  });

  it('synchronizes canonical workflow data between Simple Mode edits and visual graph nodes', () => {
    assert.ok(part18Content.includes('found.graph.nodes.forEach'), 'Syncs graph nodes on simple edit');
    assert.ok(part18Content.includes('saveVisualWorkflow'), 'Saves and compiles graph back to canonical catalog');
  });
});

