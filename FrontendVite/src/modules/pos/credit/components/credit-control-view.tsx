import * as React from "react";
import { Search, AlertTriangle, CalendarClock, HandCoins, ShieldAlert, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/auth/can";
import { ExportMenu } from "@/components/ui/export-menu";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { toCsv, downloadFile } from "@/lib/csv";
import { exportPdf } from "@/lib/pdf";
import { useCurrency } from "@/hooks/use-currency";
import { useLazyList } from "@/hooks/use-lazy-list";
import { useCreditOverview } from "@/hooks/pos/use-credit";
import type { CreditCustomerRowDto } from "@/lib/pos/credit.api";
import { AgeingBar, CreditStatusChip, CustomerCreditPanel } from "./credit-ui";
import { RemindersCard } from "./reminders-card";

type Filter = "balance" | "overdue" | "near" | "hold" | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "balance", label: "Owing" }, { id: "overdue", label: "Overdue" }, { id: "near", label: "Near limit" },
  { id: "hold", label: "On hold" }, { id: "all", label: "Everyone with credit" },
];

function Tile({ label, value, sub, icon: Icon, tone }: { label: string; value: string; sub?: string; icon: React.ElementType; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 min-w-0">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <Icon className={cn("h-4 w-4 shrink-0", tone ?? "text-muted-foreground")} />
      </div>
      <p className={cn("mt-1 text-xl font-bold tabular-nums truncate", tone)} title={value}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}
    </div>
  );
}

/**
 * The shop's receivables: who owes what, how late it is, and who to chase first. The list is ordered
 * with the most overdue at the top, because that is the question the owner opens this page to answer.
 */
export function CreditControlView() {
  const currency = useCurrency();
  const { data, isLoading, isError, error, refetch } = useCreditOverview();
  const [filter, setFilter] = React.useState<Filter>("balance");
  const [search, setSearch] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);

  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.customers ?? []).filter(r => {
      if (q && !(r.name.toLowerCase().includes(q) || (r.phone ?? "").includes(q))) return false;
      switch (filter) {
        case "balance": return r.creditBalance > 0;
        case "overdue": return r.overdue > 0;
        case "near": return r.creditLimit > 0 && r.creditBalance >= r.creditLimit * 0.8 && r.creditBalance > 0;
        case "hold": return r.onHold;
        default: return true;
      }
    });
  }, [data, filter, search]);

  const counts = React.useMemo(() => {
    const all = data?.customers ?? [];
    return {
      balance: all.filter(r => r.creditBalance > 0).length, overdue: all.filter(r => r.overdue > 0).length,
      near: all.filter(r => r.creditLimit > 0 && r.creditBalance >= r.creditLimit * 0.8 && r.creditBalance > 0).length,
      hold: all.filter(r => r.onHold).length, all: all.length,
    } as Record<Filter, number>;
  }, [data]);

  const lazy = useLazyList(rows, 25);

  const exportRows = () => rows.map(r => ({
    Customer: r.name, Phone: r.phone ?? "", Owes: r.creditBalance, Overdue: r.overdue, "Oldest overdue (days)": r.oldestOverdueDays,
    Limit: r.creditLimit, "Next due": r.nextDueOn ?? "", "Last payment": r.lastPaymentOn ?? "", Status: r.onHold ? "On hold" : r.overdue > 0 ? "Overdue" : r.creditBalance > 0 ? "Current" : "No balance",
  }));
  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Credit Control</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Everything customers owe you, how late it is, and who to chase first.</p>
        </div>
        <ExportMenu
          onCsv={() => { const r = exportRows(); if (r.length) downloadFile(`credit_customers_${stamp}.csv`, toCsv(r, Object.keys(r[0]) as (keyof typeof r[0])[])); }}
          onPdf={() => exportPdf({
            title: "Customer credit", subtitle: `${rows.length} customers · owed ${formatCurrency(data?.totalOutstanding ?? 0, currency)} · overdue ${formatCurrency(data?.totalOverdue ?? 0, currency)}`,
            columns: ["Customer", "Owes", "Overdue", "Oldest (days)", "Limit", "Next due"], landscape: true,
            rows: rows.map(r => [r.name, formatCurrency(r.creditBalance, currency), formatCurrency(r.overdue, currency), r.oldestOverdueDays || "", formatCurrency(r.creditLimit, currency), r.nextDueOn ? formatDate(r.nextDueOn) : ""]),
          })} />
      </div>

      {isError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive">Could not load credit accounts</p>
          <p className="text-muted-foreground mt-1">{(error as Error)?.message}</p>
          <button onClick={() => refetch()} className="mt-2 text-primary font-medium hover:underline">Try again</button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Tile label="Owed to you" icon={Wallet} value={formatCurrency(data?.totalOutstanding ?? 0, currency)} sub={`${data?.customersWithBalance ?? 0} customers`} />
        <Tile label="Overdue" icon={AlertTriangle} value={formatCurrency(data?.totalOverdue ?? 0, currency)} tone={(data?.totalOverdue ?? 0) > 0 ? "text-destructive" : undefined} sub={`${data?.customersOverdue ?? 0} customers late`} />
        <Tile label="Falls due this week" icon={CalendarClock} value={formatCurrency(data?.dueThisWeek ?? 0, currency)} />
        <Tile label="Collected this month" icon={HandCoins} tone="text-success" value={formatCurrency(data?.collectedThisMonth ?? 0, currency)} />
        <Tile label="Credit stopped" icon={ShieldAlert} value={String(data?.onHold ?? 0)} sub={`${data?.nearLimit ?? 0} near their limit`} tone={(data?.onHold ?? 0) > 0 ? "text-warning" : undefined} />
      </div>

      {data && data.ageing.total > 0 && (
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold">How late is what you are owed?</p>
          <AgeingBar ageing={data.ageing} />
        </section>
      )}

      <RemindersCard />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer or phone…" className="ps-9 h-9" aria-label="Search customers" />
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {FILTERS.map(f => (
            <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === f.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40")}>
              {f.label} <span className="tabular-nums opacity-70">{counts[f.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading…</p>
          : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {(data?.customers.length ?? 0) === 0
                ? "No customer has a credit limit yet. Open a customer and set a limit to let them buy on credit."
                : "No customers match this view."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-start font-medium px-4 py-2.5">Customer</th>
                    <th className="text-end font-medium px-4 py-2.5">Owes</th>
                    <th className="text-start font-medium px-4 py-2.5 hidden md:table-cell">Limit used</th>
                    <th className="text-end font-medium px-4 py-2.5">Overdue</th>
                    <th className="text-start font-medium px-4 py-2.5 hidden lg:table-cell">Next due</th>
                    <th className="text-start font-medium px-4 py-2.5 hidden lg:table-cell">Last payment</th>
                    <th className="text-start font-medium px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lazy.visible.map(r => <Row key={r.customerId} r={r} onOpen={() => setOpenId(r.customerId)} />)}
                </tbody>
              </table>
              <div ref={lazy.sentinelRef} />
              {lazy.hasMore && <button onClick={lazy.loadMore} className="w-full py-3 text-xs text-primary hover:bg-muted/40">Show more ({lazy.shown} of {lazy.total})</button>}
            </div>
          )}
      </div>
      {data?.truncated && <p className="text-xs text-warning">Showing the first 1,000 customers.</p>}

      <Can permission="pos.customers.view">
        <CustomerCreditPanel customerId={openId} open={!!openId} onClose={() => setOpenId(null)} />
      </Can>
    </div>
  );
}

function Row({ r, onOpen }: { r: CreditCustomerRowDto; onOpen: () => void }) {
  const currency = useCurrency();
  const used = r.creditLimit > 0 ? Math.min(100, (r.creditBalance / r.creditLimit) * 100) : 0;
  return (
    <tr onClick={onOpen} className="cursor-pointer hover:bg-muted/40">
      <td className="px-4 py-2.5">
        <button onClick={onOpen} className="font-medium text-start hover:text-primary">{r.name}</button>
        {r.phone && <p className="text-[11px] text-muted-foreground">{r.phone}</p>}
      </td>
      <td className="px-4 py-2.5 text-end font-semibold tabular-nums">{formatCurrency(r.creditBalance, currency)}</td>
      <td className="px-4 py-2.5 hidden md:table-cell w-44">
        {r.creditLimit > 0 ? (
          <div className="space-y-1" title={`${formatCurrency(r.creditBalance, currency)} of ${formatCurrency(r.creditLimit, currency)}`}>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className={cn("h-full", used >= 100 ? "bg-destructive" : used >= 80 ? "bg-warning" : "bg-primary")} style={{ width: `${used}%` }} /></div>
            <p className="text-[10px] text-muted-foreground tabular-nums">{Math.round(used)}% of {formatCurrency(r.creditLimit, currency)}</p>
          </div>
        ) : <span className="text-xs text-muted-foreground">No limit</span>}
      </td>
      <td className={cn("px-4 py-2.5 text-end tabular-nums", r.overdue > 0 ? "text-destructive font-semibold" : "text-muted-foreground")}>
        {r.overdue > 0 ? formatCurrency(r.overdue, currency) : "—"}
      </td>
      <td className="px-4 py-2.5 hidden lg:table-cell text-muted-foreground">{r.nextDueOn ? formatDate(r.nextDueOn) : "—"}</td>
      <td className="px-4 py-2.5 hidden lg:table-cell text-muted-foreground">{r.lastPaymentOn ? formatDate(r.lastPaymentOn) : "—"}</td>
      <td className="px-4 py-2.5"><CreditStatusChip onHold={r.onHold} overdue={r.overdue} oldestOverdueDays={r.oldestOverdueDays} balance={r.creditBalance} limit={r.creditLimit} /></td>
    </tr>
  );
}
