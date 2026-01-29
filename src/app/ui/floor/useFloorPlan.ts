import { SupabaseClient } from '@supabase/supabase-js';

export type RoomType = 'bedroom' | 'bathroom' | 'kitchen' | 'living' | 'laundry' | 'hallway' | 'other';
export type FurnitureType =
  | 'bed'
  | 'sofa'
  | 'table'
  | 'desk'
  | 'wardrobe'
  | 'toilet'
  | 'shower'
  | 'fridge'
  | 'oven'
  | 'window'
  | 'clutter'
  | 'other';

export interface BaseShape {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface RoomShape extends BaseShape {
  kind: 'room';
  roomType: RoomType;
}

export interface FurnitureShape extends BaseShape {
  kind: 'furniture';
  furnitureType: FurnitureType;
}

export type FloorItem = RoomShape | FurnitureShape;

export interface FloorLayout {
  rooms: RoomShape[];
  furniture: FurnitureShape[];
}

export interface Metrics {
  bedrooms: number;
  bathrooms: number;
  totalRooms: number;
  clutterScore: number;
  estimatedMinutes: number;
  estimatedPrice: number;
}

export interface EstimateConfig {
  baseMinutes: number;
  perBedroom: number;
  perBathroom: number;
  perRoom: number;
  perClutter: number; // per clutter item
  hourlyRate: number;
}

export const defaultEstimateConfig: EstimateConfig = {
  baseMinutes: 60,
  perBedroom: 25,
  perBathroom: 30,
  perRoom: 10,
  perClutter: 5,
  hourlyRate: 65,
};

export function toLayout(items: FloorItem[]): FloorLayout {
  return {
    rooms: items.filter((i): i is RoomShape => i.kind === 'room'),
    furniture: items.filter((i): i is FurnitureShape => i.kind === 'furniture'),
  };
}

export function fromLayout(layout: FloorLayout): FloorItem[] {
  return [...layout.rooms, ...layout.furniture];
}

export function computeMetrics(items: FloorItem[], config: EstimateConfig = defaultEstimateConfig): Metrics {
  const rooms = items.filter((i): i is RoomShape => i.kind === 'room');
  const furniture = items.filter((i): i is FurnitureShape => i.kind === 'furniture');

  const bedrooms = rooms.filter((r) => r.roomType === 'bedroom').length;
  const bathrooms = rooms.filter((r) => r.roomType === 'bathroom').length;
  const totalRooms = rooms.length;

  const clutterScore = furniture.filter((f) => f.furnitureType === 'clutter').length;
  const minutes =
    config.baseMinutes +
    bedrooms * config.perBedroom +
    bathrooms * config.perBathroom +
    totalRooms * config.perRoom +
    clutterScore * config.perClutter;

  const estimatedPrice = Math.round((minutes / 60) * config.hourlyRate);

  return {
    bedrooms,
    bathrooms,
    totalRooms,
    clutterScore,
    estimatedMinutes: minutes,
    estimatedPrice,
  };
}

export async function saveLayout(
  supabase: SupabaseClient,
  payload: {
    customerId: string;
    address: string;
    layout: FloorLayout;
    metrics: Metrics;
  }
) {
  return supabase.from('floor_plans').insert({
    customer_id: payload.customerId,
    address: payload.address,
    layout_json: payload.layout,
    bedrooms: payload.metrics.bedrooms,
    bathrooms: payload.metrics.bathrooms,
    total_rooms: payload.metrics.totalRooms,
    clutter_score: payload.metrics.clutterScore,
    estimated_minutes: payload.metrics.estimatedMinutes,
    estimated_price: payload.metrics.estimatedPrice,
    status: 'pending',
  });
}

export function resetLayout(): FloorItem[] {
  return [];
}
