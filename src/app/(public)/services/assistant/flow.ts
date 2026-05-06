import type { ServiceType, WizardState, SneakerTurnaround, Context } from '../types';
import type { QuestionId, QuestionDef, AssistantAnswers, OptionDef } from './types';
import { ALLOWED_SERVICES_BY_CONTEXT } from '../lib/pricing/constants';
import {
  suggestNdisCleaningHours,
  suggestNdisYardHours,
  type NdisCondition,
  type NdisYardSize,
} from '../lib/pricing/ndis';

// ─── Question sequences per service ───────────────────────────────────────────

export const QUESTION_SEQUENCES: Record<ServiceType, QuestionId[]> = {
  windows:          ['win_storeys', 'win_panes_int', 'win_panes_ext', 'win_tracks', 'win_screens'],
  cleaning:         ['clean_scope', 'clean_bedrooms', 'clean_bathrooms'],
  yard:             ['yard_scope', 'yard_size_bucket'],
  dump: [
    'dump_subtype',
    'dump_load_type',
    'dump_load_count',
    'dump_delivery_item',
    'dump_delivery_distance',
    'dump_delivery_assist',
    'dump_transport_move',
    'dump_transport_load',
    'dump_transport_stairs',
    'dump_transport_helpers',
  ],
  auto:             ['auto_rego_lookup', 'auto_vehicle_size', 'auto_service_level'],
  laundry_sneakers: ['ls_tier', 'ls_laundry_loads', 'ls_sneaker_pairs', 'ls_turnaround'],
};

// ─── Question catalogue ────────────────────────────────────────────────────────

export const QUESTION_DEFS: Record<QuestionId, QuestionDef> = {
  service_pick: {
    id: 'service_pick',
    prompt: 'What service do you need?',
    kind: 'button-grid',
    options: [
      { value: 'windows',          label: 'Window Cleaning',    sublabel: 'Homes & Small Properties' },
      { value: 'cleaning',         label: 'Home Cleaning',      sublabel: 'Houses, Units & Apartments' },
      { value: 'yard',             label: 'Yard Care',          sublabel: 'Mowing, Hedging & Tidy-Ups' },
      { value: 'dump',             label: 'Removal & Delivery', sublabel: 'Junk, Bulk Items & Deliveries' },
      { value: 'auto',             label: 'Car Detailing',      sublabel: 'Any Vehicle, At Your Place' },
      { value: 'laundry_sneakers', label: 'Laundry & Sneakers', sublabel: 'Wash, Fold & Sneaker Care' },
    ],
  },

  // Windows
  win_storeys: {
    id: 'win_storeys',
    prompt: 'How many storeys is the property?',
    kind: 'button-grid',
    options: [
      { value: '1', label: '1 storey' },
      { value: '2', label: '2 storeys' },
      { value: '3', label: '3+' },
    ],
  },
  win_panes_int: {
    id: 'win_panes_int',
    prompt: 'Approx. interior window panes?',
    hint: 'Count each individual pane of glass',
    kind: 'stepper',
    min: 0,
    max: 120,
    defaultValue: 12,
  },
  win_panes_ext: {
    id: 'win_panes_ext',
    prompt: 'Approx. exterior window panes?',
    hint: 'Panes visible from outside',
    kind: 'stepper',
    min: 0,
    max: 120,
    defaultValue: 12,
  },
  win_tracks: {
    id: 'win_tracks',
    prompt: 'How many window tracks / sills?',
    hint: 'Sliding window channels that collect dirt',
    kind: 'stepper',
    min: 0,
    max: 120,
    defaultValue: 12,
  },
  win_screens: {
    id: 'win_screens',
    prompt: 'How many fly screens?',
    kind: 'stepper',
    min: 0,
    max: 120,
    defaultValue: 0,
  },

  // Cleaning
  clean_scope: {
    id: 'clean_scope',
    prompt: 'What type of clean?',
    kind: 'button-grid',
    options: [
      { value: 'general',    label: 'Standard Clean',  sublabel: 'Regular maintenance' },
      { value: 'deep',       label: 'Deep Clean',       sublabel: 'Intensive one-off' },
      { value: 'endoflease', label: 'Move In / Out',    sublabel: 'Bond clean' },
    ],
  },
  clean_bedrooms: {
    id: 'clean_bedrooms',
    prompt: 'How many bedrooms?',
    kind: 'stepper',
    min: 1,
    max: 8,
    defaultValue: 2,
  },
  clean_bathrooms: {
    id: 'clean_bathrooms',
    prompt: 'How many bathrooms?',
    kind: 'stepper',
    min: 1,
    max: 6,
    defaultValue: 1,
  },

  // NDIS-only — appended to the cleaning sequence in NDIS context. Mirrors
  // the inputs on the wizard's Step 2 NDIS panel so handing off pre-fills
  // instead of resetting to defaults.
  clean_living_rooms: {
    id: 'clean_living_rooms',
    prompt: 'How many living rooms?',
    hint: 'Lounge, family, dining — count the open shared spaces.',
    kind: 'stepper',
    min: 0,
    max: 5,
    defaultValue: 1,
  },
  clean_condition: {
    id: 'clean_condition',
    prompt: 'What condition is the space in?',
    hint: 'Used to suggest hours — you can adjust at the next step.',
    kind: 'button-grid',
    options: [
      { value: 'tidy',     label: 'Tidy',     sublabel: 'Maintained — light touch' },
      { value: 'lived_in', label: 'Lived-in', sublabel: 'Typical ongoing support' },
      { value: 'reset',    label: 'Reset',    sublabel: 'Needs a deeper pass' },
    ],
  },

  // Yard
  yard_scope: {
    id: 'yard_scope',
    prompt: 'What yard work do you need?',
    kind: 'button-grid',
    options: [
      { value: 'yard_mow',       label: 'Lawn mowing' },
      { value: 'yard_hedge',     label: 'Hedge trim' },
      { value: 'yard_leaves',    label: 'Garden tidy / leaves' },
      { value: 'blast_and_shine',label: 'Pressure wash' },
      { value: 'gutter_clean',   label: 'Gutter clean' },
    ],
  },
  yard_size_bucket: {
    id: 'yard_size_bucket',
    prompt: 'How big is the area?',
    kind: 'button-grid',
    options: [
      { value: 'small',  label: 'Small',  sublabel: 'Courtyard, <200 m²' },
      { value: 'medium', label: 'Medium', sublabel: 'Standard yard, ~300–600 m²' },
      { value: 'large',  label: 'Large',  sublabel: 'Big yard, 800 m²+' },
      { value: 'xlarge', label: 'Very large', sublabel: 'Acreage, 1,500 m²+' },
    ],
  },

  // NDIS-only yard follow-up — same condition options as the wizard panel.
  yard_condition: {
    id: 'yard_condition',
    prompt: 'What condition is the yard in?',
    hint: 'Used to suggest hours — you can adjust at the next step.',
    kind: 'button-grid',
    options: [
      { value: 'tidy',     label: 'Tidy',     sublabel: 'Maintained — light touch' },
      { value: 'lived_in', label: 'Lived-in', sublabel: 'Typical ongoing support' },
      { value: 'reset',    label: 'Reset',    sublabel: 'Needs a deeper pass' },
    ],
  },

  // Dump / Removal
  dump_subtype: {
    id: 'dump_subtype',
    prompt: 'What type of service?',
    kind: 'button-grid',
    options: [
      { value: 'dump_runs',      label: 'Dump run',         sublabel: 'Load & dispose' },
      { value: 'dump_delivery',  label: 'Delivery',          sublabel: 'Drop-off service' },
      { value: 'dump_transport', label: 'Transport & Haul',  sublabel: 'Move items A → B' },
    ],
  },
  dump_load_type: {
    id: 'dump_load_type',
    prompt: 'How much are we clearing?',
    kind: 'button-grid',
    options: [
      { value: 'single_item',  label: 'Single item',  sublabel: 'One piece · ~0.5 m³ · quick pickup' },
      { value: 'ute',          label: 'Small load',   sublabel: 'Ute or 6×4 trailer · ~1.5 m³' },
      { value: 'half_trailer', label: 'Half trailer', sublabel: 'Box trailer ~half full · ~2 m³' },
      { value: 'trailer',      label: 'Medium load',  sublabel: 'Large trailer · ~2.5 m³' },
      { value: 'bulky',        label: 'Bulky items',  sublabel: 'Couches, fridges, mattresses' },
    ],
  },
  dump_load_count: {
    id: 'dump_load_count',
    prompt: 'How many loads?',
    kind: 'stepper',
    min: 1,
    max: 10,
    defaultValue: 1,
  },

  // Delivery
  dump_delivery_item: {
    id: 'dump_delivery_item',
    prompt: 'What are we delivering?',
    kind: 'button-grid',
    options: [
      { value: 'parcel',     label: 'Parcel',      sublabel: 'Small box, envelope' },
      { value: 'household',  label: 'Household',   sublabel: 'Furniture, appliance' },
      { value: 'mattress',   label: 'Mattress',    sublabel: 'Awkward to move' },
      { value: 'groceries',  label: 'Groceries',   sublabel: 'Bags or trolley' },
      { value: 'tools',      label: 'Tools / gear', sublabel: 'Work equipment' },
    ],
  },
  dump_delivery_distance: {
    id: 'dump_delivery_distance',
    prompt: 'How far is the drop-off?',
    hint: 'Approximate — we confirm the exact route before booking.',
    kind: 'button-grid',
    options: [
      { value: 'same_suburb', label: 'Same suburb',   sublabel: '< 5 km' },
      { value: 'drive_30',    label: '30-min drive',  sublabel: '~5–20 km' },
      { value: 'drive_60',    label: '60-min drive',  sublabel: '~20–40 km' },
      { value: 'long',        label: 'Longer trip',   sublabel: '40+ km · custom quote' },
    ],
  },
  dump_delivery_assist: {
    id: 'dump_delivery_assist',
    prompt: 'Need help carrying?',
    hint: 'Choose "help" for stairs, heavy items, or two-person lifts.',
    kind: 'button-grid',
    options: [
      { value: 'no_help',   label: 'Drop-off only',   sublabel: 'Leave at door' },
      { value: 'need_help', label: 'Help carrying',   sublabel: 'Inside, stairs, lifting' },
    ],
  },

  // Transport & Haul
  dump_transport_move: {
    id: 'dump_transport_move',
    prompt: 'What are we moving?',
    kind: 'button-grid',
    options: [
      { value: 'bedroom', label: 'A bedroom',      sublabel: 'Single room of gear' },
      { value: 'student', label: 'Student move',   sublabel: 'Boxes + a few pieces' },
      { value: 'house',   label: 'Whole house',    sublabel: 'Multi-room move' },
      { value: 'office',  label: 'Office / gear',  sublabel: 'Desks, equipment' },
      { value: 'event',   label: 'Event / venue',  sublabel: 'Set up or pack down' },
    ],
  },
  dump_transport_load: {
    id: 'dump_transport_load',
    prompt: 'How much fits?',
    hint: 'Rough guess — we confirm on arrival.',
    kind: 'button-grid',
    options: [
      { value: 'bags',       label: 'A few bags',    sublabel: 'Car boot' },
      { value: 'boot',       label: 'Boot-full',     sublabel: '~0.5 m³' },
      { value: 'small_load', label: 'Small load',    sublabel: 'Ute / small trailer' },
      { value: 'full_move',  label: 'Full move',     sublabel: 'Multi-trip or truck' },
    ],
  },
  dump_transport_stairs: {
    id: 'dump_transport_stairs',
    prompt: 'Stairs or lift?',
    kind: 'button-grid',
    options: [
      { value: 'none',    label: 'Ground floor',  sublabel: 'No stairs' },
      { value: 'one',     label: '1 flight',      sublabel: 'Short climb' },
      { value: 'multi',   label: 'Multiple flights', sublabel: '2+ levels' },
      { value: 'no_lift', label: 'No lift',       sublabel: 'Walk-up only' },
    ],
  },
  dump_transport_helpers: {
    id: 'dump_transport_helpers',
    prompt: 'Helpers needed?',
    hint: 'More helpers speeds things up and handles heavier items.',
    kind: 'button-grid',
    options: [
      { value: '1', label: '1 helper',  sublabel: 'Solo lift, light load' },
      { value: '2', label: '2 helpers', sublabel: 'Two-person lifts' },
      { value: '3', label: '3 helpers', sublabel: 'Heavy / bulky items' },
    ],
  },

  // Auto / Car detailing
  auto_rego_lookup: {
    id: 'auto_rego_lookup',
    prompt: "Let's find your vehicle by rego",
    hint: 'QLD rego only for now. This lets us match the right pricing for your exact vehicle.',
    kind: 'rego-lookup',
  },
  auto_vehicle_size: {
    id: 'auto_vehicle_size',
    prompt: 'What type of vehicle?',
    kind: 'button-grid',
    options: [
      { value: 'hatch',  label: 'Hatch' },
      { value: 'sedan',  label: 'Sedan' },
      { value: 'suv',    label: 'SUV' },
      { value: 'ute',    label: 'Ute' },
      { value: 'van',    label: 'Van' },
      { value: '4wd',    label: '4WD' },
      { value: 'luxury', label: 'Luxury' },
      { value: 'muscle', label: 'Muscle' },
    ],
  },
  auto_service_level: {
    id: 'auto_service_level',
    prompt: 'How thorough?',
    kind: 'button-grid',
    options: [
      { value: 'auto_express',  label: 'Express Detail',        sublabel: 'Wash & vacuum' },
      { value: 'auto_interior', label: 'Interior Reset',        sublabel: 'Deep inside' },
      { value: 'auto_full',     label: 'Full Signature Detail', sublabel: 'Complete inside/out' },
    ],
  },

  // Laundry & sneakers
  ls_tier: {
    id: 'ls_tier',
    prompt: 'Laundry or sneakers?',
    kind: 'button-grid',
    options: [
      { value: 'laundry',      label: 'Laundry',      sublabel: 'Wash, dry & fold' },
      { value: 'sneaker_care', label: 'Sneaker Care', sublabel: 'Professional clean' },
    ],
  },
  ls_laundry_loads: {
    id: 'ls_laundry_loads',
    prompt: 'How many loads?',
    hint: '~5kg per load',
    kind: 'stepper',
    min: 1,
    max: 10,
    defaultValue: 1,
  },
  ls_sneaker_pairs: {
    id: 'ls_sneaker_pairs',
    prompt: 'How many pairs?',
    kind: 'stepper',
    min: 1,
    max: 10,
    defaultValue: 2,
  },
  ls_turnaround: {
    id: 'ls_turnaround',
    prompt: 'Turnaround speed?',
    kind: 'button-grid',
    options: [
      { value: 'standard', label: 'Standard', sublabel: '3–5 days' },
      { value: 'express',  label: 'Express',  sublabel: '+$5/pair' },
      { value: 'priority', label: 'Priority', sublabel: '+$10/pair' },
    ],
  },
};

// ─── Context-aware service picker ──────────────────────────────────────────────

// Per-context copy for the service picker. Commercial and NDIS each need a
// different opening prompt, hint, and service sub-labels (pricing + framing
// differ from home). The options are filtered to ALLOWED_SERVICES_BY_CONTEXT
// so users only see services that are actually bookable in their context.

type ServiceOptionCopy = Partial<Record<ServiceType, { label: string; sublabel: string }>>;

const HOME_COPY: ServiceOptionCopy = {
  windows:          { label: 'Window Cleaning',    sublabel: 'From $79' },
  cleaning:         { label: 'Home Cleaning',      sublabel: 'From $99' },
  yard:             { label: 'Yard Care',          sublabel: 'From $79' },
  dump:             { label: 'Removal & Delivery', sublabel: 'From $105' },
  auto:             { label: 'Car Detailing',      sublabel: 'From $99' },
  laundry_sneakers: { label: 'Laundry & Sneakers', sublabel: 'From $74' },
};

const COMMERCIAL_COPY: ServiceOptionCopy = {
  windows:  { label: 'Commercial Windows', sublabel: 'Offices, shopfronts, medical' },
  cleaning: { label: 'Commercial Cleaning', sublabel: 'Office, retail, hospitality' },
  yard:     { label: 'Grounds & Exterior',  sublabel: 'Property maintenance' },
};

const NDIS_COPY: ServiceOptionCopy = {
  cleaning: { label: 'NDIS Cleaning', sublabel: 'Plan, self, or agency-managed' },
  yard:     { label: 'NDIS Yard Care', sublabel: 'Supported yard maintenance' },
};

const CONTEXT_COPY: Record<Context, ServiceOptionCopy> = {
  home: HOME_COPY,
  commercial: COMMERCIAL_COPY,
  ndis: NDIS_COPY,
};

const CONTEXT_PROMPT: Record<Context, { prompt: string; hint?: string }> = {
  home: {
    prompt: 'What service do you need?',
  },
  commercial: {
    prompt: 'What commercial service do you need?',
    hint: 'We quote commercial at a small uplift to cover access, insurance, and invoicing.',
  },
  ndis: {
    prompt: 'Which NDIS service do you need?',
    hint: 'We support plan, self, and agency-managed participants — via our MaluCare partnership.',
  },
};

/**
 * Build the service-picker question for the given context.
 * Filters options to ALLOWED_SERVICES_BY_CONTEXT and swaps copy so the
 * wording matches the current flow (home / commercial / NDIS).
 */
export function getServicePickQuestion(context: Context): QuestionDef {
  const allowed = ALLOWED_SERVICES_BY_CONTEXT[context];
  const copy = CONTEXT_COPY[context];
  const { prompt, hint } = CONTEXT_PROMPT[context];

  const options: OptionDef[] = [];
  for (const svc of allowed) {
    const c = copy[svc] ?? HOME_COPY[svc];
    if (c) options.push({ value: svc, label: c.label, sublabel: c.sublabel });
  }

  return {
    id: 'service_pick',
    prompt,
    hint,
    kind: 'button-grid',
    options,
  };
}

const CONTEXT_QUESTION_OVERRIDES: Partial<
  Record<Context, Partial<Record<QuestionId, Partial<QuestionDef>>>>
> = {
  commercial: {
    clean_scope: {
      prompt: 'What commercial clean do you need?',
      hint: 'Pick the closest fit — we will confirm access, frequency, and site requirements before work begins.',
      options: [
        { value: 'general', label: 'Routine site clean', sublabel: 'Office, retail, hospitality' },
        { value: 'deep', label: 'Detailed clean', sublabel: 'High-touch or catch-up clean' },
        { value: 'endoflease', label: 'Site reset', sublabel: 'Move-out, handover, or reopening' },
      ],
    },
    clean_bedrooms: {
      prompt: 'How many main work areas?',
      hint: 'Use rooms, zones, or sections as a rough size guide.',
      defaultValue: 3,
    },
    clean_bathrooms: {
      prompt: 'How many restrooms?',
      defaultValue: 1,
    },
    yard_scope: {
      prompt: 'What exterior maintenance do you need?',
      options: [
        { value: 'yard_mow', label: 'Lawn mowing', sublabel: 'Verges, lawns, common areas' },
        { value: 'yard_hedge', label: 'Hedge trim', sublabel: 'Frontage and boundary lines' },
        { value: 'yard_leaves', label: 'Grounds tidy', sublabel: 'Leaves, weeds, light debris' },
        { value: 'blast_and_shine', label: 'Pressure wash', sublabel: 'Paths, entries, hard surfaces' },
        { value: 'gutter_clean', label: 'Gutter clean', sublabel: 'Low-rise commercial' },
      ],
    },
    yard_size_bucket: {
      prompt: 'How large is the area?',
      hint: 'An estimate is fine — we can adjust after reviewing access and site photos.',
    },
  },
  ndis: {
    clean_scope: {
      prompt: 'What household-task support is needed?',
      hint: 'This helps us prepare a clear quote for plan, self, or agency-managed support.',
      options: [
        { value: 'general', label: 'Regular support clean', sublabel: 'Ongoing household tasks' },
        { value: 'deep', label: 'Deep support clean', sublabel: 'Heavier one-off reset' },
        { value: 'endoflease', label: 'Move support clean', sublabel: 'Entry, exit, or tenancy change' },
      ],
    },
    clean_bedrooms: {
      prompt: 'How many bedrooms are in the home?',
      hint: 'Used only to estimate the support hours before review.',
    },
    clean_bathrooms: {
      prompt: 'How many bathrooms?',
    },
    yard_scope: {
      prompt: 'What yard support is needed?',
      hint: 'We keep the quote clear so it can be routed to the right NDIS contact.',
      options: [
        { value: 'yard_mow', label: 'Lawn mowing', sublabel: 'Routine yard maintenance' },
        { value: 'yard_hedge', label: 'Hedge trim', sublabel: 'Light pruning and shaping' },
        { value: 'yard_leaves', label: 'Garden tidy', sublabel: 'Leaves, weeds, light debris' },
        { value: 'gutter_clean', label: 'Gutter clean', sublabel: 'If suitable and accessible' },
      ],
    },
    yard_size_bucket: {
      prompt: 'How big is the yard area?',
      hint: 'Choose the closest size. We will confirm suitability before booking.',
    },
  },
};

export function getContextualQuestion(id: QuestionId, context: Context): QuestionDef {
  if (id === 'service_pick') return getServicePickQuestion(context);

  const base = QUESTION_DEFS[id];
  const override = CONTEXT_QUESTION_OVERRIDES[context]?.[id];
  return override ? { ...base, ...override, id: base.id, kind: base.kind } : base;
}

// ─── Dynamic sequence filtering ────────────────────────────────────────────────

export function getActiveSequence(
  service: ServiceType,
  answers: AssistantAnswers,
  context: Context = 'home',
): QuestionId[] {
  let seq = [...QUESTION_SEQUENCES[service]];

  // NDIS context: append the inputs the wizard's hourly suggester needs so
  // the assistant captures them up front (instead of resetting to defaults
  // when the user lands on Step 2).
  if (context === 'ndis') {
    if (service === 'cleaning') {
      seq = [...seq, 'clean_living_rooms', 'clean_condition'];
    } else if (service === 'yard') {
      seq = [...seq, 'yard_condition'];
    }
  }

  if (service === 'dump') {
    const sub = answers.dump_subtype as string | undefined;
    const deliveryOnly: QuestionId[] = [
      'dump_delivery_item',
      'dump_delivery_distance',
      'dump_delivery_assist',
    ];
    const transportOnly: QuestionId[] = [
      'dump_transport_move',
      'dump_transport_load',
      'dump_transport_stairs',
      'dump_transport_helpers',
    ];
    const runsOnly: QuestionId[] = ['dump_load_type', 'dump_load_count'];

    if (sub === 'dump_delivery') {
      seq = seq.filter((id) => !runsOnly.includes(id) && !transportOnly.includes(id));
    } else if (sub === 'dump_transport') {
      seq = seq.filter((id) => !runsOnly.includes(id) && !deliveryOnly.includes(id));
    } else {
      // Default (dump_runs or before picking): hide delivery & transport branches.
      seq = seq.filter((id) => !deliveryOnly.includes(id) && !transportOnly.includes(id));
    }
  }

  if (service === 'auto') {
    const detectedCategory = String(answers.auto_vehicle_size ?? '').trim();
    if (answers.auto_rego_lookup === 'detected' && detectedCategory) {
      seq = seq.filter((id) => id !== 'auto_vehicle_size');
    }
  }

  if (service === 'laundry_sneakers') {
    const tier = answers.ls_tier as string | undefined;
    if (tier === 'laundry') {
      seq = seq.filter((id) => id !== 'ls_sneaker_pairs' && id !== 'ls_turnaround');
    } else if (tier === 'sneaker_care') {
      seq = seq.filter((id) => id !== 'ls_laundry_loads');
    }
  }

  return seq;
}

// ─── Size bucket → numeric param ───────────────────────────────────────────────

// Size bucket → representative m² (mid-point of each bucket label).
// For hedge/gutter scopes these values are interpreted as metres of perimeter
// instead, so the numbers below are deliberately small for those two.
const YARD_SIZE_MAP: Record<string, number> = {
  small: 120,
  medium: 450,
  large: 1000,
  xlarge: 1800,
};

// Hedge and gutter are priced per metre of perimeter, not per m². Buckets map
// to representative linear metres so the assistant's rough quote lands near
// the real per-metre price.
const YARD_PERIMETER_SIZE_MAP: Record<string, number> = {
  small: 12,
  medium: 35,
  large: 80,
  xlarge: 150,
};

const YARD_PARAM_KEY: Partial<Record<string, string>> = {
  yard_mow:       'lawn_m2',
  yard_leaves:    'leaves_area',
  blast_and_shine:'blast_m2',
  yard_hedge:     'hedge_m',
  gutter_clean:   'gutter_m',
};

const VEHICLE_SIZE_MAP: Record<string, number> = {
  hatch: 1,
  sedan: 2,
  suv: 3,
  ute: 4,
  van: 5,
  '4wd': 6,
  luxury: 2,
  muscle: 2,
};

function readNullableNumber(value: string | number | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// ─── Merge payload builder ─────────────────────────────────────────────────────

export function buildMergePayload(
  service: ServiceType,
  answers: AssistantAnswers,
  context: Context = 'home',
): Partial<WizardState> {
  const base: Partial<WizardState> = { service, step: 2, context };

  switch (service) {
    case 'windows': {
      const storeys = Number(answers.win_storeys ?? 1);
      const int_    = Number(answers.win_panes_int ?? 12);
      const ext_    = Number(answers.win_panes_ext ?? 12);
      const tracks  = Number(answers.win_tracks    ?? 12);
      // Commercial sites rarely have fly screens on office/shopfront glazing —
      // default to 0 so the assistant doesn't quote something that isn't there.
      const defaultScreens = context === 'commercial' ? 0 : 0;
      const screens = Number(answers.win_screens   ?? defaultScreens);
      return {
        ...base,
        scope: 'windows_full',
        winStoreys: storeys,
        winRows: [{ int: int_, ext: ext_, tracks, screens, label: 'Ground floor' }],
        paramsByService: { windows: { panes_int: int_, panes_ext: ext_, tracks, screens } },
      };
    }

    case 'cleaning': {
      const scopeMap: Record<string, string> = {
        general: 'general',
        deep: 'deep',
        endoflease: 'endoflease',
      };
      const scope    = scopeMap[answers.clean_scope as string] ?? 'general';
      const bedrooms  = Number(answers.clean_bedrooms  ?? 2);
      const bathrooms = Number(answers.clean_bathrooms ?? 1);
      const living    = Number(answers.clean_living_rooms ?? 1);

      // NDIS: pre-fill Step 2 panel inputs so the wizard's hourly suggester
      // matches the assistant's live estimate exactly. Without this the user
      // sees one number in the assistant and a different one on Step 2.
      if (context === 'ndis') {
        const condition = (answers.clean_condition as NdisCondition) ?? 'lived_in';
        const ndisHours = suggestNdisCleaningHours(bedrooms, bathrooms, living, condition);
        return {
          ...base,
          scope,
          paramsByService: {
            cleaning: { bedrooms, bathrooms, kitchens: 1, living, laundry: 0, storeys: 1 },
          },
          ndisPropertyBedrooms: bedrooms,
          ndisPropertyBathrooms: bathrooms,
          ndisPropertyLiving: living,
          ndisCondition: condition,
          ndisEstimatedHours: ndisHours,
          ndisHoursOrigin: 'suggested',
        };
      }

      return {
        ...base,
        scope,
        paramsByService: {
          cleaning: { bedrooms, bathrooms, kitchens: 1, living, laundry: 0, storeys: 1 },
        },
      };
    }

    case 'yard': {
      const scopeKey = (answers.yard_scope as string) ?? 'yard_mow';
      const paramKey = YARD_PARAM_KEY[scopeKey] ?? 'lawn_m2';
      const bucket   = answers.yard_size_bucket as string;
      // Hedge + gutter are measured in metres of perimeter, so pick from the
      // perimeter bucket map. Everything else is m² of area.
      const isPerimeterScope = scopeKey === 'yard_hedge' || scopeKey === 'gutter_clean';
      const size = isPerimeterScope
        ? (YARD_PERIMETER_SIZE_MAP[bucket] ?? 30)
        : (YARD_SIZE_MAP[bucket] ?? 450);

      // NDIS: pricing is hours × Price Guide rate, not m² × yard rates. Carry
      // the size bucket and condition forward so the wizard's NDIS Step 2
      // panel can pre-fill and show the same number the assistant just did.
      if (context === 'ndis') {
        const sizeBucket = (['small', 'medium', 'large', 'xlarge'].includes(bucket)
          ? bucket
          : 'medium') as NdisYardSize;
        const condition = (answers.yard_condition as NdisCondition) ?? 'lived_in';
        const ndisHours = suggestNdisYardHours(sizeBucket, condition);
        return {
          ...base,
          scope: scopeKey,
          paramsByService: { yard: { [paramKey]: size } },
          ndisYardSize: sizeBucket,
          ndisCondition: condition,
          ndisEstimatedHours: ndisHours,
          ndisHoursOrigin: 'suggested',
        };
      }

      return {
        ...base,
        scope: scopeKey,
        paramsByService: { yard: { [paramKey]: size } },
      };
    }

    case 'dump': {
      const subtype  = (answers.dump_subtype as string) ?? 'dump_runs';
      const loadType =
        (answers.dump_load_type as
          | 'single_item'
          | 'ute'
          | 'half_trailer'
          | 'trailer'
          | 'bulky') ?? 'ute';
      const loads    = Number(answers.dump_load_count ?? 1);

      if (subtype === 'dump_runs') {
        return {
          ...base,
          scope: subtype,
          dumpRun: { loadType, loads },
        };
      }

      if (subtype === 'dump_delivery') {
        const itemType =
          (answers.dump_delivery_item as
            | 'parcel'
            | 'household'
            | 'mattress'
            | 'groceries'
            | 'tools'
            | undefined) ?? 'household';
        const distance =
          (answers.dump_delivery_distance as
            | 'same_suburb'
            | 'drive_30'
            | 'drive_60'
            | 'long'
            | undefined) ?? 'same_suburb';
        const assist =
          (answers.dump_delivery_assist as 'no_help' | 'need_help' | undefined) ?? 'no_help';
        return {
          ...base,
          scope: subtype,
          dumpDelivery: {
            itemType,
            distance,
            assist,
          },
        };
      }

      if (subtype === 'dump_transport') {
        const moveType =
          (answers.dump_transport_move as
            | 'house'
            | 'bedroom'
            | 'student'
            | 'office'
            | 'event'
            | undefined) ?? 'bedroom';
        const loadSize =
          (answers.dump_transport_load as
            | 'bags'
            | 'boot'
            | 'small_load'
            | 'full_move'
            | undefined) ?? 'small_load';
        const stairs =
          (answers.dump_transport_stairs as
            | 'none'
            | 'one'
            | 'multi'
            | 'no_lift'
            | undefined) ?? 'none';
        const helpersRaw = Number(answers.dump_transport_helpers ?? 1);
        const helpers: 1 | 2 | 3 =
          helpersRaw >= 3 ? 3 : helpersRaw >= 2 ? 2 : 1;
        return {
          ...base,
          scope: subtype,
          dumpTransport: {
            moveType,
            loadSize,
            stairs,
            helpers,
          },
        };
      }

      return {
        ...base,
        scope: subtype,
      };
    }

    case 'auto': {
      const vehicleKey   = (answers.auto_vehicle_size as string) ?? 'sedan';
      const vehicle_size = VEHICLE_SIZE_MAP[vehicleKey] ?? 2;
      const scope        = (answers.auto_service_level as string) ?? 'auto_express';
      const autoParams =
        scope === 'auto_express'
          ? { vehicle_size, rows: 0, child_seats: 0 }
          : { vehicle_size, rows: 2, child_seats: 0 };
      const detectedMake = String(answers.auto_detected_make ?? '').trim();
      const detectedModel = String(answers.auto_detected_model ?? '').trim();
      const detectedVehicle =
        detectedMake && detectedModel
          ? {
              make: detectedMake,
              model: detectedModel,
              year: readNullableNumber(answers.auto_detected_year),
              bodyStyle: String(answers.auto_detected_body_style ?? ''),
              doors: readNullableNumber(answers.auto_detected_doors),
              seats: readNullableNumber(answers.auto_detected_seats),
            }
          : null;

      return {
        ...base,
        scope,
        carModelType: vehicleKey,
        carDetectedVehicle: detectedVehicle,
        carDetectedSizeCategory: String(answers.auto_detected_size_category ?? '').trim() || null,
        carDetectedYear: readNullableNumber(answers.auto_detected_year),
        paramsByService: { auto: autoParams },
      };
    }

    case 'laundry_sneakers': {
      const tier        = (answers.ls_tier as string) ?? 'laundry';
      const laundryLoads = Number(answers.ls_laundry_loads ?? 1);
      const sneakerPairs = Number(answers.ls_sneaker_pairs ?? 2);
      const turnaround  = (answers.ls_turnaround as SneakerTurnaround) ?? 'standard';
      if (tier === 'laundry') {
        return { ...base, scope: 'laundry', laundryLoads };
      }
      return {
        ...base,
        scope: 'sneaker_care',
        sneakerPairCount: sneakerPairs,
        sneakerTurnaround: turnaround,
      };
    }

    default:
      return base;
  }
}
