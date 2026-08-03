import * as React from "react";
import { X, Loader2, Banknote, CreditCard, Users, SplitSquareHorizontal, Wallet, CheckCircle2, HandCoins, User2, Search, UserPlus } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeftDrawer } from "@/components/ui/left-drawer";
import { useAddOrderPayment, useSetOrderTip, useSetOrderCustomer } from "@/hooks/restaurant/use-restaurant";
import { useCustomer, useCustomers, useCreateCustomer } from "@/hooks/pos/use-customers";
import type { CustomerDto, CustomerSummaryDto } from "@/lib/pos/types";
import type { RestaurantOrder } from "@/lib/restaurant/restaurant.api";

const TIP_PRESETS = [10, 15, 20];

const METHODS = ["Cash", "Card", "Bank Transfer", "Wallet", "House Account"];
const CUSTOMER_FUNDED_METHODS = new Set(["Wallet", "House Account"]);

interface RestaurantPayDialogProps {
  order:    RestaurantOrder;
  currency: string;
  onPaid:   (order: RestaurantOrder) => void;  // called once fully paid (print + close handled by caller)
  onClose:  () => void;
}

type Mode = "full" | "split-type" | "members";

export function RestaurantPayDialog({ order, currency, onPaid, onClose }: RestaurantPayDialogProps) {
  const addPayment = useAddOrderPayment();
  const setTip = useSetOrderTip();
  const setOrderCustomer = useSetOrderCustomer();
  const [mode, setMode]     = React.useState<Mode>("full");
  const [method, setMethod] = React.useState("Cash");
  const [amount, setAmount] = React.useState("");
  const [members, setMembers] = React.useState("2");
  const [ref, setRef]       = React.useState("");
  const [tipInput, setTipInput] = React.useState("");

  // Shadowed into local state so a tip/payment mutation reflects immediately in this dialog —
  // the parent's order list only re-renders once its 15s-interval query refetches.
  const [displayOrder, setDisplayOrder] = React.useState(order);
  React.useEffect(() => { setDisplayOrder(order); }, [order]);

  const { data: linkedCustomer } = useCustomer(displayOrder.customerId ?? "");

  const canEditTip = !["paid", "cancelled", "split", "held"].includes(displayOrder.status);
  const canEditCustomer = !["paid", "cancelled", "split", "held"].includes(displayOrder.status);
  const outstanding = Math.max(0, displayOrder.outstanding);

  const pickCustomer = async (customerId: string | null) => {
    const updated = await setOrderCustomer.mutateAsync({ id: displayOrder.id, customerId });
    setDisplayOrder(updated);
  };

  /** Whether `m` can actually be used right now — wallet/house-account need a linked customer with
   * enough balance/available credit for the given amount; every other method is always usable. */
  const customerFundedIssue = (m: string, amt: number): string | null => {
    if (!CUSTOMER_FUNDED_METHODS.has(m)) return null;
    if (!linkedCustomer) return "Link a customer first";
    if (m === "Wallet" && amt > linkedCustomer.walletBalance) return `Only ${formatCurrency(linkedCustomer.walletBalance, currency)} in wallet`;
    if (m === "House Account" && amt > linkedCustomer.availableCredit) return `Only ${formatCurrency(linkedCustomer.availableCredit, currency)} available`;
    return null;
  };
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
    const updated = await addPayment.mutateAsync({ id: displayOrder.id, method: m, amount: amt, reference: reference ?? null });
    setDisplayOrder(updated);
    if (updated.status === "paid") onPaid(updated);
  };

  const applyTip = async (value: number) => {
    if (value < 0) return;
    const updated = await setTip.mutateAsync({ id: displayOrder.id, amount: value });
    setDisplayOrder(updated);
  };

  const paidGuests = displayOrder.payments.length;

  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-md" zIndexClassName="z-[60]">
      <div className="-mx-5 -mt-5 px-5 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-bold">Bill &amp; Payment</h2>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted/60 text-muted-foreground"><X className="h-4 w-4" /></button>
      </div>

      <div className="space-y-4">
          {/* Totals */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-muted/40 py-2">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total</p>
              <p className="text-sm font-bold tabular-nums">{formatCurrency(displayOrder.total, currency)}</p>
            </div>
            <div className="rounded-xl bg-primary/10 py-2">
              <p className="text-[10px] text-primary uppercase font-semibold">Paid</p>
              <p className="text-sm font-bold tabular-nums text-primary">{formatCurrency(displayOrder.amountPaid, currency)}</p>
            </div>
            <div className={cn("rounded-xl py-2", outstanding > 0 ? "bg-destructive/10" : "bg-success/10")}>
              <p className={cn("text-[10px] uppercase font-semibold", outstanding > 0 ? "text-destructive" : "text-success")}>Outstanding</p>
              <p className={cn("text-sm font-bold tabular-nums", outstanding > 0 ? "text-destructive" : "text-success")}>{formatCurrency(outstanding, currency)}</p>
            </div>
          </div>

          {/* Customer link — needed for Wallet/House Account payment */}
          <OrderCustomerPicker
            linkedCustomer={linkedCustomer ?? null}
            editable={canEditCustomer}
            busy={setOrderCustomer.isPending}
            currency={currency}
            onPick={pickCustomer}
          />

          {/* Tip */}
          {(canEditTip || displayOrder.tipAmount > 0) && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold">
                <span className="flex items-center gap-1.5"><HandCoins className="h-3.5 w-3.5 text-primary" />Tip</span>
                <span className="tabular-nums">{formatCurrency(displayOrder.tipAmount, currency)}</span>
              </div>
              {canEditTip && (
                <div className="px-3 pb-3 space-y-2">
                  <div className="grid grid-cols-4 gap-1.5">
                    {TIP_PRESETS.map(pct => (
                      <button key={pct} disabled={setTip.isPending}
                        onClick={() => applyTip(Math.round(displayOrder.subTotal * (pct / 100) * 100) / 100)}
                        className="py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary disabled:opacity-50">
                        {pct}%
                      </button>
                    ))}
                    <button disabled={setTip.isPending} onClick={() => applyTip(0)}
                      className="py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:border-destructive/40 hover:text-destructive disabled:opacity-50">
                      None
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Input type="number" min={0} step="0.01" value={tipInput} onChange={e => setTipInput(e.target.value)}
                      placeholder="Custom amount" className="h-8 text-sm" />
                    <Button size="sm" className="h-8 shrink-0" disabled={setTip.isPending || !tipInput}
                      onClick={() => { applyTip(parseFloat(tipInput) || 0); setTipInput(""); }}>
                      {setTip.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Set"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recorded payments */}
          {displayOrder.payments.length > 0 && (
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {displayOrder.payments.map(p => (
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
                    const Icon = m === "Cash" ? Banknote : m === "Card" ? CreditCard : m === "House Account" ? HandCoins : Wallet;
                    const issue = customerFundedIssue(m, outstanding);
                    return (
                      <Button key={m} variant="outline" disabled={addPayment.isPending || !!issue}
                        title={issue ?? undefined}
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
                  {customerFundedIssue(method, parseFloat(amount) || 0) && (
                    <p className="text-xs text-destructive">{customerFundedIssue(method, parseFloat(amount) || 0)}</p>
                  )}
                  <Button className="w-full" disabled={addPayment.isPending || (parseFloat(amount) || 0) <= 0 || !!customerFundedIssue(method, parseFloat(amount) || 0)}
                    onClick={() => post(parseFloat(amount) || 0, method, mode === "members" ? (ref || `Guest ${paidGuests + 1}`) : null)}>
                    {addPayment.isPending ? <Loader2 className="h-4 w-4 animate-spin" />
                      : `Add ${formatCurrency(parseFloat(amount) || 0, currency)} (${method})`}
                  </Button>
                </div>
              )}
            </>
          )}
      </div>
    </LeftDrawer>
  );
}

/** Compact customer picker for the pay dialog — links the order to a POS customer so Wallet/House
 * Account payment can be validated against their real balance. Mirrors retail POS's CustomerSelect. */
function OrderCustomerPicker({ linkedCustomer, editable, busy, currency, onPick }: {
  linkedCustomer: CustomerDto | null; editable: boolean; busy: boolean; currency: string; onPick: (customerId: string | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newPhone, setNewPhone] = React.useState("");
  const boxRef = React.useRef<HTMLDivElement>(null);

  const { data, isLoading } = useCustomers({ search: search || undefined, pageSize: 20 });
  const customers = data?.items ?? [];
  const createCustomer = useCreateCustomer();

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const pick = (c: CustomerSummaryDto) => { onPick(c.id); setOpen(false); setSearch(""); };

  const submitNew = async () => {
    if (!newName.trim()) return;
    try {
      const c = await createCustomer.mutateAsync({ name: newName.trim(), phone: newPhone.trim() || null });
      onPick(c.id);
      setCreating(false); setNewName(""); setNewPhone(""); setOpen(false); setSearch("");
    } catch { /* toast in hook */ }
  };

  return (
    <div className="relative" ref={boxRef}>
      <button disabled={!editable || busy} onClick={() => editable && setOpen(o => !o)}
        className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium",
          linkedCustomer ? "border-primary/40 bg-primary/5 text-primary" : "border-border bg-muted/20 text-muted-foreground",
          editable && "hover:border-primary/30")}>
        <User2 className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 text-left truncate">
          {linkedCustomer ? linkedCustomer.name : "No customer linked"}
        </span>
        {linkedCustomer && (
          <span className="text-[10px] text-muted-foreground shrink-0">
            Wallet {formatCurrency(linkedCustomer.walletBalance, currency)} · Credit {formatCurrency(linkedCustomer.availableCredit, currency)}
          </span>
        )}
        {linkedCustomer && editable && (
          <span role="button" tabIndex={0} onClick={e => { e.stopPropagation(); onPick(null); }}
            className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0">
            <X className="h-3 w-3" />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-card shadow-xl overflow-hidden">
          {creating ? (
            <div className="p-3 space-y-2">
              <p className="text-xs font-bold flex items-center gap-1.5"><UserPlus className="h-3.5 w-3.5 text-primary" />New Customer</p>
              <Input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") submitNew(); }} placeholder="Name *" className="h-8 text-xs" />
              <Input value={newPhone} onChange={e => setNewPhone(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") submitNew(); }} placeholder="Phone (optional)" className="h-8 text-xs" />
              <div className="flex gap-2 pt-0.5">
                <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => setCreating(false)} disabled={createCustomer.isPending}>Back</Button>
                <Button size="sm" className="flex-1 h-8 text-xs" onClick={submitNew} disabled={!newName.trim() || createCustomer.isPending}>
                  {createCustomer.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="p-2 border-b border-border flex gap-1.5">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers…" className="pl-8 h-8 text-xs" />
                </div>
                <Button size="sm" className="h-8 px-2 shrink-0" title="Add new customer" onClick={() => { setNewName(search); setCreating(true); }}>
                  <UserPlus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="max-h-56 overflow-y-auto">
                {isLoading ? (
                  <p className="px-3 py-3 text-xs text-muted-foreground">Loading…</p>
                ) : customers.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-muted-foreground">No customers found.</p>
                ) : (
                  customers.map(c => (
                    <button key={c.id} onClick={() => pick(c)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-muted/40 border-t border-border/40 first:border-t-0">
                      <div className="min-w-0 text-left">
                        <p className="font-semibold text-foreground truncate">{c.name}</p>
                        {c.phone && <p className="text-[10px] text-muted-foreground truncate">{c.phone}</p>}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        Wallet {formatCurrency(c.walletBalance, currency)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
