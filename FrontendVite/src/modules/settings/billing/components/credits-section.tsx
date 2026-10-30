import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Coins, Loader2, X, ArrowLeftRight, Info, CreditCard, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { useCan } from "@/components/auth/can";
import {
  useCreditCatalog, useCreditPurchases, useCreditSwaps, useCreditQuote, useCreditCheckout,
  useCapturePayPalCredits, useCreditSwapQuote, useSwapCredits,
} from "@/hooks/billing/use-credits";
import type { CreditProductDto } from "@/lib/billing/credits.api";

const usd = (n: number, max = 4) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: max })}`;
const PROVIDER_LABEL: Record<string, string> = { Stripe: "Card (Stripe)", PayPal: "PayPal" };

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: .96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: .96, opacity: 0 }}
        className="bg-card border border-border rounded-xl max-w-lg w-full max-h-[90dvh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 mb-3">
          <h3 className="font-semibold text-lg">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

/**
 * Add-ons & credits. One card per module that sells credits — SEO audits, Lead Generation, and anything added later —
 * with the balance in credits (never money), what one credit costs, how it is used, and Buy / Swap.
 * All money maths is done by the server; this screen only displays what it is told.
 */
export function CreditsSection() {
  const { data: catalog, isLoading } = useCreditCatalog();
  const { data: purchases } = useCreditPurchases();
  const { data: swaps } = useCreditSwaps();
  const canBuy = useCan("settings.billing.edit");
  const capture = useCapturePayPalCredits();
  const [params, setParams] = useSearchParams();

  const [buying, setBuying] = React.useState<CreditProductDto | null>(null);
  const [swapping, setSwapping] = React.useState(false);

  // Returning from the payment page. The redirect is NOT proof of payment: Stripe credits via its webhook and we only show
  // what the server says; PayPal needs us to capture the approved order first.
  const handled = React.useRef(false);
  React.useEffect(() => {
    const state = params.get("credits");
    if (!state || handled.current) return;
    handled.current = true;
    const clean = () => { const p = new URLSearchParams(params); ["credits", "purchase", "token", "PayerID"].forEach((k) => p.delete(k)); setParams(p, { replace: true }); };
    if (state === "cancelled") { toast.info("Payment cancelled. No credits were added and you were not charged."); clean(); }
    else if (state === "success") { toast.success("Payment received. Your credits appear as soon as the payment is confirmed (usually a few seconds)."); clean(); }
    else if (state === "paypal") {
      const order = params.get("token");
      if (!order) { clean(); return; }
      capture.mutateAsync(order)
        .then((p) => toast.success(p.status === "credited" ? `${p.credits.toLocaleString()} credits added.` : "Payment received. Credits will appear shortly."))
        .catch((e: Error) => toast.error(e.message))
        .finally(clean);
    }
  }, [params, setParams, capture]);

  if (isLoading) return <div className="h-24 rounded-xl bg-muted/40 animate-pulse" />;
  if (!catalog) return null;

  const moduleName = (k: string) => catalog.products.find((p) => p.moduleKey === k)?.name ?? k;
  const swappableProducts = catalog.products.filter((p) => p.forSale);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Coins className="h-5 w-5 text-primary" />Add-ons &amp; credits</h2>
          <p className="text-sm text-muted-foreground">
            Pay only for what you use. Each add-on has its own credits and its own price per credit. Credits never expire.
          </p>
        </div>
        {catalog.swapEnabled && swappableProducts.length > 1 && canBuy && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSwapping(true)}>
            <ArrowLeftRight className="h-3.5 w-3.5" />Swap credits
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {catalog.products.map((p) => (
          <Card key={p.moduleKey}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{p.name}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-bold tabular-nums leading-none">{p.balance.toLocaleString()}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">credits left</div>
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
                {p.forSale ? (
                  <><span className="font-medium">1 credit = {usd(p.pricePerCredit)}</span> · {p.unitName}</>
                ) : (
                  <span className="text-muted-foreground">Credits for this add-on are not on sale yet.</span>
                )}
              </div>

              {p.howItWorks.length > 0 && (
                <ul className="text-xs text-muted-foreground space-y-1 list-disc ps-4">
                  {p.howItWorks.map((h, i) => <li key={i}>{h}</li>)}
                </ul>
              )}

              {p.forSale && (
                <Button size="sm" disabled={!canBuy} onClick={() => setBuying(p)} className="gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" />Buy credits
                </Button>
              )}
              {!canBuy && p.forSale && <p className="text-[11px] text-muted-foreground">Ask a billing admin to buy credits.</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground flex gap-2">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          Minimum {catalog.minCredits} credits and {usd(catalog.minOrderUsd, 2)} per order; for orders above {usd(catalog.maxOrderUsd, 2)} please contact us.
          Larger orders get a discount: {catalog.tiers.filter((t) => t.discountPercent > 0).map((t) => `${t.fromCredits.toLocaleString()}+ credits ${t.discountPercent}% off`).join(", ")}.
          {catalog.vatPercent > 0 && ` Prices exclude ${catalog.vatPercent}% VAT, added at checkout.`} Purchases are final and not refundable; credits stay on your account until used.
        </div>
      </div>

      {(purchases?.length || swaps?.length) ? (
        <details className="rounded-lg border border-border">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Credit history</summary>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground"><tr className="text-start"><th className="p-2 text-start">Date</th><th className="p-2 text-start">What</th><th className="p-2 text-end">Credits</th><th className="p-2 text-end">Paid</th><th className="p-2 text-start">Status</th></tr></thead>
              <tbody>
                {(purchases ?? []).map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-2">{formatDate(p.createdAt)}</td>
                    <td className="p-2">Bought {moduleName(p.moduleKey)}</td>
                    <td className="p-2 text-end tabular-nums">+{p.credits.toLocaleString()}</td>
                    <td className="p-2 text-end tabular-nums">{usd(p.totalAmount, 2)}</td>
                    <td className="p-2">{p.status === "credited" ? "Added" : p.status === "failed" ? `Failed${p.error ? `: ${p.error}` : ""}` : p.status === "pending" ? "Waiting for payment" : "Confirming"}</td>
                  </tr>
                ))}
                {(swaps ?? []).map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="p-2">{formatDate(s.createdAt)}</td>
                    <td className="p-2">Swap {moduleName(s.fromModule)} → {moduleName(s.toModule)}</td>
                    <td className="p-2 text-end tabular-nums">−{s.fromCredits.toLocaleString()} / +{s.toCredits.toLocaleString()}</td>
                    <td className="p-2 text-end">—</td>
                    <td className="p-2">{s.status === "done" ? "Done" : s.status === "failed" ? `Not done${s.error ? `: ${s.error}` : ""}` : "In progress"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}

      <AnimatePresence>
        {buying && <BuyDialog product={buying} onClose={() => setBuying(null)} />}
        {swapping && <SwapDialog onClose={() => setSwapping(false)} />}
      </AnimatePresence>
    </div>
  );
}

function BuyDialog({ product, onClose }: { product: CreditProductDto; onClose: () => void }) {
  const { data: catalog } = useCreditCatalog();
  const checkout = useCreditCheckout();
  const providers = catalog?.providers ?? [];
  const [text, setText] = React.useState(String(Math.max(catalog?.minCredits ?? 20, Math.ceil((catalog?.minOrderUsd ?? 5) / product.pricePerCredit))));
  const [provider, setProvider] = React.useState<string>("");
  React.useEffect(() => { if (!provider && providers.length) setProvider(providers[0]); }, [providers, provider]);

  const credits = /^\d{1,7}$/.test(text.trim()) ? parseInt(text.trim(), 10) : 0;
  const { data: quote, error, isFetching } = useCreditQuote(product.moduleKey, credits);

  const go = async () => {
    try {
      const r = await checkout.mutateAsync({ module: product.moduleKey, credits, provider });
      window.location.href = r.url;
    } catch { /* hook toasts */ }
  };

  return (
    <Modal title={`Buy ${product.name} credits`} onClose={onClose}>
      <p className="text-xs text-muted-foreground mb-3">1 credit = {usd(product.pricePerCredit)} · {product.unitName}</p>
      <label className="text-sm font-medium">How many credits?</label>
      <Input inputMode="numeric" value={text} onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ""))} className="mt-1" />
      <div className="flex flex-wrap gap-1.5 mt-2">
        {[100, 250, 500, 1000, 2500].map((n) => (
          <button key={n} type="button" onClick={() => setText(String(n))}
            className="px-2 py-0.5 rounded-full border border-border text-xs hover:bg-muted">{n.toLocaleString()}</button>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-border p-3 text-sm space-y-1 min-h-[88px]">
        {credits === 0 ? <span className="text-muted-foreground">Enter a number of credits.</span>
          : error ? <span className="text-destructive">{(error as Error).message}</span>
          : quote ? (
            <>
              <Row k={`${quote.credits.toLocaleString()} × ${usd(quote.unitPrice)}`} v={usd(quote.grossAmount, 2)} />
              {quote.discountPercent > 0 && <Row k={`Volume discount ${quote.discountPercent}%`} v={`−${usd(quote.grossAmount - quote.netAmount, 2)}`} />}
              {quote.vatAmount > 0 && <Row k={`VAT ${quote.vatPercent}%`} v={usd(quote.vatAmount, 2)} />}
              <div className="flex justify-between font-semibold pt-1 border-t border-border"><span>Total</span><span>{usd(quote.totalAmount, 2)} {quote.currency}</span></div>
            </>
          ) : isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      </div>

      {providers.length > 1 && (
        <div className="mt-3 flex gap-2">
          {providers.map((p) => (
            <button key={p} type="button" onClick={() => setProvider(p)}
              className={cn("flex-1 rounded-lg border px-3 py-2 text-sm flex items-center justify-center gap-1.5", provider === p ? "border-primary bg-primary/5" : "border-border hover:bg-muted")}>
              {provider === p && <Check className="h-3.5 w-3.5" />}{PROVIDER_LABEL[p] ?? p}
            </button>
          ))}
        </div>
      )}
      {providers.length === 0 && <p className="mt-3 text-sm text-destructive">No payment method is set up on this server yet.</p>}

      <p className="text-[11px] text-muted-foreground mt-3">Credits are added to your account when the payment is confirmed. Purchases are final and not refundable.</p>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" disabled={!quote || !provider || checkout.isPending} onClick={go}>
          {checkout.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : quote ? `Pay ${usd(quote.totalAmount, 2)}` : "Pay"}
        </Button>
      </div>
    </Modal>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="tabular-nums">{v}</span></div>;

function SwapDialog({ onClose }: { onClose: () => void }) {
  const { data: catalog } = useCreditCatalog();
  const swap = useSwapCredits();
  const products = (catalog?.products ?? []).filter((p) => p.forSale);
  const [from, setFrom] = React.useState(products.find((p) => p.swappable > 0)?.moduleKey ?? products[0]?.moduleKey ?? "");
  const [to, setTo] = React.useState(products.find((p) => p.moduleKey !== from)?.moduleKey ?? "");
  const [text, setText] = React.useState("");
  const credits = /^\d{1,7}$/.test(text.trim()) ? parseInt(text.trim(), 10) : 0;
  const src = products.find((p) => p.moduleKey === from);
  const { data: quote, error } = useCreditSwapQuote(from, to, credits);

  const go = async () => { try { await swap.mutateAsync({ from, to, credits }); onClose(); } catch { /* hook toasts */ } };
  const over = !!src && !!quote && quote.creditsTaken > src.swappable;

  return (
    <Modal title="Swap credits" onClose={onClose}>
      <p className="text-xs text-muted-foreground mb-3">
        Move credits you bought from one add-on to another, at equal value, instead of buying new ones.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium">From</label>
          <select value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value === to) setTo(products.find((p) => p.moduleKey !== e.target.value)?.moduleKey ?? ""); }}
            className="mt-1 w-full h-9 rounded-md border border-border bg-card px-2 text-sm">
            {products.map((p) => <option key={p.moduleKey} value={p.moduleKey}>{p.name}</option>)}
          </select>
          {src && <p className="text-[11px] text-muted-foreground mt-1">{src.swappable.toLocaleString()} can be swapped (of {src.balance.toLocaleString()})</p>}
        </div>
        <div>
          <label className="text-xs font-medium">To</label>
          <select value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full h-9 rounded-md border border-border bg-card px-2 text-sm">
            {products.filter((p) => p.moduleKey !== from).map((p) => <option key={p.moduleKey} value={p.moduleKey}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <label className="text-xs font-medium mt-3 block">Credits to swap</label>
      <Input inputMode="numeric" value={text} onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ""))} className="mt-1" placeholder={`At least ${catalog?.minSwapCredits ?? 10}`} />

      <div className="mt-3 rounded-lg border border-border p-3 text-sm min-h-[64px]">
        {credits === 0 ? <span className="text-muted-foreground">Enter how many credits to swap.</span>
          : error ? <span className="text-destructive">{(error as Error).message}</span>
          : quote ? (
            <>
              <div className="font-semibold">You give {quote.creditsTaken.toLocaleString()} → you get {quote.creditsReceived.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">{quote.formula}</div>
              {over && <div className="text-xs text-destructive mt-1">Only {src?.swappable.toLocaleString()} of your credits can be swapped; free credits cannot.</div>}
            </>
          ) : null}
      </div>

      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">How swapping is calculated</summary>
        <ol className="list-decimal ps-4 mt-2 space-y-1">
          <li>Value moved = credits you give × price of one credit you give.</li>
          <li>{catalog && catalog.swapFeePercent > 0 ? `A ${catalog.swapFeePercent}% fee is taken from that value.` : "There is no swap fee: value in = value out."}</li>
          <li>You receive = whole credits worth that value at the other add-on's price (rounded down). Only as many credits as needed are taken, so no fraction of a credit is lost.</li>
          <li>Prices are the normal price per credit, before bulk discounts.</li>
          <li>Only credits you bought or swapped in can be swapped. Free credits cannot.</li>
          <li>Example: 20 SEO credits at $0.05 = $1.00. At $0.10 per Lead Generation credit that is 10 credits.</li>
        </ol>
      </details>

      <div className="flex justify-end gap-2 mt-4">
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" disabled={!quote || over || swap.isPending} onClick={go}>
          {swap.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Swap"}
        </Button>
      </div>
    </Modal>
  );
}
