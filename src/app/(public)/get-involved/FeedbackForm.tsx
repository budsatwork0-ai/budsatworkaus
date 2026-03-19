'use client';

import React, { useRef, useState } from 'react';
import { brand } from '../../ui/theme';

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function CheckCircleIcon() {
  return (
    <svg {...iconProps} className="h-10 w-10">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg {...iconProps} className="h-5 w-5">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg {...iconProps} className="h-4 w-4">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

const TYPE_OPTIONS = [
  { value: 'bug_report', label: 'Bug report', description: 'Something is broken or not working right' },
  { value: 'feature_idea', label: 'Feature idea', description: 'A cool new thing we could try' },
  { value: 'general', label: 'General feedback', description: 'Anything else on your mind' },
] as const;

type FeedbackType = 'bug_report' | 'feature_idea' | 'general';

const inputCls = 'mt-1.5 w-full rounded-xl border bg-white/80 backdrop-blur px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-offset-1';
const labelCls = 'text-sm font-medium text-slate-800';

export default function FeedbackForm() {
  const [type, setType] = useState<FeedbackType>('general');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be under 5MB');
      return;
    }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError(null);
  }

  function removePhoto() {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  const canSubmit = subject.trim().length >= 3 && description.trim().length >= 10;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      setShowErrors(true);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('type', type);
      fd.append('subject', subject.trim());
      fd.append('description', description.trim());
      if (photo) fd.append('photo', photo);

      const res = await fetch('/api/feedback', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Submission failed');
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="py-10 text-center space-y-4">
        <div className="flex justify-center" style={{ color: '#16a34a' }}>
          <CheckCircleIcon />
        </div>
        <div>
          <h3 className="text-lg font-bold" style={{ color: brand.text }}>Thanks for the feedback!</h3>
          <p className="mt-1 text-sm" style={{ color: brand.muted }}>
            {"We've received your submission and will review it soon."}
          </p>
        </div>
        <button
          onClick={() => {
            setSubmitted(false);
            setSubject('');
            setDescription('');
            setPhoto(null);
            setPhotoPreview(null);
            setType('general');
            setShowErrors(false);
          }}
          className="text-sm underline underline-offset-2"
          style={{ color: brand.muted }}
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Type selector */}
      <div>
        <div className={labelCls + ' mb-2'}>What kind of feedback is this?</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {TYPE_OPTIONS.map((opt) => {
            const active = type === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className="text-left rounded-2xl border px-4 py-3 transition-all"
                style={{
                  borderColor: active ? brand.primary : brand.border,
                  backgroundColor: active ? `${brand.primary}10` : 'transparent',
                }}
              >
                <div className="text-sm font-semibold" style={{ color: active ? brand.primary : brand.text }}>
                  {opt.label}
                </div>
                <div className="text-xs mt-0.5" style={{ color: brand.muted }}>
                  {opt.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Subject */}
      <div>
        <label className={labelCls}>
          Subject <span className="text-rose-500">*</span>
        </label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={100}
          placeholder="e.g. Booking page scrolls weird on iPhone"
          className={inputCls}
          style={{
            borderColor: showErrors && subject.trim().length < 3 ? '#ef4444' : brand.border,
            outlineColor: brand.focus,
          }}
        />
        {showErrors && subject.trim().length < 3 && (
          <p className="mt-1 text-xs text-rose-600">Please add a subject (min 3 characters)</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className={labelCls}>
          Description <span className="text-rose-500">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Tell us what's happening, what you'd like to see, or any details that'd help us out."
          className={inputCls}
          style={{
            borderColor: showErrors && description.trim().length < 10 ? '#ef4444' : brand.border,
            outlineColor: brand.focus,
            resize: 'none',
          }}
        />
        {showErrors && description.trim().length < 10 && (
          <p className="mt-1 text-xs text-rose-600">Please describe in a bit more detail (min 10 characters)</p>
        )}
      </div>

      {/* Photo upload */}
      <div>
        <div className={labelCls + ' mb-2'}>Attach a photo <span className="font-normal text-slate-500">(optional)</span></div>
        {photoPreview ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoPreview}
              alt="Preview"
              className="h-32 w-auto rounded-2xl border object-cover"
              style={{ borderColor: brand.border }}
            />
            <button
              type="button"
              onClick={removePhoto}
              className="absolute -top-2 -right-2 rounded-full p-1 bg-white border shadow-sm hover:bg-slate-50 transition-colors"
              style={{ borderColor: brand.border, color: brand.muted }}
              aria-label="Remove photo"
            >
              <XIcon />
            </button>
          </div>
        ) : (
          <label
            className="flex items-center gap-2 w-fit cursor-pointer rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-slate-50"
            style={{ borderColor: brand.border, color: brand.muted }}
          >
            <span style={{ color: brand.primary }}><ImageIcon /></span>
            Upload a screenshot or photo
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handlePhotoChange}
            />
          </label>
        )}
        <p className="mt-1 text-xs" style={{ color: brand.muted }}>Max 5MB · JPG, PNG, WEBP, GIF</p>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3.5 px-5 rounded-2xl font-semibold text-white shadow-[0_12px_30px_rgba(20,83,45,0.25)] transition-all hover:shadow-[0_16px_40px_rgba(20,83,45,0.3)] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ backgroundColor: brand.primary }}
      >
        {submitting ? 'Sending...' : 'Send feedback'}
      </button>
    </form>
  );
}
