import * as React from "react";
import { X, Loader2, Banknote, CreditCard, Users, SplitSquareHorizontal, Wallet, CheckCircle2 } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddOrderPayment } from "@/hooks/restaurant/use-restaurant";
import type { RestaurantOrder } from "@/lib/restaurant/restaurant.api";

const METHODS = ["Cash", "Card", "Bank Transfer", "Wallet"];

interface RestaurantPayDialogProps {
  order:    RestaurantOrder;
  currency: string;
  onPaid:   (order: RestaurantOrder) => void;  // called once fully paid (print + close handled by caller)
  onClose:  () => void;
}

type Mode = "full" | "split-type" | "members";

export function RestaurantPayDialog({ order, currency, onPaid, onClose }: RestaurantPayDialogProps) {
  const addPayment = useAddOrderPayment();
  const [mode, setMode]     = React.useState<Mode>("full");
  const [method, setMethod] = React.useState("Cash");
  const [amount, setAmount] = React.useState("");
  const [members, setMembers] = React.useState("2");
  const [ref, setRef]       = React.useState("");

  const outstanding = Math.max(0, order.outstanding);
  const memberShare = React.useMemo(() => {
    const n = Math.max(1, parseInt(members, 10) || 1);
    return Math.round((outstanding / n) * 100) / 100;
  }, [members, outstanding]);

  // default amount field follows outstanding/share
  React.useEffect(() => {
    if (mode === "members") setAmount(String(Math.min(memberShare, outstanding)));
    else setAmount(String(outstanding));
  }, [mode, memberShare, outstanding]);

  const post = async (amt: number, m: string, reference?: string | null) => {
    if (amt <= 0) return;
    const updated = await addPayment.mutateAsync({ id: order.id, method: m, amount: amt, reference: reference ?? null });
    if (updated.status === "paid") onPaid(updated);
  };

  const paidGuests = order.payments.length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-bold">Bill &amp; Payment</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted/60 text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Totals */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-muted/40 py-2">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total</p>
              <p className="text-sm font-bold tabular-nums">{formatCurrency(order.total, currency)}</p>
            </div>
            <div className="rounded-xl bg-primary/10 py-2">
              <p className="text-[10px] text-primary uppercase font-semibold">Paid</p>
              <p className="text-sm font-bold tabular-nums text-primary">{formatCurrency(order.amountPaid, currency)}</p>
            </div>
            <div className={cn("rounded-xl py-2", outstanding > 0 ? "bg-destructive/10" : "bg-success/10")}>
              <p className={cn("text-[10px] uppercase font-semibold", outstanding > 0 ? "text-destructive" : "text-success")}>Outstanding</p>
              <p className={cn("text-sm font-bold tabular-nums", outstanding > 0 ? "text-destructive" : "text-success")}>{formatCurrency(outstanding, currency)}</p>
            </div>
          </div>

          {/* Recorded payments */}
          {order.payments.length > 0 && (
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {order.payments.map(p => (
                <div key={p.id} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-muted/30">
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-success" />{p.method}{p.reference ? ` · ${p.reference}` : ""}</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(p.amount, currency)}</span>
                </div>
              ))}
            </div>
          )}

          {outstanding <= 0 ? (
            <div className="text-center py-3 text-success font-semibold flex items-center justify-center gap-2">
              <CheckCircle2 className="h-5 w-5" /> Fully paid
            </div>
          ) : (
            <>
              {/* Mode selector */}
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: "full" as Mode, label: "Full", icon: Banknote },
                  { id: "split-type" as Mode, label: "Split Pay", icon: SplitSquareHorizontal },
                  { id: "members" as Mode, label: "Members", icon: Users },
                ].map(t => {
                  const Icon = t.icon;
                  return (
                    <button key={t.id} onClick={() => setMode(t.id)}
                      className={cn("flex flex-col items-center gap-1 py-2 rounded-lg border text-[10px] font-semibold transition-all",
                        mode === t.id ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30")}>
                      <Icon className="h-3.5 w-3.5" />{t.label}
                    </button>
                  );
                })}
              </div>

              {mode === "members" && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Split between</span>
                  <Input type="number" min={1} value={members} onChange={e => setMembers(e.target.value)} className="h-8 w-16 text-sm text-center" />
                  <span className="text-muted-foreground">guests · share</span>
                  <span className="font-bold text-foreground">{formatCurrency(memberShare, currency)}</span>
                </div>
              )}

              {/* Method picker */}
              {mode === "full" ? (
                <div className="grid grid-cols-2 gap-2">
                  {METHODS.map(m => {
                    const Icon = m === "Cash" ? Banknote : m === "Card" ? CreditCard : Wallet;
                    return (
                      <Button key={m} variant="outline" disabled={addPayment.isPending}
                        onClick={() => post(outstanding, m)} className="gap-1.5 h-10">
                        <Icon className="h-4 w-4" />{m}
                      </Button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <select value={method} onChange={e => setMethod(e.target.value)}
                      className="h-9 rounded-lg border border-border bg-background px-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <Input type="number" min={0} step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                      className="h-9 w-28 text-right text-sm" />
                  </div>
                  {mode === "members" && (
                    <Input value={ref} onChange={e => setRef(e.target.value)} placeholder={`Guest ${paidGuests + 1} (optional label)`} className="h-8 text-xs" />
                  )}
                  <Button className="w-full" disabled={addPayment.isPending || (parseFloat(amount) || 0) <= 0}
                    onClick={() => post(parseFloat(amount) || 0, method, mode === "members" ? (ref || `Guest ${paidGuests + 1}`) : null)}>
                    {addPayment.isPending ? <Loader2 className="h-4 w-4 animate-spin" />
                      : `Add ${formatCurrency(parseFloat(amount) || 0, currency)} (${method})`}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
