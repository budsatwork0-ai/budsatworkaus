// Core service types
export type Context = 'home' | 'commercial' | 'ndis';
export type ServiceType = 'windows' | 'cleaning' | 'yard' | 'dump' | 'auto' | 'laundry_sneakers';
export type ScopeKey = string;
export type NdisManagementType = 'plan_managed' | 'self_managed' | 'agency_managed';

// Laundry & Sneaker Care types
export type LaundryTier = 'wash_fold';
export type LaundryPerLoadAddOn = 'eco_detergent' | 'extra_rinse' | 'whites_brightening';
export type LaundryPerOrderAddOn = 'hygiene_sanitise' | 'express_turnaround';
export type IroningItemType = 'standard' | 'business_shirt' | 'complex';
export type IroningItem = { type: IroningItemType; count: number };
export type SneakerTier = 'refresh' | 'deep' | 'multi';

// Frequency and selections
export type CommFrequency = 'none' | 'daily' | '3x_weekly' | 'weekly' | 'fortnightly';
export type NumericParams = Record<string, number | undefined>;

// Service-specific types
export type SneakerTurnaround = 'standard' | 'express' | 'priority';
export type YardJobStatus = 'draft' | 'completed';

export type YardJob = {
  job_id: string;
  address: string;
  area_m2: number | null;
  polygon_geojson: { lat: number; lng: number }[][]; // LatLng type from usePolygonQuote
  condition: 'maintained' | 'moderate' | 'overgrown'; // YardCondition from usePolygonQuote
  terrain: 'flat' | 'moderate' | 'challenging'; // YardTerrain from usePolygonQuote
  price: number;
  status: YardJobStatus;
  created_at: string;
};

export type MmmDetectionState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'detected'; label: string }
  | { status: 'failed'; message: string };

export type MmmApiResponse = {
  rawMMM: number;
  pricingRegion: 'metro' | 'regional' | 'remote' | 'veryRemote';
  label: string;
  geocode?: {
    address: string;
    lat: number;
    lng: number;
    score: number;
  };
};

export type Task = {
  code: string;
  service: ServiceType;
  name: string;
  unit: string;
  minutes: number;
  p10?: number;
  median?: number;
  p90?: number;
};

// Dump service types
export type DeliverySelection = {
  itemType: 'parcel' | 'household' | 'mattress' | 'groceries' | 'tools' | null;
  distance: 'same_suburb' | 'drive_30' | 'drive_60' | 'long';
  assist: 'no_help' | 'need_help';
  extraStops?: number;
  priority?: boolean;
  stairsAtDropoff?: boolean;
};

export type TransportSelection = {
  moveType: 'house' | 'bedroom' | 'student' | 'office' | 'event';
  stairs: 'none' | 'one' | 'multi' | 'no_lift';
  loadSize: 'bags' | 'boot' | 'small_load' | 'full_move';
  helpers?: 1 | 2 | 3;
  urgent?: boolean;
  afterHours?: boolean;
};

export type DumpRunSelection = {
  loadType: 'single_item' | 'ute' | 'half_trailer' | 'trailer' | 'bulky' | null;
  loads: number;
};

export type DumpTier = 'small' | 'medium' | 'large';

// Route types
export type RouteLocation = {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
};

export type RouteLookupResult = {
  distanceKm: number;
  durationMinutes: number;
};

export type RouteScopeKey = 'dump_delivery' | 'dump_transport';
export type TravelBand = DeliverySelection['distance'];

// Quote types
export type Selected = Record<string, number>;

export type QuoteParams = {
  context: Context;
  currentService: ServiceType;
  currentScope: ScopeKey;
  selected: Selected;
  distanceKm: number;
  paidParking: boolean;
  tipFee: number;
  conditionMult: number;
  conditionLevel?: 'light' | 'standard' | 'heavy';
  flags: { petHair: boolean; greaseSoap: boolean; clutterAccess: boolean; secondStorey: boolean };
  windowsStoreys?: number;
  commercialUplift: number;
  sizeAdjust: 'small' | 'standard' | 'large';
  conditionFlat: number;
  contractDiscount: number;
  commercialType: CommercialCleaningType | null;
  commPreset?: 'essential' | 'standard' | 'intensive';
  autoCategory?: string; // CarType
  autoSizeCategory?: string | null; // VehicleSizeCategory
  autoYear?: number | null;
  sneakerTurnaround?: SneakerTurnaround;
  afterHours: boolean;
  bottleCount?: number;
  dumpRunSelection?: DumpRunSelection;
  dumpDeliverySelection?: DeliverySelection;
  dumpTransportSelection?: TransportSelection;
  dumpIsNonResident?: boolean;
  cleaningParams?: NumericParams;
  yardParams?: NumericParams;
  windowsMinutesOverride?: number;
  windowsStoreysOverride?: number;
  commFrequency?: CommFrequency;
};

// Pricing types
export type WindowContextPrice = { pane: number; track: number; screen?: number };

export type SneakerTurnaroundMeta = {
  key: SneakerTurnaround;
  label: string;
  window: string;
  surcharge: number;
  queuePriority: number;
  capacity: number;
};

// Scopes
export type ScopeDef = {
  key: ScopeKey;
  label: string;
  inclusions: string[];
  desc?: string;
  helper?: boolean;
};

// Cleaning types
export type ImpactLevel = 'light' | 'medium' | 'heavy' | 'detail' | 'organising';

export type MicroPreset = {
  id: string;
  label: string;
  description: string;
  matchers: RegExp[];
};

export type YardMeasurementMode = 'area' | 'perimeter';

export type YardMeasurementConfig = {
  mode: YardMeasurementMode;
  field: string;
  label: string;
};

// Parameters
export type ParamDef = {
  key: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue: number;
  suffix?: string;
};

export type ParamTable = Record<ServiceType, ParamDef[]>;

export type CommParamDef = {
  key: 'sqm' | 'workstations' | 'restrooms' | 'break_rooms' | 'floors' | 'high_traffic';
  label: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue: number;
  suffix?: string;
};

export type CommercialCleaningType =
  | 'office'
  | 'medical'
  | 'fitness'
  | 'hospitality'
  | 'education'
  | 'event'
  | 'accommodation';

export type CommMeta = { title: string; covers: string; avg: string; reason: string };

export type StoreyRow = { int: number; ext: number; tracks: number; screens: number; label?: string };

export type SSKind = 'general' | 'deep' | 'endoflease';

export type CleanScopeKind = 'weekly' | 'general' | 'inspection' | 'deep' | 'endoflease' | 'hourly';

export type CleanScopeKindV2 = CleanScopeKind;

export type ExtraRule = { minutes: number; cost: number };
export type ExtraRules = Partial<
  Record<'bedrooms' | 'bathrooms' | 'kitchens' | 'laundry' | 'living' | 'storeys', ExtraRule>
>;

export type YardQuoteOptions = {
  context?: Context;
  terrain?: 'flat' | 'moderate' | 'challenging';
  condition?: 'maintained' | 'moderate' | 'overgrown';
};

export type ServiceEstimate = {
  time: string | null;
  price: string | null;
  priceMin: number | null;
  priceMax: number | null;
};

export type SelMap = Record<string, string[]>;

// Wizard state
export type WizardState = {
  step: 1 | 2 | 3;
  context: Context;
  service: ServiceType;
  scope: ScopeKey;
  paramsByService: Record<string, NumericParams>;
  cleaningAddons: Record<string, Record<string, number>>;
  distanceKm: number;
  paidParking: boolean;
  tipFee: number;
  dumpRun: DumpRunSelection;
  dumpDelivery: DeliverySelection;
  dumpTransport: TransportSelection;
  dumpRoutePickupQuery: string;
  dumpRouteDropoffQuery: string;
  dumpRoutePickup: RouteLocation | null;
  dumpRouteDropoff: RouteLocation | null;
  conditionLevel: 'light' | 'standard' | 'heavy';
  afterHours: boolean;
  sizeAdjust: 'small' | 'standard' | 'large';
  conditionFlat: 0 | 20 | 35 | 50;
  contractDiscount: 0 | 0.1 | 0.15;
  petHair: boolean;
  greaseSoap: boolean;
  clutterAccess: boolean;
  secondStorey: boolean;
  photosOK: boolean;
  preferredAvailability: string[];
  yardMeasureRequested: boolean;
  commSecurityInduction: boolean;
  commClientConsumables: boolean;
  commPriorityNotes: string;
  commFrequency: CommFrequency;
  commPriorityZones: string[];
  commAccessNotes: string;
  commPreset: 'essential' | 'standard' | 'intensive';
  selectedInclusions: Record<string, string[]>;
  winStoreys: number;
  winRows: { int: number; ext: number; tracks: number; screens: number; label?: string }[];
  winSessionSeg: { int: boolean; ext: boolean; tracks: boolean } | null;
  commercialUplift: number;
  commercialCleaningType: CommercialCleaningType | null;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  region: string;
  companyName: string;
  abn: string;
  isBusinessExpense: boolean;
  ndisManagementType: NdisManagementType | null;
  ndisForwardContactName: string;
  ndisForwardEmail: string;
  /** Estimated hours selected in the NDIS hourly Step 2 (cleaning or yard). */
  ndisEstimatedHours: number;
  /** Where the NDIS hours came from — 'suggested' (auto) or 'manual' (user override). */
  ndisHoursOrigin: 'suggested' | 'manual';
  /** Property size input for NDIS hours suggester (cleaning). */
  ndisPropertyBedrooms: number;
  ndisPropertyBathrooms: number;
  ndisPropertyLiving: number;
  /**
   * Optional extra-room counts surfaced in the NDIS Step 2 panel.
   * Default to 1/1/1 when absent so historical state migrates cleanly.
   */
  ndisPropertyKitchens: number;
  ndisPropertyLaundry: number;
  ndisPropertyStoreys: number;
  /** Yard size input for NDIS hours suggester. */
  ndisYardSize: 'small' | 'medium' | 'large' | 'xlarge';
  /** Condition of the space that drives the hours multiplier. */
  ndisCondition: 'tidy' | 'lived_in' | 'reset';
  /**
   * NDIS Price Guide rate slot. Defaults to weekday daytime. Surfaces the
   * Saturday / Sunday / public-holiday differentials so the quote reflects
   * the actual cap that the plan manager will see on the invoice.
   */
  ndisRateSlot: 'weekday_day' | 'saturday' | 'sunday' | 'public_holiday';
  /** MMM region (metro/regional/remote/very_remote) — affects rate cap. */
  ndisRegion: 'metro' | 'regional' | 'remote' | 'very_remote';
  /** Whether the NDIS MMM region is address-detected or manually chosen. */
  ndisRegionSource: 'auto' | 'manual';
  notes: string;
  yardPolygon: { lat: number; lng: number }[][];
  yardArea: number | null;
  yardPerimeter: number | null;
  yardJobs: YardJob[];
  yardActiveJobId: string | null;
  floorPlanLayout: string;
  floorPlanEstimate: any | null; // FloorPlanPricing type from floor plan module
  carModelType: string; // CarType from useCarModelSelector
  carModelZones: any[]; // CarZone[] from useCarModelSelector
  carDirtLevel: number;
  carModelPriceImpact: number;
  carDetectedVehicle: {
    make: string;
    model: string;
    year: number | null;
    bodyStyle: string;
    doors: number | null;
    seats: number | null;
  } | null;
  carDetectedSizeCategory: string | null; // VehicleSizeCategory
  carDetectedYear: number | null;
  sneakerTurnaround: SneakerTurnaround;
  // Laundry & Sneaker Care
  laundryTier: LaundryTier;
  laundryLoads: number;
  laundryPerLoadAddOns: LaundryPerLoadAddOn[];
  laundryPerOrderAddOns: LaundryPerOrderAddOn[];
  laundryIroningItems: IroningItem[];
  sneakerTier: SneakerTier;
  sneakerPairCount: number;
};

export type CleaningWizardChecklistState = {
  propertySize: 'studio' | '1-2' | '3-4' | '5+';
  bathrooms: 1 | 2 | 3;
  messLevel: 'tidy' | 'lived-in' | 'reset';
  addOns: { oven: boolean; fridge: boolean; windows: boolean; cupboards: boolean; walls: boolean };
  scope: ScopeKey;
};

export type Action =
  | { type: 'set'; key: keyof WizardState; value: WizardState[keyof WizardState] }
  | { type: 'merge'; value: Partial<WizardState> }
  | { type: 'reset' };

// Props types
export type DistanceConfiguratorProps = {
  distanceKm: number;
  onChange: (km: number) => void;
  paidParking: boolean;
  onParkingChange: (paid: boolean) => void;
};
