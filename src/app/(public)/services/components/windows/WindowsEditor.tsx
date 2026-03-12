import React from 'react';
import type { WizardState, ScopeKey } from '../../types';
import { cls, fmtHrMin } from '../../utils/formatting';
import { computeWindowsMinutes } from '../../lib/service-helpers';

type Mode = 'both' | 'inside' | 'outside' | 'tracks';

export function WindowsEditor({
  S,
  set,
  notifyDelta,
}: {
  S: WizardState;
  set: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  notifyDelta: (prevMin: number, nextMin: number) => void;
}) {
  const isCommercial = S.context === 'commercial';
  const announceId = React.useId();

  // Local copy of rows so typing doesn't trigger a parent re-render on every keystroke.
  // Structural changes (add/remove level, mode switch, reset) still sync to parent immediately.
  const [localRows, setLocalRows] = React.useState<WizardState['winRows']>(() => S.winRows);
  const prevScopeRef = React.useRef(S.scope);
  const prevRowsLenRef = React.useRef(S.winRows.length);

  // Sync local rows when the parent makes a structural change (scope change or row count change).
  React.useEffect(() => {
    if (S.scope !== prevScopeRef.current || S.winRows.length !== prevRowsLenRef.current) {
      setLocalRows(S.winRows);
      prevScopeRef.current = S.scope;
      prevRowsLenRef.current = S.winRows.length;
    }
  }, [S.winRows, S.scope]);

  // Keep a ref to the latest syncToParent so the debounce timer always calls the fresh version.
  const syncToParentRef = React.useRef<() => void>(() => {});
  // Debounce timer for syncing after spinner clicks or rapid typing.
  const debounceSyncRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentMode: Mode = React.useMemo(() => {
    if (S.scope === 'windows_interior') return 'inside';
    if (S.scope === 'windows_exterior') return 'outside';
    if (S.scope === 'windows_tracks') return 'tracks';
    return 'both';
  }, [S.scope]);

  const scopeFromMode: Record<Mode, ScopeKey> = {
    both: 'windows_full',
    inside: 'windows_interior',
    outside: 'windows_exterior',
    tracks: 'windows_tracks',
  };

  const presetRowForMode = (mode: Mode, index = 0): WizardState['winRows'][number] => {
    const base = {
      both: { int: 12, ext: 12, tracks: 12, screens: isCommercial ? 0 : 12 },
      inside: { int: 12, ext: 0, tracks: 12, screens: 0 },
      outside: { int: 0, ext: 12, tracks: 0, screens: isCommercial ? 0 : 12 },
      tracks: { int: 0, ext: 0, tracks: 12, screens: isCommercial ? 0 : 12 },
    }[mode];
    const label = isCommercial
      ? index === 0
        ? 'Ground'
        : `Level ${index}`
      : index === 0
      ? 'Ground floor'
      : index === 1
      ? 'Second floor'
      : 'Third floor';
    return { ...base, label };
  };

  const segmentForMode = (mode: Mode) => {
    switch (mode) {
      case 'inside':
        return { int: true, ext: false, tracks: true };
      case 'outside':
        return { int: false, ext: true, tracks: false };
      case 'tracks':
        return { int: false, ext: false, tracks: true };
      default:
        return { int: true, ext: true, tracks: true };
    }
  };

  const toCount = (v: string | number) => Math.max(0, Math.floor(Number(v) || 0));

  const minutes = React.useMemo(
    () => computeWindowsMinutes(S.scope, localRows, S.context, S.paramsByService.windows),
    [localRows, S.context, S.scope, S.paramsByService.windows]
  );

  // Structural changes: sync both local state and parent state immediately.
  const replaceRows = (nextRows: WizardState['winRows'], nextScope?: ScopeKey, nextSeg?: { int: boolean; ext: boolean; tracks: boolean }) => {
    const trimmedRows = isCommercial ? nextRows : nextRows.slice(0, 3);
    const before = computeWindowsMinutes(S.scope, S.winRows, S.context, S.paramsByService.windows);
    const after = computeWindowsMinutes(
      nextScope ?? S.scope,
      trimmedRows,
      S.context,
      S.paramsByService.windows
    );

    if (nextScope) set('scope', nextScope);
    if (nextSeg) set('winSessionSeg', nextSeg);
    set('winRows', trimmedRows);
    set('winStoreys', trimmedRows.length);
    notifyDelta(before, after);
    setLocalRows(trimmedRows);
  };

  // On blur (or debounce), push local row values up to parent state.
  const syncToParent = () => {
    const trimmed = isCommercial ? localRows : localRows.slice(0, 3);
    const before = computeWindowsMinutes(S.scope, S.winRows, S.context, S.paramsByService.windows);
    const after = computeWindowsMinutes(S.scope, trimmed, S.context, S.paramsByService.windows);
    set('winRows', trimmed);
    set('winStoreys', trimmed.length);
    notifyDelta(before, after);
  };

  // Keep ref pointing to latest syncToParent so the debounce timer always calls the fresh closure.
  syncToParentRef.current = syncToParent;

  // Typing/spinner: update local state and schedule a debounced parent sync.
  // Number input spinners don't fire onBlur, so without this the footer never updates.
  const updateRowValue = (rowIndex: number, key: 'int' | 'ext' | 'tracks' | 'screens', value: string | number) => {
    setLocalRows(prev => prev.map((r, idx) => (idx === rowIndex ? { ...r, [key]: toCount(value) } : r)));
    if (debounceSyncRef.current) clearTimeout(debounceSyncRef.current);
    debounceSyncRef.current = setTimeout(() => syncToParentRef.current(), 400);
  };

  const applyMode = (mode: Mode) => {
    const seg = segmentForMode(mode);
    const nextRows = [presetRowForMode(mode, 0)];
    replaceRows(nextRows, scopeFromMode[mode], seg);
  };

  const addLevel = () => {
    const next = [...localRows, presetRowForMode(currentMode, localRows.length)];
    replaceRows(next);
  };

  const removeLevel = () => {
    if (localRows.length <= 1) return;
    replaceRows(localRows.slice(0, -1));
  };

  const showInside = currentMode === 'both' || currentMode === 'inside';
  const showOutside = currentMode === 'both' || currentMode === 'outside';
  const showTracks = currentMode !== 'outside';
  const showScreens = !isCommercial && (currentMode === 'both' || currentMode === 'outside');

  const labelForRow = (rowIndex: number) => {
    if (isCommercial) return rowIndex === 0 ? 'Ground' : `Level ${rowIndex}`;
    if (rowIndex === 0) return 'Ground Floor';
    if (rowIndex === 1) return 'Second Floor';
    return 'Third Floor';
  };

  const displayRows = (isCommercial ? localRows : [...localRows].reverse()).map((row, index) => {
    const sourceIndex = isCommercial ? index : localRows.length - 1 - index;
    return { row, sourceIndex };
  });

  const inputColumnCount = Number(showInside) + Number(showOutside) + Number(showTracks) + Number(showScreens);
  const gridTemplate = { gridTemplateColumns: `minmax(50px, 1fr) repeat(${inputColumnCount}, minmax(36px, 1fr)) 32px` } as const;

  const allowedModes: Mode[] = React.useMemo(() => {
    switch (S.scope) {
      case 'windows_interior':
        return ['inside'];
      case 'windows_exterior':
        return ['outside'];
      case 'windows_tracks':
        return ['tracks'];
      case 'windows_full':
        return ['both'];
      default:
        return ['both', 'inside', 'outside', 'tracks'];
    }
  }, [S.scope]);

  return (
    <section aria-label="Windows editor" className="rounded-2xl overflow-hidden bg-gradient-to-br from-slate-50 to-white border border-slate-200 shadow-sm">
      <div id={announceId} className="sr-only" aria-live="polite">
        {localRows.length} levels. {fmtHrMin(minutes)}.
      </div>

      {/* Header with title and time estimate */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">Window Details</h3>
              <p className="text-emerald-100 text-sm">Customize panes per level</p>
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2">
            <span className="text-emerald-100 text-xs uppercase tracking-wide">Est. Time</span>
            <p className="text-white font-bold text-lg" style={{ fontVariantNumeric: 'tabular-nums' }} aria-describedby={announceId}>
              {fmtHrMin(minutes)}
            </p>
          </div>
        </div>
      </div>

      {/* Controls bar */}
      <div className="px-4 md:px-5 py-3 md:py-4 bg-white border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          {/* Mode toggle */}
          <div role="group" aria-label="Mode" className="inline-flex rounded-xl bg-slate-100 p-1 overflow-x-auto">
            {allowedModes.includes('both') && (
              <button
                type="button"
                aria-pressed={currentMode === 'both'}
                onClick={() => applyMode('both')}
                className={cls(
                  'px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all duration-200 whitespace-nowrap',
                  currentMode === 'both'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                All Sides
              </button>
            )}
            {allowedModes.includes('inside') && (
              <button
                type="button"
                aria-pressed={currentMode === 'inside'}
                onClick={() => applyMode('inside')}
                className={cls(
                  'px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all duration-200 whitespace-nowrap',
                  currentMode === 'inside'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                Inside
              </button>
            )}
            {allowedModes.includes('outside') && (
              <button
                type="button"
                aria-pressed={currentMode === 'outside'}
                onClick={() => applyMode('outside')}
                className={cls(
                  'px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all duration-200 whitespace-nowrap',
                  currentMode === 'outside'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                Outside
              </button>
            )}
            {allowedModes.includes('tracks') && (
              <button
                type="button"
                aria-pressed={currentMode === 'tracks'}
                onClick={() => applyMode('tracks')}
                className={cls(
                  'px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all duration-200 whitespace-nowrap',
                  currentMode === 'tracks'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                Tracks Only
              </button>
            )}
          </div>

          {/* Level controls and reset */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1" aria-label="Levels">
              <button
                type="button"
                className={cls(
                  'w-8 h-8 rounded-lg flex items-center justify-center text-lg font-medium transition-all',
                  localRows.length <= 1
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-600 hover:bg-white hover:shadow-sm'
                )}
                onClick={removeLevel}
                aria-label="Remove level"
                disabled={localRows.length <= 1}
              >
                −
              </button>
              <span className="w-10 text-center text-sm font-semibold text-slate-700">{localRows.length} {localRows.length === 1 ? 'lvl' : 'lvls'}</span>
              <button
                type="button"
                className={cls(
                  'w-8 h-8 rounded-lg flex items-center justify-center text-lg font-medium transition-all',
                  localRows.length >= 3
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-600 hover:bg-white hover:shadow-sm'
                )}
                onClick={addLevel}
                aria-label="Add level"
                disabled={localRows.length >= 3}
              >
                +
              </button>
            </div>
            <button
              type="button"
              className="px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
              onClick={() => replaceRows([presetRowForMode(currentMode, 0)])}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Levels grid */}
      <div className="p-3 md:p-5 overflow-x-auto">
        <div role="table" aria-label="Levels grid" className="w-full min-w-0">
          {/* Column headers */}
          <div role="row" className="grid gap-1.5 md:gap-3 text-[10px] md:text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 md:mb-3 px-2 md:px-4" style={gridTemplate}>
            <div role="columnheader">Level</div>
            {showInside && <div role="columnheader" className="text-center">In</div>}
            {showOutside && <div role="columnheader" className="text-center">Out</div>}
            {showTracks && <div role="columnheader" className="text-center">Trk</div>}
            {showScreens && <div role="columnheader" className="text-center">Scr</div>}
            <div role="columnheader" className="text-right" />
          </div>

          <ul className="space-y-2">
            {displayRows.map(({ row: r, sourceIndex }, displayIndex) => {
              const label = labelForRow(sourceIndex);
              const isTop = displayIndex === 0 && localRows.length > 1;
              return (
                <li
                  key={`${label}-${sourceIndex}`}
                  role="row"
                  className={cls(
                    'grid gap-1.5 md:gap-3 items-center rounded-xl p-2 md:p-4 transition-all duration-200',
                    isTop
                      ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200'
                      : 'bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  )}
                  style={gridTemplate}
                >
                  <div role="cell" className="flex items-center gap-1 md:gap-3">
                    <div className={cls(
                      'w-6 h-6 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-xs md:text-sm font-bold shrink-0',
                      isTop ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                    )}>
                      {isCommercial ? (sourceIndex === 0 ? 'G' : sourceIndex) : (sourceIndex === 0 ? 'G' : sourceIndex === 1 ? '2' : '3')}
                    </div>
                    <span className={cls('text-xs md:text-sm font-medium truncate', isTop ? 'text-emerald-800' : 'text-slate-700')}>
                      {label}
                    </span>
                  </div>

                  {showInside && (
                    <div role="cell">
                      <label className="sr-only" htmlFor={`int-${displayIndex}`}>
                        Inside panes
                      </label>
                      <input
                        id={`int-${displayIndex}`}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        className="w-full px-1.5 py-1 md:px-3 md:py-2 rounded-lg border border-slate-200 bg-white text-xs md:text-sm text-center font-medium focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        aria-label={`Inside panes for ${label}`}
                        value={r.int ? r.int : ''}
                        onChange={(e) => updateRowValue(sourceIndex, 'int', e.target.value)}
                        onBlur={syncToParent}
                      />
                    </div>
                  )}

                  {showOutside && (
                    <div role="cell">
                      <label className="sr-only" htmlFor={`ext-${displayIndex}`}>
                        Outside panes
                      </label>
                      <input
                        id={`ext-${displayIndex}`}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        className="w-full px-1.5 py-1 md:px-3 md:py-2 rounded-lg border border-slate-200 bg-white text-xs md:text-sm text-center font-medium focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        aria-label={`Outside panes for ${label}`}
                        value={r.ext ? r.ext : ''}
                        onChange={(e) => updateRowValue(sourceIndex, 'ext', e.target.value)}
                        onBlur={syncToParent}
                      />
                    </div>
                  )}

                  {showTracks && (
                    <div role="cell">
                      <label className="sr-only" htmlFor={`trk-${displayIndex}`}>
                        Tracks
                      </label>
                      <input
                        id={`trk-${displayIndex}`}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        className="w-full px-1.5 py-1 md:px-3 md:py-2 rounded-lg border border-slate-200 bg-white text-xs md:text-sm text-center font-medium focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        aria-label={`Tracks for ${label}`}
                        value={r.tracks ? r.tracks : ''}
                        onChange={(e) => updateRowValue(sourceIndex, 'tracks', e.target.value)}
                        onBlur={syncToParent}
                      />
                    </div>
                  )}

                  {showScreens && (
                    <div role="cell">
                      <label className="sr-only" htmlFor={`scr-${displayIndex}`}>
                        Screens
                      </label>
                      <input
                        id={`scr-${displayIndex}`}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        className="w-full px-1.5 py-1 md:px-3 md:py-2 rounded-lg border border-slate-200 bg-white text-xs md:text-sm text-center font-medium focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        aria-label={`Screens for ${label}`}
                        value={r.screens ? r.screens : ''}
                        onChange={(e) => updateRowValue(sourceIndex, 'screens', e.target.value)}
                        onBlur={syncToParent}
                      />
                    </div>
                  )}

                  <div role="cell" className="text-right">
                    {sourceIndex > 0 && (
                      <button
                        type="button"
                        className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                        aria-label={`Remove ${label}`}
                        onClick={() => replaceRows(localRows.filter((_, i) => i !== sourceIndex))}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Add level hint */}
        {localRows.length < 3 && (
          <p className="mt-4 text-center text-xs text-slate-500">
            Click <span className="font-semibold">+</span> to add another level (up to 3)
          </p>
        )}
      </div>
    </section>
  );
}
