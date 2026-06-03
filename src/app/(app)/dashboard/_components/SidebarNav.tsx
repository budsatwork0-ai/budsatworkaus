'use client';

import { motion } from 'framer-motion';
import type React from 'react';
import SideNavItem from './SideNavItem';

export type NavBadgeKey = 'dashboard' | 'schedule' | 'quotes' | 'invoices' | 'applicants';

export type NavLinkItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  badgeKey?: NavBadgeKey;
};

export type NavGroup = {
  id: string;
  label: string;
  adminOnly?: boolean;
  items: NavLinkItem[];
};

const BADGE_HREFS: Partial<Record<NavBadgeKey, string>> = {
  schedule: '/dashboard/schedule?view=list&scheduleState=unscheduled',
  quotes: '/dashboard/quotes?workspace=review',
  invoices: '/dashboard/invoices?tab=invoices&status=Overdue',
  applicants: '/dashboard/applicants?filter=awaiting_approval',
};

function LeafLogo() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M24.8 7.4C15.4 6.7 8.3 10.8 7.3 18.6c-.4 3.5 1.1 6.2 4 7.7.3-5.9 3.3-10 8.8-12.1-4.1 2.6-6.4 6.2-7 10.8 7.9-.1 13.3-6.2 11.7-17.6Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SidebarNav({
  groups,
  isAdmin,
  navBadges,
  collapsed,
  sidebarOpen,
  userInitials,
  userDisplayName,
  roleLabel,
  onToggleGroup,
  onToggleSidebar,
}: {
  groups: NavGroup[];
  isAdmin: boolean;
  navBadges: Record<NavBadgeKey, number>;
  collapsed: Set<string>;
  sidebarOpen: boolean;
  userInitials: string;
  userDisplayName: string;
  roleLabel: string;
  onToggleGroup: (id: string) => void;
  onToggleSidebar: () => void;
}) {
  return (
    <motion.aside
      animate={{ width: sidebarOpen ? 320 : 96 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="hidden h-[calc(100vh-24px)] shrink-0 flex-col gap-3 overflow-y-auto px-3 py-4 md:flex"
    >
      <button
        type="button"
        className="flex items-center gap-3 rounded-[22px] px-1 py-1.5 text-left"
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] bg-[#3c8259] text-white shadow-[0_14px_32px_rgba(60,130,89,0.22)]">
          <LeafLogo />
        </span>
        {sidebarOpen ? (
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[16px] font-bold text-[#17392b]">Buds At Work</span>
            <span className="block text-xs font-medium text-[#7f9187]">Business OS</span>
          </span>
        ) : null}
      </button>

      <div className="space-y-2">
        {groups.map((group) => {
          if (group.adminOnly && !isAdmin) return null;
          const isCollapsed = collapsed.has(group.id);

          if (!sidebarOpen) {
            return (
              <div key={group.id} className="space-y-1">
                {group.items.map((entry) => (
                  <SideNavItem
                    key={entry.href}
                    href={entry.href}
                    label={entry.label}
                    icon={entry.icon}
                    badge={entry.badgeKey ? navBadges[entry.badgeKey] : null}
                    showLabel={false}
                  />
                ))}
              </div>
            );
          }

          return (
            <div key={group.id} className="space-y-1">
              <button
                type="button"
                onClick={() => onToggleGroup(group.id)}
                className="flex w-full items-center gap-2 px-2.5 pb-0.5 pt-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#a1b0a8]"
              >
                <span className="truncate text-left">{group.label}</span>
                <svg
                  className={`ml-auto shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {!isCollapsed ? (
                <div className="space-y-0.5">
                  {group.items.map((entry) => (
                    <SideNavItem
                      key={entry.href}
                      href={entry.href}
                      label={entry.label}
                      icon={entry.icon}
                      badge={entry.badgeKey ? navBadges[entry.badgeKey] : null}
                      badgeHref={entry.badgeKey ? BADGE_HREFS[entry.badgeKey] : undefined}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-auto rounded-[24px] border border-white/70 bg-white/55 px-3 py-2.5 shadow-[0_10px_30px_rgba(15,61,46,0.05)]">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#d9dcde] text-sm font-bold text-[#3a3d3b]">
            {userInitials}
          </div>
          {sidebarOpen ? (
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-[#17392b]">{userDisplayName}</div>
              <div className="text-xs font-medium text-[#7f9187]">{roleLabel}</div>
            </div>
          ) : null}
        </div>
      </div>
    </motion.aside>
  );
}

export function MobileSidebarNav({
  open,
  groups,
  isAdmin,
  navBadges,
  collapsed,
  userInitials,
  userDisplayName,
  roleLabel,
  onClose,
  onToggleGroup,
}: {
  open: boolean;
  groups: NavGroup[];
  isAdmin: boolean;
  navBadges: Record<NavBadgeKey, number>;
  collapsed: Set<string>;
  userInitials: string;
  userDisplayName: string;
  roleLabel: string;
  onClose: () => void;
  onToggleGroup: (id: string) => void;
}) {
  if (!open) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/30 md:hidden"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: -320 }}
        animate={{ x: 0 }}
        exit={{ x: -320 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed bottom-0 left-0 top-0 z-50 flex w-[312px] flex-col gap-4 overflow-y-auto bg-[#f4faf6] px-4 py-5 md:hidden"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-[54px] w-[54px] place-items-center rounded-[18px] bg-[#3c8259] text-white">
              <LeafLogo />
            </span>
            <div>
              <div className="font-bold text-[#17392b]">Buds At Work</div>
              <div className="text-xs font-medium text-[#7f9187]">Business OS</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#7d8e84] shadow-sm"
            aria-label="Close menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          {groups.map((group) => {
            if (group.adminOnly && !isAdmin) return null;
            const isCollapsed = collapsed.has(group.id);
            return (
              <div key={group.id} className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => onToggleGroup(group.id)}
                  className="flex w-full items-center gap-2 px-2.5 pb-1 pt-2 text-[13px] font-bold uppercase tracking-[0.12em] text-[#a1b0a8]"
                >
                  <span className="truncate text-left">{group.label}</span>
                  <svg
                    className={`ml-auto shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {!isCollapsed ? (
                  <div className="space-y-1">
                    {group.items.map((entry) => (
                      <SideNavItem
                        key={entry.href}
                        href={entry.href}
                        label={entry.label}
                        icon={entry.icon}
                        badge={entry.badgeKey ? navBadges[entry.badgeKey] : null}
                        badgeHref={entry.badgeKey ? BADGE_HREFS[entry.badgeKey] : undefined}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-auto rounded-[24px] border border-white/70 bg-white/55 px-3 py-3 shadow-[0_10px_30px_rgba(15,61,46,0.05)]">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-[#d9dcde] text-sm font-bold text-[#3a3d3b]">
              {userInitials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-[#17392b]">{userDisplayName}</div>
              <div className="text-xs font-medium text-[#7f9187]">{roleLabel}</div>
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
}
