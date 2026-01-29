import { FloorItem, FloorLayout, FurnitureShape, FurnitureType, RoomShape, RoomType, toLayout } from './useFloorPlan';

export type FloorPlanPricing = {
  rawMinutes: number;
  adjustedHours: number;
  billableHours: number;
  price: number;
  counts: {
    bedrooms: number;
    bathrooms: number;
    kitchens: number;
    living: number;
    laundry: number;
    otherRooms: number;
    totalRooms: number;
    furniture: Record<FurnitureType, number>;
    clutter: number;
  };
};

const ROOM_MINUTES: Record<RoomType, number> = {
  bedroom: 20,
  bathroom: 30,
  kitchen: 40,
  laundry: 15,
  living: 25,
  hallway: 10,
  other: 0,
};

const FURNITURE_MINUTES: Record<FurnitureType, number> = {
  bed: 6,
  sofa: 8,
  table: 5,
  desk: 5,
  wardrobe: 0,
  toilet: 8,
  shower: 10,
  fridge: 15,
  oven: 20,
  window: 4,
  clutter: 3,
  other: 0,
};

const HOURLY_RATE = 60;
const MIN_BILLABLE_HOURS = 3;

const clampHourCeil = (hours: number) => Math.max(MIN_BILLABLE_HOURS, Math.ceil(hours));

export function computeFloorPricing(input: FloorItem[] | FloorLayout): FloorPlanPricing {
  const layout: FloorLayout = Array.isArray(input) ? toLayout(input) : input;
  const rooms = layout.rooms || [];
  const furniture = layout.furniture || [];

  const roomCount = (type: RoomType) => rooms.filter((r) => r.roomType === type).length;
  const furnitureCount = (type: FurnitureType) => furniture.filter((f) => f.furnitureType === type).length;

  const bedrooms = roomCount('bedroom');
  const bathrooms = roomCount('bathroom');
  const kitchens = roomCount('kitchen');
  const living = roomCount('living');
  const laundry = roomCount('laundry');
  const otherRooms = rooms.length - (bedrooms + bathrooms + kitchens + living + laundry);

  const roomMinutes = rooms.reduce((acc, r: RoomShape) => acc + (ROOM_MINUTES[r.roomType] ?? 0), 0);
  const furnitureMinutes = furniture.reduce(
    (acc, f: FurnitureShape) => acc + (FURNITURE_MINUTES[f.furnitureType] ?? 0),
    0
  );

  const clutterCount = furnitureCount('clutter');
  const clutterMultiplier = clutterCount > 10 ? 1.5 : clutterCount > 5 ? 1.25 : 1;

  const rawMinutes = (roomMinutes + furnitureMinutes) * clutterMultiplier;
  const adjustedHours = rawMinutes / 60;
  const billableHours = clampHourCeil(adjustedHours);
  const price = billableHours * HOURLY_RATE;

  const counts: FloorPlanPricing['counts'] = {
    bedrooms,
    bathrooms,
    kitchens,
    living,
    laundry,
    otherRooms,
    totalRooms: rooms.length,
    furniture: {
      bed: furnitureCount('bed'),
      sofa: furnitureCount('sofa'),
      table: furnitureCount('table'),
      desk: furnitureCount('desk'),
      wardrobe: furnitureCount('wardrobe'),
      toilet: furnitureCount('toilet'),
      shower: furnitureCount('shower'),
      fridge: furnitureCount('fridge'),
      oven: furnitureCount('oven'),
      window: furnitureCount('window'),
      clutter: clutterCount,
      other: furnitureCount('other'),
    },
    clutter: clutterCount,
  };

  return { rawMinutes, adjustedHours, billableHours, price, counts };
}

export function useFloorPricing(input: FloorItem[] | FloorLayout) {
  return computeFloorPricing(input);
}
