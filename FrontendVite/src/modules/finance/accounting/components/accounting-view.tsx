import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Download, Search, TrendingUp, TrendingDown, Scale, DollarSign, X, ChevronRight,
  Pencil, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import type { AccountDto as Account, AccountType } from "@/lib/finance/finance.api";
import {
  useAccounts, useAccountingSummary,
  useCreateAccount, useUpdateAccount, useDeleteAccount,
} from "@/hooks/finance/use-finance";
import type { CreateAccountRequest } from "@/lib/finance/finance.api";
import { toast } from "sonner";

// ── Constants ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<AccountType, string> = {
  asset:     "Asset",
  liability: "Liability",
  equity:    "Equity",
  income:    "Income",
  expense:   "Expense",
};

const TYPE_COLORS: Record<AccountType, string> = {
  asset:     "text-success",
  liability: "text-destructive",
  equity:    "text-primary",
  income:    "text-success",
  expense:   "text-destructive",
};

const TYPE_BG: Record<AccountType, string> = {
  asset:     "bg-success/10 text-success",
  liability: "bg-destructive/10 text-destructive",
  equity:    "bg-primary/10 text-primary",
  income:    "bg-success/10 text-success",
  expense:   "bg-destructive/10 text-destructive",
};

const ALL_TYPES: AccountType[] = ["asset", "liability", "equity", "income", "expense"];

// ── Account Drawer ─────────────────────────────────────────────────────────────

function AccountDrawer({
  account, accounts, onClose, onEdit, onDelete,
}: {
  account: Account;
  accounts: Account[];
  onClose: () => void;
  onEdit: (a: Account) => void;
  onDelete: (a: Account) => void;
}) {
  const parentAccount = account.parentId
    ? accounts.find((a) => a.id === account.parentId)
    : null;

  const children = accounts.filter((a) => a.parentId === account.id);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed top-0 right-0 h-full w-full max-w-[520px] bg-background border-l border-border shadow-2xl z-50 flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Account Detail</p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(account)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(account)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
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
            <span className={cn("px-3 py-1 rounded-full text-xs font-semibold capitalize shrink-0", TYPE_BG[account.accountType])}>
              {TYPE_LABELS[account.accountType]}
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
              { label: "Account Type",   value: TYPE_LABELS[account.accountType] },
              { label: "Status",         value: account.isActive ? "Active" : "Inactive" },
              { label: "Parent Account", value: parentAccount
                  ? `${parentAccount.accountNumber} — ${parentAccount.name}`
                  : "Root Account" },
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
                {children.map((child) => (
                  <div key={child.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono text-xs text-muted-foreground">{child.accountNumber}</span>
                      <span className="text-sm">{child.name}</span>
                    </div>
                    <span className={cn("text-sm font-semibold", TYPE_COLORS[child.accountType])}>
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

// ── Account Form Modal ─────────────────────────────────────────────────────────

function AccountFormModal({
  accounts,
  editAccount,
  onClose,
}: {
  accounts: Account[];
  editAccount: Account | null;
  onClose: () => void;
}) {
  const createMutation = useCreateAccount();
  const updateMutation = useUpdateAccount();
  const isEdit = Boolean(editAccount);

  const [form, setForm] = React.useState<CreateAccountRequest>({
    accountNumber: editAccount?.accountNumber ?? "",
    name:          editAccount?.name ?? "",
    accountType:   editAccount?.accountType ?? "asset",
    description:   editAccount?.description ?? "",
    parentId:      editAccount?.parentId ?? null,
    isActive:      editAccount?.isActive ?? true,
  });

  const set = (k: keyof typeof form, v: unknown) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit && editAccount) {
      await updateMutation.mutateAsync({ id: editAccount.id, data: form });
      toast.success("Account updated.");
    } else {
      await createMutation.mutateAsync(form);
      toast.success("Account created.");
    }
    onClose();
  };

  const busy = createMutation.isPending || updateMutation.isPending;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-base font-bold">{isEdit ? "Edit Account" : "New Account"}</h2>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Account Number *</label>
                <Input
                  placeholder="e.g. 1001"
                  value={form.accountNumber}
                  onChange={(e) => set("accountNumber", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type *</label>
                <select
                  value={form.accountType}
                  onChange={(e) => set("accountType", e.target.value as AccountType)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  required
                >
                  {ALL_TYPES.map((t) => (
                    <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Account Name *</label>
              <Input
                placeholder="e.g. Cash on Hand"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Parent Account</label>
              <select
                value={form.parentId ?? ""}
                onChange={(e) => set("parentId", e.target.value || null)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— Root Account —</option>
                {accounts
                  .filter((a) => a.id !== editAccount?.id)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.accountNumber} — {a.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
              <Input
                placeholder="Optional description"
                value={form.description ?? ""}
                onChange={(e) => set("description", e.target.value || null)}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive ?? true}
                onChange={(e) => set("isActive", e.target.checked)}
                className="h-4 w-4 rounded border border-input"
              />
              <label htmlFor="isActive" className="text-sm">Active</label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : isEdit ? "Save Changes" : "Create Account"}
              </Button>
            </div>
          </form>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Main View ──────────────────────────────────────────────────────────────────

export function AccountingView() {
  const { data: accounts = [] } = useAccounts();
  const { data: accountingSummary } = useAccountingSummary();
  const deleteMutation = useDeleteAccount();

  const STAT_CARDS = [
    { label: "Total Assets",       value: accountingSummary?.totalAssets      ?? 0, color: "text-success",     icon: TrendingUp,   bg: "bg-success/10" },
    { label: "Total Liabilities",  value: accountingSummary?.totalLiabilities ?? 0, color: "text-destructive", icon: TrendingDown,  bg: "bg-destructive/10" },
    { label: "Equity",             value: accountingSummary?.totalEquity      ?? 0, color: "text-primary",     icon: Scale,         bg: "bg-primary/10" },
    { label: "Revenue YTD",        value: accountingSummary?.totalRevenue     ?? 0, color: "text-success",     icon: TrendingUp,   bg: "bg-success/10" },
    { label: "Expenses YTD",       value: accountingSummary?.totalExpenses    ?? 0, color: "text-destructive", icon: TrendingDown,  bg: "bg-destructive/10" },
    { label: "Net Profit",         value: accountingSummary?.netProfit        ?? 0, color: "text-success",     icon: DollarSign,   bg: "bg-success/10" },
  ];

  const [search, setSearch] = React.useState("");
  const [activeType, setActiveType] = React.useState<AccountType | "all">("all");
  const [selectedAccount, setSelectedAccount] = React.useState<Account | null>(null);
  const [editAccount, setEditAccount] = React.useState<Account | null>(null);
  const [showForm, setShowForm] = React.useState(false);

  const filtered = React.useMemo(() => {
    return accounts.filter((a) => {
      const matchType = activeType === "all" || a.accountType === activeType;
      const matchSearch =
        !search ||
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.accountNumber.includes(search);
      return matchType && matchSearch;
    });
  }, [accounts, search, activeType]);

  const grouped = React.useMemo(() => {
    const groups: Partial<Record<AccountType, Account[]>> = {};
    for (const a of filtered) {
      if (!groups[a.accountType]) groups[a.accountType] = [];
      groups[a.accountType]!.push(a);
    }
    return groups;
  }, [filtered]);

  const subtotals = React.useMemo(() => {
    const result: Partial<Record<AccountType, number>> = {};
    for (const type of ALL_TYPES) {
      result[type] = (grouped[type] ?? []).reduce((s, a) => s + a.balance, 0);
    }
    return result;
  }, [grouped]);

  const handleEdit = (a: Account) => {
    setSelectedAccount(null);
    setEditAccount(a);
    setShowForm(true);
  };

  const handleDelete = async (a: Account) => {
    if (!confirm(`Delete "${a.name}" (${a.accountNumber})? This cannot be undone.`)) return;
    try {
      await deleteMutation.mutateAsync(a.id);
      toast.success("Account deleted.");
      setSelectedAccount(null);
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Could not delete account.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Chart of Accounts</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Manage your general ledger accounts and financial structure.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button size="sm" className="gap-2"
            onClick={() => { setEditAccount(null); setShowForm(true); }}>
            <Plus className="h-4 w-4" /> New Account
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAT_CARDS.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-4 space-y-2"
          >
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", ...ALL_TYPES] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize",
                activeType === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {t === "all" ? "All" : TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped Table */}
      <div className="space-y-4">
        {ALL_TYPES.map((type) => {
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
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-24">Code</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Account Name</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">Description</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground w-20">Status</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground w-40">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {typeAccounts.map((account) => (
                    <tr
                      key={account.id}
                      onClick={() => setSelectedAccount(account)}
                      className="border-b border-border/30 last:border-0 hover:bg-muted/20 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {account.accountNumber}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {account.parentId
                          ? <span className="ml-3">{account.name}</span>
                          : account.name}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell max-w-[240px] truncate">
                        {account.description}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          account.isActive
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {account.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className={cn("px-4 py-3 text-right text-sm font-semibold", TYPE_COLORS[account.accountType])}>
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
      </div>

      {/* Detail Drawer */}
      <AnimatePresence>
        {selectedAccount && (
          <AccountDrawer
            account={selectedAccount}
            accounts={accounts}
            onClose={() => setSelectedAccount(null)}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {showForm && (
          <AccountFormModal
            accounts={accounts}
            editAccount={editAccount}
            onClose={() => { setShowForm(false); setEditAccount(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
