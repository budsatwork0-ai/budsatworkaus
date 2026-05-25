'use client';

import type { NumericParams } from '../../types';
import { cls } from '../../utils/formatting';

interface BinCleansPanelProps {
  dumpParams: NumericParams;
  updateDumpParam: (key: string, value: number) => void;
  setBinPlan: (n: number) => void;
}

export function BinCleansPanel({ dumpParams, updateDumpParam, setBinPlan }: BinCleansPanelProps) {
  const redBins = Math.max(0, dumpParams.redBins ?? 0);
  const redBinFreq = Math.max(0, Math.min(2, dumpParams.redBinFreq ?? 0)); // 0=oneoff, 1=weekly, 2=fortnightly
  const yellowBins = Math.max(0, dumpParams.yellowBins ?? 0);
  const yellowBinFreq = Math.max(0, Math.min(1, dumpParams.yellowBinFreq ?? 0)); // 0=oneoff, 1=fortnightly
  const greenBins = Math.max(0, dumpParams.greenBins ?? 0);
  const greenBinFreq = Math.max(0, Math.min(1, dumpParams.greenBinFreq ?? 0)); // 0=oneoff, 1=monthly
  const kitchenBins = Math.max(0, dumpParams.kitchenBins ?? 0);
  const binPlan = Math.max(0, Math.min(2, dumpParams.binPlan ?? 0)); // 0=none, 1=household, 2=lite

  const totalWheelies = redBins + yellowBins + greenBins;
  const validKitchenBins = totalWheelies > 0 ? kitchenBins : 0;

  const setRedBins = (n: number) => updateDumpParam('redBins', Math.max(0, Math.min(10, Math.round(n))));
  const setRedBinFreq = (n: number) => updateDumpParam('redBinFreq', Math.max(0, Math.min(2, n)));
  const setYellowBins = (n: number) => updateDumpParam('yellowBins', Math.max(0, Math.min(10, Math.round(n))));
  const setYellowBinFreq = (n: number) => updateDumpParam('yellowBinFreq', Math.max(0, Math.min(1, n)));
  const setGreenBins = (n: number) => updateDumpParam('greenBins', Math.max(0, Math.min(10, Math.round(n))));
  const setGreenBinFreq = (n: number) => updateDumpParam('greenBinFreq', Math.max(0, Math.min(1, n)));
  const setKitchenBins = (n: number) => updateDumpParam('kitchenBins', Math.max(0, Math.min(5, Math.round(n))));

  return (
    <div
      data-card-interactive="true"
      className="rounded-xl border border-black/5 bg-white/90 p-4 shadow-sm"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between text-sm mb-3">
        <div className="font-semibold text-slate-900">Bin Cleaning</div>
        <div className="text-[10px] text-slate-500">Select bins &amp; frequency</div>
      </div>

      <div className="space-y-3 text-xs">
        {/* Subscription Plans */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <div className="text-[11px] font-semibold text-slate-800">Choose your plan</div>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <div className="grid grid-cols-1 gap-2">
            {/* Pay per clean option */}
            <button
              type="button"
              className={cls(
                'w-full p-3 rounded-xl border-2 text-left transition-all',
                binPlan === 0
                  ? 'border-slate-400 bg-white shadow-sm'
                  : 'border-transparent bg-slate-50 hover:bg-slate-100'
              )}
              onClick={(e) => { e.stopPropagation(); setBinPlan(0); }}
              aria-label="No subscription plan"
            >
              <div className="flex items-center gap-2.5">
                <div className={cls(
                  'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                  binPlan === 0 ? 'border-slate-600' : 'border-slate-300'
                )}>
                  {binPlan === 0 && <div className="w-2 h-2 rounded-full bg-slate-600" />}
                </div>
                <div>
                  <div className="text-[12px] font-medium text-slate-800">Pay per clean</div>
                  <div className="text-[10px] text-slate-500">No commitment &mdash; book when you need it</div>
                </div>
              </div>
            </button>

            {/* Household Plan */}
            <button
              type="button"
              className={cls(
                'w-full p-3 rounded-xl border-2 text-left transition-all relative overflow-hidden',
                binPlan === 1
                  ? 'border-emerald-500 bg-emerald-50/60 shadow-sm'
                  : 'border-transparent bg-slate-50 hover:bg-slate-100'
              )}
              onClick={(e) => { e.stopPropagation(); setBinPlan(1); }}
              aria-label="Household Bin Care Plan"
            >
              <div className="flex items-start gap-2.5">
                <div className={cls(
                  'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                  binPlan === 1 ? 'border-emerald-600' : 'border-slate-300'
                )}>
                  {binPlan === 1 && <div className="w-2 h-2 rounded-full bg-emerald-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[12px] font-medium text-slate-800">Household Plan</div>
                    <div className={cls(
                      'text-[12px] font-bold tabular-nums',
                      binPlan === 1 ? 'text-emerald-700' : 'text-slate-600'
                    )}>$35<span className="text-[10px] font-normal text-slate-500">/mo</span></div>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Up to 5 bins, cleaned monthly</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">+$6 per extra bin</div>
                </div>
              </div>
              {binPlan === 1 && <div className="absolute top-0 left-0 w-full h-0.5 bg-emerald-500" />}
            </button>

            {/* Bin Care Lite */}
            <button
              type="button"
              className={cls(
                'w-full p-3 rounded-xl border-2 text-left transition-all relative overflow-hidden',
                binPlan === 2
                  ? 'border-sky-500 bg-sky-50/60 shadow-sm'
                  : 'border-transparent bg-slate-50 hover:bg-slate-100'
              )}
              onClick={(e) => { e.stopPropagation(); setBinPlan(2); }}
              aria-label="Bin Care Lite plan"
            >
              <div className="flex items-start gap-2.5">
                <div className={cls(
                  'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                  binPlan === 2 ? 'border-sky-600' : 'border-slate-300'
                )}>
                  {binPlan === 2 && <div className="w-2 h-2 rounded-full bg-sky-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[12px] font-medium text-slate-800">Bin Care Lite</div>
                    <div className={cls(
                      'text-[12px] font-bold tabular-nums',
                      binPlan === 2 ? 'text-sky-700' : 'text-slate-600'
                    )}>$29<span className="text-[10px] font-normal text-slate-500">/mo</span></div>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Up to 3 bins, cleaned monthly</div>
                </div>
              </div>
              {binPlan === 2 && <div className="absolute top-0 left-0 w-full h-0.5 bg-sky-500" />}
            </button>
          </div>
        </div>

        {/* Bin selection — compact rows */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold text-slate-700">
                {binPlan > 0 ? 'Which bins do you have?' : 'Select your bins'}
              </div>
              {binPlan > 0 && (
                <div className="text-[10px] text-slate-500">All cleaned monthly</div>
              )}
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {/* Red — General Waste */}
            <div className="px-3 py-2.5">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium text-slate-800">General waste</div>
                  <div className="text-[10px] text-slate-500">Red lid</div>
                </div>
                <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5">
                  <button type="button" className="w-5 h-5 flex items-center justify-center rounded-full text-[11px] hover:bg-white" aria-label="Decrease red bins" onClick={(e) => { e.stopPropagation(); setRedBins(redBins - 1); }}>–</button>
                  <span className="min-w-[18px] text-center font-semibold text-[12px]">{redBins}</span>
                  <button type="button" className="w-5 h-5 flex items-center justify-center rounded-full text-[11px] hover:bg-white" aria-label="Increase red bins" onClick={(e) => { e.stopPropagation(); setRedBins(redBins + 1); }}>+</button>
                </div>
                {binPlan === 0 && redBins > 0 && (
                  <div className="text-[10px] text-slate-500 tabular-nums w-10 text-right">${redBinFreq === 0 ? 25 : redBinFreq === 1 ? 18 : 20}<span className="text-slate-400">/ea</span></div>
                )}
              </div>
              {redBins > 0 && binPlan === 0 && (
                <div className="flex gap-1 mt-2 ml-6">
                  {[
                    { val: 0, label: 'One-off' },
                    { val: 1, label: 'Weekly' },
                    { val: 2, label: 'Fortnightly' },
                  ].map((opt) => (
                    <button key={opt.val} type="button" className={cls('px-2 py-0.5 rounded-full border text-[10px] transition-colors', redBinFreq === opt.val ? 'bg-red-500 text-white border-red-500' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')} onClick={(e) => { e.stopPropagation(); setRedBinFreq(opt.val); }} aria-label={`${opt.label} frequency for red bins`}>{opt.label}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Yellow — Recycling */}
            <div className="px-3 py-2.5">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-yellow-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium text-slate-800">Recycling</div>
                  <div className="text-[10px] text-slate-500">Yellow lid</div>
                </div>
                <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5">
                  <button type="button" className="w-5 h-5 flex items-center justify-center rounded-full text-[11px] hover:bg-white" aria-label="Decrease yellow bins" onClick={(e) => { e.stopPropagation(); setYellowBins(yellowBins - 1); }}>–</button>
                  <span className="min-w-[18px] text-center font-semibold text-[12px]">{yellowBins}</span>
                  <button type="button" className="w-5 h-5 flex items-center justify-center rounded-full text-[11px] hover:bg-white" aria-label="Increase yellow bins" onClick={(e) => { e.stopPropagation(); setYellowBins(yellowBins + 1); }}>+</button>
                </div>
                {binPlan === 0 && yellowBins > 0 && (
                  <div className="text-[10px] text-slate-500 tabular-nums w-10 text-right">${yellowBinFreq === 0 ? 20 : 15}<span className="text-slate-400">/ea</span></div>
                )}
              </div>
              {yellowBins > 0 && binPlan === 0 && (
                <div className="flex gap-1 mt-2 ml-6">
                  {[
                    { val: 0, label: 'One-off' },
                    { val: 1, label: 'Fortnightly' },
                  ].map((opt) => (
                    <button key={opt.val} type="button" className={cls('px-2 py-0.5 rounded-full border text-[10px] transition-colors', yellowBinFreq === opt.val ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')} onClick={(e) => { e.stopPropagation(); setYellowBinFreq(opt.val); }} aria-label={`${opt.label} frequency for yellow bins`}>{opt.label}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Green — Garden */}
            <div className="px-3 py-2.5">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium text-slate-800">Garden waste</div>
                  <div className="text-[10px] text-slate-500">Green lid</div>
                </div>
                <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5">
                  <button type="button" className="w-5 h-5 flex items-center justify-center rounded-full text-[11px] hover:bg-white" aria-label="Decrease green bins" onClick={(e) => { e.stopPropagation(); setGreenBins(greenBins - 1); }}>–</button>
                  <span className="min-w-[18px] text-center font-semibold text-[12px]">{greenBins}</span>
                  <button type="button" className="w-5 h-5 flex items-center justify-center rounded-full text-[11px] hover:bg-white" aria-label="Increase green bins" onClick={(e) => { e.stopPropagation(); setGreenBins(greenBins + 1); }}>+</button>
                </div>
                {binPlan === 0 && greenBins > 0 && (
                  <div className="text-[10px] text-slate-500 tabular-nums w-10 text-right">${greenBinFreq === 0 ? 22 : 17}<span className="text-slate-400">/ea</span></div>
                )}
              </div>
              {greenBins > 0 && binPlan === 0 && (
                <div className="flex gap-1 mt-2 ml-6">
                  {[
                    { val: 0, label: 'One-off' },
                    { val: 1, label: 'Monthly' },
                  ].map((opt) => (
                    <button key={opt.val} type="button" className={cls('px-2 py-0.5 rounded-full border text-[10px] transition-colors', greenBinFreq === opt.val ? 'bg-green-600 text-white border-green-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')} onClick={(e) => { e.stopPropagation(); setGreenBinFreq(opt.val); }} aria-label={`${opt.label} frequency for green bins`}>{opt.label}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Kitchen — Add-on */}
            <div className={cls('px-3 py-2.5', totalWheelies === 0 && 'opacity-40')}>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded bg-amber-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="text-[11px] font-medium text-slate-800">Kitchen caddy</div>
                    <span className="text-[8px] px-1 py-px rounded bg-slate-200 text-slate-500 uppercase tracking-wide">Add-on</span>
                  </div>
                  <div className="text-[10px] text-slate-500">{totalWheelies === 0 ? 'Add a wheelie bin first' : '$7.50/ea — cleaned same visit'}</div>
                </div>
                {totalWheelies > 0 && (
                  <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5">
                    <button type="button" className="w-5 h-5 flex items-center justify-center rounded-full text-[11px] hover:bg-white" aria-label="Decrease kitchen bins" onClick={(e) => { e.stopPropagation(); setKitchenBins(kitchenBins - 1); }}>–</button>
                    <span className="min-w-[18px] text-center font-semibold text-[12px]">{kitchenBins}</span>
                    <button type="button" className="w-5 h-5 flex items-center justify-center rounded-full text-[11px] hover:bg-white" aria-label="Increase kitchen bins" onClick={(e) => { e.stopPropagation(); setKitchenBins(kitchenBins + 1); }}>+</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bin count note for plans */}
          {binPlan > 0 && totalWheelies > 0 && (
            <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500">
              {totalWheelies} of {binPlan === 1 ? 5 : 3} included bins used{totalWheelies > (binPlan === 1 ? 5 : 3) ? ` — ${totalWheelies - (binPlan === 1 ? 5 : 3)} extra at $6/ea` : ''}
            </div>
          )}
        </div>

        {/* Info footer */}
        <div className="text-[10px] text-slate-500 leading-relaxed">
          Flat rates per bin, no hidden fees. Subscriptions lock in lower rates and guarantee your spot.
          {(totalWheelies > 0 || validKitchenBins > 0) && (
            <span className="text-slate-400"> Price updates in the bar below.</span>
          )}
        </div>
      </div>
    </div>
  );
}
