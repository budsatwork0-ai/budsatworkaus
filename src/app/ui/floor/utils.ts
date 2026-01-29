import { FloorItem, FloorLayout, toLayout, fromLayout } from './useFloorPlan';

export const serializeLayout = (items: FloorItem[]) => JSON.stringify(toLayout(items));
export const deserializeLayout = (json: string): FloorItem[] => {
  try {
    const parsed = JSON.parse(json) as FloorLayout;
    return fromLayout(parsed);
  } catch {
    return [];
  }
};
