import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface Props {
  page: number;
  totalPages: number;
  totalCount: number;
  /** Rows per page — used only to render the "showing x–y of n" range. */
  pageSize?: number;
  /** True while the next page is loading; disables the buttons so a double-click cannot skip a page. */
  busy?: boolean;
  onPage: (updater: (p: number) => number) => void;
}

/**
 * Previous / Next paging controls for a server-paged list.
 *
 * Every list that pages in SQL needs the same three things — the visible range, the page position,
 * and two guarded buttons — so they live here rather than being written out per screen.
 */
export function Pager({ page, totalPages, totalCount, pageSize = 30, busy = false, onPage }: Props) {
  const { t } = useTranslation("common");
  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-xs text-muted-foreground">
        {t("pager.showing", {
          shown: `${from}–${to}`,
          total: totalCount,
          defaultValue: "Showing {{shown}} of {{total}}",
        })}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-8 text-xs"
          disabled={page <= 1 || busy}
          onClick={() => onPage(p => Math.max(1, p - 1))}>
          {t("pager.prev", { defaultValue: "Previous" })}
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums">{page} / {totalPages}</span>
        <Button variant="outline" size="sm" className="h-8 text-xs"
          disabled={page >= totalPages || busy}
          onClick={() => onPage(p => p + 1)}>
          {t("pager.next", { defaultValue: "Next" })}
        </Button>
      </div>
    </div>
  );
}
