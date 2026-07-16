import type {
  SliceClaim,
  SliceEvidence,
  SliceFinding,
  SliceIntent,
  SliceObservation,
  SliceRecommendation,
  SliceVerificationRun,
} from './domain';

export interface ModuleAnalyzerContext {
  verificationRun: SliceVerificationRun;
  timepoint: string;
}

export interface ModuleCapability {
  id: string;
  name: string;
}

export interface ModuleAnalysisResult {
  analyzerId: string;
  capabilities: ModuleCapability[];
  intents: SliceIntent[];
  observations: SliceObservation[];
  evidence: SliceEvidence[];
  claims: SliceClaim[];
  findings: SliceFinding[];
  recommendations: SliceRecommendation[];
}

export interface ModuleAnalyzer {
  id: string;
  analyze(context: ModuleAnalyzerContext): ModuleAnalysisResult | Promise<ModuleAnalysisResult>;
}

export function validateModuleAnalysis(result: ModuleAnalysisResult): void {
  const evidenceIds = new Set(result.evidence.map((item) => item.id));
  const claimIds = new Set(result.claims.map((item) => item.id));
  const findingIds = new Set(result.findings.map((item) => item.id));
  const recommendationIds = new Set(result.recommendations.map((item) => item.id));

  for (const claim of result.claims) {
    if (claim.evidenceIds.length === 0) {
      throw new Error(`Analyzer ${result.analyzerId} claim ${claim.id} has no evidence.`);
    }
    for (const evidenceId of claim.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) throw new Error(`Analyzer ${result.analyzerId} claim ${claim.id} references missing evidence ${evidenceId}.`);
    }
  }

  for (const finding of result.findings) {
    if (finding.claimIds.length === 0) throw new Error(`Analyzer ${result.analyzerId} finding ${finding.id} has no claims.`);
    if (finding.evidenceIds.length === 0) throw new Error(`Analyzer ${result.analyzerId} finding ${finding.id} has no evidence.`);
    if (!finding.recommendationId || !recommendationIds.has(finding.recommendationId)) {
      throw new Error(`Analyzer ${result.analyzerId} finding ${finding.id} has no valid recommendation.`);
    }
    if (!finding.risk.statement || !finding.severity || !finding.confidence) {
      throw new Error(`Analyzer ${result.analyzerId} finding ${finding.id} is missing risk, severity, or confidence.`);
    }
    if (!finding.capabilityId && finding.mappingContext.status !== 'candidate_capability_unresolved') {
      throw new Error(`Analyzer ${result.analyzerId} finding ${finding.id} lacks capability or unresolved mapping context.`);
    }
    for (const claimId of finding.claimIds) {
      if (!claimIds.has(claimId)) throw new Error(`Analyzer ${result.analyzerId} finding ${finding.id} references missing claim ${claimId}.`);
    }
  }

  for (const recommendation of result.recommendations) {
    if (!findingIds.has(recommendation.findingId)) {
      throw new Error(`Analyzer ${result.analyzerId} recommendation ${recommendation.id} references missing finding ${recommendation.findingId}.`);
    }
  }
}
