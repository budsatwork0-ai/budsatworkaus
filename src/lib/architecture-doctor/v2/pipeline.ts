import type { SliceKnowledgePublication, SliceVerificationRun } from './domain';
import type { ModuleAnalysisResult, ModuleAnalyzerContext } from './module-analyzer';
import { publishModuleKnowledge } from './module-knowledge';
import { ModuleAnalyzerRegistry } from './registry';

export async function runModuleAnalysisPipeline(input: {
  registry: ModuleAnalyzerRegistry;
  verificationRun: SliceVerificationRun;
  timepoint: string;
  reportLabel?: string;
}): Promise<{ analyses: ModuleAnalysisResult[]; knowledge: SliceKnowledgePublication }> {
  const context: ModuleAnalyzerContext = {
    verificationRun: input.verificationRun,
    timepoint: input.timepoint,
  };
  const analyses = await input.registry.analyzeAll(context);
  return {
    analyses,
    knowledge: publishModuleKnowledge({
      verificationRun: input.verificationRun,
      analyses,
      reportLabel: input.reportLabel,
    }),
  };
}
