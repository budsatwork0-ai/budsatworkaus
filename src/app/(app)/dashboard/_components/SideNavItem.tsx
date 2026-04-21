




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
  nested = false,
  showLabel = true,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number | null;
  nested?: boolean;
  showLabel?: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== '/dashboard' && pathname?.startsWith(href + '/'));

  return (
    <motion.div
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
          active ? 'shadow-sm' : 'hover:bg-white/75 hover:shadow-sm'
        }`}
        style={{
          borderColor: active ? 'rgba(28,124,84,.10)' : 'transparent',
          background: active ? brand.accentSoft : 'transparent',
        }}
      >
        <motion.span
          className={`grid place-items-center rounded-[10px] shrink-0 ${nested ? 'h-6 w-6' : 'h-7 w-7'}`}
          style={{
            background: active ? brand.primary : 'rgba(15,61,46,.08)',
            color: active ? '#fff' : brand.primary,
          }}
          layout
        >
          {icon ?? <span className="text-[10px]">•</span>}
        </motion.span>
        {showLabel && (
          <>
            <span
              className={`${nested ? 'text-[13px]' : 'text-[13.5px]'} font-semibold`}
              style={{ color: active ? brand.primary : brand.muted }}
            >
              {label}
            </span>
            {badge !== undefined && badge !== null && badge > 0 && (
              <span
                className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10.5px] font-bold font-mono"
                style={{ background: '#10b981', color: '#fff' }}
              >
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </>
        )}
      </Link>
    </motion.div>
  );
}
