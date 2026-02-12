'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { Toaster } from 'sonner';
import { brand } from '@/app/ui/theme';
import SideNavItem from './_components/SideNavItem';
import CommandPalette from '@/components/CommandPalette';
import CreateOrderModal from '@/components/CreateOrderModal';
import CreateSubscriptionModal from '@/components/CreateSubscriptionModal';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const { signOut } = useClerk();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [createSubscriptionOpen, setCreateSubscriptionOpen] = useState(false);

  // Keyboard shortcut for command palette
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setCommandPaletteOpen(true);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

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
                onClick={() => setCreateOrderOpen(true)}
                className="text-xs px-3 py-2 rounded-lg border border-black/10 bg-white hover:shadow-sm text-left"
              >
                New Job
              </button>
              <button
                onClick={() => setCreateSubscriptionOpen(true)}
                className="text-xs px-3 py-2 rounded-lg border border-black/10 bg-white hover:shadow-sm text-left"
              >
                New Subscription
              </button>
            </div>
          </motion.div>
        )}
      </motion.aside>

      {/* =========================
          MOBILE SIDEBAR OVERLAY
         ========================= */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 w-[260px] z-50 md:hidden flex flex-col gap-3 p-4"
              style={{
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                background: 'rgba(255,255,255,.95)',
                borderRight: '1px solid rgba(0,0,0,.06)',
              }}
            >
              <div className="flex items-center justify-between px-2 py-3">
                <div className="flex items-center gap-3">
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-semibold"
                    style={{ background: brand.primary }}
                  >
                    B
                  </div>
                  <div className="leading-tight">
                    <div className="font-semibold" style={{ color: brand.primary }}>
                      Buds at Work
                    </div>
                    <div className="text-[11px] text-slate-500">Operations Console</div>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-slate-100"
                  aria-label="Close menu"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mt-1 text-[11px] uppercase tracking-wider text-slate-500 px-2">
                Overview
              </div>
              <SideNavItem href="/dashboard" label="Dashboard" />
              <SideNavItem href="/dashboard/quotes" label="Quotes" />
              <SideNavItem href="/dashboard/orders" label="Orders" />
              <SideNavItem href="/dashboard/subscriptions" label="Subscriptions" />
              <SideNavItem href="/dashboard/pipelines" label="Workflows" />
              <SideNavItem href="/dashboard/alerts" label="Alerts" />
              <SideNavItem href="/dashboard/reports" label="Reports" />
              <SideNavItem href="/dashboard/settings" label="Settings" />

              <div className="mt-auto p-3 rounded-2xl border border-black/5 bg-white/80">
                <div className="text-sm font-semibold" style={{ color: brand.primary }}>
                  Quick Create
                </div>
                <div className="mt-2 grid gap-2">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setCreateOrderOpen(true);
                    }}
                    className="text-xs px-3 py-2 rounded-lg border border-black/10 bg-white hover:shadow-sm text-left"
                  >
                    New Job
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setCreateSubscriptionOpen(true);
                    }}
                    className="text-xs px-3 py-2 rounded-lg border border-black/10 bg-white hover:shadow-sm text-left"
                  >
                    New Subscription
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* =========================
          MAIN CONTENT AREA
         ========================= */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Floating Topbar */}
        <header className="sticky top-3 z-30 px-3 sm:px-4 md:px-6">
          <div
            className="w-full rounded-2xl border border-black/5 bg-white/80 backdrop-blur px-3 sm:px-4 md:px-6 py-3 shadow-[0_8px_30px_rgba(2,6,23,0.06)] flex items-center gap-2 sm:gap-3"
            role="banner"
          >
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-1 rounded-lg hover:bg-slate-100"
              aria-label="Open menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>

            <h1
              className="text-sm sm:text-base md:text-lg font-semibold truncate"
              style={{ color: brand.primary }}
            >
              {pathname === '/dashboard'
                ? 'Dashboard'
                : pathname.split('/').slice(-1)[0].replace(/^\w/, c => c.toUpperCase())}
            </h1>

            <div className="ml-auto flex items-center gap-2">
              {/* Search Button */}
              <button
                onClick={() => setCommandPaletteOpen(true)}
                className="hidden md:flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="text-xs">Search...</span>
                <kbd className="px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 rounded">⌘K</kbd>
              </button>

              {/* + New Dropdown */}
              <div className="relative group">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-3 py-2 text-sm rounded-xl text-white"
                  style={{ background: brand.primary }}
                >
                  + New
                </motion.button>
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-black/10 bg-white shadow-lg overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <button
                    onClick={() => setCreateOrderOpen(true)}
                    className="block w-full text-left text-sm px-4 py-2.5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="font-medium text-slate-900">New Order</div>
                    <div className="text-xs text-slate-500">One-time service</div>
                  </button>
                  <button
                    onClick={() => setCreateSubscriptionOpen(true)}
                    className="block w-full text-left text-sm px-4 py-2.5 hover:bg-slate-50 transition-colors border-t border-slate-100"
                  >
                    <div className="font-medium text-slate-900">New Subscription</div>
                    <div className="text-xs text-slate-500">Recurring service</div>
                  </button>
                </div>
              </div>

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
                    <button
                      onClick={() => signOut({ redirectUrl: '/' })}
                      className="block w-full text-left text-sm px-4 py-2 text-red-500 hover:bg-red-50"
                    >
                      Sign out
                    </button>
                  </motion.div>
                </details>
              </motion.div>
            </div>
          </div>
        </header>

        {/* Animated page transitions */}
        <main className="w-full px-2 sm:px-4 md:px-6 py-4 sm:py-6 flex-1 overflow-x-hidden">
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

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onCreateOrder={() => {
          setCommandPaletteOpen(false);
          setCreateOrderOpen(true);
        }}
        onCreateSubscription={() => {
          setCommandPaletteOpen(false);
          setCreateSubscriptionOpen(true);
        }}
      />

      {/* Create Modals */}
      <CreateOrderModal
        isOpen={createOrderOpen}
        onClose={() => setCreateOrderOpen(false)}
      />
      <CreateSubscriptionModal
        isOpen={createSubscriptionOpen}
        onClose={() => setCreateSubscriptionOpen(false)}
      />
    </div>
  );
}
