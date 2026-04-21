import { getSiteSettingObject } from './site-settings';

export const BUSINESS_TIME_ZONE = 'Australia/Brisbane';

export const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window Cleaning',
  cleaning: 'Home / Commercial Cleaning',
  yard: 'Yard Care',
  dump: 'Dump Runs',
  auto: 'Auto Detailing',
  laundry_sneakers: 'Laundry & Sneaker Care',
};

export type AutomationSettings = {
  quote24hReminder: boolean;
  quote48hDiscount: boolean;
  dayBeforeReminder: boolean;
  weeklyKpiEmail: boolean;
  autoCompleteJobs: boolean;
};

export type AutomationConfig = {
  quoteReengagementDiscountPercent: number;
};

export type DashboardGoalSettings = {
  monthlyRevenueTarget: number;
  monthlyJobsTarget: number;
};

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  quote24hReminder: true,
  quote48hDiscount: true,
  dayBeforeReminder: true,
  weeklyKpiEmail: true,
  autoCompleteJobs: false,
};

export const DEFAULT_AUTOMATION_CONFIG: AutomationConfig = {
  quoteReengagementDiscountPercent: 10,
};

export const DEFAULT_DASHBOARD_GOALS: DashboardGoalSettings = {
  monthlyRevenueTarget: 15000,
  monthlyJobsTarget: 30,
};

export async function getAutomationSettings(): Promise<AutomationSettings> {
  return getSiteSettingObject('automations', DEFAULT_AUTOMATION_SETTINGS);
}

export async function getAutomationConfig(): Promise<AutomationConfig> {
  const config = await getSiteSettingObject('automationConfig', DEFAULT_AUTOMATION_CONFIG);
  return {
    quoteReengagementDiscountPercent: clampPercent(config.quoteReengagementDiscountPercent),
  };
}

export async function getDashboardGoals(): Promise<DashboardGoalSettings> {
  const goals = await getSiteSettingObject('goals', DEFAULT_DASHBOARD_GOALS);

  return {
    monthlyRevenueTarget: toPositiveNumber(goals.monthlyRevenueTarget, DEFAULT_DASHBOARD_GOALS.monthlyRevenueTarget),
    monthlyJobsTarget: toPositiveNumber(goals.monthlyJobsTarget, DEFAULT_DASHBOARD_GOALS.monthlyJobsTarget),
  };
}

export function clampPercent(value: unknown, fallback = DEFAULT_AUTOMATION_CONFIG.quoteReengagementDiscountPercent): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(90, Math.round(numeric)));
}

export function toPositiveNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

export function formatDateInTimeZone(
  value: Date | string,
  options: Intl.DateTimeFormatOptions,
  timeZone = BUSINESS_TIME_ZONE
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-AU', { timeZone, ...options }).format(date);
}

export function getRelativeDateString(offsetDays: number, now = new Date(), timeZone = BUSINESS_TIME_ZONE): string {
  const shifted = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(shifted);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    return shifted.toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

export function getPeriodLabel(start: Date, end: Date, timeZone = BUSINESS_TIME_ZONE): string {
  const startLabel = formatDateInTimeZone(start, { day: 'numeric', month: 'short' }, timeZone);
  const endLabel = formatDateInTimeZone(end, { day: 'numeric', month: 'short', year: 'numeric' }, timeZone);
  return `${startLabel} to ${endLabel}`;
}
