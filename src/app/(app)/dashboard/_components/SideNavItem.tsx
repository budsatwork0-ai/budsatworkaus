




'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { brand } from '@/app/ui/theme';

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
        className={`group flex items-center rounded-2xl border transition-all ${
          nested ? 'gap-2.5 px-3 py-2 ml-2' : 'gap-3 px-3 py-2.5'
        } ${showLabel ? '' : 'justify-center px-0 py-2.5'} ${
          active ? 'shadow-[0_6px_18px_rgba(28,124,84,.28)]' : 'hover:bg-white/75 hover:shadow-sm'
        }`}
        style={{
          borderColor: active ? brand.accent : 'transparent',
          background: active ? brand.accent : 'transparent',
        }}
      >
        <motion.span
          className={`grid place-items-center rounded-[10px] shrink-0 ${nested ? 'h-6 w-6' : 'h-7 w-7'}`}
          style={{
            background: active ? 'rgba(255,255,255,.22)' : 'rgba(15,61,46,.08)',
            color: active ? '#fff' : brand.primary,
          }}
          layout
        >
          {icon ?? <span className="text-[10px]">•</span>}
        </motion.span>
        {showLabel && (
          <span
            className={`${nested ? 'text-[13px]' : 'text-[13.5px]'} font-semibold`}
            style={{ color: active ? '#fff' : brand.muted }}
          >
            {label}
          </span>
        )}
        {/* Non-deep-linked badge rendered inside the Link */}
        {showLabel && showBadge && !badgeHref && (
          <span
            className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10.5px] font-bold font-mono"
            style={{ background: '#10b981', color: '#fff' }}
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
          style={{ background: '#10b981', color: '#fff' }}
        >
          {badge! > 99 ? '99+' : badge}
        </Link>
      )}
    </motion.div>
  );
}
