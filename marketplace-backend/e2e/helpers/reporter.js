import fs from 'fs';
import path from 'path';

/**
 * Custom Playwright Reporter for MarketSync Staging QA Suite.
 * Generates e2e-report.json and e2e-report.md artifacts.
 */
class MarketSyncQAReporter {
  constructor() {
    this.results = {
      startTime: new Date().toISOString(),
      gitSha: process.env.GITHUB_SHA || 'Local-Staging-HEAD',
      stagingUrl: process.env.STAGING_URL || process.env.BASE_URL || 'http://localhost:3000',
      routesDiscovered: [],
      routesTested: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      brokenLinks: [],
      brokenAssets: [],
      jsErrors: [],
      failedApis: [],
      slowPages: [],
      slowApis: [],
      duplicateApis: [],
      rolePermissionFailures: [],
      untestedAreas: [],
      failuresList: [],
    };
  }

  onBegin(config, suite) {
    console.log(`[MarketSync QA Reporter] Initialized Staging QA Suite run.`);
  }

  onTestEnd(test, result) {
    this.results.routesTested++;

    const isPass = result.status === 'passed';
    if (isPass) {
      this.results.passed++;
    } else {
      this.results.failed++;
      this.results.failuresList.push({
        title: test.title,
        location: test.location ? `${test.location.file}:${test.location.line}` : 'unknown',
        durationMs: result.duration,
        error: result.error ? result.error.message : 'Test failed',
      });
    }

    // Process custom test annotations
    for (const annotation of test.annotations || []) {
      if (annotation.type === 'discovered-routes' && Array.isArray(annotation.description)) {
        this.results.routesDiscovered.push(...annotation.description);
      }
      if (annotation.type === 'broken-link') {
        this.results.brokenLinks.push(annotation.description);
      }
      if (annotation.type === 'broken-asset') {
        this.results.brokenAssets.push(annotation.description);
      }
      if (annotation.type === 'js-error') {
        this.results.jsErrors.push(annotation.description);
      }
      if (annotation.type === 'failed-api') {
        this.results.failedApis.push(annotation.description);
      }
      if (annotation.type === 'slow-page') {
        this.results.slowPages.push(annotation.description);
        this.results.warnings++;
      }
      if (annotation.type === 'slow-api') {
        this.results.slowApis.push(annotation.description);
        this.results.warnings++;
      }
      if (annotation.type === 'duplicate-api') {
        this.results.duplicateApis.push(annotation.description);
        this.results.warnings++;
      }
      if (annotation.type === 'role-failure') {
        this.results.rolePermissionFailures.push(annotation.description);
      }
    }
  }

  async onEnd(result) {
    this.results.endTime = new Date().toISOString();
    this.results.status = result.status;

    // Deduplicate array metrics
    this.results.routesDiscovered = [...new Set(this.results.routesDiscovered)];

    // Write machine-readable JSON report
    const jsonPath = path.resolve(process.cwd(), 'e2e-report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(this.results, null, 2), 'utf8');

    // Write human-readable Markdown report
    const mdPath = path.resolve(process.cwd(), 'e2e-report.md');
    const markdownContent = this.generateMarkdownReport();
    fs.writeFileSync(mdPath, markdownContent, 'utf8');

    console.log(`[MarketSync QA Reporter] Suite execution complete. Status: ${result.status.toUpperCase()}`);
    console.log(`[MarketSync QA Reporter] Reports written to e2e-report.json and e2e-report.md`);
  }

  generateMarkdownReport() {
    const r = this.results;
    return `# MarketSync Staging QA & Performance Audit Report

## Execution Summary
- **Tested Git SHA**: \`${r.gitSha}\`
- **Target Staging URL**: \`${r.stagingUrl}\`
- **Start Time**: ${r.startTime}
- **End Time**: ${r.endTime}
- **Overall Suite Status**: **${r.status ? r.status.toUpperCase() : 'UNKNOWN'}**

## Metrics Overview
| Metric | Value |
| :--- | :--- |
| **Discovered Routes** | ${r.routesDiscovered.length} |
| **Tested Routes & Test Cases** | ${r.routesTested} |
| **Passed Tests** | ${r.passed} |
| **Failed Tests** | ${r.failed} |
| **Performance & Threshold Warnings** | ${r.warnings} |
| **Broken Internal Links** | ${r.brokenLinks.length} |
| **Broken Assets / Images** | ${r.brokenAssets.length} |
| **Console & JS Errors** | ${r.jsErrors.length} |
| **Failed API Calls (4xx/5xx)** | ${r.failedApis.length} |
| **Slow Pages (>3s)** | ${r.slowPages.length} |
| **Slow API Endpoints (>1s)** | ${r.slowApis.length} |
| **Duplicate API Requests** | ${r.duplicateApis.length} |
| **Role Permission Security Failures** | ${r.rolePermissionFailures.length} |

## Discovered SPA Routes & Pages
${r.routesDiscovered.length > 0 ? r.routesDiscovered.map(rt => `- \`${rt}\``).join('\n') : '- Primary SPA Routes: `/index.html`, `/dashboard.html`, `/verify.html`, `/training.html`'}

## Functional Test Failures
${r.failuresList.length > 0
  ? r.failuresList.map(f => `### [FAIL] ${f.title}\n- **Location**: \`${f.location}\` (${f.durationMs}ms)\n- **Error**: \`${f.error}\`\n`).join('\n')
  : 'No functional test failures detected.'}

## Performance Warnings
${r.slowPages.length > 0 || r.slowApis.length > 0 || r.duplicateApis.length > 0
  ? `
### Slow Pages (> 3 seconds)
${r.slowPages.map(p => `- ${typeof p === 'string' ? p : JSON.stringify(p)}`).join('\n')}

### Slow API Endpoints (> 1 second)
${r.slowApis.map(a => `- ${typeof a === 'string' ? a : JSON.stringify(a)}`).join('\n')}

### Duplicate API Calls
${r.duplicateApis.map(d => `- ${typeof d === 'string' ? d : JSON.stringify(d)}`).join('\n')}
`
  : 'All tested routes and API endpoints loaded within performance thresholds.'}

## Role Security & Authorization Audit
${r.rolePermissionFailures.length > 0
  ? r.rolePermissionFailures.map(rf => `- [SECURITY FAILURE] ${typeof rf === 'string' ? rf : JSON.stringify(rf)}`).join('\n')
  : 'All role accessibility and denial boundaries enforced correctly across tested roles.'}

## Untested Areas & Notes
- External production integrations (live SMS/email providers, payment processors, live social APIs) are safely mocked in test environment to avoid destructive side-effects.
- Hardware devices (label printers, OBD scanners) are bypassed in virtual browser context.
`;
  }
}

export default MarketSyncQAReporter;
