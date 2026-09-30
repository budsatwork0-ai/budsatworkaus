// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { getInitialState, useLocalStorageReducer, wizardReducer } from '@/app/(public)/services/lib/wizard-state';

describe('quote draft persistence across authentication navigation', () => {
  beforeEach(() => localStorage.clear());

  it('restores the saved step and quantities before writing any defaults', async () => {
    const saved = getInitialState();
    saved.step = 3;
    saved.winRows[0].int = 18;
    localStorage.setItem('audit-draft', JSON.stringify(saved));
    const { result } = renderHook(() => useLocalStorageReducer('audit-draft', wizardReducer, getInitialState));
    await waitFor(() => expect(result.current[0].step).toBe(3));
    expect(result.current[0].winRows[0].int).toBe(18);
    expect(JSON.parse(localStorage.getItem('audit-draft')!).winRows[0].int).toBe(18);
  });

  it('saves the final change before immediate unmount and restores on reentry', async () => {
    const first = renderHook(() => useLocalStorageReducer('audit-draft', wizardReducer, getInitialState));
    act(() => first.result.current[1]({ type: 'merge', value: { step: 3, fullName: 'Test Customer' } }));
    first.unmount();
    const next = renderHook(() => useLocalStorageReducer('audit-draft', wizardReducer, getInitialState));
    await waitFor(() => expect(next.result.current[0].step).toBe(3));
    expect(next.result.current[0].fullName).toBe('Test Customer');
  });

  it('starts a fresh selection when an explicit service/rebook link requests it', async () => {
    localStorage.setItem('audit-draft', JSON.stringify({ ...getInitialState(), step: 3 }));
    const { result } = renderHook(() => useLocalStorageReducer('audit-draft', wizardReducer, getInitialState, false));
    await waitFor(() => expect(result.current[0].step).toBe(1));
  });
});
