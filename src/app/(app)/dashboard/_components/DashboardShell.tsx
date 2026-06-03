'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type React from 'react';

export function DashboardShell({
  pathname,
  sidebar,
  mobileSidebar,
  topBar,
  children,
}: {
  pathname: string;
  sidebar: React.ReactNode;
  mobileSidebar: React.ReactNode;
  topBar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#edf6f0] p-1.5 text-[#153327] sm:p-2 lg:p-2">
      <div className="mx-auto flex min-h-[calc(100vh-12px)] w-full max-w-[1920px] overflow-hidden rounded-[28px] border border-white/70 bg-[#f4faf6] shadow-[0_24px_70px_rgba(15,61,46,0.10)] sm:min-h-[calc(100vh-16px)]">
        {sidebar}
        {mobileSidebar}

        <div className="flex min-w-0 flex-1 flex-col">
          {topBar}
          <main className="w-full flex-1 overflow-x-hidden px-2.5 pb-3 pt-1.5 sm:px-3 lg:px-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="w-full min-w-0 overflow-x-hidden"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}
