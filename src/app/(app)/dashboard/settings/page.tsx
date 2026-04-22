import { Suspense } from 'react';
import SettingsWorkspace from './SettingsWorkspace';

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-[320px] w-full" />}>
      <SettingsWorkspace />
    </Suspense>
  );
}
