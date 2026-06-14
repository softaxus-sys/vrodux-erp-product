import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeftRight, Clock, Truck, CheckCircle2, Ban, DollarSign,
  Search, Plus, Calendar, X, MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { StockTransferDto as StockTransfer, TransferStatus } from "@/lib/inventory/types";
import {
  useStockTransfers, useTransfersSummary,
  useSubmitTransfer, useApproveTransfer, useReceiveTransfer,
} from "@/hooks/inventory/use-transfers";
import { useAuthStore } from "@/store/auth.store";
import { ClientPagination, useClientPagination } from "@/components/ui/client-pagination";
import { AddTransferForm } from "./add-transfer-form";

const STATUS_FALLBACK = { label: "Unknown", color: "text-muted-foreground", bg: "bg-muted", dot: "bg-muted-foreground" };
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  draft:      { label: "Draft",      color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50", dot: "bg-slate-400" },
  pending:    { label: "Pending",    color: "text-warning",     bg: "bg-warning/10",                    dot: "bg-warning" },
  in_transit: { label: "In Transit", color: "text-primary",     bg: "bg-primary/10",                    dot: "bg-primary" },
  received:   { label: "Received",   color: "text-success",     bg: "bg-success/10",                    dot: "bg-success" },
  cancelled:  { label: "Cancelled",  color: "text-destructive", bg: "bg-destructive/10",                dot: "bg-destructive" },
};

function TransferDrawer({ transfer, open, onClose, onSubmit, onApprove, onReceive, busy }: {
  transfer: StockTransfer | null; open: boolean; onClose: () => void;
  onSubmit: (id: string) => void; onApprove: (id: string) => void; onReceive: (id: string) => void; busy: boolean;
}) {
  const currency = useCurrency();
  if (!transfer) return null;
  const sc = STATUS_CONFIG[transfer.status] ?? STATUS_FALLBACK;
  return (
    <AnimatePresence>
      {open && (<>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
        <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className="fixed top-0 right-0 h-full w-full max-w-[560px] bg-background border-l border-border shadow-2xl z-50 flex flex-col">
          <div className="flex items-start justify-between px-6 py-5 border-b border-border">
            <div>
              <p className="font-bold text-base">{transfer.transferNumber}</p>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <span>{transfer.fromWarehouseName}</span>
                <ArrowLeftRight className="h-3.5 w-3.5" />
                <span>{transfer.toWarehouseName}</span>
              </div>
              <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold mt-1.5", sc.color, sc.bg)}>
                <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />{sc.label}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Transfer Value</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(transfer.totalValue, currency)}</p>
              <p className="text-xs text-muted-foreground mt-1">{(transfer.items ?? []).length} items</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/30 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="h-3 w-3" />From</p>
                <p className="text-sm font-semibold">{transfer.fromWarehouseName}</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="h-3 w-3" />To</p>
                <p className="text-sm font-semibold">{transfer.toWarehouseName}</p>
              </div>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Requested By</span><span>{transfer.requestedBy}</span></div>
              {transfer.approvedBy && <div className="flex justify-between"><span className="text-muted-foreground">Approved By</span><span>{transfer.approvedBy}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Request Date</span><span>{formatDate(transfer.requestDate, "medium")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Expected</span><span>{formatDate(transfer.expectedDate, "medium")}</span></div>
              {transfer.receivedDate && <div className="flex justify-between"><span className="text-muted-foreground">Received</span><span className="text-success">{formatDate(transfer.receivedDate, "medium")}</span></div>}
            </div>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Items ({(transfer.items ?? []).length})</h4>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-muted/40 text-xs text-muted-foreground">
                    <th className="text-left px-3 py-2.5 font-semibold">Item</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Qty</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Value</th>
                  </tr></thead>
                  <tbody>
                    {(transfer.items ?? []).map((item, i) => (
                      <motion.tr key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                        className="border-t border-border/40 hover:bg-muted/20">
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-sm">{item.itemName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm">{item.quantity}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-sm">{formatCurrency(item.total, currency)}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {transfer.notes && <div><h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notes</h4>
              <p className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-3">{transfer.notes}</p></div>}
          </div>
          <div className="border-t border-border px-6 py-4 flex items-center gap-2">
            {transfer.status === "draft" && <Button size="sm" disabled={busy} onClick={() => onSubmit(transfer.id)} className="gap-1.5 h-9"><CheckCircle2 className="h-3.5 w-3.5" />Submit for Approval</Button>}
            {transfer.status === "pending" && <Button size="sm" disabled={busy} onClick={() => onApprove(transfer.id)} className="gap-1.5 h-9"><Truck className="h-3.5 w-3.5" />Approve &amp; Dispatch</Button>}
            {transfer.status === "in_transit" && <Button size="sm" disabled={busy} onClick={() => onReceive(transfer.id)} className="gap-1.5 h-9 bg-success hover:bg-success/90"><CheckCircle2 className="h-3.5 w-3.5" />Mark Received</Button>}
          </div>
        </motion.div>
      </>)}
    </AnimatePresence>
  );
}

export function TransfersView() {
  const currency = useCurrency();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<TransferStatus | "all">("all");
  const [selected, setSelected] = React.useState<StockTransfer | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);

  const { data: stockTransfers = [] } = useStockTransfers();
  const { data: transfersSummary } = useTransfersSummary();

  const userName = useAuthStore(s => s.user)?.name ?? "System";
  const submitTransfer  = useSubmitTransfer();
  const approveTransfer = useApproveTransfer();
  const receiveTransfer = useReceiveTransfer();
  const workflowBusy = submitTransfer.isPending || approveTransfer.isPending || receiveTransfer.isPending;
  const closeDrawer = () => setDrawerOpen(false);

  const filtered = React.useMemo(() => {
    let list = stockTransfers;
    if (statusFilter !== "all") list = list.filter(t => t.status === statusFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(t => t.transferNumber.toLowerCase().includes(s) || t.fromWarehouseName.toLowerCase().includes(s) || t.toWarehouseName.toLowerCase().includes(s));
    }
    return list;
  }, [search, statusFilter, stockTransfers]);

  const pg = useClientPagination(filtered, 25);

  const STATS = [
    { label: "Total",      value: transfersSummary?.total      ?? stockTransfers.length,                                               icon: ArrowLeftRight, color: "text-slate-600", bg: "bg-slate-100 dark:bg-slate-800/50" },
    { label: "Pending",    value: transfersSummary?.pending    ?? stockTransfers.filter(t => t.status === "pending").length,           icon: Clock,          color: "text-warning",   bg: "bg-warning/10" },
    { label: "In Transit", value: transfersSummary?.inTransit  ?? stockTransfers.filter(t => t.status === "in_transit").length,        icon: Truck,          color: "text-primary",   bg: "bg-primary/10" },
    { label: "Received",   value: transfersSummary?.received   ?? stockTransfers.filter(t => t.status === "received").length,          icon: CheckCircle2,   color: "text-success",   bg: "bg-success/10" },
    { label: "Total Value", value: formatCurrency(transfersSummary?.totalValue ?? stockTransfers.reduce((s, t) => s + t.totalValue, 0), currency), icon: DollarSign, color: "text-success", bg: "bg-success/10", isText: true },
  ];

  const FILTERS = [
    { key: "all", label: "All" }, { key: "draft", label: "Draft" }, { key: "pending", label: "Pending" },
    { key: "in_transit", label: "In Transit" }, { key: "received", label: "Received" }, { key: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Stock Transfers</h1><p className="text-sm text-muted-foreground mt-0.5">Move inventory between warehouses and locations</p></div>
        <Button className="gap-2 h-9" onClick={() => setShowAddForm(true)}><Plus className="h-4 w-4" />New Transfer</Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
          <Input placeholder="Search transfers…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key as TransferStatus | "all")}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                statusFilter === f.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Transfer #</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">From → To</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Requested By</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Expected</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Items</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Value</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-sm text-muted-foreground">No transfers found.</td></tr>
            ) : pg.pageItems.map((t, i) => {
              const sc = STATUS_CONFIG[t.status] ?? STATUS_FALLBACK;
              return (
                <motion.tr key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                  onClick={() => { setSelected(t); setDrawerOpen(true); }}
                  className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer">
                  <td className="px-4 py-3.5 font-mono text-sm font-semibold">{t.transferNumber}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="font-medium">{t.fromWarehouseName}</span>
                      <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">{t.toWarehouseName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-muted-foreground hidden md:table-cell">{t.requestedBy}</td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Calendar className="h-3.5 w-3.5" />{formatDate(t.expectedDate, "short")}</div>
                  </td>
                  <td className="px-4 py-3.5 text-center text-sm">{(t.items ?? []).length}</td>
                  <td className="px-4 py-3.5 text-right font-semibold text-sm">{formatCurrency(t.totalValue, currency)}</td>
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
      <ClientPagination
        page={pg.page} totalPages={pg.totalPages} totalCount={pg.totalCount}
        hasPrev={pg.hasPrev} hasNext={pg.hasNext}
        onPrev={() => pg.setPage(p => p - 1)} onNext={() => pg.setPage(p => p + 1)}
        label="transfers"
      />
      <TransferDrawer
        transfer={selected} open={drawerOpen} onClose={() => setDrawerOpen(false)}
        busy={workflowBusy}
        onSubmit={id => submitTransfer.mutate(id, { onSuccess: closeDrawer })}
        onApprove={id => approveTransfer.mutate({ id, by: userName }, { onSuccess: closeDrawer })}
        onReceive={id => receiveTransfer.mutate(id, { onSuccess: closeDrawer })}
      />
      <AddTransferForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}

