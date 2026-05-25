'use client';

import React from 'react';
import type { SneakerTurnaround, WizardState } from '../../types';
import { SNEAKER_TURNAROUND_META, SNEAKER_MULTI_PRICING } from '../../lib/pricing/constants';
import { cls, fmtAUD } from '../../utils/formatting';

interface SneakerCarePanelProps {
  S: WizardState;
  set: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  isSneakerTurnaroundAvailable: (key: SneakerTurnaround) => boolean;
  isConfigOpen: boolean;
}

export function SneakerCarePanel({ S, set, isSneakerTurnaroundAvailable, isConfigOpen }: SneakerCarePanelProps) {
  const isSneakerRefresh = S.sneakerTier === 'refresh';
  const isSneakerDeep    = S.sneakerTier === 'deep';
  const isSneakerMulti   = S.sneakerTier === 'multi';

  const [refreshMaterial, setRefreshMaterial] = React.useState<
    'mesh' | 'leather' | 'synthetic' | 'suede' | 'boots' | null
  >(null);
  const [refreshConcern, setRefreshConcern] = React.useState<
    'dirt' | 'yellowing' | 'scuffs' | 'odour' | 'wear' | null
  >(null);
  const [deepSoiling, setDeepSoiling] = React.useState<'light' | 'noticeable' | 'heavy'>('light');
  const [deepSensitive, setDeepSensitive] = React.useState<Set<'suede' | 'dyed' | 'collectible'>>(
    () => new Set()
  );
  const [multiPairs, setMultiPairs] = React.useState(1);
  const [multiMixed, setMultiMixed] = React.useState<'yes' | 'no'>('no');

  const refreshHints = (() => {
    if (!(isConfigOpen && isSneakerRefresh)) return null;
    const materialHint =
      refreshMaterial === 'mesh'
        ? 'Mesh pairs respond really well to Refresh cleans.'
        : refreshMaterial === 'leather'
        ? 'Leather pairs get gentle, material-safe cleaning.'
        : refreshMaterial === 'synthetic'
        ? 'Synthetic uppers clean up nicely with a refresh.'
        : refreshMaterial === 'suede'
        ? 'Thanks — suede is cleaned with material-safe methods.'
        : refreshMaterial === 'boots'
        ? 'Boots get an exterior uplift; we keep it material-safe.'
        : "We'll match the clean to the material.";
    const concernHint =
      refreshConcern === 'yellowing'
        ? 'Yellowing often needs deeper treatment — Deep Restore may be better.'
        : refreshConcern === 'scuffs'
        ? 'Light scuffs get cosmetic attention in Refresh.'
        : refreshConcern === 'odour'
        ? 'Odour treatment is included in Refresh Clean.'
        : refreshConcern === 'wear'
        ? "Wear & tear is noted — we'll set expectations clearly."
        : 'General dirt is well suited to Refresh Clean.';
    return [materialHint, concernHint];
  })();

  const deepHints = (() => {
    if (!(isConfigOpen && isSneakerDeep)) return null;
    const soilingHint =
      deepSoiling === 'heavy'
        ? 'Heavily worn pairs usually benefit the most from Deep Restore.'
        : deepSoiling === 'noticeable'
        ? 'Noticeably dirty pairs are a great fit for Deep Restore.'
        : 'Lightly worn pairs still get full deep care.';
    const sensitives = Array.from(deepSensitive);
    const sensitiveHint = sensitives.length
      ? "We'll take extra care with suede, dyed leather, and collectible pairs."
      : "We'll still handle carefully — no sensitive materials flagged.";
    return [soilingHint, sensitiveHint];
  })();

  const multiHints = (() => {
    if (!(isConfigOpen && isSneakerMulti)) return null;
    const countHint =
      multiPairs >= 10
        ? 'Batch discounts may apply depending on quantity.'
        : multiPairs >= 4
        ? 'Larger batches can be grouped for efficiency.'
        : 'Small batches are easy to schedule together.';
    const mixHint =
      multiMixed === 'yes'
        ? 'You can mix Refresh and Deep Restore in the same booking.'
        : 'All pairs same care — quick to batch together.';
    return [countHint, mixHint, 'We can return pairs together or separately.'];
  })();

  return (
    <>
      {/* Tier Selector */}
      <div
        data-card-interactive="true"
        className="rounded-xl border border-black/5 bg-white/80 p-3 space-y-2"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-semibold text-slate-900">Care level</div>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'refresh', label: 'Refresh Clean', price: '$40' },
            { key: 'deep',    label: 'Deep Restore',  price: '$60' },
            { key: 'multi',   label: 'Multi-Pair',    price: 'from $40' },
          ].map((tier) => (
            <button
              key={tier.key}
              type="button"
              onClick={(e) => { e.stopPropagation(); set('sneakerTier', tier.key as any); }}
              className={cls(
                'rounded-full border px-3 py-1.5 text-sm flex items-center gap-2',
                S.sneakerTier === tier.key
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white border-black/10 hover:border-emerald-300',
              )}
            >
              <span>{tier.label}</span>
              <span className={cls('text-xs', S.sneakerTier === tier.key ? 'text-emerald-100' : 'text-slate-500')}>
                {tier.price}
              </span>
            </button>
          ))}
        </div>

        {/* Multi-pair count picker */}
        {isSneakerMulti && (
          <div>
            <div className="text-xs text-slate-500 mb-1.5">How many pairs?</div>
            <div className="flex flex-wrap gap-1.5">
              {SNEAKER_MULTI_PRICING.map((opt) => (
                <button
                  key={opt.pairs}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); set('sneakerPairCount', opt.pairs); }}
                  className={cls(
                    'rounded-full border px-2.5 py-1 text-xs flex items-center gap-1',
                    (S.sneakerPairCount ?? 3) === opt.pairs
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white border-black/10 hover:border-emerald-300',
                  )}
                >
                  {opt.popular && <span>⭐</span>}
                  <span>{opt.pairs} {opt.pairs === 1 ? 'pair' : 'pairs'}</span>
                  <span className={cls('ml-0.5', (S.sneakerPairCount ?? 3) === opt.pairs ? 'text-emerald-100' : 'text-slate-400')}>
                    {fmtAUD(opt.price)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="text-[11px] text-slate-600 space-y-0.5">
          <div>
            {isSneakerRefresh && 'Quick cosmetic refresh for lightly worn pairs.'}
            {isSneakerDeep && 'Full restoration for noticeably dirty or worn pairs.'}
            {isSneakerMulti && 'Best value when cleaning 3 or more pairs at once.'}
          </div>
          <div>Fees shown at checkout</div>
        </div>
      </div>

      {/* Turnaround Selector */}
      <div
        data-card-interactive="true"
        className="rounded-xl border border-black/5 bg-white/80 p-3 space-y-2"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-semibold text-slate-900">Turnaround speed</div>
        <div className="flex flex-wrap gap-2">
          {SNEAKER_TURNAROUND_META.map((t) => {
            const available = isSneakerTurnaroundAvailable(t.key);
            const isActiveTurnaround = S.sneakerTurnaround === t.key;
            return (
              <button
                key={t.key}
                type="button"
                disabled={!available}
                onClick={(e) => {
                  e.stopPropagation();
                  if (available) set('sneakerTurnaround', t.key);
                }}
                className={cls(
                  'rounded-full border px-3 py-1 text-sm',
                  isActiveTurnaround ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10',
                  !available && !isActiveTurnaround ? 'opacity-50 cursor-not-allowed' : ''
                )}
                title={`${t.window}${t.surcharge ? ` · +$${t.surcharge}/pair` : ''}`}
              >
                {t.label} — {t.window}
              </button>
            );
          })}
        </div>
        <div className="text-[11px] text-slate-600">
          Standard is best value; Express and Priority reduce turnaround with limited slots.
        </div>
      </div>

      {/* Refresh Detail Panel */}
      {isSneakerRefresh && (
        <div
          data-card-interactive="true"
          className="rounded-xl border border-black/5 bg-white/80 p-3"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between text-sm">
            <div className="font-semibold text-slate-900">Add sneaker details</div>
          </div>
          <div className="mt-3 space-y-2 text-xs text-slate-700">
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'mesh', label: 'Mesh / knit' },
                { key: 'leather', label: 'Leather' },
                { key: 'synthetic', label: 'Synthetic' },
                { key: 'suede', label: 'Suede / nubuck' },
                { key: 'boots', label: 'Boots' },
              ].map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={cls(
                    'px-3 py-1 rounded-full border text-sm',
                    refreshMaterial === c.key
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white border-black/10'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRefreshMaterial((curr) => (curr === c.key ? null : (c.key as typeof refreshMaterial)));
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'dirt', label: 'General dirt' },
                { key: 'yellowing', label: 'Yellowing' },
                { key: 'scuffs', label: 'Scuffs / marks' },
                { key: 'odour', label: 'Odour' },
                { key: 'wear', label: 'Wear & tear' },
              ].map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={cls(
                    'px-3 py-1 rounded-full border text-sm',
                    refreshConcern === c.key
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white border-black/10'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRefreshConcern((curr) => (curr === c.key ? null : (c.key as typeof refreshConcern)));
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {refreshHints && (
              <div className="text-[11px] text-slate-600 space-y-1">
                {refreshHints.map((h, i) => (
                  <div key={i}>{h}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Deep Detail Panel */}
      {isSneakerDeep && (
        <div
          data-card-interactive="true"
          className="rounded-xl border border-black/5 bg-white/80 p-3"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between text-sm">
            <div className="font-semibold text-slate-900">Add sneaker details</div>
          </div>
          <div className="mt-3 space-y-2 text-xs text-slate-700">
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'light', label: 'Light wear' },
                { key: 'noticeable', label: 'Noticeable dirt' },
                { key: 'heavy', label: 'Heavy wear' },
              ].map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={cls(
                    'px-3 py-1 rounded-full border text-sm',
                    deepSoiling === c.key
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white border-black/10'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeepSoiling(c.key as typeof deepSoiling);
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'suede', label: 'Suede / nubuck' },
                { key: 'dyed', label: 'Dyed leather' },
                { key: 'collectible', label: 'Collectible' },
              ].map((c) => {
                const active = deepSensitive.has(c.key as any);
                return (
                  <button
                    key={c.key}
                    type="button"
                    className={cls(
                      'px-3 py-1 rounded-full border text-sm',
                      active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeepSensitive((prev) => {
                        const next = new Set(prev);
                        if (next.has(c.key as any)) next.delete(c.key as any);
                        else next.add(c.key as any);
                        return next;
                      });
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            {deepHints && (
              <div className="text-[11px] text-slate-600 space-y-1">
                {deepHints.map((h, i) => (
                  <div key={i}>{h}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Multi Detail Panel */}
      {isSneakerMulti && (
        <div
          data-card-interactive="true"
          className="rounded-xl border border-black/5 bg-white/80 p-3"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between text-sm">
            <div className="font-semibold text-slate-900">Add sneaker details</div>
          </div>
          <div className="mt-3 space-y-2 text-xs text-slate-700">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-700">Pairs in this lot</span>
              <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-2 py-1">
                <button
                  type="button"
                  className="px-2 py-0.5 rounded-full border border-black/10 text-[11px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMultiPairs((n) => Math.max(1, Math.min(10, n - 1)));
                  }}
                  aria-label="Decrease pairs"
                >
                  –
                </button>
                <span className="min-w-[24px] text-center font-semibold">{multiPairs}</span>
                <button
                  type="button"
                  className="px-2 py-0.5 rounded-full border border-black/10 text-[11px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMultiPairs((n) => Math.max(1, Math.min(10, n + 1)));
                  }}
                  aria-label="Increase pairs"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'no', label: 'Same care for all' },
                { key: 'yes', label: 'Mix refresh + deep' },
              ].map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={cls(
                    'px-3 py-1 rounded-full border text-sm',
                    multiMixed === c.key
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white border-black/10'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMultiMixed(c.key as typeof multiMixed);
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {multiHints && (
              <div className="text-[11px] text-slate-600 space-y-1">
                {multiHints.map((h, i) => (
                  <div key={i}>{h}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
