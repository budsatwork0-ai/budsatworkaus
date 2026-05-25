'use client';

import type { DumpRunSelection, WizardState } from '../../types';
import { DEFAULT_DUMP_RUN } from '../../lib/pricing/constants';
import { cls } from '../../utils/formatting';

interface DumpRunsPanelProps {
  S: WizardState;
  set: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  isConfigOpen: boolean;
}

export function DumpRunsPanel({ S, set, isConfigOpen }: DumpRunsPanelProps) {
  const dumpRunState = S.dumpRun || DEFAULT_DUMP_RUN;
  const dumpLoadType = dumpRunState.loadType;
  const dumpLoads = Math.max(1, Math.round(dumpRunState.loads || 1));
  const updateDumpRun = (next: Partial<DumpRunSelection>) =>
    set('dumpRun', { ...dumpRunState, ...next });

  const dumpHints = (() => {
    if (!isConfigOpen) return null;
    const typeLabel =
      dumpLoadType === 'single_item'
        ? 'single item'
        : dumpLoadType === 'ute'
        ? 'ute load'
        : dumpLoadType === 'half_trailer'
        ? 'half trailer'
        : dumpLoadType === 'trailer'
        ? 'trailer full'
        : dumpLoadType === 'bulky'
        ? 'bulky furniture'
        : 'mixed load';
    const volumePer =
      dumpLoadType === 'single_item'
        ? 0.5
        : dumpLoadType === 'ute'
        ? 1.5
        : dumpLoadType === 'half_trailer'
        ? 2.0
        : dumpLoadType === 'trailer'
        ? 2.5
        : dumpLoadType === 'bulky'
        ? 2.0
        : 1.2;
    const totalVol = Math.max(1, dumpLoads) * volumePer;
    const baseLow =
      dumpLoadType === 'single_item' ? 20 : dumpLoadType === 'bulky' ? 50 : 40;
    const baseHigh =
      dumpLoadType === 'single_item' ? 40 : dumpLoadType === 'bulky' ? 90 : 80;
    const minsLow = baseLow + (dumpLoads - 1) * 15;
    const minsHigh = baseHigh + (dumpLoads - 1) * 20;
    const techs =
      dumpLoadType === 'single_item'
        ? 'Usually a solo tech.'
        : dumpLoadType === 'bulky' || dumpLoads >= 3
        ? 'Usually requires 2 techs.'
        : 'Typically 1–2 techs.';
    return {
      line1: `Looks like approximately ~${Math.round(totalVol * 10) / 10} cubic metres (${typeLabel}).`,
      line2: `Most jobs like this take around ${Math.max(30, minsLow)}–${minsHigh} minutes onsite.`,
      line3: techs,
    };
  })();

  return (
    <div
      data-card-interactive="true"
      className="rounded-xl border border-black/5 bg-white/80 p-3"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between text-sm">
        <div className="font-semibold text-slate-900">Add Details</div>
        <div className="text-[11px] text-slate-600">Adjusts time &amp; cost</div>
      </div>
      <div className="mt-3 space-y-2 text-xs text-slate-700">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'single_item',  label: 'Single item' },
            { key: 'ute',          label: 'Ute load' },
            { key: 'half_trailer', label: 'Half trailer' },
            { key: 'trailer',      label: 'Trailer full' },
            { key: 'bulky',        label: 'Bulky furniture' },
          ].map((c) => (
            <button
              key={c.key}
              type="button"
              className={cls(
                'px-3 py-1 rounded-full border text-sm',
                dumpLoadType === c.key ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10'
              )}
              onClick={(e) => {
                e.stopPropagation();
                updateDumpRun({
                  loadType: c.key as
                    | 'single_item'
                    | 'ute'
                    | 'half_trailer'
                    | 'trailer'
                    | 'bulky',
                });
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-700">Number of loads</span>
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-2 py-1">
            <button
              type="button"
              className="px-2 py-0.5 rounded-full border border-black/10 text-[11px]"
              onClick={(e) => {
                e.stopPropagation();
                const next = Math.max(1, Math.min(6, dumpLoads - 1));
                updateDumpRun({ loads: next });
              }}
              aria-label="Decrease loads"
            >
              –
            </button>
            <span className="min-w-[24px] text-center font-semibold">{dumpLoads}</span>
            <button
              type="button"
              className="px-2 py-0.5 rounded-full border border-black/10 text-[11px]"
              onClick={(e) => {
                e.stopPropagation();
                const next = Math.max(1, Math.min(6, dumpLoads + 1));
                updateDumpRun({ loads: next });
              }}
              aria-label="Increase loads"
            >
              +
            </button>
          </div>
        </div>
        {dumpHints && (
          <div className="text-[11px] text-slate-600 space-y-1">
            <div>{dumpHints.line1}</div>
            <div>{dumpHints.line2}</div>
            <div>{dumpHints.line3}</div>
          </div>
        )}
      </div>
    </div>
  );
}
