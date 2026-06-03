'use client';

type ChartPoint = {
  label: string;
  value: number;
};

export function RevenueChartCard({ points }: { points: ChartPoint[] }) {
  const max = Math.max(1, ...points.map((point) => point.value));
  const highlightedIndex = points.reduce((best, point, index) => (point.value > points[best].value ? index : best), 0);
  const highlighted = points[highlightedIndex];

  return (
    <section className="rounded-[30px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_18px_48px_rgba(15,61,46,0.07)]">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-[18px] font-extrabold leading-tight text-[#17392b]">Revenue view</h2>
        <select className="h-9 rounded-full border border-[#dfe9e2] bg-white px-4 text-[13px] font-semibold text-[#839188] outline-none">
          <option>Last 7 days</option>
          <option>This month</option>
          <option>Last month</option>
        </select>
      </div>

      <div className="relative flex h-[190px] max-h-[220px] items-end gap-3 overflow-hidden pt-8 sm:gap-4">
        {points.map((point, index) => {
          const isHighlighted = index === highlightedIndex;
          const height = Math.max(42, Math.round((point.value / max) * 145));

          return (
            <div key={`${point.label}-${index}`} className="relative flex min-w-0 flex-1 flex-col items-center justify-end">
              {isHighlighted ? (
                <div className="absolute -top-1 flex flex-col items-center">
                  <span className="rounded-[10px] bg-[#161a17] px-3 py-1 text-sm font-extrabold text-white shadow-lg">
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
              <span className="mt-2 hidden text-xs font-bold text-[#a0ada5] sm:block">{point.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function formatCompact(value: number) {
  if (value >= 1000) return `$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return `$${value}`;
}
