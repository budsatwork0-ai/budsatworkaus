'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { dashboardTheme } from '@/lib/design-system/themes';
import { DASHBOARD_COMMANDS } from '@/lib/dashboard/navigation';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  action: () => void;
  keywords?: string[];
  category?: string;
}

interface SearchResult {
  id: string;
  label: string;
  description: string;
  href: string;
  category: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateOrder?: () => void;
  onCreateSubscription?: () => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  onCreateOrder,
  onCreateSubscription,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  const navIcon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );

  const addIcon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );

  const commands: CommandItem[] = [
    ...DASHBOARD_COMMANDS.map((command) => ({
      id: command.id,
      label: command.label,
      description: command.description,
      keywords: command.keywords,
      category: command.category,
      icon: navIcon,
      action: () => router.push(command.href),
    })),
    { id: 'create-order', label: 'Create New Order', description: 'Add a one-time service', keywords: ['new', 'add', 'job'], category: 'Actions', icon: addIcon, action: () => onCreateOrder?.() },
    { id: 'create-subscription', label: 'Create New Subscription', description: 'Add a recurring service', keywords: ['new', 'add'], category: 'Actions', icon: addIcon, action: () => onCreateSubscription?.() },
  ];

  // Search across entities when query has 2+ chars
  useEffect(() => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results: SearchResult[] = [];

        const [customersRes, ordersRes, crewRes] = await Promise.all([
          fetch(`/api/customers?search=${encodeURIComponent(query)}&limit=5`).then((r) => r.json()).catch(() => ({ customers: [] })),
          fetch(`/api/orders?search=${encodeURIComponent(query)}&limit=5`).then((r) => r.json()).catch(() => ({ orders: [] })),
          fetch(`/api/crew/employees?search=${encodeURIComponent(query)}&limit=5`).then((r) => r.json()).catch(() => ({ employees: [] })),
        ]);

        (customersRes.customers || []).forEach((c: { id: string; full_name: string; email: string | null }) => {
          results.push({
            id: `customer-${c.id}`,
            label: c.full_name,
            description: c.email || 'Customer',
            href: '/dashboard/customers',
            category: 'Customers',
          });
        });

        (ordersRes.orders || []).forEach((o: { id: string; customer_name: string; service_type: string; status: string }) => {
          results.push({
            id: `order-${o.id}`,
            label: `${o.customer_name} — ${o.service_type}`,
            description: o.status,
            href: '/dashboard/orders',
            category: 'Orders',
          });
        });

        (crewRes.employees || []).forEach((e: { id: string; full_name: string; email: string }) => {
          results.push({
            id: `crew-${e.id}`,
            label: e.full_name,
            description: e.email || 'Crew member',
            href: '/dashboard/crew',
            category: 'Crew',
          });
        });

        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [query]);

  const filteredCommands = query
    ? commands.filter((cmd) => {
        const searchTerms = query.toLowerCase().split(' ');
        const searchableText = `${cmd.label} ${cmd.description} ${cmd.keywords?.join(' ')}`.toLowerCase();
        return searchTerms.every((term) => searchableText.includes(term));
      })
    : commands;

  const allItems = [
    ...filteredCommands.map((cmd) => ({ type: 'command' as const, ...cmd })),
    ...searchResults.map((sr) => ({
      type: 'search' as const,
      id: sr.id,
      label: sr.label,
      description: sr.description,
      category: sr.category,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
      action: () => router.push(sr.href),
    })),
  ];

  const handleSelect = useCallback(
    (item: (typeof allItems)[number]) => {
      item.action();
      onClose();
      setQuery('');
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (allItems[selectedIndex]) {
            handleSelect(allItems[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          setQuery('');
          break;
      }
    },
    [isOpen, allItems, selectedIndex, handleSelect, onClose]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Group items by category
  const grouped = allItems.reduce<Record<string, typeof allItems>>((acc, item) => {
    const cat = item.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commands, customers, orders..."
                className="flex-1 outline-none text-sm placeholder:text-slate-400 bg-transparent"
              />
              {searching && (
                <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: dashboardTheme.color.primary, borderTopColor: 'transparent' }} />
              )}
              <kbd className="px-2 py-1 text-[10px] font-medium text-slate-400 bg-slate-100 rounded">ESC</kbd>
            </div>

            <div className="max-h-80 overflow-y-auto py-2">
              {allItems.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  No results found for &quot;{query}&quot;
                </div>
              ) : (
                Object.entries(grouped).map(([category, items]) => {
                  let flatIdx = 0;
                  for (const [cat, catItems] of Object.entries(grouped)) {
                    if (cat === category) break;
                    flatIdx += catItems.length;
                  }

                  return (
                    <div key={category}>
                      <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-slate-400 font-medium">{category}</div>
                      {items.map((item, idx) => {
                        const globalIdx = flatIdx + idx;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                              globalIdx === selectedIndex ? 'bg-slate-100' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div
                              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ background: globalIdx === selectedIndex ? dashboardTheme.color.primary : '#f1f5f9', color: globalIdx === selectedIndex ? 'white' : dashboardTheme.color.primary }}
                            >
                              {item.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-slate-900">{item.label}</div>
                              {item.description && (
                                <div className="text-xs text-slate-500 truncate">{item.description}</div>
                              )}
                            </div>
                            {globalIdx === selectedIndex && (
                              <kbd className="px-2 py-1 text-[10px] font-medium text-slate-400 bg-white border border-slate-200 rounded">
                                Enter
                              </kbd>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center gap-4 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">Enter</kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">Esc</kbd>
                Close
              </span>
              {query.length >= 2 && <span className="ml-auto">Searching customers, orders, crew...</span>}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
