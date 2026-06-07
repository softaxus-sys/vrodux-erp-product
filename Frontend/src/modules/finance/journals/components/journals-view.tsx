"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, FileText, CheckCircle2, X, Plus,
  Search, Calendar, AlertCircle, ChevronLeft, ChevronRight,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  useJournalEntries, useCreateJournalEntry,
  usePostJournalEntry, useVoidJournalEntry,
} from "@/hooks/finance/use-journal-entries";
import { useAccounts } from "@/hooks/finance/use-accounts";
import type { JournalEntrySummaryDto, JournalEntryDto } from "@/lib/finance/journal-entries.api";
import { journalEntriesApi } from "@/lib/finance/journal-entries.api";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  draft:  { label: "Draft",  color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50", dot: "bg-slate-400" },
  posted: { label: "Posted", color: "text-success",     bg: "bg-success/10",                    dot: "bg-success" },
  voided: { label: "Voided", color: "text-destructive", bg: "bg-destructive/10",                dot: "bg-destructive" },
};

function JournalDetailDrawer({ entryId, onClose }: { entryId: string; onClose: () => void }) {
  const [entry, setEntry] = React.useState<JournalEntryDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const postEntry = usePostJournalEntry();
  const voidEntry = useVoidJournalEntry();

  React.useEffect(() => {
    setLoading(true);
    journalEntriesApi.getById(entryId)
      .then(setEntry)
      .finally(() => setLoading(false));
  }, [entryId]);

  const sc = entry ? (STATUS_CONFIG[entry.status] ?? { label: entry.status, color: "text-foreground", bg: "bg-muted", dot: "bg-muted-foreground" }) : null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed top-0 right-0 h-full w-full max-w-[620px] bg-background border-l border-border shadow-2xl z-50 flex flex-col">
        <div className="flex items-start justify-between px-6 py-5 border-b border-border">
          {loading || !entry || !sc ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <div>
              <p className="font-bold text-base">{entry.entryNumber}</p>
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
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        {!loading && entry && (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Date",      value: formatDate(entry.date, "medium") },
                  { label: "Period",    value: entry.date.slice(0, 7) },
                  { label: "Reference", value: entry.reference ?? "—" },
                ].map(item => (
                  <div key={item.label} className="bg-muted/30 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-muted-foreground">{item.label}</p>
                    <p className="font-semibold text-sm font-mono">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Lines table */}
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
                          <p className="text-sm font-medium">{line.accountName}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{line.description ?? "—"}</td>
                        <td className="px-4 py-3 text-right font-medium text-success">
                          {line.debitAmount > 0 ? formatCurrency(line.debitAmount, "AED") : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-destructive">
                          {line.creditAmount > 0 ? formatCurrency(line.creditAmount, "AED") : "—"}
                        </td>
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

              {entry.notes && (
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{entry.notes}</p>
                </div>
              )}
            </div>

            <div className="border-t border-border px-6 py-4 flex items-center gap-2">
              {entry.status === "draft" && (
                <Button size="sm" className="gap-1.5 h-9" disabled={postEntry.isPending}
                  onClick={() => { postEntry.mutate(entry.id); onClose(); }}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Post Journal
                </Button>
              )}
              {entry.status === "posted" && (
                <Button variant="outline" size="sm" className="gap-1.5 h-9 text-destructive border-destructive/30"
                  disabled={voidEntry.isPending}
                  onClick={() => { voidEntry.mutate(entry.id); onClose(); }}>
                  <X className="h-3.5 w-3.5" /> Void
                </Button>
              )}
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

interface LineFormItem { id: string; accountId: string; accountName: string; debitAmount: number; creditAmount: number; description: string }

function AddJournalModal({ onClose }: { onClose: () => void }) {
  const createEntry = useCreateJournalEntry();
  const { data: accounts = [] } = useAccounts({ isActive: true });
  const today = new Date().toISOString().split("T")[0];

  const [date, setDate]         = React.useState(today);
  const [description, setDesc]  = React.useState("");
  const [reference, setRef]     = React.useState("");
  const [notes, setNotes]       = React.useState("");
  const [lines, setLines]       = React.useState<LineFormItem[]>([
    { id: "1", accountId: "", accountName: "", debitAmount: 0, creditAmount: 0, description: "" },
    { id: "2", accountId: "", accountName: "", debitAmount: 0, creditAmount: 0, description: "" },
  ]);

  const addLine = () => setLines(p => [...p, { id: String(Date.now()), accountId: "", accountName: "", debitAmount: 0, creditAmount: 0, description: "" }]);
  const removeLine = (id: string) => setLines(p => p.filter(l => l.id !== id));
  const updateLine = (id: string, field: keyof LineFormItem, value: string | number) =>
    setLines(p => p.map(l => {
      if (l.id !== id) return l;
      if (field === "accountId") {
        const acc = accounts.find(a => a.id === value);
        return { ...l, accountId: String(value), accountName: acc?.name ?? "" };
      }
      return { ...l, [field]: value };
    }));

  const totalDebit  = lines.reduce((s, l) => s + l.debitAmount, 0);
  const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0);
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01;
  const isValid     = description.trim() && date && isBalanced && lines.every(l => l.accountId);

  const handleSubmit = async () => {
    if (!isValid) return;
    await createEntry.mutateAsync({
      date, description,
      reference: reference || null,
      notes: notes || null,
      lines: lines.map(l => ({
        accountId: l.accountId,
        accountName: l.accountName,
        debitAmount: l.debitAmount,
        creditAmount: l.creditAmount,
        description: l.description || null,
      })),
    });
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed top-0 right-0 h-full w-full max-w-[640px] bg-background border-l border-border shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <p className="font-bold text-base">New Journal Entry</p>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date *</label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reference</label>
              <Input value={reference} onChange={e => setRef(e.target.value)} placeholder="INV-001" className="h-9" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description *</label>
              <Input value={description} onChange={e => setDesc(e.target.value)} placeholder="Journal description" className="h-9" />
            </div>
          </div>

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Journal Lines</label>
              <Button type="button" variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={addLine}>
                <Plus className="h-3 w-3" /> Add Line
              </Button>
            </div>
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Account</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-success w-28">Debit</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-destructive w-28">Credit</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {lines.map(line => (
                    <tr key={line.id}>
                      <td className="px-2 py-2">
                        <select value={line.accountId} onChange={e => updateLine(line.id, "accountId", e.target.value)}
                          className="w-full h-8 px-2 rounded border border-border bg-background text-xs">
                          <option value="">— Select account —</option>
                          {accounts.map(a => <option key={a.id} value={a.id}>{a.accountNumber} · {a.name}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <Input type="number" min={0} step={0.01} value={line.debitAmount || ""}
                          onChange={e => updateLine(line.id, "debitAmount", parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs text-right" />
                      </td>
                      <td className="px-2 py-2">
                        <Input type="number" min={0} step={0.01} value={line.creditAmount || ""}
                          onChange={e => updateLine(line.id, "creditAmount", parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs text-right" />
                      </td>
                      <td className="px-2 py-2">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeLine(line.id)} disabled={lines.length <= 2}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/30 border-t-2 border-border">
                    <td className="px-3 py-2.5 text-xs font-bold">Totals</td>
                    <td className={cn("px-3 py-2.5 text-right text-xs font-bold", isBalanced ? "text-success" : "text-destructive")}>
                      {formatCurrency(totalDebit, "AED")}
                    </td>
                    <td className={cn("px-3 py-2.5 text-right text-xs font-bold", isBalanced ? "text-destructive" : "text-destructive")}>
                      {formatCurrency(totalCredit, "AED")}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
            {!isBalanced && totalDebit > 0 && (
              <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Unbalanced: difference of {formatCurrency(Math.abs(totalDebit - totalCredit), "AED")}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Additional notes…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
        </div>
        <div className="border-t border-border px-6 py-4 flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!isValid || createEntry.isPending}>
            {createEntry.isPending ? "Creating…" : "Create Entry"}
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export function JournalsView() {
  const [search, setSearch]         = React.useState("");
  const [statusFilter, setStatus]   = React.useState<string>("all");
  const [page, setPage]             = React.useState(1);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [showAdd, setShowAdd]       = React.useState(false);

  const { data, isLoading } = useJournalEntries({
    page, pageSize: 20,
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const journals   = data?.items      ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.totalCount ?? 0;

  const draftCount  = journals.filter(j => j.status === "draft").length;
  const postedCount = journals.filter(j => j.status === "posted").length;
  const totalPostedValue = journals.filter(j => j.status === "posted").reduce((s, j) => s + j.totalDebit, 0);

  const STATS = [
    { label: "Total (page)", value: journals.length,                       icon: BookOpen,    color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50" },
    { label: "Draft",        value: draftCount,                            icon: FileText,    color: "text-slate-500",   bg: "bg-slate-100 dark:bg-slate-800/50" },
    { label: "Posted",       value: postedCount,                           icon: CheckCircle2, color: "text-success",    bg: "bg-success/10" },
    { label: "Posted Value", value: formatCurrency(totalPostedValue, "AED"), icon: BookOpen,  color: "text-primary",     bg: "bg-primary/10", isText: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Journal Entries</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create and post manual journal entries</p>
        </div>
        <Button className="gap-2 h-9" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" /> New Journal
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", s.bg)}>
                <Icon className={cn("h-5 w-5", s.color)} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="font-bold text-lg leading-tight">{s.value}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search journals…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["all", ...Object.keys(STATUS_CONFIG)] as const).map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
                statusFilter === s ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {s === "all" ? "All" : STATUS_CONFIG[s]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Journal #</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Date</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Debit</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Credit</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-12 text-sm text-muted-foreground">Loading…</td></tr>
            ) : journals.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-sm text-muted-foreground">No journal entries found.</td></tr>
            ) : journals.map((j: JournalEntrySummaryDto, i) => {
              const sc = STATUS_CONFIG[j.status] ?? { label: j.status, color: "text-foreground", bg: "bg-muted", dot: "bg-muted-foreground" };
              return (
                <motion.tr key={j.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                  onClick={() => setSelectedId(j.id)}
                  className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono text-sm font-semibold">{j.entryNumber}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-medium">{j.description}</p>
                    {j.reference && <p className="text-xs text-muted-foreground font-mono">{j.reference}</p>}
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />{formatDate(j.date, "short")}
                    </div>
                  </td>
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10">
            <p className="text-xs text-muted-foreground">Page {page} of {totalPages} · {totalCount} total</p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </motion.div>

      {selectedId && <JournalDetailDrawer entryId={selectedId} onClose={() => setSelectedId(null)} />}
      {showAdd && <AddJournalModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
