import type { DriftFinding, DriftSeverity } from './types';

export interface RiskProfile {
  area: string;
  severity: DriftSeverity;
  weight: number;
}

const SEVERITY_ORDER: DriftSeverity[] = ['info', 'low', 'medium', 'high', 'critical'];

export function annotateFindingRisk(finding: DriftFinding): DriftFinding {
  const profile = riskProfileForFinding(finding);
  if (!profile) return finding;

  return {
    ...finding,
    severity: calibratedSeverity(finding, profile.severity),
    riskArea: profile.area,
    riskWeight: profile.weight,
  };
}

export function riskProfileForFinding(finding: Pick<DriftFinding, 'asset' | 'assetKind' | 'type'>): RiskProfile | null {
  const asset = finding.asset.toLowerCase();

  if (finding.assetKind === 'apiRoute' && /webhooks?/.test(asset)) {
    return { area: 'webhook route', severity: 'high', weight: 2 };
  }

  if (finding.assetKind === 'apiRoute' && asset.startsWith('/api/')) {
    if (/stripe|paypal|pay\b|payment|checkout|donate/.test(asset)) {
      return { area: 'finance/payment API', severity: 'high', weight: 2 };
    }
    if (/auth|session|user|account|profile/.test(asset)) {
      return { area: 'auth/user API', severity: 'high', weight: 2 };
    }
    if (/ndis|participant|client/.test(asset)) {
      return { area: 'NDIS/client API', severity: 'high', weight: 2 };
    }
    if (/quote|job|customer|lead|order/.test(asset)) {
      return { area: 'quote/job/customer API', severity: 'high', weight: 2 };
    }
    return { area: 'public API route', severity: 'medium', weight: 1.5 };
  }

  if (finding.assetKind === 'table' || finding.type.includes('table') || finding.type.startsWith('rls_')) {
    if (/payment|payout|payable|expense|stripe|invoice|subscription|donation|contribution|fundraising/.test(asset)) {
      return { area: 'finance/payment table', severity: 'critical', weight: 3 };
    }
    if (/auth|session|user|profile|employee_payroll|audit|permission|role/.test(asset)) {
      return { area: 'auth/session/user data', severity: 'critical', weight: 3 };
    }
    if (/ndis|participant|client|support_plan/.test(asset)) {
      return { area: 'NDIS/client data', severity: 'critical', weight: 3 };
    }
    if (/quote|job|order|customer|lead|agreement|contract/.test(asset)) {
      return { area: 'quotes/jobs/customer records', severity: 'high', weight: 2 };
    }
  }

  return null;
}

export function calculateWeightedHealthScore(findings: DriftFinding[]): number {
  const penaltiesByAsset = new Map<string, number>();
  for (const finding of findings) {
    const key = deStackingKey(finding);
    penaltiesByAsset.set(key, Math.max(penaltiesByAsset.get(key) ?? 0, findingPenalty(finding)));
  }
  const penalty = [...penaltiesByAsset.values()].reduce((total, value) => total + value, 0);
  return Math.round(Math.max(0, Math.min(100, 100 - penalty)));
}

export function findingPenalty(finding: DriftFinding): number {
  const weight = finding.riskWeight ?? 1;
  const base = severityPenalty(finding.severity);
  return base * weight * confidenceMultiplier(finding.confidence);
}

function severityPenalty(severity: DriftSeverity): number {
  if (severity === 'critical') return 15;
  if (severity === 'high') return 8;
  if (severity === 'medium') return 1;
  if (severity === 'low') return 0.5;
  return 0;
}

function calibratedSeverity(finding: DriftFinding, profileSeverity: DriftSeverity): DriftSeverity {
  if (finding.type.startsWith('repo_')) return finding.severity;
  if (finding.type.startsWith('atlas_')) return maxSeverity(finding.severity, profileSeverity === 'critical' ? 'high' : profileSeverity);
  if (finding.type === 'rls_unknown') return maxSeverity(finding.severity, 'medium');
  if (finding.type === 'rls_missing_signal') return maxSeverity(finding.severity, profileSeverity);
  if (finding.confidence === 'unknown' || finding.confidence === 'low') return finding.severity;
  return maxSeverity(finding.severity, profileSeverity);
}

function confidenceMultiplier(confidence: DriftFinding['confidence']): number {
  if (confidence === 'confirmed') return 1;
  if (confidence === 'high') return 0.85;
  if (confidence === 'medium') return 0.6;
  return 0.35;
}

function maxSeverity(left: DriftSeverity, right: DriftSeverity): DriftSeverity {
  return SEVERITY_ORDER.indexOf(left) >= SEVERITY_ORDER.indexOf(right) ? left : right;
}

function deStackingKey(finding: DriftFinding): string {
  return [finding.assetKind, finding.asset, finding.capabilityId ?? 'unknown', finding.riskArea ?? 'standard'].join('|');
}
