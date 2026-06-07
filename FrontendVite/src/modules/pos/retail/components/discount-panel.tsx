import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Percent, Banknote, Ticket, Star, Tag, ChevronDown, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useValidateVoucher } from "@/hooks/pos/use-vouchers";
import type { OrderDiscountRequest, OrderDiscountType } from "@/lib/pos/types";
import type { SelectedCustomer } from "./customer-select";

/**
 * Loyalty point value used for the on-screen PREVIEW only.
 * The backend (DiscountSettings:LoyaltyPointValue) is authoritative at sale time.
 */
const LOYALTY_POINT_VALUE = 1;

export interface AppliedDiscount {
  descriptor: OrderDiscountRequest;
  amount:     number;   // preview amount for UI totals
  label:      string;   // short label for receipt/summary
}

interface DiscountPanelProps {
  subtotal:   number;                       // gross subtotal (pre-tax, pre-discount)
  currency:   string;
  customer:   SelectedCustomer | null;
  applied:    AppliedDiscount | null;
  onChange:   (d: AppliedDiscount | null) => void;
}

const TABS: { id: OrderDiscountType; label: string; icon: React.ElementType }[] = [
  { id: "percentage", label: "Percent",  icon: Percent  },
  { id: "fixed",      label: "Amount",   icon: Banknote },
  { id: "voucher",    label: "Voucher",  icon: Ticket   },
  { id: "loyalty",    label: "Loyalty",  icon: Star     },
];

export function DiscountPanel({ subtotal, currency, customer, applied, onChange }: DiscountPanelProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [tab, setTab]           = React.useState<OrderDiscountType>("percentage");

  // tab-local inputs
  const [pctValue, setPctValue]       = React.useState("");
  const [fixedValue, setFixedValue]   = React.useState("");
  const [voucherCode, setVoucherCode] = React.useState("");
  const [voucherMsg, setVoucherMsg]   = React.useState<{ ok: boolean; text: string } | null>(null);
  const [points, setPoints]           = React.useState("");

  const validateVoucher = useValidateVoucher();

  const clear = () => {
    onChange(null);
    setVoucherMsg(null);
  };

  const applyPercentage = () => {
    const v = parseFloat(pctValue) || 0;
    if (v <= 0 || v > 100) return;
    const amount = Math.round(subtotal * (v / 100) * 100) / 100;
    onChange({ descriptor: { type: "percentage", value: v }, amount, label: `${v}%` });
  };

  const applyFixed = () => {
    const v = parseFloat(fixedValue) || 0;
    if (v <= 0) return;
    const amount = Math.min(v, subtotal);
    onChange({ descriptor: { type: "fixed", value: v }, amount, label: formatCurrency(amount, currency) });
  };

  const applyVoucher = async () => {
    const code = voucherCode.trim().toUpperCase();
    if (!code) return;
    setVoucherMsg(null);
    try {
      const res = await validateVoucher.mutateAsync({ code, subtotal });
      if (res.valid) {
        setVoucherMsg({ ok: true, text: `Applied — ${formatCurrency(res.discountAmount, currency)} off` });
        onChange({
          descriptor: { type: "voucher", voucherCode: code },
          amount: res.discountAmount,
          label: `Voucher ${code}`,
        });
      } else {
        setVoucherMsg({ ok: false, text: res.message ?? "Voucher not valid." });
        onChange(null);
      }
    } catch (e: any) {
      setVoucherMsg({ ok: false, text: e?.message ?? "Validation failed." });
    }
  };

  const applyLoyalty = () => {
    if (!customer) return;
    const reqPts = Math.floor(parseFloat(points) || 0);
    if (reqPts <= 0) return;
    // cap by balance and by subtotal
    const maxByValue = Math.floor(subtotal / LOYALTY_POINT_VALUE);
    const usePts = Math.min(reqPts, customer.loyaltyPoints, maxByValue);
    if (usePts <= 0) return;
    const amount = Math.round(usePts * LOYALTY_POINT_VALUE * 100) / 100;
    onChange({
      descriptor: { type: "loyalty", loyaltyPoints: usePts },
      amount,
      label: `${usePts} points`,
    });
  };

  return (
    <div className="rounded-xl border border-border bg-muted/10 overflow-hidden">
      {/* Header / toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold hover:bg-muted/30 transition-colors"
      >
        <span className="flex items-center gap-1.5 text-foreground">
          <Tag className="h-3.5 w-3.5 text-primary" />
          Discount
          {applied && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-success/15 text-success text-[10px] font-bold">
              –{formatCurrency(applied.amount, currency)} · {applied.label}
            </span>
          )}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", expanded && "rotate-180")} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="p-3 space-y-3">
              {/* Applied banner with clear */}
              {applied && (
                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-success/10 border border-success/20">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {applied.label} — {formatCurrency(applied.amount, currency)} off
                  </span>
                  <button onClick={clear} className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Tabs */}
              <div className="grid grid-cols-4 gap-1">
                {TABS.map(t => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => { setTab(t.id); setVoucherMsg(null); }}
                      className={cn(
                        "flex flex-col items-center gap-1 py-1.5 rounded-lg border text-[10px] font-semibold transition-all",
                        tab === t.id
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab body */}
              {tab === "percentage" && (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="number" min={0} max={100} value={pctValue}
                      onChange={e => setPctValue(e.target.value)}
                      placeholder="0" className="h-9 text-sm pr-7" />
                    <Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <Button size="sm" className="h-9" onClick={applyPercentage}>Apply</Button>
                </div>
              )}

              {tab === "fixed" && (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground">{currency}</span>
                    <Input
                      type="number" min={0} value={fixedValue}
                      onChange={e => setFixedValue(e.target.value)}
                      placeholder="0.00" className="h-9 text-sm pl-9 text-right" />
                  </div>
                  <Button size="sm" className="h-9" onClick={applyFixed}>Apply</Button>
                </div>
              )}

              {tab === "voucher" && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={voucherCode}
                      onChange={e => setVoucherCode(e.target.value.toUpperCase())}
                      onKeyDown={e => { if (e.key === "Enter") applyVoucher(); }}
                      placeholder="Enter voucher code" className="h-9 text-sm font-mono uppercase" />
                    <Button size="sm" className="h-9 min-w-[72px]" onClick={applyVoucher} disabled={validateVoucher.isPending}>
                      {validateVoucher.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
                    </Button>
                  </div>
                  {voucherMsg && (
                    <div className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium",
                      voucherMsg.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                    )}>
                      {voucherMsg.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                      {voucherMsg.text}
                    </div>
                  )}
                </div>
              )}

              {tab === "loyalty" && (
                <div className="space-y-2">
                  {!customer ? (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 px-1">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      Select a customer (cart header) to redeem loyalty points.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-[11px] px-1">
                        <span className="text-muted-foreground">{customer.name}&#39;s points</span>
                        <span className="font-bold text-warning flex items-center gap-1">
                          <Star className="h-3 w-3 fill-warning" />{customer.loyaltyPoints}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="number" min={0} max={customer.loyaltyPoints} value={points}
                          onChange={e => setPoints(e.target.value)}
                          placeholder="Points to redeem" className="h-9 text-sm" />
                        <Button size="sm" className="h-9" onClick={applyLoyalty}>Apply</Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground px-1">
                        1 point = {formatCurrency(LOYALTY_POINT_VALUE, currency)} · max {customer.loyaltyPoints} points
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
