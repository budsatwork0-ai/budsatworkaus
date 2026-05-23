export type AnalyticsScalar = string | number | boolean | null;

export type AnalyticsEventData = {
  [key: string]: AnalyticsScalar | AnalyticsEventData | AnalyticsScalar[] | AnalyticsEventData[];
};

export const PUBLIC_ANALYTICS_SESSION_KEY = '_baw_sid';
export const PUBLIC_ANALYTICS_RETURNING_KEY = '_baw_ret';

/**
 * sessionStorage key holding the lead-attribution snapshot for the current
 * tab/session — utm_*, referrer, landing page — captured on first paint and
 * replayed into the /api/quotes POST body. Cleared when the tab closes; that
 * matches how all the ad platforms expect first-touch attribution to work.
 */
export const LEAD_ATTRIBUTION_STORAGE_KEY = '_baw_attr';

export type LeadAttribution = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  referrer: string | null;
  landing_path: string | null;
  captured_at: string;
};
