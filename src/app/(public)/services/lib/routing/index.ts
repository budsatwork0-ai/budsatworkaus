export * from '@/lib/services-core/routing';

// Google Maps utilities — require a loaded Maps API instance; stay in the UI layer.
export const isQueenslandPlace = (place?: google.maps.places.PlaceResult | null) =>
  Boolean(
    place?.address_components?.some(
      (comp) =>
        comp.types?.includes('administrative_area_level_1') &&
        (comp.short_name === 'QLD' || comp.long_name?.toLowerCase().includes('queensland')),
    ),
  );
