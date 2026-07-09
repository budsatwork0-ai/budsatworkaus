import { readFile, writeFile } from 'node:fs/promises';
import type {
  ArchitectureDoctorBaseline,
  BaselineAcceptedFinding,
  BaselineClassification,
  DriftFinding,
} from './types';

export async function readBaseline(baselinePath?: string): Promise<ArchitectureDoctorBaseline> {
  if (!baselinePath) return { version: 1, acceptedFindings: [] };

  try {
    const parsed = JSON.parse(await readFile(baselinePath, 'utf8')) as Partial<ArchitectureDoctorBaseline>;
    return {
      version: 1,
      acceptedFindings: Array.isArray(parsed.acceptedFindings) ? parsed.acceptedFindings : [],
    };
  } catch {
    return { version: 1, acceptedFindings: [] };
  }
}

export function classifyFindings(
  findings: DriftFinding[],
  baseline: ArchitectureDoctorBaseline,
  baselinePath?: string,
): BaselineClassification {
  const accepted = baseline.acceptedFindings;
  const acceptedFindings: DriftFinding[] = [];
  const newFindings: DriftFinding[] = [];

  for (const finding of findings) {
    const withKey = { ...finding, key: finding.key ?? findingKey(finding) };
    if (accepted.some((entry) => baselineMatches(entry, withKey))) {
      const entry = accepted.find((baselineEntry) => baselineMatches(baselineEntry, withKey));
      acceptedFindings.push(applyBaselineMetadata(withKey, entry));
    } else {
      newFindings.push(withKey);
    }
  }

  const resolvedFindings = accepted.filter(
    (entry) => !findings.some((finding) => baselineMatches(entry, { ...finding, key: finding.key ?? findingKey(finding) })),
  );

  return {
    baselinePath,
    newFindings,
    acceptedFindings,
    resolvedFindings,
    unknownUnmappedAssets: findings.filter((finding) => finding.confidence !== 'confirmed'),
    staleAcceptedFindings: acceptedFindings.filter((finding) => {
      const entry = accepted.find((baselineEntry) => baselineMatches(baselineEntry, finding));
      const reviewAfter = entry?.review_after ?? entry?.reviewAfter ?? entry?.review_date ?? entry?.reviewDate;
      return reviewAfter ? new Date(reviewAfter).getTime() < Date.now() : false;
    }),
  };
}

export function findingKey(finding: DriftFinding): string {
  return [finding.type, finding.assetKind, finding.asset, finding.capabilityId ?? 'unknown'].join('|');
}

export function generateProposedBaseline(findings: DriftFinding[], generatedAt = new Date()): ArchitectureDoctorBaseline {
  const accepted_at = generatedAt.toISOString();
  const review_after = new Date(generatedAt.getTime() + 1000 * 60 * 60 * 24 * 90).toISOString().slice(0, 10);

  const acceptedFindings = findings
    .filter((finding) => shouldPropose(finding))
    .map((finding, index) => {
      const key = finding.key ?? findingKey(finding);
      return {
        id: `ADB-${String(index + 1).padStart(4, '0')}`,
        key,
        type: finding.type,
        file: finding.evidence?.[0],
        asset: finding.asset,
        capabilityId: finding.capabilityId,
        capability: finding.capabilityName,
        owner: finding.owner,
        severity: finding.severity,
        reason: proposedReason(finding),
        accepted_by: '<required>',
        accepted_reason: '<required>',
        accepted_at,
        review_after,
      };
    });

  return { version: 1, acceptedFindings };
}

export interface PromoteBaselineOptions {
  selected: string[];
  acceptedBy: string;
  acceptedReason: string;
  reviewAfter: string;
  owner?: string;
  generatedAt?: Date;
}

export function reviewBaselineEntries(findings: DriftFinding[], generatedAt = new Date()): BaselineAcceptedFinding[] {
  return generateProposedBaseline(findings, generatedAt).acceptedFindings;
}

export async function promoteBaselineEntries(
  baselinePath: string,
  findings: DriftFinding[],
  options: PromoteBaselineOptions,
): Promise<{ promoted: BaselineAcceptedFinding[]; skipped: string[] }> {
  validatePromotionMetadata(options);

  const baseline = await readBaseline(baselinePath);
  const proposed = reviewBaselineEntries(findings, options.generatedAt);
  const selected = new Set(options.selected.map((value) => value.trim()).filter(Boolean));
  const promoted: BaselineAcceptedFinding[] = [];
  const skipped: string[] = [];

  for (const selector of selected) {
    const entry = proposed.find((candidate) => candidate.id === selector || candidate.key === selector);
    if (!entry) {
      skipped.push(selector);
      continue;
    }
    if (baseline.acceptedFindings.some((accepted) => baselineEntryKey(accepted) === baselineEntryKey(entry))) continue;
    promoted.push({
      ...entry,
      owner: options.owner ?? entry.owner,
      accepted_by: options.acceptedBy,
      accepted_reason: options.acceptedReason,
      reason: options.acceptedReason,
      accepted_at: (options.generatedAt ?? new Date()).toISOString(),
      review_after: options.reviewAfter,
    });
  }

  const nextBaseline: ArchitectureDoctorBaseline = {
    version: 1,
    acceptedFindings: [...baseline.acceptedFindings, ...promoted],
  };
  validateAcceptedBaseline(nextBaseline);
  await writeFile(baselinePath, `${JSON.stringify(nextBaseline, null, 2)}\n`, 'utf8');
  return { promoted, skipped };
}

export function validateAcceptedBaseline(baseline: ArchitectureDoctorBaseline): void {
  for (const [index, entry] of baseline.acceptedFindings.entries()) {
    const label = entry.id ?? entry.key ?? entry.asset ?? `entry ${index + 1}`;
    const missing = [
      ['accepted_by', entry.accepted_by],
      ['accepted_reason', entry.accepted_reason ?? entry.reason],
      ['review_after', entry.review_after ?? entry.reviewAfter ?? entry.review_date ?? entry.reviewDate],
      ['severity', entry.severity],
    ].filter(([, value]) => !value || value === '<required>');
    if ((entry.severity === 'critical' || entry.disposition) && (!entry.owner || entry.owner === '<required>')) {
      missing.push(['owner', entry.owner]);
    }
    if (entry.disposition && !entry.disposition.trim()) {
      missing.push(['disposition', entry.disposition]);
    }

    if (missing.length > 0) {
      throw new Error(`Baseline ${label} is missing required metadata: ${missing.map(([name]) => name).join(', ')}.`);
    }
    const reviewAfter = entry.review_after ?? entry.reviewAfter ?? entry.review_date ?? entry.reviewDate;
    if (reviewAfter && Number.isNaN(new Date(reviewAfter).getTime())) {
      throw new Error(`Baseline ${label} has invalid review_after date "${reviewAfter}".`);
    }
    const expiryDate = entry.expiry_date ?? entry.expiryDate;
    if (expiryDate && Number.isNaN(new Date(expiryDate).getTime())) {
      throw new Error(`Baseline ${label} has invalid expiry_date "${expiryDate}".`);
    }
  }
}

function shouldPropose(finding: DriftFinding): boolean {
  if (finding.confidence === 'confirmed') return false;
  return finding.severity === 'low' || finding.type === 'dependency_cross_domain' || finding.type === 'governance_unknown' || finding.type === 'business_loop_unknown';
}

function proposedReason(finding: DriftFinding): string {
  if (finding.type === 'repo_api_unmapped' || finding.type === 'repo_page_unmapped' || finding.type === 'repo_agent_unmapped' || finding.type === 'repo_table_unmapped') {
    return 'Unmapped asset requires capability ownership review.';
  }
  if (finding.type === 'dependency_cross_domain') return 'Possible intentional dependency; requires architecture owner review.';
  return 'Static analysis could not prove coverage; requires periodic review.';
}

function baselineMatches(entry: BaselineAcceptedFinding, finding: DriftFinding): boolean {
  if (entry.key && entry.key === finding.key) return true;
  if (entry.type && entry.type !== finding.type) return false;
  if (entry.asset && entry.asset !== finding.asset) return false;
  if (entry.capabilityId && entry.capabilityId !== finding.capabilityId) return false;
  return Boolean(entry.type || entry.asset || entry.capabilityId);
}

function applyBaselineMetadata(finding: DriftFinding, entry?: BaselineAcceptedFinding): DriftFinding {
  if (!entry) return finding;
  return {
    ...finding,
    baselineDisposition: entry.disposition,
    baselineReason: entry.accepted_reason ?? entry.reason,
    baselineOwner: entry.owner,
    baselineReviewDate: entry.review_date ?? entry.reviewDate ?? entry.review_after ?? entry.reviewAfter,
    baselineExpiryDate: entry.expiry_date ?? entry.expiryDate,
  };
}

function validatePromotionMetadata(options: PromoteBaselineOptions): void {
  if (options.selected.length === 0) throw new Error('Use --promote-baseline with one or more proposed IDs or keys.');
  if (!options.acceptedBy.trim()) throw new Error('Baseline promotion requires --accepted-by.');
  if (!options.acceptedReason.trim()) throw new Error('Baseline promotion requires --accepted-reason.');
  if (!options.reviewAfter.trim()) throw new Error('Baseline promotion requires --review-after YYYY-MM-DD.');
  if (Number.isNaN(new Date(options.reviewAfter).getTime())) {
    throw new Error(`Invalid --review-after date "${options.reviewAfter}".`);
  }
}

function baselineEntryKey(entry: BaselineAcceptedFinding): string {
  return entry.key ?? [entry.type ?? 'any', entry.asset ?? 'unknown', entry.capabilityId ?? 'unknown'].join('|');
}
