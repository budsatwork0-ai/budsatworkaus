import type { LatLng } from '@/lib/services-core/yard-pricing';

export * from '@/lib/services-core/yard-pricing';

// Google Maps utilities — require a loaded Maps instance; stay in the UI layer.
export function polygonToArray(polygon: google.maps.Polygon): LatLng[] {
  const arr: LatLng[] = [];
  polygon.getPath().forEach((p) => arr.push({ lat: p.lat(), lng: p.lng() }));
  return arr;
}

export function arrayToPolygon(
  map: google.maps.Map,
  coords: LatLng[],
  opts: google.maps.PolygonOptions = {}
): google.maps.Polygon {
  return new google.maps.Polygon({
    paths: coords,
    editable: true,
    draggable: false,
    strokeColor: '#0f5132',
    strokeWeight: 2,
    fillColor: '#16a34a',
    fillOpacity: 0.25,
    ...opts,
    map,
  });
}
