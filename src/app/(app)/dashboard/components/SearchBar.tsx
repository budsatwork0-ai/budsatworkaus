'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { dashboardTheme } from '@/lib/design-system/themes';
import { debounce } from '@/lib/dashboard/utils';

type SearchResult = {
  id: string;
  type: 'customer' | 'invoice' | 'job' | 'bill';
  title: string;
  subtitle: string;
  meta?: string;
};

function SearchIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function CloseIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

const typeColors: Record<SearchResult['type'], string> = {
  customer: '#10B981',
  invoice: dashboardTheme.color.primary,
  job: '#6366F1',
  bill: '#F59E0B',
};

const typeLabels: Record<SearchResult['type'], string> = {
  customer: 'Customer',
  invoice: 'Invoice',
  job: 'Job',
  bill: 'Bill',
};

type SearchBarProps = {
  receivables: Array<{ id: string; customer: string; service: string; amount: number }>;
  payables: Array<{ id: string; supplier: string; category: string; amount: number }>;
  jobs: Array<{ id: string; customer: string; service: string; scheduledDate: string }>;
  onResultClick?: (result: SearchResult) => void;
};

export default function SearchBar({ receivables, payables, jobs, onResultClick }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Search function
  const performSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    const q = searchQuery.toLowerCase();
    const searchResults: SearchResult[] = [];

    // Search receivables
    receivables.forEach((r) => {
      if (
        r.customer.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.service.toLowerCase().includes(q)
      ) {
        searchResults.push({
          id: r.id,
          type: 'invoice',
          title: r.id,
          subtitle: r.customer,
          meta: `$${r.amount.toLocaleString()}`,
        });
      }
    });

    // Search payables
    payables.forEach((p) => {
      if (
        p.supplier.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      ) {
        searchResults.push({
          id: p.id,
          type: 'bill',
          title: p.id,
          subtitle: p.supplier,
          meta: `$${p.amount.toLocaleString()}`,
        });
      }
    });

    // Search jobs
    jobs.forEach((j) => {
      if (
        j.customer.toLowerCase().includes(q) ||
        j.id.toLowerCase().includes(q) ||
        j.service.toLowerCase().includes(q)
      ) {
        searchResults.push({
          id: j.id,
          type: 'job',
          title: j.service,
          subtitle: j.customer,
          meta: j.scheduledDate,
        });
      }
    });

    // Extract unique customers
    const customerMap = new Map<string, SearchResult>();
    receivables.forEach((r) => {
      if (r.customer.toLowerCase().includes(q) && !customerMap.has(r.customer)) {
        customerMap.set(r.customer, {
          id: `customer-${r.customer}`,
          type: 'customer',
          title: r.customer,
          subtitle: 'Customer',
        });
      }
    });
    searchResults.push(...customerMap.values());

    setResults(searchResults.slice(0, 8));
  }, [receivables, payables, jobs]);

  // Debounced search (300ms delay)
  const debouncedSearch = useMemo(
    () => debounce(performSearch, 300),
    [performSearch]
  );

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  // Keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResultClick = (result: SearchResult) => {
    setQuery('');
    setIsOpen(false);
    onResultClick?.(result);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="Search customers, invoices, jobs..."
          className="w-full rounded-xl border border-slate-200 bg-white/90 pl-10 pr-20 py-2.5 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <CloseIcon />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-500">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden z-50"
          >
            <div className="max-h-80 overflow-y-auto py-2">
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
                >
                  <span
                    className="shrink-0 w-2 h-2 rounded-full"
                    style={{ backgroundColor: typeColors[result.type] }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {result.title}
                      </span>
                      <span
                        className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: `${typeColors[result.type]}15`,
                          color: typeColors[result.type],
                        }}
                      >
                        {typeLabels[result.type]}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 truncate">{result.subtitle}</div>
                  </div>
                  {result.meta && (
                    <span className="shrink-0 text-xs text-slate-500">{result.meta}</span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {isOpen && query && results.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-slate-200 bg-white shadow-lg p-6 text-center z-50"
          >
            <p className="text-sm text-slate-500">No results found for "{query}"</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
