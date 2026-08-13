import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  CreditCard, ArrowLeft, Loader2, Save, CheckCircle2,
  AlertTriangle, KeyRound, Info, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import {
  billingConfigApi, BILLABLE_PLANS, BILLING_CADENCES, idKey,
  type BillingConfigDto, type BillingProviderConfigDto,
} from "@/lib/admin/billing-config.api";

/**
 * Super-admin: platform billing configuration.
 *
 * Split by design — this screen owns the operational half (which providers are live, the
 * price/plan ids from each dashboard, sandbox, currency), which changes often and is not
 * sensitive. The secrets half (Stripe secret key, PayPal client secret, webhook signing secrets)
 * stays in `/opt/vrodux/shared/.env` on the server: a live payment secret in the app database
 * would turn any DB read, injection bug or leaked backup into "can charge cards as us".
 *
 * The screen therefore has to make the split legible — for each provider it shows whether the
 * env secret is present, and refuses to claim a provider is ready unless it is enabled, has its
 * secret, AND has at least one price id.
 */

// ── Status pill ───────────────────────────────────────────────────────────────

function ProviderStatus({ p }: { p: BillingProviderConfigDto }) {
  if (p.isUsable) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20">
        <CheckCircle2 className="h-3 w-3" /> Ready
      </span>
    );
  }
  // Say precisely what is missing — "not configured" alone sends people hunting.
  const reason = !p.enabled     ? "Disabled"
               : !p.hasSecret   ? "Missing credentials"
               : "No price IDs";
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold",
      p.enabled ? "text-amber-600 bg-amber-50 dark:bg-amber-900/20"
                : "text-muted-foreground bg-muted",
    )}>
      {p.enabled && <AlertTriangle className="h-3 w-3" />}
      {reason}
    </span>
  );
}

function Toggle({ checked, onChange, label, hint }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "mt-0.5 h-5 w-9 rounded-full transition-colors shrink-0 relative",
          checked ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[1.15rem]" : "translate-x-0.5",
        )} />
      </button>
      <span className="min-w-0">
        <span className="text-sm font-medium block">{label}</span>
        {hint && <span className="text-xs text-muted-foreground block mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

/** The 6 price/plan id inputs for one provider — 3 tiers × monthly/annual. */
function IdGrid({ ids, onChange, placeholder, disabled }: {
  ids: Record<string, string>;
  onChange: (key: string, value: string) => void;
  placeholder: string;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[7rem_1fr_1fr] gap-2 items-center">
        <span />
        {BILLING_CADENCES.map(c => (
          <span key={c} className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            {c}
          </span>
        ))}
      </div>
      {BILLABLE_PLANS.map(plan => (
        <div key={plan} className="grid grid-cols-[7rem_1fr_1fr] gap-2 items-center">
          <span className="text-sm font-medium truncate">{plan}</span>
          {BILLING_CADENCES.map(cadence => {
            const k = idKey(plan, cadence);
            return (
              <Input
                key={k}
                value={ids[k] ?? ""}
                onChange={e => onChange(k, e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className="h-8 text-xs font-mono"
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function BillingConfigView() {
  const navigate = useNavigate();

  const [config, setConfig]   = React.useState<BillingConfigDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving]   = React.useState(false);

  // Local edit state, seeded from the server and diffed only on save.
  const [currency, setCurrency]                 = React.useState("USD");
  const [stripeEnabled, setStripeEnabled]       = React.useState(false);
  const [stripeIds, setStripeIds]               = React.useState<Record<string, string>>({});
  const [payPalEnabled, setPayPalEnabled]       = React.useState(false);
  const [payPalSandbox, setPayPalSandbox]       = React.useState(true);
  const [payPalIds, setPayPalIds]               = React.useState<Record<string, string>>({});

  const apply = React.useCallback((c: BillingConfigDto) => {
    setConfig(c);
    setCurrency(c.currency);
    setStripeEnabled(c.stripe.enabled);
    setStripeIds({ ...c.stripe.ids });
    setPayPalEnabled(c.payPal.enabled);
    setPayPalSandbox(c.payPal.useSandbox ?? true);
    setPayPalIds({ ...c.payPal.ids });
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    billingConfigApi.get()
      .then(c => { if (!cancelled) apply(c); })
      .catch(e => toast.error(e instanceof Error ? e.message : "Could not load billing configuration."))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [apply]);

  const save = async () => {
    try {
      setSaving(true);
      const updated = await billingConfigApi.update({
        currency:         currency.trim().toUpperCase() || null,
        stripeEnabled,
        stripePrices:     stripeIds,
        payPalEnabled,
        payPalUseSandbox: payPalSandbox,
        payPalPlans:      payPalIds,
      });
      apply(updated);
      toast.success("Billing configuration saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save billing configuration.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading billing configuration…</span>
      </div>
    );
  }

  const webhookBase = config?.publicBaseUrl?.replace(/\/$/, "") ?? "";

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <button
              onClick={() => navigate("/super-admin")}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-1"
            >
              <ArrowLeft className="h-3 w-3" /> Tenants
            </button>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Billing Setup
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Vrodux's own payment accounts — how tenants are charged for their subscription.
            </p>
          </div>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    : <Save className="h-3.5 w-3.5 mr-1.5" />}
            Save changes
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5 max-w-4xl">
        {/* Where secrets live — the single most confusing part of this screen */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 flex gap-3">
          <KeyRound className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1.5">
            <p className="font-medium text-foreground text-sm">API keys are set on the server, not here</p>
            <p>
              Secret keys and webhook signing secrets are never stored in the database. Put them in{" "}
              <code className="font-mono text-foreground">/opt/vrodux/shared/.env</code> and restart the
              API container:
            </p>
            <p className="font-mono text-[11px] leading-relaxed text-foreground/80">
              STRIPE_SECRET_KEY · STRIPE_WEBHOOK_SECRET<br />
              PAYPAL_CLIENT_ID · PAYPAL_CLIENT_SECRET · PAYPAL_WEBHOOK_ID
            </p>
            <p>Everything on this page can be changed without a redeploy.</p>
          </div>
        </div>

        {/* Shared */}
        <section className="rounded-xl border border-border p-4 space-y-4">
          <h2 className="font-semibold text-sm">General</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Billing currency</label>
              <Input
                value={currency}
                onChange={e => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
                placeholder="USD"
                className="mt-1 h-9 font-mono uppercase"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Every plan is charged in this currency, whatever the tenant's display currency is.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Return URL</label>
              <Input value={config?.publicBaseUrl ?? ""} readOnly disabled className="mt-1 h-9 font-mono" />
              <p className="text-[11px] text-muted-foreground mt-1">
                Set on the server (<code className="font-mono">Billing__PublicBaseUrl</code>) — providers
                redirect back here after checkout.
              </p>
            </div>
          </div>
        </section>

        {/* Stripe */}
        <section className="rounded-xl border border-border p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              Stripe
              {config && <ProviderStatus p={config.stripe} />}
            </h2>
            {!config?.stripe.hasSecret && (
              <span className="text-[11px] text-amber-600 inline-flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> STRIPE_SECRET_KEY not set on the server
              </span>
            )}
          </div>

          <Toggle
            checked={stripeEnabled}
            onChange={setStripeEnabled}
            label="Offer Stripe at checkout"
            hint="Card payments. Test vs live is decided by which secret key the server has."
          />

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Price IDs <span className="font-normal">— one recurring Price per tier and cadence, created in the Stripe dashboard</span>
            </p>
            <IdGrid ids={stripeIds} placeholder="price_…" disabled={!stripeEnabled}
              onChange={(k, v) => setStripeIds(prev => ({ ...prev, [k]: v }))} />
          </div>

          <div className="text-[11px] text-muted-foreground flex items-start gap-1.5 pt-1 border-t border-border/60">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            <span>
              Webhook endpoint:{" "}
              <code className="font-mono text-foreground">{webhookBase}/api/billing/webhooks/stripe</code>
              {" "}— subscribe to checkout.session.completed, customer.subscription.*, invoice.paid,
              invoice.payment_failed. Without the signing secret every webhook is rejected, so payments
              would never activate a tenant.
            </span>
          </div>
        </section>

        {/* PayPal */}
        <section className="rounded-xl border border-border p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              PayPal
              {config && <ProviderStatus p={config.payPal} />}
            </h2>
            {!config?.payPal.hasSecret && (
              <span className="text-[11px] text-amber-600 inline-flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> PAYPAL_CLIENT_ID / SECRET not set on the server
              </span>
            )}
          </div>

          <Toggle
            checked={payPalEnabled}
            onChange={setPayPalEnabled}
            label="Offer PayPal at checkout"
            hint="PayPal balance and cards via PayPal's own subscription billing."
          />

          <Toggle
            checked={payPalSandbox}
            onChange={setPayPalSandbox}
            label="Sandbox mode"
            hint={payPalSandbox
              ? "Test environment — no real money moves. Turn this off only when you intend to charge real cards."
              : "LIVE — real customers will be charged."}
          />

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Billing Plan IDs <span className="font-normal">— one plan per tier and cadence, created under a PayPal product</span>
            </p>
            <IdGrid ids={payPalIds} placeholder="P-…" disabled={!payPalEnabled}
              onChange={(k, v) => setPayPalIds(prev => ({ ...prev, [k]: v }))} />
          </div>

          <div className="text-[11px] text-muted-foreground flex items-start gap-1.5 pt-1 border-t border-border/60">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            <span>
              Webhook endpoint:{" "}
              <code className="font-mono text-foreground">{webhookBase}/api/billing/webhooks/paypal</code>
              {" "}— subscribe to BILLING.SUBSCRIPTION.ACTIVATED / CANCELLED / EXPIRED / SUSPENDED and
              PAYMENT.SALE.COMPLETED. Sandbox and live have separate credentials and webhook ids.
            </span>
          </div>
        </section>

        {/* Nothing enabled at all — the state that silently breaks "Buy Now" */}
        {config && !config.stripe.isUsable && !config.payPal.isUsable && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-amber-500/40 bg-amber-50 dark:bg-amber-900/15 p-4 flex gap-3"
          >
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200">
              <p className="font-semibold text-sm">No payment provider is usable</p>
              <p className="mt-1">
                Until at least one is ready, a "Buy Now" signup reaches the billing page with nothing
                to pay with — the account sits unpaid and unusable. Trial signups are unaffected.
              </p>
            </div>
          </motion.div>
        )}

        {config?.updatedAt && (
          <p className="text-[11px] text-muted-foreground">
            Last changed {formatDate(config.updatedAt)}
            {config.updatedBy ? ` by ${config.updatedBy}` : ""}
          </p>
        )}

        <a
          href="https://dashboard.stripe.com/products"
          target="_blank" rel="noreferrer"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          Open Stripe products <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
