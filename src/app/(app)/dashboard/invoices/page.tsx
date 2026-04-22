'use client';

import { Suspense } from 'react';
import MoneyFlowWorkspace from './MoneyFlowWorkspace';

export default function MoneyPage() {
  return (
    <Suspense fallback={<div className="min-h-[320px] w-full" />}>
      <MoneyFlowWorkspace />
    </Suspense>
  );
}
