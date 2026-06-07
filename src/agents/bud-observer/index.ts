import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { pingHealthcheck } from './health-check';

// ─── Schemas ────────────────────────────────────────────────────────────────

const SignalSchema = z.object({
  type: z.string(),
  value: z.unknown(),
  source: z.string().optional(),
});

const SnapshotInputSchema = z.object({
  signals: z.array(SignalSchema).optional().default([]),
  observed_at: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional().default({}),
});

export type ObserverSnapshot = {
  signals: z.infer<typeof SignalSchema>[];
  observed_at: string;
  meta: Record<string, unknown>;
  data_quality: 'ok' | 'degraded' | 'failed';
  errors: string[];
};

// ─── Signal source fetchers ──────────────────────────────────────────────────

type FetchResult =
  | { ok: true; data: z.infer<typeof SignalSchema>[] }
  | { ok: false; error: string };

async function fetchErrorSpikes(): Promise<FetchResult> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('agent_logs')
      .select('type, value:payload, source:agent_id')
      .eq('level', 'error')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return { ok: false, error: `supabase error_spikes: ${error.message}` };
    const parsed = z.array(SignalSchema).safeParse(data ?? []);
    if (!parsed.success) {
      return { ok: false, error: `schema error_spikes: ${parsed.error.message.slice(0, 200)}` };
    }
    return { ok: true, data: parsed.data };
  } catch (err) {
    return { ok: false, error: `fetch error_spikes threw: ${String(err).slice(0, 200)}` };
  }
}

async function fetchPerformanceSignals(): Promise<FetchResult> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('performance_metrics')
      .select('type, value:metric_value, source:metric_name')
      .order('recorded_at', { ascending: false })
      .limit(50);
    if (error) return { ok: false, error: `supabase performance: ${error.message}` };
    const parsed = z.array(SignalSchema).safeParse(data ?? []);
    if (!parsed.success) {
      return { ok: false, error: `schema performance: ${parsed.error.message.slice(0, 200)}` };
    }
    return { ok: true, data: parsed.data };
  } catch (err) {
    return { ok: false, error: `fetch performance threw: ${String(err).slice(0, 200)}` };
  }
}

async function fetchBusinessSignals(): Promise<FetchResult> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('quote_requests')
      .select('type:status, value:id, source:service_type')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return { ok: false, error: `supabase business: ${error.message}` };
    const parsed = z.array(SignalSchema).safeParse(data ?? []);
    if (!parsed.success) {
      return { ok: false, error: `schema business: ${parsed.error.message.slice(0, 200)}` };
    }
    return { ok: true, data: parsed.data };
  } catch (err) {
    return { ok: false, error: `fetch business threw: ${String(err).slice(0, 200)}` };
  }
}

// ─── Main observer run ───────────────────────────────────────────────────────

export async function runObserver(rawInput?: unknown): Promise<ObserverSnapshot> {
  const errors: string[] = [];
  const allSignals: z.infer<typeof SignalSchema>[] = [];

  // If a raw input snapshot was passed, validate it first
  if (rawInput !== undefined) {
    const parsed = SnapshotInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const msg = `input schema invalid: ${parsed.error.message.slice(0, 300)}`;
      console.error('[bud-observer] SchemaValidationError', msg);
      const snapshot: ObserverSnapshot = {
        signals: [],
        observed_at: new Date().toISOString(),
        meta: {},
        data_quality: 'failed',
        errors: [msg],
      };
      await pingHealthcheck();
      return snapshot;
    }
    allSignals.push(...parsed.data.signals);
  }

  // Fetch each signal source independently
  const [errorSpikesResult, perfResult, businessResult] = await Promise.allSettled([
    fetchErrorSpikes(),
    fetchPerformanceSignals(),
    fetchBusinessSignals(),
  ]);

  for (const [label, result] of [
    ['error_spikes', errorSpikesResult],
    ['performance', perfResult],
    ['business', businessResult],
  ] as const) {
    if (result.status === 'rejected') {
      errors.push(`${label} rejected: ${String(result.reason).slice(0, 200)}`);
    } else if (!result.value.ok) {
      errors.push(result.value.error);
    } else {
      allSignals.push(...result.value.data);
    }
  }

  const data_quality: ObserverSnapshot['data_quality'] =
    errors.length === 0 ? 'ok' :
    allSignals.length === 0 ? 'failed' :
    'degraded';

  if (errors.length > 0) {
    console.warn('[bud-observer] partial snapshot', { data_quality, errorCount: errors.length, errors });
  }

  const snapshot: ObserverSnapshot = {
    signals: allSignals,
    observed_at: new Date().toISOString(),
    meta: { signalCount: allSignals.length, errorCount: errors.length },
    data_quality,
    errors,
  };

  // Persist snapshot
  try {
    const supabase = createServiceClient();
    await supabase.from('observer_snapshots').insert([
      {
        signals: allSignals,
        observed_at: snapshot.observed_at,
        data_quality,
        errors,
      },
    ]);
  } catch (err) {
    console.error('[bud-observer] failed to persist snapshot', String(err).slice(0, 200));
  }

  await pingHealthcheck();
  return snapshot;
}
