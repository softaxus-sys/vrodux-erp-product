import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, CheckCircle2, AlertCircle, Link2, Search, Plus,
  Pencil, Trash2, Loader2, Mail, Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";
import { useFinanceCustomers, useDeleteFinanceCustomer } from "@/hooks/finance/use-finance";
import type { FinanceCustomerDto } from "@/lib/finance/finance.api";
import { Can } from "@/components/auth/can";
import { useLazyList } from "@/hooks/use-lazy-list";
import { CustomerForm } from "./customer-form";

export function FinanceCustomersView() {
  const { t } = useTranslation("finance");
  const [search, setSearch]           = React.useState("");
  const [activeFilter, setActiveFilter] = React.useState<"" | "active" | "inactive">("");
  const [showForm, setShowForm]       = React.useState(false);
  const [editing, setEditing]         = React.useState<FinanceCustomerDto | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<FinanceCustomerDto | null>(null);

  // Debounced so each keystroke doesn't fire a request.
  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const { data, isLoading } = useFinanceCustomers({
    search:   debounced || undefined,
    isActive: activeFilter === "" ? undefined : activeFilter === "active",
  });
  const remove = useDeleteFinanceCustomer();

  const items = React.useMemo(
    () => [...(data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [data]);

  const { visible, hasMore, loadMore, sentinelRef, shown, total } = useLazyList(items, 25);

  const stats = React.useMemo(() => ({
    total:    items.length,
    active:   items.filter(s => s.isActive).length,
    inactive: items.filter(s => !s.isActive).length,
    linked:   items.filter(s => !!s.accountId).length,
  }), [items]);

  const STAT_CARDS = [
    { label: t("customers.stats.total"),    value: stats.total,    icon: Building2,    color: "text-slate-600",        bg: "bg-slate-100 dark:bg-slate-800/50" },
    { label: t("customers.stats.active"),   value: stats.active,   icon: CheckCircle2, color: "text-success",          bg: "bg-success/10" },
    { label: t("customers.stats.inactive"), value: stats.inactive, icon: AlertCircle,  color: "text-muted-foreground", bg: "bg-muted" },
    { label: t("customers.stats.linked"),   value: stats.linked,   icon: Link2,        color: "text-primary",          bg: "bg-primary/10" },
  ];

  const FILTERS: { key: "" | "active" | "inactive"; label: string }[] = [
    { key: "",         label: t("customers.filters.all") },
    { key: "active",   label: t("customers.filters.active") },
    { key: "inactive", label: t("customers.filters.inactive") },
  ];

  const openCreate = () => { setEditing(null); setShowForm(true); };
  const openEdit   = (c: FinanceCustomerDto) => { setEditing(c); setShowForm(true); };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    remove.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("customers.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("customers.subtitle")}</p>
        </div>
        <Can permission="finance.invoicing.create">
          <Button className="gap-2 h-9 shrink-0" onClick={openCreate}>
            <Plus className="h-4 w-4" />{t("customers.new")}
          </Button>
        </Can>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STAT_CARDS.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", card.bg)}>
                <Icon className={cn("h-5 w-5", card.color)} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="font-bold text-lg leading-tight">{card.value}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input placeholder={t("customers.searchPh")} value={search}
            onChange={e => setSearch(e.target.value)} className="ps-9 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setActiveFilter(f.key)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                activeFilter === f.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">{t("customers.loading")}</span>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-start px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("customers.table.name")}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">{t("customers.table.contact")}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">{t("customers.table.account")}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("customers.table.status")}</th>
                <th className="text-end px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-24">{t("customers.table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <p className="text-sm text-muted-foreground">
                      {debounced || activeFilter ? t("customers.empty.filtered") : t("customers.empty.none")}
                    </p>
                    {!debounced && !activeFilter && (
                      <Can permission="finance.invoicing.create">
                        <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={openCreate}>
                          <Plus className="h-3.5 w-3.5" />{t("customers.new")}
                        </Button>
                      </Can>
                    )}
                  </td>
                </tr>
              ) : visible.map((s, i) => (
                <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 12) * 0.03 }}
                  className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">{getInitials(s.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{s.code || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    {s.email
                      ? <a href={`mailto:${s.email}`} className="text-sm hover:text-primary inline-flex items-center gap-1.5">
                          <Mail className="h-3 w-3 text-muted-foreground shrink-0" />{s.email}
                        </a>
                      : <span className="text-sm text-muted-foreground">—</span>}
                    {s.phone && (
                      <div className="mt-0.5">
                        <a href={`tel:${s.phone}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
                          <Phone className="h-3 w-3 shrink-0" />{s.phone}
                        </a>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    {s.accountId
                      ? <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{s.accountNumber} — {s.accountName}</span>
                      : <span className="text-xs text-muted-foreground">{t("customers.table.noAccount")}</span>}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold",
                      s.isActive ? "text-success bg-success/10" : "text-muted-foreground bg-muted")}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", s.isActive ? "bg-success" : "bg-muted-foreground")} />
                      {s.isActive ? t("customers.filters.active") : t("customers.filters.inactive")}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <Can permission="finance.invoicing.edit">
                        <button onClick={() => openEdit(s)} title={t("customers.actions.edit")}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </Can>
                      <Can permission="finance.invoicing.delete">
                        <button onClick={() => setPendingDelete(s)} title={t("customers.actions.delete")}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </Can>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>

          {hasMore && (
            <div ref={sentinelRef} className="flex items-center justify-center py-4 border-t border-border/40">
              <Button variant="outline" size="sm" className="h-8" onClick={loadMore}>
                {t("customers.loadMore")}
              </Button>
            </div>
          )}
          {total > 0 && (
            <div className="px-4 py-2.5 border-t border-border/40 bg-muted/20">
              <p className="text-[11px] text-muted-foreground">{t("customers.showing", { shown, total })}</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Delete confirmation — never window.confirm */}
      <AnimatePresence>
        {pendingDelete && (
          <>
            <motion.div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !remove.isPending && setPendingDelete(null)} />
            <motion.div
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-6"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                  <Trash2 className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h3 className="font-bold text-base">{t("customers.delete.title")}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("customers.delete.body", { name: pendingDelete.name })}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={remove.isPending}>
                  {t("customers.form.cancel")}
                </Button>
                <Button variant="destructive" onClick={confirmDelete} disabled={remove.isPending}>
                  {remove.isPending
                    ? <><Loader2 className="w-3.5 h-3.5 me-1 animate-spin" />{t("customers.delete.removing")}</>
                    : t("customers.delete.confirm")}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <CustomerForm open={showForm} onClose={() => { setShowForm(false); setEditing(null); }} customer={editing} />
    </div>
  );
}
