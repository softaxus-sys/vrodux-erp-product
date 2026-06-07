"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, CheckCircle2, AlertCircle, XCircle, Home, ShoppingCart,
  Search, Plus, X, Calendar, User, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useContracts, useRealEstateSummary } from "@/hooks/real-estate/use-real-estate";
import type { RentalContractDto as Contract, ContractStatus } from "@/lib/real-estate/real-estate.api";
import { AddContractForm } from "./add-contract-form";

const STATUS_CONFIG: Record<ContractStatus, { label: string; color: string; bg: string; dot: string }> = {
  draft:          { label: "Draft",          color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50", dot: "bg-slate-400" },
  active:         { label: "Active",         color: "text-success",     bg: "bg-success/10",                    dot: "bg-success" },
  expiring_soon:  { label: "Expiring Soon",  color: "text-warning",     bg: "bg-warning/10",                    dot: "bg-warning" },
  expired:        { label: "Expired",        color: "text-destructive", bg: "bg-destructive/10",                dot: "bg-destructive" },
  terminated:     { label: "Terminated",     color: "text-muted-foreground", bg: "bg-muted",                   dot: "bg-muted-foreground" },
};

const FREQ_LABELS: Record<string, string> = {
  monthly: "Monthly", quarterly: "Quarterly", annual: "Annual",
};

function ContractDrawer({ contract, open, onClose }: { contract: Contract | null; open: boolean; onClose: () => void }) {
  if (!contract) return null;
  const sc = STATUS_CONFIG[contract.status];
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
              <p className="font-mono text-xs text-muted-foreground">{contract.contractNumber}</p>
              <p className="font-bold text-base">{contract.propertyName}</p>
              <p className="text-sm text-muted-foreground">Unit {contract.unitNumber}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />{sc.label}
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  Lease
                </span>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Annual Rent</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(contract.annualRent, "AED")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{FREQ_LABELS[contract.paymentFrequency] ?? contract.paymentFrequency} payments</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Tenant</span><span className="font-medium">{contract.tenantName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Security Deposit</span><span>{formatCurrency(contract.securityDeposit, "AED")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Start Date</span><span>{formatDate(contract.startDate, "medium")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">End Date</span><span className={cn(contract.status === "expiring_soon" ? "text-warning font-semibold" : contract.status === "expired" ? "text-destructive font-semibold" : "")}>{formatDate(contract.endDate, "medium")}</span></div>
              {contract.signedDate && <div className="flex justify-between"><span className="text-muted-foreground">Signed</span><span>{formatDate(contract.signedDate, "medium")}</span></div>}
            </div>
            {contract.notes && <div><h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notes</h4>
              <p className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-3">{contract.notes}</p></div>}
          </div>
          <div className="border-t border-border px-6 py-4 flex items-center gap-2">
            {contract.status === "draft" && <Button size="sm" className="gap-1.5 h-9"><CheckCircle2 className="h-3.5 w-3.5" />Activate</Button>}
            {contract.status === "expiring_soon" && <Button size="sm" className="gap-1.5 h-9"><FileText className="h-3.5 w-3.5" />Renew</Button>}
          </div>
        </motion.div>
      </>)}
    </AnimatePresence>
  );
}

const STATUS_FILTERS = ["all", "draft", "active", "expiring_soon", "expired", "terminated"] as const;

export function ContractsView() {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<ContractStatus | "all">("all");
  // typeFilter removed — RentalContractDto covers only lease contracts
  const [selected, setSelected] = React.useState<Contract | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);

  const { data: contracts = [], isLoading } = useContracts();
  const { data: summary } = useRealEstateSummary();

  const activeCount   = contracts.filter(c => c.status === "active").length;
  const expiringCount = contracts.filter(c => c.status === "expiring_soon").length;
  const totalAnnual   = contracts.filter(c => c.status === "active").reduce((s, c) => s + c.annualRent, 0);

  const filtered = React.useMemo(() => {
    let list = contracts;
    if (statusFilter !== "all") list = list.filter(c => c.status === statusFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(c =>
        c.contractNumber.toLowerCase().includes(s) ||
        c.tenantName.toLowerCase().includes(s) ||
        c.propertyName.toLowerCase().includes(s) ||
        c.unitNumber.toLowerCase().includes(s)
      );
    }
    return list;
  }, [contracts, search, statusFilter]);

  const STATS = [
    { label: "Total Contracts", value: summary?.activeContracts ?? contracts.length, icon: FileText,     color: "text-slate-600", bg: "bg-slate-100 dark:bg-slate-800/50" },
    { label: "Active",          value: activeCount,                                   icon: CheckCircle2, color: "text-success",   bg: "bg-success/10" },
    { label: "Expiring Soon",   value: summary?.expiringContracts ?? expiringCount,   icon: AlertCircle,  color: "text-warning",   bg: "bg-warning/10" },
    { label: "Annual Rent",     value: formatCurrency(totalAnnual, "AED"),            icon: Home,         color: "text-primary",   bg: "bg-primary/10", isText: true },
    { label: "Tenants",         value: summary?.activeTenants ?? 0,                  icon: ShoppingCart, color: "text-success",   bg: "bg-success/10" },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Contracts</h1><p className="text-sm text-muted-foreground mt-0.5">Manage lease and sale contracts across all properties</p></div>
        <Button className="gap-2 h-9" onClick={() => setShowAddForm(true)}><Plus className="h-4 w-4" />New Contract</Button>
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
          <Input placeholder="Search contracts…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button key={f} onClick={() => setStatusFilter(f as ContractStatus | "all")}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                statusFilter === f ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {f === "all" ? "All" : f === "expiring_soon" ? "Expiring" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contract</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Tenant</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Property / Unit</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">End Date</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-sm text-muted-foreground">No contracts found.</td></tr>
            ) : filtered.map((c, i) => {
              const sc = STATUS_CONFIG[c.status];
              return (
                <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  onClick={() => { setSelected(c); setDrawerOpen(true); }}
                  className={cn("border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer",
                    c.status === "expiring_soon" ? "border-l-2 border-l-warning" :
                    c.status === "expired" ? "border-l-2 border-l-destructive" : "")}>
                  <td className="px-4 py-3.5 font-mono text-sm font-semibold">{c.contractNumber}</td>
                  <td className="px-4 py-3.5 text-sm hidden md:table-cell">
                    <div className="flex items-center gap-1.5"><User className="h-3 w-3 text-muted-foreground" />{c.tenantName}</div>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <div className="flex items-center gap-1.5 text-sm"><Building2 className="h-3 w-3 text-muted-foreground" />{c.propertyName}</div>
                    <p className="text-xs text-muted-foreground pl-4">Unit {c.unitNumber}</p>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Calendar className="h-3.5 w-3.5" />
                      <span className={cn(c.status === "expiring_soon" ? "text-warning font-semibold" : c.status === "expired" ? "text-destructive font-semibold" : "")}>
                        {formatDate(c.endDate, "short")}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right font-semibold text-sm">
                    {formatCurrency(c.annualRent, "AED")}
                    <p className="text-[10px] text-muted-foreground font-normal">/year</p>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                      Lease
                    </span>
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
      <ContractDrawer contract={selected} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AddContractForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}
