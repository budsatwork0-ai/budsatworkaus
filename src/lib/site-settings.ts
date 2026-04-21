import { createServiceClientSafe } from './supabase/server';

export type SiteStats = {
  jobs_completed: string;
  avg_rating: string;
  repeat_customers: string;
};

// Default fallback values if database is unavailable
const DEFAULTS: SiteStats = {
  jobs_completed: '250+',
  avg_rating: '4.9/5',
  repeat_customers: '70%+',
};

type SettingsRow = { key: string; value: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Fetch site settings from Supabase.
 * Returns defaults if database is unavailable.
 */
export async function getSiteSettings(): Promise<SiteStats> {
  try {
    const client = createServiceClientSafe();
    if (!client) return DEFAULTS;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client as any)
      .from('site_settings')
      .select('key, value')
      .in('key', ['jobs_completed', 'avg_rating', 'repeat_customers']);

    if (error || !data) {
      return DEFAULTS;
    }

    const settings: Record<string, string> = {};
    for (const row of data as SettingsRow[]) {
      settings[row.key] = row.value;
    }

    return {
      jobs_completed: settings.jobs_completed || DEFAULTS.jobs_completed,
      avg_rating: settings.avg_rating || DEFAULTS.avg_rating,
      repeat_customers: settings.repeat_customers || DEFAULTS.repeat_customers,
    };
  } catch {
    return DEFAULTS;
  }
}

/**
 * Get all site settings as a key-value record.
 */
export async function getAllSiteSettings(): Promise<Record<string, string>> {
  try {
    const client = createServiceClientSafe();
    if (!client) return {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client as any)
      .from('site_settings')
      .select('key, value')
      .order('key');

    if (error || !data) {
      return {};
    }

    const settings: Record<string, string> = {};
    for (const row of data as SettingsRow[]) {
      settings[row.key] = row.value;
    }
    return settings;
  } catch {
    return {};
  }
}

export async function getSiteSettingValue<T>(key: string, fallback: T): Promise<T> {
  try {
    const client = createServiceClientSafe();
    if (!client) return fallback;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client as any)
      .from('site_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error || !data || data.value === undefined || data.value === null) {
      return fallback;
    }

    return data.value as T;
  } catch {
    return fallback;
  }
}

export async function getSiteSettingObject<T extends Record<string, unknown>>(
  key: string,
  fallback: T
): Promise<T> {
  const value = await getSiteSettingValue<unknown>(key, fallback);

  if (!isPlainObject(value)) {
    return fallback;
  }

  return {
    ...fallback,
    ...value,
  } as T;
}
