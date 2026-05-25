'use client';

import RegoLookupAssistant from '@/app/ui/car/RegoLookupAssistant';
import type { useCarModelSelector } from '@/app/ui/car/useCarModelSelector';
import type { WizardState } from '../../types';

interface CarDetailingPanelProps {
  S: WizardState;
  set: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  carSelector: ReturnType<typeof useCarModelSelector>;
}

export function CarDetailingPanel({ S, set, carSelector }: CarDetailingPanelProps) {
  return (
    <div
      data-card-interactive="true"
      className="rounded-2xl bg-slate-900 overflow-hidden"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {/* Rego Lookup Section */}
      <div className="p-4 border-b border-white/10">
        <RegoLookupAssistant
          selectedCategory={carSelector.carType}
          detectedVehicle={S.carDetectedVehicle}
          onVehicleChange={(vehicle) => set('carDetectedVehicle', vehicle)}
          onSelectCategory={(category) => {
            carSelector.setCarType(category);
            const sizeMap: Record<string, number> = {
              hatch: 1, sedan: 2, suv: 3, ute: 4, van: 5, '4wd': 6, luxury: 2, muscle: 2,
            };
            set('paramsByService', {
              ...S.paramsByService,
              auto: { ...S.paramsByService.auto, vehicle_size: sizeMap[category] || 2 },
            });
          }}
          onVehicleDetected={(_vehicle, classification) => {
            if (classification.sizeCategory) {
              set('carDetectedSizeCategory', classification.sizeCategory);
            }
            set('carDetectedYear', typeof _vehicle.year === 'number' ? _vehicle.year : null);
          }}
        />
      </div>

      {/* Car Type Selection */}
      <div className="p-4 border-b border-white/10">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-3">
          Select vehicle type
        </div>
        <div className="grid grid-cols-4 gap-2">
          {(['hatch', 'sedan', 'suv', 'ute', 'van', '4wd', 'luxury', 'muscle'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                carSelector.setCarType(type);
                const sizeMap: Record<string, number> = {
                  hatch: 1, sedan: 2, suv: 3, ute: 4, van: 5, '4wd': 6, luxury: 2, muscle: 2,
                };
                set('paramsByService', {
                  ...S.paramsByService,
                  auto: { ...S.paramsByService.auto, vehicle_size: sizeMap[type] || 2 },
                });
              }}
              className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                carSelector.carType === type
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
            >
              {type === '4wd' ? '4WD' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Interior Config */}
      <div className="p-4 border-b border-white/10">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-3">
          Interior details
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-slate-400 mb-2">Seat rows</div>
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    set('paramsByService', {
                      ...S.paramsByService,
                      auto: { ...S.paramsByService.auto, rows: n },
                    });
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    (S.paramsByService.auto?.rows || 2) === n
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-2">Child seats</div>
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    set('paramsByService', {
                      ...S.paramsByService,
                      auto: { ...S.paramsByService.auto, child_seats: n },
                    });
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    (S.paramsByService.auto?.child_seats || 0) === n
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Condition */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">
            Current condition
          </div>
          <div className="text-xs font-medium text-emerald-400">
            {carSelector.dirtLevel === 0 ? 'Clean' : carSelector.dirtLevel < 0.4 ? 'Light dirt' : carSelector.dirtLevel < 0.7 ? 'Moderate' : 'Heavy'}
          </div>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={carSelector.dirtLevel}
          onChange={(e) => carSelector.setDirtLevel(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-emerald-500"
        />
        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
          <span>Clean</span>
          <span>Heavy</span>
        </div>
      </div>

      {/* Focus Zones Selection */}
      <div className="p-4">
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">
            Any areas to focus on? <span className="text-slate-500">(optional)</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {([
            { zone: 'hood', label: 'Hood', icon: '🚗' },
            { zone: 'roof', label: 'Roof', icon: '☀️' },
            { zone: 'boot', label: 'Boot', icon: '📦' },
            { zone: 'wheels', label: 'Wheels', icon: '🛞' },
            { zone: 'glass', label: 'Glass', icon: '🪟' },
            { zone: 'interior', label: 'Interior', icon: '💺' },
          ] as const).map(({ zone, label, icon }) => {
            const isSelected = carSelector.zones.has(zone);
            return (
              <button
                key={zone}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  carSelector.toggleZone(zone);
                }}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                <span className="text-lg">{icon}</span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
