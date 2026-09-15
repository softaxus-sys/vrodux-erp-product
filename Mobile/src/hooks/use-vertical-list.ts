import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { VerticalPage, VerticalPageParams } from "@/lib/verticals-shared";

const PAGE_SIZE = 25;

/**
 * Shared infinite-scroll + search + status-filter state machine, extracted from the pattern
 * repeated across Sales/Real Estate's paginated list screens -- every B2B/Education/Healthcare/
 * Insurance sub-feature list follows the identical `{page,pageSize,status,search} -> {items,page,
 * totalPages}` shape (see lib/verticals-shared.ts), so this is the one place that logic lives
 * rather than copy-pasted twelve times.
 */
export function usePagedVerticalList<T>(
  queryKeyPrefix: readonly unknown[],
  fetchFn: (params: VerticalPageParams) => Promise<VerticalPage<T>>,
  enabled = true,
) {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<T[]>([]);

  const params: VerticalPageParams = {
    page,
    pageSize: PAGE_SIZE,
    search: search.trim() || undefined,
    status: status === "all" ? undefined : status,
  };

  const query = useQuery({
    queryKey: [...queryKeyPrefix, params],
    queryFn: () => fetchFn(params),
    enabled,
  });

  useEffect(() => setPage(1), [status, search]);
  useEffect(() => {
    if (!query.data) return;
    setItems((prev) => (query.data!.page === 1 ? query.data!.items : [...prev, ...query.data!.items]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  const hasMore = query.data ? query.data.page < query.data.totalPages : false;

  function loadMore() {
    if (hasMore && !query.isFetching) setPage((p) => p + 1);
  }
  function refresh() {
    if (page === 1) query.refetch();
    else setPage(1);
  }

  return {
    items,
    status,
    setStatus,
    search,
    setSearch,
    page,
    hasMore,
    loadMore,
    refresh,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,
  };
}
