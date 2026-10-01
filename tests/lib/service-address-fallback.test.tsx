// @vitest-environment jsdom
import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ServiceAddressInput } from '@/app/(public)/services/components/shared/ServiceAddressInput';
vi.mock('@/map/yardMapLoader', () => ({ loadGoogleMapsOnce: vi.fn().mockRejectedValue(new Error('Provider unavailable')) }));

function enterAddress() {
  fireEvent.click(screen.getByRole('button', { name: 'Enter address manually' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Street address' }), { target: { value: '26 Wilbur Street' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Suburb' }), { target: { value: 'Logan Central' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Queensland postcode' }), { target: { value: '4114' } });
}

describe('Service address fallback', () => {
  it('replaces a provider-disabled input with manual entry and submits a labelled unverified address', () => {
    const onAddressChange = vi.fn();
    render(<ServiceAddressInput address="" onAddressChange={onAddressChange} onClear={vi.fn()} />);
    (screen.getByRole('textbox', { name: 'Service address search' }) as HTMLInputElement).disabled = true;
    enterAddress();
    expect(screen.getByRole('textbox', { name: 'Street address' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Use this address' }));
    expect(onAddressChange).toHaveBeenCalledWith('26 Wilbur Street, Logan Central QLD 4114', 'Logan Central');
    expect(screen.getByText('Entered manually')).toBeInTheDocument();
    expect(screen.queryByText('Verified')).not.toBeInTheDocument();
  });
  it('requires a suburb and Queensland street postcode', () => {
    const onAddressChange = vi.fn();
    render(<ServiceAddressInput address="" onAddressChange={onAddressChange} onClear={vi.fn()} />);
    enterAddress();
    fireEvent.change(screen.getByRole('textbox', { name: 'Queensland postcode' }), { target: { value: '3000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this address' }));
    expect(onAddressChange).not.toHaveBeenCalled();
    expect(screen.getByText(/four-digit Queensland postcode/)).toBeInTheDocument();
  });
  it('keeps the edited street while clearing the previously confirmed parent address', async () => {
    function Parent() {
      const [address, setAddress] = useState('');
      return <ServiceAddressInput address={address} onAddressChange={setAddress} onClear={() => setAddress('')} />;
    }
    render(<Parent />);
    enterAddress();
    fireEvent.click(screen.getByRole('button', { name: 'Use this address' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Street address' }), { target: { value: '27 Wilbur Street' } });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Street address' })).toHaveValue('27 Wilbur Street'));
    expect(screen.getByRole('button', { name: 'Use this address' })).toBeInTheDocument();
  });
});
