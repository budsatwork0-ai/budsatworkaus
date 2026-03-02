'use client';

import { useState } from 'react';
import { useAuth } from '@/app/hooks/useAuth';
import type { UserRole } from '@/types/roles';
import { ROLE_LABELS } from '@/types/roles';

const ROLES: UserRole[] = ['admin', 'employee', 'customer'];

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-red-500',
  employee: 'bg-blue-500',
  customer: 'bg-green-500',
};

export function DevRoleSwitcher() {
  const { user, role, isLoaded } = useAuth();
  const [switching, setSwitching] = useState(false);
  const [open, setOpen] = useState(false);

  if (process.env.NODE_ENV !== 'development') return null;
  if (!isLoaded || !user) return null;

  const handleSwitch = async (newRole: UserRole) => {
    if (newRole === role || switching) return;
    setSwitching(true);
    try {
      const res = await fetch('/api/users/role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, role: newRole }),
      });
      if (res.ok) {
        const destinations: Record<UserRole, string> = {
          admin: '/dashboard',
          employee: '/crew',
          customer: '/portal',
        };
        window.location.href = destinations[newRole];
      }
    } finally {
      setSwitching(false);
      setOpen(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-[9999]">
      <div className="relative">
        {open && (
          <div className="absolute bottom-full left-0 mb-2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => handleSwitch(r)}
                disabled={r === role || switching}
                className={`block w-full px-4 py-2 text-left text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-40 ${
                  r === role ? 'bg-gray-800' : ''
                }`}
              >
                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${ROLE_COLORS[r]}`} />
                {ROLE_LABELS[r]}
                {r === role && ' (current)'}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow-lg opacity-75 hover:opacity-100 transition-opacity ${ROLE_COLORS[role]}`}
        >
          <span className="w-2 h-2 rounded-full bg-white/40" />
          {switching ? 'Switching...' : `DEV: ${ROLE_LABELS[role]}`}
        </button>
      </div>
    </div>
  );
}
