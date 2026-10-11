import * as React from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { financeApi } from "@/lib/finance/finance.api";
import {
  buildProductionJournal, defaultPostingAccounts, usePostOrdersToFinance, type PostingAccounts,
} from "@/hooks/manufacturing/use-manufacturing-links";
import type { ProductionOrderDto } from "@/lib/manufacturing/manufacturing.api";

const LABEL  = "text-xs font-semibold text-muted-foreground uppercase tracking-wide";
const SELECT = "w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";

/**
 * Posts completed orders' cost to the ledger — one journal entry per order. The accounts are
 * always shown and confirmed: a chart of accounts is the tenant's own, so guessing silently
 * would put production cost in the wrong place.
 */
export function PostToFinanceModal({ orders, onClose }: { orders: ProductionOrderDto[]; onClose: () => void }) {
  const { t } = useTranslation("manufacturing");
  const currency = useCurrency();
  const post = usePostOrdersToFinance();
  const { data: accounts = [], isLoading, isError, error } = useQuery({
    queryKey: ["finance", "accounts", "active-for-production"],
    queryFn: () => financeApi.getAccounts({ isActive: true }),
    staleTime: 5 * 60 * 1000,
  });

  const [picked, setPicked] = React.useState<PostingAccounts>({ finishedGoodsId: "", materialsId: "", absorbedId: "", scrapId: "" });
  React.useEffect(() => { if (accounts.length > 0) setPicked(defaultPostingAccounts(accounts)); }, [accounts]);

  const sum = (f: (o: ProductionOrderDto) => number) => orders.reduce((s, o) => s + f(o), 0);
  const material   = sum(o => o.materialCost);
  const conversion = sum(o => o.labourCost + o.overheadCost);
  const scrap      = sum(o => o.scrapCost ?? 0);
  const goods      = sum(o => o.totalCost) - scrap;

  // Preview: the per-order entries added up by account.
  const preview = React.useMemo(() => {
    const byAccount = new Map<string, { name: string; debit: number; credit: number }>();
    let postable = 0;
    for (const order of orders) {
      const journal = buildProductionJournal(order, accounts, picked);
      if (!journal) continue;
      postable++;
      for (const l of journal.lines) {
        const row = byAccount.get(l.accountId) ?? { name: l.accountName, debit: 0, credit: 0 };
        row.debit += l.debitAmount; row.credit += l.creditAmount;
        byAccount.set(l.accountId, row);
      }
    }
    return { rows: [...byAccount.entries()], postable };
  }, [orders, accounts, picked]);

  const ready = !!picked.finishedGoodsId && !!picked.materialsId
    && (conversion <= 0 || !!picked.absorbedId) && (scrap <= 0 || !!picked.scrapId) && preview.postable > 0;

  const pick = (label: string, key: keyof PostingAccounts, hint: string) => (
    <div className="space-y-1.5">
      <label className={LABEL}>{label}</label>
      <select value={picked[key]} onChange={e => setPicked(p => ({ ...p, [key]: e.target.value }))} className={SELECT}>
        <option value="">{t("finance.chooseAccount")}</option>
        {accounts.map(a => <option key={a.id} value={a.id}>{a.accountNumber} — {a.name}</option>)}
      </select>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="fixed left-1/2 top-16 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-lg max-h-[calc(100vh-5rem)] overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">{t("finance.title")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {orders.length === 1 ? t("finance.subtitle", { number: orders[0].orderNumber }) : t("finance.subtitleMany", { n: orders.length })}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground" aria-label={t("action.close")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline me-2" />{t("loading")}</div>
        ) : isError ? (
          <div className="py-8 text-center text-sm text-destructive">{(error as Error)?.message}</div>
        ) : (
          <>
            {pick(t("finance.finishedGoods"), "finishedGoodsId", t("finance.finishedGoodsHint", { amount: formatCurrency(goods, currency) }))}
            {pick(t("finance.materials"), "materialsId", t("finance.materialsHint", { amount: formatCurrency(material, currency) }))}
            {conversion > 0 && pick(t("finance.absorbed"), "absorbedId", t("finance.absorbedHint", { amount: formatCurrency(conversion, currency) }))}
            {scrap > 0 && pick(t("finance.scrap"), "scrapId", t("finance.scrapHint", { amount: formatCurrency(scrap, currency) }))}

            {preview.rows.length > 0 ? (
              <div className="rounded-lg border border-border divide-y divide-border text-sm">
                {preview.rows.map(([id, r]) => (
                  <div key={id} className="flex items-center justify-between px-3 py-2 gap-3">
                    <span className="truncate">{r.name}</span>
                    <span className="tabular-nums shrink-0">
                      {r.debit > 0 && t("finance.debit", { amount: formatCurrency(r.debit, currency) })}
                      {r.debit > 0 && r.credit > 0 && " · "}
                      {r.credit > 0 && t("finance.credit", { amount: formatCurrency(r.credit, currency) })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              picked.finishedGoodsId && picked.materialsId && (
                <p className="text-xs text-amber-600">{t("finance.nothingToPost")}</p>
              )
            )}
            <p className="text-[11px] text-muted-foreground">{t("finance.draftNote")}</p>
          </>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose} disabled={post.isPending}>{t("action.cancel")}</Button>
          <Button size="sm" className="gap-1.5" disabled={!ready || post.isPending}
            onClick={() => post.mutate({ orders, accounts, picked }, { onSuccess: onClose })}>
            {post.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {orders.length === 1 ? t("finance.post") : t("finance.postMany", { n: preview.postable })}
          </Button>
        </div>
      </motion.div>
    </>
  );
}
