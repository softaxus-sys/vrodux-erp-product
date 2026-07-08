import * as React from "react";
import { motion } from "framer-motion";
import {
  Search, Plus, Stamp, FileWarning, Send, CheckCircle2, XCircle,
  DollarSign, LayoutGrid, List, Users, Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useLazyList } from "@/hooks/use-lazy-list";
import { Can } from "@/components/auth/can";
import {
  CASE_STATUS_META, CASE_BOARD_COLUMNS, CASE_TRANSITIONS,
  type VisaCaseSummaryDto as VisaCase, type VisaCaseStatus,
} from "@/lib/visa/visa.api";
import { useVisaCases, useVisaCasesSummary, useChangeCaseStatus } from "@/hooks/visa/use-visa";
import { useAuthStore } from "@/store/auth.store";
import { toast } from "sonner";
import { CaseDrawer } from "./case-drawer";
import { NewCaseWizard } from "./new-case-wizard";

type ViewMode = "board" | "list";

const TODAY = new Date().toISOString().split("T")[0];

function StatusBadge({ status }: { status: VisaCaseStatus }) {
  const m = CASE_STATUS_META[status];
  if (!m) return null;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap", m.color, m.bg)}>
      {m.label}
    </span>
  );
}

function SlaChip({ due, status }: { due?: string | null; status: VisaCaseStatus }) {
  if (!due || ["issued", "closed", "cancelled", "rejected"].includes(status)) return null;
  const overdue = due < TODAY;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px]", overdue ? "text-destructive font-semibold" : "text-muted-foreground")}>
      <Clock className="h-3 w-3" />{formatDate(due, "medium")}{overdue && " · overdue"}
    </span>
  );
}

function CaseCard({ c, index, onClick }: { c: VisaCase; index: number; onClick: () => void }) {
  const currency = useCurrency();
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 12) * 0.04 }}
      onClick={onClick}
      className="bg-background border border-border rounded-xl p-4 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors line-clamp-2">
          {c.primaryApplicantName || c.customerName || c.caseNumber}
        </p>
        <span className="shrink-0 text-[10px] font-mono text-muted-foreground">{c.caseNumber}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-2 truncate">{c.visaTypeName}</p>
      <div className="flex items-center justify-between mb-2">
        <p className="font-bold text-sm">{formatCurrency(c.serviceFee + c.govtFee, currency)}</p>
        <SlaChip due={c.slaDueDate} status={c.status} />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          <Users className="h-3 w-3" />{c.applicantCount}
          {c.documentsTotal > 0 && <> · docs {c.documentsTotal - c.documentsPending}/{c.documentsTotal}</>}
        </span>
        <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">{c.assignedTo}</span>
      </div>
    </motion.div>
  );
}

function BoardColumn({
  status, cases, isOver, draggedId, onDragOver, onDrop, onDragLeave,
  onCardDragStart, onCardDragEnd, onCaseClick,
}: {
  status: VisaCaseStatus;
  cases: VisaCase[];
  isOver: boolean;
  draggedId: string | null;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onCardDragStart: (e: React.DragEvent, id: string) => void;
  onCardDragEnd: () => void;
  onCaseClick: (c: VisaCase) => void;
}) {
  const m = CASE_STATUS_META[status];
  const { visible, hasMore, loadMore, shown, total } = useLazyList(cases, 10);

  return (
    <div className="flex flex-col flex-shrink-0 w-72" onDragOver={onDragOver} onDrop={onDrop} onDragLeave={onDragLeave}>
      <div className={cn("flex items-center justify-between px-3 py-2.5 rounded-xl mb-3 border transition-colors",
        isOver ? "border-primary/40 bg-primary/5" : `${m.bg} border-transparent`)}>
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-bold uppercase tracking-wide", m.color)}>{m.label}</span>
          <span className={cn("inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold", m.color, m.bg)}>
            {total}
          </span>
        </div>
      </div>
      <div className={cn("flex flex-col gap-3 flex-1 rounded-xl p-1 transition-colors min-h-[100px]",
        isOver && "bg-primary/3 ring-1 ring-primary/20")}>
        {visible.map((c, i) => (
          <div key={c.id} draggable onDragStart={e => onCardDragStart(e, c.id)} onDragEnd={onCardDragEnd}
            className={cn("transition-opacity", draggedId === c.id && "opacity-40")}>
            <CaseCard c={c} index={i} onClick={() => onCaseClick(c)} />
          </div>
        ))}
        {hasMore && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" onClick={loadMore}>
            Show {total - shown} more
          </Button>
        )}
        {total === 0 && (
          <div className={cn("flex-1 flex items-center justify-center rounded-lg border-2 border-dashed text-xs text-muted-foreground/50 h-24",
            isOver ? "border-primary/40 text-primary" : "border-border")}>
            {isOver ? "Drop here" : "No cases"}
          </div>
        )}
      </div>
    </div>
  );
}

function CasesBoard({ cases, onCaseClick }: { cases: VisaCase[]; onCaseClick: (c: VisaCase) => void }) {
  const changeStatus = useChangeCaseStatus();
  const byName = useAuthStore(s => s.user?.name) ?? "";
  const [colCases, setColCases] = React.useState<VisaCase[]>(cases);
  const [draggedId, setDraggedId] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState<string | null>(null);

  React.useEffect(() => { setColCases(cases); }, [cases]);

  const handleDrop = (status: VisaCaseStatus) => {
    const id = draggedId;
    setDraggedId(null); setDragOver(null);
    if (!id) return;
    const c = colCases.find(x => x.id === id);
    if (!c || c.status === status) return;
    // Only legal moves per the status machine (mirrors the backend guard).
    if (!CASE_TRANSITIONS[c.status]?.includes(status)) {
      toast.error(`A ${CASE_STATUS_META[c.status].label} case can't move to ${CASE_STATUS_META[status].label}.`);
      return;
    }
    setColCases(prev => prev.map(x => x.id === id ? { ...x, status } : x));
    changeStatus.mutate({ id, status, byName });
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[520px]">
      {CASE_BOARD_COLUMNS.map(status => (
        <BoardColumn
          key={status}
          status={status}
          cases={colCases.filter(c => c.status === status)}
          isOver={dragOver === status}
          draggedId={draggedId}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(status); }}
          onDrop={e => { e.preventDefault(); handleDrop(status); }}
          onDragLeave={() => setDragOver(null)}
          onCardDragStart={(e, id) => { setDraggedId(id); e.dataTransfer.effectAllowed = "move"; }}
          onCardDragEnd={() => { setDraggedId(null); setDragOver(null); }}
          onCaseClick={onCaseClick}
        />
      ))}
    </div>
  );
}

export function VisaCasesView() {
  const currency = useCurrency();
  const { data: cases = [], isLoading } = useVisaCases();
  const { data: summary } = useVisaCasesSummary();

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [viewMode, setViewMode] = React.useState<ViewMode>("board");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [showWizard, setShowWizard] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return cases
      .filter(c => {
        const matchSearch = !search
          || c.caseNumber.toLowerCase().includes(q)
          || c.primaryApplicantName.toLowerCase().includes(q)
          || (c.customerName ?? "").toLowerCase().includes(q)
          || c.visaTypeName.toLowerCase().includes(q);
        const matchStatus = statusFilter === "all" || c.status === statusFilter;
        return matchSearch && matchStatus;
      })
      .sort((a, b) => (a.slaDueDate ?? "9999") < (b.slaDueDate ?? "9999") ? -1 : 1); // most urgent first
  }, [cases, search, statusFilter]);

  const listLazy = useLazyList(filtered, 25);
  const openDrawer = (c: VisaCase) => { setSelectedId(c.id); setDrawerOpen(true); };

  const stats = [
    { label: "Total Cases",    value: summary?.total ?? cases.length,       sub: "All time",       icon: Stamp,        color: "text-primary bg-primary/10" },
    { label: "Open",           value: summary?.open ?? 0,                    sub: "In progress",    icon: Clock,        color: "text-blue-600 bg-blue-100 dark:bg-blue-900/20" },
    { label: "Docs Pending",   value: summary?.docsPending ?? 0,             sub: "Awaiting papers",icon: FileWarning,  color: "text-amber-600 bg-amber-100 dark:bg-amber-900/20" },
    { label: "Submitted",      value: summary?.submitted ?? 0,               sub: "With government",icon: Send,         color: "text-violet-600 bg-violet-100 dark:bg-violet-900/20" },
    { label: "Approved (mo.)", value: summary?.approvedThisMonth ?? 0,       sub: "This month",     icon: CheckCircle2, color: "text-success bg-success/10" },
    { label: "Open Fees",      value: formatCurrency((summary?.openServiceFees ?? 0) + (summary?.openGovtFees ?? 0), currency), sub: "Service + govt", icon: DollarSign, color: "text-warning bg-warning/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Visa Cases</h1>
          <p className="text-sm text-muted-foreground mt-0.5">UAE visa applications — intake, documents, submission, tracking</p>
        </div>
        <Can permission="visa.cases.create">
          <Button size="sm" className="h-9 gap-1.5 text-sm" onClick={() => setShowWizard(true)}>
            <Plus className="h-4 w-4" />New Case
          </Button>
        </Can>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="card-hover">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", s.color)}><s.icon className="h-4 w-4" /></div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{s.label}</p>
                  <p className="font-bold text-base leading-tight">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground/70">{s.sub}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search cases, applicants..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {(["all", ...Object.keys(CASE_STATUS_META)] as string[]).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn("px-3 py-1 rounded-full text-xs font-medium transition-colors",
                  statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
                {s === "all" ? "All" : CASE_STATUS_META[s as VisaCaseStatus].label}
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

      {/* Board */}
      {viewMode === "board" && <CasesBoard cases={filtered} onCaseClick={openDrawer} />}

      {/* List */}
      {viewMode === "list" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y border-border bg-muted/30">
                  <tr>
                    {["Case #","Applicant","Visa Type","Emirate","Docs","Fees","SLA Due","Assigned To","Status"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={9} className="text-center py-16 text-muted-foreground text-sm">Loading cases…</td></tr>
                  ) : listLazy.total === 0 ? (
                    <tr><td colSpan={9} className="text-center py-16 text-muted-foreground text-sm">No visa cases yet. Create your first case.</td></tr>
                  ) : listLazy.visible.map((c, i) => (
                    <motion.tr key={c.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 12) * 0.03 }} className="erp-table-row cursor-pointer" onClick={() => openDrawer(c)}>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{c.caseNumber}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm">{c.primaryApplicantName || "—"}</p>
                        {c.customerName && <p className="text-[11px] text-muted-foreground">{c.customerName}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{c.visaTypeName}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{c.emirate || "—"}</td>
                      <td className="px-4 py-3 text-sm text-center whitespace-nowrap">
                        {c.documentsTotal > 0 ? `${c.documentsTotal - c.documentsPending}/${c.documentsTotal}` : "—"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-sm whitespace-nowrap">{formatCurrency(c.serviceFee + c.govtFee, currency)}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><SlaChip due={c.slaDueDate} status={c.status} /></td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{c.assignedTo || "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            {listLazy.hasMore && (
              <div ref={listLazy.sentinelRef} className="flex justify-center py-4 border-t border-border">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={listLazy.loadMore}>Load more</Button>
              </div>
            )}
            <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
              Showing {listLazy.shown} of {listLazy.total} cases
            </div>
          </CardContent>
        </Card>
      )}

      <CaseDrawer caseId={selectedId} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <NewCaseWizard open={showWizard} onClose={() => setShowWizard(false)} />
    </div>
  );
}
