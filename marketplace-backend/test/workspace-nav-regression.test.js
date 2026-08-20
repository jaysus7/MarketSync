import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PLAN_CATALOG,
  FEATURES_BY_PRODUCT,
  featuresForPlan,
  productsForPlan,
  getPlan
} from '../plan-catalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workspaceRegistryPath = path.join(__dirname, '../../marketplace-frontend/js/modules/workspace-registry.js');
const dashboardPart2Path = path.join(__dirname, '../../marketplace-frontend/js/modules/dashboard-part2.js');
const dashboardPart17Path = path.join(__dirname, '../../marketplace-frontend/js/modules/dashboard-part17.js');
const marketingWorkspacePath = path.join(__dirname, '../../marketplace-frontend/js/modules/marketing-workspace.js');
const marketingStudioRoutePath = path.join(__dirname, '../routes/marketing-studio.js');
const demoControlRoutePath = path.join(__dirname, '../routes/demo-control.js');
const cssPath = path.join(__dirname, '../../marketplace-frontend/css/marketsync-theme.css');

const registryCode = fs.readFileSync(workspaceRegistryPath, 'utf8');
const dashboardPart2Code = fs.readFileSync(dashboardPart2Path, 'utf8');
const dashboardPart17Code = fs.readFileSync(dashboardPart17Path, 'utf8');
const marketingWorkspaceCode = fs.readFileSync(marketingWorkspacePath, 'utf8');
const marketingStudioRouteCode = fs.readFileSync(marketingStudioRoutePath, 'utf8');
const demoControlRouteCode = fs.readFileSync(demoControlRoutePath, 'utf8');
const cssContent = fs.readFileSync(cssPath, 'utf8');

test('1. Standalone Social Scheduler Plan is active in PLAN_CATALOG with correct features & price', () => {
  const plan = PLAN_CATALOG['social-scheduler'];
  assert.ok(plan, 'social-scheduler exists in PLAN_CATALOG');
  assert.equal(plan.product_primary, 'marketsync_social');
  assert.equal(plan.monthly, 99, 'Monthly price must be 99 CAD/mo (9900 cents)');

  // Verify features
  const socialFeatures = featuresForPlan('social-scheduler');
  assert.ok(socialFeatures.includes('social.scheduler'));
  assert.ok(socialFeatures.includes('social.accounts'));
  assert.ok(socialFeatures.includes('social.calendar'));
  assert.equal(socialFeatures.includes('design.templates'), false);
  assert.equal(socialFeatures.includes('design.canvas'), false);

  // Standalone Design Studio has only design features
  const designPlan = PLAN_CATALOG['design-studio'];
  assert.ok(designPlan, 'design-studio exists in PLAN_CATALOG');
  assert.equal(designPlan.product_primary, 'design_studio');
  const designFeatures = featuresForPlan('design-studio');
  assert.ok(designFeatures.includes('design.templates'));
  assert.ok(designFeatures.includes('design.canvas'));
  assert.equal(designFeatures.includes('social.scheduler'), false);
});

test('2. Product entitlement vs RBAC separation on media uploads', () => {
  // Routes must require marketing.edit AND product access (design.assets OR social.scheduler)
  assert.ok(marketingStudioRouteCode.includes("requirePermission('marketing.edit')"), 'Requires marketing.edit RBAC');
  assert.ok(marketingStudioRouteCode.includes("hasFeature(ctx, 'design.assets')"), 'Requires design.assets');
  assert.ok(marketingStudioRouteCode.includes("hasFeature(ctx, 'social.scheduler')"), 'Requires social.scheduler');
  assert.ok(marketingStudioRouteCode.includes("is_platform_staff"), 'Allows platform staff');
});

test('3. Marketing suites include both Design Studio and Social Scheduler capabilities', () => {
  const suites = ['sales-marketing-suite', 'service-marketing-suite', 'complete-marketing-suite', 'marketsync-digital'];
  suites.forEach(s => {
    const feat = featuresForPlan(s);
    assert.ok(feat.includes('design.templates'), `${s} grants design.templates`);
    assert.ok(feat.includes('design.assets'), `${s} grants design.assets`);
    assert.ok(feat.includes('social.scheduler'), `${s} grants social.scheduler`);
    assert.ok(feat.includes('social.calendar'), `${s} grants social.calendar`);
  });

  // Marketing workspace navigation surfaces Social Scheduler & Video Studio
  assert.ok(marketingWorkspaceCode.includes("page: 'social-scheduler'"), 'Marketing suite config contains social-scheduler');
  assert.ok(marketingWorkspaceCode.includes("page: 'video-studio'"), 'Marketing suite config contains video-studio');
});

test('4. Dedicated demo package replacement flow defaults role to dealer_admin on DealerOS tiers', () => {
  assert.ok(demoControlRouteCode.includes('replaceDemoDealershipPackage'), 'replaceDemoDealershipPackage exists');
  assert.ok(demoControlRouteCode.includes("roleKey = 'dealer_admin'"), 'Defaults roleKey to dealer_admin on DealerOS tiers');
  assert.ok(demoControlRouteCode.includes("preserveExisting: false"), 'Clears previous demo subscriptions on replacement');
  assert.ok(demoControlRouteCode.includes("social-scheduler"), 'DEMO_PACKAGES includes social-scheduler');
});

test('5. DealerOS navigation distinguishes manager from restricted roles', () => {
  // Check workspace registry and role handling
  assert.ok(registryCode.includes('MS_WORKSPACES'), 'MS_WORKSPACES is exported');
  assert.ok(registryCode.includes('mgr: true'), 'Workspace registry supports manager-only gating');
  assert.ok(dashboardPart2Code.includes('deptNavEligible') || dashboardPart2Code.includes('mgr'), 'Evaluates manager eligibility for department navigation');
});

test('6. Website builder mode toggles .website-builder-mode without hiding standard website workspace', () => {
  assert.ok(dashboardPart17Code.includes('function openWebsiteBuilder()'), 'Canonical openWebsiteBuilder is defined');
  assert.ok(dashboardPart17Code.includes('function closeWebsiteBuilder()'), 'Canonical closeWebsiteBuilder is defined');
  assert.ok(dashboardPart17Code.includes('function exitWebsiteWorkspace()'), 'exitWebsiteWorkspace is defined');
  assert.ok(dashboardPart17Code.includes("classList.toggle('website-builder-mode', isBuilder)"), 'Toggles website-builder-mode on builder entry/exit');
  assert.ok(cssContent.includes('html.website-builder-mode'), 'CSS hides shell only in website-builder-mode');
});

test('7. First-class Social Scheduler page with direct uploads and Design Studio handoff', () => {
  const schedulerFrontendPath = path.join(__dirname, '../../marketplace-frontend/js/modules/studio/studio-scheduler.js');
  const schedulerFrontendCode = fs.readFileSync(schedulerFrontendPath, 'utf8');

  assert.ok(schedulerFrontendCode.includes('function loadSocialSchedulerPage()'), 'loadSocialSchedulerPage is defined');
  assert.ok(schedulerFrontendCode.includes('function studioSchedulerUploadMedia(input)'), 'studioSchedulerUploadMedia is defined for direct uploads');
  assert.ok(schedulerFrontendCode.includes('+ Upload from Canva / Adobe / Phone'), 'Includes Canva/Adobe upload trigger');
});
