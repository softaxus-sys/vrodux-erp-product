import * as React from "react";
import { useTranslation } from "react-i18next";
import { Plus, Filter, Search, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PipelineStats } from "./pipeline-stats";
import { ForecastBar } from "./forecast-bar";
import { PipelineBoard } from "./pipeline-board";
import { DealDrawer } from "./deal-drawer";
import { AddDealForm } from "./add-deal-form";
import { cn } from "@/lib/utils";
import { PIPELINE_STAGES, type DealDto as Deal } from "@/lib/crm/crm.api";
import { useDealsPaged, useCrmSummary } from "@/hooks/crm/use-crm";
import { useCurrency } from "@/hooks/use-currency";
import { toCsv, downloadFile } from "@/lib/csv";
import { exportPdf } from "@/lib/pdf";
import { ExportMenu } from "@/components/ui/export-menu";
import { Can } from "@/components/auth/can";

type ViewMode = "board" | "list";

const PAGE_SIZE = 25;
/** The board draws all six stages at once, so it takes the server maximum rather than paging. */
const BOARD_LIMIT = 200;

export function PipelineView() {
  const { t } = useTranslation("crm");
  const { data: crmSummary }            = useCrmSummary();
  const currency = useCurrency();
  const [selectedDeal, setSelectedDeal] = React.useState<Deal | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<ViewMode>("board");
  const [search, setSearch] = React.useState("");
  const [stageFilter, setStageFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [editingDeal, setEditingDeal] = React.useState<Deal | null>(null);
  const openEditDeal = (d: Deal) => { setDrawerOpen(false); setEditingDeal(d); setShowAddForm(true); };
  const closeDealForm = () => { setShowAddForm(false); setEditingDeal(null); };

  // Typing now hits the server, so the request waits until they stop.
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  React.useEffect(() => { setPage(1); }, [debouncedSearch, stageFilter, viewMode]);

  // The board draws every stage at once and holds local state for drag-and-drop, so it cannot page
  // the way a table does. It asks for the server's maximum instead — the highest-value deals, which
  // is the order the board already sorts in — and says so plainly when there are more (below).
  const boardMode = viewMode === "board";
  const { data: paged, isLoading, isFetching } = useDealsPaged({
    search: debouncedSearch || undefined,
    stage:  stageFilter,
    page:   boardMode ? 1 : page,
    pageSize: boardMode ? BOARD_LIMIT : PAGE_SIZE,
  });
  const filtered   = paged?.items ?? [];
  const totalCount = paged?.totalCount ?? 0;
  const totalPages = paged?.totalPages ?? 1;

  const handleView = (deal: Deal) => {
    setSelectedDeal(deal);
    setDrawerOpen(true);
  };

  const exportCsv = () => {
    const csv = toCsv(filtered.map(d => ({
      "Title":        d.title,
      "Company":      d.company,
      "Stage":        d.stage,
      "Value":        d.value,
      "Currency":     currency,
      "Probability":  d.probability,
      "Priority":     d.priority,
      "Assigned To":  d.assignedTo,
      "Source":       d.source,
      "Close Date":   d.expectedCloseDate,
      "Created":      d.createdDate,
    })), ["Title","Company","Stage","Value","Currency","Probability","Priority","Assigned To","Source","Close Date","Created"]);
    downloadFile(`pipeline_deals_${new Date().toISOString().split("T")[0]}.csv`, csv);
  };

  const exportPdfReport = () => exportPdf({
    title: "Sales Pipeline",
    subtitle: `${filtered.length} of ${totalCount} deals${boardMode ? "" : ` (page ${page})`}`,
    columns: ["Title","Company","Stage","Value","Currency","Probability","Assigned To","Close Date"],
    rows: filtered.map(d => [d.title, d.company, d.stage, d.value, currency, `${d.probability}%`, d.assignedTo, d.expectedCloseDate]),
    landscape: true,
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("pipeline.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("pipeline.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} />
          <Can permission="crm.pipeline.create">
            <Button size="sm" className="h-9 gap-1.5 text-sm" onClick={() => { setEditingDeal(null); setShowAddForm(true); }}>
              <Plus className="h-4 w-4" />{t("pipeline.addDeal")}
            </Button>
          </Can>
        </div>
      </div>

      {/* Stats */}
      {crmSummary && <PipelineStats summary={crmSummary} />}

      {/* Forecast roll-up */}
      {crmSummary && <ForecastBar summary={crmSummary} />}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={t("pipeline.searchPlaceholder")}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          {/* Stage pills */}
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setStageFilter("all")}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                stageFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {t("pipeline.all")}
            </button>
            {PIPELINE_STAGES.map(s => (
              <button
                key={s.key}
                onClick={() => setStageFilter(s.key)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                  stageFilter === s.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {t(`stage.${s.key}`)}
              </button>
            ))}
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-muted rounded-lg p-0.5 shrink-0">
          <button
            onClick={() => setViewMode("board")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              viewMode === "board" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
          >
            <LayoutGrid className="h-3.5 w-3.5" />{t("pipeline.board")}
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              viewMode === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
          >
            <List className="h-3.5 w-3.5" />{t("pipeline.list")}
          </button>
        </div>
      </div>

      {/* Board / List */}
      {boardMode ? (
        <>
          {totalCount > BOARD_LIMIT && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-2.5 text-xs text-foreground">
              {t("pipeline.boardCapped", {
                shown: BOARD_LIMIT,
                total: totalCount,
                defaultValue: "Showing the {{shown}} highest-value opportunities of {{total}}. Narrow with search or a stage filter, or switch to the list view to page through all of them.",
              })}
            </div>
          )}
          <PipelineBoard deals={filtered} onDealClick={handleView} />
        </>
      ) : (
        <PipelineListView
          deals={filtered} onDealClick={handleView}
          page={page} totalPages={totalPages} totalCount={totalCount}
          busy={isFetching} onPage={setPage}
        />
      )}

      {/* Drawer */}
      <DealDrawer deal={selectedDeal} open={drawerOpen} onClose={() => setDrawerOpen(false)} onEdit={openEditDeal} />
      <AddDealForm open={showAddForm} onClose={closeDealForm} editing={editingDeal} />
    </div>
  );
}

/* ── Inline list view ── */
import { formatCurrency, formatDate } from "@/lib/utils";
import { DealPriorityBadge } from "./deal-status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Pager } from "@/components/ui/pager";
import { useBulkFileDealsToTeam } from "@/hooks/crm/use-crm";
import { TeamFilingBar, useRowSelection } from "@/modules/crm/shared/components/team-filing-bar";

function PipelineListView({ deals, onDealClick, page, totalPages, totalCount, busy, onPage }: {
  deals: Deal[]; onDealClick: (d: Deal) => void;
  page: number; totalPages: number; totalCount: number; busy: boolean;
  onPage: (updater: (p: number) => number) => void;
}) {
  const { t } = useTranslation("crm");
  const currency = useCurrency();

  // Opportunities must be filed to a team too, not just leads — every pipeline/forecast report reads
  // deals, so unfiled deals leave a team lead's reports empty.
  // Selection covers the page on screen; ticking rows the user cannot see makes the count meaningless.
  const selection = useRowSelection(deals.map(d => d.id));
  const bulkFile = useBulkFileDealsToTeam();
  const fileSelected = (teamId: string | null) =>
    bulkFile.mutateAsync({ dealIds: [...selection.picked], teamId });
  const stageStyle = (stage: Deal["stage"]) => {
    const s = PIPELINE_STAGES.find(x => x.key === stage);
    return s ? `${s.color} ${s.bg} px-2 py-0.5 rounded-full text-[11px] font-semibold` : "";
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-y border-border bg-muted/30">
              <tr>
                {[
                  ["deal", t("pipeline.table.deal")], ["company", t("pipeline.table.company")],
                  ["value", t("pipeline.table.value")], ["stage", t("pipeline.table.stage")],
                  ["probability", t("pipeline.table.probability")], ["closeDate", t("pipeline.table.closeDate")],
                  ["assignedTo", t("pipeline.table.assignedTo")], ["priority", t("pipeline.table.priority")],
                ].map(([k, h]) => (
                  <th key={k} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {totalCount === 0 ? (
                <tr><td colSpan={9} className="text-center py-16 text-muted-foreground text-sm">{t("pipeline.noDeals")}</td></tr>
              ) : deals.map((deal, i) => (
                <motion.tr
                  key={deal.id}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 12) * 0.03 }}
                  className="erp-table-row cursor-pointer"
                  onClick={() => onDealClick(deal)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-sm leading-tight line-clamp-1">{deal.title}</p>
                    <p className="text-[11px] text-muted-foreground">{deal.source}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{deal.company}</td>
                  <td className="px-4 py-3 font-semibold text-sm whitespace-nowrap">{formatCurrency(deal.value, currency)}</td>
                  <td className="px-4 py-3">
                    <span className={stageStyle(deal.stage)}>
                      {t(`stage.${deal.stage}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", deal.probability >= 70 ? "bg-success" : deal.probability >= 40 ? "bg-warning" : "bg-destructive")}
                          style={{ width: `${deal.probability}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{deal.probability}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{formatDate(deal.expectedCloseDate, "medium")}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{deal.assignedTo}</td>
                  <td className="px-4 py-3"><DealPriorityBadge priority={deal.priority} /></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalCount > 0 && (
          <div className="border-t border-border">
            <Pager page={page} totalPages={totalPages} totalCount={totalCount} pageSize={PAGE_SIZE} busy={busy} onPage={onPage} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

