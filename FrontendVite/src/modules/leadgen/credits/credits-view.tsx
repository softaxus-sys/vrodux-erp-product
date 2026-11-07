import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, CreditCard, ExternalLink, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/auth/can";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/leadgen/leadgen.api";
import { useAuthStore } from "@/store/auth.store";
import { useConfirmPayPal, useLedger, usePurchases, useSetLowBalanceAlert, useWallet } from "@/hooks/leadgen/use-leadgen";
import { Banner, EmptyState, ErrorBlock, Field, LeadGenFrame, LoadingBlock, NoAccess, Pager, SELECT, StatTile, StatusPill, TH, formatDateTime, useCanAny } from "../shared/ui";

export function CreditsView() {
  const { t, i18n } = useTranslation("leadgen");
  const qc = useQueryClient();
  const canView = useCanAny(["leadgen.credits.view"]);
  const wallet = useWallet(canView);
  const canOpenBilling = useAuthStore(st => st.hasRawPermission)("settings.billing.view");
  const purchases = usePurchases(canView);
  const confirm = useConfirmPayPal();
  const alertSet = useSetLowBalanceAlert();
  const [params, setParams] = useSearchParams();
  const [ledgerType, setLedgerType] = React.useState("");
  const [page, setPage] = React.useState(1);
  const ledger = useLedger({ type: ledgerType || undefined, page, pageSize: 15 }, canView);
  const [alertValue, setAlertValue] = React.useState("");
  const handled = React.useRef(false);

  React.useEffect(() => { if (wallet.data) setAlertValue(wallet.data.lowBalanceAlert?.toString() ?? ""); }, [wallet.data?.lowBalanceAlert]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Back from the payment page: the redirect is not proof of payment, so we confirm / poll our own API.
  React.useEffect(() => {
    const status = params.get("status");
    if (!status || handled.current) return;
    handled.current = true;
    const provider = params.get("provider");
    const token = params.get("token");
    const clean = () => { const p = new URLSearchParams(); setParams(p, { replace: true }); };
    const refresh = () => { qc.invalidateQueries({ queryKey: ["leadgen"] }); };

    if (status === "cancelled") { toast.info(t("credits.cancelled")); clean(); return; }
    if (provider === "paypal" && token) {
      confirm.mutate(token, {
        onSuccess: p => { p.status === "paid" ? toast.success(t("credits.paid", { credits: p.credits })) : toast.error(p.failureReason ?? t("credits.notPaid")); refresh(); },
        onSettled: clean,
      });
      return;
    }
    // Stripe: the webhook credits the wallet; poll a few times until it lands.
    toast.info(t("credits.confirming"));
    let tries = 0;
    const timer = window.setInterval(async () => {
      tries++; refresh();
      if (tries >= 8) { window.clearInterval(timer); }
    }, 2500);
    clean();
    return () => window.clearInterval(timer);
  }, [params]);  // eslint-disable-line react-hooks/exhaustive-deps

  if (!canView) return <LeadGenFrame title={t("credits.title")}><NoAccess permission="leadgen.credits.view" /></LeadGenFrame>;

  const w = wallet.data;
  return (
    <LeadGenFrame title={t("credits.title")} description={t("credits.description")}>
      {wallet.isLoading ? <LoadingBlock /> : wallet.error ? <ErrorBlock error={wallet.error as Error} onRetry={() => wallet.refetch()} /> : w && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile label={t("credits.balance")} value={w.balance.toLocaleString(i18n.language)} tone={w.balance === 0 ? "bad" : w.lowBalanceAlert != null && w.balance <= w.lowBalanceAlert ? "warn" : undefined} hint={t("credits.revealCost", { cost: w.revealCost })} />
            <StatTile label={t("credits.purchased")} value={w.lifetimePurchased.toLocaleString(i18n.language)} />
            <StatTile label={t("credits.spent")} value={w.lifetimeSpent.toLocaleString(i18n.language)} />
            <StatTile label={t("credits.refunded")} value={w.lifetimeRefunded.toLocaleString(i18n.language)} hint={t("credits.refundHint")} />
          </div>
          <p className="text-xs text-muted-foreground">{t("credits.howItWorks", { cost: w.revealCost, bonus: w.verifiedEmailBonus })}</p>
        </>
      )}

      <section className="rounded-xl border border-border bg-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold">{t("credits.buyMovedTitle")}</h2>
          <p className="text-xs text-muted-foreground mt-1">{t("credits.buyMovedBody")}</p>
        </div>
        {canOpenBilling
          ? <Button asChild className="gap-2"><Link to="/settings/billing"><ExternalLink className="h-4 w-4" />{t("credits.openBilling")}</Link></Button>
          : <p className="text-xs text-muted-foreground">{t("credits.askBillingAdmin")}</p>}
      </section>

      <Can permission="leadgen.credits.edit">
        <section className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-end gap-3">
          <Field label={t("credits.alertLabel")} hint={t("credits.alertHint")} className="w-64">
            <Input type="number" min={0} value={alertValue} placeholder={t("credits.alertOff")} onChange={e => setAlertValue(e.target.value)} />
          </Field>
          <Button variant="outline" disabled={alertSet.isPending} onClick={() => alertSet.mutate(alertValue === "" ? null : Math.max(0, parseInt(alertValue, 10) || 0))}>{t("action.save")}</Button>
        </section>
      </Can>

      <div className="grid lg:grid-cols-2 gap-5">
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold">{t("credits.ledgerTitle")}</h2>
            <select className={cn(SELECT, "w-40")} value={ledgerType} onChange={e => { setLedgerType(e.target.value); setPage(1); }}>
              <option value="">{t("credits.allTypes")}</option>
              {["grant", "purchase", "spend", "refund", "adjustment"].map(x => <option key={x} value={x}>{t(`credits.type.${x}`)}</option>)}
            </select>
          </div>
          {ledger.isLoading ? <LoadingBlock /> : (ledger.data?.items.length ?? 0) === 0 ? <EmptyState icon={Wallet} title={t("credits.ledgerEmpty")} /> : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className={TH}>{t("credits.col.date")}</th><th className={TH}>{t("credits.col.what")}</th><th className={cn(TH, "text-end")}>{t("credits.col.amount")}</th><th className={cn(TH, "text-end")}>{t("credits.col.balance")}</th></tr></thead>
                  <tbody>
                    {ledger.data!.items.map(e => (
                      <tr key={e.id} className="border-t border-border">
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(e.createdAt, i18n.language)}</td>
                        <td className="px-4 py-2.5"><p className="line-clamp-1">{e.reason}</p><p className="text-[11px] text-muted-foreground">{t(`credits.type.${e.type}`)}{e.actorName ? ` · ${e.actorName}` : ""}</p></td>
                        <td className={cn("px-4 py-2.5 text-end tabular-nums font-semibold", e.amount > 0 ? "text-success" : "text-foreground")}>{e.amount > 0 ? "+" : ""}{e.amount}</td>
                        <td className="px-4 py-2.5 text-end tabular-nums text-muted-foreground">{e.balanceAfter}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager page={page} pageSize={15} total={ledger.data!.total} onPage={setPage} />
            </>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border"><h2 className="text-sm font-bold">{t("credits.purchasesTitle")}</h2></div>
          {purchases.isLoading ? <LoadingBlock /> : (purchases.data?.length ?? 0) === 0 ? <EmptyState icon={CreditCard} title={t("credits.purchasesEmpty")} /> : (
            <ul className="divide-y divide-border">
              {purchases.data!.map(p => (
                <li key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.packName} · {p.credits.toLocaleString(i18n.language)} {t("credits.creditsUnit")}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDateTime(p.paidAt ?? p.createdAt, i18n.language)} · {p.provider}{p.failureReason ? ` · ${p.failureReason}` : ""}</p>
                  </div>
                  <div className="text-end shrink-0">
                    <p className="text-sm font-semibold tabular-nums">{formatPrice(p.amountMinor, p.currency, i18n.language)}</p>
                    <StatusPill status={p.status} label={t(`credits.purchaseStatus.${p.status}`)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {w?.trialGranted && <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Check className="h-3 w-3" />{t("credits.trialGranted")}</p>}
    </LeadGenFrame>
  );
}
