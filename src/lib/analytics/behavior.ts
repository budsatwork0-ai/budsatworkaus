/**
 * Behavioral analytics — unified tracking across PostHog, Clarity, and Hotjar.
 *
 * All functions degrade gracefully when SDKs are not loaded.
 * Import from this module rather than calling posthog/clarity/hj directly.
 */

// ── SDK shims ─────────────────────────────────────────────────────────────────

type ClarityFn = (action: string, key: string, value?: string) => void;
type HjFn = (action: string, event: string) => void;

function clarity(action: 'event' | 'set', key: string, value?: string): void {
  if (typeof window === 'undefined') return;
  const fn = (window as unknown as Record<string, unknown>).clarity as ClarityFn | undefined;
  if (fn) fn(action, key, value);
}

function hj(action: 'event' | 'identify', event: string): void {
  if (typeof window === 'undefined') return;
  const fn = (window as unknown as Record<string, unknown>).hj as HjFn | undefined;
  if (fn) fn(action, event);
}

function ph(event: string, props?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    // posthog-js attaches to window; dynamic import avoids SSR issues
    const posthog = (window as unknown as Record<string, unknown>).posthog as
      | { capture: (e: string, p?: Record<string, unknown>) => void; opt_out_capturing_called?: () => boolean }
      | undefined;
    if (posthog?.capture) posthog.capture(event, props);
  } catch {
    // PostHog not loaded yet — silently skip
  }
}

// ── Quote funnel ──────────────────────────────────────────────────────────────

export function trackFunnelStart(serviceContext?: string) {
  ph('quote_funnel_start', { service_context: serviceContext });
  clarity('event', 'quote_funnel_start');
  hj('event', 'quote_funnel_start');
}

export function trackFunnelStepComplete(step: number, service?: string) {
  ph('quote_funnel_step_complete', { step, service });
  clarity('event', `quote_step_${step}_complete`);
}

export function trackFunnelAbandon(step: number, service?: string, missingFields?: string) {
  ph('quote_funnel_abandon', { step, service, missing_fields: missingFields });
  clarity('event', `quote_funnel_abandon_step_${step}`);
  hj('event', 'quote_funnel_abandon');
}

export function trackFunnelSubmit(quoteId: string, service?: string, totalAud?: number) {
  ph('quote_submitted', { quote_id: quoteId, service, total_aud: totalAud });
  clarity('event', 'quote_submitted');
  hj('event', 'quote_submitted');
}

// ── CTA tracking ──────────────────────────────────────────────────────────────

export function trackCtaView(ctaId: string, page: string) {
  ph('cta_view', { cta_id: ctaId, page });
}

export function trackCtaClick(ctaId: string, page: string) {
  ph('cta_click', { cta_id: ctaId, page });
  clarity('event', `cta_click`);
  clarity('set', 'last_cta', ctaId);
  hj('event', 'cta_click');
}

// ── Admin workflow ────────────────────────────────────────────────────────────

export function trackAdminTabView(tab: string) {
  ph('admin_tab_view', { tab });
  clarity('set', 'admin_tab', tab);
}

export function trackAdminAction(action: string, tab: string, durationMs?: number) {
  ph('admin_action', { action, tab, duration_s: durationMs ? Math.round(durationMs / 1000) : undefined });
}

export function trackAdminIdle(tab: string, idleSeconds: number) {
  ph('admin_idle', { tab, idle_s: idleSeconds });
}

// ── Workflow drop-offs ────────────────────────────────────────────────────────

export function trackWorkflowDropOff(workflow: string, step: string, timeSpentMs?: number) {
  ph('workflow_drop_off', { workflow, step, time_spent_s: timeSpentMs ? Math.round(timeSpentMs / 1000) : undefined });
  clarity('event', `${workflow}_drop_off`);
  hj('event', 'workflow_drop_off');
}

// ── Mobile UX ─────────────────────────────────────────────────────────────────

export function trackMobileScrollComplete(page: string, depthPct: number) {
  ph('mobile_scroll_complete', { page, depth_pct: depthPct });
}

export function trackMobileTapMiss(component: string, page: string) {
  ph('mobile_tap_miss', { component, page });
  clarity('event', 'mobile_tap_miss');
}

// ── Rage click correlation ────────────────────────────────────────────────────
// Clarity detects rage clicks natively — call this from the PostHog session recording
// onRageClick callback to correlate with funnel position.

export function tagRageClickContext(funnelStep: number, component: string) {
  clarity('set', 'rage_click_step', String(funnelStep));
  clarity('set', 'rage_click_component', component);
  ph('rage_click_context', { funnel_step: funnelStep, component });
}

// ── Feature discovery ─────────────────────────────────────────────────────────

export function trackFeatureFirstUse(feature: string) {
  ph('feature_first_use', { feature });
  clarity('event', `feature_first_use_${feature}`);
}
