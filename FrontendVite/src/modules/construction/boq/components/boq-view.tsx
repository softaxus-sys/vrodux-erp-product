import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, CheckCircle2, TrendingUp, DollarSign,
  Search, Plus, X, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { type BOQDto as BOQ, type BOQStatus } from "@/lib/construction/construction.api";
import { useBOQs, useBOQSummary } from "@/hooks/construction/use-construction";
import { AddBOQForm } from "./add-boq-form";

const STATUS_CONFIG: Record<BOQStatus, { label: string; color: string; bg: string; dot: string }> = {
  draft:       { label: "Draft",       color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50", dot: "bg-slate-400" },
  approved:    { label: "Approved",    color: "text-primary",     bg: "bg-primary/10",                    dot: "bg-primary" },
  in_progress: { label: "In Progress", color: "text-warning",     bg: "bg-warning/10",                    dot: "bg-warning" },
  completed:   { label: "Completed",   color: "text-success",     bg: "bg-success/10",                    dot: "bg-success" },
};

function BOQDrawer({ boq, open, onClose }: { boq: BOQ | null; open: boolean; onClose: () => void }) {
  const currency = useCurrency();
  const [expanded, setExpanded] = React.useState<string | null>(null);
  if (!boq) return null;
  const sc = STATUS_CONFIG[boq.status];

  return (
    <AnimatePresence>
      {open && (<>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
        <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className="fixed top-0 right-0 h-full w-full max-w-[680px] bg-background border-l border-border shadow-2xl z-50 flex flex-col">
          <div className="flex items-start justify-between px-6 py-5 border-b border-border">
            <div>
              <p className="font-mono text-xs text-muted-foreground">{boq.boqNumber}</p>
              <p className="font-bold text-base">{boq.projectName}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />{sc.label}
                </span>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Contract</p>
                <p className="font-bold text-xs text-primary">{formatCurrency(boq.totalAmount, currency)}</p>
              </div>
              <div className="bg-success/5 border border-success/20 rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Completed</p>
                <p className="font-bold text-xs text-success">{formatCurrency(boq.completedAmount, currency)}</p>
              </div>
              <div className="bg-warning/5 border border-warning/20 rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Variations</p>
                <p className="font-bold text-xs text-warning">{formatCurrency(boq.variationAmount, currency)}</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Final</p>
                <p className="font-bold text-xs">{formatCurrency(boq.finalAmount, currency)}</p>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">BOQ Completion</span>
                <span className="font-semibold">{boq.completionPct}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${boq.completionPct}%` }} transition={{ duration: 0.8 }}
                  className={cn("h-full rounded-full", boq.completionPct >= 80 ? "bg-success" : boq.completionPct >= 50 ? "bg-primary" : "bg-warning")} />
              </div>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
              {boq.approvedBy && <div className="flex justify-between"><span className="text-muted-foreground">Approved By</span><span>{boq.approvedBy}</span></div>}
              {boq.approvedDate && <div className="flex justify-between"><span className="text-muted-foreground">Approved Date</span><span>{formatDate(boq.approvedDate, "medium")}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Total Items</span><span>{boq.items.length}</span></div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Bill of Quantities ({boq.items.length} items)</h4>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-muted/40 text-xs text-muted-foreground">
                    <th className="text-left px-3 py-2.5 font-semibold">Code</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Description</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Qty</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Amount</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-success">Done</th>
                  </tr></thead>
                  <tbody>
                    {boq.items.map((item, i) => {
                      const donePct = item.quantity > 0 ? Math.round((item.completedQty / item.quantity) * 100) : 0;
                      return (
                        <motion.tr key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                          className="border-t border-border/40 hover:bg-muted/20">
                          <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{item.itemCode}</td>
                          <td className="px-3 py-2.5">
                            <p className="text-sm leading-tight">{item.description}</p>
                            <p className="text-[10px] text-muted-foreground">{item.unit}</p>
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs">{item.quantity.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right text-xs font-semibold">{formatCurrency(item.amount, currency)}</td>
                          <td className="px-3 py-2.5 text-right">
                            <p className={cn("text-xs font-semibold", donePct === 100 ? "text-success" : donePct > 0 ? "text-primary" : "text-muted-foreground")}>{donePct}%</p>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </motion.div>
      </>)}
    </AnimatePresence>
  );
}

const STATUS_FILTERS = ["all", "draft", "approved", "in_progress", "completed"] as const;

export function BOQView() {
  const currency = useCurrency();
  const { data: boqs = [], isLoading } = useBOQs();
  const { data: boqSummary }           = useBOQSummary();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<BOQStatus | "all">("all");
  const [selected, setSelected] = React.useState<BOQ | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);

  const filtered = React.useMemo(() => {
    let list = boqs;
    if (statusFilter !== "all") list = list.filter(b => b.status === statusFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(b => b.boqNumber.toLowerCase().includes(s) || b.projectName.toLowerCase().includes(s));
    }
    return list;
  }, [boqs, search, statusFilter]);

  const STATS = [
    { label: "Total BOQs",  value: boqSummary?.total ?? boqs.length,                                     icon: FileText,   color: "text-slate-600", bg: "bg-slate-100 dark:bg-slate-800/50" },
    { label: "In Progress", value: boqSummary?.inProgress ?? boqs.filter(b=>b.status==="in_progress").length, icon: TrendingUp, color: "text-warning",   bg: "bg-warning/10" },
    { label: "Completed",   value: boqSummary?.completed ?? boqs.filter(b=>b.status==="completed").length, icon: CheckCircle2,color: "text-success",  bg: "bg-success/10" },
    { label: "Total Value", value: formatCurrency(boqSummary?.totalValue ?? boqs.reduce((s,b)=>s+b.totalAmount,0), currency), icon: DollarSign, color: "text-primary", bg: "bg-primary/10", isText: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Bill of Quantities</h1><p className="text-sm text-muted-foreground mt-0.5">Track BOQ items, quantities, and completion progress</p></div>
        <Button className="gap-2 h-9" onClick={() => setShowAddForm(true)}><Plus className="h-4 w-4" />New BOQ</Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", s.bg)}><Icon className={cn("h-5 w-5", s.color)} /></div>
              <div className="min-w-0"><p className="text-xs text-muted-foreground truncate">{s.label}</p><p className="font-bold text-sm leading-tight">{s.value}</p></div>
            </motion.div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search BOQs…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1.5">
          {STATUS_FILTERS.map(f => (
            <button key={f} onClick={() => setStatusFilter(f as BOQStatus | "all")}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
                statusFilter === f ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {f === "all" ? "All" : f === "in_progress" ? "In Progress" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">BOQ #</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Project</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Contract Value</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Variations</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Completion</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-sm text-muted-foreground">No BOQs found.</td></tr>
            ) : filtered.map((b, i) => {
              const sc = STATUS_CONFIG[b.status];
              return (
                <motion.tr key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                  onClick={() => { setSelected(b); setDrawerOpen(true); }}
                  className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer">
                  <td className="px-4 py-3.5 font-mono text-sm font-semibold">{b.boqNumber}</td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-medium">{b.projectName}</p>
                    <p className="text-xs text-muted-foreground">{b.items.length} items</p>
                  </td>
                  <td className="px-4 py-3.5 text-right font-semibold text-sm hidden md:table-cell">{formatCurrency(b.totalAmount, currency)}</td>
                  <td className="px-4 py-3.5 text-right text-sm hidden lg:table-cell">
                    {b.variationAmount > 0 ? (
                      <span className="text-warning font-medium">+{formatCurrency(b.variationAmount, currency)}</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden min-w-[60px]">
                        <div className={cn("h-full rounded-full", b.completionPct >= 80 ? "bg-success" : b.completionPct >= 50 ? "bg-primary" : "bg-warning")}
                          style={{ width: `${b.completionPct}%` }} />
                      </div>
                      <span className="text-xs font-semibold">{b.completionPct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />{sc.label}
                    </span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </motion.div>
      <BOQDrawer boq={selected} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AddBOQForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}

