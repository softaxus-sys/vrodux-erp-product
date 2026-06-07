import * as React from "react";
import { Button } from "@/components/ui/button";

/**
 * Client-side pagination for in-memory arrays (lists fetched whole, not paged
 * by the server). Slices `items` into the current page and returns the page
 * data plus controls. Page auto-resets to 1 when the source length shrinks
 * (e.g. after a search filter) so you never land on an empty page.
 */
export function useClientPagination<T>(items: T[], pageSize = 20) {
  const [page, setPage] = React.useState(1);
  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Clamp page when the list shrinks
  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const start = (page - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return {
    page,
    setPage,
    totalPages,
    totalCount,
    pageItems,
    hasPrev: page > 1,
    hasNext: page < totalPages,
  };
}

interface ClientPaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** Plural noun for the count label, e.g. "brands". Default "items". */
  label?: string;
}

export function ClientPagination({
  page, totalPages, totalCount, hasPrev, hasNext, onPrev, onNext, label = "items",
}: ClientPaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground text-xs">
        Page {page} of {totalPages} ({totalCount} {label})
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="h-8" disabled={!hasPrev} onClick={onPrev}>Prev</Button>
        <Button variant="outline" size="sm" className="h-8" disabled={!hasNext} onClick={onNext}>Next</Button>
      </div>
    </div>
  );
}
