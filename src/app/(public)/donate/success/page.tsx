import Link from 'next/link';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { attachFundraisingTotals } from '@/lib/fundraising/totals';
import type { FundraisingItem } from '@/app/api/fundraising/route';

export const metadata = {
  title: 'Thank you — Buds At Work',
  description: 'Your contribution helps create real paid employment for people with disabilities.',
};

const palette = {
  green: '#003A34',
  mustard: '#E7A637',
  cream: '#FAF0D9',
  mutedGreen: '#3D6353',
  soft: '#FFF9EB',
  line: 'rgba(0,58,52,0.14)',
};

function formatAUD(cents: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

async function getFundraisingItem(itemId: string): Promise<FundraisingItem | null> {
  const client = createServiceClientSafe();
  if (!client) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('fundraising_items')
    .select('*')
    .eq('id', itemId)
    .in('status', ['live', 'funded'])
    .maybeSingle();

  if (error || !data) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: contributions } = await (client as any)
    .from('fundraising_contributions')
    .select('fundraising_item_id, amount_cents, status')
    .eq('fundraising_item_id', itemId);

  return attachFundraisingTotals([data], contributions ?? [])[0] ?? null;
}

function ProgressBar({ raised, goal }: { raised: number; goal: number }) {
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2 text-sm font-black" style={{ color: palette.green }}>
        <span>{formatAUD(raised)} raised</span>
        <span className="text-xs font-semibold" style={{ color: palette.mutedGreen }}>{pct}% of {formatAUD(goal)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: palette.cream }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: palette.mustard }} />
      </div>
    </div>
  );
}

export default async function DonateSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; item_id?: string }>;
}) {
  const { item_id } = await searchParams;
  const item = item_id ? await getFundraisingItem(item_id) : null;

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

      {item ? (
        /* ── Item-specific thank-you ───────────────────────────── */
        <div className="mx-auto mt-8 w-full max-w-md overflow-hidden rounded-2xl border bg-white shadow-[0_20px_60px_rgba(0,58,52,0.12)]" style={{ borderColor: palette.line }}>
          {item.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image_url}
              alt={item.title}
              className="h-44 w-full object-cover"
            />
          )}
          <div className="p-6 text-left">
            <p className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: palette.mutedGreen }}>
              You helped fund
            </p>
            <h2 className="mt-1 text-xl font-black leading-tight" style={{ color: palette.green }}>
              {item.title}
            </h2>
            {item.short_reason && (
              <p className="mt-3 text-sm leading-6" style={{ color: palette.mutedGreen }}>
                {item.short_reason}
              </p>
            )}
            {item.goal_amount_cents > 0 && (
              <div className="mt-4">
                <ProgressBar raised={item.raised_amount_cents} goal={item.goal_amount_cents} />
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── Generic thank-you ─────────────────────────────────── */
        <p className="mx-auto mt-6 max-w-xl text-lg leading-8" style={{ color: '#52645D' }}>
          Your contribution goes directly toward creating real paid employment for people with
          disabilities. You&apos;ll receive a receipt from Stripe shortly.
        </p>
      )}

      <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
        <Link
          href="/get-involved"
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ background: palette.green, color: '#fff' }}
        >
          {item ? 'See what else needs funding' : 'Back to Get Involved'}
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
