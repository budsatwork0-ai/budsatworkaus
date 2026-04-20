import { useCallback, useEffect, useMemo, useReducer } from 'react';
import type {
  ServiceType,
  WizardState,
  NumericParams,
  DumpRunSelection,
  DeliverySelection,
  TransportSelection,
  SneakerTurnaround,
  Action,
} from '../types';
import type {
  AssistantState,
  AssistantAnswers,
  QuestionId,
  AssistantAnswerId,
  AssistantAPI,
  LiveEstimate,
} from './types';
import { QUESTION_DEFS, getActiveSequence, buildMergePayload } from './flow';
import {
  priceQuote,
  selectedFromParams,
  computeDumpDisposalFee,
} from '../lib/pricing/engine';
import {
  SNEAKER_MULTI_PRICING,
  DEFAULT_DUMP_DELIVERY,
  DEFAULT_DUMP_TRANSPORT,
} from '../lib/pricing/constants';
import { calcDeliveryQuote, calcTransportQuote } from '../lib/pricing/transport';
import { BASE_CALLOUT_PRICE, EFFORT_BLOCK_RANGE, PHYSICAL_BLOCK_RANGE } from '../lib/estimation';

/** Default travel distance for the quote-assistant live estimate.
 *  The assistant doesn't collect an address, so we assume a typical
 *  inner/mid-suburb trip. Users refine this in the full wizard. */
const ASSISTANT_DEFAULT_KM = 12;

const LS_DISMISSED_KEY = 'budsatwork.assistant.dismissed.v1';

// ─── Internal reducer ─────────────────────────────────────────────────────────

type InternalAction =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'dismiss' }
  | { type: 'init_dismissed' }
  | { type: 'answer'; id: AssistantAnswerId; value: string | number }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'set_service'; service: ServiceType };

function assistantReducer(state: AssistantState, action: InternalAction): AssistantState {
  switch (action.type) {
    case 'open':
      return { ...state, open: true };
    case 'close':
      return { ...state, open: false };
    case 'dismiss':
      return { ...state, open: false, dismissed: true };
    case 'init_dismissed':
      return { ...state, dismissed: true };
    case 'answer': {
      const newAnswers = { ...state.answers, [action.id]: action.value };
      return { ...state, answers: newAnswers };
    }
    case 'next':
      return { ...state, questionIndex: state.questionIndex + 1 };
    case 'prev':
      // If on the first question of a service, go back to the service picker
      if (state.questionIndex === 0) {
        return { ...state, service: null, answers: {}, questionIndex: 0 };
      }
      return { ...state, questionIndex: state.questionIndex - 1 };
    case 'set_service':
      return { ...state, service: action.service, answers: {}, questionIndex: 0 };
    default:
      return state;
  }
}

// ─── Live estimate computation ────────────────────────────────────────────────

function computeLiveEstimate(
  service: ServiceType | null,
  answers: AssistantAnswers,
): LiveEstimate | null {
  if (!service) return null;

  const payload = buildMergePayload(service, answers);
  const scope = payload.scope ?? '';

  // ── Dump — use the same pricing helpers as the main wizard so the
  //    assistant estimate matches what the user will see next. ──

  if (service === 'dump' && scope === 'dump_runs') {
    const dumpRun = (payload.dumpRun as DumpRunSelection) ?? { loadType: 'ute', loads: 1 };
    const loads = Math.max(1, dumpRun.loads || 1);
    const loadType = dumpRun.loadType ?? 'ute';

    // Mirror calculateEstimatedPrice's combinePricing logic:
    //   base callout + effort blocks (loads × 1.5, +1 for trailers)
    //   + physical blocks (1 for bulky) + travel (short-haul included)
    let effortBlocks = loads * 1.5;
    if (loadType === 'trailer') effortBlocks += 1;
    const physicalBlocks = loadType === 'bulky' ? 1 : 0;

    // Use the midpoint of the effort/physical ranges so the assistant shows
    // a single confident number rather than a wide range.
    const effortRate = (EFFORT_BLOCK_RANGE.min + EFFORT_BLOCK_RANGE.max) / 2;
    const physicalRate = (PHYSICAL_BLOCK_RANGE.min + PHYSICAL_BLOCK_RANGE.max) / 2;

    const labour =
      BASE_CALLOUT_PRICE + effortBlocks * effortRate + physicalBlocks * physicalRate;

    // Disposal fees (per-tier or weight-based) come from the same helper the
    // wizard uses, so numbers line up.
    const disposal = computeDumpDisposalFee(dumpRun).fee;
    const total = Math.round(labour + disposal);

    const loadLabel =
      loadType === 'trailer' ? 'medium load' : loadType === 'bulky' ? 'bulky items' : 'small load';
    const breakdown =
      `${loads} ${loadLabel}${loads > 1 ? 's' : ''} · incl. tip fees · ~12 km included`;

    return { total, confidence: 'estimate', breakdown };
  }

  if (service === 'dump' && scope === 'dump_delivery') {
    // User didn't pick an item type in the assistant — use a sensible default.
    const selection: DeliverySelection = {
      ...DEFAULT_DUMP_DELIVERY,
      itemType: 'household',
    };
    const result = calcDeliveryQuote(selection, ASSISTANT_DEFAULT_KM);
    if (result.isCustomQuote || !result.total) return null;
    return {
      total: result.total,
      confidence: 'estimate',
      breakdown: `Household item · ~${ASSISTANT_DEFAULT_KM} km · pickup & drop-off`,
    };
  }

  if (service === 'dump' && scope === 'dump_transport') {
    const selection: TransportSelection = { ...DEFAULT_DUMP_TRANSPORT };
    const result = calcTransportQuote(selection, ASSISTANT_DEFAULT_KM);
    if (result.isCustomQuote || !result.total) return null;
    return {
      total: result.total,
      confidence: 'estimate',
      breakdown: `Small load · 1 helper · ~${ASSISTANT_DEFAULT_KM} km included`,
    };
  }

  // ── Laundry & Sneakers: compute directly using same logic as service card ──
  if (service === 'laundry_sneakers') {
    const LAUNDRY_MIN = 60;
    const LAUNDRY_FEE = 14; // $12 pickup + $2 service
    const SNEAKER_FEE = 10; // $8 pickup + $2 service

    if (scope === 'laundry') {
      const loads   = Number(answers.ls_laundry_loads ?? 1);
      const billed  = Math.max(LAUNDRY_MIN / 30, loads); // effective loads after minimum
      const base    = billed * 30;
      const total   = base + LAUNDRY_FEE;
      const breakdown =
        billed > loads
          ? `${billed} loads min · $${base} base · +$${LAUNDRY_FEE} pickup`
          : `${loads} load${loads !== 1 ? 's' : ''} × $30 · +$${LAUNDRY_FEE} pickup`;
      return { total, confidence: 'estimate', breakdown };
    }

    if (scope === 'sneaker_care') {
      const pairs  = Number(answers.ls_sneaker_pairs ?? 2);
      const sorted = [...SNEAKER_MULTI_PRICING].sort((a, b) => a.pairs - b.pairs);
      const exact  = sorted.find((t) => t.pairs === pairs);
      if (exact) {
        return {
          total: exact.price + SNEAKER_FEE,
          confidence: 'estimate',
          breakdown: `${pairs} pair${pairs !== 1 ? 's' : ''} · $${exact.price} · +$${SNEAKER_FEE} pickup`,
        };
      }
      // Interpolate between surrounding tiers
      const lower = [...sorted].reverse().find((t) => t.pairs < pairs);
      const upper = sorted.find((t) => t.pairs > pairs);
      if (lower && upper) {
        const ratio  = (pairs - lower.pairs) / (upper.pairs - lower.pairs);
        const interp = Math.round(lower.price + ratio * (upper.price - lower.price));
        return {
          total: interp + SNEAKER_FEE,
          confidence: 'estimate',
          breakdown: `${pairs} pairs · $${interp} · +$${SNEAKER_FEE} pickup`,
        };
      }
      const fallback = sorted.at(-1)?.price ?? 40;
      return {
        total: fallback + SNEAKER_FEE,
        confidence: 'estimate',
        breakdown: `${pairs} pairs · $${fallback} · +$${SNEAKER_FEE} pickup`,
      };
    }

    return null;
  }
  // ── end laundry_sneakers ──

  const params = (payload.paramsByService?.[service] ?? {}) as NumericParams;

  let selected: Record<string, number>;
  try {
    selected = selectedFromParams(
      service,
      scope,
      params,
      { secondStorey: false },
      service === 'windows'
        ? {
            panes_int: Number(answers.win_panes_int ?? 0),
            panes_ext: Number(answers.win_panes_ext ?? 0),
            tracks:    Number(answers.win_tracks    ?? 0),
            screens:   Number(answers.win_screens   ?? 0),
          }
        : undefined,
      'home',
      undefined,
    );
  } catch {
    return null;
  }

  const totalQty = Object.values(selected).reduce((a, b) => a + (b ?? 0), 0);
  if (totalQty === 0) return null;

  const dumpRunSelection: DumpRunSelection | undefined =
    service === 'dump' ? (payload.dumpRun as DumpRunSelection) : undefined;

  // Sneakers are handled in an earlier branch that returns; this code path
  // never sees `service === 'laundry_sneakers'`, so this is always undefined.
  const sneakerTurnaround: SneakerTurnaround | undefined = undefined;

  const yardParams: NumericParams | undefined = service === 'yard' ? params : undefined;
  const cleaningParams: NumericParams | undefined = service === 'cleaning' ? params : undefined;

  try {
    const result = priceQuote({
      context: 'home',
      currentService: service,
      currentScope: scope,
      selected,
      distanceKm: 0,
      paidParking: false,
      tipFee: 0,
      conditionMult: 1,
      flags: { petHair: false, greaseSoap: false, clutterAccess: false, secondStorey: false },
      commercialUplift: 1,
      sizeAdjust: 'standard',
      conditionFlat: 0,
      contractDiscount: 0,
      commercialType: null,
      afterHours: false,
      autoCategory: service === 'auto' ? String(payload.carModelType ?? '') : undefined,
      autoSizeCategory:
        service === 'auto' ? (payload.carDetectedSizeCategory as string | null | undefined) ?? null : undefined,
      autoYear: service === 'auto' ? (payload.carDetectedYear as number | null | undefined) ?? null : undefined,
      dumpRunSelection,
      cleaningParams,
      yardParams,
      sneakerTurnaround,
    });

    if (!result.total || result.total <= 0) return null;
    return { total: result.total, confidence: result.confidence ?? 'estimate' };
  } catch {
    return null;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAssistant(opts: {
  dispatch: React.Dispatch<Action>;
  wizardStep: 1 | 2 | 3;
  wizardHasInteracted: boolean;
}): AssistantAPI {
  const [state, assistantDispatch] = useReducer(assistantReducer, {
    open: false,
    dismissed: false, // always false on first render — synced from localStorage below
    service: null,
    questionIndex: 0,
    answers: {},
  });

  // Sync dismissed state from localStorage after hydration
  useEffect(() => {
    if (localStorage.getItem(LS_DISMISSED_KEY) === 'true') {
      assistantDispatch({ type: 'init_dismissed' });
    }
  }, []);

  // Auto-open after 5–8s on first visit (only if not dismissed and wizard untouched)
  useEffect(() => {
    if (state.dismissed || opts.wizardHasInteracted) return;
    if (localStorage.getItem(LS_DISMISSED_KEY) === 'true') return;
    const delay = 5000 + Math.random() * 3000;
    const t = setTimeout(() => assistantDispatch({ type: 'open' }), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // deliberately mount-only

  // Active service-specific question sequence
  const activeSequence = useMemo(
    () => (state.service ? getActiveSequence(state.service, state.answers) : []),
    [state.service, state.answers],
  );

  // Step 0 = service picker; steps 1..N = service-specific questions
  // When service is null, show the service picker question
  const inServicePick = state.service === null;
  const totalSteps    = inServicePick ? 1 : activeSequence.length;
  const currentStep   = inServicePick ? 1 : Math.min(state.questionIndex + 1, totalSteps);

  const currentQId = inServicePick
    ? 'service_pick'
    : (activeSequence[state.questionIndex] ?? null);
  const currentQuestion = currentQId ? QUESTION_DEFS[currentQId] : null;

  const isComplete = !inServicePick && state.questionIndex >= activeSequence.length;

  const canAdvance = useMemo(() => {
    if (!currentQId) return false;
    const answer = state.answers[currentQId as QuestionId];
    if (currentQuestion?.kind === 'stepper') return answer !== undefined;
    return answer !== undefined && answer !== '';
  }, [currentQId, currentQuestion, state.answers]);

  // Can go back whenever a service is selected — either to a previous question or back to the service picker
  const canGoBack = !inServicePick;

  const liveEstimate = useMemo(
    () => computeLiveEstimate(state.service, state.answers),
    [state.service, state.answers],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const onOpen    = useCallback(() => assistantDispatch({ type: 'open' }), []);
  const onClose   = useCallback(() => assistantDispatch({ type: 'close' }), []);

  const onDismiss = useCallback(() => {
    localStorage.setItem(LS_DISMISSED_KEY, 'true');
    assistantDispatch({ type: 'dismiss' });
  }, []);

  const onAnswer = useCallback(
    (id: AssistantAnswerId, value: string | number) => {
      if (id === 'service_pick') {
        // Service selection — set service and reset sequence
        assistantDispatch({ type: 'set_service', service: value as ServiceType });
        return;
      }

      assistantDispatch({ type: 'answer', id, value });

      // Button-grid auto-advances after a short delay for visual feedback
      const qDef = QUESTION_DEFS[id as QuestionId];
      if (qDef?.kind === 'button-grid') {
        setTimeout(() => assistantDispatch({ type: 'next' }), 150);
      }
    },
    [],
  );

  const onNext = useCallback(() => {
    if (!isComplete) assistantDispatch({ type: 'next' });
  }, [isComplete]);

  const onBack = useCallback(() => assistantDispatch({ type: 'prev' }), []);

  const onHandoff = useCallback(() => {
    if (!state.service) return;
    const payload = buildMergePayload(state.service, state.answers);
    opts.dispatch({ type: 'merge', value: payload as Partial<WizardState> });
    assistantDispatch({ type: 'close' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [state.service, state.answers, opts.dispatch]);

  return {
    open:            state.open,
    dismissed:       state.dismissed,
    service:         state.service,
    currentQuestion,
    currentStep,
    totalSteps,
    answers:         state.answers,
    liveEstimate,
    canGoBack,
    canAdvance,
    isComplete,
    handlers: { onOpen, onClose, onDismiss, onAnswer, onNext, onBack, onHandoff },
  };
}
