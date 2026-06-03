




'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

export default function SideNavItem({
  href,
  label,
  icon,
  badge,
  badgeHref,
  nested = false,
  showLabel = true,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number | null;
  badgeHref?: string;
  nested?: boolean;
  showLabel?: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== '/dashboard' && pathname?.startsWith(href + '/'));
  const showBadge = badge !== undefined && badge !== null && badge > 0;

  return (
    <motion.div
      className="relative"
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      <Link
        href={href}
        title={!showLabel ? label : undefined}
        className={`group flex min-h-10 items-center rounded-[18px] border transition-all ${
          nested ? 'ml-2 gap-2.5 px-3 py-1.5' : 'gap-3 px-3 py-2'
        } ${showLabel ? '' : 'justify-center px-0 py-2'} ${
          active ? 'shadow-[0_10px_24px_rgba(60,130,89,.20)]' : 'hover:bg-white/70'
        }`}
        style={{
          borderColor: active ? '#3c8259' : 'transparent',
          background: active ? '#3c8259' : 'transparent',
        }}
      >
        <motion.span
          className={`grid place-items-center shrink-0 ${nested ? 'h-5 w-5' : 'h-6 w-6'}`}
          style={{
            color: active ? '#fff' : '#7c9085',
          }}
          layout
        >
          {icon ?? <span className="text-[10px]">•</span>}
        </motion.span>
        {showLabel && (
          <span
            className={`${nested ? 'text-[13px]' : 'text-[15px]'} font-semibold`}
            style={{ color: active ? '#fff' : '#7b8d83' }}
          >
            {label}
          </span>
        )}
        {/* Non-deep-linked badge rendered inside the Link */}
        {showLabel && showBadge && !badgeHref && (
          <span
            className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10.5px] font-bold font-mono"
            style={{ background: '#fee2e2', color: '#ef6b68' }}
          >
            {badge! > 99 ? '99+' : badge}
          </span>
        )}
      </Link>
      {/* Deep-linked badge rendered outside the anchor to avoid nesting */}
      {showLabel && showBadge && badgeHref && (
        <Link
          href={badgeHref}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10.5px] font-bold font-mono transition hover:opacity-80"
          style={{ background: '#fee2e2', color: '#ef6b68' }}
        >
          {badge! > 99 ? '99+' : badge}
        </Link>
      )}
    </motion.div>
  );
}
