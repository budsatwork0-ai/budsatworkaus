'use client';

/**
 * HelpTip — a small ? badge that shows a plain-English tooltip on hover.
 * Use next to any label that might confuse a non-technical admin.
 *
 * <HelpTip text="Files that lots of other files depend on. Risky to change." />
 */
export function HelpTip({ text, wide }: { text: string; wide?: boolean }) {
  return (
    <span className="group relative inline-flex items-center">
      <span className="ml-1 flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-white/20 text-[9px] font-bold text-white/30 hover:border-white/40 hover:text-white/55 select-none">
        ?
      </span>
      <span
        className={`pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-lg border border-white/[0.12] bg-slate-900/95 p-2.5 text-[11px] leading-relaxed text-white/70 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 ${wide ? 'w-64' : 'w-48'}`}
      >
        {text}
        {/* arrow */}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900/95" />
      </span>
    </span>
  );
}
