/**
 * bud-observer — autonomous signal analysis pipeline.
 *
 * All exported functions wrap their work in a top-level try/catch so that a
 * failure in one signal handler never silences the rest and always returns a
 * valid JSON-serialisable result instead of throwing.
 */

export type SignalType =
  | 'error_spike'
  | 'agent_quality'
  | 'latency_drift'
  | 'cost_anomaly'
  | 'unknown';

export interface ObserverInput {
  signalType: SignalType;
  dataKey: string;
  payload: unknown;
}

export interface ObserverResult {
  ok: boolean;
  signalType: SignalType;
  dataKey: string;
  output?: unknown;
  error?: {
    message: string;
    stack?: string;
  };
  processedAt: string;
}

/**
 * Analyse a single signal. Never throws — always returns ObserverResult.
 */
export async function analyseSignal(
  input: ObserverInput,
  handler: (payload: unknown) => Promise<unknown>,
): Promise<ObserverResult> {
  const processedAt = new Date().toISOString();
  try {
    const output = await handler(input.payload);
    return {
      ok: true,
      signalType: input.signalType,
      dataKey: input.dataKey,
      output,
      processedAt,
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    // Structured log so external monitoring can parse it.
    console.error(
      JSON.stringify({
        level: 'error',
        source: 'bud-observer',
        signalType: input.signalType,
        dataKey: input.dataKey,
        message: error.message,
        stack: error.stack ?? null,
        timestamp: processedAt,
      }),
    );
    return {
      ok: false,
      signalType: input.signalType,
      dataKey: input.dataKey,
      error: {
        message: error.message,
        stack: error.stack,
      },
      processedAt,
    };
  }
}

/**
 * Run a batch of signals through the analysis pipeline.
 * Each signal is isolated — a failure in one does not affect others.
 */
export async function runObserverPipeline(
  inputs: ObserverInput[],
  handlerMap: Partial<Record<SignalType, (payload: unknown) => Promise<unknown>>>,
): Promise<ObserverResult[]> {
  return Promise.all(
    inputs.map((input) => {
      const handler =
        handlerMap[input.signalType] ??
        (async (_p: unknown) => ({ skipped: true, reason: 'no handler registered' }));
      return analyseSignal(input, handler);
    }),
  );
}
