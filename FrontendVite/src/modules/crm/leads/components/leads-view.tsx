import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Search, Plus, Users, TrendingUp,
  Target, CheckCircle2, DollarSign, Zap, LayoutGrid, List,
  Building2, Calendar, Globe, ArrowRight, UploadCloud, Phone, Clock, Wallet, Tag,
  ArrowUp, ArrowDown, Loader2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LeadDrawer } from "./lead-drawer";
import { AddLeadForm } from "./add-lead-form";
import { ImportLeadsModal } from "./import-leads-modal";
import { cn, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { sourceLabel, URGENCY_META, leadHeat, buildLeadSummary, formatCompactValue, type LeadDto as Lead, type LeadStatus, type LeadSource, type DealStage } from "@/lib/crm/crm.api";
import { useLeads, useLeadsSummary, useSetLeadStatus, useConvertLead } from "@/hooks/crm/use-crm";
import { toast } from "sonner";
import { useLazyList } from "@/hooks/use-lazy-list";
import { useBulkFileLeadsToTeam } from "@/hooks/crm/use-crm";
import { TeamFilingBar, useRowSelection } from "@/modules/crm/shared/components/team-filing-bar";
import { toCsv, downloadFile } from "@/lib/csv";
import { exportPdf } from "@/lib/pdf";
import { ExportMenu } from "@/components/ui/export-menu";
import { Can } from "@/components/auth/can";
import { useAuthStore } from "@/store/auth.store";

type ViewMode = "list" | "kanban";

type SortKey = "date" | "score" | "value";
type SortDir = "asc" | "desc";

const SORT_LABELS: Record<SortKey, string> = {
  date:  "Date created",
  score: "Intent score",
  value: "Estimated value",
};

/**
 * Comparator for the leads list and every kanban column, so both views agree.
 * `date` is the default: newest first. Ties fall back to score then value, so the
 * ordering stays stable when several leads share a timestamp (bulk imports do this).
 */
function makeLeadComparator(sortBy: SortKey, sortDir: SortDir) {
  const dir = sortDir === "asc" ? 1 : -1;
  return (a: Lead, b: Lead) => {
    let diff: number;
    switch (sortBy) {
      case "score": diff = a.score - b.score; break;
      case "value": diff = a.estimatedValue - b.estimatedValue; break;
      case "date":
      default: {
        // Missing/invalid dates sort oldest so they never squat on top of a desc list.
        const at = new Date(a.createdDate).getTime();
        const bt = new Date(b.createdDate).getTime();
        diff = (Number.isNaN(at) ? 0 : at) - (Number.isNaN(bt) ? 0 : bt);
        break;
      }
    }
    if (diff !== 0) return diff * dir;
    return (b.score - a.score) || (b.estimatedValue - a.estimatedValue);
  };
}

// `label` intentionally removed — status text comes from i18n via t(`status.${status}`).
const STATUS_CONFIG: Record<LeadStatus, { color: string; bg: string; dot: string }> = {
  new:         { color: "text-slate-600",      bg: "bg-slate-100 dark:bg-slate-800/50",  dot: "bg-slate-400" },
  contacted:   { color: "text-blue-600",       bg: "bg-blue-50 dark:bg-blue-900/20",     dot: "bg-blue-500" },
  qualified:   { color: "text-success",        bg: "bg-success/10",                      dot: "bg-success" },
  unqualified: { color: "text-muted-foreground", bg: "bg-muted",                         dot: "bg-muted-foreground" },
  converted:   { color: "text-primary",        bg: "bg-primary/10",                      dot: "bg-primary" },
  lost:        { color: "text-destructive",    bg: "bg-destructive/10",                  dot: "bg-destructive" },
};

const KANBAN_COLS: LeadStatus[] = ["new", "contacted", "qualified", "converted"];

/** Statuses that end a lead's life. Converted is an outcome, not a stage still being worked. */
const CLOSED_LEAD_STATUSES: LeadStatus[] = ["converted", "unqualified", "lost"];

function StatusBadge({ status, outcome }: { status: LeadStatus; outcome?: DealStage | null }) {
  const { t } = useTranslation("crm");
  const c = STATUS_CONFIG[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold", c.color, c.bg)}>
        <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />{t(`status.${status}`)}
      </span>
      {/* A converted lead is not itself won or lost — that happens on the opportunity it became — so
          the deal's result is shown next to the status rather than folded into it. Without this the
          lead is a dead end that never says how the story finished. */}
      {status === "converted" && (outcome === "won" || outcome === "lost") && (
        <span className={cn(
          "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
          outcome === "won" ? "text-success bg-success/10" : "text-destructive bg-destructive/10",
        )}>
          {t(`stage.${outcome}`)}
        </span>
      )}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-success" : score >= 40 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground w-6 text-right">{score}</span>
    </div>
  );
}

/* ── Kanban card — rich at-a-glance view ── */
function LeadKanbanCard({ lead, index, onClick }: { lead: Lead; index: number; onClick: () => void }) {
  const { t } = useTranslation("crm");
  const currency = useCurrency();
  const heat = leadHeat(lead.score);
  const urg = lead.purchaseUrgency && lead.purchaseUrgency !== "unknown" ? URGENCY_META[lead.purchaseUrgency] : null;
  const urgKey = lead.purchaseUrgency;
  const summary = buildLeadSummary(lead);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 12) * 0.04 }}
      onClick={onClick}
      className="bg-background border border-border rounded-xl p-3.5 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group">
      {/* Name + heat */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors line-clamp-1">{lead.fullName}</p>
        <span className={cn("shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold", heat.color, heat.bg)}>
          <span>{heat.emoji}</span>{heat.label} · {lead.score}
        </span>
      </div>

      {/* Intent summary */}
      {summary && summary !== "—" && (
        <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mb-2.5">{summary}</p>
      )}

      {/* Key details */}
      <div className="space-y-1 mb-2.5">
        {lead.phone && (
          <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()}
            className="flex items-center gap-1.5 text-[11px] text-foreground hover:text-primary w-fit">
            <Phone className="h-3 w-3 shrink-0 text-muted-foreground" /><span className="truncate">{lead.phone}</span>
          </a>
        )}
        {lead.interestedIn && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Tag className="h-3 w-3 shrink-0" /><span className="truncate">{lead.interestedIn}</span>
          </div>
        )}
        {lead.budget && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Wallet className="h-3 w-3 shrink-0" /><span className="truncate">{lead.budget}</span>
          </div>
        )}
        {urg && (
          <div className="flex items-center gap-1.5 text-[11px]">
            <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className={cn("px-1.5 py-0.5 rounded-full text-[9px] font-semibold", urg.color, urg.bg)}>{t(`urgency.${urgKey}`)}</span>
          </div>
        )}
      </div>

      {/* Value + footer */}
      {lead.estimatedValue > 0 && <p className="font-bold text-sm mb-2">{formatCompactValue(lead.estimatedValue, currency)}</p>}
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <span className="text-[10px] text-muted-foreground truncate">{sourceLabel(lead.source)}</span>
        <Avatar className="h-5 w-5 shrink-0">
          <AvatarFallback className="text-[8px] font-bold bg-primary/10 text-primary">{getInitials(lead.assignedTo)}</AvatarFallback>
        </Avatar>
      </div>
    </motion.div>
  );
}

/* ── Kanban board (drag to change status; drop on Converted to convert) ── */
function LeadsKanban({ leads, onLeadClick }: { leads: Lead[]; onLeadClick: (l: Lead) => void }) {
  const setStatus = useSetLeadStatus();
  const convert = useConvertLead();
  const [colLeads, setColLeads] = React.useState<Lead[]>(leads);
  const [draggedId, setDraggedId] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState<string | null>(null);

  React.useEffect(() => { setColLeads(leads); }, [leads]);

  const handleDrop = (status: LeadStatus) => {
    const id = draggedId;
    setDraggedId(null);
    setDragOver(null);
    if (!id) return;
    const lead = colLeads.find(l => l.id === id);
    if (!lead || lead.status === status) return;
    // Converting isn't a plain status change — it spins up an account + deal.
    if (status === "converted") {
      setColLeads(prev => prev.map(l => l.id === id ? { ...l, status: "converted" } : l));
      convert.mutate({ id, body: {} });
      return;
    }
    setColLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    setStatus.mutate({ id, status });
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
      {/* Columns inherit the parent's sort order — filter() preserves it. */}
      {KANBAN_COLS.map(status => (
        <LeadColumn
          key={status}
          status={status}
          leads={colLeads.filter(l => l.status === status)}
          isOver={dragOver === status}
          draggedId={draggedId}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(status); }}
          onDrop={e => { e.preventDefault(); handleDrop(status); }}
          onDragLeave={() => setDragOver(null)}
          onCardDragStart={(e, id) => { setDraggedId(id); e.dataTransfer.effectAllowed = "move"; }}
          onCardDragEnd={() => { setDraggedId(null); setDragOver(null); }}
          onLeadClick={onLeadClick}
        />
      ))}
    </div>
  );
}

function LeadColumn({
  status, leads, isOver, draggedId, onDragOver, onDrop, onDragLeave,
  onCardDragStart, onCardDragEnd, onLeadClick,
}: {
  status: LeadStatus;
  leads: Lead[];
  isOver: boolean;
  draggedId: string | null;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onCardDragStart: (e: React.DragEvent, id: string) => void;
  onCardDragEnd: () => void;
  onLeadClick: (l: Lead) => void;
}) {
  const { t } = useTranslation("crm");
  const currency = useCurrency();
  const sc = STATUS_CONFIG[status];
  const { visible, hasMore, loadMore, shown, total } = useLazyList(leads, 8);
  const colValue = leads.reduce((s, l) => s + l.estimatedValue, 0);

  return (
    <div className="flex flex-col flex-shrink-0 w-72" onDragOver={onDragOver} onDrop={onDrop} onDragLeave={onDragLeave}>
      {/* Column header */}
      <div className={cn("flex items-center justify-between px-3 py-2.5 rounded-xl mb-3 border transition-colors",
        isOver ? "border-primary/40 bg-primary/5" : `${sc.bg} border-transparent`)}>
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-bold uppercase tracking-wide", sc.color)}>{t(`status.${status}`)}</span>
          <span className={cn("inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold", sc.color, sc.bg)}>
            {total}
          </span>
        </div>
        <span className="text-[11px] font-semibold text-muted-foreground">
          {colValue > 0 ? formatCurrency(colValue, currency) : "—"}
        </span>
      </div>
      {/* Cards */}
      <div className={cn("flex flex-col gap-3 flex-1 rounded-xl p-1 transition-colors min-h-[100px]",
        isOver && "bg-primary/3 ring-1 ring-primary/20")}>
        {visible.map((lead, i) => (
          <div
            key={lead.id}
            draggable
            onDragStart={e => onCardDragStart(e, lead.id)}
            onDragEnd={onCardDragEnd}
            className={cn("transition-opacity", draggedId === lead.id && "opacity-40")}
          >
            <LeadKanbanCard lead={lead} index={i} onClick={() => onLeadClick(lead)} />
          </div>
        ))}
        {hasMore && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" onClick={loadMore}>
            {t("leads.showMore", { count: total - shown })}
          </Button>
        )}
        {total === 0 && (
          <div className={cn("flex-1 flex items-center justify-center rounded-xl border-2 border-dashed text-xs text-muted-foreground/50 h-24",
            isOver ? "border-primary/40 text-primary" : "border-border")}>
            {isOver ? t("leads.dropHere") : t("leads.noLeads")}
          </div>
        )}
      </div>
    </div>
  );
}

export function LeadsView() {
  const { t } = useTranslation("crm");
  const currency = useCurrency();
  const { data: leads = [], isLoading } = useLeads();

  const exportCsv = () => {
    const csv = toCsv(leads.map(l => ({
      "Name":            l.fullName,
      "Title":           l.title,
      "Company":         l.company,
      "Email":           l.email,
      "Phone":           l.phone,
      "Country":         l.country,
      "Source":          l.source,
      "Status":          l.status,
      "Priority":        l.priority,
      "Score":           l.score,
      "Est. Value":      l.estimatedValue ?? "",
      "Assigned To":     l.assignedTo ?? "",
    })), ["Name","Title","Company","Email","Phone","Country","Source","Status","Priority","Score","Est. Value","Assigned To"]);
    downloadFile(`leads_${new Date().toISOString().split("T")[0]}.csv`, csv);
  };

  const exportPdfReport = () => exportPdf({
    title: "Leads",
    subtitle: `${leads.length} leads`,
    columns: ["Name","Company","Email","Phone","Country","Source","Status","Priority","Score"],
    rows: leads.map(l => [l.fullName, l.company, l.email, l.phone, l.country, l.source, l.status, l.priority, l.score]),
    landscape: true,
  });
  const { data: leadsSummary }          = useLeadsSummary();
  const currentUserName = useAuthStore(s => s.user?.name) ?? "";
  const [search, setSearch] = React.useState("");
  // Defaults to the leads still being worked. Converted and unqualified/lost leads are kept (they are
  // history, not deletions — their documents and activity hang off them) but they are not the working
  // list, and with them mixed in the page reads as though closed leads are still open.
  const [statusFilter, setStatusFilter] = React.useState("open");
  const [sourceFilter, setSourceFilter] = React.useState("all");
  const [mineOnly, setMineOnly] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<ViewMode>("list");
  // Newest-first by default — the freshest lead is the one worth calling now.
  const [sortBy, setSortBy] = React.useState<SortKey>("date");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [showImport, setShowImport] = React.useState(false);
  const [editingLead, setEditingLead] = React.useState<Lead | null>(null);

  const openEdit = (l: Lead) => { setDrawerOpen(false); setEditingLead(l); setShowAddForm(true); };
  const closeForm = () => { setShowAddForm(false); setEditingLead(null); };

  // Deep-link from the Integrations "CSV / Excel Import" card (/crm/leads?import=1).
  const [searchParams, setSearchParams] = useSearchParams();
  React.useEffect(() => {
    if (searchParams.get("import") === "1") {
      setShowImport(true);
      searchParams.delete("import");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return leads
      .filter(l => {
        const matchSearch = !search || [
          l.fullName,
          l.company,
          l.email,
          l.phone,
          l.whatsApp,
          l.source,
          sourceLabel(l.source),
        ].some(v => (v ?? "").toString().toLowerCase().includes(q));
        const matchStatus =
          statusFilter === "all"  ? true
          : statusFilter === "open" ? !CLOSED_LEAD_STATUSES.includes(l.status)
          : l.status === statusFilter;
        const matchSource = sourceFilter === "all" || l.source === sourceFilter;
        const matchMine   = !mineOnly || l.assignedTo === currentUserName;
        return matchSearch && matchStatus && matchSource && matchMine;
      })
      .sort(makeLeadComparator(sortBy, sortDir));
  }, [leads, search, statusFilter, sourceFilter, mineOnly, currentUserName, sortBy, sortDir]);

  const listLazy = useLazyList(filtered, 25);

  // ── Bulk filing to a team ────────────────────────────────────────────────
  // A record is only visible to a team lead once it is filed to a team they lead, so filing existing
  // records has to be possible in bulk. Selection + the bar are shared with Pipeline and Accounts.
  const selection = useRowSelection(listLazy.visible.map(l => l.id));
  const bulkFile = useBulkFileLeadsToTeam();

  const fileSelected = (teamId: string | null) =>
    bulkFile.mutateAsync({ leadIds: [...selection.picked], teamId });

  const openDrawer = (l: Lead) => { setSelectedLead(l); setDrawerOpen(true); };

  const uniqueSources = [...new Set(leads.map(l => l.source))] as LeadSource[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("leads.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("leads.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={mineOnly ? "default" : "outline"}
            className="h-9 gap-1.5 text-sm"
            onClick={() => setMineOnly(v => !v)}
            title={t("leads.assignedToMeTitle")}
          >
            <Users className="h-4 w-4" />{t("leads.assignedToMe")}
          </Button>
          <ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} />
          <Can permission="crm.leads.create">
            <Button size="sm" variant="outline" className="h-9 gap-1.5 text-sm" onClick={() => setShowImport(true)}><UploadCloud className="h-4 w-4" />{t("leads.import")}</Button>
          </Can>
          <Can permission="crm.leads.create">
            <Button size="sm" className="h-9 gap-1.5 text-sm" onClick={() => { setEditingLead(null); setShowAddForm(true); }}><Plus className="h-4 w-4" />{t("leads.addLead")}</Button>
          </Can>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: t("leads.stat.totalLeads"), value: leadsSummary?.total ?? leads.length,               sub: t("leads.stat.allTime"),     icon: Users,      color: "text-primary bg-primary/10" },
          { label: t("leads.stat.new"),        value: leadsSummary?.newThisWeek ?? leads.filter(l=>l.status==="new").length, sub: t("leads.stat.needsContact"), icon: Zap, color: "text-slate-600 bg-slate-100 dark:bg-slate-800/50" },
          { label: t("leads.stat.qualified"),  value: leadsSummary?.qualified ?? leads.filter(l=>l.status==="qualified").length, sub: t("leads.stat.hotLeads"), icon: Target, color: "text-success bg-success/10" },
          { label: t("leads.stat.contacted"),  value: leadsSummary?.contacted ?? leads.filter(l=>l.status==="contacted").length, sub: t("leads.stat.inFollowUp"), icon: TrendingUp, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/20" },
          { label: t("leads.stat.converted"),  value: leadsSummary?.converted ?? leads.filter(l=>l.status==="converted").length, sub: t("leads.stat.toDeals"), icon: CheckCircle2, color: "text-violet-600 bg-violet-100 dark:bg-violet-900/20" },
          { label: t("leads.stat.pipelineValue"), value: formatCurrency(leadsSummary?.totalEstimatedValue ?? leads.reduce((s,l)=>s+l.estimatedValue,0), currency), sub: t("leads.stat.estValue"), icon: DollarSign, color: "text-warning bg-warning/10" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="card-hover">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}><s.icon className="h-4 w-4" /></div>
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
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder={t("leads.searchPlaceholder")} value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
          </div>
          {/* Status filter */}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="open">{t("leads.openStatuses", { defaultValue: "Open leads" })}</option>
            <option value="all">{t("leads.allStatuses")}</option>
            {(["new","contacted","qualified","converted","unqualified","lost"] as LeadStatus[]).map(s => (
              <option key={s} value={s}>{t(`status.${s}`)}</option>
            ))}
          </select>
          {/* Source filter */}
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="all">{t("leads.allSources")}</option>
            {uniqueSources.map(s => <option key={s} value={s}>{sourceLabel(s)}</option>)}
          </select>
          {/* Sort field + direction */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)}
            aria-label="Sort leads by"
            className="h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
            {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
              <option key={k} value={k}>Sort: {SORT_LABELS[k]}</option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 shrink-0"
            aria-label={sortDir === "desc" ? "Sort descending" : "Sort ascending"}
            title={sortBy === "date"
              ? (sortDir === "desc" ? "Newest first" : "Oldest first")
              : (sortDir === "desc" ? "Highest first" : "Lowest first")}
            onClick={() => setSortDir(d => (d === "desc" ? "asc" : "desc"))}>
            {sortDir === "desc" ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
            <span className="text-xs">
              {sortBy === "date"
                ? (sortDir === "desc" ? "Newest" : "Oldest")
                : (sortDir === "desc" ? "Highest" : "Lowest")}
            </span>
          </Button>
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-muted rounded-lg p-0.5 shrink-0">
          <button onClick={() => setViewMode("list")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              viewMode === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>
            <List className="h-3.5 w-3.5" />{t("leads.list")}
          </button>
          <button onClick={() => setViewMode("kanban")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              viewMode === "kanban" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>
            <LayoutGrid className="h-3.5 w-3.5" />{t("leads.kanban")}
          </button>
        </div>
      </div>

      {/* Kanban */}
      {viewMode === "kanban" && <LeadsKanban leads={filtered} onLeadClick={openDrawer} />}

      {viewMode === "list" && (
        <TeamFilingBar
          selectedCount={selection.picked.size}
          onFile={fileSelected}
          onClear={selection.clear}
          isPending={bulkFile.isPending}
        />
      )}

      {/* List */}
      {viewMode === "list" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y border-border bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selection.allVisiblePicked}
                        onChange={selection.toggleAllVisible}
                        aria-label="Select all visible leads"
                        className="h-3.5 w-3.5 cursor-pointer accent-primary"
                      />
                    </th>
                    {[
                      { k: "lead",     label: t("leads.table.lead") },
                      { k: "phone",    label: t("leads.table.phone") },
                      { k: "whatsapp", label: t("leads.table.whatsapp") },
                      { k: "source",   label: t("leads.table.source") },
                      { k: "estValue", label: t("leads.table.estValue") },
                      { k: "score",    label: t("leads.table.score") },
                      { k: "followup", label: t("leads.table.nextFollowUp") },
                      { k: "assigned", label: t("leads.table.assignedTo") },
                      { k: "status",   label: t("leads.table.status") },
                      { k: "actions",  label: "" },
                    ].map(h => (
                      <th key={h.k} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listLazy.total === 0 ? (
                    <tr><td colSpan={11} className="text-center py-16 text-muted-foreground text-sm">{t("leads.empty")}</td></tr>
                  ) : listLazy.visible.map((lead, i) => (
                    <motion.tr key={lead.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 12) * 0.03 }} className="erp-table-row cursor-pointer" onClick={() => openDrawer(lead)}>
                      {/* stopPropagation: the row opens the drawer, so a tick must not also open it. */}
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selection.picked.has(lead.id)}
                          onChange={() => selection.toggle(lead.id)}
                          aria-label={`Select ${lead.fullName}`}
                          className="h-3.5 w-3.5 cursor-pointer accent-primary"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">{getInitials(lead.fullName)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-sm truncate">{lead.fullName}</p>
                              {(() => { const h = leadHeat(lead.score); return (
                                <span className={cn("shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold", h.color, h.bg)}>
                                  <span>{h.emoji}</span>{h.label}
                                </span>
                              ); })()}
                              {lead.purchaseUrgency && lead.purchaseUrgency !== "unknown" && URGENCY_META[lead.purchaseUrgency] && (
                                <span className={cn("shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-semibold",
                                  URGENCY_META[lead.purchaseUrgency].color, URGENCY_META[lead.purchaseUrgency].bg)}>
                                  {t(`urgency.${lead.purchaseUrgency}`)}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate max-w-[280px]">{lead.title || buildLeadSummary(lead)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {lead.phone ? (
                          <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()}
                            className="text-sm text-foreground hover:text-primary hover:underline">{lead.phone}</a>
                        ) : <span className="text-sm text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {lead.whatsApp ? (
                          <a href={`https://wa.me/${(lead.whatsApp || "").replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-sm text-emerald-600 hover:underline">{lead.whatsApp}</a>
                        ) : <span className="text-sm text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{sourceLabel(lead.source)}</td>
                      <td className="px-4 py-3 font-semibold text-sm whitespace-nowrap">{formatCompactValue(lead.estimatedValue, currency)}</td>
                      <td className="px-4 py-3 min-w-[100px]"><ScoreBar score={lead.score} /></td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {lead.nextFollowUp ? (
                          <span className={cn(new Date(lead.nextFollowUp) < new Date() ? "text-destructive font-medium" : "")}>
                            {formatDate(lead.nextFollowUp, "medium")}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[9px] font-bold bg-primary/10 text-primary">{getInitials(lead.assignedTo)}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-muted-foreground whitespace-nowrap">{lead.assignedTo}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={lead.status} outcome={lead.convertedDealStage} /></td>
                      <td className="px-4 py-3">
                        {lead.status === "qualified" && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-success hover:text-success hover:bg-success/10"
                            onClick={e => { e.stopPropagation(); openDrawer(lead); }}>
                            <ArrowRight className="h-3.5 w-3.5" />{t("leads.convert")}
                          </Button>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            {listLazy.hasMore && (
              <div ref={listLazy.sentinelRef} className="flex justify-center py-4 border-t border-border">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={listLazy.loadMore}>{t("common:action.loadMore")}</Button>
              </div>
            )}
            <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
              {t("leads.showing", { shown: listLazy.shown, total: listLazy.total, rate: leadsSummary?.conversionRate ?? 0 })}
            </div>
          </CardContent>
        </Card>
      )}

      <LeadDrawer lead={selectedLead} open={drawerOpen} onClose={() => setDrawerOpen(false)} onEdit={openEdit} />
      <AddLeadForm open={showAddForm} onClose={closeForm} editing={editingLead} />
      <ImportLeadsModal open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}

