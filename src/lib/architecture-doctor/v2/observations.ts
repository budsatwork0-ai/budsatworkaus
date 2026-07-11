import type { ArchitectureInventory } from '../types';
import { V2_SLICE_SCOPE, slug, type SliceObservation } from './domain';

export function collectApiRouteObservations(inventory: ArchitectureInventory, timepoint: string): SliceObservation[] {
  return inventory.apiRoutes.map((route) => ({
    id: `observation-api-${slug(route)}`,
    assetKind: 'apiRoute',
    route,
    scope: V2_SLICE_SCOPE,
    provenance: {
      source: inventory.rootDir,
      sourceType: 'repository_scan',
      method: 'scanRepository apiRoutes',
      timepoint,
      limitation: 'Static route-file presence only; route behaviour, auth, runtime health, and checkout correctness are not verified.',
    },
  }));
}
