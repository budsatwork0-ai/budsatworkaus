export default function MissionControlLoading() {
  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-black text-white">
      <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6">

        {/* Header skeleton */}
        <header className="flex flex-wrap items-center gap-3 pb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-white/20 animate-pulse" />
            <div>
              <div className="h-2.5 w-24 rounded bg-white/10 animate-pulse mb-1.5" />
              <div className="h-6 w-40 rounded bg-white/15 animate-pulse" />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="h-6 w-20 rounded-full bg-white/10 animate-pulse" />
            <div className="h-6 w-16 rounded-md bg-white/10 animate-pulse" />
          </div>
        </header>

        {/* Tab bar skeleton */}
        <div className="sticky top-0 z-10 -mx-4 mb-5 border-b border-white/[0.07] bg-slate-950/85 px-4 sm:-mx-6 sm:px-6">
          <div className="flex gap-1 py-1">
            {['Overview', 'Terminal', 'Knowledge', 'Design System'].map((label) => (
              <div key={label} className="shrink-0 px-3.5 py-2.5">
                <div className="h-3 w-16 rounded bg-white/10 animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Content skeleton */}
        <div className="space-y-4">
          {/* State + vitals row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
                <div className="h-3 w-20 rounded bg-white/10 animate-pulse mb-3" />
                <div className="h-7 w-14 rounded bg-white/15 animate-pulse" />
              </div>
            ))}
          </div>

          {/* Main panels */}
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 space-y-3">
              <div className="h-4 w-32 rounded bg-white/10 animate-pulse" />
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 w-full rounded-xl bg-white/[0.04] animate-pulse" />
              ))}
            </div>
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 space-y-3">
              <div className="h-4 w-28 rounded bg-white/10 animate-pulse" />
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 w-full rounded-xl bg-white/[0.04] animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
