import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const marketing = fs.readFileSync(path.join(root, 'marketplace-frontend/js/modules/marketing-workspace.js'), 'utf8');
const builder = fs.readFileSync(path.join(root, 'marketplace-frontend/js/modules/dashboard-part18.js'), 'utf8');

test('marketing exposes separate campaign, template, and audience destinations', () => {
  assert.match(marketing, /templates:\s*'Templates'/);
  assert.match(marketing, /base\.push\('campaigns', 'templates', 'audiences'\)/);
  assert.match(marketing, /templates\(body\)\s*\{/);
});

test('campaign entry points open Campaign Builder and audience selection is preserved', () => {
  assert.match(builder, /onclick="openCampaignBuilder\(\)"/);
  assert.match(builder, /openCampaignBuilder\(\{ name, audience: segKey/);
  assert.doesNotMatch(builder, /createAudienceCampaign[\s\S]{0,1800}openEmailSmsBuilder/);
});

test('Email Builder has template-only mode and persists reusable email content', () => {
  assert.match(builder, /__esb\.isTemplate = !!\(opts\.isNewTemplate/);
  assert.match(builder, /apiSendJson\('\/dealer\/email\/templates', 'POST'/);
  assert.match(builder, /Save Template/);
  assert.match(builder, /returnCampaign/);
  assert.match(builder, /localStorage\.setItem\('marketsync\.emailBuilderDraft'/);
});
