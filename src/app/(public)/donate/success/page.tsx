import Link from 'next/link';

const palette = {
  green: '#003A34',
  mustard: '#E7A637',
  cream: '#FAF0D9',
  mutedGreen: '#3D6353',
  soft: '#FFF9EB',
};

export const metadata = {
  title: 'Thank you — Buds At Work',
  description: 'Your contribution helps create real paid employment for people with disabilities.',
};

export default function DonateSuccessPage() {
  return (
    <div
      className="flex min-h-[80svh] flex-col items-center justify-center px-4 py-20 text-center"
      style={{ background: palette.soft }}
    >
      <div
        className="mb-6 grid h-16 w-16 place-items-center rounded-full"
        style={{ background: palette.green }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8"
          aria-hidden="true"
        >
          <path d="m5 13 4 4L19 7" />
        </svg>
      </div>

      <p
        className="text-xs font-bold uppercase tracking-[0.18em]"
        style={{ color: palette.mutedGreen }}
      >
        Contribution received
      </p>
      <h1 className="mt-3 text-4xl font-black leading-tight md:text-6xl" style={{ color: palette.green }}>
        Thank you.
      </h1>
      <p className="mx-auto mt-6 max-w-xl text-lg leading-8" style={{ color: '#52645D' }}>
        Your contribution goes directly toward creating real paid employment for people with
        disabilities. You&apos;ll receive a receipt from Stripe shortly.
      </p>

      <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
        <Link
          href="/get-involved"
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ background: palette.green, color: '#fff' }}
        >
          Back to Get Involved
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border px-6 py-3 text-sm font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ borderColor: 'rgba(0,58,52,0.2)', color: palette.green }}
        >
          Go to Homepage
        </Link>
      </div>
    </div>
  );
}
