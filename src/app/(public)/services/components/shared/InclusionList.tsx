'use client';

import { cls, formatInclusionText } from '../../utils/formatting';

interface InclusionListProps {
  items: string[];
  className?: string;
}

export function InclusionList({ items, className }: InclusionListProps) {
  return (
    <ul className={cls('space-y-1 text-xs text-slate-700', className)}>
      {items.map((inc) => {
        const { isHeader, text } = formatInclusionText(inc);
        if (isHeader) {
          return (
            <li key={inc} className="pt-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              {text}
            </li>
          );
        }
        return (
          <li key={inc} className="flex items-start gap-1.5">
            <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
            <span>{text}</span>
          </li>
        );
      })}
    </ul>
  );
}
