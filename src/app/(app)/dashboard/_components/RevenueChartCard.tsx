'use client';

type ChartPoint = {
  label: string;
  value: number;
};

export function RevenueChartCard({ points }: { points: ChartPoint[] }) {
  const max = Math.max(1, ...points.map((point) => point.value));
  const highlightedIndex = points.reduce((best, point, index) => (point.value > points[best].value ? index : best), 0);
  const highlighted = points[highlightedIndex];
  const hasRevenue = points.some((point) => point.value > 0);

  return (
    <section className="rounded-[26px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_18px_48px_rgba(15,61,46,0.07)]">
      <div className="mb-2 flex items-center justify-between gap-4">
        <h2 className="text-[18px] font-extrabold leading-tight text-[#17392b]">Revenue view</h2>
        <span className="rounded-full border border-[#dfe9e2] bg-[#fbfdfb] px-3 py-1 text-[12px] font-bold text-[#839188]">14 days</span>
      </div>

      <div className="relative flex h-[185px] max-h-[205px] items-end gap-2 overflow-hidden pt-7 sm:gap-3">
        {points.length === 0 ? (
          <div className="grid h-full w-full place-items-center rounded-[20px] bg-[#f4faf6] text-[13px] font-semibold text-[#7f9187]">No revenue recorded</div>
        ) : points.map((point, index) => {
          const isHighlighted = index === highlightedIndex;
          const height = hasRevenue ? Math.max(20, Math.round((point.value / max) * 135)) : 16;

          return (
            <div key={`${point.label}-${index}`} className="relative flex min-w-0 flex-1 flex-col items-center justify-end">
              {isHighlighted && hasRevenue ? (
                <div className="absolute -top-1 flex flex-col items-center">
                  <span className="rounded-[10px] bg-[#161a17] px-2.5 py-1 text-[12px] font-extrabold text-white shadow-lg">
                    {formatCompact(highlighted.value)}
                  </span>
                  <span className="mt-1 h-3 w-3 rounded-full border-4 border-white bg-[#3c8259] shadow" />
                </div>
              ) : null}
              <div
                className={`w-full rounded-t-[10px] rounded-b-[10px] transition ${isHighlighted ? 'bg-[#3c8259]' : 'bg-[#e6eee8]'}`}
                style={{ height }}
                aria-label={`${point.label}: ${formatCompact(point.value)}`}
              />
              <span className="mt-2 hidden text-[11px] font-bold text-[#a0ada5] sm:block">{point.label}</span>
            </div>
          );
        })}
      </div>
      {!hasRevenue && points.length > 0 ? (
        <p className="mt-2 text-center text-[12px] font-semibold text-[#7f9187]">No revenue recorded</p>
      ) : null}
    </section>
  );
}

function formatCompact(value: number) {
  if (value >= 1000) return `$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return `$${value}`;
}
