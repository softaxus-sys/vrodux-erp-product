import * as React from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Builds the page numbers to render, collapsing long runs into `null`
 * (an ellipsis). Always keeps the first page, the last page, and a window
 * around the current one, so the control stays a fixed width whatever the
 * page count is.
 */
export function buildPageWindow(page: number, totalPages: number, siblings = 1): (number | null)[] {
  // First + last + current + siblings on each side + 2 ellipsis slots
  const maxSlots = siblings * 2 + 5;
  if (totalPages <= maxSlots) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const left  = Math.max(page - siblings, 1);
  const right = Math.min(page + siblings, totalPages);
  const showLeftGap  = left > 2;
  const showRightGap = right < totalPages - 1;

  const out: (number | null)[] = [1];
  if (showLeftGap) out.push(null);
  // When a gap is hidden, extend the window so the slot count stays constant.
  const from = showLeftGap ? left : 2;
  const to   = showRightGap ? right : totalPages - 1;
  for (let p = from; p <= to; p++) out.push(p);
  if (showRightGap) out.push(null);
  out.push(totalPages);
  return out;
}

interface PaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  /** Items on the current page — used for the "showing x–y" range. */
  pageCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Dims the control while a page is in flight, without unmounting it. */
  isFetching?: boolean;
  className?: string;
}

/**
 * Server-side pagination control: a "showing x–y of n" range plus numbered
 * page buttons. Renders whenever there is at least one row — the range label
 * is useful on a single page too, and keeping it mounted stops the table from
 * jumping as the count crosses a page boundary.
 */
export function Pagination({
  page, totalPages, totalCount, pageCount, pageSize,
  onPageChange, isFetching, className,
}: PaginationProps) {
  const { t } = useTranslation("common");
  if (totalCount === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to   = from + pageCount - 1;
  const go   = (p: number) => onPageChange(Math.min(Math.max(1, p), totalPages));

  return (
    <div
      className={cn(
        "flex flex-col gap-3 px-4 py-3 border-t border-border sm:flex-row sm:items-center sm:justify-between",
        isFetching && "opacity-60 transition-opacity",
        className,
      )}
    >
      <p className="text-xs text-muted-foreground">
        {t("pagination.range", { from, to, total: totalCount })}
      </p>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline" size="sm" className="h-8 gap-1 px-2"
            onClick={() => go(page - 1)} disabled={page === 1}
            aria-label={t("pagination.prev")}
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            <span className="hidden sm:inline">{t("pagination.prev")}</span>
          </Button>

          {buildPageWindow(page, totalPages).map((p, i) =>
            p === null ? (
              <span key={`gap-${i}`} className="px-1.5 text-xs text-muted-foreground select-none">…</span>
            ) : (
              <Button
                key={p}
                variant={p === page ? "default" : "outline"}
                size="sm"
                className="h-8 min-w-8 px-2 tabular-nums"
                onClick={() => go(p)}
                aria-current={p === page ? "page" : undefined}
                aria-label={t("pagination.goToPage", { page: p })}
              >
                {p}
              </Button>
            ),
          )}

          <Button
            variant="outline" size="sm" className="h-8 gap-1 px-2"
            onClick={() => go(page + 1)} disabled={page >= totalPages}
            aria-label={t("pagination.next")}
          >
            <span className="hidden sm:inline">{t("pagination.next")}</span>
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>
      )}
    </div>
  );
}
