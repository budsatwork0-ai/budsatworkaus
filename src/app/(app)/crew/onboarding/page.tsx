'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { crewTheme } from '@/lib/design-system/themes';
import { useAuth } from '@/app/hooks/useAuth';
import { ONBOARDING_SECTION_LABELS } from '@/types/crew';
import type { OnboardingSection } from '@/types/crew';

interface SectionStatus {
  section: string;
  completed: boolean;
}

interface OnboardingData {
  sections: SectionStatus[];
  progress: { completed: number; total: number };
  ndisWorker: boolean;
  onboardingComplete: boolean;
  crewAccessApproved: boolean;
  awaitingApproval: boolean;
}

const SECTION_DESCRIPTIONS: Record<string, string> = {
  personal: 'Name, phone, suburb, and profile photo.',
  availability: 'Days and times you can work.',
  services: 'Services you can deliver and experience.',
  emergency: 'Who to contact in an emergency.',
  documents: 'Required compliance documents.',
  ndis: 'NDIS-specific worker requirements.',
};

const UNLOCK_BENEFITS = [
  { icon: '💰', label: 'Paid job listings in your area' },
  { icon: '📅', label: 'Set your own schedule & availability' },
  { icon: '⭐', label: 'Client ratings & profile building' },
  { icon: '📊', label: 'Earnings dashboard & payouts' },
];

function sectionHref(section: string) {
  return `/crew/onboarding/${section}`;
}

export default function OnboardingPage() {
  const { user } = useAuth();
  const [data, setData] = useState<OnboardingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewEmployee, setIsNewEmployee] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const meRes = await fetch('/api/crew/me');
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.needsSetup && user) {
            const createRes = await fetch('/api/crew/me', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                full_name: (user.user_metadata?.full_name as string) || user.email || 'New Employee',
                email: user.email || '',
              }),
            });
            if (!createRes.ok && createRes.status !== 409) {
              const err = await createRes.json().catch(() => ({}));
              setLoadError((err as { error?: string }).error || 'Could not create employee profile.');
              setLoading(false);
              return;
            }
            setIsNewEmployee(true);
          }
        }

        const res = await fetch('/api/crew/onboarding');
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setLoadError((body as { error?: string }).error || 'Unable to load onboarding.');
          setLoading(false);
          return;
        }
        const json = await res.json() as OnboardingData;
        setData(json);
        if (json.progress?.completed === 0) setIsNewEmployee(true);
      } catch {
        setLoadError('Unable to load onboarding. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    }

    if (user !== undefined) load();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div
          className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: crewTheme.color.primary, borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="text-center py-24 space-y-3">
        <p style={{ color: crewTheme.color.muted }}>{loadError || 'Unable to load onboarding.'}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm font-semibold underline underline-offset-2"
          style={{ color: crewTheme.color.primary }}
        >
          Refresh page
        </button>
      </div>
    );
  }

  const { sections, progress, onboardingComplete, crewAccessApproved, awaitingApproval } = data;
  const progressPct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const nextSection = sections.find((s) => !s.completed);

  return (
    <div className="space-y-6">

      {/* Full-width welcome banner — new employees */}
      {isNewEmployee && !onboardingComplete && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${crewTheme.color.primary} 0%, #1a5c41 100%)` }}
        >
          <div className="px-6 py-7 sm:px-8 flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0 text-2xl">👋</div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">Welcome to the team!</h1>
                <p className="text-white/80 text-sm mt-1.5 leading-relaxed">
                  Complete the steps below to get verified and start accepting paid jobs.
                  Your application data has been pre-filled where possible.
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap sm:flex-col sm:gap-1.5 shrink-0">
              {['💰 Paid jobs', '📅 Set your hours', '⭐ Build reputation'].map((item) => (
                <span key={item} className="text-xs text-white/80 font-medium bg-white/12 px-3 py-1.5 rounded-full">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Full-width completion banner */}
      {onboardingComplete && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${crewTheme.color.primary} 0%, #1a5c41 100%)` }}
        >
          <div className="px-6 py-7 sm:px-8 flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="flex items-start gap-4 flex-1">
              <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0 text-2xl">🎉</div>
              <div>
                <p className="text-xl font-bold text-white">
                  {crewAccessApproved ? 'Crew access approved!' : 'Profile submitted!'}
                </p>
                <p className="text-white/80 text-sm mt-1 leading-relaxed">
                  {crewAccessApproved
                    ? 'Your crew portal is unlocked. You can now browse jobs, manage your schedule, and start working.'
                    : 'Your onboarding is now with the admin team for approval. You’ll get crew access once they convert you to staff.'}
                </p>
              </div>
            </div>
            <div className="flex gap-3 shrink-0 flex-wrap">
              {crewAccessApproved ? (
                <>
                  <Link
                    href="/crew"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-sm font-semibold shadow-sm hover:shadow-md transition-all active:scale-95"
                    style={{ color: crewTheme.color.primary }}
                  >
                    Crew dashboard
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </Link>
                  <Link
                    href="/crew/jobs"
                    className="inline-flex items-center px-4 py-2.5 rounded-xl bg-white/15 text-sm font-semibold text-white hover:bg-white/25 transition-all"
                  >
                    Browse jobs
                  </Link>
                </>
              ) : (
                <span className="inline-flex items-center px-4 py-2.5 rounded-xl bg-white/15 text-sm font-semibold text-white">
                  {awaitingApproval ? 'Awaiting admin approval' : 'Submitted for review'}
                </span>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_288px] xl:grid-cols-[1fr_312px] gap-8 items-start">

        {/* ── LEFT: Stepper ── */}
        <div>
          {/* Returning employee header */}
          {!isNewEmployee && !onboardingComplete && (
            <div className="mb-6">
              <h1 className="text-2xl font-bold" style={{ color: crewTheme.color.text }}>Complete your profile</h1>
              <p className="text-sm mt-1" style={{ color: crewTheme.color.muted }}>
                {progress.completed} of {progress.total} sections done — finish up to unlock paid jobs.
              </p>
            </div>
          )}

          {/* Section stepper with connecting lines */}
          <div>
            {sections.map((section, idx) => {
              const label = ONBOARDING_SECTION_LABELS[section.section as OnboardingSection] || section.section;
              const href = sectionHref(section.section);
              const desc = SECTION_DESCRIPTIONS[section.section];
              const isNext = !onboardingComplete && nextSection?.section === section.section;
              const isLocked = !section.completed && !isNext && !onboardingComplete;
              const isLast = idx === sections.length - 1;
              const stepNum = idx + 1;

              return (
                <motion.div
                  key={section.section}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  className="flex gap-3 sm:gap-4"
                >
                  {/* Step circle + connecting line */}
                  <div className="flex flex-col items-center" style={{ paddingTop: 2 }}>
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm transition-all duration-300"
                      style={{
                        background: section.completed
                          ? crewTheme.color.primary
                          : isNext
                          ? crewTheme.color.primary
                          : 'rgba(15,61,46,0.1)',
                        color: section.completed || isNext ? 'white' : crewTheme.color.primary,
                        boxShadow: isNext ? `0 0 0 4px ${crewTheme.color.primary}20` : 'none',
                      }}
                    >
                      {section.completed ? (
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        stepNum
                      )}
                    </div>
                    {!isLast && (
                      <div
                        className="w-px mt-2 mb-2 transition-all duration-500"
                        style={{
                          height: 40,
                          background: section.completed
                            ? crewTheme.color.primary
                            : 'rgba(15,61,46,0.12)',
                        }}
                      />
                    )}
                  </div>

                  {/* Step card — locked steps are non-interactive */}
                  {isLocked ? (
                    <div
                      className={`flex-1 flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 ${isLast ? 'mb-0' : 'mb-2'} ${crewTheme.glass} opacity-50 cursor-not-allowed select-none`}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-sm leading-snug" style={{ color: crewTheme.color.text }}>{label}</p>
                        {desc && <p className="text-xs mt-0.5" style={{ color: crewTheme.color.muted }}>{desc}</p>}
                      </div>
                      <svg className="w-4 h-4 shrink-0" style={{ color: crewTheme.color.muted }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                    </div>
                  ) : (
                    <Link
                      href={href}
                      className={`flex-1 flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] ${isLast ? 'mb-0' : 'mb-2'} ${isNext ? '' : crewTheme.glass}`}
                      style={isNext ? {
                        background: `${crewTheme.color.primary}09`,
                        border: `1.5px solid ${crewTheme.color.primary}30`,
                        boxShadow: `0 2px 16px ${crewTheme.color.primary}10`,
                      } : {}}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-sm leading-snug" style={{ color: crewTheme.color.text }}>{label}</p>
                        {desc && <p className="text-xs mt-0.5" style={{ color: crewTheme.color.muted }}>{desc}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {section.completed && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#ECFDF5', color: crewTheme.color.primary }}>
                            Done
                          </span>
                        )}
                        {isNext && (
                          <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full text-white" style={{ background: crewTheme.color.primary }}>
                            Start now
                            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                          </span>
                        )}
                        <svg
                          className="w-4 h-4"
                          style={{ color: isNext ? crewTheme.color.primary : crewTheme.color.muted, opacity: isNext ? 1 : 0.5 }}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Sidebar ── */}
        <div className="space-y-4 lg:sticky lg:top-24">

          {/* Progress card */}
          <div className={`${crewTheme.glass} rounded-2xl p-5`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold" style={{ color: crewTheme.color.text }}>Your progress</p>
              <span className="text-xl font-bold tabular-nums leading-none" style={{ color: crewTheme.color.primary }}>
                {progressPct}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(15,61,46,0.08)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: crewTheme.color.primary }}
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
              />
            </div>

            {/* Step pip indicators */}
            <div className="flex gap-1.5 mb-3">
              {sections.map((s) => (
                <div
                  key={s.section}
                  className="h-1.5 flex-1 rounded-full transition-all duration-300"
                  style={{ background: s.completed ? crewTheme.color.primary : 'rgba(15,61,46,0.12)' }}
                />
              ))}
            </div>

            <p className="text-xs" style={{ color: crewTheme.color.muted }}>
              {progress.completed} of {progress.total} sections complete
              {nextSection && (
                <>
                  {' · '}
                  <span className="font-medium" style={{ color: crewTheme.color.primary }}>
                    {ONBOARDING_SECTION_LABELS[nextSection.section as OnboardingSection] || nextSection.section}
                  </span>
                  {' '}is next
                </>
              )}
              {onboardingComplete && (
                <span className="font-semibold" style={{ color: crewTheme.color.primary }}> All done!</span>
              )}
            </p>

            <div className="mt-4 pt-3 flex items-center gap-1.5" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <svg className="h-3 w-3 shrink-0" style={{ color: crewTheme.color.primary }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <p className="text-xs" style={{ color: crewTheme.color.muted }}>Data is secure &amp; private</p>
            </div>
          </div>

          {/* What you unlock */}
          <div
            className="rounded-2xl p-5"
            style={{ background: `${crewTheme.color.primary}08`, border: `1px solid ${crewTheme.color.primary}18` }}
          >
            <p className="text-sm font-semibold mb-3.5" style={{ color: crewTheme.color.text }}>
              {onboardingComplete ? 'Pending approval unlocks:' : 'Once approved, you unlock:'}
            </p>
            <div className="space-y-2.5">
              {UNLOCK_BENEFITS.map((item) => (
                <div key={item.label} className="flex items-start gap-2.5">
                  <span className="text-sm leading-none mt-0.5">{item.icon}</span>
                  <span className="text-xs font-medium leading-snug" style={{ color: crewTheme.color.text }}>{item.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <p className="text-xs" style={{ color: crewTheme.color.muted }}>
                Approval takes 1–2 business days after your profile is submitted.
              </p>
            </div>
          </div>

          {/* Help */}
          <div className={`${crewTheme.glass} rounded-2xl p-5`}>
            <div className="flex items-center gap-2.5 mb-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${crewTheme.color.primary}12`, color: crewTheme.color.primary }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <p className="text-sm font-semibold" style={{ color: crewTheme.color.text }}>Need help?</p>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: crewTheme.color.muted }}>
              Questions about a section or the requirements? Our team is happy to help.
            </p>
            <a
              href="mailto:admin@budsatwork.com"
              className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold"
              style={{ color: crewTheme.color.primary }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 5L2 7" />
              </svg>
              admin@budsatwork.com
            </a>
          </div>

        </div>
      </div>
    </div>
  );
}
