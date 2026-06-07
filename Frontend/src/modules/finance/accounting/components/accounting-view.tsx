"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, TrendingUp, TrendingDown, Scale, DollarSign, X, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import { useAccounts, useCreateAccount } from "@/hooks/finance/use-accounts";
import type { AccountDto, UpsertAccountRequest } from "@/lib/finance/accounts.api";

const TYPE_LABELS: Record<string, string> = {
  asset:     "Asset",
  liability: "Liability",
  equity:    "Equity",
  revenue:   "Revenue",
  expense:   "Expense",
};

const TYPE_COLORS: Record<string, string> = {
  asset:     "text-success",
  liability: "text-destructive",
  equity:    "text-primary",
  revenue:   "text-success",
  expense:   "text-destructive",
};

const TYPE_BG: Record<string, string> = {
  asset:     "bg-success/10 text-success",
  liability: "bg-destructive/10 text-destructive",
  equity:    "bg-primary/10 text-primary",
  revenue:   "bg-success/10 text-success",
  expense:   "bg-destructive/10 text-destructive",
};

const ALL_TYPES = ["asset", "liability", "equity", "revenue", "expense"] as const;

function AccountDrawer({ account, allAccounts, onClose }: {
  account: AccountDto;
  allAccounts: AccountDto[];
  onClose: () => void;
}) {
  const parentAccount = account.parentId
    ? allAccounts.find(a => a.id === account.parentId)
    : null;
  const children = allAccounts.filter(a => a.parentId === account.id);

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed top-0 right-0 h-full w-full max-w-[580px] bg-background border-l border-border shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Account Detail</p>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs text-muted-foreground">{account.accountNumber}</p>
              <h2 className="text-xl font-bold mt-0.5">{account.name}</h2>
              {account.description && (
                <p className="text-sm text-muted-foreground mt-1">{account.description}</p>
              )}
            </div>
            <span className={cn("px-3 py-1 rounded-full text-xs font-semibold capitalize",
              TYPE_BG[account.accountType] ?? "bg-muted text-muted-foreground")}>
              {TYPE_LABELS[account.accountType] ?? account.accountType}
            </span>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground mb-1">Current Balance</p>
            <p className={cn("text-3xl font-bold", account.balance >= 0 ? "text-success" : "text-destructive")}>
              {formatCurrency(Math.abs(account.balance), "AED")}
            </p>
            {account.balance < 0 && <p className="text-xs text-muted-foreground mt-1">Credit balance</p>}
          </div>

          <div className="space-y-0 divide-y divide-border/50">
            {[
              { label: "Account Number", value: account.accountNumber },
              { label: "Account Type",   value: TYPE_LABELS[account.accountType] ?? account.accountType },
              { label: "Status",         value: account.isActive ? "Active" : "Inactive" },
              { label: "Parent Account", value: parentAccount ? `${parentAccount.accountNumber} – ${parentAccount.name}` : "Root Account" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center py-3">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-sm font-medium">{value}</span>
              </div>
            ))}
          </div>

          {children.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Child Accounts</h3>
              <div className="space-y-2">
                {children.map(child => (
                  <div key={child.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono text-xs text-muted-foreground">{child.accountNumber}</span>
                      <span className="text-sm">{child.name}</span>
                    </div>
                    <span className={cn("text-sm font-semibold", TYPE_COLORS[child.accountType] ?? "text-foreground")}>
                      {formatCurrency(child.balance, "AED")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function AddAccountModal({ onClose, allAccounts }: { onClose: () => void; allAccounts: AccountDto[] }) {
  const createAccount = useCreateAccount();
  const [accountNumber, setAccountNumber] = React.useState("");
  const [name, setName]       = React.useState("");
  const [accountType, setType]  = React.useState("asset");
  const [description, setDesc]  = React.useState("");
  const [parentId, setParentId] = React.useState("");

  const isValid = !!accountNumber.trim() && !!name.trim();

  const handleSubmit = async () => {
    if (!isValid) return;
    await createAccount.mutateAsync({
      accountNumber: accountNumber.trim(),
      name: name.trim(),
      accountType,
      description: description || null,
      parentId: parentId || null,
      isActive: true,
    });
    onClose();
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed top-0 right-0 h-full w-full max-w-md bg-background border-l border-border shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <p className="font-bold text-base">New Account</p>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Account Number *</label>
            <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)}
              placeholder="e.g. 1000" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Account Name *</label>
            <Input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Cash and Cash Equivalents" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Account Type *</label>
            <select value={accountType} onChange={e => setType(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm">
              {ALL_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Parent Account</label>
            <select value={parentId} onChange={e => setParentId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm">
              <option value="">— None (root account) —</option>
              {allAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.accountNumber} – {a.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
            <textarea value={description} onChange={e => setDesc(e.target.value)} rows={2}
              placeholder="Optional description…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
        </div>
        <div className="border-t border-border px-6 py-4 flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!isValid || createAccount.isPending}>
            {createAccount.isPending ? "Creating…" : "Create Account"}
          </Button>
        </div>
      </motion.div>
    </>
  );
}

export function AccountingView() {
  const [search, setSearch]           = React.useState("");
  const [activeType, setActiveType]   = React.useState<string>("all");
  const [selectedAccount, setSelected] = React.useState<AccountDto | null>(null);
  const [showAdd, setShowAdd]         = React.useState(false);

  const { data: accounts = [], isLoading } = useAccounts({
    search:      search || undefined,
    accountType: activeType !== "all" ? activeType : undefined,
  });

  const grouped = React.useMemo(() => {
    const groups: Record<string, AccountDto[]> = {};
    for (const a of accounts) {
      const t = a.accountType.toLowerCase();
      if (!groups[t]) groups[t] = [];
      groups[t].push(a);
    }
    return groups;
  }, [accounts]);

  const subtotals = React.useMemo(() => {
    const result: Record<string, number> = {};
    for (const type of ALL_TYPES) {
      result[type] = (grouped[type] ?? []).reduce((s, a) => s + a.balance, 0);
    }
    return result;
  }, [grouped]);

  const totalAssets      = subtotals["asset"]     ?? 0;
  const totalLiabilities = subtotals["liability"] ?? 0;
  const totalEquity      = subtotals["equity"]    ?? 0;
  const totalRevenue     = subtotals["revenue"]   ?? 0;
  const totalExpenses    = subtotals["expense"]   ?? 0;
  const netProfit        = totalRevenue - totalExpenses;

  const STAT_CARDS = [
    { label: "Total Assets",      value: totalAssets,      color: "text-success",     icon: TrendingUp,   bg: "bg-success/10" },
    { label: "Total Liabilities", value: totalLiabilities, color: "text-destructive", icon: TrendingDown, bg: "bg-destructive/10" },
    { label: "Equity",            value: totalEquity,      color: "text-primary",     icon: Scale,        bg: "bg-primary/10" },
    { label: "Revenue YTD",       value: totalRevenue,     color: "text-success",     icon: TrendingUp,   bg: "bg-success/10" },
    { label: "Expenses YTD",      value: totalExpenses,    color: "text-destructive", icon: TrendingDown, bg: "bg-destructive/10" },
    { label: "Net Profit",        value: netProfit,        color: netProfit >= 0 ? "text-success" : "text-destructive", icon: DollarSign, bg: netProfit >= 0 ? "bg-success/10" : "bg-destructive/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Chart of Accounts</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Manage your general ledger accounts and financial structure.</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" /> New Account
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAT_CARDS.map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }} className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", card.bg)}>
              <card.icon className={cn("h-4 w-4", card.color)} />
            </div>
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className={cn("text-base font-bold leading-tight", card.color)}>
              {formatCurrency(card.value, "AED")}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search accounts…" value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(["all", ...ALL_TYPES] as const).map(t => (
            <button key={t} onClick={() => setActiveType(t)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
                activeType === t
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {t === "all" ? "All" : TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped Tables */}
      {isLoading ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : (
        <div className="space-y-4">
          {ALL_TYPES.map(type => {
            const typeAccounts = grouped[type];
            if (!typeAccounts?.length) return null;
            return (
              <div key={type} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize", TYPE_BG[type])}>
                      {TYPE_LABELS[type]}
                    </span>
                    <span className="text-xs text-muted-foreground">{typeAccounts.length} accounts</span>
                  </div>
                  <span className={cn("text-sm font-bold", TYPE_COLORS[type])}>
                    Subtotal: {formatCurrency(subtotals[type] ?? 0, "AED")}
                  </span>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-28">Number</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Account Name</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">Description</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground w-20">Status</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground w-40">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {typeAccounts.map(account => (
                      <tr key={account.id} onClick={() => setSelected(account)}
                        className="border-b border-border/30 last:border-0 hover:bg-muted/20 cursor-pointer transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{account.accountNumber}</td>
                        <td className="px-4 py-3 text-sm font-medium">
                          {account.parentId ? <span className="ml-3">{account.name}</span> : account.name}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell max-w-[240px] truncate">
                          {account.description ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium",
                            account.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                            {account.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className={cn("px-4 py-3 text-right text-sm font-semibold", TYPE_COLORS[account.accountType] ?? "text-foreground")}>
                          {formatCurrency(Math.abs(account.balance), "AED")}
                          {account.balance < 0 && <span className="text-xs ml-1">(Cr)</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
          {accounts.length === 0 && (
            <div className="bg-card border border-border rounded-xl p-12 text-center text-sm text-muted-foreground">
              No accounts found.
            </div>
          )}
        </div>
      )}

      {/* Drawers */}
      <AnimatePresence>
        {selectedAccount && (
          <AccountDrawer account={selectedAccount} allAccounts={accounts} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAdd && (
          <AddAccountModal allAccounts={accounts} onClose={() => setShowAdd(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
