import * as React from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Printer, X } from "lucide-react";
import { cn, formatCurrency, parseApiDate } from "@/lib/utils";
import { useCompanyBranding } from "@/hooks/use-company-name";
import type { RestaurantOrder } from "@/lib/restaurant/restaurant.api";

/**
 * The tax receipt for a settled order, shown on screen straight after payment and reopenable from
 * a paid order. It is laid out like the paper slip so what the cashier sees is what the guest gets;
 * Print sends this same markup to the browser's print dialog (a receipt printer, or Save as PDF).
 */
export function OrderReceiptModal({ order, currency, justPaid, onClose }: {
  order: RestaurantOrder; currency: string; justPaid?: boolean; onClose: () => void;
}) {
  const { t } = useTranslation("restaurant");
  const company = useCompanyBranding();
  const slipRef = React.useRef<HTMLDivElement>(null);

  const money = (n: number) => formatCurrency(n, currency);
  const taxable = order.subTotal - order.discountAmount;
  // The order stores the tax amount, not the rate — shown only when it works out to a clean figure.
  const rate = taxable > 0 && order.taxAmount > 0 ? Math.round((order.taxAmount / taxable) * 1000) / 10 : null;
  const refunded = order.refunds.reduce((sum, r) => sum + r.amount, 0);
  const change = Math.max(0, order.amountPaid - order.total - order.tipAmount);
  const when = parseApiDate(order.payments[order.payments.length - 1]?.createdAt ?? order.createdAt);
  const items = order.items.filter(i => i.status !== "voided" && i.status !== "cancelled");

  const print = () => {
    const slip = slipRef.current;
    if (!slip) return;
    const w = window.open("", "_blank", "width=420,height=720");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${order.orderNumber}</title><style>
      *{box-sizing:border-box} body{margin:0;padding:12px;font:13px/1.45 ui-monospace,Menlo,Consolas,monospace;color:#000;background:#fff}
      .slip{width:76mm;margin:0 auto} h1{font-size:17px;margin:0;text-align:center} .c{text-align:center} .m{color:#444}
      .row{display:flex;justify-content:space-between;gap:10px} .row>span:last-child{white-space:nowrap;text-align:right}
      .rule{border-top:1px dashed #000;margin:7px 0} .b{font-weight:700} .big{font-size:16px} .sub{padding-left:14px;color:#444;font-size:12px}
      .title{letter-spacing:.14em;font-weight:700;text-align:center;margin:6px 0} img{max-height:48px;display:block;margin:0 auto 6px}
      @page{margin:6mm}</style></head><body><div class="slip">${slip.innerHTML}</div></body></html>`);
    w.document.close();
    w.focus();
    // Give a logo a moment to decode, or the first print comes out without it.
    setTimeout(() => { w.print(); w.close(); }, 350);
  };

  const Row = ({ label, value, strong, big }: { label: string; value: string; strong?: boolean; big?: boolean }) => (
    <div className={cn("row flex justify-between gap-3", strong && "b font-bold", big && "big text-lg")}>
      <span>{label}</span><span className="tabular-nums whitespace-nowrap">{value}</span>
    </div>
  );
  const Rule = () => <div className="rule border-t border-dashed border-neutral-400 my-2" />;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm max-h-[94vh] flex flex-col rounded-2xl bg-card border-2 border-border shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b-2 border-border">
          <p className="flex items-center gap-2 text-lg font-black text-foreground">
            {justPaid && <CheckCircle2 className="h-6 w-6 text-success" />}
            {justPaid ? t("posView.receiptView.paid") : t("posView.receiptView.heading")}
          </p>
          <button onClick={onClose} className="h-10 w-10 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-muted/40">
          {/* Always paper-white: it is a picture of the slip, not part of the app's theme. */}
          <div ref={slipRef} className="mx-auto max-w-[320px] bg-white text-black rounded-lg shadow p-4 font-mono text-[13px] leading-relaxed">
            {company.logoUrl && <img src={company.logoUrl} alt="" className="max-h-12 mx-auto mb-2" />}
            <h1 className="text-center text-base font-bold">{company.name}</h1>
            {company.address && <div className="c m text-center text-neutral-600 whitespace-pre-line">{company.address}</div>}
            {company.phone && <div className="c m text-center text-neutral-600">{company.phone}</div>}
            {company.taxNumber && <div className="c text-center">{t("posView.receiptView.taxNo")}: {company.taxNumber}</div>}

            <div className="title text-center font-bold tracking-[0.14em] my-2">
              {company.taxNumber ? t("posView.receiptView.taxInvoice") : t("posView.receiptView.receipt")}
            </div>

            <Row label={t("posView.receiptView.orderNo")} value={order.orderNumber} />
            <Row label={t("posView.receiptView.date")} value={when.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} />
            {order.tableNumber && <Row label={t("posView.receiptView.table")} value={order.tableNumber} />}
            {order.waiter && <Row label={t("posView.receiptView.servedBy")} value={order.waiter} />}
            {order.covers > 0 && <Row label={t("posView.receiptView.guests")} value={String(order.covers)} />}
            <Rule />

            {items.map(i => (
              <div key={i.id}>
                <Row label={`${i.quantity} × ${i.itemName}`} value={money(i.lineTotal)} />
                {i.selectedModifiers.map(m => (
                  <div key={m.id} className="sub ps-4 text-xs text-neutral-600">
                    + {m.name}{m.priceDelta ? ` (${money(m.priceDelta)})` : ""}
                  </div>
                ))}
                {i.modifiers && <div className="sub ps-4 text-xs text-neutral-600">{i.modifiers}</div>}
              </div>
            ))}
            <Rule />

            <Row label={t("posView.receiptView.subtotal")} value={money(order.subTotal)} />
            {order.discountAmount > 0 && <Row label={t("posView.receiptView.discount")} value={`− ${money(order.discountAmount)}`} />}
            <Row label={rate !== null ? `${t("posView.receiptView.tax")} (${rate}%)` : t("posView.receiptView.tax")} value={money(order.taxAmount)} />
            {order.tipAmount > 0 && <Row label={t("posView.receiptView.tip")} value={money(order.tipAmount)} />}
            <Rule />
            <Row strong big label={t("posView.receiptView.total")} value={money(order.total + order.tipAmount)} />
            <Rule />

            {order.payments.map(p => (
              <Row key={p.id} label={`${p.method}${p.reference ? ` · ${p.reference}` : ""}`} value={money(p.amount)} />
            ))}
            {change > 0 && <Row label={t("posView.receiptView.change")} value={money(change)} />}
            {refunded > 0 && <Row strong label={t("posView.receiptView.refunded")} value={`− ${money(refunded)}`} />}
            {order.outstanding > 0 && <Row strong label={t("posView.receiptView.balanceDue")} value={money(order.outstanding)} />}

            <Rule />
            <div className="c text-center">{t("posView.receiptView.thanks")}</div>
          </div>
        </div>

        <div className="shrink-0 flex gap-2 p-3 border-t-2 border-border">
          <button onClick={print}
            className="flex-1 h-14 rounded-xl border-2 border-border bg-card text-base font-extrabold flex items-center justify-center gap-2 hover:border-primary">
            <Printer className="h-5 w-5" />{t("posView.receiptView.print")}
          </button>
          <button onClick={onClose} autoFocus
            className="flex-1 h-14 rounded-xl bg-primary text-primary-foreground text-base font-black hover:brightness-110">
            {t("posView.receiptView.done")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
