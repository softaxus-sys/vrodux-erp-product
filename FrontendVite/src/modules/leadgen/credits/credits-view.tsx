import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, CreditCard, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/auth/can";
import { cn } from "@/lib/utils";
import { formatPrice, type PackDto } from "@/lib/leadgen/leadgen.api";
import { useCheckout, useConfirmPayPal, useLedger, usePacks, usePaymentOptions, usePurchases, useSetLowBalanceAlert, useWallet } from "@/hooks/leadgen/use-leadgen";
import { Banner, EmptyState, ErrorBlock, Field, LeadGenFrame, LoadingBlock, NoAccess, Pager, SELECT, StatTile, StatusPill, TH, formatDateTime, useCanAny } from "../shared/ui";

export function CreditsView() {
  const { t, i18n } = useTranslation("leadgen");
  const qc = useQueryClient();
  const canView = useCanAny(["leadgen.credits.view"]);
  const wallet = useWallet(canView);
  const packs = usePacks(canView);
  const options = usePaymentOptions(canView);
  const purchases = usePurchases(canView);
  const checkout = useCheckout();
  const confirm = useConfirmPayPal();
  const alertSet = useSetLowBalanceAlert();
  const [params, setParams] = useSearchParams();
  const [ledgerType, setLedgerType] = React.useState("");
  const [page, setPage] = React.useState(1);
  const ledger = useLedger({ type: ledgerType || undefined, page, pageSize: 15 }, canView);
  const [alertValue, setAlertValue] = React.useState("");
  const [buying, setBuying] = React.useState<string | null>(null);
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
  const canBuy = (options.data?.stripe || options.data?.payPal) ?? false;
  const buy = (pack: PackDto, provider: "stripe" | "paypal") => {
    setBuying(`${pack.id}:${provider}`);
    checkout.mutate({ packId: pack.id, provider, returnPath: "/lead-generation/credits" },
      { onSuccess: r => { window.location.href = r.url; }, onSettled: () => setBuying(null) });
  };

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

      <section className="space-y-3">
        <h2 className="text-sm font-bold">{t("credits.buyTitle")}</h2>
        {!options.isLoading && !canBuy && <Banner tone="warn">{t("credits.paymentsOff")}</Banner>}
        {packs.isLoading ? <LoadingBlock /> : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {(packs.data ?? []).map(p => (
              <article key={p.id} className={cn("rounded-xl border bg-card p-5 space-y-4 relative", p.badge ? "border-primary/50" : "border-border")}>
                {p.badge && <span className="absolute -top-2.5 start-4 text-[10px] font-bold uppercase tracking-wide bg-primary text-primary-foreground px-2 py-0.5 rounded-full">{p.badge}</span>}
                <div><p className="font-semibold">{p.name}</p><p className="text-3xl font-bold tabular-nums mt-1">{p.credits.toLocaleString(i18n.language)}<span className="text-sm font-medium text-muted-foreground"> {t("credits.creditsUnit")}</span></p></div>
                <div>
                  <p className="text-xl font-semibold">{formatPrice(p.priceMinor, p.currency, i18n.language)}</p>
                  <p className="text-xs text-muted-foreground">{t("credits.perCredit", { price: formatPrice(Math.round(p.priceMinor / p.credits), p.currency, i18n.language) })}</p>
                </div>
                <Can permission="leadgen.credits.create">
                  <div className="space-y-2">
                    {options.data?.stripe && (
                      <Button className="w-full gap-2" disabled={checkout.isPending} onClick={() => buy(p, "stripe")}>
                        {buying === `${p.id}:stripe` ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}{t("credits.payCard")}
                      </Button>
                    )}
                    {options.data?.payPal && (
                      <Button variant="outline" className="w-full gap-2" disabled={checkout.isPending} onClick={() => buy(p, "paypal")}>
                        {buying === `${p.id}:paypal` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}{t("credits.payPayPal")}
                      </Button>
                    )}
                  </div>
                </Can>
              </article>
            ))}
          </div>
        )}
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
