import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');

const dashJs = fs.readFileSync(path.join(rootDir, 'marketplace-frontend', 'dashboard.js'), 'utf8');
const dashPart2Js = fs.readFileSync(path.join(rootDir, 'marketplace-frontend', 'js', 'modules', 'dashboard-part2.js'), 'utf8');
const dashPart18Js = fs.readFileSync(path.join(rootDir, 'marketplace-frontend', 'js', 'modules', 'dashboard-part18.js'), 'utf8');
const mktWorkspaceJs = fs.readFileSync(path.join(rootDir, 'marketplace-frontend', 'js', 'modules', 'marketing-workspace.js'), 'utf8');
const dashHtml = fs.readFileSync(path.join(rootDir, 'marketplace-frontend', 'dashboard.html'), 'utf8');

test('Marketing Suite — Left Navigation & Workspace Context', async (t) => {
  await t.test('defines isMarketingSuite helper and registers suite products', () => {
    assert.match(dashJs, /function isMarketingSuite\(\)/, 'must define isMarketingSuite');
    assert.match(dashJs, /sales[-_]marketing[-_]suite/, 'detects sales marketing suite');
    assert.match(dashJs, /service[-_]marketing[-_]suite/, 'detects service marketing suite');
    assert.match(dashJs, /complete[-_]marketing[-_]suite/, 'detects complete marketing suite');
    assert.match(dashJs, /marketsync[-_]digital/, 'detects marketsync-digital');
  });

  await t.test('resolves marketing_suite workspace context and disables generic department nav', () => {
    assert.match(dashPart2Js, /type:\s*'marketing_suite'/, 'resolveWorkspaceContext maps marketing suites');
    assert.match(dashPart2Js, /ctx\.type === 'marketing_suite'/, 'deptNavEligible excludes marketing suites');
  });

  await t.test('provides exact required left nav for Sales Marketing Suite', () => {
    assert.match(dashJs, /isSalesMarketingSuite/, 'handles Sales Marketing Suite');
    assert.match(dashJs, /\{ page: 'marketing-overview', label: 'Pulse', icon: 'chart' \}/);
    assert.match(dashJs, /\{ page: 'automation-builder', label: 'Email & SMS', icon: 'megaphone' \}/);
    assert.match(dashJs, /\{ page: 'video-studio', label: 'Video Studio', icon: 'video' \}/);
    assert.match(dashJs, /\{ page: 'studio', label: 'Design Studio', icon: 'camera', studioLaunch: true \}/);
    assert.match(dashJs, /\{ page: 'sales-campaigns', label: 'Sales Campaigns', icon: 'megaphone' \}/);
    assert.match(dashJs, /\{ page: 'sales-automations', label: 'Sales Automations', icon: 'bolt' \}/);
    assert.match(dashJs, /\{ page: 'leads', label: 'Leads', icon: 'user' \}/);
    assert.match(dashJs, /\{ page: 'marketing-analytics', label: 'Analytics', icon: 'chart' \}/);
  });

  await t.test('provides exact required left nav for Service Marketing Suite', () => {
    assert.match(dashJs, /isServiceMarketingSuite/, 'handles Service Marketing Suite');
    assert.match(dashJs, /\{ page: 'service-campaigns', label: 'Service Campaigns', icon: 'megaphone' \}/);
    assert.match(dashJs, /\{ page: 'service-automations', label: 'Service Automations', icon: 'bolt' \}/);
    assert.match(dashJs, /\{ page: 'crm', label: 'Customers', icon: 'user' \}/);
  });

  await t.test('provides exact required left nav for Complete Marketing Suite', () => {
    assert.match(dashJs, /isCompleteMarketingSuite/, 'handles Complete Marketing Suite');
    assert.match(dashJs, /\{ page: 'crm', label: 'Leads & Customers', icon: 'user' \}/);
  });
});

test('Marketing Suite — Horizontal Top Tabs & Clean Email & SMS Landing', async (t) => {
  await t.test('suppresses horizontal top tab header for marketing suites', () => {
    assert.match(mktWorkspaceJs, /window\.isMarketingSuite/, 'tabOrder checks if in marketing suite');
    assert.match(mktWorkspaceJs, /return \['overview'\];/, 'returns overview only so tab bar is hidden');
  });

  await t.test('removes Back to Marketing Pulse button from Email & SMS dashboard', () => {
    assert.doesNotMatch(mktWorkspaceJs, /Back to Marketing Pulse/, 'no Back to Marketing Pulse button');
  });

  await t.test('routes marketing suite pages directly in switchPage without hijacking to sales', () => {
    assert.match(dashPart2Js, /if \(!inMktSuite\) pageId = 'sales';/, 'preserves CRM/Leads for marketing suite');
    assert.match(dashPart2Js, /sales-campaigns|service-campaigns/, 'maps campaigns to automation-builder tabs');
    assert.match(dashPart2Js, /sales-automations|service-automations/, 'maps automations to automation-builder tabs');
  });

  await t.test('Email & SMS command center renders overview with 6 tabs and KPI metrics', () => {
    assert.match(dashPart18Js, /tabBtn\('overview', 'Overview'/, 'renders Overview tab');
    assert.match(dashPart18Js, /tabBtn\('automations', 'Automations'/, 'renders Automations tab');
    assert.match(dashPart18Js, /tabBtn\('campaigns', 'Campaigns'/, 'renders Campaigns tab');
    assert.match(dashPart18Js, /tabBtn\('templates', 'Templates'/, 'renders Templates tab');
    assert.match(dashPart18Js, /tabBtn\('audiences', 'Audiences'/, 'renders Audiences tab');
    assert.match(dashPart18Js, /tabBtn\('performance', 'Performance'/, 'renders Performance tab');

    assert.match(dashPart18Js, /Active Automations/, 'renders Active Automations metric');
    assert.match(dashPart18Js, /Messages Sent/, 'renders Messages Sent metric');
    assert.match(dashPart18Js, /Email Delivery/, 'renders Email Delivery metric');
    assert.match(dashPart18Js, /SMS Delivery/, 'renders SMS Delivery metric');
    assert.match(dashPart18Js, /Reply Rate/, 'renders Reply Rate metric');
    assert.match(dashPart18Js, /Re-engaged/, 'renders Re-engaged metric');
    assert.match(dashPart18Js, /Appts Booked/, 'renders Appts Booked metric');
    assert.match(dashPart18Js, /Attributed Rev/, 'renders Attributed Rev metric');
  });
});

test('Marketing Suite — Two Distinct Full-Screen Builders & Shared Template Linkage', async (t) => {
  await t.test('provides distinct Automation Workflow Builder and Email/SMS Content Builder buttons', () => {
    assert.match(dashPart18Js, /<button onclick="openVisualWorkflowBuilder\(\)"[^>]*>[\s\S]*?<span>Build Automation<\/span>/, 'Build Automation button');
    assert.match(dashPart18Js, /<button onclick="openEmailSmsBuilder\(\{ mode: 'email' \}\)"[^>]*>[\s\S]*?<span>Build Email \/ SMS<\/span>/, 'Build Email / SMS button');
  });

  await t.test('Visual Automation Builder renders full-screen DAG canvas with node palette and inspector', () => {
    assert.match(dashPart18Js, /function openVisualWorkflowBuilder/, 'defines visual automation builder');
    assert.match(dashPart18Js, /renderVisualBuilderModal/, 'renders visual builder modal');
    assert.match(dashPart18Js, /vb-canvas-viewport/, 'interactive canvas viewport');
    assert.match(dashPart18Js, /vb-palette/, 'node library palette');
    assert.match(dashPart18Js, /vb-inspector/, 'node inspector');
  });

  await t.test('Email & SMS Content Builder provides visual drag-and-drop blocks and SMS simulator', () => {
    assert.match(dashPart18Js, /function openEmailSmsBuilder/, 'defines visual email/sms builder');
    assert.match(dashPart18Js, /renderEsbLayout/, 'renders visual content builder layout');
    assert.match(dashPart18Js, /Email Designer/, 'email designer mode');
    assert.match(dashPart18Js, /SMS Simulator/, 'sms simulator mode');
  });

  await t.test('links workflow communication nodes to visual content builder with return routing', () => {
    assert.match(dashPart18Js, /openEmailSmsBuilder\(\{ mode: '\$\{node\.type\.includes\('sms'\) \? 'sms' : 'email'\}', templateId: '\$\{node\.config\?\.template_id \|\| ''\}', returnToBuilder: true/, 'links workflow node to content builder');
    assert.match(dashPart18Js, /if \(__esb\.returnToBuilder\)/, 'returns cleanly to workflow builder when editing template from node');
  });

  await t.test('exiting visual builders returns to Email & SMS dashboard', () => {
    assert.match(dashPart18Js, /function closeVisualBuilder\(\) \{[\s\S]*?loadAutoBuilderPage\(\);/, 'closeVisualBuilder returns to Email & SMS');
    assert.match(dashPart18Js, /function closeEmailSmsBuilder\(\) \{[\s\S]*?loadAutoBuilderPage\(\);/, 'closeEmailSmsBuilder returns to Email & SMS');
  });
});
