import type { ServiceType, WizardState, SneakerTurnaround } from '../types';
import type { QuestionId, QuestionDef, AssistantAnswers, OptionDef } from './types';

// ─── Question sequences per service ───────────────────────────────────────────

export const QUESTION_SEQUENCES: Record<ServiceType, QuestionId[]> = {
  windows:          ['win_storeys', 'win_panes_int', 'win_panes_ext', 'win_tracks', 'win_screens'],
  cleaning:         ['clean_scope', 'clean_bedrooms', 'clean_bathrooms'],
  yard:             ['yard_scope', 'yard_size_bucket'],
  dump:             ['dump_subtype', 'dump_load_type', 'dump_load_count'],
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
      { value: 'windows',          label: 'Window Cleaning',    sublabel: 'From $79' },
      { value: 'cleaning',         label: 'Home Cleaning',      sublabel: 'From $99' },
      { value: 'yard',             label: 'Yard Care',          sublabel: 'From $79' },
      { value: 'dump',             label: 'Removal & Delivery', sublabel: 'From $99' },
      { value: 'auto',             label: 'Car Detailing',      sublabel: 'From $99' },
      { value: 'laundry_sneakers', label: 'Laundry & Sneakers', sublabel: 'From $74' },
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
      { value: 'ute',     label: 'Small load',   sublabel: 'Ute or 6×4 trailer · ~1.5 m³' },
      { value: 'trailer', label: 'Medium load',  sublabel: 'Large trailer · ~2.5 m³' },
      { value: 'bulky',   label: 'Bulky items',  sublabel: 'Couches, fridges, mattresses' },
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

  // Auto / Car detailing
  auto_rego_lookup: {
    id: 'auto_rego_lookup',
    prompt: 'Want to find your vehicle by rego?',
    hint: 'QLD rego lookup only for now. You can skip it and choose manually.',
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

// ─── Dynamic sequence filtering ────────────────────────────────────────────────

export function getActiveSequence(
  service: ServiceType,
  answers: AssistantAnswers,
): QuestionId[] {
  let seq = [...QUESTION_SEQUENCES[service]];

  if (service === 'dump') {
    const sub = answers.dump_subtype as string | undefined;
    // Delivery & Transport don't use the (loadType, loads) tuple — the load
    // details are collected in the full wizard with a different UI.
    if (sub === 'dump_delivery' || sub === 'dump_transport') {
      seq = seq.filter(
        (id) => id !== 'dump_load_type' && id !== 'dump_load_count',
      );
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
): Partial<WizardState> {
  const base: Partial<WizardState> = { service, step: 2 };

  switch (service) {
    case 'windows': {
      const storeys = Number(answers.win_storeys ?? 1);
      const int_    = Number(answers.win_panes_int ?? 12);
      const ext_    = Number(answers.win_panes_ext ?? 12);
      const tracks  = Number(answers.win_tracks    ?? 12);
      const screens = Number(answers.win_screens   ?? 0);
      return {
        ...base,
        scope: 'windows_full',
        context: 'home',
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
      return {
        ...base,
        context: 'home',
        scope,
        paramsByService: {
          cleaning: { bedrooms, bathrooms, kitchens: 1, living: 1, laundry: 0, storeys: 1 },
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
      return {
        ...base,
        context: 'home',
        scope: scopeKey,
        paramsByService: { yard: { [paramKey]: size } },
      };
    }

    case 'dump': {
      const subtype  = (answers.dump_subtype as string) ?? 'dump_runs';
      const loadType = (answers.dump_load_type as 'ute' | 'trailer' | 'bulky') ?? 'ute';
      const loads    = Number(answers.dump_load_count ?? 1);
      // Only dump_runs uses the (loadType, loads) tuple. For delivery &
      // transport the main wizard relies on its own dumpDelivery /
      // dumpTransport state, so leave those untouched here.
      if (subtype === 'dump_runs') {
        return {
          ...base,
          context: 'home',
          scope: subtype,
          dumpRun: { loadType, loads },
        };
      }
      return {
        ...base,
        context: 'home',
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
        context: 'home',
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
        return { ...base, context: 'home', scope: 'laundry', laundryLoads };
      }
      return {
        ...base,
        context: 'home',
        scope: 'sneaker_care',
        sneakerPairCount: sneakerPairs,
        sneakerTurnaround: turnaround,
      };
    }

    default:
      return base;
  }
}
