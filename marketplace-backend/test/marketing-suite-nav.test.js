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
const dashPart10Js = fs.readFileSync(path.join(rootDir, 'marketplace-frontend', 'js', 'modules', 'dashboard-part10.js'), 'utf8');
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
    assert.match(dashPart2Js, /renderMarketingSuiteNav/, 'renders suite-specific sectioned navigation');
    assert.match(dashPart2Js, /settledWorkspace\?\.type === 'marketing_suite'[\s\S]*?deptGo\('marketing-overview', '', 'overview'\)/,
      'suite boot must land on its marketing Pulse instead of DealerOS command');
  });

  await t.test('defines MARKETING_SUITE_CONFIG for Sales, Service, Complete, and Digital', () => {
    assert.match(mktWorkspaceJs, /MARKETING_SUITE_CONFIG\s*=/, 'defines MARKETING_SUITE_CONFIG');
    assert.match(mktWorkspaceJs, /sales:\s*\{/, 'Sales Marketing Suite configuration');
    assert.match(mktWorkspaceJs, /service:\s*\{/, 'Service Marketing Suite configuration');
    assert.match(mktWorkspaceJs, /complete:\s*\{/, 'Complete Marketing Suite configuration');
    assert.match(mktWorkspaceJs, /digital:\s*\{/, 'MarketSync Digital configuration');
  });

  await t.test('provides distinct navigation structure across all 4 suites', () => {
    assert.match(mktWorkspaceJs, /sales: \{ packageId: 'sales-marketing-suite'.*marketingModes: \['sales'\]/, 'Sales exposes Sales Marketing');
    assert.match(mktWorkspaceJs, /service: \{ packageId: 'service-marketing-suite'.*marketingModes: \['service'\]/, 'Service exposes Service Marketing');
    assert.match(mktWorkspaceJs, /complete: \{ packageId: 'complete-marketing-suite'.*marketingModes: \['sales', 'service'\]/, 'Complete exposes both marketing modes');
    assert.match(mktWorkspaceJs, /digital: \{ packageId: 'marketsync-digital'.*digitalPresence: true/, 'Digital adds Digital Presence');
    assert.match(mktWorkspaceJs, /id: 'pulse', label: 'Pulse'/, 'every generated suite begins with Pulse');
    assert.match(mktWorkspaceJs, /id: 'content'.*defaultPage: 'social-scheduler'.*Design Studio.*Social Scheduler.*Video/s,
      'Content opens Scheduler while retaining Design Studio, Scheduler, Video header order');
    assert.match(dashPart2Js, /find\(item => item\.page === area\.defaultPage\)/,
      'major areas honor their configured landing product');
    assert.match(mktWorkspaceJs, /'Sales Marketing'.*tab: 'sales_overview'/,
      'Sales Marketing has a distinct route from suite Pulse');
    assert.match(mktWorkspaceJs, /'Service Marketing'.*tab: 'service_overview'/,
      'Service Marketing has a distinct route from suite Pulse');
    assert.match(mktWorkspaceJs, /if \(suite === 'service'\)[\s\S]*?Service Marketing Header[\s\S]*?Build Service Automation/,
      'Service Marketing Suite Pulse renders service-specific marketing operations');
  });

  await t.test('organizes Sales Marketing tools and featured workflows in responsive three-column grids', () => {
    assert.match(mktWorkspaceJs, /Sales Quick Action Cards[\s\S]*?grid sm:grid-cols-2 xl:grid-cols-3 gap-5/,
      'Sales tools use a responsive three-column grid');
    assert.match(dashPart18Js, /Featured Active Automations[\s\S]*?grid md:grid-cols-2 2xl:grid-cols-3 gap-4/,
      'featured automations use three columns on wide screens');
    assert.match(dashPart18Js, /col-span-2[\s\S]*?<span>Edit in Advanced Builder<\/span>/,
      'workflow cards emphasize the primary edit action');
  });
});

test('Marketing Suite — Horizontal Top Tabs & Clean Email & SMS Landing', async (t) => {
  await t.test('suppresses horizontal top tab header for marketing suites', () => {
    assert.match(mktWorkspaceJs, /hideTabBar:\s*true/, 'hideTabBar is true so top horizontal tab bar is deleted');
  });

  await t.test('removes Back to Marketing Pulse button from Email & SMS dashboard', () => {
    assert.doesNotMatch(mktWorkspaceJs, /Back to Marketing Pulse/, 'no Back to Marketing Pulse button');
  });

  await t.test('routes marketing suite pages directly in switchPage without hijacking to sales', () => {
    assert.match(dashPart2Js, /if \(!inMktSuite && !identityOnly\) pageId = 'sales';/, 'preserves CRM/Leads for marketing suite and Identity Verify');
    assert.match(dashPart2Js, /sales-campaigns|service-campaigns/, 'maps campaigns to automation-builder tabs');
    assert.match(dashPart2Js, /sales-automations|service-automations/, 'maps automations to automation-builder tabs');
  });

  await t.test('keeps the suite page header synchronized when Marketing engine tabs change', () => {
    assert.match(dashPart10Js, /engineId === 'marketing-overview'[\s\S]*?renderDeptTabbar\(engineId\)/,
      'Marketing engine state changes must re-render the shared horizontal suite header');
  });

  await t.test('Email & SMS command center renders overview with 6 tabs and KPI metrics', () => {
    assert.match(dashPart18Js, /role="tablist" aria-label="Campaigns and Automations" class="flex items-center/, 'renders the reports menu horizontally');
    assert.doesNotMatch(dashPart18Js, /class="space-y-1">\s*<div[^>]*>Workspace Nav/, 'does not render the legacy vertical workspace menu');
    assert.match(dashPart18Js, /role="tab" aria-selected=/, 'tabs expose accessible selected state');
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
