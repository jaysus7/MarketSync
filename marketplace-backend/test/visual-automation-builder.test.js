/**
 * visual-automation-builder.test.js
 *
 * Tests for the n8n-style MarketSync Visual Automation Builder:
 * - Graph validation (dead-ends, loops, missing triggers, empty messages)
 * - Compiler (graph to canonical automated_campaigns & settings)
 * - AI workflow synthesizer (prompt to DAG)
 * - Step-by-step simulation trace runner
 * - Backend workflow API endpoints
 * - Frontend dashboard-part18 visual builder catalog & integration
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load automation router helpers
import {
  validateWorkflowGraph,
  compileGraphToCanonical,
  generateWorkflowFromPrompt,
  simulateGraphExecution
} from '../routes/automation.js';

describe('Visual Automation Builder — Graph Validation', () => {
  test('valid 90-second rapid response DAG passes validation', () => {
    const graph = {
      nodes: [
        { id: 'node_1', type: 'trigger_crm_new_lead', data: { label: 'New Lead Created' } },
        { id: 'node_2', type: 'logic_wait_delay', data: { delay_value: 90, delay_unit: 'seconds' } },
        { id: 'node_3', type: 'logic_if_condition', data: { condition_field: 'lead.human_replied', condition_operator: 'is_false' } },
        { id: 'node_4', type: 'action_comm_sms', data: { message_body: 'Hi {{customer.first_name}}, thanks for reaching out!' } },
        { id: 'node_5', type: 'logic_stop', data: { stop_reason: 'stop_on_reply' } }
      ],
      edges: [
        { id: 'e1', source: 'node_1', target: 'node_2' },
        { id: 'e2', source: 'node_2', target: 'node_3' },
        { id: 'e3', source: 'node_3', target: 'node_4', sourceHandle: 'true' },
        { id: 'e4', source: 'node_3', target: 'node_5', sourceHandle: 'false' }
      ]
    };

    const res = validateWorkflowGraph(graph);
    assert.equal(res.valid, true);
    assert.equal(res.errors.length, 0);
  });

  test('fails validation when root trigger node is missing', () => {
    const graph = {
      nodes: [
        { id: 'node_1', type: 'action_comm_sms', data: { message_body: 'Hello!' } }
      ],
      edges: []
    };

    const res = validateWorkflowGraph(graph);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some(e => e.includes('must start with at least one Trigger node')));
  });

  test('fails validation when communication node has empty message body', () => {
    const graph = {
      nodes: [
        { id: 'node_1', type: 'trigger_crm_new_lead', data: { label: 'New Lead' } },
        { id: 'node_2', type: 'action_comm_sms', data: { message_body: '   ' } }
      ],
      edges: [
        { id: 'e1', source: 'node_1', target: 'node_2' }
      ]
    };

    const res = validateWorkflowGraph(graph);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some(e => e.includes('requires a message body')));
  });

  test('detects and flags cyclic loops', () => {
    const graph = {
      nodes: [
        { id: 'node_1', type: 'trigger_crm_new_lead', data: { label: 'New Lead' } },
        { id: 'node_2', type: 'action_comm_sms', data: { message_body: 'Hello' } },
        { id: 'node_3', type: 'logic_wait_delay', data: { delay_value: 5, delay_unit: 'minutes' } }
      ],
      edges: [
        { id: 'e1', source: 'node_1', target: 'node_2' },
        { id: 'e2', source: 'node_2', target: 'node_3' },
        { id: 'e3', source: 'node_3', target: 'node_2' } // cyclic edge
      ]
    };

    const res = validateWorkflowGraph(graph);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some(e => e.includes('Infinite loop detected')));
  });
});

describe('Visual Automation Builder — Graph Compiler to Canonical Model', () => {
  test('compiles visual graph into canonical automated_campaigns row properties', () => {
    const graph = {
      nodes: [
        { id: 'node_1', type: 'trigger_crm_new_lead', data: { label: 'New Lead Created' } },
        { id: 'node_2', type: 'logic_wait_delay', data: { delay_value: 90, delay_unit: 'seconds' } },
        { id: 'node_3', type: 'action_comm_sms', data: { message_body: 'Hi {{customer.first_name}}, thanks for contacting {{dealership.name}}!', sender_identity: 'assigned_rep' } }
      ],
      edges: [
        { id: 'e1', source: 'node_1', target: 'node_2' },
        { id: 'e2', source: 'node_2', target: 'node_3' }
      ]
    };

    const compiled = compileGraphToCanonical(graph);
    assert.equal(compiled.trigger_event, 'new_lead');
    assert.equal(compiled.delay_minutes, 1.5);
    assert.equal(compiled.channel, 'sms');
    assert.equal(compiled.sender_identity, 'assigned_rep');
    assert.ok(compiled.message_body_template.includes('{{customer.first_name}}'));
  });

  test('handles hours delay compilation accurately', () => {
    const graph = {
      nodes: [
        { id: 'node_1', type: 'trigger_crm_appt_missed', data: { label: 'Missed Appt' } },
        { id: 'node_2', type: 'logic_wait_delay', data: { delay_value: 2, delay_unit: 'hours' } },
        { id: 'node_3', type: 'action_comm_email', data: { message_body: 'We missed you today!', subject_template: 'Missed Appointment at {{dealership.name}}' } }
      ],
      edges: [
        { id: 'e1', source: 'node_1', target: 'node_2' },
        { id: 'e2', source: 'node_2', target: 'node_3' }
      ]
    };

    const compiled = compileGraphToCanonical(graph);
    assert.equal(compiled.trigger_event, 'appointment_missed');
    assert.equal(compiled.delay_minutes, 120);
    assert.equal(compiled.channel, 'email');
    assert.equal(compiled.subject_template, 'Missed Appointment at {{dealership.name}}');
  });
});

describe('Visual Automation Builder — AI Workflow Synthesis', () => {
  test('synthesizes prompt into visual DAG graph with nodes and connections', () => {
    const res = generateWorkflowFromPrompt('When a new lead arrives, wait 90 seconds. If no sales rep answered, send an SMS with vehicle details and notify manager.');
    assert.ok(res.nodes && res.nodes.length >= 4);
    assert.ok(res.edges && res.edges.length >= 3);
    assert.equal(res.nodes[0].type, 'trigger_crm_new_lead');
    assert.ok(res.nodes.some(n => n.type === 'logic_wait_delay'));
    assert.ok(res.nodes.some(n => n.type === 'action_comm_sms'));
  });

  test('synthesizes review request prompt into proper service follow-up DAG', () => {
    const res = generateWorkflowFromPrompt('Send Google review request 2 hours after service repair order is completed.');
    assert.ok(res.nodes && res.nodes.length >= 3);
    assert.equal(res.nodes[0].type, 'trigger_svc_completed');
    assert.ok(res.nodes.some(n => n.type === 'action_comm_sms'));
  });
});

describe('Visual Automation Builder — Step-by-Step Simulation Trace', () => {
  test('simulates execution with variable substitution and branching', () => {
    const graph = {
      nodes: [
        { id: 'node_1', type: 'trigger_crm_new_lead', data: { label: 'New Lead Created' } },
        { id: 'node_2', type: 'logic_wait_delay', data: { delay_value: 90, delay_unit: 'seconds' } },
        { id: 'node_3', type: 'logic_if_condition', data: { condition_field: 'lead.human_replied', condition_operator: 'is_false' } },
        { id: 'node_4', type: 'action_comm_sms', data: { message_body: 'Hi {{customer.first_name}}, your {{vehicle.year}} {{vehicle.model}} is ready to view!' } }
      ],
      edges: [
        { id: 'e1', source: 'node_1', target: 'node_2' },
        { id: 'e2', source: 'node_2', target: 'node_3' },
        { id: 'e3', source: 'node_3', target: 'node_4', sourceHandle: 'true' }
      ]
    };

    const contact = {
      first_name: 'Sarah',
      last_name: 'Miller',
      phone: '555-0192',
      vehicle_year: '2024',
      vehicle_make: 'Chevrolet',
      vehicle_model: 'Silverado 1500',
      human_replied: false
    };

    const sim = simulateGraphExecution(graph, contact);
    assert.equal(sim.success, true);
    assert.ok(sim.trace.length >= 4);
    assert.equal(sim.trace[0].node_id, 'node_1');
    assert.ok(sim.trace.some(t => t.detail.includes('Sarah')));
    assert.ok(sim.trace.some(t => t.detail.includes('Silverado 1500')));
  });
});

describe('Visual Automation Builder — Frontend Module Integration', () => {
  test('dashboard-part18.js includes visual builder catalog, templates, and UI functions', () => {
    const part18 = fs.readFileSync(
      path.join(__dirname, '../../marketplace-frontend/js/modules/dashboard-part18.js'),
      'utf8'
    );

    assert.ok(part18.includes('VISUAL_NODE_LIBRARY'), 'Must define VISUAL_NODE_LIBRARY');
    assert.ok(part18.includes('VISUAL_TEMPLATES_CATALOG'), 'Must define VISUAL_TEMPLATES_CATALOG');
    assert.ok(part18.includes('openVisualWorkflowBuilder'), 'Must define openVisualWorkflowBuilder');
    assert.ok(part18.includes('renderVbGraph'), 'Must define renderVbGraph');
    assert.ok(part18.includes('openVbAiModal'), 'Must define openVbAiModal');
    assert.ok(part18.includes('openVbTestModal'), 'Must define openVbTestModal');
    assert.ok(part18.includes('openVbTemplatesModal'), 'Must define openVbTemplatesModal');
    assert.ok(part18.includes('saveVisualWorkflow'), 'Must define saveVisualWorkflow');

    // Verify 15+ automotive templates in catalog
    const catalogMatch = part18.match(/const VISUAL_TEMPLATES_CATALOG = \[([\s\S]*?)\];/);
    assert.ok(catalogMatch, 'Must define VISUAL_TEMPLATES_CATALOG array');
    const templateMatches = (catalogMatch[1].match(/key:\s*['"][a-zA-Z0-9_]+['"]/g) || []).length;
    assert.ok(templateMatches >= 15, `Expected at least 15 templates, found ${templateMatches}`);
  });
});
