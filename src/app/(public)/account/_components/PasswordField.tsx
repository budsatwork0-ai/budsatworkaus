'use client';

import { useState } from 'react';
import { EyeIcon } from './AuthIcons';
import { brand } from '../../../ui/theme';

// Password strength scorer — returns 0-4.
function scorePassword(p: string): { score: number; label: string; color: string } {
  let score = 0;
  if (p.length >= 8) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;

  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
  const idx = Math.max(0, score - 1);

  return { score, label: labels[idx], color: colors[idx] };
}

interface PasswordFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  /** Show a 4-segment strength bar + label */
  showStrength?: boolean;
  /** When provided, shows match/mismatch status (used for the confirm field) */
  matchAgainst?: string;
  /** Dark background variant */
  dark?: boolean;
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder = 'At least 8 characters',
  autoComplete,
  required = true,
  showStrength = false,
  matchAgainst,
  dark = false,
}: PasswordFieldProps) {
  const [show, setShow] = useState(false);

  const isConfirm = matchAgainst !== undefined;
  const hasValue = value.length > 0;
  const matches = isConfirm && hasValue && matchAgainst === value;
  const mismatch = isConfirm && hasValue && matchAgainst !== value;

  const strength = showStrength && hasValue ? scorePassword(value) : null;
  const meetsLength = value.length >= 8;

  return (
    <div>
      {label && (
        <label
          htmlFor={id}
          className={`block text-sm font-medium mb-1.5 ${dark ? 'text-white/70' : ''}`}
          style={dark ? {} : { color: brand.text }}
        >
          {label}
        </label>
      )}

      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          required={required}
          minLength={showStrength ? 8 : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-xl border px-4 py-3 pr-11 text-sm transition-all focus:outline-none focus:ring-2 ${
            dark
              ? mismatch
                ? 'border-red-500/40 bg-white/5 text-white placeholder:text-slate-500 focus:border-red-500/50 focus:ring-red-500/10'
                : matches
                ? 'border-emerald-500/40 bg-white/5 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/10'
                : 'border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:ring-emerald-500/10'
              : mismatch
              ? 'border-red-400 bg-white/60 focus:border-red-400 focus:ring-red-400/20'
              : matches
              ? 'border-emerald-500 bg-white/60 focus:border-emerald-600 focus:ring-emerald-600/20'
              : 'border-black/10 bg-white/60 focus:border-emerald-600 focus:ring-emerald-600/20'
          }`}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-colors ${
            dark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
          }`}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          <EyeIcon open={show} />
        </button>
      </div>

      {/* Strength meter (new password fields) */}
      {showStrength && hasValue && strength && (
        <div className="mt-2 space-y-1">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="flex-1 h-1 rounded-full transition-all duration-200"
                style={{ background: n <= strength.score ? strength.color : '#e2e8f0' }}
              />
            ))}
          </div>
          <p className="text-xs font-medium transition-colors" style={{ color: strength.color }}>
            {strength.label} password
            {!meetsLength && ' — minimum 8 characters'}
          </p>
        </div>
      )}

      {/* Confirm match status */}
      {isConfirm && hasValue && (
        <p className="text-xs mt-1.5 transition-colors" style={{ color: mismatch ? '#ef4444' : '#10b981' }}>
          {mismatch ? "Passwords don't match" : 'Passwords match'}
        </p>
      )}
    </div>
  );
}
