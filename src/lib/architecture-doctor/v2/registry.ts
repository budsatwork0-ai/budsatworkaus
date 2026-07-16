import type { ModuleAnalysisResult, ModuleAnalyzer, ModuleAnalyzerContext } from './module-analyzer';
import { validateModuleAnalysis } from './module-analyzer';

export class ModuleAnalyzerRegistry {
  private readonly analyzers = new Map<string, ModuleAnalyzer>();

  register(analyzer: ModuleAnalyzer): void {
    if (this.analyzers.has(analyzer.id)) throw new Error(`Module analyzer ${analyzer.id} is already registered.`);
    this.analyzers.set(analyzer.id, analyzer);
  }

  list(): ModuleAnalyzer[] {
    return [...this.analyzers.values()];
  }

  async analyzeAll(context: ModuleAnalyzerContext): Promise<ModuleAnalysisResult[]> {
    const results = await Promise.all(this.list().map((analyzer) => analyzer.analyze(context)));
    for (const result of results) validateModuleAnalysis(result);
    return results;
  }
}
