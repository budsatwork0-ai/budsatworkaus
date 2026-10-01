// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const widget = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const auth = vi.hoisted(() => ({ signInWithOAuth: vi.fn() }));
vi.mock('@marsidev/react-turnstile', () => ({ DEFAULT_SCRIPT_ID: 'cf-turnstile-script', Turnstile: (props: Record<string, unknown>) => { widget.props = props; return <div data-testid="verification-widget" />; } }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseBrowserClient: () => ({ auth }) }));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'test-site-key');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

async function gate() { return (await import('@/components/QuoteAuthGate')).QuoteAuthGate; }
function signal(name: string, value?: string) { act(() => (widget.props[name] as (value?: string) => void)(value)); }

describe('guest quote verification', () => {
  it('requires verification and disables every submit while the request is pending', async () => {
    const Gate = await gate();
    const submit = vi.fn();
    const { rerender } = render(<Gate prefillEmail="guest@example.test" onGuestContinue={submit} />);
    expect(screen.getByRole('button', { name: 'Verifying…' })).toBeDisabled();
    signal('onSuccess', 'fresh-token');
    fireEvent.click(screen.getByRole('button', { name: 'Submit as guest' }));
    expect(submit).toHaveBeenCalledWith('fresh-token');
    rerender(<Gate prefillEmail="guest@example.test" onGuestContinue={submit} submitting />);
    expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDisabled();
  });

  it('discards a consumed token after a rejected request before allowing another attempt', async () => {
    const Gate = await gate();
    const { rerender } = render(<Gate prefillEmail="guest@example.test" verificationResetKey={0} />);
    signal('onSuccess', 'consumed-token');
    expect(screen.getByRole('button', { name: 'Submit as guest' })).toBeEnabled();
    rerender(<Gate prefillEmail="guest@example.test" verificationResetKey={1} />);
    expect(screen.getByRole('button', { name: 'Verifying…' })).toBeDisabled();
    signal('onSuccess', 'replacement-token');
    expect(screen.getByRole('button', { name: 'Submit as guest' })).toBeEnabled();
  });

  it('shows a recovery action when the provider script fails or an interactive challenge times out', async () => {
    const Gate = await gate();
    const script = document.createElement('script');
    script.id = 'cf-turnstile-script';
    document.head.appendChild(script);
    render(<Gate prefillEmail="guest@example.test" />);
    fireEvent.error(script);
    expect(screen.getByRole('alert')).toHaveTextContent('Your quote details are saved');
    fireEvent.click(screen.getByRole('button', { name: 'Retry verification' }));
    expect(document.getElementById('cf-turnstile-script')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    signal('onTimeout');
    expect(screen.getByRole('button', { name: 'Retry verification' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Verifying…' })).toBeDisabled();
  });

  it('offers recovery after 20 seconds instead of an unexplained indefinite spinner', async () => {
    const Gate = await gate();
    vi.useFakeTimers();
    render(<Gate prefillEmail="guest@example.test" />);
    act(() => vi.advanceTimersByTime(20_000));
    expect(screen.getByRole('button', { name: 'Retry verification' })).toBeVisible();
  });

  it('clears Google loading and shows errors when OAuth cannot start', async () => {
    const Gate = await gate();
    auth.signInWithOAuth.mockResolvedValue({ error: { message: 'Sign-in unavailable' } });
    render(<Gate prefillEmail="guest@example.test" />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' })));
    expect(screen.getByRole('alert')).toHaveTextContent('Sign-in unavailable');
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
  });
});
