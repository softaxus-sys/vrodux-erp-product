import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Repeat, Plus, X, Play, Pause, Trash2, Zap, RefreshCw, Calendar, Loader2, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  useRecurringInvoices, useRecurringSummary,
  useCreateRecurringInvoice, useUpdateRecurringInvoice, useDeleteRecurringInvoice,
  usePauseRecurringInvoice, useResumeRecurringInvoice, useGenerateRecurringNow, useRunDueRecurring,
} from "@/hooks/finance/use-finance";
import type { RecurringInvoiceDto, RecurrenceFrequency, UpsertRecurringRequest } from "@/lib/finance/finance.api";

const FREQ: { value: RecurrenceFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];
const CUR = "AED";

export function RecurringInvoicesView() {
  const { data: items = [], isLoading } = useRecurringInvoices();
  const { data: summary } = useRecurringSummary();
  const runDue = useRunDueRecurring();
  const [editing, setEditing] = React.useState<RecurringInvoiceDto | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const openNew  = () => { setEditing(null); setDrawerOpen(true); };
  const openEdit = (r: RecurringInvoiceDto) => { setEditing(r); setDrawerOpen(true); };

  const STATS = [
    { label: "Templates", value: summary?.total ?? 0 },
    { label: "Active", value: summary?.active ?? 0 },
    { label: "Due ≤ 7 days", value: summary?.dueSoon ?? 0 },
    { label: "Invoices Generated", value: summary?.generatedTotal ?? 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Repeat className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Recurring Invoices</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Auto-generate invoices on a schedule — runs daily in the background</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => runDue.mutate()} disabled={runDue.isPending}>
            {runDue.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Run due now
          </Button>
          <Button className="gap-2 h-9" onClick={openNew}><Plus className="h-4 w-4" />New Template</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATS.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="font-bold text-xl mt-0.5">{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2"><Loader2 className="h-5 w-5 animate-spin" />Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground">No recurring templates yet. Create one to automate billing.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-semibold">Template / Customer</th>
                <th className="text-left px-4 py-3 font-semibold">Frequency</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Next Run</th>
                <th className="text-right px-4 py-3 font-semibold">Amount</th>
                <th className="text-center px-4 py-3 font-semibold hidden sm:table-cell">Generated</th>
                <th className="text-center px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map(r => (
                <tr key={r.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-sm">{r.templateName}</p>
                    <p className="text-xs text-muted-foreground">{r.customerName}</p>
                  </td>
                  <td className="px-4 py-3 text-sm capitalize">{r.frequency}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                    <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{formatDate(r.nextRunDate, "medium")}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold">{formatCurrency(r.total, CUR)}</td>
                  <td className="px-4 py-3 text-center text-sm hidden sm:table-cell">{r.generatedCount}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full",
                      r.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                      {r.isActive ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <RowActions r={r} onEdit={() => openEdit(r)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <RecurringDrawer open={drawerOpen} editing={editing} onClose={() => { setDrawerOpen(false); setEditing(null); }} />
    </div>
  );
}

function RowActions({ r, onEdit }: { r: RecurringInvoiceDto; onEdit: () => void }) {
  const pause = usePauseRecurringInvoice();
  const resume = useResumeRecurringInvoice();
  const gen = useGenerateRecurringNow();
  const del = useDeleteRecurringInvoice();
  const busy = pause.isPending || resume.isPending || gen.isPending || del.isPending;
  return (
    <div className="flex items-center justify-end gap-1">
      <button title="Generate invoice now" disabled={busy} onClick={() => gen.mutate(r.id)}
        className="p-1.5 rounded-lg text-primary hover:bg-primary/10 disabled:opacity-50"><Zap className="h-3.5 w-3.5" /></button>
      {r.isActive ? (
        <button title="Pause" disabled={busy} onClick={() => pause.mutate(r.id)}
          className="p-1.5 rounded-lg text-warning hover:bg-warning/10 disabled:opacity-50"><Pause className="h-3.5 w-3.5" /></button>
      ) : (
        <button title="Resume" disabled={busy} onClick={() => resume.mutate(r.id)}
          className="p-1.5 rounded-lg text-success hover:bg-success/10 disabled:opacity-50"><Play className="h-3.5 w-3.5" /></button>
      )}
      <button title="Edit" disabled={busy} onClick={onEdit}
        className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-50"><Pencil className="h-3.5 w-3.5" /></button>
      <button title="Delete" disabled={busy} onClick={() => { if (confirm(`Delete template "${r.templateName}"?`)) del.mutate(r.id); }}
        className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  );
}

type LineState = { id: string; description: string; quantity: number; unitPrice: number };

function RecurringDrawer({ open, editing, onClose }: { open: boolean; editing: RecurringInvoiceDto | null; onClose: () => void }) {
  const create = useCreateRecurringInvoice();
  const update = useUpdateRecurringInvoice();
  const isEdit = !!editing;

  const [templateName, setTemplateName] = React.useState("");
  const [customerName, setCustomerName] = React.useState("");
  const [customerEmail, setCustomerEmail] = React.useState("");
  const [frequency, setFrequency] = React.useState<RecurrenceFrequency>("monthly");
  const [startDate, setStartDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = React.useState("");
  const [dueDays, setDueDays] = React.useState(30);
  const [taxRate, setTaxRate] = React.useState(5);
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<LineState[]>([{ id: "1", description: "", quantity: 1, unitPrice: 0 }]);

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setTemplateName(editing.templateName); setCustomerName(editing.customerName);
      setCustomerEmail(editing.customerEmail ?? ""); setFrequency(editing.frequency);
      setStartDate(editing.startDate.slice(0, 10)); setEndDate(editing.endDate?.slice(0, 10) ?? "");
      setDueDays(editing.dueDays); setTaxRate(editing.taxRate); setNotes(editing.notes ?? "");
      setLines(editing.lines.length ? editing.lines.map(l => ({ id: l.id, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice }))
                                    : [{ id: "1", description: "", quantity: 1, unitPrice: 0 }]);
    } else {
      setTemplateName(""); setCustomerName(""); setCustomerEmail(""); setFrequency("monthly");
      setStartDate(new Date().toISOString().slice(0, 10)); setEndDate(""); setDueDays(30); setTaxRate(5); setNotes("");
      setLines([{ id: "1", description: "", quantity: 1, unitPrice: 0 }]);
    }
  }, [open, editing]);

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const total = subtotal + subtotal * taxRate / 100;
  const busy = create.isPending || update.isPending;

  const submit = () => {
    const active = lines.filter(l => l.description.trim() && l.quantity > 0);
    if (!templateName.trim() || !customerName.trim() || active.length === 0) return;
    const payload: UpsertRecurringRequest = {
      templateName: templateName.trim(), customerName: customerName.trim(),
      customerEmail: customerEmail.trim() || null, frequency, startDate,
      endDate: endDate || null, dueDays, taxRate, notes: notes.trim() || null,
      lines: active.map(l => ({ description: l.description.trim(), quantity: l.quantity, unitPrice: l.unitPrice })),
    };
    if (isEdit && editing) update.mutate({ id: editing.id, data: payload }, { onSuccess: onClose });
    else create.mutate(payload, { onSuccess: onClose });
  };

  return (
    <AnimatePresence>
      {open && (<>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />
        <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed right-0 top-0 h-full w-full max-w-2xl bg-card border-l border-border shadow-2xl z-50 flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <h2 className="text-base font-bold">{isEdit ? "Edit Recurring Template" : "New Recurring Template"}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"><X className="h-4 w-4" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5"><Label>Template Name *</Label>
                <Input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. Monthly retainer — ACME" /></div>
              <div className="space-y-1.5"><Label>Customer *</Label>
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name" /></div>
              <div className="space-y-1.5"><Label>Customer Email</Label>
                <Input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="billing@customer.com" /></div>
              <div className="space-y-1.5"><Label>Frequency</Label>
                <select value={frequency} onChange={e => setFrequency(e.target.value as RecurrenceFrequency)}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  {FREQ.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select></div>
              <div className="space-y-1.5"><Label>Payment Terms (days)</Label>
                <Input type="number" min={1} value={dueDays} onChange={e => setDueDays(+e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Start Date *</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>End Date (optional)</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Tax Rate (%)</Label>
                <Input type="number" min={0} max={100} step={0.01} value={taxRate} onChange={e => setTaxRate(+e.target.value)} /></div>
            </div>

            {/* Lines */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Line Items</Label>
                <Button type="button" variant="outline" size="sm" className="gap-1.5 h-7 text-xs"
                  onClick={() => setLines(p => [...p, { id: String(Date.now()), description: "", quantity: 1, unitPrice: 0 }])}>
                  <Plus className="h-3 w-3" /> Add Item
                </Button>
              </div>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40"><tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Description</th>
                    <th className="text-right px-2 py-2 text-xs font-semibold text-muted-foreground w-16">Qty</th>
                    <th className="text-right px-2 py-2 text-xs font-semibold text-muted-foreground w-28">Unit Price</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-24">Total</th>
                    <th className="w-8" />
                  </tr></thead>
                  <tbody className="divide-y divide-border/50">
                    {lines.map(l => (
                      <tr key={l.id}>
                        <td className="px-2 py-1.5"><Input value={l.description} placeholder="Item description"
                          onChange={e => setLines(p => p.map(x => x.id === l.id ? { ...x, description: e.target.value } : x))}
                          className="h-8 text-xs border-0 bg-transparent focus-visible:ring-1 px-2" /></td>
                        <td className="px-2 py-1.5"><Input type="number" min={1} value={l.quantity}
                          onChange={e => setLines(p => p.map(x => x.id === l.id ? { ...x, quantity: +e.target.value } : x))}
                          className="h-8 text-xs text-right border-0 bg-transparent focus-visible:ring-1 px-2" /></td>
                        <td className="px-2 py-1.5"><Input type="number" min={0} step={0.01} value={l.unitPrice}
                          onChange={e => setLines(p => p.map(x => x.id === l.id ? { ...x, unitPrice: +e.target.value } : x))}
                          className="h-8 text-xs text-right border-0 bg-transparent focus-visible:ring-1 px-2" /></td>
                        <td className="px-3 py-1.5 text-right text-xs font-semibold text-muted-foreground">{formatCurrency(l.quantity * l.unitPrice, CUR)}</td>
                        <td className="px-2 py-1.5">
                          <button onClick={() => setLines(p => p.filter(x => x.id !== l.id))} disabled={lines.length === 1}
                            className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end">
              <div className="w-56 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal, CUR)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tax ({taxRate}%)</span><span>{formatCurrency(subtotal * taxRate / 100, CUR)}</span></div>
                <div className="flex justify-between font-bold pt-2 border-t border-border"><span>Total / invoice</span><span>{formatCurrency(total, CUR)}</span></div>
              </div>
            </div>

            <div className="space-y-1.5"><Label>Notes</Label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Appears on every generated invoice…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" /></div>
          </div>

          <div className="px-6 py-4 border-t border-border flex justify-end gap-2 shrink-0">
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={busy || !templateName.trim() || !customerName.trim()}>
              {busy ? "Saving…" : isEdit ? "Save Changes" : "Create Template"}
            </Button>
          </div>
        </motion.div>
      </>)}
    </AnimatePresence>
  );
}
