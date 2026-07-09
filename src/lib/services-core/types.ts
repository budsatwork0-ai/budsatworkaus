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

export type CoreContext = 'home' | 'commercial' | 'ndis';
export type CoreServiceType = 'windows' | 'cleaning' | 'yard' | 'dump' | 'auto' | 'laundry_sneakers';
export type CoreLaundryPerLoadAddOn = 'eco_detergent' | 'extra_rinse' | 'whites_brightening';
export type CoreLaundryPerOrderAddOn = 'hygiene_sanitise' | 'express_turnaround';
export type CoreIroningItemType = 'standard' | 'business_shirt' | 'complex';
export type CoreSneakerTurnaround = 'standard' | 'express' | 'priority';
export type CoreTravelBand = 'same_suburb' | 'drive_30' | 'drive_60' | 'long';
export type CoreWindowContextPrice = { pane: number; track: number; screen?: number };
export type CoreSneakerTurnaroundMeta = {
  key: CoreSneakerTurnaround;
  label: string;
  window: string;
  surcharge: number;
  queuePriority: number;
  capacity: number;
};
