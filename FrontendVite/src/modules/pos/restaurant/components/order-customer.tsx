import * as React from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Gift, Loader2, X } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useCan } from "@/components/auth/can";
import { useCustomer, customerKeys } from "@/hooks/pos/use-customers";
import { useSetOrderCustomer, useRedeemOrderLoyalty } from "@/hooks/restaurant/use-restaurant";
import type { RestaurantOrder } from "@/lib/restaurant/restaurant.api";
import { OrderCustomerPicker } from "./restaurant-pay-dialog";

/**
 * The customer on a bill, and their loyalty points. Linking a customer is what lets the order earn
 * points when it is paid and lets the guest spend the points they already have. One point is worth
 * one unit of currency, the same as at the retail till.
 */
export function OrderCustomer({ order, currency }: { order: RestaurantOrder; currency: string }) {
  const { t } = useTranslation("restaurant");
  const qc = useQueryClient();
  const canEdit = useCan("restaurant.orders.edit");
  const setCustomer = useSetOrderCustomer();
  const redeem = useRedeemOrderLoyalty();
  const { data: customer } = useCustomer(order.customerId ?? "");
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");

  const live = !["paid", "cancelled", "split", "held"].includes(order.status);
  const used = order.discounts.filter(d => !d.isVoided && d.type === "loyalty").reduce((s, d) => s + d.amount, 0);
  const balance = customer?.loyaltyPoints ?? 0;
  // Points already on this bill can be re-spent, so they count towards what is available here.
  const max = Math.floor(Math.min(balance + used, order.subTotal));
  const points = Math.floor(Number(input) || 0);
  const willEarn = Math.floor(order.total / 100);

  // The customer's balance lives in the POS cache, which a restaurant mutation does not refresh.
  const apply = (n: number) => redeem.mutate({ id: order.id, points: n }, {
    onSuccess: () => { setOpen(false); setInput(""); qc.invalidateQueries({ queryKey: customerKeys.all }); },
  });

  return (
    <div className="mt-3 space-y-2">
      <OrderCustomerPicker linkedCustomer={order.customerId ? customer ?? null : null} editable={live && canEdit}
        busy={setCustomer.isPending} currency={currency}
        onPick={customerId => setCustomer.mutate({ id: order.id, customerId })} />

      {order.customerId && customer && (
        <div className="rounded-xl border-2 border-border bg-muted/30 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-extrabold text-foreground min-w-0">
              <Gift className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{t("posView.loyalty.balance", { count: balance })}</span>
            </span>
            {used > 0 ? (
              <button disabled={!live || !canEdit || redeem.isPending} onClick={() => apply(0)}
                className="flex items-center gap-1 text-xs font-extrabold text-success hover:text-destructive disabled:opacity-60">
                {redeem.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {t("posView.loyalty.used", { count: used })}<X className="h-3.5 w-3.5" />
              </button>
            ) : live && canEdit && max > 0 ? (
              <button onClick={() => { setOpen(o => !o); setInput(String(max)); }}
                className="text-xs font-extrabold text-primary hover:underline whitespace-nowrap">{t("posView.loyalty.use")}</button>
            ) : null}
          </div>

          {open && used === 0 && (
            <div className="flex items-center gap-2 mt-2">
              <input autoFocus inputMode="numeric" value={input} onChange={e => setInput(e.target.value.replace(/\D/g, ""))}
                className="flex-1 min-w-0 h-10 px-3 rounded-lg border-2 border-border bg-card text-base font-black tabular-nums focus:outline-none focus:border-primary" />
              <button disabled={points < 1 || points > max || redeem.isPending} onClick={() => apply(points)}
                className={cn("h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-extrabold flex items-center gap-1.5 disabled:opacity-50")}>
                {redeem.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("posView.loyalty.apply", { amount: formatCurrency(Math.min(points, max), currency) })}
              </button>
            </div>
          )}
          {open && used === 0 && <p className="text-[11px] font-semibold text-muted-foreground mt-1">{t("posView.loyalty.max", { count: max })}</p>}

          {live && willEarn > 0 && (
            <p className="text-[11px] font-semibold text-muted-foreground mt-1">{t("posView.loyalty.willEarn", { count: willEarn })}</p>
          )}
        </div>
      )}
    </div>
  );
}
