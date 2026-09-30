// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CheckoutSuccessPage from '@/app/(public)/services/checkout/success/page';

const search = vi.hoisted(() => ({ params: new URLSearchParams('session_id=cs_test_receipt') }));
const conversion = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useSearchParams: () => search.params }));
vi.mock('@/lib/analytics/conversions', () => ({ trackPaymentCompleted: conversion }));
const order = { id: 'order-receipt', customer_name: 'Test Customer', service_label: 'Windows', context: 'home', final_price: 100, status: 'pending' };

beforeEach(() => { search.params = new URLSearchParams('session_id=cs_test_receipt'); conversion.mockClear(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('checkout receipt', () => {
  it('shows checking, then confirms only a server-verified payment', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...order, payment_confirmed: true }) }));
    render(<CheckoutSuccessPage />);
    expect(screen.getByRole('heading', { name: 'Checking your payment' })).toBeVisible();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Payment confirmed' })).toBeVisible());
    expect(conversion).toHaveBeenCalledExactlyOnceWith(100);
  });
  it('does not claim payment or record a conversion when verification fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    render(<CheckoutSuccessPage />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Unable to confirm payment' })).toBeVisible());
    expect(screen.getByRole('button', { name: 'Check payment again' })).toBeVisible();
    expect(conversion).not.toHaveBeenCalled();
  });
  it('waits through a delayed payment and records the conversion once it clears', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...order, payment_confirmed: false }) })
      .mockResolvedValue({ ok: true, json: async () => ({ ...order, payment_confirmed: true }) });
    vi.stubGlobal('fetch', fetch);
    await act(async () => { render(<CheckoutSuccessPage />); });
    expect(conversion).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(screen.getByRole('heading', { name: 'Payment confirmed' })).toBeVisible();
    expect(conversion).toHaveBeenCalledTimes(1);
  });
  it('does not invent a booking when opened without a reference', () => {
    search.params = new URLSearchParams();
    render(<CheckoutSuccessPage />);
    expect(screen.getByRole('heading', { name: 'No booking reference found' })).toBeVisible();
    expect(conversion).not.toHaveBeenCalled();
  });
});
