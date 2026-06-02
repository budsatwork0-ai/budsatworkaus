/**
 * Buds At Work — Context-Scoped Design Themes
 *
 * Three independent themes — one per product context.
 * Edit each file in isolation; changes never cross contexts.
 *
 *   dashboard.ts → admin dashboard only
 *   crew.ts      → crew portal only
 *   public.ts    → public/marketing site only
 *
 * Batch migration status:
 *   Batch 1 (done)  — theme files created, Design System viewer updated
 *   Batch 2 (next)  — crew portal imports migrated (15 files)
 *   Batch 3 (next)  — admin dashboard imports migrated (~40 files)
 *   Batch 4 (later) — public site imports migrated (8 files, inc. services page)
 *   Batch 5 (later) — src/components/ shared utilities
 */

export type { Theme, ThemeColor, ThemeType, ThemeTypeStep, ThemeRadius, ThemeShadow, ThemeNav, ThemeNight, ThemeNightColor, ThemeTempTone } from './_theme';
export { dashboardTheme } from './dashboard';
export { crewTheme } from './crew';
export { publicTheme } from './public';

import { dashboardTheme } from './dashboard';
import { crewTheme } from './crew';
import { publicTheme } from './public';

/** All three themes in display order — used by the Design System viewer. */
export const ALL_THEMES = [dashboardTheme, crewTheme, publicTheme] as const;
