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
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname?.startsWith(href + '/');

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 250, damping: 20 }}
    >
      <Link
        href={href}
        className={`group flex items-center gap-3 rounded-xl px-3 py-2 transition-all ${
          active ? 'bg-white/80 shadow-sm' : 'hover:bg-white/50 hover:shadow-sm'
        }`}
        style={{ border: '1px solid rgba(0,0,0,.06)' }}
      >
        <motion.span
          className="grid place-items-center h-6 w-6 rounded-lg shrink-0"
          style={{
            background: active ? brand.primary : 'rgba(15,61,46,.08)',
            color: active ? '#fff' : brand.primary,
          }}
          layout
        >
          {icon ?? <span className="text-[10px]">•</span>}
        </motion.span>
        <span className="text-sm font-medium">{label}</span>
      </Link>
    </motion.div>
  );
}