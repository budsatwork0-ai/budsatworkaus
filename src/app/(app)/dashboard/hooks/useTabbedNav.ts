import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function useTabbedNav<T extends string>(
  paramName: string,
  sanitize: (value: string | null) => T
): [T, (next: T) => void] {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [tab, setTabState] = useState<T>(() =>
    sanitize(searchParams?.get(paramName) ?? null)
  );

  useEffect(() => {
    setTabState(sanitize(searchParams?.get(paramName) ?? null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const setTab = (next: T) => {
    setTabState(next);
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set(paramName, next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return [tab, setTab];
}
