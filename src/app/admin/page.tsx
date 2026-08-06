import { createServiceClient } from '@/lib/supabase/server';
import Link from 'next/link';

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  href,
  accent = false,
}: {
  label: string;
  value: number;
  href?: string;
  accent?: boolean;
}) {
  const inner = (
    <div
      className={[
        'flex flex-col gap-1 rounded-2xl px-6 py-5 transition-shadow',
        'bg-white/10 backdrop-blur-md border border-white/20 shadow-sm',
        href ? 'hover:shadow-md hover:bg-white/15 cursor-pointer' : '',
        accent && value > 0 ? 'ring-2 ring-amber-400/60' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="text-[2rem] font-bold leading-none text-white tabular-nums">
        {value}
      </span>
      <span className="text-xs font-medium uppercase tracking-widest text-white/70">
        {label}
      </span>
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ─── Server component — fetches stats at request time ────────────────────────
export default async function AdminDashboardPage() {
  const supabase = createServiceClient();

  // Today's date range (local midnight → next midnight, stored as ISO strings)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [totalRes, pendingRes, todayRes] = await Promise.all([
    // Total bookings ever
    supabase.from('bookings').select('id', { count: 'exact', head: true }),

    // Pending confirmation (status = 'pending')
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),

    // Scheduled for today
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .gte('scheduled_at', todayStart.toISOString())
      .lt('scheduled_at', todayEnd.toISOString()),
  ]);

  const totalBookings = totalRes.count ?? 0;
  const pendingCount = pendingRes.count ?? 0;
  const todayCount = todayRes.count ?? 0;

  return (
    <div className="space-y-8">
      {/* ── Stat summary bar ───────────────────────────────────────────── */}
      <section aria-label="Dashboard summary">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-3">
          At a glance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Total bookings"
            value={totalBookings}
            href="/admin/bookings"
          />
          <StatCard
            label="Pending confirmation"
            value={pendingCount}
            href="/admin/bookings?status=pending"
            accent
          />
          <StatCard
            label="Scheduled today"
            value={todayCount}
            href="/admin/bookings?filter=today"
          />
        </div>
      </section>

      {/* ── Quick-nav links ────────────────────────────────────────────── */}
      <section aria-label="Quick navigation">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-3">
          Quick links
        </h2>
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'All bookings', href: '/admin/bookings' },
            { label: 'Services', href: '/admin/services' },
            { label: 'Settings', href: '/admin/settings' },
          ].map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="rounded-xl px-5 py-2.5 text-sm font-medium text-white/80 bg-white/10 border border-white/20 hover:bg-white/15 hover:text-white transition-colors backdrop-blur-sm"
            >
              {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
