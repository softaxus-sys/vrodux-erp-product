import * as React from "react";
import { motion } from "framer-motion";
import {
  Search, Plus, Users, TrendingUp,
  Target, CheckCircle2, DollarSign, Zap, LayoutGrid, List,
  Building2, Calendar, Globe, ArrowRight
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LeadDrawer } from "./lead-drawer";
import { AddLeadForm } from "./add-lead-form";
import { cn, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { SOURCE_LABELS, type LeadDto as Lead, type LeadStatus, type LeadSource } from "@/lib/crm/crm.api";
import { useLeads, useLeadsSummary } from "@/hooks/crm/use-crm";
import { toCsv, downloadFile } from "@/lib/csv";
import { exportPdf } from "@/lib/pdf";
import { ExportMenu } from "@/components/ui/export-menu";

type ViewMode = "list" | "kanban";

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string; dot: string }> = {
  new:         { label: "New",         color: "text-slate-600",      bg: "bg-slate-100 dark:bg-slate-800/50",  dot: "bg-slate-400" },
  contacted:   { label: "Contacted",   color: "text-blue-600",       bg: "bg-blue-50 dark:bg-blue-900/20",     dot: "bg-blue-500" },
  qualified:   { label: "Qualified",   color: "text-success",        bg: "bg-success/10",                      dot: "bg-success" },
  unqualified: { label: "Unqualified", color: "text-muted-foreground", bg: "bg-muted",                         dot: "bg-muted-foreground" },
  converted:   { label: "Converted",  color: "text-primary",        bg: "bg-primary/10",                      dot: "bg-primary" },
  lost:        { label: "Lost",        color: "text-destructive",    bg: "bg-destructive/10",                  dot: "bg-destructive" },
};

const KANBAN_COLS: LeadStatus[] = ["new", "contacted", "qualified", "converted"];

const PRIORITY_CONFIG = {
  high:   { color: "text-destructive", bg: "bg-destructive/10",  label: "High" },
  medium: { color: "text-warning",     bg: "bg-warning/10",      label: "Medium" },
  low:    { color: "text-muted-foreground", bg: "bg-muted",      label: "Low" },
};

function StatusBadge({ status }: { status: LeadStatus }) {
  const c = STATUS_CONFIG[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold", c.color, c.bg)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />{c.label}
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

/* ── Kanban card ── */
function LeadKanbanCard({ lead, index, onClick }: { lead: Lead; index: number; onClick: () => void }) {
  const pc = PRIORITY_CONFIG[lead.priority];
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
      onClick={onClick}
      className="bg-background border border-border rounded-xl p-4 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors line-clamp-2">{lead.fullName}</p>
        <span className={cn("shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase", pc.color, pc.bg)}>{pc.label}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
        <Building2 className="h-3 w-3 shrink-0" />
        <span className="truncate">{lead.company}</span>
      </div>
      <p className="font-bold text-sm mb-2">{formatCurrency(lead.estimatedValue, lead.currency)}</p>
      <ScoreBar score={lead.score} />
      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/50">
        <span className="text-[10px] text-muted-foreground">{SOURCE_LABELS[lead.source]}</span>
        <Avatar className="h-5 w-5">
          <AvatarFallback className="text-[8px] font-bold bg-primary/10 text-primary">{getInitials(lead.assignedTo)}</AvatarFallback>
        </Avatar>
      </div>
    </motion.div>
  );
}

/* ── Kanban board ── */
function LeadsKanban({ leads, onLeadClick }: { leads: Lead[]; onLeadClick: (l: Lead) => void }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
      {KANBAN_COLS.map(status => {
        const col = leads.filter(l => l.status === status);
        const sc = STATUS_CONFIG[status];
        const colValue = col.reduce((s, l) => s + l.estimatedValue, 0);
        return (
          <div key={status} className="flex flex-col flex-shrink-0 w-72">
            {/* Column header */}
            <div className={cn("flex items-center justify-between px-3 py-2.5 rounded-xl mb-3 border border-transparent", sc.bg)}>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-bold uppercase tracking-wide", sc.color)}>{sc.label}</span>
                <span className={cn("inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold", sc.color, sc.bg)}>
                  {col.length}
                </span>
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground">
                {colValue > 0 ? formatCurrency(colValue, "AED") : "—"}
              </span>
            </div>
            {/* Cards */}
            <div className="flex flex-col gap-3 flex-1">
              {col.map((lead, i) => (
                <LeadKanbanCard key={lead.id} lead={lead} index={i} onClick={() => onLeadClick(lead)} />
              ))}
              {col.length === 0 && (
                <div className="flex-1 flex items-center justify-center rounded-xl border-2 border-dashed border-border text-xs text-muted-foreground/50 h-24">
                  No leads
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" className="mt-2 h-8 text-xs text-muted-foreground justify-start gap-1.5 hover:text-foreground">
              <Plus className="h-3.5 w-3.5" />Add lead
            </Button>
          </div>
        );
      })}
    </div>
  );
}

export function LeadsView() {
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
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sourceFilter, setSourceFilter] = React.useState("all");
  const [viewMode, setViewMode] = React.useState<ViewMode>("list");
  const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [editingLead, setEditingLead] = React.useState<Lead | null>(null);

  const openEdit = (l: Lead) => { setDrawerOpen(false); setEditingLead(l); setShowAddForm(true); };
  const closeForm = () => { setShowAddForm(false); setEditingLead(null); };

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return leads.filter(l => {
      const matchSearch = !search || (l.fullName ?? "").toLowerCase().includes(q) || (l.company ?? "").toLowerCase().includes(q) || (l.email ?? "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || l.status === statusFilter;
      const matchSource = sourceFilter === "all" || l.source === sourceFilter;
      return matchSearch && matchStatus && matchSource;
    });
  }, [leads, search, statusFilter, sourceFilter]);

  const openDrawer = (l: Lead) => { setSelectedLead(l); setDrawerOpen(true); };

  const uniqueSources = [...new Set(leads.map(l => l.source))] as LeadSource[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Capture, qualify, and convert inbound leads</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} />
          <Button size="sm" className="h-9 gap-1.5 text-sm" onClick={() => { setEditingLead(null); setShowAddForm(true); }}><Plus className="h-4 w-4" />Add Lead</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: "Total Leads",       value: leadsSummary?.total ?? leads.length,               sub: "All time",         icon: Users,      color: "text-primary bg-primary/10" },
          { label: "New",               value: leadsSummary?.newThisWeek ?? leads.filter(l=>l.status==="new").length, sub: "Needs contact", icon: Zap, color: "text-slate-600 bg-slate-100 dark:bg-slate-800/50" },
          { label: "Qualified",         value: leadsSummary?.qualified ?? leads.filter(l=>l.status==="qualified").length, sub: "Hot leads", icon: Target, color: "text-success bg-success/10" },
          { label: "Contacted",         value: leadsSummary?.contacted ?? leads.filter(l=>l.status==="contacted").length, sub: "In follow-up", icon: TrendingUp, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/20" },
          { label: "Converted",         value: leadsSummary?.converted ?? leads.filter(l=>l.status==="converted").length, sub: "To deals", icon: CheckCircle2, color: "text-violet-600 bg-violet-100 dark:bg-violet-900/20" },
          { label: "Pipeline Value",    value: formatCurrency(leadsSummary?.totalEstimatedValue ?? leads.reduce((s,l)=>s+l.estimatedValue,0), "AED"), sub: "Est. value", icon: DollarSign, color: "text-warning bg-warning/10" },
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
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
          </div>
          {/* Status pills */}
          <div className="flex items-center gap-1 flex-wrap">
            {["all","new","contacted","qualified","converted","unqualified","lost"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn("px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors",
                  statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
                {s === "all" ? "All" : STATUS_CONFIG[s as LeadStatus]?.label ?? s}
              </button>
            ))}
          </div>
          {/* Source filter */}
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="all">All Sources</option>
            {uniqueSources.map(s => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
          </select>
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-muted rounded-lg p-0.5 shrink-0">
          <button onClick={() => setViewMode("list")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              viewMode === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>
            <List className="h-3.5 w-3.5" />List
          </button>
          <button onClick={() => setViewMode("kanban")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              viewMode === "kanban" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>
            <LayoutGrid className="h-3.5 w-3.5" />Kanban
          </button>
        </div>
      </div>

      {/* Kanban */}
      {viewMode === "kanban" && <LeadsKanban leads={filtered} onLeadClick={openDrawer} />}

      {/* List */}
      {viewMode === "list" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y border-border bg-muted/30">
                  <tr>
                    {["Lead","Company","Source","Est. Value","Score","Next Follow-up","Assigned To","Status",""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-16 text-muted-foreground text-sm">No leads found.</td></tr>
                  ) : filtered.map((lead, i) => (
                    <motion.tr key={lead.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }} className="erp-table-row cursor-pointer" onClick={() => openDrawer(lead)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">{getInitials(lead.fullName)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{lead.fullName}</p>
                            <p className="text-[11px] text-muted-foreground">{lead.title}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm">{lead.company}</p>
                        <p className="text-[11px] text-muted-foreground">{lead.industry}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{SOURCE_LABELS[lead.source]}</td>
                      <td className="px-4 py-3 font-semibold text-sm whitespace-nowrap">{formatCurrency(lead.estimatedValue, lead.currency)}</td>
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
                      <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                      <td className="px-4 py-3">
                        {lead.status === "qualified" && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-success hover:text-success hover:bg-success/10"
                            onClick={e => { e.stopPropagation(); openDrawer(lead); }}>
                            <ArrowRight className="h-3.5 w-3.5" />Convert
                          </Button>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
              Showing {filtered.length} of {leads.length} leads · Conversion rate: {leadsSummary?.conversionRate ?? 0}%
            </div>
          </CardContent>
        </Card>
      )}

      <LeadDrawer lead={selectedLead} open={drawerOpen} onClose={() => setDrawerOpen(false)} onEdit={openEdit} />
      <AddLeadForm open={showAddForm} onClose={closeForm} editing={editingLead} />
    </div>
  );
}

