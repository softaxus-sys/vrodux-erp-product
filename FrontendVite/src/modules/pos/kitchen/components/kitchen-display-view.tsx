import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChefHat, Bell, Timer, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useKitchenTickets, useKitchenSummary, useMarkOrderReady, useServeOrder, useKitchenStations,
} from "@/hooks/restaurant/use-restaurant";
import { useRestaurantRealtime } from "@/hooks/restaurant/use-restaurant-realtime";
import type { KitchenTicket } from "@/lib/restaurant/restaurant.api";
import { Can } from "@/components/auth/can";

const LATE_MINUTES = 20;

// ── Elapsed time from createdAt ─────────────────────────────────────────────────
function Elapsed({ from }: { from: string }) {
  const { t } = useTranslation("restaurant");
  const [, tick] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => { const id = setInterval(tick, 30_000); return () => clearInterval(id); }, []);
  const mins = Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 60000));
  const late = mins >= LATE_MINUTES;
  return (
    <span className={cn("flex items-center gap-1 text-xs font-mono", late ? "text-destructive font-bold" : "text-muted-foreground")}>
      <Timer className="w-3 h-3" />{t("kitchen.minutes", { count: mins })}{late && " ⚠️"}
    </span>
  );
}

// ── Ticket card ─────────────────────────────────────────────────────────────────
function TicketCard({ ticket, onReady, onServe, busy }: {
  ticket: KitchenTicket; onReady: (id: string) => void; onServe: (id: string) => void; busy: boolean;
}) {
  const { t } = useTranslation("restaurant");
  const isReady = ticket.status === "ready";
  const late = ticket.waitMinutes >= LATE_MINUTES;
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
      className={cn("border rounded-xl overflow-hidden bg-card",
        isReady ? "border-success/40" : late ? "border-destructive/40 ring-1 ring-destructive/20" : "border-warning/40")}>
      <div className={cn("px-4 py-3 flex items-center justify-between", isReady ? "bg-success/10" : "bg-warning/10")}>
        <div>
          <p className="text-sm font-bold text-foreground">{t("kitchen.tableLabel", { number: ticket.tableNumber })}</p>
          <p className="text-xs text-muted-foreground">{ticket.orderNumber.slice(-8)} · {ticket.waiter} · {t("kitchen.covers", { count: ticket.covers })}</p>
        </div>
        <Elapsed from={ticket.createdAt} />
      </div>

      <div className="p-4 space-y-2">
        {ticket.items.map(it => (
          <div key={it.id} className="flex items-start gap-2">
            <span className="text-primary font-bold text-sm shrink-0">×{it.quantity}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {it.itemName}
                {it.courseNumber > 1 && <span className="ml-1.5 text-[10px] font-medium text-muted-foreground">{t("kitchen.course", { number: it.courseNumber })}</span>}
              </p>
              {it.modifiers && <p className="text-xs text-warning italic">{it.modifiers}</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-border">
        <Can permission="restaurant.kitchen.edit">
          {!isReady ? (
            <Button size="sm" className="w-full" disabled={busy} onClick={() => onReady(ticket.id)}>
              <Bell className="w-3.5 h-3.5 mr-1.5" /> {t("kitchen.button.markReady")}
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="w-full border-success text-success" disabled={busy} onClick={() => onServe(ticket.id)}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> {t("kitchen.button.markServed")}
            </Button>
          )}
        </Can>
      </div>
    </motion.div>
  );
}

// ── Main view ────────────────────────────────────────────────────────────────────
export function KitchenDisplayView() {
  const { t } = useTranslation("restaurant");
  useRestaurantRealtime();
  const { data: stations = [] } = useKitchenStations();
  const [stationId, setStationId] = React.useState<string | undefined>(undefined);
  const { data: tickets = [], isLoading } = useKitchenTickets(stationId);
  const { data: summary } = useKitchenSummary();
  const markReady = useMarkOrderReady();
  const serve     = useServeOrder();
  const busy = markReady.isPending || serve.isPending;

  const newOrders   = tickets.filter(t => t.status === "sent");
  const readyOrders = tickets.filter(t => t.status === "ready");

  const Column = ({ title, icon, items, tone }: { title: string; icon: React.ReactNode; items: KitchenTicket[]; tone: string }) => (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={cn("px-4 py-3 border-b border-border flex items-center justify-between", tone)}>
        <div className="flex items-center gap-2">{icon}<span className="text-sm font-semibold text-foreground">{title}</span></div>
        <span className="w-6 h-6 rounded-full bg-card text-xs font-bold flex items-center justify-center">{items.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ChefHat className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">{t("kitchen.noOrders")}</p>
          </div>
        ) : (
          <AnimatePresence>
            {items.map(tk => (
              <TicketCard key={tk.id} ticket={tk} busy={busy}
                onReady={id => markReady.mutate(id)} onServe={id => serve.mutate(id)} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-muted/20">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <ChefHat className="w-5 h-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-bold text-foreground">{t("kitchen.title")}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("kitchen.summary", {
                new:   summary?.sentToKitchen ?? newOrders.length,
                ready: summary?.ready ?? readyOrders.length,
              })}
            </p>
          </div>
        </div>
        {isLoading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
      </div>

      {stations.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto px-4 py-2 border-b border-border bg-card shrink-0 scrollbar-none">
          <button onClick={() => setStationId(undefined)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap",
              !stationId ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50")}>
            {t("kitchen.allStations")}
          </button>
          {stations.map(s => (
            <button key={s.id} onClick={() => setStationId(s.id)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1.5",
                stationId === s.id ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50")}>
              {s.colorTag && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.colorTag }} />}
              {s.displayName ?? s.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-2 divide-x divide-border">
          <Column title={t("kitchen.columnNew")}   icon={<Send className="w-4 h-4 text-warning" />} items={newOrders} tone="bg-warning/10" />
          <Column title={t("kitchen.columnReady")} icon={<Bell className="w-4 h-4 text-success" />} items={readyOrders} tone="bg-success/10" />
        </div>
      </div>
    </div>
  );
}
