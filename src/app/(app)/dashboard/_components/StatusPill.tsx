'use client';

import type React from 'react';

export function StatusPill({
  children,
  tone = 'green',
}: {
  children: React.ReactNode;
  tone?: 'green' | 'red' | 'neutral' | 'dark';
}) {
  const styles = {
    green: 'bg-[#e4f1e8] text-[#346b4b]',
    red: 'bg-[#fde8e8] text-[#df6c68]',
    neutral: 'bg-[#eef3ef] text-[#7c8c82]',
    dark: 'bg-[#153327] text-white',
  }[tone];

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold leading-none ${styles}`}>
      {children}
    </span>
  );
}
