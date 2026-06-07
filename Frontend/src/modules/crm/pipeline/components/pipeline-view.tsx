"use client";

import * as React from "react";
import { Plus, Search, LayoutGrid, List, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PipelineStats } from "./pipeline-stats";
import { PipelineBoard } from "./pipeline-board";
import { DealDrawer } from "./deal-drawer";
import { AddDealForm } from "./add-deal-form";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useDeals, useDealSummary } from "@/hooks/crm/use-deals";
import { PIPELINE_STAGES, type DealDto, type DealSummaryDto } from "@/lib/crm/deals.api";
import { DealPriorityBadge } from "./deal-status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

type ViewMode = "board" | "list";

export function PipelineView() {
  const [selectedDeal, setSelectedDeal] = React.useState<DealDto | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<ViewMode>("board");
  const [search, setSearch] = React.useState("");
  const [stageFilter, setStageFilter] = React.useState("all");
  const [showAddForm, setShowAddForm] = React.useState(false);

  const { data: deals = [], isLoading } = useDeals();
  const { data: summary } = useDealSummary();

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return deals.filter(d => {
      const matchSearch = !search || d.title.toLowerCase().includes(q) || d.company.toLowerCase().includes(q);
      const matchStage  = stageFilter === "all" || d.stage === stageFilter;
      return matchSearch && matchStage;
    });
  }, [deals, search, stageFilter]);

  // Compute summary from deals if the dedicated summary endpoint hasn't loaded yet
  const computedSummary: DealSummaryDto = React.useMemo(() => {
    if (summary) return summary;
    const active = deals.filter(d => d.stage !== "lost");
    const won    = deals.filter(d => d.stage === "won");
    const lost   = deals.filter(d => d.stage === "lost");
    const closed = [...won, ...lost];
    return {
      totalDeals:  deals.length,
      totalValue:  active.reduce((s, d) => s + d.value, 0),
      wonValue:    won.reduce((s, d) => s + d.value, 0),
      lostDeals:   lost.length,
      avgDealSize: active.length ? Math.round(active.reduce((s, d) => s + d.value, 0) / active.length) : 0,
      winRate:     closed.length ? Math.round((won.length / closed.length) * 100) : 0,
    };
  }, [summary, deals]);

  const handleView = (deal: DealDto) => {
    setSelectedDeal(deal);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sales Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track and manage your deals across all stages</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-sm">
            <Download className="h-3.5 w-3.5" />Export
          </Button>
          <Button size="sm" className="h-9 gap-1.5 text-sm" onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4" />Add Deal
          </Button>
        </div>
      </div>

      {/* Stats */}
      <PipelineStats summary={computedSummary} />

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search deals..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <button onClick={() => setStageFilter("all")}
              className={cn("px-3 py-1 rounded-full text-xs font-medium transition-colors",
                stageFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
              All
            </button>
            {PIPELINE_STAGES.map(s => (
              <button key={s.key} onClick={() => setStageFilter(s.key)}
                className={cn("px-3 py-1 rounded-full text-xs font-medium transition-colors",
                  stageFilter === s.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center bg-muted rounded-lg p-0.5 shrink-0">
          <button onClick={() => setViewMode("board")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              viewMode === "board" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>
            <LayoutGrid className="h-3.5 w-3.5" />Board
          </button>
          <button onClick={() => setViewMode("list")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              viewMode === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>
            <List className="h-3.5 w-3.5" />List
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-sm text-muted-foreground">Loading…</div>
      )}

      {/* Board / List */}
      {!isLoading && (
        viewMode === "board" ? (
          <PipelineBoard deals={filtered} onDealClick={handleView} />
        ) : (
          <PipelineListView deals={filtered} onDealClick={handleView} totalCount={deals.length} />
        )
      )}

      {/* Drawer */}
      <DealDrawer deal={selectedDeal} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AddDealForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}

/* ── Inline list view ── */
function PipelineListView({ deals, onDealClick, totalCount }: {
  deals: DealDto[];
  onDealClick: (d: DealDto) => void;
  totalCount: number;
}) {
  const stageStyle = (stage: DealDto["stage"]) => {
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
                {["Deal","Company","Value","Stage","Probability","Close Date","Assigned To","Priority"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deals.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-16 text-muted-foreground text-sm">No deals found.</td></tr>
              ) : deals.map((deal, i) => (
                <motion.tr key={deal.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }} className="erp-table-row cursor-pointer" onClick={() => onDealClick(deal)}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-sm leading-tight line-clamp-1">{deal.title}</p>
                    <p className="text-[11px] text-muted-foreground">{deal.source}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{deal.company}</td>
                  <td className="px-4 py-3 font-semibold text-sm whitespace-nowrap">{formatCurrency(deal.value, deal.currency)}</td>
                  <td className="px-4 py-3">
                    <span className={stageStyle(deal.stage)}>
                      {PIPELINE_STAGES.find(s => s.key === deal.stage)?.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", deal.probability >= 70 ? "bg-success" : deal.probability >= 40 ? "bg-warning" : "bg-destructive")}
                          style={{ width: `${deal.probability}%` }} />
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
        <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
          Showing {deals.length} of {totalCount} deals
        </div>
      </CardContent>
    </Card>
  );
}
