import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, Bell, Calendar, CheckCircle2, Clock, FileText, Loader2,
  Plus, Search, Trash2, User, X, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/auth/can";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { ContractDto as Contract, ContractStatus } from "@/lib/real-estate/re.api";
import {
  useContract, useContracts, useContractSummary, useDeleteContract,
  useSendRentReminder, useSetContractStatus,
} from "@/hooks/real-estate/use-re";
import { AddContractForm } from "./add-contract-form";
import { RentSchedulePanel } from "./rent-schedule-panel";

const STATUS_CONFIG: Record<ContractStatus, { label: string; color: string; bg: string; dot: string }> = {
  active:     { label: "Active",     color: "text-success",          bg: "bg-success/10",  dot: "bg-success" },
  expired:    { label: "Expired",    color: "text-destructive",      bg: "bg-destructive/10", dot: "bg-destructive" },
  terminated: { label: "Terminated", color: "text-muted-foreground", bg: "bg-muted",       dot: "bg-muted-foreground" },
  renewed:    { label: "Renewed",    color: "text-primary",          bg: "bg-primary/10",  dot: "bg-primary" },
};

const FREQ_LABELS: Record<string, string> = {
  monthly: "Monthly", quarterly: "Quarterly", semi_annual: "Half-yearly", annual: "Annual",
};

/** A lease is "expiring soon" inside 60 days — the same window the summary endpoint counts. */
const EXPIRING_SOON_DAYS = 60;

// ── Drawer ──────────────────────────────────────────────────────────────────

function ContractDrawer({ contractId, open, onClose }: { contractId: string | null; open: boolean; onClose: () => void }) {
  const currency = useCurrency();
  const { data, isLoading } = useContract(open ? contractId : null);
  const setStatus = useSetContractStatus();
  const remove    = useDeleteContract();
  const remind    = useSendRentReminder();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [tab, setTab] = React.useState<"details" | "schedule">("schedule");

  React.useEffect(() => { if (!open) { setConfirmDelete(false); setTab("schedule"); } }, [open]);

  const contract = data?.contract;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed top-0 end-0 h-full w-full max-w-[620px] bg-background border-s border-border shadow-2xl z-50 flex flex-col overflow-hidden">

        {isLoading || !contract ? (
          <div className="flex-1 grid place-items-center text-sm text-muted-foreground">
            {isLoading ? "Loading lease…" : "Lease not found."}
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between px-6 py-5 border-b border-border">
              <div className="min-w-0">
                <p className="font-mono text-xs text-muted-foreground">{contract.contractNumber}</p>
                <p className="font-bold text-base truncate">{contract.propertyName}</p>
                <p className="text-sm text-muted-foreground">Unit {contract.unitNumber} &middot; {contract.tenantName}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold",
                    STATUS_CONFIG[contract.status]?.color, STATUS_CONFIG[contract.status]?.bg)}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_CONFIG[contract.status]?.dot)} />
                    {STATUS_CONFIG[contract.status]?.label ?? contract.status}
                  </span>
                  {contract.overdueCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-destructive/10 text-destructive">
                      <AlertCircle className="w-3 h-3" />
                      {contract.overdueCount} overdue
                    </span>
                  )}
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-1 px-6 pt-3">
              {(["schedule", "details"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={cn("px-3 py-1.5 text-sm rounded-lg font-medium",
                    tab === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/40")}>
                  {t === "schedule" ? "Rent schedule" : "Details"}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {tab === "schedule"
                ? <RentSchedulePanel contract={contract} installments={data!.installments} />
                : (
                  <div className="space-y-2 text-sm">
                    <Row label="Term" value={`${formatDate(contract.startDate)} → ${formatDate(contract.endDate)}`} />
                    <Row label="Annual rent" value={formatCurrency(contract.annualRent, currency)} />
                    <Row label="Payment frequency" value={FREQ_LABELS[contract.paymentFrequency] ?? contract.paymentFrequency} />
                    <Row label="Installments" value={String(contract.installmentCount)} />
                    <Row label="Security deposit" value={formatCurrency(contract.securityDeposit, currency)} />
                    <Row label="Collected" value={formatCurrency(contract.totalPaid, currency)} />
                    <Row label="Balance" value={formatCurrency(contract.balance, currency)} />
                    <Row label="Next payment" value={contract.nextDueDate
                      ? `${formatDate(contract.nextDueDate)} · ${formatCurrency(contract.nextDueAmount, currency)}`
                      : "—"} />
                    <Row label="Last payment" value={contract.lastPaymentDate ? formatDate(contract.lastPaymentDate) : "—"} />
                    <Row label="Ejari" value={contract.ejariNumber || "—"} />
                    {contract.notes && (
                      <div className="pt-2">
                        <p className="text-xs text-muted-foreground mb-1">Notes</p>
                        <p className="text-sm">{contract.notes}</p>
                      </div>
                    )}
                  </div>
                )}
            </div>

            <div className="border-t border-border px-6 py-4 flex flex-wrap items-center gap-2">
              <Can permission="real-estate.rent.remind">
                <Button size="sm" variant="outline" disabled={remind.isPending}
                  onClick={() => remind.mutate({ id: contract.id })}>
                  <Bell className="w-3.5 h-3.5 me-1.5" /> Send expiry notice
                </Button>
              </Can>

              {contract.status === "active" && (
                <Can permission="real-estate.contracts.edit">
                  <Button size="sm" variant="outline"
                    onClick={() => setStatus.mutate({ id: contract.id, status: "terminated" })}>
                    Terminate
                  </Button>
                </Can>
              )}

              <div className="flex-1" />

              <Can permission="real-estate.contracts.delete">
                <Button size="sm" variant="ghost" className="text-destructive"
                  onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="w-3.5 h-3.5 me-1.5" /> Delete
                </Button>
              </Can>
            </div>

            <AnimatePresence>
              {confirmDelete && (
                <>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/50 z-[60]" onClick={() => setConfirmDelete(false)} />
                  <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                    className="absolute inset-x-6 top-32 z-[61] bg-background border border-border rounded-xl shadow-2xl p-5">
                    <p className="font-semibold text-sm mb-1">Delete {contract.contractNumber}?</p>
                    <p className="text-xs text-muted-foreground mb-4">
                      The lease and its whole rent schedule are removed, and the unit is marked vacant.
                      Payments already recorded go with it.
                    </p>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                      <Button variant="destructive" disabled={remove.isPending}
                        onClick={async () => {
                          try { await remove.mutateAsync(contract.id); onClose(); } catch { /* hook toasts */ }
                        }}>
                        {remove.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                        Delete
                      </Button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </>
        )}
      </motion.div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-end">{value}</span>
    </div>
  );
}

// ── View ────────────────────────────────────────────────────────────────────

export function ContractsView() {
  const currency = useCurrency();
  const { data: contracts = [], isLoading } = useContracts();
  const { data: summary } = useContractSummary();

  const [search, setSearch]     = React.useState("");
  const [filter, setFilter]     = React.useState<"all" | ContractStatus | "overdue" | "expiring">("all");
  const [selected, setSelected] = React.useState<string | null>(null);
  const [adding, setAdding]     = React.useState(false);

  const filtered = React.useMemo(() => {
    let list = contracts;
    if (filter === "overdue")       list = list.filter(c => c.overdueCount > 0);
    else if (filter === "expiring") list = list.filter(c =>
      c.status === "active" && c.daysToExpiry !== null && c.daysToExpiry <= EXPIRING_SOON_DAYS);
    else if (filter !== "all")      list = list.filter(c => c.status === filter);

    const q = search.trim().toLowerCase();
    if (q) list = list.filter(c =>
      c.contractNumber.toLowerCase().includes(q) ||
      c.tenantName.toLowerCase().includes(q) ||
      c.propertyName.toLowerCase().includes(q) ||
      c.unitNumber.toLowerCase().includes(q));

    // Overdue first, then soonest next payment — the order the money needs attention in.
    return [...list].sort((a, b) => {
      if ((b.overdueCount > 0 ? 1 : 0) !== (a.overdueCount > 0 ? 1 : 0)) return b.overdueCount - a.overdueCount;
      return (a.nextDueDate ?? "9999").localeCompare(b.nextDueDate ?? "9999");
    });
  }, [contracts, filter, search]);

  const stats = [
    { label: "Active leases", value: String(summary?.active ?? 0), icon: FileText, color: "text-primary", bg: "bg-primary/10" },
    { label: "Overdue rent", value: formatCurrency(summary?.overdueAmount ?? 0, currency),
      sub: `${summary?.overdueInstallments ?? 0} payment(s)`, icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Due in 30 days", value: formatCurrency(summary?.dueThisMonthAmount ?? 0, currency),
      sub: `${summary?.dueThisMonth ?? 0} payment(s)`, icon: Clock, color: "text-warning", bg: "bg-warning/10" },
    { label: "Expiring soon", value: String(summary?.expiringSoon ?? 0), icon: Calendar, color: "text-warning", bg: "bg-warning/10" },
    { label: "Collected", value: formatCurrency(summary?.totalCollected ?? 0, currency), icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Lease Contracts</h1>
          <p className="text-sm text-muted-foreground">Rent schedules, collections and expiry.</p>
        </div>
        <Can permission="real-estate.contracts.create">
          <Button onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4 me-1.5" /> New lease
          </Button>
        </Can>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl border border-border p-4">
            <div className={cn("w-8 h-8 rounded-lg grid place-items-center mb-2", s.bg)}>
              <s.icon className={cn("w-4 h-4", s.color)} />
            </div>
            <p className="text-lg font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            {s.sub && <p className="text-[11px] text-muted-foreground">{s.sub}</p>}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search lease, tenant, property or unit…" className="ps-9 h-9 text-sm" />
        </div>
        {([
          ["all", "All"], ["overdue", "Overdue"], ["expiring", "Expiring"],
          ["active", "Active"], ["expired", "Expired"], ["terminated", "Terminated"],
        ] as const).map(([v, label]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={cn("px-3 py-1.5 text-xs rounded-lg font-medium",
              filter === v ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted")}>
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading leases…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <XCircle className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {contracts.length === 0 ? "No leases yet." : "No leases match this filter."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(c => (
              <button key={c.id} onClick={() => setSelected(c.id)}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-muted/30 text-start">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{c.propertyName} · {c.unitNumber}</p>
                    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                      STATUS_CONFIG[c.status]?.color, STATUS_CONFIG[c.status]?.bg)}>
                      {STATUS_CONFIG[c.status]?.label ?? c.status}
                    </span>
                    {c.overdueCount > 0 && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
                        {c.overdueCount} overdue
                      </span>
                    )}
                    {c.status === "active" && c.daysToExpiry !== null && c.daysToExpiry <= EXPIRING_SOON_DAYS && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-warning/10 text-warning">
                        {c.daysToExpiry < 0 ? "Past end date" : `Ends in ${c.daysToExpiry}d`}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <User className="w-3 h-3" /> {c.tenantName}
                    <span className="text-muted-foreground/50">·</span>
                    <span className="font-mono">{c.contractNumber}</span>
                  </p>
                </div>

                <div className="text-end shrink-0">
                  <p className="text-sm font-semibold">{formatCurrency(c.annualRent, currency)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {FREQ_LABELS[c.paymentFrequency] ?? c.paymentFrequency}
                  </p>
                </div>

                <div className="text-end shrink-0 w-32 hidden sm:block">
                  {c.nextDueDate ? (
                    <>
                      <p className="text-xs font-medium">{formatDate(c.nextDueDate)}</p>
                      <p className="text-[11px] text-muted-foreground">next payment</p>
                    </>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">no schedule</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected && <ContractDrawer contractId={selected} open onClose={() => setSelected(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {adding && <AddContractForm open onClose={() => setAdding(false)} />}
      </AnimatePresence>
    </div>
  );
}
