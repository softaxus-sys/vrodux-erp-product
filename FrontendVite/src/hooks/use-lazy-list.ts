import * as React from "react";

/**
 * Progressive rendering for long lists. Renders the first `pageSize` items and
 * grows the window either via a "Show more" button (`loadMore`) or automatically
 * when the `sentinelRef` element scrolls into view (infinite scroll).
 *
 * Resets to the first page whenever the source list's length changes (e.g. after
 * filtering or a refetch), so newly added items are always reachable.
 */
export function useLazyList<T>(items: T[], pageSize = 25) {
  const [count, setCount] = React.useState(pageSize);

  // Reset the window when the underlying list size changes (filter/refetch/new item).
  React.useEffect(() => { setCount(pageSize); }, [items.length, pageSize]);

  const visible = React.useMemo(() => items.slice(0, count), [items, count]);
  const hasMore = count < items.length;
  const loadMore = React.useCallback(() => setCount(c => c + pageSize), [pageSize]);

  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      entries => { if (entries[0]?.isIntersecting) loadMore(); },
      { rootMargin: "240px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore, count]);

  return { visible, hasMore, loadMore, sentinelRef, shown: visible.length, total: items.length };
}
