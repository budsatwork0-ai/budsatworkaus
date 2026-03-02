'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Employee } from '@/types/database';

interface UseEmployeeReturn {
  employee: Employee | null;
  isLoading: boolean;
  error: string | null;
  needsSetup: boolean;
  refetch: () => void;
}

export function useEmployee(): UseEmployeeReturn {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);

  const fetchEmployee = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch('/api/crew/me', { signal: controller.signal });
      if (!res.ok) {
        throw new Error('Failed to fetch employee profile');
      }
      const data = await res.json();
      if (data.needsSetup) {
        setNeedsSetup(true);
        setEmployee(null);
      } else {
        setEmployee(data.employee);
        setNeedsSetup(false);
      }
    } catch (err) {
      const message = err instanceof Error
        ? (err.name === 'AbortError' ? 'Request timed out. Check your connection and try again.' : err.message)
        : 'Unknown error';
      setError(message);
    } finally {
      clearTimeout(timeout);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployee();
  }, [fetchEmployee]);

  return { employee, isLoading, error, needsSetup, refetch: fetchEmployee };
}
