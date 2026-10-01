import type { WizardState } from '../types';
import { getScopeFlags } from './service-helpers';
import { PARAMS_FULL, COMM_PARAM_DEFS, SCOPES_BY_SERVICE } from './service-data';
import { LAUNDRY_PER_LOAD_ADDONS, LAUNDRY_PER_ORDER_ADDONS, LAUNDRY_IRONING_PRICES } from './pricing/constants';

/** Persist the actual requested work in existing quote notes without a schema change. */
export function buildScopeSummary(S: WizardState, total: string, duration: string): string {
  const scope = SCOPES_BY_SERVICE[S.service].find(s => s.key === S.scope)?.label ?? S.scope;
  const lines = [`Service scope: ${scope}`, `Estimate: ${total} · ${duration}`];
  if (S.service === 'windows') {
    const flags = getScopeFlags(S.scope);
    const segments = S.winSessionSeg ?? { int: flags.isFull || flags.isIntOnly, ext: flags.isFull || flags.isExtOnly, tracks: flags.isFull || flags.isTracksOnly };
    S.winRows.forEach((r, i) => lines.push(`${r.label || `Level ${i + 1}`}: ${segments.int ? r.int : 0} inside panes, ${segments.ext ? r.ext : 0} outside panes, ${segments.tracks ? r.tracks : 0} tracks, ${S.context === 'commercial' || !segments.ext ? 0 : r.screens} screens`));
  } else if (S.service === 'dump' && S.scope === 'dump_runs') {
    lines.push(`Load: ${(S.dumpRun.loadType ?? 'ute').replace(/_/g, ' ')} · ${S.dumpRun.loads} load(s)`);
  } else if (S.service === 'dump' && (S.scope === 'dump_transport' || S.scope === 'dump_delivery')) {
    const selection = S.scope === 'dump_transport' ? S.dumpTransport : S.dumpDelivery;
    Object.entries(selection).forEach(([k, v]) => { if (v !== null && v !== false) lines.push(`${k.replace(/_/g, ' ')}: ${v}`); });
    lines.push(`Distance: ${S.distanceKm} km`);
  } else if (S.service === 'laundry_sneakers') {
    if (S.scope === 'laundry') {
      lines.push(`Laundry: ${S.laundryLoads} load(s)`);
      S.laundryPerLoadAddOns.forEach(k => lines.push(LAUNDRY_PER_LOAD_ADDONS[k].label));
      S.laundryPerOrderAddOns.forEach(k => lines.push(LAUNDRY_PER_ORDER_ADDONS[k].label));
      S.laundryIroningItems.filter(i => i.count > 0).forEach(i => lines.push(`${LAUNDRY_IRONING_PRICES[i.type].label}: ${i.count}`));
    } else lines.push(`Sneakers: ${S.sneakerTier} · ${S.sneakerTier === 'multi' ? S.sneakerPairCount : 1} pair(s) · ${S.sneakerTurnaround}`);
  } else {
    const params = { ...S.paramsByService[S.service], ...(S.service === 'cleaning' ? S.cleaningAddons[S.scope] : {}) };
    const defs = S.context === 'commercial' && S.service === 'cleaning'
      ? COMM_PARAM_DEFS[S.commercialCleaningType ?? 'office'] : PARAMS_FULL[S.service];
    Object.entries(params).filter(([, v]) => Number(v) > 0).forEach(([k, v]) => lines.push(`${defs.find(d => d.key === k)?.label ?? k.replace(/_/g, ' ')}: ${v}`));
    if (S.service === 'auto') lines.push(`Vehicle: ${S.carModelType} · dirt level ${S.carDirtLevel}`);
    if (S.service === 'yard') {
      if (S.manualYardAreaM2) lines.push(`Area: ${S.manualYardAreaM2} m² (manual)`);
      S.yardJobs.forEach((job, i) => lines.push(`Area ${i + 1}: ${job.area_m2 ?? 0} m²`));
    }
    if (S.context === 'commercial') lines.push(`Service level: ${S.commPreset} · frequency: ${S.commFrequency}`);
  }
  const inclusions = S.selectedInclusions[S.scope] ?? [];
  if (inclusions.length) lines.push(`Inclusions: ${inclusions.join(', ')}`);
  return lines.join('\n');
}
