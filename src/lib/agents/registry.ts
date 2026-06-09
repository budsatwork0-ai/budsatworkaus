/**
 * Agent registry — single import point for the runtime.
 */
import type { AgentDefinition } from './types';

// Ops / sales / support / hiring / finance / compliance
import { quoteTriageAgent } from './agents/quote-triage';
import { customerReplyAgent } from './agents/customer-reply';
import { schedulingAgent } from './agents/scheduling';
import { applicantScreenerAgent } from './agents/applicant-screener';
import { ndisComplianceAgent } from './agents/ndis-compliance';
import { reviewsAgent } from './agents/reviews';
import { crewBriefingAgent } from './agents/crew-briefing';
import { reconciliationAgent } from './agents/reconciliation';

// Admin optimization
import { adminOptimizationAgent } from './agents/admin-optimization';

// GitHub integration
import { githubHistorianAgent } from './agents/github-historian';

// Design / UX
import { uxIntelligenceAgent } from './agents/ux-intelligence';
import { heatmapAnalystAgent } from './agents/heatmap-analyst';
import { copyOptimizerAgent } from './agents/copy-optimizer';
import { conversionFunnelAgent } from './agents/conversion-funnel';
import { layoutCriticAgent } from './agents/layout-critic';
import { seoMetaAgent } from './agents/seo-meta';
import { abTestArchitectAgent } from './agents/ab-test-architect';

// Batch 2 — smarter sales + closing the data gaps
import { leadScorerAgent } from './agents/lead-scorer';
import { photoQaAgent } from './agents/photo-qa';
import { yardMapGeoAgent } from './agents/yard-map-geo';
import { phoneTranscriberAgent } from './agents/phone-transcriber';

// Batch 3 — marketing wave
import { contentAgent } from './agents/content-agent';
import { lapsedWinBackAgent } from './agents/lapsed-win-back';
import { competitorWatcherAgent } from './agents/competitor-watcher';

// Batch 4 — finance wave
import { cashFlowForecasterAgent } from './agents/cash-flow-forecaster';
import { stripeDisputeManagerAgent } from './agents/stripe-dispute-manager';
import { whsSafetyReminderAgent } from './agents/whs-safety-reminder';

// Batch 5 — wildcards
import { internalQaAgent } from './agents/internal-qa';
import { crewCoachAgent } from './agents/crew-coach';
import { ndisPlanMatcherAgent } from './agents/ndis-plan-matcher';

// Batch 6 — design evolution, web recon, meta
import { adminUxDesignerAgent } from './agents/admin-ux-designer';
import { lobbyThemeCuratorAgent } from './agents/lobby-theme-curator';
import { agentArchitectAgent } from './agents/agent-architect';
import { competitorScoutAgent } from './agents/competitor-scout';
import { designDeveloperAgent } from './agents/design-developer';

// Batch 7 — pricing
import { priceOptimizerAgent } from './agents/price-optimizer';

// Analytics intelligence
import { analyticsIntelligenceAgent } from './agents/analytics-intelligence';

// Design system
import { designSystemAgent } from './agents/design-system';

// Bud — autonomous AI orchestrator (replaces The Foreman)
import { budAgent } from './agents/bud';

// Efficiency Architect — fleet-wide operational efficiency
import { efficiencyArchitectAgent } from './agents/efficiency-architect';

// Browser Agent — runs Playwright golden-path tests
import { browserAgent } from './agents/browser-agent';

// Bud Observer — continuous monitoring + improvement signal generation
import { budObserverAgent } from './agents/bud-observer';

// Executive Agent Layer — strategic C-suite agents
import { ceoAgent }         from './agents/ceo-agent';
import { cooAgent }         from './agents/coo-agent';
import { cmoAgent }         from './agents/cmo-agent';
import { cfoAgent }         from './agents/cfo-agent';
import { chiefOfStaffAgent } from './agents/chief-of-staff';

// Marketing Studio pod — premium content team (Stanley Henry + The Attention Seeker)
import { stanleyHenryAgent } from './agents/stanley-henry';
import { attentionSeekerAgent } from './agents/attention-seeker';
import { fieldProducerAgent } from './agents/field-producer';
import { scoreboardKeeperAgent } from './agents/scoreboard-keeper';

// Growth Department automation pipeline — Research Lab
import { trendScoutAgent } from './agents/trend-scout';
import { adaptationValidatorAgent } from './agents/adaptation-validator';

// Growth Department — P2 Batch 1: staleness monitors
import { arcMonitorAgent }         from './agents/arc-monitor';
import { threadProgressAgent }     from './agents/thread-progress';
import { productionMonitorAgent }  from './agents/production-monitor';

// Growth Department — P2 Batch 2: asset matching + consent monitoring
import { assetMatcherAgent }   from './agents/asset-matcher';
import { consentMonitorAgent } from './agents/consent-monitor';

// Growth Department — P2 Batch 3: Marketing Studio self-monitoring
import { campaignReporterAgent } from './agents/campaign-reporter';
import { cadenceMonitorAgent }   from './agents/cadence-monitor';

// Growth Department — P2 Batch 4: Format Analyst
import { formatAnalystAgent } from './agents/format-analyst';

export const AGENT_REGISTRY: Record<string, AgentDefinition> = {
  [quoteTriageAgent.id]:       quoteTriageAgent,
  [customerReplyAgent.id]:     customerReplyAgent,
  [schedulingAgent.id]:        schedulingAgent,
  [applicantScreenerAgent.id]: applicantScreenerAgent,
  [ndisComplianceAgent.id]:    ndisComplianceAgent,
  [reviewsAgent.id]:           reviewsAgent,
  [crewBriefingAgent.id]:      crewBriefingAgent,
  [reconciliationAgent.id]:    reconciliationAgent,
  [adminOptimizationAgent.id]: adminOptimizationAgent,
  [githubHistorianAgent.id]:   githubHistorianAgent,
  [uxIntelligenceAgent.id]:    uxIntelligenceAgent,
  [heatmapAnalystAgent.id]:    heatmapAnalystAgent,
  [copyOptimizerAgent.id]:     copyOptimizerAgent,
  [conversionFunnelAgent.id]:  conversionFunnelAgent,
  [layoutCriticAgent.id]:      layoutCriticAgent,
  [seoMetaAgent.id]:           seoMetaAgent,
  [abTestArchitectAgent.id]:   abTestArchitectAgent,
  [leadScorerAgent.id]:        leadScorerAgent,
  [photoQaAgent.id]:           photoQaAgent,
  [yardMapGeoAgent.id]:        yardMapGeoAgent,
  [phoneTranscriberAgent.id]:  phoneTranscriberAgent,
  [contentAgent.id]:           contentAgent,
  [lapsedWinBackAgent.id]:     lapsedWinBackAgent,
  [competitorWatcherAgent.id]: competitorWatcherAgent,
  [cashFlowForecasterAgent.id]:cashFlowForecasterAgent,
  [stripeDisputeManagerAgent.id]: stripeDisputeManagerAgent,
  [whsSafetyReminderAgent.id]: whsSafetyReminderAgent,
  [internalQaAgent.id]:        internalQaAgent,
  [crewCoachAgent.id]:         crewCoachAgent,
  [ndisPlanMatcherAgent.id]:   ndisPlanMatcherAgent,
  [adminUxDesignerAgent.id]:   adminUxDesignerAgent,
  [lobbyThemeCuratorAgent.id]: lobbyThemeCuratorAgent,
  [agentArchitectAgent.id]:    agentArchitectAgent,
  [competitorScoutAgent.id]:   competitorScoutAgent,
  [designDeveloperAgent.id]:   designDeveloperAgent,
  [priceOptimizerAgent.id]:          priceOptimizerAgent,
  [analyticsIntelligenceAgent.id]:   analyticsIntelligenceAgent,
  [designSystemAgent.id]:            designSystemAgent,
  [budAgent.id]:                     budAgent,
  [efficiencyArchitectAgent.id]:     efficiencyArchitectAgent,
  [browserAgent.id]:                 browserAgent,
  [budObserverAgent.id]:             budObserverAgent,
  [stanleyHenryAgent.id]:            stanleyHenryAgent,
  [attentionSeekerAgent.id]:         attentionSeekerAgent,
  [fieldProducerAgent.id]:           fieldProducerAgent,
  [scoreboardKeeperAgent.id]:        scoreboardKeeperAgent,
  // Growth Department — Research Lab pipeline
  [trendScoutAgent.id]:              trendScoutAgent,
  [adaptationValidatorAgent.id]:     adaptationValidatorAgent,
  // Growth Department — P2 Batch 1: staleness monitors
  [arcMonitorAgent.id]:              arcMonitorAgent,
  [threadProgressAgent.id]:          threadProgressAgent,
  [productionMonitorAgent.id]:       productionMonitorAgent,
  // Growth Department — P2 Batch 2: asset matching + consent monitoring
  [assetMatcherAgent.id]:            assetMatcherAgent,
  [consentMonitorAgent.id]:          consentMonitorAgent,
  // Growth Department — P2 Batch 3: Marketing Studio self-monitoring
  [campaignReporterAgent.id]:        campaignReporterAgent,
  [cadenceMonitorAgent.id]:          cadenceMonitorAgent,
  // Growth Department — P2 Batch 4: Format Analyst
  [formatAnalystAgent.id]:           formatAnalystAgent,
  // Executive Layer
  [ceoAgent.id]:                     ceoAgent,
  [cooAgent.id]:                     cooAgent,
  [cmoAgent.id]:                     cmoAgent,
  [cfoAgent.id]:                     cfoAgent,
  [chiefOfStaffAgent.id]:            chiefOfStaffAgent,
};

export const AGENT_LIST: AgentDefinition[] = Object.values(AGENT_REGISTRY);
