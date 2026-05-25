'use client';

import dynamic from 'next/dynamic';
import type { WizardState } from '../../types';

const WindowsEditor = dynamic(
  () => import('../windows/WindowsEditor').then(m => ({ default: m.WindowsEditor })),
  { ssr: false }
);

interface WindowsServicePanelProps {
  S: WizardState;
  setMany: (values: Partial<WizardState>) => void;
  notifyDelta: (prevMin: number, nextMin: number) => void;
}

export function WindowsServicePanel({ S, setMany, notifyDelta }: WindowsServicePanelProps) {
  return (
    <div
      data-card-interactive="true"
      className="min-w-0 w-full overflow-hidden"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <WindowsEditor S={S} setMany={setMany} notifyDelta={notifyDelta} />
    </div>
  );
}
