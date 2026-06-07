"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Zap, Clock, CheckCircle2, ChefHat, AlertTriangle, Bell,
  Timer,
} from "lucide-react";
import {
  kdsOrders, kdsSummary,
  type KDSOrder, type KDSStatus,
} from "@/mock/data/pos.mock";

const STATUS_CONFIG: Record<KDSStatus, { label: string; color: string; bg: string; border: string; headerBg: string; dot: string }> = {
  received:  { label: "Received",  color: "text-muted-foreground", bg: "bg-muted/20",      border: "border-border",         headerBg: "bg-muted/30",       dot: "bg-muted-foreground" },
  preparing: { label: "Preparing", color: "text-warning",          bg: "bg-warning/5",     border: "border-warning/30",     headerBg: "bg-warning/10",     dot: "bg-warning" },
  ready:     { label: "Ready",     color: "text-success",          bg: "bg-success/5",     border: "border-success/30",     headerBg: "bg-success/10",     dot: "bg-success" },
  served:    { label: "Served",    color: "text-primary",          bg: "bg-primary/5",     border: "border-primary/30",     headerBg: "bg-primary/10",     dot: "bg-primary" },
};

const ITEM_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  received:  { label: "Waiting",   color: "text-muted-foreground", bg: "bg-muted/30" },
  pending:   { label: "Pending",   color: "text-muted-foreground", bg: "bg-muted/30" },
  preparing: { label: "Preparing", color: "text-warning",          bg: "bg-warning/10" },
  ready:     { label: "Ready",     color: "text-success",          bg: "bg-success/10" },
  served:    { label: "Served",    color: "text-primary",          bg: "bg-primary/10" },
};

const SECTION_EMOJI: Record<string, string> = {
  indoor: "🏠", outdoor: "☀️", terrace: "🌅", private: "🍽️",
};

// ─── Elapsed Timer ────────────────────────────────────────────────────────────
function ElapsedTime({ isoTime }: { isoTime: string | null }) {
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    if (!isoTime) return;
    const update = () => {
      const diff = Math.floor((Date.now() - new Date(isoTime).getTime()) / 1000);
      setElapsed(diff);
    };
    update();
    const id = setInterval(update, 10000);
    return () => clearInterval(id);
  }, [isoTime]);

  if (!isoTime) return <span className="text-muted-foreground">—</span>;

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const isLate = mins >= 20;

  return (
    <span className={`flex items-center gap-1 text-xs font-mono ${isLate ? "text-destructive" : "text-muted-foreground"}`}>
      <Timer className="w-3 h-3" />
      {mins}:{String(secs).padStart(2, "0")}
      {isLate && " ⚠️"}
    </span>
  );
}

// ─── KDS Order Card ───────────────────────────────────────────────────────────
function KDSCard({ order, onAdvance }: { order: KDSOrder; onAdvance: (id: string) => void }) {
  const cfg = STATUS_CONFIG[order.status];
  const isRush = order.priority === "rush";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`border rounded-xl overflow-hidden ${cfg.border} ${isRush ? "ring-2 ring-destructive/40" : ""}`}
    >
      {/* Card Header */}
      <div className={`px-4 py-3 ${cfg.headerBg} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          {isRush && <Zap className="w-4 h-4 text-destructive" />}
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-foreground">{order.orderNumber}</p>
              <span className="text-xs text-muted-foreground">
                {SECTION_EMOJI[order.section]} Table {order.tableNumber}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{order.waiter}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          {isRush && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-bold">
              <Zap className="w-2.5 h-2.5" /> RUSH
            </span>
          )}
          <ElapsedTime isoTime={order.startedAt ?? order.receivedAt} />
        </div>
      </div>

      {/* Allergy / Notes Banner */}
      {order.notes && (
        <div className="px-4 py-2 bg-warning/10 border-b border-warning/20 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0" />
          <p className="text-xs text-warning font-medium">{order.notes}</p>
        </div>
      )}

      {/* Items */}
      <div className={`p-4 space-y-2.5 ${cfg.bg}`}>
        {order.items.map(item => {
          const ic = ITEM_STATUS_CONFIG[item.status] ?? ITEM_STATUS_CONFIG.pending;
          return (
            <div key={item.id} className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <div className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded-full flex items-center justify-center ${
                  item.status === "ready" ? "bg-success" : item.status === "preparing" ? "bg-warning" : "bg-muted/60"
                }`}>
                  {item.status === "ready" && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {item.quantity > 1 && <span className="text-primary mr-1">×{item.quantity}</span>}
                    {item.name}
                  </p>
                  {item.notes && (
                    <p className={`text-xs mt-0.5 ${item.notes.includes("⚠️") ? "text-warning font-medium" : "text-muted-foreground italic"}`}>
                      {item.notes}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full ${ic.bg} ${ic.color}`}>{ic.label}</span>
                <span className="text-xs text-muted-foreground">{item.prepTime}m</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border flex gap-2">
        {order.status === "received" && (
          <Button size="sm" className="flex-1" onClick={() => onAdvance(order.id)}>
            Start Preparing
          </Button>
        )}
        {order.status === "preparing" && (
          <Button size="sm" className="flex-1" onClick={() => onAdvance(order.id)}>
            <Bell className="w-3.5 h-3.5 mr-1.5" /> Mark Ready
          </Button>
        )}
        {order.status === "ready" && (
          <Button size="sm" variant="outline" className="flex-1 border-success text-success" onClick={() => onAdvance(order.id)}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Mark Served
          </Button>
        )}
        {order.status === "served" && (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-success" /> Served
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────
export function KitchenDisplayView() {
  const [orders, setOrders] = React.useState<KDSOrder[]>(kdsOrders);
  const [priorityFilter, setPriorityFilter] = React.useState<string>("all");

  const advanceStatus = React.useCallback((id: string) => {
    const NEXT: Record<KDSStatus, KDSStatus> = {
      received: "preparing",
      preparing: "ready",
      ready: "served",
      served: "served",
    };
    setOrders(prev =>
      prev.map(o => {
        if (o.id !== id) return o;
        const next = NEXT[o.status];
        return {
          ...o,
          status: next,
          startedAt: o.startedAt ?? new Date().toISOString(),
          readyAt: next === "ready" ? new Date().toISOString() : o.readyAt,
        };
      })
    );
  }, []);

  const filtered = React.useMemo(() => {
    return orders.filter(o =>
      priorityFilter === "all" || o.priority === priorityFilter
    );
  }, [orders, priorityFilter]);

  const COLUMNS: { status: KDSStatus; label: string; icon: React.ReactNode }[] = [
    { status: "received",  label: "Received",  icon: <Clock className="w-4 h-4 text-muted-foreground" /> },
    { status: "preparing", label: "Preparing", icon: <ChefHat className="w-4 h-4 text-warning" /> },
    { status: "ready",     label: "Ready",     icon: <Bell className="w-4 h-4 text-success" /> },
    { status: "served",    label: "Served",    icon: <CheckCircle2 className="w-4 h-4 text-primary" /> },
  ];

  return (
    <div className="flex flex-col h-full bg-muted/20">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <ChefHat className="w-5 h-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Kitchen Display</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {kdsSummary.received} received · {kdsSummary.preparing} preparing · {kdsSummary.ready} ready
              {kdsSummary.rush > 0 && (
                <span className="ml-2 text-destructive font-semibold flex-inline items-center gap-1">
                  · ⚡ {kdsSummary.rush} rush
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {[
            { value: "all",    label: "All Orders" },
            { value: "rush",   label: "⚡ Rush Only" },
            { value: "normal", label: "Normal" },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setPriorityFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                priorityFilter === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KDS Board */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-4 gap-0 divide-x divide-border">
          {COLUMNS.map(col => {
            const colOrders = filtered.filter(o => o.status === col.status);
            const cfg = STATUS_CONFIG[col.status];
            return (
              <div key={col.status} className="flex flex-col h-full overflow-hidden">
                {/* Column Header */}
                <div className={`px-4 py-3 border-b border-border flex items-center justify-between ${cfg.headerBg}`}>
                  <div className="flex items-center gap-2">
                    {col.icon}
                    <span className={`text-sm font-semibold ${cfg.color}`}>{col.label}</span>
                  </div>
                  <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${cfg.bg} ${cfg.color}`}>
                    {colOrders.length}
                  </span>
                </div>

                {/* Column Cards */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {colOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className={`w-8 h-8 rounded-full ${cfg.bg} flex items-center justify-center mb-2`}>
                        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      </div>
                      <p className="text-xs text-muted-foreground">No orders</p>
                    </div>
                  ) : (
                    colOrders.map(order => (
                      <KDSCard key={order.id} order={order} onAdvance={advanceStatus} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
