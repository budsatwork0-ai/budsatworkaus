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
    adjustedArea: number
  ) => {
    const finalPrice = Math.round(priceFromArea(adjustedArea));
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
