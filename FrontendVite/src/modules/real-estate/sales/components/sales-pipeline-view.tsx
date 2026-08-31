import * as React from "react";
import { motion } from "framer-motion";
import { MapPin, CalendarClock, Handshake, Home, DollarSign, Plus, Check, Trash2, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import { reApi } from "@/lib/real-estate/re.api";
import { useQuery } from "@tanstack/react-query";
import {
  useReSalesSummary, useSiteVisits, useReservations, useBookings,
  useCreateSiteVisit, useCompleteSiteVisit, useDeleteSiteVisit,
  useCreateReservation, useSetReservationStatus, useDeleteReservation,
  useCreateBooking, useRecordPayment, useSetBookingStatus, useDeleteBooking,
} from "@/hooks/real-estate/use-re-sales";
import { useCurrency } from "@/hooks/use-currency";

type Tab = "visits" | "reservations" | "bookings";
const TABS: { key: Tab; label: string; icon: typeof MapPin }[] = [
  { key: "visits", label: "Site Visits", icon: MapPin },
  { key: "reservations", label: "Reservations", icon: CalendarClock },
  { key: "bookings", label: "Bookings", icon: Handshake },
];
const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

const badge = (s: string) => {
  const map: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700", completed: "bg-success/10 text-success",
    cancelled: "bg-destructive/10 text-destructive", no_show: "bg-muted text-muted-foreground",
    active: "bg-blue-100 text-blue-700", converted: "bg-success/10 text-success", expired: "bg-muted text-muted-foreground",
    booked: "bg-blue-100 text-blue-700", in_payment: "bg-warning/10 text-warning",
    handover: "bg-violet-100 text-violet-700", completed_: "bg-success/10 text-success",
  };
  return map[s] ?? "bg-muted text-muted-foreground";
};

export function SalesPipelineView() {
  const CUR = useCurrency();
  const [tab, setTab] = React.useState<Tab>("visits");
  const { data: summary } = useReSalesSummary();
  const { data: properties = [] } = useQuery({ queryKey: ["re-properties"], queryFn: reApi.getProperties });
  const { data: units = [] } = useQuery({ queryKey: ["re-units"], queryFn: reApi.getUnits });

  const propName = (id: string) => properties.find((p: { id: string }) => p.id === id)?.name ?? "—";
  const unitsForProp = (pid: string) => units.filter((u: { propertyId?: string }) => !pid || u.propertyId === pid);

  const stats = [
    { label: "Site Visits", value: summary?.siteVisits ?? 0, icon: MapPin, color: "text-blue-600 bg-blue-100" },
    { label: "Active Reservations", value: summary?.activeReservations ?? 0, icon: CalendarClock, color: "text-warning bg-warning/10" },
    { label: "Bookings", value: summary?.bookings ?? 0, icon: Handshake, color: "text-primary bg-primary/10" },
    { label: "Booked Value", value: formatCurrency(summary?.bookedValue ?? 0, CUR), icon: Home, color: "text-violet-600 bg-violet-100" },
    { label: "Collected", value: formatCurrency(summary?.collected ?? 0, CUR), icon: DollarSign, color: "text-success bg-success/10" },
    { label: "Outstanding", value: formatCurrency(summary?.outstanding ?? 0, CUR), icon: DollarSign, color: "text-destructive bg-destructive/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Handshake className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Property Sales Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Lead → Site Visit → Reservation → Booking → Payment Plan → Handover</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-xl p-4">
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mb-2", s.color)}><Icon className="h-4.5 w-4.5" /></div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="font-bold text-base leading-tight mt-0.5">{s.value}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn("flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all",
                tab === t.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted")}>
              <Icon className="h-4 w-4" />{t.label}
            </button>
          );
        })}
      </div>

      {tab === "visits" && <VisitsTab properties={properties} unitsForProp={unitsForProp} propName={propName} />}
      {tab === "reservations" && <ReservationsTab properties={properties} unitsForProp={unitsForProp} propName={propName} />}
      {tab === "bookings" && <BookingsTab properties={properties} unitsForProp={unitsForProp} propName={propName} />}
    </div>
  );
}

// shared small helpers
type Prop = { id: string; name: string };
type Unit = { id: string; propertyId?: string; unitNumber?: string; unitType?: string };
interface TabProps { properties: Prop[]; unitsForProp: (pid: string) => Unit[]; propName: (id: string) => string; }

function PropUnitSelect({ propertyId, unitId, setProp, setUnit, properties, unitsForProp, requireUnit }:
  { propertyId: string; unitId: string; setProp: (v: string) => void; setUnit: (v: string) => void; properties: Prop[]; unitsForProp: (p: string) => Unit[]; requireUnit?: boolean }) {
  return (
    <>
      <select value={propertyId} onChange={e => { setProp(e.target.value); setUnit(""); }} className="h-9 px-2 rounded-lg border border-border bg-background text-sm">
        <option value="">Property…</option>
        {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <select value={unitId} onChange={e => setUnit(e.target.value)} className="h-9 px-2 rounded-lg border border-border bg-background text-sm" disabled={!propertyId}>
        <option value="">{requireUnit ? "Unit…" : "Unit (optional)"}</option>
        {unitsForProp(propertyId).map(u => <option key={u.id} value={u.id}>{u.unitNumber ?? u.id.slice(0, 6)}{u.unitType ? ` · ${u.unitType}` : ""}</option>)}
      </select>
    </>
  );
}

function AddBar({ open, setOpen, label, children, onSave, saving, canSave }:
  { open: boolean; setOpen: (v: boolean) => void; label: string; children: React.ReactNode; onSave: () => void; saving: boolean; canSave: boolean }) {
  if (!open) return <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{label}</Button>;
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex flex-wrap items-center gap-2">
      {children}
      <div className="ml-auto flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen(false)} disabled={saving}><X className="h-3.5 w-3.5" /></Button>
        <Button size="sm" onClick={onSave} disabled={!canSave || saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </div>
  );
}

// ── Site Visits ──────────────────────────────────────────────────────────────
function VisitsTab({ properties, unitsForProp, propName }: TabProps) {
  const { data: rows = [] } = useSiteVisits();
  const create = useCreateSiteVisit(); const complete = useCompleteSiteVisit(); const del = useDeleteSiteVisit();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(""); const [prop, setProp] = React.useState(""); const [unit, setUnit] = React.useState("");
  const [when, setWhen] = React.useState(today()); const [assignee, setAssignee] = React.useState("");
  const save = () => create.mutate({ customerName: name.trim(), propertyId: prop, unitId: unit || null, scheduledAt: when, assignedTo: assignee.trim() || null },
    { onSuccess: () => { setOpen(false); setName(""); setProp(""); setUnit(""); setAssignee(""); } });
  return (
    <div className="space-y-3">
      <AddBar open={open} setOpen={setOpen} label="Schedule Visit" onSave={save} saving={create.isPending} canSave={!!name.trim() && !!prop}>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Prospect / customer" className="h-9 w-44 text-sm" />
        <PropUnitSelect propertyId={prop} unitId={unit} setProp={setProp} setUnit={setUnit} properties={properties} unitsForProp={unitsForProp} />
        <Input type="date" value={when} onChange={e => setWhen(e.target.value)} className="h-9 w-40 text-sm" />
        <Input value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="Agent" className="h-9 w-32 text-sm" />
      </AddBar>
      <Table cols={["Visit #", "Prospect", "Property", "Scheduled", "Status", ""]} empty={rows.length === 0} emptyMsg="No site visits yet.">
        {rows.map(v => (
          <tr key={v.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
            <td className="px-4 py-2.5 font-mono text-xs">{v.visitNumber}</td>
            <td className="px-4 py-2.5 text-sm font-medium">{v.customerName}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground">{propName(v.propertyId)}</td>
            <td className="px-4 py-2.5 text-sm">{v.scheduledAt}</td>
            <td className="px-4 py-2.5"><span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize", badge(v.status))}>{v.status.replace("_", " ")}</span></td>
            <td className="px-4 py-2.5 text-right">
              <div className="flex items-center justify-end gap-1">
                {v.status === "scheduled" && <button title="Mark completed" onClick={() => complete.mutate({ id: v.id })} className="p-1.5 rounded text-success hover:bg-success/10"><Check className="h-3.5 w-3.5" /></button>}
                <button title="Delete" onClick={() => del.mutate(v.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

// ── Reservations ─────────────────────────────────────────────────────────────
function ReservationsTab({ properties, unitsForProp, propName }: TabProps) {
  const CUR = useCurrency();
  const { data: rows = [] } = useReservations();
  const create = useCreateReservation(); const setStatus = useSetReservationStatus(); const del = useDeleteReservation();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(""); const [prop, setProp] = React.useState(""); const [unit, setUnit] = React.useState("");
  const [token, setToken] = React.useState("");
  const save = () => create.mutate({ customerName: name.trim(), propertyId: prop, unitId: unit, reservationDate: today(), expiryDate: plusDays(7), tokenAmount: parseFloat(token) || 0 },
    { onSuccess: () => { setOpen(false); setName(""); setProp(""); setUnit(""); setToken(""); } });
  return (
    <div className="space-y-3">
      <AddBar open={open} setOpen={setOpen} label="New Reservation" onSave={save} saving={create.isPending} canSave={!!name.trim() && !!prop && !!unit}>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Buyer" className="h-9 w-44 text-sm" />
        <PropUnitSelect propertyId={prop} unitId={unit} setProp={setProp} setUnit={setUnit} properties={properties} unitsForProp={unitsForProp} requireUnit />
        <Input type="number" value={token} onChange={e => setToken(e.target.value)} placeholder="Token amount" className="h-9 w-32 text-sm text-right" />
      </AddBar>
      <Table cols={["Reservation #", "Buyer", "Unit", "Token", "Expiry", "Status", ""]} empty={rows.length === 0} emptyMsg="No reservations yet.">
        {rows.map(r => (
          <tr key={r.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
            <td className="px-4 py-2.5 font-mono text-xs">{r.reservationNumber}</td>
            <td className="px-4 py-2.5 text-sm font-medium">{r.customerName}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground">{propName(r.propertyId)}</td>
            <td className="px-4 py-2.5 text-sm">{formatCurrency(r.tokenAmount, CUR)}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground">{r.expiryDate}</td>
            <td className="px-4 py-2.5"><span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize", badge(r.status))}>{r.status}</span></td>
            <td className="px-4 py-2.5 text-right">
              <div className="flex items-center justify-end gap-1">
                {r.status === "active" && <button title="Mark expired" onClick={() => setStatus.mutate({ id: r.id, status: "expired" })} className="p-1.5 rounded text-muted-foreground hover:text-foreground"><ArrowRight className="h-3.5 w-3.5" /></button>}
                <button title="Delete" onClick={() => del.mutate(r.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

// ── Bookings ─────────────────────────────────────────────────────────────────
function BookingsTab({ properties, unitsForProp, propName }: TabProps) {
  const CUR = useCurrency();
  const { data: rows = [] } = useBookings();
  const create = useCreateBooking(); const pay = useRecordPayment(); const del = useDeleteBooking();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(""); const [prop, setProp] = React.useState(""); const [unit, setUnit] = React.useState("");
  const [price, setPrice] = React.useState(""); const [down, setDown] = React.useState(""); const [inst, setInst] = React.useState("12");
  const save = () => create.mutate({ customerName: name.trim(), propertyId: prop, unitId: unit, bookingDate: today(),
    salePrice: parseFloat(price) || 0, downPayment: parseFloat(down) || 0, installmentCount: parseInt(inst, 10) || 0 },
    { onSuccess: () => { setOpen(false); setName(""); setProp(""); setUnit(""); setPrice(""); setDown(""); setInst("12"); } });
  return (
    <div className="space-y-3">
      <AddBar open={open} setOpen={setOpen} label="New Booking" onSave={save} saving={create.isPending} canSave={!!name.trim() && !!prop && !!unit && !!price}>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Buyer" className="h-9 w-40 text-sm" />
        <PropUnitSelect propertyId={prop} unitId={unit} setProp={setProp} setUnit={setUnit} properties={properties} unitsForProp={unitsForProp} requireUnit />
        <Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="Sale price" className="h-9 w-28 text-sm text-right" />
        <Input type="number" value={down} onChange={e => setDown(e.target.value)} placeholder="Down" className="h-9 w-24 text-sm text-right" />
        <Input type="number" value={inst} onChange={e => setInst(e.target.value)} placeholder="Installments" className="h-9 w-24 text-sm text-right" />
      </AddBar>
      <Table cols={["Booking #", "Buyer", "Property", "Sale Price", "Paid", "Balance", "Status", ""]} empty={rows.length === 0} emptyMsg="No bookings yet.">
        {rows.map(b => (
          <tr key={b.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
            <td className="px-4 py-2.5 font-mono text-xs">{b.bookingNumber}</td>
            <td className="px-4 py-2.5 text-sm font-medium">{b.customerName}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground">{propName(b.propertyId)}</td>
            <td className="px-4 py-2.5 text-sm">{formatCurrency(b.salePrice, CUR)}</td>
            <td className="px-4 py-2.5 text-sm text-success">{formatCurrency(b.paidAmount, CUR)}</td>
            <td className="px-4 py-2.5 text-sm font-semibold">{formatCurrency(b.balance, CUR)}</td>
            <td className="px-4 py-2.5"><span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize", badge(b.status))}>{b.status.replace("_", " ")}</span></td>
            <td className="px-4 py-2.5 text-right">
              <div className="flex items-center justify-end gap-1">
                {b.balance > 0 && <button title={`Record installment ${formatCurrency(b.installmentAmount, CUR)}`} onClick={() => pay.mutate({ id: b.id, amount: b.installmentAmount || b.balance })} className="p-1.5 rounded text-success hover:bg-success/10"><DollarSign className="h-3.5 w-3.5" /></button>}
                <button title="Delete" onClick={() => del.mutate(b.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function Table({ cols, children, empty, emptyMsg }: { cols: string[]; children: React.ReactNode; empty: boolean; emptyMsg: string }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full">
        <thead><tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
          {cols.map((c, i) => <th key={i} className={cn("px-4 py-3 font-semibold", i === cols.length - 1 ? "text-right" : "text-left")}>{c}</th>)}
        </tr></thead>
        <tbody>{empty ? <tr><td colSpan={cols.length} className="text-center py-12 text-sm text-muted-foreground">{emptyMsg}</td></tr> : children}</tbody>
      </table>
    </div>
  );
}
