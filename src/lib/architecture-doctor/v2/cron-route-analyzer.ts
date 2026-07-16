import type { ArchitectureInventory } from '../types';
import type {
  SliceClaim,
  SliceEvidence,
  SliceFinding,
  SliceObservation,
  SliceProvenance,
  SliceRecommendation,
} from './domain';
import { slug } from './domain';
import type { ModuleAnalysisResult, ModuleAnalyzer, ModuleAnalyzerContext } from './module-analyzer';

export const CRON_ROUTE_ANALYZER_ID = 'cron-route-registration';
export const CRON_ROUTE_UNRESOLVED_CAPABILITY_ID = 'UNRESOLVED_CRON_ROUTE_OWNERSHIP';
export const CRON_ROUTE_UNRESOLVED_CAPABILITY_NAME = 'Unresolved Cron Route Ownership';

export const CRON_ROUTE_REGISTERED_RULE_ID = 'cron.route.registered';
export const CRON_TARGET_EXISTS_RULE_ID = 'cron.target.route_exists';

export function createCronRouteRegistrationAnalyzer(inventory: ArchitectureInventory): ModuleAnalyzer {
  return {
    id: CRON_ROUTE_ANALYZER_ID,
    analyze: (context) => analyzeCronRouteRegistration(inventory, context),
  };
}

export function analyzeCronRouteRegistration(inventory: ArchitectureInventory, context: ModuleAnalyzerContext): ModuleAnalysisResult {
  const registeredCronTargets = new Set(inventory.cronEntries.map((entry) => entry.routePath));
  const repoApiRoutes = new Set(inventory.apiRoutes);
  const observations: SliceObservation[] = [];
  const evidence: SliceEvidence[] = [];
  const claims: SliceClaim[] = [];
  const findings: SliceFinding[] = [];
  const recommendations: SliceRecommendation[] = [];

  for (const route of [...inventory.cronRouteCandidates].sort()) {
    const observation = cronRouteCandidateObservation(route, context);
    observations.push(observation);

    if (registeredCronTargets.has(route)) continue;

    const claimId = `claim-cron-route-unregistered-${slug(route)}`;
    const evidenceId = `evidence-cron-route-unregistered-${slug(route)}`;
    const findingId = `finding-cron-route-unregistered-${slug(route)}`;
    const recommendationId = `recommendation-cron-route-unregistered-${slug(route)}`;

    evidence.push({
      id: evidenceId,
      claimId,
      route,
      kind: 'cron_route_candidate_unregistered',
      supports: true,
      observationIds: [observation.id],
      intentIds: [],
      confidence: 'Deterministic',
      provenance: reasoningProvenance(context, 'Compare cron-capable API route inventory against vercel.json cron registrations.'),
      limitation: 'The repository scanner reports the route candidate but does not provide exact source line location.',
      location: {
        precision: 'unavailable',
        description: 'Route candidate location is not available from the v1 repository inventory.',
      },
      ruleId: CRON_ROUTE_REGISTERED_RULE_ID,
      observedValue: `${route} is present in cron-capable route candidates and absent from vercel.json crons.`,
      expectedValue: `${route} should be registered in vercel.json crons when it is intended to run on a schedule.`,
    });
    claims.push({
      id: claimId,
      type: 'cron_route_not_registered',
      status: 'supported',
      subject: route,
      predicate: 'Cron-capable route is not registered in vercel.json.',
      scope: context.verificationRun.scope,
      evidenceIds: [evidenceId],
      confidence: 'Deterministic',
      provenance: reasoningProvenance(context, 'Create cron route registration claim from admitted repository evidence.'),
    });
    findings.push({
      id: findingId,
      type: 'cron_route_unregistered',
      severity: 'medium',
      confidence: 'Deterministic',
      route,
      claimIds: [claimId],
      evidenceIds: [evidenceId],
      mappingContext: unresolvedCronMappingContext(),
      risk: {
        dimension: 'architectural',
        statement: 'A cron-capable route exists without scheduled registration, so the intended background workflow may never execute.',
      },
      recommendationId,
      technicalExplanation: `Cron-capable route ${route} exists in repository inventory but is not registered in vercel.json.`,
      businessImpact: 'The related background capability has unresolved ownership and may silently fail to run on schedule.',
      enforcementMode: 'advisory',
    });
    recommendations.push({
      id: recommendationId,
      findingId,
      summary: `Review cron registration for ${route}.`,
      requiredDecision: 'Decide whether this route should be scheduled or removed from cron-capable routing.',
      remediationPath: 'Register the route in vercel.json if it is intended to run on a schedule, or remove the cron-capable route if it is obsolete.',
      verificationCriteria: 'The next repository scan no longer reports the route as an unregistered cron-capable route.',
      riskReduction: 'Restores traceable ownership of the scheduled workflow and reduces silent operational drift.',
      confidence: 'Deterministic',
    });
  }

  for (const cron of [...inventory.cronEntries].sort((a, b) => a.routePath.localeCompare(b.routePath) || a.path.localeCompare(b.path))) {
    const observation = cronRegistrationObservation(cron.path, cron.routePath, cron.schedule, context);
    observations.push(observation);

    if (repoApiRoutes.has(cron.routePath)) continue;

    const claimId = `claim-cron-target-missing-${slug(cron.path)}-${slug(cron.routePath)}`;
    const evidenceId = `evidence-cron-target-missing-${slug(cron.path)}-${slug(cron.routePath)}`;
    const findingId = `finding-cron-target-missing-${slug(cron.path)}-${slug(cron.routePath)}`;
    const recommendationId = `recommendation-cron-target-missing-${slug(cron.path)}-${slug(cron.routePath)}`;

    evidence.push({
      id: evidenceId,
      claimId,
      route: cron.routePath,
      kind: 'cron_target_missing_route',
      supports: true,
      observationIds: [observation.id],
      intentIds: [],
      confidence: 'Deterministic',
      provenance: reasoningProvenance(context, 'Compare vercel.json cron targets against observed repository API routes.'),
      limitation: 'The repository scanner exposes the cron registration but not the exact vercel.json line number.',
      filePath: 'vercel.json',
      location: {
        precision: 'unavailable',
        description: 'Cron registration is in vercel.json, but exact line location is unavailable from the v1 repository inventory.',
      },
      ruleId: CRON_TARGET_EXISTS_RULE_ID,
      observedValue: `${cron.path} points to ${cron.routePath}, but ${cron.routePath} is absent from repository API routes.`,
      expectedValue: `${cron.routePath} should have a matching API route file.`,
    });
    claims.push({
      id: claimId,
      type: 'cron_target_not_observed',
      status: 'supported',
      subject: cron.routePath,
      predicate: 'Registered cron target has no matching observed API route.',
      scope: context.verificationRun.scope,
      evidenceIds: [evidenceId],
      confidence: 'Deterministic',
      provenance: reasoningProvenance(context, 'Create cron target existence claim from admitted repository evidence.'),
    });
    findings.push({
      id: findingId,
      type: 'cron_target_missing',
      severity: 'high',
      confidence: 'Deterministic',
      route: cron.path,
      claimIds: [claimId],
      evidenceIds: [evidenceId],
      mappingContext: unresolvedCronMappingContext(),
      risk: {
        dimension: 'architectural',
        statement: 'A scheduled cron entry targets a route that is not present in the repository, so the scheduled workflow may fail at runtime.',
      },
      recommendationId,
      technicalExplanation: `vercel.json cron ${cron.path} points to ${cron.routePath}, but no matching API route file was observed.`,
      businessImpact: 'The related scheduled workflow has unresolved mapping and may fail without an accountable capability owner.',
      enforcementMode: 'advisory',
    });
    recommendations.push({
      id: recommendationId,
      findingId,
      summary: `Restore or remove cron target ${cron.routePath}.`,
      requiredDecision: 'Decide whether the cron registration is still intended.',
      remediationPath: 'Restore the missing API route if the scheduled workflow is valid, or remove the vercel.json cron entry if it is obsolete.',
      verificationCriteria: 'The next repository scan observes a matching API route for the cron target or no longer observes the cron registration.',
      riskReduction: 'Prevents a scheduled workflow from targeting a missing route.',
      confidence: 'Deterministic',
    });
  }

  return {
    analyzerId: CRON_ROUTE_ANALYZER_ID,
    capabilities: [{ id: CRON_ROUTE_UNRESOLVED_CAPABILITY_ID, name: CRON_ROUTE_UNRESOLVED_CAPABILITY_NAME }],
    intents: [],
    observations,
    evidence,
    claims,
    findings,
    recommendations,
  };
}

function cronRouteCandidateObservation(route: string, context: ModuleAnalyzerContext): SliceObservation {
  return {
    id: `observation-cron-route-candidate-${slug(route)}`,
    assetKind: 'cron',
    route,
    scope: context.verificationRun.scope,
    provenance: repositoryProvenance(context, 'Read cron-capable API route candidate from repository inventory.', 'Route file path and line are unavailable from the v1 inventory.'),
  };
}

function cronRegistrationObservation(path: string, routePath: string, schedule: string, context: ModuleAnalyzerContext): SliceObservation {
  return {
    id: `observation-cron-registration-${slug(path)}-${slug(routePath)}`,
    assetKind: 'cron',
    route: routePath,
    scope: context.verificationRun.scope,
    provenance: repositoryProvenance(
      context,
      `Read vercel.json cron registration ${path} (${schedule}).`,
      'Exact vercel.json line is unavailable from the v1 inventory.',
    ),
  };
}

function unresolvedCronMappingContext(): SliceFinding['mappingContext'] {
  return {
    status: 'candidate_capability_unresolved',
    capabilityId: CRON_ROUTE_UNRESOLVED_CAPABILITY_ID,
    capabilityName: CRON_ROUTE_UNRESOLVED_CAPABILITY_NAME,
    statement: 'Cron workflow ownership is unresolved in this migrated detector slice and must be mapped before stronger governance.',
  };
}

function repositoryProvenance(context: ModuleAnalyzerContext, method: string, limitation: string): SliceProvenance {
  return {
    source: 'ArchitectureInventory',
    sourceType: 'repository_scan',
    method,
    timepoint: context.timepoint,
    limitation,
  };
}

function reasoningProvenance(context: ModuleAnalyzerContext, method: string): SliceProvenance {
  return {
    source: CRON_ROUTE_ANALYZER_ID,
    sourceType: 'slice_reasoning',
    method,
    timepoint: context.timepoint,
  };
}
