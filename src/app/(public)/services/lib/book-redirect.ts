/**
 * Build /services plus the inbound query string, for /book and /booking redirects.
 * Missing or empty search params become a bare /services path.
 */
export function servicesPathWithQuery(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (typeof value === 'string') {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `/services?${qs}` : '/services';
}
