import { Button } from "@/components/ui/button";

/**
 * Compact prev/next pager for the industry-vertical tables (B2B, Education, Healthcare, Insurance).
 *
 * These tables are dense and stacked several to a screen, so the fuller {@link Pager} would take more
 * room than the rows it pages. Renders nothing while everything fits on one page.
 */
export function VerticalPager({
  page, totalPages, totalCount, label, onPage,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  /** Plural noun for the row type, e.g. "proposals". */
  label: string;
  onPage: (next: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">
        Page {page} of {totalPages} · {totalCount} {label}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline" size="sm" className="h-7"
          disabled={page <= 1}
          onClick={() => onPage(Math.max(1, page - 1))}
        >
          Prev
        </Button>
        <Button
          variant="outline" size="sm" className="h-7"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
