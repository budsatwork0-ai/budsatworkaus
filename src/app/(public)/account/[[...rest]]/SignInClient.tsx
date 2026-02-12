'use client';

import Link from 'next/link';
import { SignIn } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { brand, glass } from '../../../ui/theme';

// Icons
function LeafIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 4c-7 0-12 5-12 12 0 2 1 4 3 4 7 0 11-7 9-16z" />
      <path d="M11 13l-6 6" />
    </svg>
  );
}

function SparkleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
    </svg>
  );
}

function HomeIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5.5 10v11h13V10" />
    </svg>
  );
}

function CarIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 13l2-5a3 3 0 0 1 2.8-2h8.4A3 3 0 0 1 19 8l2 5" />
      <path d="M5 13h14" />
      <circle cx="7.5" cy="17.5" r="1.5" />
      <circle cx="16.5" cy="17.5" r="1.5" />
      <path d="M3 13v4M21 13v4" />
    </svg>
  );
}

const features = [
  { icon: <HomeIcon />, text: 'Manage your bookings' },
  { icon: <CarIcon />, text: 'Track service history' },
  { icon: <SparkleIcon />, text: 'Get exclusive offers' },
];

export default function SignInClient({ hasClerkKeys }: { hasClerkKeys: boolean }) {
  if (!hasClerkKeys) {
    return (
      <main className="min-h-[calc(100vh-180px)] flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={`${glass} rounded-3xl p-8 md:p-10 max-w-md w-full text-center`}
        >
          <div
            className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
            style={{ background: `${brand.primary}15`, color: brand.primary }}
          >
            <LeafIcon className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold mb-3" style={{ color: brand.text }}>
            Dashboard Access
          </h1>
          <p className="text-base mb-6" style={{ color: brand.muted }}>
            Clerk is not configured for this build. Visit the dashboard directly to preview the UI.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex rounded-full px-6 py-3 text-base font-semibold text-white shadow-lg hover:shadow-xl transition-shadow"
            style={{ background: brand.primary }}
          >
            Open Dashboard
          </Link>
          <p className="mt-6 text-xs" style={{ color: brand.muted }}>
            Set <code className="bg-slate-100 px-1.5 py-0.5 rounded">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and{' '}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded">CLERK_SECRET_KEY</code> to enable sign in.
          </p>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-180px)] flex">
      {/* Left Panel - Branding */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{ background: brand.primary }}
      >
        {/* Decorative background pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="white" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#grid)" />
          </svg>
        </div>

        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(0,0,0,0.2) 0%, transparent 50%)',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <LeafIcon className="h-7 w-7 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">Buds at Work</span>
            </div>

            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
              Welcome back,
              <br />
              <span className="text-emerald-300">mate.</span>
            </h1>

            <p className="text-lg text-white/80 max-w-md mb-10 leading-relaxed">
              Sign in to manage your bookings, track your service history, and get exclusive offers from your local crew.
            </p>

            {/* Features list */}
            <div className="space-y-4">
              {features.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 + i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center text-white">
                    {feature.icon}
                  </div>
                  <span className="text-white/90 font-medium">{feature.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Bottom decoration */}
          <div className="absolute bottom-8 left-12 xl:left-16 right-12">
            <p className="text-sm text-white/50">
              Serving Logan & South Brisbane
            </p>
          </div>
        </div>

        {/* Decorative floating elements */}
        <motion.div
          className="absolute top-20 right-20 w-32 h-32 rounded-full bg-emerald-400/20 blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute bottom-32 right-32 w-24 h-24 rounded-full bg-white/10 blur-2xl"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1,
          }}
        />
      </div>

      {/* Right Panel - Sign In Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="w-full max-w-md"
        >
          {/* Mobile header - only shows on smaller screens */}
          <div className="lg:hidden text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4"
              style={{ background: `${brand.primary}15`, color: brand.primary }}
            >
              <LeafIcon className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: brand.text }}>
              Welcome back
            </h1>
            <p className="mt-2" style={{ color: brand.muted }}>
              Sign in to your Buds at Work account
            </p>
          </div>

          {/* Desktop header */}
          <div className="hidden lg:block mb-8">
            <h2 className="text-2xl font-bold" style={{ color: brand.text }}>
              Sign in to your account
            </h2>
            <p className="mt-2" style={{ color: brand.muted }}>
              Access your dashboard and manage your services
            </p>
          </div>

          {/* Clerk SignIn component with custom appearance */}
          <div className="clerk-sign-in-wrapper">
            <SignIn
              afterSignInUrl="/dashboard"
              afterSignUpUrl="/dashboard"
              appearance={{
                elements: {
                  rootBox: 'w-full',
                  card: 'shadow-none bg-transparent p-0',
                  headerTitle: 'hidden',
                  headerSubtitle: 'hidden',
                  socialButtonsBlockButton: `rounded-xl border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all font-medium`,
                  socialButtonsBlockButtonText: 'font-medium text-slate-700',
                  dividerLine: 'bg-slate-200',
                  dividerText: 'text-slate-400 text-sm',
                  formFieldLabel: 'text-slate-700 font-medium',
                  formFieldInput: `rounded-xl border-2 border-slate-200 focus:border-[${brand.primary}] focus:ring-2 focus:ring-[${brand.primary}]/20 transition-all`,
                  formButtonPrimary: `rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all`,
                  footerActionLink: `text-[${brand.primary}] hover:text-[${brand.primary}] font-medium`,
                  identityPreviewEditButton: `text-[${brand.primary}]`,
                },
                variables: {
                  colorPrimary: brand.primary,
                  colorText: brand.text,
                  colorTextSecondary: brand.muted,
                  borderRadius: '0.75rem',
                },
              }}
            />
          </div>

          {/* Additional links */}
          <div className="mt-8 pt-6 border-t border-slate-200 text-center">
            <p className="text-sm" style={{ color: brand.muted }}>
              Don&apos;t have an account?{' '}
              <Link
                href="/account/sign-up"
                className="font-semibold hover:underline"
                style={{ color: brand.primary }}
              >
                Create one
              </Link>
            </p>
          </div>

          {/* Back to home */}
          <div className="mt-4 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
              style={{ color: brand.muted }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="h-4 w-4"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back to home
            </Link>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
