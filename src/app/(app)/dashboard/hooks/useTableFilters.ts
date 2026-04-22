import { useEffect, useMemo, useState } from 'react';
import { ITEMS_PER_PAGE } from '@/types/dashboard';

type BaseFilters = {
  search: string;
  startDate: string;
  endDate: string;
  [key: string]: string;
};

export function useTableFilters<TRecord, TFilters extends BaseFilters>(
  records: TRecord[],
  options: {
    initialFilters: TFilters;
    filterFn: (record: TRecord, filters: TFilters) => boolean;
    itemsPerPage?: number;
  }
) {
  const { initialFilters, filterFn, itemsPerPage = ITEMS_PER_PAGE } = options;

  const [filters, setFilters] = useState<TFilters>(initialFilters);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setFilters(initialFilters);
    setPage(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialFilters)]);

  const filtered = useMemo(
    () => records.filter((record) => filterFn(record, filters)),
    [records, filters, filterFn]
  );

  const paginated = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, page, itemsPerPage]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const setFilter = (key: keyof TFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  return { filters, setFilter, filtered, paginated, page, setPage, totalPages };
}
