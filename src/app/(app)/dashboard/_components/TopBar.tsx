'use client';

import { useRouter } from 'next/navigation';
import { NotificationCenter } from './NotificationCenter';
import type { NavBadgeKey } from './SidebarNav';

export function TopBar({
  title,
  userInitials,
  role,
  newDropdownOpen,
  onOpenMobileMenu,
  onOpenCommandPalette,
  onOpenShortcuts,
  onToggleNewDropdown,
  onCreateOrder,
  onCreateSubscription,
  onOpenMessaging,
  onSignOut,
  onBadgesUpdate,
}: {
  title: string;
  userInitials: string;
  role: string | null;
  newDropdownOpen: boolean;
  onOpenMobileMenu: () => void;
  onOpenCommandPalette: () => void;
  onOpenShortcuts: () => void;
  onToggleNewDropdown: () => void;
  onCreateOrder: () => void;
  onCreateSubscription: () => void;
  onOpenMessaging: () => void;
  onSignOut: () => void;
  onBadgesUpdate: (badges: Record<NavBadgeKey, number>) => void;
}) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 px-3 pt-2 sm:px-4 sm:pt-3 lg:px-5">
      <div className="flex min-h-[58px] items-center gap-3 rounded-[22px] bg-[#eaf3ed]/86 px-3 py-2 backdrop-blur md:min-h-[66px] md:px-4">
        <button
          onClick={onOpenMobileMenu}
          className="grid h-11 w-11 place-items-center rounded-full bg-white text-[#74877c] shadow-sm md:hidden"
          aria-label="Open menu"
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>

        <h1 className="shrink-0 text-[26px] font-extrabold leading-none text-[#17392b] sm:text-[28px]">
          {title}
        </h1>

        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="hidden h-11 min-w-0 max-w-[560px] flex-1 items-center gap-3 rounded-full bg-white px-5 text-left text-[15px] font-medium text-[#a7b2ab] shadow-[inset_0_0_0_1px_rgba(15,61,46,0.04)] lg:flex"
        >
          <svg className="h-5 w-5 shrink-0 text-[#9dacA4]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <span className="truncate">Search anything...</span>
        </button>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#74877c] shadow-sm lg:hidden"
            aria-label="Search"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </button>

          <div className="relative">
            <button
              onClick={onToggleNewDropdown}
              className="h-10 rounded-full bg-[#3c8259] px-5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(60,130,89,0.20)] transition hover:bg-[#346f4d] sm:h-11 sm:px-6"
            >
              Create
            </button>
            {newDropdownOpen ? (
              <>
                <div className="fixed inset-0 z-40" onClick={onToggleNewDropdown} />
                <div className="absolute right-0 z-50 mt-3 w-56 overflow-hidden rounded-[20px] border border-black/10 bg-white shadow-xl [animation:dropdownIn_0.15s_ease-out_both]">

                    <button
                      onClick={onCreateOrder}
                      className="block w-full px-5 py-3 text-left text-sm transition hover:bg-[#f1f7f3]"
                    >
                      <span className="block font-bold text-[#17392b]">New Job</span>
                      <span className="text-xs text-[#7f9187]">One-time service</span>
                    </button>
                    <button
                      onClick={onCreateSubscription}
                      className="block w-full border-t border-[#edf2ee] px-5 py-3 text-left text-sm transition hover:bg-[#f1f7f3]"
                    >
                      <span className="block font-bold text-[#17392b]">New Subscription</span>
                      <span className="text-xs text-[#7f9187]">Recurring service</span>
                    </button>
                </div>
              </>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onOpenMessaging}
            className="hidden h-10 w-10 place-items-center rounded-full bg-white text-[#74877c] shadow-sm sm:grid sm:h-11 sm:w-11"
            aria-label="Open messaging"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>

          <NotificationCenter onBadgesUpdate={onBadgesUpdate} />

          <button
            type="button"
            onClick={onOpenShortcuts}
            title="Keyboard shortcuts (?)"
            className="hidden h-10 w-10 place-items-center rounded-full bg-white text-[#74877c] shadow-sm sm:grid sm:h-11 sm:w-11"
            aria-label="Keyboard shortcuts"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <path d="M8 9h8M8 13h5" />
            </svg>
          </button>

          <details className="group relative">
            <summary className="list-none">
              <div className="grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-[#dddfe0] text-sm font-bold text-[#4b4d4c] shadow-sm sm:h-11 sm:w-11">
                {userInitials}
              </div>
            </summary>
            <div className="absolute right-0 mt-3 w-48 overflow-hidden rounded-[20px] border border-black/10 bg-white shadow-xl [animation:dropdownIn_0.15s_ease-out_both]">

              <button
                onClick={() => router.push('/dashboard/settings?group=account&panel=profile')}
                className="block w-full px-5 py-3 text-left text-sm font-semibold text-[#17392b] hover:bg-[#f1f7f3]"
              >
                My Profile
              </button>
              <button
                onClick={() => router.push('/dashboard/settings?group=workspace&panel=general')}
                className="block w-full px-5 py-3 text-left text-sm font-semibold text-[#17392b] hover:bg-[#f1f7f3]"
              >
                Settings
              </button>
              <div className="border-t border-[#edf2ee] px-5 py-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9aaaA2]">Role: {role}</span>
              </div>
              <button
                onClick={onSignOut}
                className="block w-full px-5 py-3 text-left text-sm font-semibold text-red-500 hover:bg-red-50"
              >
                Sign out
              </button>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
