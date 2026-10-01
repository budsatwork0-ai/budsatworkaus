/** Calendar dates and timestamps throughout operations use the business timezone. */
export const BUSINESS_TIME_ZONE = 'Australia/Brisbane';

export function businessDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

export function formatBusinessDate(value: string | Date, options: Intl.DateTimeFormatOptions = {}): string {
  // A SQL date is a calendar date, not a UTC instant.
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00+10:00`) : new Date(value);
  return date.toLocaleString('en-AU', { ...options, timeZone: BUSINESS_TIME_ZONE });
}

export function shiftCalendarDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
