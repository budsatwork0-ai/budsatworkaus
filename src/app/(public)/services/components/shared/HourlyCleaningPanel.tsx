'use client';

interface HourlyCleaningPanelProps {
  inclusionMinClass: string;
}

export function HourlyCleaningPanel({ inclusionMinClass }: HourlyCleaningPanelProps) {
  return (
    <div className={`mt-2 ${inclusionMinClass}`}>
      <ul className="space-y-1 text-[11px] text-slate-700">
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
          <span>3-hour minimum</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
          <span>$60/hr</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
          <span>You choose what gets cleaned</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
          <span>Smart Floor Plan included</span>
        </li>
      </ul>
    </div>
  );
}
