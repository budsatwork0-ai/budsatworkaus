import type { ArchitectureHealthReport } from './types';

export function renderCiPlan(report: ArchitectureHealthReport): string {
  const critical = report.baseline.newFindings.filter((finding) => finding.severity === 'critical').length;
  const confirmedCritical = report.criticalTriage.filter((item) => item.classification === 'confirmed real issue').length;
  const productionCycles = report.dependencyCycleReadiness.filter((group) => group.classification === 'production architecture issue').length;
  const manualReviewCycles = report.dependencyCycleReadiness.filter((group) => group.classification === 'needs manual review').length;
  const acceptableCycles = report.dependencyCycleReadiness.filter((group) => group.classification === 'acceptable shared-layer cycle').length;
  const toolingCycles = report.dependencyCycleReadiness.filter((group) => group.classification === 'test/tooling noise').length;

  return `# Architecture Doctor Advisory CI Plan

Generated: ${report.generatedAt}

This plan is advisory-only. Phase 6 adds a non-blocking reporting workflow, but it does not enable enforcement CI.
Architecture findings must remain informational until the enforcement conditions below are met.

## Recommended npm script

\`\`\`json
{
  "scripts": {
    "architecture:doctor:advisory": "npx tsx scripts/architecture-doctor.ts --format all --output \\"Buds At Work/01 Architecture/Architecture Doctor\\" --ci-advisory"
  }
}
\`\`\`

## Advisory-only GitHub Actions workflow

\`\`\`yaml
name: Architecture Doctor Advisory Only

on:
  pull_request:
  workflow_dispatch:

jobs:
  architecture-doctor-advisory:
    name: Architecture Doctor advisory-only report
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run test:unit -- architecture-doctor
      - run: npx tsx scripts/architecture-doctor.ts --format all --output "Buds At Work/01 Architecture/Architecture Doctor" --ci-advisory
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: architecture-doctor-advisory-only-reports
          path: Buds At Work/01 Architecture/Architecture Doctor/
\`\`\`

The workflow may fail only when install, typecheck, unit tests, or the doctor command crashes.
It must not include \`--fail-on critical\`, \`--fail-on new\`, score thresholds, or any other blocking architecture-finding gate.

## Suggested advisory thresholds

- Report when health score is below 70.
- Report any confirmed critical finding.
- Report when new unmapped APIs or sensitive tables increase.
- Report dependency cycle groups, but keep them advisory until the real architectural groups are reviewed.

Current snapshot:

- Health score: ${report.healthScore}/100
- Critical findings after calibration: ${critical}
- Confirmed critical findings after triage: ${confirmedCritical}
- Dependency cycle readiness groups: ${report.dependencyCycleReadiness.length}
- Production architecture cycle groups: ${productionCycles}
- Manual-review cycle groups: ${manualReviewCycles}
- Acceptable shared-layer cycle groups: ${acceptableCycles}
- Test/tooling cycle groups: ${toolingCycles}

## Current blockers to enforcement

${renderEnforcementBlockers(report, confirmedCritical)}

## Manual warn-only \`--fail-on critical\`

${confirmedCritical === 0
    ? 'Safe as a manual or warn-only check. Do not wire it into required GitHub Actions until the full enforcement checklist passes.'
    : `Not safe yet. ${confirmedCritical} confirmed critical finding${confirmedCritical === 1 ? '' : 's'} remain after triage.`}

## Exact conditions before \`--fail-on critical\`

- Confirmed critical findings after triage are 0.
- Any critical baseline entry was explicitly promoted with \`accepted_by\`, \`accepted_reason\`, \`review_after\`, and \`owner\`.
- Dependency cycle groups are reviewed and no unowned production architecture cycles remain.
- Stale accepted baseline findings are 0.
- The advisory workflow has run for at least one release cycle without false-positive churn.
- A blocking score threshold is agreed and documented.
- Owners are assigned for finance/payment, NDIS/client, auth/session/user, public API/webhook, and quote/job/customer high-risk domains.

Do not add \`--fail-on critical\` to GitHub Actions until every condition above is true.

## What should block CI later

- Confirmed critical RLS or access-control gaps on sensitive production tables.
- New public webhook/API routes without ownership, authentication, or documented handling.
- New migrations for sensitive tables without RLS or policy evidence.
- New dependency cycles in production app/lib code after the current baseline has been cleaned up.

## What must not block CI yet

- Static-analysis unknowns.
- Manifest or atlas ownership gaps.
- Existing dependency cycle groups.
- Baseline entries still inside their review window.
- Founder-readable report wording changes.

## Staged path to enforcement

1. Advisory: keep the current Phase 6 workflow non-blocking and upload reports as artifacts.
2. Warn-only: run local or manually triggered dry-runs with \`--fail-on critical\`, but do not wire failures into required GitHub checks.
3. Blocking: after the checklist passes, add a separate required CI gate only for newly introduced confirmed critical findings.
`;
}

function renderEnforcementBlockers(report: ArchitectureHealthReport, confirmedCritical: number): string {
  const blockers: string[] = [];
  if (confirmedCritical > 0) blockers.push(`${confirmedCritical} confirmed critical finding${confirmedCritical === 1 ? '' : 's'} after triage.`);
  if (report.dependencyCycleReadiness.length > 0) {
    const unresolved = report.dependencyCycleReadiness.filter((group) => group.classification === 'production architecture issue' || group.classification === 'needs manual review').length;
    blockers.push(`${unresolved} dependency cycle group${unresolved === 1 ? '' : 's'} still need production/manual review.`);
  }
  if (report.baseline.staleAcceptedFindings.length > 0) {
    blockers.push(`${report.baseline.staleAcceptedFindings.length} stale accepted baseline finding${report.baseline.staleAcceptedFindings.length === 1 ? '' : 's'} need review.`);
  }
  if (!report.enforcementReadiness.ready) blockers.push('Enforcement-readiness checklist is not complete.');
  if (blockers.length === 0) {
    return '- No current enforcement blockers detected, but keep advisory mode through one release cycle before adding blocking thresholds.';
  }
  return blockers.map((blocker) => `- ${blocker}`).join('\n');
}
