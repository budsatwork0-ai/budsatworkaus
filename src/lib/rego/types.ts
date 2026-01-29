// Buds at Work currently operates as a Queensland-only rego lookup experience.
export type RegoState = 'QLD';

export type VehicleCategory =
  | 'hatch'
  | 'sedan'
  | 'suv'
  | 'ute'
  | 'van'
  | '4wd'
  | 'luxury'
  | 'muscle';

export type VehicleSizeCategory = Exclude<VehicleCategory, 'luxury' | 'muscle'>;

export type VehicleDetails = {
  make: string;
  model: string;
  year: number | null;
  bodyStyle: string;
  doors: number | null;
  seats: number | null;
  category: VehicleCategory | 'unknown';
  sizeCategory?: VehicleSizeCategory | null;
  categorySource?: 'override' | 'rules' | 'cache';
  source?: 'override' | 'rules' | 'cache';
};
