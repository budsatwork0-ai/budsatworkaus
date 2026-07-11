import type { AtlasSpec } from '../types';
import { C02_CAPABILITY_ID, V2_SLICE_SCOPE, slug, type SliceIntent } from './domain';

export function extractC02ApiRouteIntent(atlas: AtlasSpec, timepoint: string): SliceIntent[] {
  const capability = atlas.capabilities.find((item) => item.id === C02_CAPABILITY_ID);
  if (!capability) {
    throw new Error('Architecture Doctor v2 slice requires C02 - Quote Pricing and Checkout in the Atlas.');
  }

  return capability.apiRoutes.map((route) => ({
    id: `intent-c02-api-${slug(route)}`,
    capabilityId: capability.id,
    capabilityName: capability.name,
    owner: capability.owner,
    assetKind: 'apiRoute',
    route,
    scope: V2_SLICE_SCOPE,
    provenance: {
      source: atlas.sourcePath,
      sourceType: 'atlas',
      method: 'parseAtlasFile capability API routes',
      timepoint,
      limitation: 'Atlas intent may be stale; disagreement with repository reality requires review.',
    },
  }));
}
