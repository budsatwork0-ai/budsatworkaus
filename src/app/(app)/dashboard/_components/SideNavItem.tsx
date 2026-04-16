




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
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 250, damping: 20 }}
    >
      <Link
        href={href}
        title={!showLabel ? label : undefined}
        className={`group flex items-center rounded-xl transition-all ${
          nested ? 'gap-2.5 px-3 py-2 ml-2' : 'gap-3 px-3 py-2.5'
        } ${showLabel ? '' : 'justify-center px-0 py-2.5'} ${
          active ? 'bg-white/85 shadow-sm' : 'hover:bg-white/50 hover:shadow-sm'
        }`}
        style={{ border: '1px solid rgba(0,0,0,.06)' }}
      >
        <motion.span
          className={`grid place-items-center rounded-lg shrink-0 ${nested ? 'h-5 w-5' : 'h-6 w-6'}`}
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
              className={`${nested ? 'text-[13px]' : 'text-sm'} font-medium`}
              style={{ color: active ? brand.primary : brand.muted }}
            >
              {label}
            </span>
            {badge !== undefined && badge !== null && badge > 0 && (
              <span
                className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  background: active ? 'rgba(15,61,46,.12)' : 'rgba(15,23,42,.08)',
                  color: active ? brand.primary : '#475569',
                }}
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
