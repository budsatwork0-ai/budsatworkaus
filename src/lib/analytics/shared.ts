export type AnalyticsScalar = string | number | boolean | null;

export type AnalyticsEventData = {
  [key: string]: AnalyticsScalar | AnalyticsEventData | AnalyticsScalar[] | AnalyticsEventData[];
};

export const PUBLIC_ANALYTICS_SESSION_KEY = '_baw_sid';
export const PUBLIC_ANALYTICS_RETURNING_KEY = '_baw_ret';
