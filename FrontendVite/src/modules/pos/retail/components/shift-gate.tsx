/**
 * ShiftGate — mandatory shift management wrapper for the POS system.
 *
 * Flow:
 *  1. Mount → query active sessions (loading spinner shown)
 *  2. No active session → full-screen OpenShiftScreen (non-dismissable)
 *  3. Active session → render children; provide ShiftContext
 *
 * CloseShiftPanel: accessible to users with pos.sessions.approve permission.
 * Cashiers can open shifts but cannot close them (supervisor must close).
 *
 * Country-aware cash denomination counter (PKR / AED).
 */

import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  PlayCircle, LogOut, Clock, DollarSign, TrendingUp,
  ReceiptText, AlertTriangle, Loader2, ChevronRight,
  CheckCircle2, X, Minus, Plus, RotateCcw, ShoppingCart,
  User2, Calendar, Terminal, FileText, Banknote, ArrowLeft,
  LayoutDashboard, UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useActiveSessions, useOpenSession, useCloseSession } from "@/hooks/pos/use-sessions";
import { useTransactions } from "@/hooks/pos/use-transactions";
import type { POSSessionSummaryDto } from "@/lib/pos/types";

// ─── Country denomination config ──────────────────────────────────────────────

interface Denomination { value: number; label: string; type: "note" | "coin" }

const PKR_DENOMINATIONS: Denomination[] = [
  { value: 5000, label: "5,000",   type: "note" },
  { value: 1000, label: "1,000",   type: "note" },
  { value: 500,  label: "500",     type: "note" },
  { value: 100,  label: "100",     type: "note" },
  { value: 50,   label: "50",      type: "note" },
  { value: 20,   label: "20",      type: "note" },
  { value: 10,   label: "10",      type: "coin" },
  { value: 5,    label: "5",       type: "coin" },
  { value: 2,    label: "2",       type: "coin" },
  { value: 1,    label: "1",       type: "coin" },
];

const AED_DENOMINATIONS: Denomination[] = [
  { value: 1000, label: "1,000",  type: "note" },
  { value: 500,  label: "500",   type: "note" },
  { value: 200,  label: "200",   type: "note" },
  { value: 100,  label: "100",   type: "note" },
  { value: 50,   label: "50",    type: "note" },
  { value: 20,   label: "20",    type: "note" },
  { value: 10,   label: "10",    type: "note" },
  { value: 5,    label: "5",     type: "coin" },
  { value: 1,    label: "1",     type: "coin" },
  { value: 0.5,  label: "0.50",  type: "coin" },
  { value: 0.25, label: "0.25",  type: "coin" },
];

const CURRENCY_TO_COUNTRY_SHIFT: Record<string, string> = {
  AED: "ae", PKR: "pk", SAR: "sa", OMR: "om",
  INR: "in", GBP: "gb", USD: "us",
};

function getDenominations(country?: string | null, currency?: string | null): { denoms: Denomination[]; currency: string } {
  // Resolve country code — check stored string first, then fall back to currency
  const c = (country ?? "").toLowerCase().trim();
  const isUAE =
    c === "ae" || c.includes("uae") || c.includes("emirates") ||
    (!!currency && CURRENCY_TO_COUNTRY_SHIFT[currency.toUpperCase()] === "ae");

  if (isUAE) return { denoms: AED_DENOMINATIONS, currency: "AED" };
  // TODO: add SAR, OMR, GBP, INR denominations when needed
  return { denoms: PKR_DENOMINATIONS, currency: "PKR" };
}

function fmtMoney(n: number, currency: string) {
  return `${currency} ${n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Parse a UTC datetime string from the backend.
 * The backend sends ISO-8601 without a timezone suffix (e.g. "2026-06-02T13:23:21.91").
 * Without "Z", browsers parse the string as LOCAL time, inflating durations by the
 * UTC offset. We force UTC by appending "Z" when no timezone indicator is present.
 */
function parseUtcDate(s: string): Date {
  if (!s) return new Date(NaN);
  const hasTimezone = s.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(s);
  return new Date(hasTimezone ? s : s + "Z");
}

function fmtDuration(openedAt: string): string {
  const ms = Date.now() - parseUtcDate(openedAt).getTime();
  const h  = Math.floor(ms / 3600000);
  const m  = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── Cash Denomination Counter ────────────────────────────────────────────────

function CashCounter({
  currency,
  denoms,
  counts,
  onChange,
}: {
  currency: string;
  denoms: Denomination[];
  counts: Record<number, number>;
  onChange: (value: number, qty: number) => void;
}) {
  const total = denoms.reduce((s, d) => s + d.value * (counts[d.value] ?? 0), 0);
  const notes = denoms.filter(d => d.type === "note");
  const coins = denoms.filter(d => d.type === "coin");

  const DenomSection = ({ items, label }: { items: Denomination[]; label: string }) => (
    <div>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2">{label}</p>
      <div className="grid grid-cols-2 gap-1.5">
        {items.map(d => {
          const qty = counts[d.value] ?? 0;
          const subtotal = d.value * qty;
          return (
            <div key={d.value} className={cn(
              "flex items-center gap-1.5 p-2 rounded-xl border transition-colors",
              qty > 0 ? "border-primary/40 bg-primary/5" : "border-border bg-muted/20"
            )}>
              <span className={cn(
                "text-xs font-bold min-w-[36px] text-right tabular-nums",
                qty > 0 ? "text-primary" : "text-muted-foreground"
              )}>
                {d.label}
              </span>
              <span className="text-muted-foreground text-[10px]">×</span>
              <div className="flex items-center gap-0.5 flex-1">
                <button
                  onClick={() => onChange(d.value, Math.max(0, qty - 1))}
                  className="w-5 h-5 rounded-md bg-muted/60 hover:bg-muted flex items-center justify-center shrink-0">
                  <Minus className="w-2.5 h-2.5" />
                </button>
                <input
                  type="number"
                  min={0}
                  value={qty || ""}
                  placeholder="0"
                  onChange={e => onChange(d.value, Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-10 text-center text-xs font-bold bg-transparent border-none outline-none tabular-nums"
                />
                <button
                  onClick={() => onChange(d.value, qty + 1)}
                  className="w-5 h-5 rounded-md bg-muted/60 hover:bg-muted flex items-center justify-center shrink-0">
                  <Plus className="w-2.5 h-2.5" />
                </button>
              </div>
              <span className={cn(
                "text-[10px] font-mono min-w-[48px] text-right tabular-nums",
                qty > 0 ? "text-primary font-bold" : "text-muted-foreground"
              )}>
                {subtotal > 0 ? subtotal.toLocaleString("en") : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <DenomSection items={notes} label="Notes" />
      {coins.length > 0 && <DenomSection items={coins} label="Coins" />}
      {/* Total */}
      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-primary/10 border border-primary/20">
        <span className="text-sm font-bold text-primary">Total Cash</span>
        <span className="text-lg font-black text-primary tabular-nums">{fmtMoney(total, currency)}</span>
      </div>
    </div>
  );
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface ShiftContextValue {
  session:       POSSessionSummaryDto;
  sessionId:     string;
  shiftDuration: string;        // "2h 15m" — live ticking
  canCloseShift: boolean;
  openClosePanel: () => void;   // opens the CloseShiftPanel
}

const ShiftContext = React.createContext<ShiftContextValue | null>(null);

export function useShift(): ShiftContextValue {
  const ctx = React.useContext(ShiftContext);
  if (!ctx) throw new Error("useShift must be used inside <ShiftGate>");
  return ctx;
}

// ─── Open Shift Screen ────────────────────────────────────────────────────────

function OpenShiftScreen({ onOpened }: { onOpened: (s: POSSessionSummaryDto) => void }) {
  const { user, tenant, logout } = useAuthStore();
  const openMutation = useOpenSession();
  const navigate     = useNavigate();

  // "choice" = landing screen with action cards
  // "form"   = open-shift form (info → cash steps)
  const [mode, setMode] = React.useState<"choice" | "form">("choice");

  const { denoms, currency } = getDenominations(tenant?.country, tenant?.currency);
  const [counts, setCounts]     = React.useState<Record<number, number>>({});
  const [registerId, setRegisterId] = React.useState("Terminal-1");
  const [notes, setNotes]       = React.useState("");
  const [step, setStep]         = React.useState<"info" | "cash">("info");

  const openingCash = denoms.reduce((s, d) => s + d.value * (counts[d.value] ?? 0), 0);
  const now = new Date();

  const handleOpen = async () => {
    try {
      const s = await openMutation.mutateAsync({ registerId, openingCash, notes: notes || null });
      onOpened({ id: s.id, registerId: s.registerId, status: s.status, openedAt: s.openedAt, totalTransactions: 0, netSales: 0 });
    } catch { /* toast in hook */ }
  };

  const handleSwitchUser = async () => {
    await logout();
    navigate("/auth/login");
  };

  // ── Shared top bar ──────────────────────────────────────────────────────────
  const TopBar = () => (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card shrink-0">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <ShoppingCart className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold leading-none">{tenant?.branding?.companyName ?? "Vrodux POS"}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Point of Sale Terminal</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" />
        {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </div>
    </div>
  );

  // ── Choice landing ──────────────────────────────────────────────────────────
  if (mode === "choice") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <TopBar />

        <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
          <div className="w-full max-w-lg space-y-6">

            {/* User identity card */}
            <motion.div
              initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4 shadow-sm"
            >
              <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <User2 className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-base leading-tight">{user?.name ?? "Cashier"}</p>
                <p className="text-xs text-muted-foreground capitalize mt-0.5">{user?.role?.replace(/_/g, " ") ?? "Cashier"}</p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">{user?.email}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Now</p>
                <p className="text-sm font-bold tabular-nums">
                  {now.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", hour12: true })}
                </p>
              </div>
            </motion.div>

            {/* ── Primary action: Open Shift ── */}
            <motion.button
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.05 }}
              onClick={() => setMode("form")}
              className="w-full group relative overflow-hidden rounded-2xl border-2 border-success/40 bg-success/5 hover:bg-success/10 hover:border-success/60 transition-all duration-200 p-6 text-left shadow-sm hover:shadow-md"
            >
              <div className="flex items-center gap-5">
                <div className="h-14 w-14 rounded-2xl bg-success/15 border border-success/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <PlayCircle className="h-8 w-8 text-success" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-black text-success leading-tight">Open New Shift</p>
                  <p className="text-sm text-muted-foreground mt-0.5">Start your POS session for this terminal</p>
                </div>
                <ChevronRight className="h-5 w-5 text-success/60 group-hover:translate-x-1 transition-transform shrink-0" />
              </div>
            </motion.button>

            {/* ── Secondary actions row ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.10 }}
              className="grid grid-cols-2 gap-3"
            >
              {/* Back to Dashboard */}
              <button
                onClick={() => navigate("/dashboard")}
                className="group flex flex-col items-center gap-3 p-5 rounded-2xl border border-border bg-card hover:bg-muted/40 hover:border-primary/30 transition-all duration-200 text-center shadow-sm hover:shadow"
              >
                <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <LayoutDashboard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight">Back to Dashboard</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Continue without opening shift</p>
                </div>
              </button>

              {/* Switch User */}
              <button
                onClick={handleSwitchUser}
                className="group flex flex-col items-center gap-3 p-5 rounded-2xl border border-border bg-card hover:bg-warning/5 hover:border-warning/40 transition-all duration-200 text-center shadow-sm hover:shadow"
              >
                <div className="h-11 w-11 rounded-xl bg-warning/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <UserCog className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight">Switch User</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Log out &amp; sign in as another cashier</p>
                </div>
              </button>
            </motion.div>

          </div>
        </div>
      </div>
    );
  }

  // ── Open Shift Form ─────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <TopBar />

      {/* Main */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-lg">

          {/* Heading with back button */}
          <div className="text-center mb-8">
            <motion.div
              className="w-20 h-20 rounded-2xl bg-success/10 border-2 border-success/30 flex items-center justify-center mx-auto mb-4"
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}>
              <PlayCircle className="h-10 w-10 text-success" />
            </motion.div>
            <h1 className="text-2xl font-black">Open Shift</h1>
            <p className="text-sm text-muted-foreground mt-1">Count your cash drawer before starting the shift</p>
            <button
              onClick={() => { setStep("info"); setMode("choice"); }}
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" /> Back to options
            </button>
          </div>

          {/* Step tabs */}
          <div className="flex rounded-xl border border-border overflow-hidden mb-6 shrink-0">
            {(["info", "cash"] as const).map((s, i) => (
              <button key={s} onClick={() => setStep(s)}
                className={cn(
                  "flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-2 transition-colors",
                  step === s ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted"
                )}>
                <span className={cn(
                  "w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center shrink-0",
                  step === s ? "bg-white/25 text-white" : "bg-muted-foreground/20 text-muted-foreground"
                )}>{i + 1}</span>
                {s === "info" ? "Shift Info" : "Count Cash"}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === "info" ? (
              <motion.div key="info"
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
                className="space-y-4">

                {/* Cashier info card */}
                <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <User2 className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{user?.name ?? "Cashier"}</p>
                    <p className="text-xs text-muted-foreground capitalize">{user?.role?.replace(/_/g, " ") ?? "Cashier"}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{user?.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">Shift Start</p>
                    <p className="text-sm font-bold">{now.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", hour12: true })}</p>
                  </div>
                </div>

                {/* Terminal */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Register / Terminal ID</label>
                  <div className="relative">
                    <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={registerId}
                      onChange={e => setRegisterId(e.target.value)}
                      className="pl-9 h-10 text-sm"
                      placeholder="Terminal-1"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Opening Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    placeholder="e.g. Bank float received, safe count completed…"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <Button className="w-full h-12 gap-2 bg-success hover:bg-success/90 font-bold text-base"
                  onClick={() => setStep("cash")}>
                  Next: Count Cash <ChevronRight className="h-4 w-4" />
                </Button>
              </motion.div>
            ) : (
              <motion.div key="cash"
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                className="space-y-4">

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Cash Drawer Count</p>
                    <p className="text-xs text-muted-foreground">Count each denomination and enter quantities</p>
                  </div>
                  <button onClick={() => setCounts({})}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <RotateCcw className="h-3 w-3" />Reset
                  </button>
                </div>

                <CashCounter
                  currency={currency}
                  denoms={denoms}
                  counts={counts}
                  onChange={(val, qty) => setCounts(p => ({ ...p, [val]: qty }))}
                />

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1 h-12" onClick={() => setStep("info")}>
                    Back
                  </Button>
                  <Button
                    className="flex-1 h-12 gap-2 bg-success hover:bg-success/90 font-bold"
                    onClick={handleOpen}
                    disabled={openMutation.isPending}
                  >
                    {openMutation.isPending
                      ? <><Loader2 className="h-4 w-4 animate-spin" />Opening…</>
                      : <><PlayCircle className="h-4 w-4" />Open Shift — {fmtMoney(openingCash, currency)}</>
                    }
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── Close Shift Panel ────────────────────────────────────────────────────────

function CloseShiftPanel({
  session,
  onClose,
  onClosed,
}: {
  session: POSSessionSummaryDto;
  onClose: () => void;
  onClosed: () => void;
}) {
  const { tenant } = useAuthStore();
  const closeMutation = useCloseSession();

  const { denoms, currency } = getDenominations(tenant?.country, tenant?.currency);
  const [counts, setCounts]  = React.useState<Record<number, number>>({});
  const [notes, setNotes]    = React.useState("");
  const [step, setStep]      = React.useState<"summary" | "cash" | "confirm">("summary");

  // Fetch session transactions for summary
  const { data: txnData } = useTransactions({ sessionId: session.id, pageSize: 200 });
  const txns = txnData?.items ?? [];

  const completedSales  = txns.filter(t => t.status?.toLowerCase() === "completed" && t.type?.toLowerCase() === "sale");
  const voids           = txns.filter(t => t.status?.toLowerCase() === "voided");
  const refunds         = txns.filter(t => t.type?.toLowerCase() === "refund");
  const grossSales      = completedSales.reduce((s, t) => s + t.totalAmount, 0);
  const totalRefunds    = refunds.reduce((s, t) => s + t.totalAmount, 0);
  const netSales        = grossSales - totalRefunds;
  const cashSales       = completedSales.filter(t => (t.primaryPaymentMethod ?? "").toLowerCase() === "cash").reduce((s, t) => s + t.totalAmount, 0);
  const duration        = fmtDuration(session.openedAt);

  const closingCash    = denoms.reduce((s, d) => s + d.value * (counts[d.value] ?? 0), 0);
  // Expected: opening cash + cash sales - cash refunds
  const expectedCash   = 0 + cashSales;  // opening cash not in summary dto; use 0 as base
  const variance       = closingCash - expectedCash;
  const varianceAbs    = Math.abs(variance);

  const handleClose = async () => {
    try {
      await closeMutation.mutateAsync({ sessionId: session.id, closingCash, notes: notes || null });
      onClosed();
    } catch { /* toast in hook */ }
  };

  const STEPS = ["summary", "cash", "confirm"] as const;
  const stepIdx = STEPS.indexOf(step);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        className="fixed right-0 top-0 h-full w-full max-w-lg bg-card border-l border-border z-50 flex flex-col shadow-2xl"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-destructive/10 flex items-center justify-center">
              <LogOut className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Close Shift</h2>
              <p className="text-[10px] text-muted-foreground">Shift open for {duration}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step progress */}
        <div className="px-6 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <React.Fragment key={s}>
                <div className={cn(
                  "flex items-center gap-1.5 text-xs font-semibold transition-colors",
                  i <= stepIdx ? "text-primary" : "text-muted-foreground"
                )}>
                  <span className={cn(
                    "w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center",
                    i < stepIdx ? "bg-success text-white" : i === stepIdx ? "bg-primary text-white" : "bg-muted/50"
                  )}>
                    {i < stepIdx ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className="capitalize hidden sm:inline">{s}</span>
                </div>
                {i < STEPS.length - 1 && <div className={cn("flex-1 h-px", i < stepIdx ? "bg-success" : "bg-border")} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">

            {/* ── Step 1: Summary ── */}
            {step === "summary" && (
              <motion.div key="summary" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="space-y-4">
                <p className="text-xs text-muted-foreground">Review your shift performance before counting cash.</p>

                {/* Shift stats grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Shift Duration",   value: duration,              icon: Clock,       color: "text-primary",    bg: "bg-primary/10" },
                    { label: "Total Orders",      value: completedSales.length, icon: ReceiptText, color: "text-success",    bg: "bg-success/10" },
                    { label: "Gross Sales",       value: fmtMoney(grossSales, currency),  icon: TrendingUp,  color: "text-success",    bg: "bg-success/10" },
                    { label: "Net Sales",         value: fmtMoney(netSales, currency),    icon: DollarSign,  color: "text-primary",    bg: "bg-primary/10" },
                    { label: "Voids",             value: voids.length,          icon: X,           color: "text-destructive", bg: "bg-destructive/10" },
                    { label: "Refunds",           value: refunds.length,        icon: RotateCcw,   color: "text-warning",    bg: "bg-warning/10" },
                  ].map(({ label, value, icon: Icon, color, bg }) => (
                    <div key={label} className="bg-muted/30 border border-border rounded-xl p-3 flex items-center gap-3">
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", bg)}>
                        <Icon className={cn("h-4 w-4", color)} />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                        <p className="text-sm font-bold tabular-nums">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Payment breakdown */}
                {txns.length > 0 && (
                  <div className="bg-card border border-border rounded-xl p-4">
                    <p className="text-xs font-bold mb-3">Payment Method Breakdown</p>
                    {["Cash", "Card", "EasyPaisa", "JazzCash"].map(method => {
                      const methodTxns = completedSales.filter(t => (t.primaryPaymentMethod ?? "").toLowerCase() === method.toLowerCase());
                      if (!methodTxns.length) return null;
                      const amount = methodTxns.reduce((s, t) => s + t.totalAmount, 0);
                      return (
                        <div key={method} className="flex justify-between items-center py-1.5 border-b border-border/40 last:border-0 text-sm">
                          <div className="flex items-center gap-2">
                            <Banknote className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{method}</span>
                            <span className="text-[10px] text-muted-foreground">({methodTxns.length} txn{methodTxns.length !== 1 ? "s" : ""})</span>
                          </div>
                          <span className="font-semibold tabular-nums">{fmtMoney(amount, currency)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <Button className="w-full h-11 gap-2 bg-destructive hover:bg-destructive/90 font-bold"
                  onClick={() => setStep("cash")}>
                  Continue: Count Closing Cash <ChevronRight className="h-4 w-4" />
                </Button>
              </motion.div>
            )}

            {/* ── Step 2: Count Cash ── */}
            {step === "cash" && (
              <motion.div key="cash" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="space-y-4">
                <p className="text-xs text-muted-foreground">Count all cash in the drawer and enter quantities below.</p>

                <CashCounter
                  currency={currency}
                  denoms={denoms}
                  counts={counts}
                  onChange={(val, qty) => setCounts(p => ({ ...p, [val]: qty }))}
                />

                {/* Cash notes */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Closing Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    placeholder="e.g. Safe drop completed, counted by supervisor…"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-11" onClick={() => setStep("summary")}>Back</Button>
                  <Button className="flex-1 h-11 gap-2 bg-destructive hover:bg-destructive/90 font-bold"
                    onClick={() => setStep("confirm")}>
                    Review & Confirm <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ── Step 3: Confirm ── */}
            {step === "confirm" && (
              <motion.div key="confirm" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="space-y-4">

                {/* Summary card */}
                <div className="bg-muted/30 border border-border rounded-2xl p-4 space-y-2 font-mono text-sm">
                  <p className="font-black text-center text-base non-mono font-sans mb-3">Shift Summary</p>
                  {[
                    { label: "Register",       value: session.registerId },
                    { label: "Opened At",      value: parseUtcDate(session.openedAt).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", hour12: true }) },
                    { label: "Duration",       value: duration },
                    { label: "Total Orders",   value: String(completedSales.length) },
                    { label: "Gross Sales",    value: fmtMoney(grossSales, currency) },
                    { label: "Refunds",        value: fmtMoney(totalRefunds, currency) },
                    { label: "Net Sales",      value: fmtMoney(netSales, currency) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold">{value}</span>
                    </div>
                  ))}
                  <div className="border-t border-border/60 pt-2 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Expected Cash</span>
                      <span className="font-semibold">{fmtMoney(expectedCash, currency)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Counted Cash</span>
                      <span className="font-bold">{fmtMoney(closingCash, currency)}</span>
                    </div>
                    <div className={cn(
                      "flex justify-between text-xs font-bold pt-1 border-t border-border",
                      variance === 0 ? "text-success" : variance > 0 ? "text-primary" : "text-destructive"
                    )}>
                      <span>{variance === 0 ? "✓ Balanced" : variance > 0 ? "Over" : "Short"}</span>
                      <span>{variance !== 0 && (variance > 0 ? "+" : "–")}{fmtMoney(varianceAbs, currency)}</span>
                    </div>
                  </div>
                </div>

                {/* Variance warning */}
                {varianceAbs > 0 && (
                  <div className={cn(
                    "flex items-start gap-2 px-3 py-2.5 rounded-xl border text-xs",
                    varianceAbs > 500 || (currency === "AED" && varianceAbs > 50)
                      ? "bg-destructive/10 border-destructive/30 text-destructive"
                      : "bg-warning/10 border-warning/30 text-warning"
                  )}>
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      Cash {variance > 0 ? "over" : "short"} by {fmtMoney(varianceAbs, currency)}.
                      {varianceAbs > 500 ? " Supervisor approval may be required." : " Please recount if needed."}
                    </span>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-11" onClick={() => setStep("cash")}>Back</Button>
                  <Button
                    className="flex-1 h-11 gap-2 bg-destructive hover:bg-destructive/90 font-bold"
                    onClick={handleClose}
                    disabled={closeMutation.isPending}
                  >
                    {closeMutation.isPending
                      ? <><Loader2 className="h-4 w-4 animate-spin" />Closing…</>
                      : <><LogOut className="h-4 w-4" />Close Shift</>
                    }
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}

// ─── Shift Gate ───────────────────────────────────────────────────────────────

interface ShiftGateProps {
  children: React.ReactNode;
}

export function ShiftGate({ children }: ShiftGateProps) {
  const { hasRawPermission } = useAuthStore();
  const { data: activeSessions, isLoading } = useActiveSessions();

  const [session, setSession]         = React.useState<POSSessionSummaryDto | null>(null);
  const [showClosePanel, setClosePanel] = React.useState(false);

  // Live duration ticker (1-min update)
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    const t = setInterval(forceUpdate, 60_000);
    return () => clearInterval(t);
  }, []);

  // Sync active session from API.
  // Re-syncs whenever activeSessions changes — handles stale-cache mismatch where
  // ShiftGate had stored a wrong session ID (e.g. from pre-restart cache returning
  // all sessions; now GetActiveSessions filters by currentUser so [0] is always ours).
  React.useEffect(() => {
    if (!activeSessions) return;
    if (activeSessions.length === 0) return; // close mutation already calls setSession(null)
    const fresh = activeSessions[0];
    if (!session || session.id !== fresh.id) {
      setSession(fresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessions]); // intentionally omit `session` — avoids loop, only resync on server data change

  // Any authenticated POS user can close their own shift.
  // Supervisors with pos.sessions.approve can also close others' shifts.
  const canCloseShift = true;

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-background">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <ShoppingCart className="h-6 w-6 text-primary" />
        </div>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Checking shift status…</p>
      </div>
    );
  }

  // ── No active session → mandatory open shift screen ────────────────────────
  if (!session) {
    return (
      <OpenShiftScreen
        onOpened={(newSession) => setSession(newSession)}
      />
    );
  }

  // ── Active session → render POS + provide context ──────────────────────────
  const ctxValue: ShiftContextValue = {
    session,
    sessionId:     session.id,
    shiftDuration: fmtDuration(session.openedAt),
    canCloseShift,
    openClosePanel: () => setClosePanel(true),
  };

  return (
    <ShiftContext.Provider value={ctxValue}>
      {children}

      {/* Close shift panel — supervisor/manager only */}
      <AnimatePresence>
        {showClosePanel && canCloseShift && (
          <CloseShiftPanel
            session={session}
            onClose={() => setClosePanel(false)}
            onClosed={() => {
              setClosePanel(false);
              setSession(null); // back to open-shift screen
            }}
          />
        )}
      </AnimatePresence>
    </ShiftContext.Provider>
  );
}
