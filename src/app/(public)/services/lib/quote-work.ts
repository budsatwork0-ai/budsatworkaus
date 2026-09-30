import type { WizardState } from '../types';

/** The same selection check gates both Continue and the contact/review screen. */
export function hasQuoteWork(S: WizardState, selectedWork: boolean, addressRequired = false): boolean {
  if (addressRequired && !S.address.trim()) return false;
  switch (S.service) {
    case 'windows':
      return S.winRows.some(r => S.scope === 'windows_tracks'
        ? r.tracks > 0 : (S.scope !== 'windows_exterior' && r.int > 0) || (S.scope !== 'windows_interior' && r.ext > 0));
    case 'yard': {
      const jobs = S.yardJobs ?? [];
      const hasPolygons = jobs.length > 0 && jobs.every(job => (job.polygon_geojson ?? []).some(z => z.length >= 3));
      const hasArea = S.scope !== 'yard_hedge' && S.scope !== 'gutter_clean'
        && (S.manualYardAreaM2 ?? 0) > 0 && jobs.length <= 1;
      return hasPolygons || hasArea;
    }
    case 'auto': return !!S.carModelType && (S.paramsByService.auto?.vehicle_size ?? 0) > 0;
    case 'dump': {
      if (S.scope === 'bin_cleans') {
        const p = S.paramsByService.dump ?? {};
        return ['redBins', 'yellowBins', 'greenBins', 'kitchenBins'].some(k => (p[k] ?? 0) > 0);
      }
      if (S.scope === 'dump_runs') return !!S.dumpRun && S.dumpRun.loads > 0;
      if (S.scope === 'dump_delivery') return !!S.dumpDelivery;
      if (S.scope === 'dump_transport') return !!S.dumpTransport;
      return false;
    }
    case 'laundry_sneakers': return S.scope === 'laundry' ? S.laundryLoads >= 1 : S.sneakerPairCount >= 1;
    default: return selectedWork;
  }
}
