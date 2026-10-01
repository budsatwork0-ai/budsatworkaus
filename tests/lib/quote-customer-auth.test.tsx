// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { useReducer } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { getInitialState, wizardReducer } from '@/app/(public)/services/lib/wizard-state';
import { useQuoteCustomer } from '@/app/(public)/services/hooks/useQuoteCustomer';

const auth = vi.hoisted(() => ({ callback: null as null | ((event: string, session: { user: User } | null) => void), unsubscribe: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseBrowserClient: () => ({ auth: { onAuthStateChange: (callback: typeof auth.callback) => {
  auth.callback = callback;
  return { data: { subscription: { unsubscribe: auth.unsubscribe } } };
} } }) }));
const user = { id: 'test-customer', email: 'customer@example.test', user_metadata: { full_name: 'Test Customer' } } as User;

function useTestWizard() {
  const [state, dispatch] = useReducer(wizardReducer, { ...getInitialState(), step: 3 });
  return { state, dispatch, ...useQuoteCustomer(state, dispatch) };
}

describe('quote contact authentication', () => {
  beforeEach(() => {
    auth.callback = null;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ profile: { full_name: 'Test Customer', email: user.email, phone: '0400000000' } }) }));
  });

  it('hydrates an already signed-in customer and reacts to cross-tab sign-out without reload', async () => {
    const { result } = renderHook(useTestWizard);
    act(() => auth.callback?.('INITIAL_SESSION', { user }));
    await waitFor(() => expect(result.current.profileHydrated).toBe(true));
    expect(result.current.state.fullName).toBe('Test Customer');
    expect(result.current.state.email).toBe(user.email);
    expect(result.current.state.phone).toBe('0400000000');
    act(() => auth.callback?.('SIGNED_OUT', null));
    expect(result.current.user).toBeNull();
    expect(result.current.profileHydrated).toBe(false);
    expect(result.current.state.winRows[0].int).toBe(12);
  });

  it('preserves contact details the guest already entered when signing in', async () => {
    const { result } = renderHook(useTestWizard);
    act(() => result.current.dispatch({ type: 'merge', value: { fullName: 'Booking contact', email: 'booking@example.test' } }));
    act(() => auth.callback?.('SIGNED_IN', { user }));
    await waitFor(() => expect(result.current.profileHydrated).toBe(true));
    expect(result.current.state.fullName).toBe('Booking contact');
    expect(result.current.state.email).toBe('booking@example.test');
  });

  it('ignores a profile response that arrives after sign-out', async () => {
    let resolve!: (value: unknown) => void;
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(r => { resolve = r; })));
    const { result } = renderHook(useTestWizard);
    act(() => auth.callback?.('SIGNED_IN', { user }));
    act(() => auth.callback?.('SIGNED_OUT', null));
    await act(async () => resolve({ ok: true, json: async () => ({ profile: { phone: '0400999999' } }) }));
    expect(result.current.state.phone).toBe('');
    expect(result.current.profileHydrated).toBe(false);
  });
});
