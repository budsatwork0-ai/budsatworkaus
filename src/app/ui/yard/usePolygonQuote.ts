import { SupabaseClient } from '@supabase/supabase-js';
import {
  LatLng,
  PolygonQuote,
  SavedQuote,
  YardPricingOptions,
  computeAreaFromPath,
  estimateRange,
  priceFromArea,
} from './yardPricing';

export * from './yardPricing';

/**
 * Polygon-driven quote hook.
 *
 * All pricing delegates to yardPricing.ts (priceYardJob) via priceFromArea /
 * estimateRange with an explicit `scope` on the options. This keeps the
 * polygon map, assistant wizard, and admin revision on identical numbers.
 *
 * Callers SHOULD pass `opts.scope` — otherwise the quote defaults to lawn
 * pricing, which is only correct for mowing jobs.
 */
export function usePolygonQuote() {
  const computeQuote = (path: LatLng[], opts?: YardPricingOptions): PolygonQuote => {
    const rawArea = computeAreaFromPath(path);
    const { low, high } = estimateRange(rawArea, opts);
    return {
      polygon: path,
      rawArea,
      estimatedLow: low,
      estimatedHigh: high,
    };
  };

  const saveQuote = async (supabase: SupabaseClient, payload: SavedQuote) => {
    return supabase.from('yard_quotes').insert({
      address: payload.address,
      customer_id: payload.customerId,
      polygon_coordinates: payload.polygon,
      raw_area: payload.rawArea,
      admin_adjusted_area: null,
      estimated_low: payload.estimatedLow,
      estimated_high: payload.estimatedHigh,
      final_price: null,
      status: 'pending',
    });
  };

  const updateAdminRevision = async (
    supabase: SupabaseClient,
    quoteId: string,
    adjustedArea: number,
    opts?: YardPricingOptions,
  ) => {
    // Admin revisions go through the same priceFromArea path the live quote
    // uses, so the final billed price can't drift from the quoted range.
    const finalPrice = Math.round(priceFromArea(adjustedArea, opts));
    return supabase
      .from('yard_quotes')
      .update({
        admin_adjusted_area: adjustedArea,
        final_price: finalPrice,
        status: 'revised',
      })
      .eq('id', quoteId);
  };

  return { computeQuote, saveQuote, updateAdminRevision };
}
