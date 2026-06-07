import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, FileText, CheckCircle2, RotateCcw, Plus,
  Search, Calendar, ChevronDown, X, AlertCircle, Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { JournalEntryDto as JournalEntry, JournalStatus } from "@/lib/finance/finance.api";
import { useJournals, useJournalsSummary, usePostJournal, useVoidJournal } from "@/hooks/finance/use-finance";
import { AddJournalForm } from "./add-journal-form";

const STATUS_CONFIG: Record<JournalStatus, { label: string; color: string; bg: string; dot: string }> = {
  draft:    { label: "Draft",    color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50", dot: "bg-slate-400" },
  posted:   { label: "Posted",   color: "text-success",     bg: "bg-success/10",                    dot: "bg-success" },
  reversed: { label: "Reversed", color: "text-destructive", bg: "bg-destructive/10",                dot: "bg-destructive" },
};

const FILTERS: { key: JournalStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "posted", label: "Posted" },
  { key: "reversed", label: "Reversed" },
];

const PERIODS = ["All Periods", "2026-05", "2026-04", "2026-03", "2026-02", "2026-01"];

function JournalDrawer({ entry, open, onClose }: { entry: JournalEntry | null; open: boolean; onClose: () => void }) {
  const post = usePostJournal();
  const reverse = useVoidJournal();
  if (!entry) return null;
  const sc = STATUS_CONFIG[entry.status];
  const busy = post.isPending || reverse.isPending;
  return (
    <AnimatePresence>
      {open && (<>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
        <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className="fixed top-0 right-0 h-full w-full max-w-[620px] bg-background border-l border-border shadow-2xl z-50 flex flex-col">
          <div className="flex items-start justify-between px-6 py-5 border-b border-border">
            <div>
              <p className="font-bold text-base">{entry.journalNumber}</p>
              <p className="text-sm text-muted-foreground">{entry.description}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />{sc.label}
                </span>
                {entry.isBalanced
                  ? <span className="text-[11px] text-success flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Balanced</span>
                  : <span className="text-[11px] text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />Unbalanced</span>}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/30 rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Date</p>
                <p className="font-semibold text-sm">{formatDate(entry.date, "medium")}</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Period</p>
                <p className="font-semibold text-sm">{entry.period}</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Reference</p>
                <p className="font-semibold text-sm font-mono text-xs">{entry.reference || "—"}</p>
              </div>
            </div>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-xs text-muted-foreground">
                    <th className="text-left px-4 py-3 font-semibold">Account</th>
                    <th className="text-left px-4 py-3 font-semibold">Description</th>
                    <th className="text-right px-4 py-3 font-semibold text-success">Debit</th>
                    <th className="text-right px-4 py-3 font-semibold text-destructive">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.lines.map((line, i) => (
                    <motion.tr key={line.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.04 }}
                      className="border-t border-border/40 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs text-muted-foreground">{line.accountCode}</p>
                        <p className="text-sm font-medium">{line.accountName}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{line.description}</td>
                      <td className="px-4 py-3 text-right font-medium text-success">{line.debit > 0 ? formatCurrency(line.debit, "AED") : "—"}</td>
                      <td className="px-4 py-3 text-right font-medium text-destructive">{line.credit > 0 ? formatCurrency(line.credit, "AED") : "—"}</td>
                    </motion.tr>
                  ))}
                  <tr className="border-t-2 border-border bg-muted/30">
                    <td colSpan={2} className="px-4 py-3 text-sm font-bold">Totals</td>
                    <td className="px-4 py-3 text-right font-bold text-success">{formatCurrency(entry.totalDebit, "AED")}</td>
                    <td className="px-4 py-3 text-right font-bold text-destructive">{formatCurrency(entry.totalCredit, "AED")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Created by</span><span>{entry.createdBy}</span></div>
              {entry.postedBy && <div className="flex justify-between"><span className="text-muted-foreground">Posted by</span><span>{entry.postedBy}</span></div>}
              {entry.postedDate && <div className="flex justify-between"><span className="text-muted-foreground">Posted on</span><span>{formatDate(entry.postedDate, "medium")}</span></div>}
            </div>
          </div>
          <div className="border-t border-border px-6 py-4 flex items-center gap-2">
            {entry.status === "draft" && <Button size="sm" disabled={busy || !entry.isBalanced} className="gap-1.5 h-9" onClick={() => post.mutate(entry.id, { onSuccess: onClose })}><CheckCircle2 className="h-3.5 w-3.5" />Post Journal</Button>}
            {entry.status === "posted" && <Button variant="outline" size="sm" disabled={busy} className="gap-1.5 h-9 text-destructive border-destructive/30" onClick={() => reverse.mutate(entry.id, { onSuccess: onClose })}><RotateCcw className="h-3.5 w-3.5" />Reverse</Button>}
          </div>
        </motion.div>
      </>)}
    </AnimatePresence>
  );
}

export function JournalsView() {
  const { data: journals = [] } = useJournals();
  const { data: journalsSummary } = useJournalsSummary();

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<JournalStatus | "all">("all");
  const [period, setPeriod] = React.useState("All Periods");
  const [selected, setSelected] = React.useState<JournalEntry | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);

  const filtered = React.useMemo(() => {
    let list = journals;
    if (statusFilter !== "all") list = list.filter(j => j.status === statusFilter);
    if (period !== "All Periods") list = list.filter(j => j.period === period);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(j => (j.journalNumber ?? "").toLowerCase().includes(s) || (j.description ?? "").toLowerCase().includes(s) || (j.reference ?? "").toLowerCase().includes(s));
    }
    return list;
  }, [journals, search, statusFilter, period]);

  const STATS = [
    { label: "Total Journals", value: journalsSummary?.total ?? journals.length, icon: BookOpen, color: "text-slate-600", bg: "bg-slate-100 dark:bg-slate-800/50" },
    { label: "Draft", value: journalsSummary?.draft ?? journals.filter(j => j.status === "draft").length, icon: FileText, color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-800/50" },
    { label: "Posted", value: journalsSummary?.posted ?? journals.filter(j => j.status === "posted").length, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
    { label: "Posted Value", value: formatCurrency(journalsSummary?.totalPostedValue ?? 0, "AED"), icon: Percent, color: "text-primary", bg: "bg-primary/10", isText: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Journal Entries</h1><p className="text-sm text-muted-foreground mt-0.5">Create and post manual journal entries</p></div>
        <Button className="gap-2 h-9" onClick={() => setShowAddForm(true)}><Plus className="h-4 w-4" />New Journal</Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", s.bg)}><Icon className={cn("h-5 w-5", s.color)} /></div>
              <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="font-bold text-lg leading-tight">{s.value}</p></div>
            </motion.div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search journals…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key as JournalStatus | "all")}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                statusFilter === f.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {f.label}
            </button>
          ))}
        </div>
        <select value={period} onChange={e => setPeriod(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground">
          {PERIODS.map(p => <option key={p}>{p}</option>)}
        </select>
      </div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Journal #</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Date</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Period</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Debit</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Credit</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-sm text-muted-foreground">No journal entries found.</td></tr>
            ) : filtered.map((j, i) => {
              const sc = STATUS_CONFIG[j.status];
              return (
                <motion.tr key={j.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                  onClick={() => { setSelected(j); setDrawerOpen(true); }}
                  className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono text-sm font-semibold">{j.journalNumber}</span>
                    </div>
                    {!j.isBalanced && <span className="text-[10px] text-destructive pl-5">Unbalanced</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-medium">{j.description}</p>
                    {j.reference && <p className="text-xs text-muted-foreground font-mono">{j.reference}</p>}
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Calendar className="h-3.5 w-3.5" />{formatDate(j.date, "short")}</div>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell"><span className="text-sm text-muted-foreground">{j.period}</span></td>
                  <td className="px-4 py-3.5 text-right font-semibold text-sm text-success">{formatCurrency(j.totalDebit, "AED")}</td>
                  <td className="px-4 py-3.5 text-right font-semibold text-sm text-destructive hidden md:table-cell">{formatCurrency(j.totalCredit, "AED")}</td>
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
      <JournalDrawer entry={selected} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AddJournalForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}

