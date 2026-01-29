'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import { brand } from '@/app/ui/theme';
import SideNavItem from './_components/SideNavItem';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div
      className="min-h-screen flex"
      style={{
        background:
          'radial-gradient(1200px 600px at 20% -10%, #dff3ea 0%, transparent 60%), radial-gradient(900px 500px at 120% 10%, #e8efe7 0%, transparent 50%), #f6f8f7',
      }}
    >
      <Toaster position="top-right" />

      {/* =========================
          SIDEBAR (Collapsible)
         ========================= */}
      <motion.aside
        animate={{ width: sidebarOpen ? 260 : 80 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="hidden md:flex flex-col gap-3 p-4 sticky top-0 h-svh"
        style={{
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          background: 'rgba(255,255,255,.7)',
          borderRight: '1px solid rgba(0,0,0,.06)',
        }}
      >
        {/* Brand header */}
        <div
          className="flex items-center gap-3 px-2 py-3 cursor-pointer"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <motion.div
            layout
            className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-semibold"
            style={{ background: brand.primary }}
          >
            B
          </motion.div>
          {sidebarOpen && (
            <motion.div layout className="leading-tight">
              <div className="font-semibold" style={{ color: brand.primary }}>
                Buds at Work
              </div>
              <div className="text-[11px] text-slate-500">Operations Console</div>
            </motion.div>
          )}
        </div>

        {sidebarOpen && (
          <div className="mt-1 text-[11px] uppercase tracking-wider text-slate-500 px-2">
            Overview
          </div>
        )}
        <SideNavItem href="/dashboard" label="Dashboard" />
        <SideNavItem href="/dashboard/quotes" label="Quotes" />
        <SideNavItem href="/dashboard/orders" label="Orders" />
        <SideNavItem href="/dashboard/subscriptions" label="Subscriptions" />
        <SideNavItem href="/dashboard/pipelines" label="Workflows" />
        <SideNavItem href="/dashboard/alerts" label="Alerts" />
        <SideNavItem href="/dashboard/reports" label="Reports" />
        <SideNavItem href="/dashboard/settings" label="Settings" />

        {sidebarOpen && (
          <motion.div
            layout
            className="mt-auto p-3 rounded-2xl border border-black/5 bg-white/80"
          >
            <div className="text-sm font-semibold" style={{ color: brand.primary }}>
              Quick Create
            </div>
            <div className="mt-2 grid gap-2">
              <button
                onClick={() => toast.success('New job created!')}
                className="text-xs px-3 py-2 rounded-lg border border-black/10 bg-white hover:shadow-sm"
              >
                New Job
              </button>
              <button
                onClick={() => toast.info('Payable added!')}
                className="text-xs px-3 py-2 rounded-lg border border-black/10 bg-white hover:shadow-sm"
              >
                Add Payable
              </button>
            </div>
          </motion.div>
        )}
      </motion.aside>

      {/* =========================
          MAIN CONTENT AREA
         ========================= */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Floating Topbar */}
        <header className="sticky top-3 z-30 px-4 md:px-6">
          <div
            className="w-full rounded-2xl border border-black/5 bg-white/80 backdrop-blur px-4 md:px-6 py-3 shadow-[0_8px_30px_rgba(2,6,23,0.06)] flex items-center gap-3"
            role="banner"
          >
            <h1
              className="text-base md:text-lg font-semibold"
              style={{ color: brand.primary }}
            >
              {pathname === '/dashboard'
                ? 'Dashboard'
                : pathname.split('/').slice(-1)[0].replace(/^\w/, c => c.toUpperCase())}
            </h1>

            <div className="ml-auto flex items-center gap-2">
              {/* Expanding Search */}
              <motion.div
                className="hidden md:flex items-center gap-2 rounded-xl border border-black/10 bg-white overflow-hidden"
                initial={{ width: 100 }}
                whileHover={{ width: 220 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              >
                <span className="text-xs text-slate-500 pl-3">⌘K</span>
                <input
                  placeholder="Search…"
                  className="outline-none text-sm placeholder:text-slate-400 px-1 py-2 flex-1 bg-transparent"
                />
              </motion.div>

              {/* + New */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => toast('Create something new!')}
                className="px-3 py-2 text-sm rounded-xl text-white"
                style={{ background: brand.primary }}
              >
                + New
              </motion.button>

              {/* User dropdown simplified */}
              <motion.div whileHover={{ scale: 1.05 }}>
                <details className="group">
                  <summary className="list-none cursor-pointer">
                    <div
                      className="h-8 w-8 rounded-full border border-black/10"
                      style={{ background: brand.primary }}
                    />
                  </summary>
                  <motion.div
                    className="absolute right-0 mt-2 w-40 rounded-xl border border-black/10 bg-white shadow-lg overflow-hidden"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <button className="block w-full text-left text-sm px-4 py-2 hover:bg-slate-50">
                      My Profile
                    </button>
                    <button className="block w-full text-left text-sm px-4 py-2 hover:bg-slate-50">
                      Settings
                    </button>
                    <button className="block w-full text-left text-sm px-4 py-2 text-red-500 hover:bg-red-50">
                      Sign out
                    </button>
                  </motion.div>
                </details>
              </motion.div>
            </div>
          </div>
        </header>

        {/* Animated page transitions */}
        <main className="w-full px-4 md:px-6 py-6 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
