import * as React from "react";
import { HandHeart, Plus, Pencil, Trash2, X, Loader2, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Can } from "@/components/auth/can";
import { ExportMenu } from "@/components/ui/export-menu";
import { toCsv, downloadFile } from "@/lib/csv";
import { exportPdf } from "@/lib/pdf";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useAccounts } from "@/hooks/finance/use-finance";
import {
  useSetAsideDashboard, useSetAsideRules, useSaveSetAsideRule, useDeleteSetAsideRule, usePaySetAsides, useUndoSetAsidePayout,
} from "@/hooks/finance/use-set-asides";
import type { SetAsideRuleDto, SetAsideKind } from "@/lib/finance/finance.api";

type RangeKey = "this_month" | "last_month" | "this_year" | "all";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Dates are computed from today every time — never hardcoded. */
function rangeDates(k: RangeKey): { from?: string; to?: string } {
  const n = new Date();
  if (k === "this_month") return { from: iso(new Date(n.getFullYear(), n.getMonth(), 1)), to: iso(new Date(n.getFullYear(), n.getMonth() + 1, 0)) };
  if (k === "last_month") return { from: iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)), to: iso(new Date(n.getFullYear(), n.getMonth(), 0)) };
  if (k === "this_year")  return { from: `${n.getFullYear()}-01-01`, to: `${n.getFullYear()}-12-31` };
  return {};
}

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "this_month", label: "This month" }, { key: "last_month", label: "Last month" },
  { key: "this_year", label: "This year" },   { key: "all", label: "All time" },
];

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warn" | "ok" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", tone === "warn" && "text-amber-600", tone === "ok" && "text-emerald-600")}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SetAsidesView() {
  const cur = useCurrency();
  const [range, setRange] = React.useState<RangeKey>("this_month");
  const { from, to } = React.useMemo(() => rangeDates(range), [range]);
  const { data, isLoading, isError, error } = useSetAsideDashboard(from, to);
  const { data: rules } = useSetAsideRules();

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [paying, setPaying] = React.useState(false);
  const [ruleEdit, setRuleEdit] = React.useState<SetAsideRuleDto | "new" | null>(null);
  const del = useDeleteSetAsideRule();

  const owedEntries = data?.owedEntries ?? [];
  const selectedTotal = owedEntries.filter(e => selected.has(e.id)).reduce((s, e) => s + e.ledgerAmount, 0);
  const allSelected = owedEntries.length > 0 && owedEntries.every(e => selected.has(e.id));
  const toggle = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Drop selections that no longer exist (paid, or invoice reversed).
  React.useEffect(() => {
    setSelected(p => { const ids = new Set(owedEntries.map(e => e.id)); const n = new Set([...p].filter(x => ids.has(x))); return n.size === p.size ? p : n; });
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxMonth = Math.max(1, ...(data?.byMonth ?? []).map(m => Math.max(m.accrued, m.paid)));

  const undo = useUndoSetAsidePayout();
  const [undoId, setUndoId] = React.useState<string | null>(null);

  /** One statement: what is still owed, then what was paid out — same rows in CSV and PDF. */
  const statementRows = () => [
    ...owedEntries.map(e => ({ Status: "Owed", Date: e.accruedOn, Item: e.name, Reference: e.invoiceNumber, Amount: e.ledgerAmount })),
    ...(data?.recentPayouts ?? []).map(p => ({
      Status: "Paid", Date: p.paidOn, Item: `${p.entryCount} payment(s) from ${p.fromAccountNumber}`, Reference: p.reference ?? "", Amount: p.total,
    })),
  ];
  const stamp = new Date().toISOString().slice(0, 10);
  const exportCsv = () =>
    downloadFile(`set_asides_${stamp}.csv`, toCsv(statementRows(), ["Status", "Date", "Item", "Reference", "Amount"]));
  const exportPdfReport = () => exportPdf({
    title: "Set-aside statement",
    subtitle: `Still owed ${formatCurrency(data?.owed ?? 0, cur)} · ${range === "all" ? "all time" : `${from} to ${to}`} · printed ${stamp}`,
    columns: ["Status", "Date", "Item", "Reference", `Amount (${cur})`],
    rows: statementRows().map(r => [r.Status, r.Date, r.Item, r.Reference, r.Amount.toFixed(2)]),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><HandHeart className="h-5 w-5 text-rose-500" /> Set-asides</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            A share of your income that you commit to put aside — for example 5% to Charity. The system works the amount out when each invoice is paid
            and keeps a running total of what you still owe, so you never calculate it yourself.
          </p>
        </div>
        <div className="flex items-center gap-2">
        <ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} disabled={!data || (owedEntries.length === 0 && (data.recentPayouts.length === 0))} />
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className={cn("rounded-md px-3 py-1 text-xs font-medium", range === r.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/40")}>
              {r.label}
            </button>
          ))}
        </div>
        </div>
      </div>

      {isError && <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{(error as Error)?.message ?? "Could not load."}</div>}
      {isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Still to pay out" value={formatCurrency(data.owed, cur)} tone={data.owed > 0 ? "warn" : "ok"} hint="All time, not yet paid" />
            <Tile label="Set aside in period" value={formatCurrency(data.accrued, cur)} hint="From invoices paid in the period" />
            <Tile label="Paid out in period" value={formatCurrency(data.paid, cur)} tone="ok" />
            <Tile label="Share of income" value={`${data.effectivePercent.toFixed(2)}%`}
              hint={data.income > 0 ? `of ${formatCurrency(data.income, cur)} income (before VAT)` : "No paid invoices in the period"} />
          </div>

          {data.owed > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
              <Bell className="h-4 w-4 shrink-0" />
              <span>{formatCurrency(data.owed, cur)} is waiting to be paid out. You'll also get a reminder at the start of every month.</span>
            </div>
          )}

          {/* Rules */}
          <section className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Your rules</h2>
              <Can permission="finance.accounting.edit">
                <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => setRuleEdit("new")}><Plus className="h-3.5 w-3.5" /> New rule</Button>
              </Can>
            </div>
            {(rules ?? []).length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                No rules yet. Create one, such as "Charity — 5%", and it is filled in on every new invoice automatically. You can still change it on any invoice.
                Until you do, nothing is set aside.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {(rules ?? []).map(r => (
                  <li key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div>
                      <span className="font-medium">{r.name}</span>{" "}
                      <span className="text-muted-foreground">
                        {r.kind === "percent" ? `${r.value}% of the amount before VAT` : `${formatCurrency(r.value, cur)} per invoice`}
                        {!r.autoApply && " · not added automatically"}{!r.isActive && " · paused"}
                      </span>
                    </div>
                    <Can permission="finance.accounting.edit">
                      <div className="flex gap-1">
                        <button onClick={() => setRuleEdit(r)} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted/40" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => del.mutate(r.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted/40" aria-label="Remove"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </Can>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* By rule */}
          {data.byRule.length > 0 && (
            <section className="rounded-xl border border-border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground"><tr className="border-b border-border">
                  <th className="px-4 py-2 text-left font-medium">Set-aside</th>
                  <th className="px-4 py-2 text-right font-medium">Set aside (period)</th>
                  <th className="px-4 py-2 text-right font-medium">Paid (period)</th>
                  <th className="px-4 py-2 text-right font-medium">Still owed</th>
                </tr></thead>
                <tbody>{data.byRule.map(r => (
                  <tr key={r.name} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-medium">{r.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(r.accrued, cur)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(r.paid, cur)}</td>
                    <td className={cn("px-4 py-2 text-right tabular-nums font-semibold", r.owed > 0 && "text-amber-600")}>{formatCurrency(r.owed, cur)}</td>
                  </tr>))}
                </tbody>
              </table>
            </section>
          )}

          {/* Month by month */}
          {data.byMonth.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold">Month by month</h2>
              <div className="space-y-2">
                {data.byMonth.map(m => (
                  <div key={m.month} className="grid grid-cols-[5rem_1fr_auto] items-center gap-3 text-xs">
                    <span className="text-muted-foreground">{m.month}</span>
                    <div className="space-y-1">
                      <div className="h-2 rounded bg-amber-400" style={{ width: `${(m.accrued / maxMonth) * 100}%` }} title="Set aside" />
                      <div className="h-2 rounded bg-emerald-500" style={{ width: `${(m.paid / maxMonth) * 100}%` }} title="Paid out" />
                    </div>
                    <span className="tabular-nums text-muted-foreground">{formatCurrency(m.accrued, cur)} set · {formatCurrency(m.paid, cur)} paid</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground"><span className="inline-block h-2 w-3 rounded bg-amber-400 align-middle" /> set aside <span className="ml-3 inline-block h-2 w-3 rounded bg-emerald-500 align-middle" /> paid out</p>
            </section>
          )}

          {/* Owed list */}
          <section className="rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Waiting to be paid ({owedEntries.length})</h2>
              <Can permission="finance.accounting.edit">
                <Button size="sm" className="h-8 gap-1.5" disabled={selected.size === 0} onClick={() => setPaying(true)}>
                  Pay {selected.size > 0 ? `${formatCurrency(selectedTotal, cur)} ` : ""}selected
                </Button>
              </Can>
            </div>
            {owedEntries.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Nothing is waiting. Amounts appear here when an invoice with a set-aside is paid.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground"><tr className="border-b border-border">
                    <th className="w-10 px-4 py-2"><input type="checkbox" checked={allSelected} aria-label="Select all"
                      onChange={() => setSelected(allSelected ? new Set() : new Set(owedEntries.map(e => e.id)))} /></th>
                    <th className="px-2 py-2 text-left font-medium">Invoice</th>
                    <th className="px-2 py-2 text-left font-medium">Set-aside</th>
                    <th className="px-2 py-2 text-left font-medium">Earned on</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                  </tr></thead>
                  <tbody>{owedEntries.map(e => (
                    <tr key={e.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2"><input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} aria-label={`Select ${e.invoiceNumber}`} /></td>
                      <td className="px-2 py-2 font-medium">{e.invoiceNumber}</td>
                      <td className="px-2 py-2">{e.name}</td>
                      <td className="px-2 py-2 text-muted-foreground">{formatDate(e.accruedOn)}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold">{formatCurrency(e.ledgerAmount, cur)}</td>
                    </tr>))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Payout history */}
          {data.recentPayouts.length > 0 && (
            <section className="rounded-xl border border-border bg-card overflow-x-auto">
              <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">Paid out</h2>
              <table className="w-full text-sm">
                <tbody>{data.recentPayouts.map(p => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">{formatDate(p.paidOn)}</td>
                    <td className="px-2 py-2 text-muted-foreground">{p.entryCount} payment(s) · from {p.fromAccountNumber}{p.reference ? ` · ${p.reference}` : ""}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">{formatCurrency(p.total, cur)}</td>
                    <td className="px-2 py-2 text-right">
                      <Can permission="finance.accounting.edit">
                        <button onClick={() => setUndoId(p.id)} className="text-xs text-muted-foreground hover:text-destructive hover:underline">Undo</button>
                      </Can>
                    </td>
                  </tr>))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}

      {undoId && (
        <Overlay title="Undo this payment?" onClose={() => setUndoId(null)}>
          <p className="text-sm text-muted-foreground">
            The payment entry in your books is reversed and these amounts go back to "waiting to be paid". Use this if the payment was recorded by mistake.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setUndoId(null)}>Keep it</Button>
            <Button variant="destructive" disabled={undo.isPending}
              onClick={() => undo.mutate(undoId, { onSuccess: () => setUndoId(null) })}>
              {undo.isPending ? "Undoing…" : "Undo payment"}
            </Button>
          </div>
        </Overlay>
      )}
      {ruleEdit && <RuleDialog rule={ruleEdit === "new" ? null : ruleEdit} onClose={() => setRuleEdit(null)} />}
      {paying && (
        <PayDialog ids={[...selected]} total={selectedTotal} currency={cur}
          onClose={() => setPaying(false)} onDone={() => { setPaying(false); setSelected(new Set()); }} />
      )}
    </div>
  );
}

/* ── Dialogs ───────────────────────────────────────────────────────────────── */

function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-bold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted/40" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-5">{children}</div>
      </div>
    </div>
  );
}

function RuleDialog({ rule, onClose }: { rule: SetAsideRuleDto | null; onClose: () => void }) {
  const save = useSaveSetAsideRule();
  const [name, setName] = React.useState(rule?.name ?? "Charity");
  const [kind, setKind] = React.useState<SetAsideKind>(rule?.kind ?? "percent");
  const [value, setValue] = React.useState(rule?.value ?? 5);
  const [autoApply, setAutoApply] = React.useState(rule?.autoApply ?? true);
  const [isActive, setIsActive] = React.useState(rule?.isActive ?? true);
  const valid = name.trim().length > 0 && value > 0 && (kind !== "percent" || value <= 100);

  return (
    <Overlay title={rule ? "Edit rule" : "New rule"} onClose={onClose}>
      <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Charity" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Type</Label>
          <select value={kind} onChange={e => setKind(e.target.value as SetAsideKind)} className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm">
            <option value="percent">% of amount before VAT</option><option value="fixed">Fixed amount per invoice</option>
          </select></div>
        <div className="space-y-1.5"><Label>{kind === "percent" ? "Percent" : "Amount"}</Label>
          <Input type="number" min={0} step="0.01" value={value} onChange={e => setValue(+e.target.value)} /></div>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoApply} onChange={e => setAutoApply(e.target.checked)} /> Add automatically to every new invoice</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} /> Active</label>
      <p className="text-xs text-muted-foreground">Changing a rule affects future invoices only. Invoices already created keep what they had.</p>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!valid || save.isPending}
          onClick={() => save.mutate({ id: rule?.id, data: { name: name.trim(), kind, value, autoApply, isActive } }, { onSuccess: onClose })}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </Overlay>
  );
}

function PayDialog({ ids, total, currency, onClose, onDone }: {
  ids: string[]; total: number; currency: string; onClose: () => void; onDone: () => void;
}) {
  const pay = usePaySetAsides();
  const { data: accounts } = useAccounts({ isActive: true });
  const options = (accounts ?? []).filter(a => /^10\d\d/.test(a.accountNumber)).sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
  const [paidOn, setPaidOn] = React.useState(iso(new Date()));
  const [from, setFrom] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [notes, setNotes] = React.useState("");
  React.useEffect(() => { if (!from && options.length) setFrom(options[0].accountNumber); }, [options.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Overlay title={`Pay ${formatCurrency(total, currency)}`} onClose={onClose}>
      <p className="text-xs text-muted-foreground">Record that you paid these {ids.length} amount(s) out. This posts the payment in your books and marks them paid.</p>
      <div className="space-y-1.5"><Label>Paid on</Label><Input type="date" value={paidOn} onChange={e => setPaidOn(e.target.value)} /></div>
      <div className="space-y-1.5"><Label>Paid from</Label>
        <select value={from} onChange={e => setFrom(e.target.value)} className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm">
          {options.map(a => <option key={a.id} value={a.accountNumber}>{a.accountNumber} {a.name}</option>)}
        </select></div>
      <div className="space-y-1.5"><Label>Reference (optional)</Label><Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Transfer / receipt number" /></div>
      <div className="space-y-1.5"><Label>Notes (optional)</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!paidOn || !from || pay.isPending}
          onClick={() => pay.mutate({ entryIds: ids, paidOn, fromAccountNumber: from, reference: reference.trim() || null, notes: notes.trim() || null }, { onSuccess: onDone })}>
          {pay.isPending ? "Recording…" : "Record payment"}
        </Button>
      </div>
    </Overlay>
  );
}
