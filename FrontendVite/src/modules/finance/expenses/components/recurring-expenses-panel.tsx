import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Play, Pause, Pencil, Trash2, Zap, Repeat, CalendarClock, Wallet, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { Can, useCan } from "@/components/auth/can";
import type {
  AccountDto, RecurringExpenseDto, RecurringFrequency, RecurringExpensePaidFrom,
} from "@/lib/finance/finance.api";
import {
  useAccounts, useRecurringExpenses, useCreateRecurringExpense, useUpdateRecurringExpense,
  useDeleteRecurringExpense, usePauseRecurringExpense, useResumeRecurringExpense,
  useGenerateRecurringExpenseNow, useRunDueRecurringExpenses,
} from "@/hooks/finance/use-finance";

const CATEGORIES = ["software", "rent", "utilities", "telecom", "insurance", "marketing", "office", "other"] as const;
const FREQUENCIES: RecurringFrequency[] = ["weekly", "monthly", "quarterly", "yearly"];
const PAID_FROM: RecurringExpensePaidFrom[] = ["bank", "card", "cash", "cheque"];

/** What one run costs per month, so templates on different schedules can be added up. */
const MONTHLY_FACTOR: Record<RecurringFrequency, number> = {
  weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12,
};

const today = () => new Date().toISOString().split("T")[0];

const SELECT_CLASS =
  "w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";
const LABEL_CLASS = "text-xs font-semibold text-muted-foreground uppercase tracking-wide";

// ── Form ──────────────────────────────────────────────────────────────────────

function RecurringExpenseForm({ open, editing, onClose }: {
  open: boolean;
  editing: RecurringExpenseDto | null;
  onClose: () => void;
}) {
  const { t } = useTranslation("finance");
  const currency = useCurrency();
  const create = useCreateRecurringExpense();
  const update = useUpdateRecurringExpense();
  const canAutoPost = useCan("finance.expenses.approve");

  const [name, setName]           = React.useState("");
  const [vendor, setVendor]       = React.useState("");
  const [category, setCategory]   = React.useState<string>("software");
  const [amount, setAmount]       = React.useState(0);
  const [paidFrom, setPaidFrom]   = React.useState<RecurringExpensePaidFrom>("bank");
  const [frequency, setFrequency] = React.useState<RecurringFrequency>("monthly");
  const [runDate, setRunDate]     = React.useState(today());
  const [endDate, setEndDate]     = React.useState("");
  const [autoPost, setAutoPost]   = React.useState(false);
  const [reference, setReference] = React.useState("");
  const [notes, setNotes]         = React.useState("");
  // "" = automatic: the ledger account is derived from the category / payment method.
  const [debitAccountId, setDebitAccountId]   = React.useState("");
  const [creditAccountId, setCreditAccountId] = React.useState("");

  const { data: accounts = [] } = useAccounts({ isActive: true });
  const byNumber = (a: AccountDto, b: AccountDto) => a.accountNumber.localeCompare(b.accountNumber);
  const expenseAccounts   = accounts.filter(a => a.accountType === "expense").sort(byNumber);
  const assetAccounts     = accounts.filter(a => a.accountType === "asset").sort(byNumber);
  const liabilityAccounts = accounts.filter(a => a.accountType === "liability").sort(byNumber);
  const accountLabel = (a: AccountDto) => `${a.accountNumber} · ${a.name}`;

  React.useEffect(() => {
    if (!open) return;
    setName(editing?.templateName ?? "");
    setVendor(editing?.vendor ?? "");
    setCategory(editing?.category ?? "software");
    setAmount(editing?.amount ?? 0);
    setPaidFrom(editing?.paymentMethod ?? "bank");
    setFrequency(editing?.frequency ?? "monthly");
    setRunDate(editing?.nextRunDate ?? today());
    setEndDate(editing?.endDate ?? "");
    setAutoPost(editing?.autoPost ?? false);
    setReference(editing?.reference ?? "");
    setNotes(editing?.notes ?? "");
    setDebitAccountId(editing?.expenseAccountId ?? "");
    setCreditAccountId(editing?.paymentAccountId ?? "");
  }, [open, editing]);

  const isPending = create.isPending || update.isPending;
  const valid = name.trim().length > 0 && amount > 0 && !!runDate;

  // A stored category outside the standard list (set through the API) must stay selectable, or
  // saving the form would silently change it.
  const categoryOptions = (CATEGORIES as readonly string[]).includes(category)
    ? CATEGORIES : [...CATEGORIES, category];

  const handleSave = async () => {
    const fields = {
      templateName:  name.trim(),
      category,
      amount,
      vendor:        vendor.trim() || undefined,
      paymentMethod: paidFrom,
      frequency,
      endDate:       endDate || undefined,
      autoPost,
      reference:     reference.trim() || undefined,
      notes:         notes.trim() || undefined,
      // null, not omitted: on an edit, switching back to "Automatic" has to clear the stored account.
      expenseAccountId: debitAccountId || null,
      paymentAccountId: creditAccountId || null,
    };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, data: { ...fields, nextRunDate: runDate } });
      else         await create.mutateAsync({ ...fields, startDate: runDate });
      onClose();
    } catch {
      // The hook's onError shows the toast; the drawer stays open for a retry.
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed end-0 top-0 h-full w-full max-w-lg bg-card border-s border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {editing ? t("expenses.recurring.form.editTitle") : t("expenses.recurring.form.newTitle")}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("expenses.recurring.form.subtitle")}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-1.5">
                <label className={LABEL_CLASS}>{t("expenses.recurring.form.name")}</label>
                <Input value={name} onChange={e => setName(e.target.value)}
                  placeholder={t("expenses.recurring.form.namePh")} className="h-9 text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={LABEL_CLASS}>{t("expenses.recurring.form.vendor")}</label>
                  <Input value={vendor} onChange={e => setVendor(e.target.value)}
                    placeholder={t("expenses.recurring.form.vendorPh")} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL_CLASS}>{t("expenses.recurring.form.category")}</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className={SELECT_CLASS}>
                    {categoryOptions.map(c => (
                      <option key={c} value={c}>{t(`expenses.recurring.category.${c}`, { defaultValue: c })}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL_CLASS}>{t("expenses.recurring.form.amount")} ({currency})</label>
                  <Input type="number" min={0} step={0.01} value={amount || ""}
                    onChange={e => setAmount(+e.target.value)} placeholder="0.00" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL_CLASS}>{t("expenses.recurring.form.paidFrom")}</label>
                  <select value={paidFrom} onChange={e => setPaidFrom(e.target.value as RecurringExpensePaidFrom)} className={SELECT_CLASS}>
                    {PAID_FROM.map(m => <option key={m} value={m}>{t(`expenses.recurring.paidFrom.${m}`)}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL_CLASS}>{t("expenses.recurring.form.frequency")}</label>
                  <select value={frequency} onChange={e => setFrequency(e.target.value as RecurringFrequency)} className={SELECT_CLASS}>
                    {FREQUENCIES.map(f => <option key={f} value={f}>{t(`expenses.recurring.frequency.${f}`)}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL_CLASS}>
                    {editing ? t("expenses.recurring.form.nextRun") : t("expenses.recurring.form.firstRun")}
                  </label>
                  <Input type="date" value={runDate} onChange={e => setRunDate(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL_CLASS}>
                    {t("expenses.recurring.form.endDate")}{" "}
                    <span className="text-muted-foreground/60 normal-case font-normal">{t("expenses.form.optional")}</span>
                  </label>
                  <Input type="date" value={endDate} min={runDate} onChange={e => setEndDate(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL_CLASS}>
                    {t("expenses.recurring.form.reference")}{" "}
                    <span className="text-muted-foreground/60 normal-case font-normal">{t("expenses.form.optional")}</span>
                  </label>
                  <Input value={reference} onChange={e => setReference(e.target.value)}
                    placeholder={t("expenses.recurring.form.referencePh")} className="h-9 text-sm" />
                </div>
              </div>

              {/* Ledger accounts */}
              <div className="rounded-xl border border-border p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("expenses.recurring.form.accounts")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("expenses.recurring.form.accountsHint")}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={LABEL_CLASS}>{t("expenses.recurring.form.debitAccount")}</label>
                    <select value={debitAccountId} onChange={e => setDebitAccountId(e.target.value)} className={SELECT_CLASS}>
                      <option value="">{t("expenses.recurring.form.debitAuto")}</option>
                      {expenseAccounts.map(a => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className={LABEL_CLASS}>{t("expenses.recurring.form.creditAccount")}</label>
                    <select value={creditAccountId} onChange={e => setCreditAccountId(e.target.value)} className={SELECT_CLASS}>
                      <option value="">{t("expenses.recurring.form.creditAuto")}</option>
                      {assetAccounts.length > 0 && (
                        <optgroup label={t("expenses.recurring.form.groupAssets")}>
                          {assetAccounts.map(a => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
                        </optgroup>
                      )}
                      {liabilityAccounts.length > 0 && (
                        <optgroup label={t("expenses.recurring.form.groupLiabilities")}>
                          {liabilityAccounts.map(a => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
                        </optgroup>
                      )}
                    </select>
                  </div>
                </div>
              </div>

              {/* Auto-post switch */}
              <button
                type="button"
                role="switch"
                aria-checked={autoPost}
                disabled={!canAutoPost}
                onClick={() => setAutoPost(v => !v)}
                className={cn(
                  "w-full text-start rounded-xl border p-4 flex items-start gap-3 transition-colors",
                  autoPost ? "border-primary/40 bg-primary/5" : "border-border bg-muted/20",
                  !canAutoPost && "opacity-60 cursor-not-allowed",
                )}
              >
                <span className={cn(
                  "mt-0.5 relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
                  autoPost ? "bg-primary" : "bg-muted-foreground/30",
                )}>
                  <span className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
                    autoPost ? "start-[18px]" : "start-0.5",
                  )} />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Zap className="h-3.5 w-3.5 text-primary" /> {t("expenses.recurring.form.autoPost")}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-1">
                    {autoPost ? t("expenses.recurring.form.autoPostOn") : t("expenses.recurring.form.autoPostOff")}
                  </span>
                  {!canAutoPost && (
                    <span className="block text-xs text-warning mt-1">{t("expenses.recurring.form.autoPostNeedsApprove")}</span>
                  )}
                </span>
              </button>

              <div className="space-y-1.5">
                <label className={LABEL_CLASS}>
                  {t("expenses.recurring.form.notes")}{" "}
                  <span className="text-muted-foreground/60 normal-case font-normal">{t("expenses.form.optional")}</span>
                </label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-2 justify-end shrink-0">
              <Button variant="outline" onClick={onClose} disabled={isPending}>{t("common:action.cancel")}</Button>
              <Button onClick={handleSave} disabled={isPending || !valid}>
                {isPending ? t("common:action.saving") : t("expenses.recurring.form.save")}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function RecurringExpensesPanel() {
  const { t } = useTranslation("finance");
  const currency = useCurrency();
  const { data: templates = [], isLoading, isError, error, refetch } = useRecurringExpenses();

  const pause    = usePauseRecurringExpense();
  const resume   = useResumeRecurringExpense();
  const remove   = useDeleteRecurringExpense();
  const generate = useGenerateRecurringExpenseNow();
  const runDue   = useRunDueRecurringExpenses();

  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing]   = React.useState<RecurringExpenseDto | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<RecurringExpenseDto | null>(null);

  const active = templates.filter(r => r.isActive);
  const monthlyCost = active.reduce((sum, r) => sum + r.amount * (MONTHLY_FACTOR[r.frequency] ?? 1), 0);
  const dueNow = active.filter(r => r.nextRunDate <= today()).length;

  const openNew  = () => { setEditing(null); setShowForm(true); };
  const openEdit = (r: RecurringExpenseDto) => { setEditing(r); setShowForm(true); };

  const stats = [
    { label: t("expenses.recurring.stat.active"),      value: String(active.length),                 icon: Repeat },
    { label: t("expenses.recurring.stat.monthlyCost"), value: formatCurrency(monthlyCost, currency), icon: Wallet },
    { label: t("expenses.recurring.stat.dueNow"),      value: String(dueNow),                        icon: CalendarClock },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-xl">{t("expenses.recurring.intro")}</p>
        <div className="flex items-center gap-2">
          <Can permission="finance.expenses.create">
            <Button variant="outline" size="sm" className="gap-2" disabled={runDue.isPending || dueNow === 0}
              onClick={() => runDue.mutate(undefined)}>
              <RefreshCw className={cn("h-4 w-4", runDue.isPending && "animate-spin")} />
              {t("expenses.recurring.runDue")}
            </Button>
            <Button size="sm" className="gap-2" onClick={openNew}>
              <Plus className="h-4 w-4" /> {t("expenses.recurring.new")}
            </Button>
          </Can>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <s.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{s.label}</p>
              <p className="font-bold truncate" title={s.value}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="text-start px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("expenses.recurring.table.name")}</th>
              <th className="text-start px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">{t("expenses.recurring.table.schedule")}</th>
              <th className="text-start px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">{t("expenses.recurring.table.nextRun")}</th>
              <th className="text-end px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("expenses.recurring.table.amount")}</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("expenses.recurring.table.mode")}</th>
              <th className="text-end px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t("expenses.recurring.table.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">{t("expenses.recurring.loading")}</td></tr>
            ) : isError ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm">
                  <p className="text-destructive">{(error as Error)?.message ?? t("expenses.recurring.loadError")}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>{t("expenses.recurring.retry")}</Button>
                </td>
              </tr>
            ) : templates.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">{t("expenses.recurring.empty")}</td></tr>
            ) : templates.map(r => (
              <tr key={r.id} className={cn("border-b border-border/30 last:border-0", !r.isActive && "opacity-60")}>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium">{r.templateName}</p>
                  <p className="text-xs text-muted-foreground">
                    {[r.vendor, t(`expenses.recurring.category.${r.category}`, { defaultValue: r.category })].filter(Boolean).join(" · ")}
                  </p>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                  {t(`expenses.recurring.frequency.${r.frequency}`, { defaultValue: r.frequency })}
                  <span className="block text-xs">{t("expenses.recurring.table.generated", { count: r.generatedCount })}</span>
                </td>
                <td className="px-4 py-3 text-sm hidden sm:table-cell">
                  {r.isActive
                    ? <span className={cn(r.nextRunDate <= today() && "text-warning font-medium")}>{formatDate(r.nextRunDate, "medium")}</span>
                    : <span className="text-xs text-muted-foreground">{t("expenses.recurring.paused")}</span>}
                </td>
                <td className="px-4 py-3 text-end text-sm font-semibold">{formatCurrency(r.amount, currency)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap",
                    r.autoPost ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning",
                  )}>
                    {r.autoPost && <Zap className="h-3 w-3" />}
                    {r.autoPost ? t("expenses.recurring.mode.autoPost") : t("expenses.recurring.mode.review")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Can permission="finance.expenses.create">
                      <button title={t("expenses.recurring.action.generate")} aria-label={t("expenses.recurring.action.generate")}
                        disabled={generate.isPending} onClick={() => generate.mutate(r.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-50">
                        <Zap className="h-3.5 w-3.5" />
                      </button>
                    </Can>
                    <Can permission="finance.expenses.edit">
                      {r.isActive ? (
                        <button title={t("expenses.recurring.action.pause")} aria-label={t("expenses.recurring.action.pause")}
                          disabled={pause.isPending} onClick={() => pause.mutate(r.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50">
                          <Pause className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button title={t("expenses.recurring.action.resume")} aria-label={t("expenses.recurring.action.resume")}
                          disabled={resume.isPending} onClick={() => resume.mutate(r.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:bg-success/10 hover:text-success transition-colors disabled:opacity-50">
                          <Play className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button title={t("expenses.recurring.action.edit")} aria-label={t("expenses.recurring.action.edit")}
                        onClick={() => openEdit(r)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </Can>
                    <Can permission="finance.expenses.delete">
                      <button title={t("expenses.recurring.action.delete")} aria-label={t("expenses.recurring.action.delete")}
                        onClick={() => setPendingDelete(r)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </Can>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RecurringExpenseForm open={showForm} editing={editing} onClose={() => setShowForm(false)} />

      <AnimatePresence>
        {pendingDelete && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setPendingDelete(null)}
          >
            <motion.div
              className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4"
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
            >
              <div>
                <h3 className="font-bold">{t("expenses.recurring.delete.title")}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("expenses.recurring.delete.body", { name: pendingDelete.templateName })}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setPendingDelete(null)}>{t("common:action.cancel")}</Button>
                <Button variant="destructive" size="sm" disabled={remove.isPending}
                  onClick={() => remove.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) })}>
                  {t("expenses.recurring.delete.confirm")}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
