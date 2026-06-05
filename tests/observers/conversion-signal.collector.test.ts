/**
 * Integration test: seeds a completed quote flow and asserts that
 * at least one conversion_signal appears in the next observer drain,
 * providing a regression guard for the collector wiring.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  emitQuoteTriageEntered,
  emitQuoteTriageCompleted,
  emitQuoteTriageFailed,
  drainConversionSignals,
  type ConversionSignal,
} from '@/observers/conversion-signal.collector';

const TEST_QUOTE_ID = 'test-quote-001';

beforeEach(() => {
  // Drain any leftover signals from prior tests
  drainConversionSignals();
});

describe('conversion-signal.collector — entry-point wiring', () => {
  it('emits a signal on triage entry so agent failures cannot suppress capture', () => {
    emitQuoteTriageEntered(TEST_QUOTE_ID, { source: 'test' });

    // Simulate an agent failure BEFORE completion is ever called
    // — the entry signal must still be present.
    const signals = drainConversionSignals();

    expect(signals.length).toBeGreaterThanOrEqual(1);
    expect(signals[0].kind).toBe('quote_triage_entered');
    expect(signals[0].quoteId).toBe(TEST_QUOTE_ID);
  });

  it('records both entry and completion signals for a successful flow', () => {
    emitQuoteTriageEntered(TEST_QUOTE_ID);
    emitQuoteTriageCompleted(TEST_QUOTE_ID, { durationMs: 120 });

    const signals = drainConversionSignals();

    expect(signals).toHaveLength(2);
    const kinds = signals.map((s: ConversionSignal) => s.kind);
    expect(kinds).toContain('quote_triage_entered');
    expect(kinds).toContain('quote_triage_completed');
  });

  it('records entry + failure signals when triage fails', () => {
    emitQuoteTriageEntered(TEST_QUOTE_ID);
    emitQuoteTriageFailed(TEST_QUOTE_ID, new Error('agent exploded'));

    const signals = drainConversionSignals();

    expect(signals).toHaveLength(2);
    const failSignal = signals.find((s: ConversionSignal) => s.kind === 'quote_triage_failed');
    expect(failSignal).toBeDefined();
    expect(failSignal?.metadata?.errorMessage).toBe('agent exploded');
  });

  it('drain returns all signals accumulated across multiple quotes', () => {
    emitQuoteTriageEntered('q-1');
    emitQuoteTriageEntered('q-2');
    emitQuoteTriageCompleted('q-1');

    const signals = drainConversionSignals();
    expect(signals.length).toBe(3);
  });

  it('drain clears the buffer — a second drain returns empty', () => {
    emitQuoteTriageEntered(TEST_QUOTE_ID);
    drainConversionSignals(); // consume
    const second = drainConversionSignals();
    expect(second).toHaveLength(0);
  });

  it('each signal carries a recordedAt ISO timestamp', () => {
    emitQuoteTriageEntered(TEST_QUOTE_ID);
    const [signal] = drainConversionSignals();
    expect(() => new Date(signal.recordedAt)).not.toThrow();
    expect(new Date(signal.recordedAt).toISOString()).toBe(signal.recordedAt);
  });
});

describe('conversion-signal.collector — snapshot observer integration', () => {
  it('at least one conversion_signal appears in the observer drain after a completed quote flow', () => {
    // Seed: simulate a full quote flow
    emitQuoteTriageEntered(TEST_QUOTE_ID, { service: 'windows' });
    emitQuoteTriageCompleted(TEST_QUOTE_ID, { priceAud: 149 });

    // Act: observer snapshot assembly drains the collector
    const observerSnapshot = drainConversionSignals();

    // Assert: at least one signal must be present
    expect(observerSnapshot.length).toBeGreaterThanOrEqual(1);
  });
});
