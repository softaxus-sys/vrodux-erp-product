import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ChefHat, Bell, Timer, Loader2, Check, Users, ShoppingBag } from "lucide-react";
import { cn, parseApiDate } from "@/lib/utils";
import {
  useKitchenTickets, useMarkOrderReady, useServeOrder, useKitchenStations, useUpdateOrderItemStatus,
} from "@/hooks/restaurant/use-restaurant";
import { useRestaurantRealtime } from "@/hooks/restaurant/use-restaurant-realtime";
import type { KitchenTicket } from "@/lib/restaurant/restaurant.api";
import { useCan } from "@/components/auth/can";

/**
 * The kitchen screen is read from across a hot line, by someone with their hands full: big type,
 * oldest ticket first, and colour that says how long it has been waiting before anyone reads a number.
 */

const WARN_MINUTES = 10;
const LATE_MINUTES = 20;

/** Re-renders twice a minute so the waiting times stay honest without a timer per ticket. */
function useTick() {
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => { const id = setInterval(tick, 30_000); return () => clearInterval(id); }, []);
}

const waited = (tk: KitchenTicket) =>
  Math.max(0, Math.floor((Date.now() - parseApiDate(tk.createdAt).getTime()) / 60_000));

function TicketTitle({ ticket }: { ticket: KitchenTicket }) {
  const { t } = useTranslation("restaurant");
  return ticket.tableNumber
    ? <>{t("kitchen.tableLabel", { number: ticket.tableNumber })}</>
    : <span className="flex items-center gap-2"><ShoppingBag className="h-6 w-6" />{t("posView.takeaway")}</span>;
}

// ── A ticket being cooked ────────────────────────────────────────────────────────
function CookingTicket({ ticket, canEdit, busy, onReady, onToggleItem }: {
  ticket: KitchenTicket; canEdit: boolean; busy: boolean;
  onReady: () => void; onToggleItem: (itemId: string, done: boolean) => void;
}) {
  const { t } = useTranslation("restaurant");
  const mins = waited(ticket);
  const tone = mins >= LATE_MINUTES ? "late" : mins >= WARN_MINUTES ? "warn" : "fresh";
  const allDone = ticket.items.length > 0 && ticket.items.every(i => i.status === "ready" || i.status === "served");

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
      className={cn("flex flex-col rounded-2xl border-2 bg-card overflow-hidden",
        tone === "late" ? "border-destructive shadow-lg shadow-destructive/20" : tone === "warn" ? "border-warning" : "border-border")}>
      <div className={cn("px-4 py-3 flex items-center justify-between gap-3",
        tone === "late" ? "bg-destructive text-white" : tone === "warn" ? "bg-warning text-white" : "bg-slate-900 text-white dark:bg-slate-800")}>
        <div className="min-w-0">
          <p className="text-2xl font-black leading-tight truncate"><TicketTitle ticket={ticket} /></p>
          <p className="text-sm font-semibold opacity-80 truncate flex items-center gap-2">
            {ticket.waiter}<span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{ticket.covers}</span>
            <span>#{ticket.orderNumber.slice(-4)}</span>
          </p>
        </div>
        <span className={cn("flex items-center gap-1.5 text-2xl font-black tabular-nums shrink-0", tone === "late" && "animate-pulse")}>
          <Timer className="h-5 w-5" />{t("kitchen.minutes", { count: mins })}
        </span>
      </div>

      <div className="flex-1 p-2 space-y-1">
        {ticket.items.map(it => {
          const done = it.status === "ready" || it.status === "served";
          return (
            <button key={it.id} disabled={!canEdit} onClick={() => onToggleItem(it.id, !done)}
              className={cn("w-full flex items-start gap-3 px-2.5 py-2 rounded-xl text-start transition-colors",
                canEdit && "hover:bg-muted/60 active:bg-muted", done && "opacity-50")}>
              <span className={cn("min-w-[2.5rem] h-10 px-1.5 rounded-lg text-xl font-black flex items-center justify-center tabular-nums shrink-0",
                done ? "bg-success text-white" : "bg-muted text-foreground")}>
                {done ? <Check className="h-5 w-5" strokeWidth={3} /> : it.quantity}
              </span>
              <span className="flex-1 min-w-0">
                <span className={cn("block text-lg font-bold text-foreground leading-tight", done && "line-through")}>
                  {done && `${it.quantity}× `}{it.itemName}
                </span>
                {it.modifiers && <span className="block text-base font-bold text-warning">{it.modifiers}</span>}
                {it.courseNumber > 1 && <span className="block text-sm font-semibold text-muted-foreground">{t("kitchen.course", { number: it.courseNumber })}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {canEdit && (
        <div className="p-2 pt-0">
          <button disabled={busy} onClick={onReady}
            className={cn("w-full h-14 rounded-xl flex items-center justify-center gap-2 text-lg font-black transition-all active:scale-[0.98] disabled:opacity-50",
              allDone ? "bg-success text-white shadow-lg shadow-success/30" : "border-2 border-border text-foreground hover:border-success hover:text-success")}>
            <Bell className="h-5 w-5" />{t("kitchen.button.markReady")}
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ── A ticket waiting at the pass ─────────────────────────────────────────────────
function ReadyTicket({ ticket, canEdit, busy, onServe }: {
  ticket: KitchenTicket; canEdit: boolean; busy: boolean; onServe: () => void;
}) {
  const { t } = useTranslation("restaurant");
  return (
    <motion.div layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
      className="rounded-2xl border-2 border-success/50 bg-success/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xl font-black text-foreground truncate"><TicketTitle ticket={ticket} /></p>
        <span className="text-sm font-bold text-muted-foreground tabular-nums shrink-0">{t("kitchen.minutes", { count: waited(ticket) })}</span>
      </div>
      <p className="text-sm font-semibold text-muted-foreground truncate">
        {ticket.waiter} · {ticket.items.map(i => `${i.quantity}× ${i.itemName}`).join(", ")}
      </p>
      {canEdit && (
        <button disabled={busy} onClick={onServe}
          className="mt-2 w-full h-12 rounded-xl bg-success text-white text-base font-black flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50">
          <CheckCircle2 className="h-5 w-5" />{t("kitchen.button.markServed")}
        </button>
      )}
    </motion.div>
  );
}

// ── Main view ────────────────────────────────────────────────────────────────────
export function KitchenDisplayView() {
  const { t } = useTranslation("restaurant");
  useRestaurantRealtime();
  useTick();
  const canEdit = useCan("restaurant.kitchen.edit");
  const { data: stations = [] } = useKitchenStations();
  const [stationId, setStationId] = React.useState<string | undefined>(undefined);
  const { data: tickets = [], isLoading } = useKitchenTickets(stationId);
  const markReady  = useMarkOrderReady();
  const serve      = useServeOrder();
  const itemStatus = useUpdateOrderItemStatus();
  const busy = markReady.isPending || serve.isPending;

  // Oldest first — the ticket that has waited longest is always top-left.
  const byAge = (a: KitchenTicket, b: KitchenTicket) => parseApiDate(a.createdAt).getTime() - parseApiDate(b.createdAt).getTime();
  const cooking = tickets.filter(tk => tk.status === "sent").sort(byAge);
  const ready   = tickets.filter(tk => tk.status === "ready").sort(byAge);
  const lateCount = cooking.filter(tk => waited(tk) >= LATE_MINUTES).length;

  const chip = (active: boolean) => cn(
    "h-12 px-5 rounded-xl border-2 text-base font-bold whitespace-nowrap flex items-center gap-2 shrink-0 transition-colors",
    active ? "bg-foreground border-foreground text-background" : "bg-card border-border text-foreground hover:border-primary");

  return (
    <div className="flex flex-col h-full bg-muted/20 touch-manipulation">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 px-5 py-3 border-b-2 border-border bg-card shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <ChefHat className="h-7 w-7 text-foreground shrink-0 me-1" />
          {stations.length > 0 ? (
            <>
              <button onClick={() => setStationId(undefined)} className={chip(!stationId)}>{t("kitchen.allStations")}</button>
              {stations.map(s => (
                <button key={s.id} onClick={() => setStationId(s.id)} className={chip(stationId === s.id)}>
                  {s.colorTag && <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: s.colorTag }} />}
                  {s.displayName ?? s.name}
                </button>
              ))}
            </>
          ) : (
            <h1 className="text-2xl font-black text-foreground">{t("kitchen.title")}</h1>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isLoading && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
          <Stat value={cooking.length} label={t("kitchen.cooking")} className="bg-slate-900 text-white dark:bg-slate-800" />
          {lateCount > 0 && <Stat value={lateCount} label={t("kitchen.late")} className="bg-destructive text-white" />}
          <Stat value={ready.length} label={t("kitchen.readyShort")} className="bg-success text-white" />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Cooking */}
        <div className="flex-1 min-w-0 overflow-y-auto p-4">
          {cooking.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <ChefHat className="h-20 w-20 text-muted-foreground/25 mb-4" />
              <p className="text-2xl font-extrabold text-foreground">{t("kitchen.allClear")}</p>
              <p className="text-base font-medium text-muted-foreground mt-1">{t("kitchen.allClearHint")}</p>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(300px,1fr))] items-start">
              <AnimatePresence>
                {cooking.map(tk => (
                  <CookingTicket key={tk.id} ticket={tk} canEdit={canEdit} busy={busy}
                    onReady={() => markReady.mutate(tk.id)}
                    onToggleItem={(id, done) => itemStatus.mutate({ id, status: done ? "ready" : "pending" })} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Ready to serve */}
        <div className="w-[340px] shrink-0 flex flex-col border-s-2 border-border bg-card">
          <div className="px-4 py-3 border-b-2 border-border flex items-center justify-between">
            <p className="text-lg font-black text-foreground flex items-center gap-2"><Bell className="h-5 w-5 text-success" />{t("kitchen.columnReady")}</p>
            <span className="min-w-[2rem] h-8 px-2 rounded-full bg-success text-white text-base font-black flex items-center justify-center">{ready.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {ready.length === 0 ? (
              <p className="text-base font-semibold text-muted-foreground text-center py-16">{t("kitchen.nothingReady")}</p>
            ) : (
              <AnimatePresence>
                {ready.map(tk => (
                  <ReadyTicket key={tk.id} ticket={tk} canEdit={canEdit} busy={busy} onServe={() => serve.mutate(tk.id)} />
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label, className }: { value: number; label: string; className: string }) {
  return (
    <div className={cn("h-12 px-4 rounded-xl flex items-center gap-2", className)}>
      <span className="text-2xl font-black tabular-nums leading-none">{value}</span>
      <span className="text-sm font-bold uppercase tracking-wide opacity-90">{label}</span>
    </div>
  );
}
