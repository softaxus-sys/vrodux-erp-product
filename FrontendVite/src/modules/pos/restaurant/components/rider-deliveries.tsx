import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Bike, MapPin, Phone, Navigation, CheckCircle2, Loader2, Clock, Banknote, StickyNote, ArrowRight, PackageCheck,
} from "lucide-react";
import { cn, formatCurrency, parseApiDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useDeliveryOrders, useChangeDeliveryStatus } from "@/hooks/restaurant/use-restaurant";
import type { DeliveryOrder, DeliveryStatus } from "@/lib/restaurant/restaurant.api";

/**
 * What a rider sees instead of the dispatch board: only their own runs (the server decides which —
 * this screen never filters for access), laid out for a phone held in one hand. The destination is
 * the headline, with one tap to navigate and one to call, and a single full-width next step.
 */

const NEXT: Record<DeliveryStatus, DeliveryStatus | null> = {
  assigned: "picked_up", picked_up: "enroute", enroute: "delivered", delivered: null, failed: null,
};
/** The three legs of a run, in order — drives the progress strip. */
const STEPS: DeliveryStatus[] = ["picked_up", "enroute", "delivered"];
const stepsDone = (s: DeliveryStatus) => (s === "failed" ? 0 : STEPS.indexOf(s) + 1);
const isOpen = (d: DeliveryOrder) => d.status !== "delivered" && d.status !== "failed";

export function RiderDeliveries() {
  const { t } = useTranslation("restaurant");
  const { data: deliveries = [], isLoading } = useDeliveryOrders();
  const [showDone, setShowDone] = React.useState(false);

  const open = deliveries.filter(isOpen);
  const done = deliveries.filter(d => !isOpen(d));
  const shown = showDone ? done : open;

  return (
    // POS pages sit in a fixed-height shell that does not scroll, so this screen scrolls itself.
    <div className="flex-1 min-h-0 overflow-y-auto bg-muted/30">
      <div className="max-w-xl mx-auto px-4 py-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-md">
            <Bike className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-foreground leading-tight">{t("delivery.rider.title")}</h1>
            <p className="text-sm font-medium text-muted-foreground">{t("delivery.rider.subtitle")}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-card border border-border p-1 shadow-sm">
          {[{ done: false, label: t("delivery.rider.toDeliver"), n: open.length }, { done: true, label: t("delivery.rider.finished"), n: done.length }].map(tab => {
            const active = showDone === tab.done;
            return (
              <button key={String(tab.done)} onClick={() => setShowDone(tab.done)}
                className={cn("h-11 rounded-xl text-base font-extrabold flex items-center justify-center gap-2 transition-colors",
                  active ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground")}>
                {tab.label}
                <span className={cn("min-w-6 h-6 px-1.5 rounded-full text-xs font-black flex items-center justify-center tabular-nums",
                  active ? "bg-white/25" : "bg-muted")}>{tab.n}</span>
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-9 w-9 animate-spin text-primary" /></div>
        ) : shown.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <div className="h-16 w-16 mx-auto rounded-full bg-card border border-border flex items-center justify-center">
              <PackageCheck className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-lg font-extrabold text-foreground">{showDone ? t("delivery.rider.noneFinished") : t("delivery.rider.none")}</p>
            {!showDone && <p className="text-sm font-medium text-muted-foreground max-w-sm mx-auto">{t("delivery.rider.noneHint")}</p>}
          </div>
        ) : (
          shown.map(d => <RunCard key={d.id} delivery={d} />)
        )}
      </div>
    </div>
  );
}

function RunCard({ delivery: d }: { delivery: DeliveryOrder }) {
  const { t } = useTranslation("restaurant");
  const currency = useCurrency();
  const changeStatus = useChangeDeliveryStatus();
  const [confirmFail, setConfirmFail] = React.useState(false);

  const next = NEXT[d.status];
  const reached = stepsDone(d.status);
  const failed = d.status === "failed";
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d.address)}`;
  const toCollect = d.amountToCollect ?? 0;
  const dueBy = d.estimatedDeliveryAt && isOpen(d)
    ? parseApiDate(d.estimatedDeliveryAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="rounded-3xl bg-card border border-border shadow-sm overflow-hidden">
      {/* Where the run stands — three legs, filled as they are completed. */}
      <div className="px-5 pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-muted-foreground tracking-wide truncate">{d.orderNumber}</p>
          <span className={cn("text-xs font-extrabold uppercase tracking-wide whitespace-nowrap",
            failed ? "text-destructive" : d.status === "delivered" ? "text-success" : "text-primary")}>
            {t(`delivery.status.${d.status}`)}
          </span>
        </div>
        <div className="flex gap-1.5 mt-2">
          {STEPS.map((s, i) => (
            <div key={s} className={cn("h-1.5 flex-1 rounded-full",
              failed ? "bg-destructive/30" : i < reached ? (d.status === "delivered" ? "bg-success" : "bg-primary") : "bg-muted")} />
          ))}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Destination */}
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            {d.customerName && <p className="text-sm font-bold text-muted-foreground truncate">{d.customerName}</p>}
            <p className="text-xl font-black text-foreground leading-snug break-words">{d.address}</p>
            <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-1 text-sm font-semibold text-muted-foreground">
              <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{d.phone}</span>
              {d.deliveryZoneName && <span>{d.deliveryZoneName}</span>}
              {dueBy && <span className="flex items-center gap-1 text-warning"><Clock className="h-3.5 w-3.5" />{t("delivery.rider.dueBy", { time: dueBy })}</span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <a href={mapsUrl} target="_blank" rel="noreferrer"
            className="h-12 rounded-2xl bg-primary/10 text-primary text-base font-extrabold flex items-center justify-center gap-2 hover:bg-primary/15 active:scale-[0.98] transition-all">
            <Navigation className="h-5 w-5" />{t("delivery.rider.navigate")}
          </a>
          <a href={`tel:${d.phone}`}
            className="h-12 rounded-2xl bg-success/10 text-success text-base font-extrabold flex items-center justify-center gap-2 hover:bg-success/15 active:scale-[0.98] transition-all">
            <Phone className="h-5 w-5" />{t("delivery.rider.call")}
          </a>
        </div>

        {d.items && d.items.length > 0 && (
          <div className="rounded-2xl bg-muted/50 px-4 py-3 space-y-1.5">
            {d.items.map((i, idx) => (
              <div key={idx} className="flex gap-2.5 text-sm font-semibold text-foreground">
                <span className="tabular-nums font-black text-muted-foreground shrink-0">{i.quantity}×</span>
                <span className="min-w-0">{i.name}{i.notes && <span className="text-muted-foreground font-medium"> — {i.notes}</span>}</span>
              </div>
            ))}
          </div>
        )}

        {d.orderNotes && (
          <p className="flex items-start gap-2 rounded-2xl bg-warning/10 px-4 py-3 text-sm font-semibold text-warning">
            <StickyNote className="h-4 w-4 mt-0.5 shrink-0" />{d.orderNotes}
          </p>
        )}

        {/* What to take at the door. A fully paid order shows no figure — there is nothing to count. */}
        {toCollect > 0 ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-warning/40 bg-warning/10 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-extrabold text-warning"><Banknote className="h-5 w-5" />{t("delivery.rider.collect")}</span>
            <span className="text-2xl font-black tabular-nums text-foreground whitespace-nowrap">{formatCurrency(toCollect, currency)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl bg-success/10 px-4 py-3 text-sm font-extrabold text-success">
            <CheckCircle2 className="h-5 w-5 shrink-0" />{t("delivery.rider.paid")}
          </div>
        )}

        {isOpen(d) && (confirmFail ? (
          <div className="rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-4 space-y-3">
            <p className="text-sm font-bold text-foreground">{t("delivery.rider.failConfirm")}</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setConfirmFail(false)}
                className="h-12 rounded-xl border-2 border-border bg-card text-base font-extrabold">{t("delivery.rider.keep")}</button>
              <button disabled={changeStatus.isPending}
                onClick={() => changeStatus.mutate({ id: d.id, status: "failed" }, { onSettled: () => setConfirmFail(false) })}
                className="h-12 rounded-xl bg-destructive text-white text-base font-extrabold disabled:opacity-50">
                {t("delivery.rider.failYes")}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {next && (
              <button disabled={changeStatus.isPending} onClick={() => changeStatus.mutate({ id: d.id, status: next })}
                className={cn("w-full h-14 rounded-2xl text-lg font-black flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition-all disabled:opacity-50",
                  next === "delivered" ? "bg-success text-white" : "bg-primary text-primary-foreground")}>
                {changeStatus.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                {t(`delivery.rider.action.${next}`)}
                {!changeStatus.isPending && (next === "delivered" ? <CheckCircle2 className="h-5 w-5" /> : <ArrowRight className="h-5 w-5 rtl:rotate-180" />)}
              </button>
            )}
            <button onClick={() => setConfirmFail(true)}
              className="w-full h-10 text-sm font-bold text-muted-foreground hover:text-destructive transition-colors">
              {t("delivery.rider.fail")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
