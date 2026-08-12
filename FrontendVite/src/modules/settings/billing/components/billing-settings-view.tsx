import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard, Check, Loader2, AlertTriangle, Users, Calendar,
  ExternalLink, ShieldCheck, Sparkles, Receipt, X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import {
  useBillingOverview, useBillingInvoices, useStartCheckout,
  useBillingPortal, useCancelSubscription, useStartTrial,
} from "@/hooks/billing/use-billing";
import { formatUsd } from "@/lib/billing/plans";
import type { PaymentProviderName, PlanOptionDto } from "@/lib/billing/billing.api";

type Period = "Monthly" | "Annual";

/** Amount charged per cycle for a tier at a given cadence. */
function cycleAmount(plan: PlanOptionDto, period: Period): number | null {
  return period === "Annual" ? plan.annualUsdTotal : plan.monthlyUsd;
}

function savingPct(plan: PlanOptionDto): number | null {
  if (plan.monthlyUsd === null || plan.annualUsdPerMonth === null) return null;
  return Math.round((1 - plan.annualUsdPerMonth / plan.monthlyUsd) * 100);
}

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  Trial:     { label: "Trial",     cls: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  Active:    { label: "Active",    cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  Suspended: { label: "Suspended", cls: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  Expired:   { label: "Expired",   cls: "bg-destructive/10 text-destructive border-destructive/20" },
};

export function BillingSettingsView() {
  const { data: overview, isLoading } = useBillingOverview();
  const { data: invoices } = useBillingInvoices();
  const checkout   = useStartCheckout();
  const portal     = useBillingPortal();
  const cancel     = useCancelSubscription();
  const startTrial = useStartTrial();

  const [period, setPeriod]   = React.useState<Period>("Annual");
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [provider, setProvider] = React.useState<PaymentProviderName | null>(null);

  // Pre-select the cadence and provider the tenant already chose, so the page opens on the
  // choice they've effectively already made.
  React.useEffect(() => {
    if (overview?.subscription) setPeriod(overview.subscription.billingPeriod);
  }, [overview?.subscription]);

  React.useEffect(() => {
    if (!provider && overview?.availableProviders?.length) setProvider(overview.availableProviders[0]);
  }, [overview?.availableProviders, provider]);

  // ── Complete a "Buy Now" signup ────────────────────────────────────────────
  // The user clicked Buy on the pricing page and was sent straight here after signup. Rather than
  // making them re-pick the plan they already chose, open the provider's checkout for it directly.
  // Guarded by a ref so React 18 StrictMode's double-effect can't fire checkout twice, and the
  // marker is cleared before the call so a failed payment doesn't loop on every re-render.
  const autoCheckoutFired = React.useRef(false);
  React.useEffect(() => {
    if (autoCheckoutFired.current) return;
    if (!overview || !provider) return;

    let pending: { plan?: string; billing?: string } | null = null;
    try {
      const raw = sessionStorage.getItem("vrodux.pendingCheckout");
      pending = raw ? JSON.parse(raw) : null;
    } catch { /* ignore */ }
    if (!pending?.plan) return;

    autoCheckoutFired.current = true;
    sessionStorage.removeItem("vrodux.pendingCheckout");

    const wantedPeriod: Period = pending.billing?.toLowerCase() === "monthly" ? "Monthly" : "Annual";
    setPeriod(wantedPeriod);

    // Only auto-launch for a tier that can actually be bought self-serve, and only while the
    // tenant still needs to pay — never re-charge someone who is already active.
    const target = overview.plans.find(
      p => p.id === pending!.plan!.toLowerCase() || p.name.toLowerCase() === pending!.plan!.toLowerCase(),
    );
    if (!target?.selfServe || overview.hasProductAccess) return;

    checkout.mutate({ plan: target.name, billingPeriod: wantedPeriod, provider });
  }, [overview, provider, checkout]);

  if (isLoading || !overview) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const status   = STATUS_STYLES[overview.tenantStatus] ?? { label: overview.tenantStatus, cls: "bg-muted text-muted-foreground border-border" };
  const sub      = overview.subscription;
  const seatPct  = overview.maxUsers > 0 ? Math.min(100, (overview.usersInUse / overview.maxUsers) * 100) : 0;
  const atSeatLimit = overview.maxUsers > 0 && overview.usersInUse >= overview.maxUsers;
  const noProviders = overview.availableProviders.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing &amp; Subscription</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your plan, payment method and invoices
        </p>
      </div>

      {/* Awaiting first payment — a brand-new "Buy Now" signup. Distinct from a lapsed account:
          nothing has "ended", they simply haven't paid yet, so the tone is welcoming. */}
      {overview.tenantStatus === "PendingPayment" && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5 flex items-start gap-3">
            <CreditCard className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-2 flex-1">
              <p className="font-semibold">Complete your purchase to activate {overview.tenantName}</p>
              <p className="text-sm text-muted-foreground">
                Your workspace is ready and waiting — pick your plan below to unlock it.
              </p>
              {overview.canStartTrial && (
                <div className="pt-1">
                  <p className="text-xs text-muted-foreground mb-2">
                    Not ready to pay? You can try Vrodux free for 30 days instead — no card required.
                  </p>
                  <Button variant="outline" size="sm" disabled={startTrial.isPending}
                    onClick={() => startTrial.mutate()}>
                    {startTrial.isPending
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Start 30-day free trial instead</>}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lapsed access — an account that previously worked. Never implies data loss. */}
      {!overview.hasProductAccess && overview.tenantStatus !== "PendingPayment" && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-destructive">
                {overview.tenantStatus === "Suspended" ? "Your account is suspended" : "Your access has ended"}
              </p>
              <p className="text-sm text-muted-foreground">
                All of your data is safe and exactly as you left it — nothing has been deleted.
                Choose a plan below and access returns immediately.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trial countdown */}
      {overview.tenantStatus === "Trial" && overview.trialDaysRemaining !== null && overview.trialDaysRemaining > 0 && (
        <Card className={cn("border", overview.trialDaysRemaining <= 3
          ? "border-amber-500/30 bg-amber-500/5" : "border-blue-500/20 bg-blue-500/5")}>
          <CardContent className="p-5 flex items-start gap-3">
            <Sparkles className={cn("h-5 w-5 shrink-0 mt-0.5",
              overview.trialDaysRemaining <= 3 ? "text-amber-600" : "text-blue-600")} />
            <div>
              <p className="font-semibold">
                {overview.trialDaysRemaining} day{overview.trialDaysRemaining === 1 ? "" : "s"} left in your free trial
              </p>
              <p className="text-sm text-muted-foreground">
                Ends {formatDate(overview.trialEndsAt)}. Subscribe before then to keep working without interruption.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current state */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current plan</p>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-2xl font-bold">{overview.planLabel}</p>
              <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border", status.cls)}>
                {status.label}
              </span>
            </div>
            {sub && (
              <p className="text-xs text-muted-foreground mt-1.5">
                {formatUsd(sub.amount)} / {sub.billingPeriod === "Annual" ? "year" : "month"} · {sub.provider}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Users</p>
            <div className="flex items-baseline gap-1.5 mt-2">
              <Users className="h-4 w-4 text-muted-foreground self-center" />
              <p className="text-2xl font-bold">{overview.usersInUse}</p>
              <p className="text-sm text-muted-foreground">
                / {overview.maxUsers < 0 ? "Unlimited" : overview.maxUsers}
              </p>
            </div>
            {overview.maxUsers > 0 && (
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={cn("h-full rounded-full transition-all",
                    atSeatLimit ? "bg-destructive" : "bg-primary")}
                  style={{ width: `${seatPct}%` }} />
              </div>
            )}
            {atSeatLimit && (
              <p className="text-[11px] text-destructive mt-1.5">
                Seat limit reached — upgrade to add more users.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {sub?.cancelAtPeriodEnd ? "Access until" : "Next renewal"}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <p className="text-lg font-semibold">
                {sub?.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : "—"}
              </p>
            </div>
            {sub?.cancelAtPeriodEnd && (
              <p className="text-[11px] text-amber-600 mt-1.5">
                Cancelled — will not renew.
              </p>
            )}
            {sub?.status === "PastDue" && (
              <p className="text-[11px] text-destructive mt-1.5">
                Last payment failed. Update your card to avoid losing access.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* No provider configured — tell an admin what to do rather than showing dead buttons. */}
      {noProviders && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Online payments aren't configured</p>
              <p className="text-sm text-muted-foreground">
                No payment provider is enabled on this server, so plans can't be purchased here yet.
                Contact us and we'll arrange your subscription directly.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan picker */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Choose a plan</h2>

          <div className="flex items-center gap-3">
            {overview.availableProviders.length > 1 && (
              <select value={provider ?? ""} onChange={e => setProvider(e.target.value as PaymentProviderName)}
                aria-label="Payment provider"
                className="h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                {overview.availableProviders.map(p => <option key={p} value={p}>Pay with {p}</option>)}
              </select>
            )}

            <div className="flex items-center bg-muted rounded-lg p-0.5">
              {(["Monthly", "Annual"] as Period[]).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    period === p ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>
                  {p}
                  {p === "Annual" && <span className="ml-1 text-emerald-600">save ~18%</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {overview.plans.map(plan => {
            const amount  = cycleAmount(plan, period);
            const saving  = savingPct(plan);
            const current = plan.isCurrent;

            return (
              <Card key={plan.id}
                className={cn("relative flex flex-col", current && "border-primary ring-1 ring-primary/30")}>
                {current && (
                  <span className="absolute -top-2 left-4 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                    CURRENT PLAN
                  </span>
                )}
                <CardContent className="p-5 flex flex-col flex-1">
                  <p className="font-semibold">{plan.label}</p>

                  <div className="mt-2 mb-1">
                    {amount === null ? (
                      <p className="text-2xl font-bold">Custom</p>
                    ) : (
                      <>
                        <p className="text-2xl font-bold">
                          {formatUsd(amount)}
                          <span className="text-sm font-normal text-muted-foreground">
                            /{period === "Annual" ? "year" : "month"}
                          </span>
                        </p>
                        {period === "Annual" && plan.annualUsdPerMonth !== null && (
                          <p className="text-xs text-muted-foreground">
                            {formatUsd(plan.annualUsdPerMonth)}/month billed annually
                            {saving !== null && <span className="text-emerald-600"> · save {saving}%</span>}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground mb-4">
                    {plan.maxUsers < 0 ? "Unlimited users" : `Up to ${plan.maxUsers} users`}
                  </p>

                  <div className="mt-auto">
                    {!plan.selfServe ? (
                      <Button variant="outline" className="w-full" asChild>
                        <a href="https://vrodux.com/contact?plan=enterprise" target="_blank" rel="noreferrer">
                          Talk to sales <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                        </a>
                      </Button>
                    ) : current && overview.hasProductAccess && sub?.status === "Active" ? (
                      <Button variant="outline" className="w-full" disabled>
                        <Check className="h-3.5 w-3.5 mr-1.5" />Current plan
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        disabled={noProviders || !provider || checkout.isPending}
                        onClick={() => provider && checkout.mutate({
                          plan: plan.name, billingPeriod: period, provider,
                        })}>
                        {checkout.isPending
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <><CreditCard className="h-3.5 w-3.5 mr-1.5" />
                              {overview.hasProductAccess ? "Choose plan" : "Reactivate"}</>}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Manage */}
      {sub && sub.provider !== "Manual" && (
        <Card>
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Payment method &amp; billing details</p>
                <p className="text-xs text-muted-foreground">
                  {sub.provider === "Stripe"
                    ? "Update your card, download receipts or change your plan."
                    : "Payment methods for PayPal subscriptions are managed in your PayPal account."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {sub.provider === "Stripe" && (
                <Button variant="outline" size="sm" disabled={portal.isPending}
                  onClick={() => portal.mutate()}>
                  {portal.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Manage billing"}
                </Button>
              )}
              {!sub.cancelAtPeriodEnd && sub.grantsAccess && (
                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/5"
                  onClick={() => setConfirmCancel(true)}>
                  Cancel plan
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices */}
      {invoices && invoices.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Billing history</h2>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Date</th>
                      <th className="px-4 py-2.5 font-medium">Period</th>
                      <th className="px-4 py-2.5 font-medium">Amount</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5">{formatDate(inv.paidAt ?? inv.createdAt)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {inv.periodStart ? `${formatDate(inv.periodStart)} – ${formatDate(inv.periodEnd)}` : "—"}
                        </td>
                        <td className="px-4 py-2.5 font-medium">
                          {inv.amount.toLocaleString("en-US", { style: "currency", currency: inv.currency || "USD" })}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border",
                            inv.status === "Paid"   ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : inv.status === "Failed" ? "bg-destructive/10 text-destructive border-destructive/20"
                                                    : "bg-muted text-muted-foreground border-border")}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {inv.hostedInvoiceUrl || inv.invoicePdfUrl ? (
                            <a href={(inv.invoicePdfUrl ?? inv.hostedInvoiceUrl)!} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline text-xs">
                              <Receipt className="h-3.5 w-3.5" />View
                            </a>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cancel confirmation — state-based modal, never window.confirm */}
      <AnimatePresence>
        {confirmCancel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setConfirmCancel(false)}>
            <motion.div initial={{ scale: .95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: .95, opacity: 0 }}
              className="bg-card border border-border rounded-xl max-w-md w-full p-6"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-4 mb-3">
                <h3 className="font-semibold text-lg">Cancel your subscription?</h3>
                <button onClick={() => setConfirmCancel(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                You'll keep full access until{" "}
                <span className="font-medium text-foreground">
                  {sub?.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : "the end of your billing period"}
                </span>
                , then the account switches to read-only.
              </p>
              <p className="text-sm text-muted-foreground mb-5">
                Your data is never deleted — resubscribe any time and everything is exactly where you left it.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setConfirmCancel(false)}>
                  Keep my plan
                </Button>
                <Button variant="destructive" size="sm" disabled={cancel.isPending}
                  onClick={async () => {
                    try { await cancel.mutateAsync(false); setConfirmCancel(false); }
                    catch { /* hook toasts; leave the dialog open to retry */ }
                  }}>
                  {cancel.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Cancel subscription"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
