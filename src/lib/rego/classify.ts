import type {
  VehicleCategory,
  VehicleDetails,
  VehicleSizeCategory,
} from './types';

export type CarCategory = VehicleCategory | 'unknown';

type KnowledgeBase = {
  muscleModels: string[];
  luxuryMakes: string[];
  uteModels: string[];
  vanModels: string[];
  fourWdModels: string[];
  hatchHints: string[];
  suvModels: string[];
};

const KB: KnowledgeBase = {
  muscleModels: ['mustang', 'camaro', 'challenger', 'charger'],
  luxuryMakes: ['bmw', 'mercedesbenz', 'audi', 'lexus', 'porsche', 'jaguar', 'landrover', 'volvo', 'tesla'],
  uteModels: ['hilux', 'ranger', 'dmax', 'navara', 'triton', 'ram'],
  vanModels: ['carnival', 'hiace', 'transporter', 'multivan', 'express', 'trafic'],
  fourWdModels: ['landcruiser', 'prado', 'patrol', 'defender', 'landrover'],
  hatchHints: ['rio', 'yaris', 'swift', 'fiesta', 'mazda2', 'polo', 'i20', 'i30'],
  suvModels: ['forester', 'rav4', 'crv', 'xtrail', 'outlander', 'cx5', 'sportage', 'santafe', 'kluger'],
};

const PRIORITY: VehicleCategory[] = ['muscle', 'luxury', 'van', 'ute', '4wd', 'suv', 'sedan', 'hatch'];

const normalize = (value: string | null | undefined) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const includesAny = (value: string, needles: string[]) =>
  needles.some((n) => value.includes(n));

type ScoreMap = Record<VehicleCategory, number>;

function emptyScores(): ScoreMap {
  return {
    muscle: 0,
    luxury: 0,
    van: 0,
    ute: 0,
    '4wd': 0,
    suv: 0,
    sedan: 0,
    hatch: 0,
  };
}

function scoreCategories(details: Pick<VehicleDetails, 'make' | 'model' | 'bodyStyle' | 'seats'>): ScoreMap {
  const make = normalize(details.make);
  const model = normalize(details.model);
  const body = normalize(details.bodyStyle);
  const seats = typeof details.seats === 'number' ? details.seats : null;

  const scores = emptyScores();
  const isSuvBody = body.includes('suv');
  const isSedanBody = body.includes('sedan');
  const isHatchBody = body.includes('hatch');

  // Hard overrides
  if (includesAny(model, KB.muscleModels)) scores.muscle += 120;
  if (includesAny(make, KB.luxuryMakes)) scores.luxury += 90;

  // Vans: stronger than SUVs when ambiguous
  if (includesAny(model, KB.vanModels)) scores.van += 90;
  if (body.includes('van')) scores.van += 80;
  if (seats != null && seats >= 6 && !isSuvBody) scores.van += 75;

  // Utes: outrank SUVs
  if (includesAny(model, KB.uteModels)) scores.ute += 85;
  if (includesAny(body, ['utility', 'pickup', 'ute', 'cab'])) scores.ute += 80;

  // 4WD: above SUV when 7 seats or known model
  if (includesAny(model, KB.fourWdModels)) scores['4wd'] += 85;
  if (includesAny(body, ['4wd', 'awd'])) scores['4wd'] += 80;
  if (isSuvBody && seats != null && seats >= 7) scores['4wd'] += 75;

  // SUVs
  if (isSuvBody) scores.suv += 70;
  if (includesAny(model, KB.suvModels)) scores.suv += 70;
  if (body.includes('wagon')) scores.suv += 40;

  // Sedans / hatches (weakest)
  if (isSedanBody) scores.sedan += 35;
  if (isHatchBody) scores.hatch += 35;
  if (includesAny(model, KB.hatchHints)) scores.hatch += 25;

  // If body is present but not specific, give light weighting to common shapes so something ranks.
  if (!isSuvBody && !isSedanBody && !isHatchBody && body) {
    scores.sedan += 5;
    scores.hatch += 5;
  }

  return scores;
}

function resolveCategory(scores: ScoreMap): VehicleCategory | 'unknown' {
  const sorted = PRIORITY.slice().sort((a, b) => scores[b] - scores[a] || PRIORITY.indexOf(a) - PRIORITY.indexOf(b));
  const top = sorted[0];
  return scores[top] > 0 ? top : 'unknown';
}

function deriveSizeCategory(scores: ScoreMap): VehicleSizeCategory | null {
  const sizeCats: VehicleSizeCategory[] = ['van', 'ute', '4wd', 'suv', 'sedan', 'hatch'];
  const sorted = sizeCats.sort((a, b) => scores[b] - scores[a] || sizeCats.indexOf(a) - sizeCats.indexOf(b));
  const top = sorted[0];
  return scores[top] > 0 ? top : null;
}

export function classifyVehicle(
  details: Pick<VehicleDetails, 'make' | 'model' | 'bodyStyle' | 'seats'>
): { category: CarCategory; sizeCategory: VehicleSizeCategory | null } {
  const scores = scoreCategories(details);
  const category = resolveCategory(scores);
  const sizeCategory = deriveSizeCategory(scores);

  return { category, sizeCategory };
}

export function classifyVehicleCategory(
  details: Pick<VehicleDetails, 'make' | 'model' | 'bodyStyle' | 'seats'>
): CarCategory {
  return classifyVehicle(details).category;
}
