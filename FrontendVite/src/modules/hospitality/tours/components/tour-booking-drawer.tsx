import * as React from "react";
import { Loader2, Printer, Plus, Trash2, Pencil, AlertTriangle, CheckCircle2, XCircle, RotateCcw, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can, useCan } from "@/components/auth/can";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useAuthStore } from "@/store/auth.store";
import { localToday } from "@/lib/hospitality/hospitality.api";
import type { InstalmentInput, TourBookingDetailDto, TourServiceDto, TourServiceRequest, TravellerInput } from "@/lib/hospitality/tours.api";
import { printTourDocument } from "@/lib/hospitality/tour-print";
import {
  useTourBooking, useTourBookingStatus, useUpdateTourBooking, useSaveTravellers, useSaveService, useDeleteService,
  useSaveInstalments, useAddTourPayment, useVoidTourPayment, useDeleteTourBooking,
} from "@/hooks/hospitality/use-tours";
import { Drawer, Modal, Field, Section, inputCls, selectCls, textareaCls, dayLabel, addDays } from "../../shared/hotel-ui";
import { Chip, INSTALMENT_STATUS, PAYMENT_METHODS, SERVICE_STATUS, SERVICE_TYPES, TOUR_STATUS } from "./tour-ui";
import { ServiceDetailsEditor, detailSummary } from "./service-details";

type Tab = "overview" | "travellers" | "suppliers" | "payments" | "itinerary";

export function TourBookingDrawer({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const currency = useCurrency();
  const company = useAuthStore(s => s.tenant?.name) ?? "";
  const { data, isLoading } = useTourBooking(bookingId);
  const [tab, setTab] = React.useState<Tab>("overview");
  const [dialog, setDialog] = React.useState<null | "edit" | "cancel" | "pay">(null);
  const status = useTourBookingStatus();
  const del = useDeleteTourBooking();
  const canEdit = useCan("hospitality.tour-bookings.edit");
  const b = data?.booking;

  const tabs: [Tab, string][] = [["overview", "Overview"], ["travellers", `Travellers${data ? ` (${data.travellers.length})` : ""}`],
    ["suppliers", `Suppliers${data ? ` (${data.services.length})` : ""}`], ["payments", "Payments"], ["itinerary", "Itinerary"]];

  return (
    <>
      <Drawer width="max-w-3xl" onClose={onClose}
        title={b ? <span className="flex items-center gap-2">{b.title} <Chip map={TOUR_STATUS} value={b.status} /></span> : "Booking"}
        subtitle={b ? `${b.bookingNumber} · ${b.customerName} · ${dayLabel(b.startDate)} → ${dayLabel(b.endDate)}` : undefined}
        footer={b && <>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => printTourDocument(data!, { companyName: company, currency, showPrices: true })}>
            <Printer className="h-3.5 w-3.5" />{b.status === "enquiry" ? "Quotation PDF" : "Itinerary PDF"}</Button>
          {canEdit && <>
            {b.status === "cancelled" && <Button size="sm" variant="outline" className="gap-1.5" onClick={() => status.mutate({ id: b.id, action: "reopen" })}><RotateCcw className="h-3.5 w-3.5" />Reopen</Button>}
            {(b.status === "enquiry" || b.status === "confirmed") && <Button size="sm" variant="ghost" className="gap-1.5 text-destructive" onClick={() => setDialog("cancel")}><Ban className="h-3.5 w-3.5" />Cancel</Button>}
            {b.status === "enquiry" && <Button size="sm" className="gap-1.5" onClick={() => status.mutate({ id: b.id, action: "confirm" })}><CheckCircle2 className="h-3.5 w-3.5" />Confirm</Button>}
            {b.status === "confirmed" && b.endDate <= localToday() && <Button size="sm" className="gap-1.5" onClick={() => status.mutate({ id: b.id, action: "complete" })}><CheckCircle2 className="h-3.5 w-3.5" />Mark completed</Button>}
          </>}
          <Can permission="hospitality.tour-bookings.delete">{b.amountPaid === 0 && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del.mutate(b.id, { onSuccess: onClose })}><Trash2 className="h-3.5 w-3.5" /></Button>}</Can>
        </>}>
        {isLoading || !data || !b ? <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /> : (
          <div className="space-y-4">
            <div className="flex gap-1 overflow-x-auto border-b border-border -mx-1 px-1">
              {tabs.map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} className={cn("px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px",
                  tab === k ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>{l}</button>
              ))}
            </div>
            {tab === "overview" && <Overview d={data} currency={currency} onEdit={() => setDialog("edit")} onPay={() => setDialog("pay")} />}
            {tab === "travellers" && <Travellers d={data} />}
            {tab === "suppliers" && <Suppliers d={data} currency={currency} />}
            {tab === "payments" && <Payments d={data} currency={currency} onPay={() => setDialog("pay")} />}
            {tab === "itinerary" && <Itinerary d={data} />}
          </div>
        )}
      </Drawer>
      {b && dialog === "edit" && <EditDialog d={data!} onClose={() => setDialog(null)} />}
      {b && dialog === "pay" && <PayDialog bookingId={b.id} balance={b.balance} currency={currency} onClose={() => setDialog(null)} />}
      {b && dialog === "cancel" && <CancelDialog bookingId={b.id} paid={b.amountPaid} currency={currency} onClose={() => setDialog(null)} />}
    </>
  );
}

// ── Overview ──

function Overview({ d, currency, onEdit, onPay }: { d: TourBookingDetailDto; currency: string; onEdit: () => void; onPay: () => void }) {
  const b = d.booking;
  const cur = (n: number) => formatCurrency(n, currency);
  const missing = b.adults + b.children - d.travellers.length;
  const badPassports = d.travellers.filter(t => t.passportProblem).length;
  const pending = d.services.filter(s => s.status === "pending" || s.status === "requested").length;
  return (
    <div className="space-y-5">
      {b.status === "cancelled" && b.cancelReason && <p className="rounded-lg bg-destructive/10 text-destructive text-sm px-3 py-2">Cancelled: {b.cancelReason}</p>}
      {(b.overdueAmount > 0 || (b.status !== "cancelled" && (missing > 0 || badPassports > 0 || pending > 0))) && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm space-y-1">
          {b.overdueAmount > 0 && <p className="flex gap-2 text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" />{cur(b.overdueAmount)} is overdue.</p>}
          {missing > 0 && <p className="flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />{missing} traveller name{missing === 1 ? "" : "s"} still to add.</p>}
          {badPassports > 0 && <p className="flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />{badPassports} passport{badPassports === 1 ? "" : "s"} missing or expiring within 6 months of return.</p>}
          {pending > 0 && <p className="flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />{pending} supplier booking{pending === 1 ? "" : "s"} not confirmed yet.</p>}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Tile l="Total" v={cur(b.totalAmount)} />
        <Tile l="Paid" v={cur(b.amountPaid)} />
        <Tile l="Balance" v={cur(b.balance)} tone={b.balance > 0 ? "text-amber-600" : "text-emerald-600"} sub={b.nextDueDate ? `next due ${dayLabel(b.nextDueDate)}` : undefined} />
        {b.margin !== null ? <Tile l="Margin" v={cur(b.margin)} tone={b.margin < 0 ? "text-destructive" : "text-emerald-600"} sub={b.costAmount !== null ? `cost ${cur(b.costAmount)}` : undefined} />
          : <Tile l="Travellers" v={`${b.adults + b.children}`} />}
      </div>

      <Section title="Price" action={
        <div className="flex gap-1">
          <Can permission="hospitality.tour-bookings.record">{b.balance > 0 && b.status !== "cancelled" && <Button size="sm" className="h-7 text-xs" onClick={onPay}>Take payment</Button>}</Can>
          <Can permission="hospitality.tour-bookings.edit">{(b.status === "enquiry" || b.status === "confirmed") && <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onEdit}><Pencil className="h-3 w-3" />Edit</Button>}</Can>
        </div>}>
        <div className="rounded-xl border border-border bg-card p-3 text-sm space-y-1">
          <Line l={`${b.adults} adult${b.adults === 1 ? "" : "s"} × ${cur(b.adultPrice)}`} v={b.adults * b.adultPrice} c={currency} />
          {b.children > 0 && <Line l={`${b.children} child${b.children === 1 ? "" : "ren"} × ${cur(b.childPrice)}`} v={b.children * b.childPrice} c={currency} />}
          {b.singleRooms > 0 && <Line l={`${b.singleRooms} single supplement${b.singleRooms === 1 ? "" : "s"}`} v={b.singleRooms * b.singleSupplement} c={currency} />}
          {b.extrasAmount > 0 && <Line l="Extras" v={b.extrasAmount} c={currency} />}
          {b.discountAmount > 0 && <Line l="Discount" v={-b.discountAmount} c={currency} />}
          {b.taxAmount > 0 && <Line l={`Tax ${b.taxPercent}%`} v={b.taxAmount} c={currency} />}
          <div className="flex justify-between font-semibold border-t border-border pt-1"><span>Total</span><span className="tabular-nums">{cur(b.totalAmount)}</span></div>
        </div>
      </Section>

      <Section title="Customer">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm rounded-xl border border-border bg-card p-3">
          {([["Name", b.customerName], ["Phone", b.customerPhone], ["Email", b.customerEmail], ["Source", b.source],
            ["Package", d.packageName], ["Taken by", b.createdByName]] as const).map(([k, v]) => (
            <div key={k}><dt className="text-[11px] text-muted-foreground">{k}</dt><dd className="break-words">{v || "—"}</dd></div>
          ))}
        </dl>
        {b.notes && <p className="text-sm rounded-lg bg-muted/50 px-3 py-2 whitespace-pre-line">{b.notes}</p>}
      </Section>
    </div>
  );
}

function Tile({ l, v, sub, tone }: { l: string; v: string; sub?: string; tone?: string }) {
  return <div className="rounded-xl border border-border bg-card p-3 min-w-0"><p className="text-[11px] text-muted-foreground">{l}</p>
    <p className={cn("font-bold tabular-nums truncate", tone)}>{v}</p>{sub && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}</div>;
}
function Line({ l, v, c }: { l: string; v: number; c: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{l}</span><span className="tabular-nums">{formatCurrency(v, c)}</span></div>;
}

// ── Travellers ──

function Travellers({ d }: { d: TourBookingDetailDto }) {
  const b = d.booking;
  const save = useSaveTravellers();
  const canEdit = useCan("hospitality.tour-bookings.edit");
  const blank = (type = "adult"): TravellerInput => ({ fullName: "", type });
  const [rows, setRows] = React.useState<TravellerInput[]>(() => {
    const have: TravellerInput[] = d.travellers.map(t => ({ ...t }));
    const need = b.adults + b.children - have.length;
    const adultsHave = have.filter(t => t.type === "adult").length;
    for (let i = 0; i < need; i++) have.push(blank(adultsHave + i < b.adults ? "adult" : "child"));
    return have;
  });
  const set = (i: number, p: Partial<TravellerInput>) => setRows(r => r.map((x, j) => j === i ? { ...x, ...p } : x));
  const filled = rows.filter(r => r.fullName.trim());
  const sixMonths = addDays(b.endDate, 183);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Names exactly as in the passport. A passport should be valid at least 6 months after the return date ({dayLabel(sixMonths, { day: "numeric", month: "short", year: "numeric" })}).</p>
      {rows.map((t, i) => {
        const expBad = t.passportExpiry ? t.passportExpiry < sixMonths : false;
        return (
          <div key={i} className="rounded-xl border border-border bg-card p-3 grid grid-cols-2 sm:grid-cols-6 gap-2">
            <input disabled={!canEdit} value={t.fullName} onChange={e => set(i, { fullName: e.target.value })} className={cn(inputCls, "col-span-2")} placeholder={`Traveller ${i + 1} full name`} />
            <select disabled={!canEdit} value={t.type} onChange={e => set(i, { type: e.target.value })} className={selectCls} aria-label="Type">
              <option value="adult">Adult</option><option value="child">Child</option><option value="infant">Infant</option></select>
            <input disabled={!canEdit} value={t.nationality ?? ""} onChange={e => set(i, { nationality: e.target.value })} className={inputCls} placeholder="Nationality" />
            <input disabled={!canEdit} type="date" value={t.dateOfBirth ?? ""} onChange={e => set(i, { dateOfBirth: e.target.value })} className={inputCls} aria-label="Date of birth" title="Date of birth" />
            <select disabled={!canEdit} value={t.gender ?? ""} onChange={e => set(i, { gender: e.target.value })} className={selectCls} aria-label="Gender">
              <option value="">Gender</option><option value="male">Male</option><option value="female">Female</option></select>
            <input disabled={!canEdit} value={t.passportNumber ?? ""} onChange={e => set(i, { passportNumber: e.target.value.toUpperCase() })} className={cn(inputCls, "col-span-1 sm:col-span-2")} placeholder="Passport no." />
            <div className="col-span-1 sm:col-span-2">
              <input disabled={!canEdit} type="date" value={t.passportExpiry ?? ""} onChange={e => set(i, { passportExpiry: e.target.value })}
                className={cn(inputCls, expBad && "border-destructive")} aria-label="Passport expiry" title="Passport expiry" />
              {expBad && <p className="text-[11px] text-destructive mt-0.5">Expires too soon after the trip</p>}
            </div>
            {canEdit && <Button size="sm" variant="ghost" className="h-9 text-destructive col-span-2 sm:col-span-2 justify-self-end" onClick={() => setRows(r => r.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5 me-1" />Remove</Button>}
          </div>
        );
      })}
      {canEdit && (
        <div className="flex justify-between">
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setRows(r => [...r, blank()])}><Plus className="h-3.5 w-3.5" />Traveller</Button>
          <Button size="sm" disabled={save.isPending || rows.some(r => !r.fullName.trim() && (r.passportNumber || r.nationality))}
            onClick={() => save.mutate({ id: b.id, travellers: filled.map(r => ({
              ...r, gender: r.gender || null, dateOfBirth: r.dateOfBirth || null, nationality: r.nationality || null,
              passportNumber: r.passportNumber || null, passportExpiry: r.passportExpiry || null, notes: r.notes || null,
            })) })}>Save travellers</Button>
        </div>
      )}
    </div>
  );
}

// ── Suppliers ──

function Suppliers({ d, currency }: { d: TourBookingDetailDto; currency: string }) {
  const [editing, setEditing] = React.useState<TourServiceDto | "new" | null>(null);
  const del = useDeleteService();
  const canEdit = useCan("hospitality.tour-costs.edit");
  const cur = (n: number | null) => n === null ? "—" : formatCurrency(n, currency);
  const live = d.services.filter(s => s.status !== "cancelled");
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Everything booked with a supplier for this trip. Costs give the margin; an <b>extra</b> is also charged to the customer.</p>
        {canEdit && d.booking.status !== "cancelled" && <Button size="sm" className="h-8 gap-1 shrink-0" onClick={() => setEditing("new")}><Plus className="h-3.5 w-3.5" />Add</Button>}
      </div>
      {d.services.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No supplier bookings yet.</p> : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-muted/40">
              <tr><th className="text-start px-3 py-2 font-medium">Service</th><th className="text-start px-3 py-2 font-medium">Date</th><th className="text-start px-3 py-2 font-medium">Status</th>
                {d.canSeeCosts && <><th className="text-end px-3 py-2 font-medium">Cost</th><th className="text-end px-3 py-2 font-medium">Owed</th></>}
                <th className="text-end px-3 py-2 font-medium">Sold</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {d.services.map(s => (
                <tr key={s.id} className={cn(s.status === "cancelled" && "opacity-50")}>
                  <td className="px-3 py-2"><p className="font-medium">{s.description}</p>
                    <p className="text-[11px] text-muted-foreground">{SERVICE_TYPES.find(t => t.value === s.type)?.label} · {s.supplierName}{s.confirmationNumber ? ` · ref ${s.confirmationNumber}` : ""}</p>
                    {detailSummary(s.type, s.details) && <p className="text-[11px] text-foreground/80">{detailSummary(s.type, s.details)}</p>}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{s.serviceDate ? dayLabel(s.serviceDate) : "—"}</td>
                  <td className="px-3 py-2"><Chip map={SERVICE_STATUS} value={s.status} /></td>
                  {d.canSeeCosts && <><td className="px-3 py-2 text-end tabular-nums">{cur(s.cost)}</td>
                    <td className={cn("px-3 py-2 text-end tabular-nums", (s.supplierBalance ?? 0) > 0 && "text-amber-600")}>{cur(s.supplierBalance)}</td></>}
                  <td className="px-3 py-2 text-end tabular-nums">{s.isExtra ? cur(s.sellPrice) : <span className="text-[11px] text-muted-foreground">in package</span>}</td>
                  <td className="px-2 py-2 text-end whitespace-nowrap">{canEdit && <>
                    <button onClick={() => setEditing(s)} className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                    {(s.supplierPaid ?? 0) === 0 && <button onClick={() => del.mutate({ bookingId: d.booking.id, id: s.id })} className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-destructive/10 text-destructive" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </>}</td>
                </tr>
              ))}
            </tbody>
            {d.canSeeCosts && (
              <tfoot className="text-sm font-semibold border-t border-border">
                <tr><td className="px-3 py-2" colSpan={3}>Total</td>
                  <td className="px-3 py-2 text-end tabular-nums">{cur(live.reduce((a, s) => a + (s.cost ?? 0), 0))}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{cur(live.reduce((a, s) => a + (s.supplierBalance ?? 0), 0))}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{cur(live.filter(s => s.isExtra).reduce((a, s) => a + s.sellPrice, 0))}</td><td /></tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      {editing && <ServiceDialog bookingId={d.booking.id} svc={editing === "new" ? null : editing} trip={d.booking} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ServiceDialog({ bookingId, svc, trip, onClose }: { bookingId: string; svc: TourServiceDto | null; trip: { startDate: string; endDate: string }; onClose: () => void }) {
  const save = useSaveService();
  const [f, setF] = React.useState<TourServiceRequest>({
    type: svc?.type ?? "hotel", supplierName: svc?.supplierName ?? "", description: svc?.description ?? "",
    serviceDate: svc?.serviceDate ?? trip.startDate, endDate: svc?.endDate ?? "", confirmationNumber: svc?.confirmationNumber ?? "",
    cost: svc?.cost ?? 0, supplierPaid: svc?.supplierPaid ?? 0, isExtra: svc?.isExtra ?? false, sellPrice: svc?.sellPrice ?? 0,
    status: svc?.status ?? "pending", notes: svc?.notes ?? "",
  });
  const [details, setDetails] = React.useState<Record<string, string>>(svc?.details ?? {});
  // The first date the details carry is the service date when none was typed.
  const firstDate = () => {
    const v = details.checkIn ?? details.departs ?? details.pickupAt ?? details.embark ?? details.date ?? details.submittedOn;
    return v ? v.slice(0, 10) : null;
  };
  const lastDate = () => {
    const v = details.checkOut ?? details.returnDeparts ?? details.dropoffAt ?? details.disembark;
    return v ? v.slice(0, 10) : null;
  };
  const up = <K extends keyof TourServiceRequest>(k: K, v: TourServiceRequest[K]) => setF(s => ({ ...s, [k]: v }));
  const valid = f.supplierName.trim() && f.description.trim() && f.supplierPaid <= f.cost;
  return (
    <Modal title={svc ? "Edit supplier booking" : "Add supplier booking"} onClose={onClose} width="max-w-2xl"
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button>
        <Button disabled={!valid || save.isPending} onClick={() => save.mutate({ bookingId, id: svc?.id, data: {
          ...f, serviceDate: firstDate() ?? (f.serviceDate || null), endDate: lastDate() ?? (f.endDate || null),
          confirmationNumber: f.confirmationNumber || null, notes: f.notes || null,
          details: Object.fromEntries(Object.entries(details).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)),
        } }, { onSuccess: onClose })}>Save</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type"><select value={f.type} onChange={e => up("type", e.target.value as TourServiceRequest["type"])} className={selectCls}>
          {SERVICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></Field>
        <Field label="Status"><select value={f.status} onChange={e => up("status", e.target.value as TourServiceRequest["status"])} className={selectCls}>
          {Object.entries(SERVICE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
        <Field label="Supplier" className="col-span-2"><input autoFocus value={f.supplierName} onChange={e => up("supplierName", e.target.value)} className={inputCls} placeholder="Hilton Istanbul / Emirates / Desert Safari Co." /></Field>
        <Field label="What was booked" className="col-span-2"><input value={f.description} onChange={e => up("description", e.target.value)} className={inputCls} placeholder="2 double rooms, 6 nights, breakfast" /></Field>
        <Field label="From"><input type="date" value={f.serviceDate ?? ""} onChange={e => up("serviceDate", e.target.value)} className={inputCls} /></Field>
        <Field label="To"><input type="date" value={f.endDate ?? ""} min={f.serviceDate ?? undefined} onChange={e => up("endDate", e.target.value)} className={inputCls} /></Field>
        <Field label="Confirmation / PNR" className="col-span-2"><input value={f.confirmationNumber ?? ""} onChange={e => up("confirmationNumber", e.target.value)} className={inputCls} /></Field>
        <div className="col-span-2 rounded-xl border border-border bg-muted/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{SERVICE_TYPES.find(t => t.value === f.type)?.label} details</p>
          <ServiceDetailsEditor type={f.type} value={details} onChange={setDetails} />
        </div>
        <Field label="Cost from supplier"><input type="number" min={0} step="0.01" value={f.cost} onChange={e => up("cost", Number(e.target.value))} className={inputCls} /></Field>
        <Field label="Paid to supplier"><input type="number" min={0} step="0.01" value={f.supplierPaid} onChange={e => up("supplierPaid", Number(e.target.value))} className={cn(inputCls, f.supplierPaid > f.cost && "border-destructive")} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isExtra} onChange={e => up("isExtra", e.target.checked)} />Charge the customer for this on top of the package</label>
      {f.isExtra && <Field label="Price to the customer"><input type="number" min={0} step="0.01" value={f.sellPrice} onChange={e => up("sellPrice", Number(e.target.value))} className={inputCls} /></Field>}
      <Field label="Notes"><textarea rows={2} value={f.notes ?? ""} onChange={e => up("notes", e.target.value)} className={textareaCls} /></Field>
    </Modal>
  );
}

// ── Payments ──

function Payments({ d, currency, onPay }: { d: TourBookingDetailDto; currency: string; onPay: () => void }) {
  const b = d.booking;
  const cur = (n: number) => formatCurrency(n, currency);
  const save = useSaveInstalments();
  const voidPay = useVoidTourPayment();
  const canEdit = useCan("hospitality.tour-bookings.edit");
  const canVoid = useCan("hospitality.tour-bookings.void");
  const [editing, setEditing] = React.useState(false);
  const [rows, setRows] = React.useState<InstalmentInput[]>([]);
  const [voiding, setVoiding] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");
  const scheduled = rows.reduce((a, r) => a + (Number(r.amount) || 0), 0);

  const startEdit = () => {
    setRows(d.instalments.length ? d.instalments.map(i => ({ label: i.label, dueDate: i.dueDate, amount: i.amount })) : suggest());
    setEditing(true);
  };
  // Common agency terms: 30% deposit now, the rest 30 days before travel (or now, if the trip is sooner).
  const suggest = (): InstalmentInput[] => {
    const today = localToday();
    const dep = Math.round(b.totalAmount * 0.3 * 100) / 100;
    const balDue = addDays(b.startDate, -30) > today ? addDays(b.startDate, -30) : today;
    return [{ label: "Deposit (30%)", dueDate: today, amount: dep }, { label: "Balance", dueDate: balDue, amount: Math.round((b.totalAmount - dep) * 100) / 100 }];
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <Tile l="Total" v={cur(b.totalAmount)} /><Tile l="Paid" v={cur(b.amountPaid)} />
        <Tile l="Balance" v={cur(b.balance)} tone={b.overdueAmount > 0 ? "text-destructive" : b.balance > 0 ? "text-amber-600" : "text-emerald-600"}
          sub={b.overdueAmount > 0 ? `${cur(b.overdueAmount)} overdue` : undefined} />
      </div>

      <Section title="Payment schedule" action={canEdit && !editing && b.status !== "cancelled" &&
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={startEdit}>{d.instalments.length ? "Edit schedule" : "Set up schedule"}</Button>}>
        {editing ? (
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_9rem_8rem_auto] gap-2">
                <input value={r.label} onChange={e => setRows(x => x.map((y, j) => j === i ? { ...y, label: e.target.value } : y))} className={inputCls} placeholder="Deposit" />
                <input type="date" value={r.dueDate} onChange={e => setRows(x => x.map((y, j) => j === i ? { ...y, dueDate: e.target.value } : y))} className={inputCls} />
                <input type="number" min={0} step="0.01" value={r.amount} onChange={e => setRows(x => x.map((y, j) => j === i ? { ...y, amount: Number(e.target.value) } : y))} className={inputCls} />
                <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-destructive" onClick={() => setRows(x => x.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button size="sm" variant="ghost" className="gap-1" onClick={() => setRows(x => [...x, { label: "", dueDate: localToday(), amount: Math.max(0, Math.round((b.totalAmount - scheduled) * 100) / 100) }])}><Plus className="h-3.5 w-3.5" />Instalment</Button>
              <span className={cn("text-xs", scheduled > b.totalAmount + 0.005 ? "text-destructive" : "text-muted-foreground")}>
                Scheduled {cur(scheduled)} of {cur(b.totalAmount)}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                <Button size="sm" disabled={save.isPending || scheduled > b.totalAmount + 0.005 || rows.some(r => !r.label.trim() || !(r.amount > 0))}
                  onClick={() => save.mutate({ id: b.id, instalments: rows }, { onSuccess: () => setEditing(false) })}>Save schedule</Button>
              </div>
            </div>
          </div>
        ) : d.instalments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No schedule — the whole balance is due by the travel date, {dayLabel(b.startDate)}.</p>
        ) : (
          <div className="rounded-xl border border-border divide-y divide-border">
            {d.instalments.map(i => (
              <div key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1 font-medium">{i.label}</span>
                <span className="text-muted-foreground whitespace-nowrap">{dayLabel(i.dueDate)}</span>
                <span className="tabular-nums w-24 text-end">{cur(i.amount)}</span>
                <Chip map={INSTALMENT_STATUS} value={i.status} />
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Payments received" action={<Can permission="hospitality.tour-bookings.record">
        {b.balance > 0 && b.status !== "cancelled" && <Button size="sm" className="h-7 text-xs" onClick={onPay}>Take payment</Button>}</Can>}>
        {d.payments.length === 0 ? <p className="text-xs text-muted-foreground">Nothing received yet.</p> : (
          <div className="rounded-xl border border-border divide-y divide-border">
            {d.payments.map(p => (
              <div key={p.id} className={cn("px-3 py-2 text-sm", p.isVoided && "opacity-60")}>
                <div className="flex items-center gap-3">
                  <span className={cn("tabular-nums font-semibold w-28", p.isVoided && "line-through")}>{cur(p.amount)}</span>
                  <span className="flex-1 text-muted-foreground">{dayLabel(p.paidOn)} · {p.method.replace(/_/g, " ")}{p.reference ? ` · ${p.reference}` : ""}{p.receivedBy ? ` · ${p.receivedBy}` : ""}</span>
                  {!p.isVoided && canVoid && <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => { setVoiding(p.id); setReason(""); }}>Void</Button>}
                </div>
                {p.isVoided && <p className="text-[11px] text-destructive">Voided: {p.voidReason}</p>}
                {voiding === p.id && (
                  <div className="flex gap-2 mt-2">
                    <input autoFocus value={reason} onChange={e => setReason(e.target.value)} className={inputCls} placeholder="Why is this payment being voided?" />
                    <Button size="sm" variant="destructive" disabled={!reason.trim() || voidPay.isPending}
                      onClick={() => voidPay.mutate({ id: b.id, paymentId: p.id, reason }, { onSuccess: () => setVoiding(null) })}>Void</Button>
                    <Button size="sm" variant="ghost" onClick={() => setVoiding(null)}><XCircle className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ── Itinerary ──

function Itinerary({ d }: { d: TourBookingDetailDto }) {
  if (d.itinerary.length === 0)
    return <p className="text-sm text-muted-foreground py-6 text-center">{d.packageName ? "The package has no itinerary yet." : "Tailor-made trips take their plan from the supplier bookings."}</p>;
  return (
    <ol className="space-y-2">
      {d.itinerary.map(x => (
        <li key={x.dayNumber} className="flex gap-3 rounded-xl border border-border bg-card p-3">
          <div className="w-14 shrink-0 text-center">
            <p className="text-xs font-bold text-primary">Day {x.dayNumber}</p>
            <p className="text-[11px] text-muted-foreground">{dayLabel(addDays(d.booking.startDate, x.dayNumber - 1), { day: "numeric", month: "short" })}</p>
          </div>
          <div className="text-sm min-w-0">
            <p className="font-medium">{x.title}</p>
            {x.description && <p className="text-muted-foreground whitespace-pre-line">{x.description}</p>}
            {(x.accommodation || x.meals) && <p className="text-[11px] text-muted-foreground mt-1">{[x.accommodation && `Stay: ${x.accommodation}`, x.meals && `Meals: ${x.meals}`].filter(Boolean).join(" · ")}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

// ── Dialogs ──

function EditDialog({ d, onClose }: { d: TourBookingDetailDto; onClose: () => void }) {
  const b = d.booking;
  const save = useUpdateTourBooking();
  const [f, setF] = React.useState({
    title: b.title, startDate: b.startDate, endDate: b.endDate, customerName: b.customerName, customerEmail: b.customerEmail ?? "",
    customerPhone: b.customerPhone ?? "", adults: b.adults, children: b.children, singleRooms: b.singleRooms,
    adultPrice: b.adultPrice, childPrice: b.childPrice, singleSupplement: b.singleSupplement,
    discount: b.discountAmount, taxPercent: b.taxPercent, source: b.source ?? "", notes: b.notes ?? "",
  });
  const up = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(s => ({ ...s, [k]: v }));
  const onDeparture = !!b.departureId;
  return (
    <Modal title="Edit booking" onClose={onClose} width="max-w-lg"
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button>
        <Button disabled={!f.customerName.trim() || !f.title.trim() || f.endDate < f.startDate || save.isPending}
          onClick={() => save.mutate({ id: b.id, data: { ...f, customerEmail: f.customerEmail || null, customerPhone: f.customerPhone || null, source: f.source || null, notes: f.notes || null } }, { onSuccess: onClose })}>Save</Button></>}>
      <Field label="Trip title"><input value={f.title} onChange={e => up("title", e.target.value)} className={inputCls} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts" hint={onDeparture ? "Set by the departure" : undefined}><input type="date" disabled={onDeparture} value={f.startDate} onChange={e => up("startDate", e.target.value)} className={inputCls} /></Field>
        <Field label="Ends"><input type="date" disabled={onDeparture} value={f.endDate} min={f.startDate} onChange={e => up("endDate", e.target.value)} className={inputCls} /></Field>
        <Field label="Customer" className="col-span-2"><input value={f.customerName} onChange={e => up("customerName", e.target.value)} className={inputCls} /></Field>
        <Field label="Phone"><input value={f.customerPhone} onChange={e => up("customerPhone", e.target.value)} className={inputCls} /></Field>
        <Field label="Email"><input value={f.customerEmail} onChange={e => up("customerEmail", e.target.value)} className={inputCls} /></Field>
        <Field label="Adults"><input type="number" min={1} value={f.adults} onChange={e => up("adults", Math.max(1, Number(e.target.value)))} className={inputCls} /></Field>
        <Field label="Children"><input type="number" min={0} value={f.children} onChange={e => up("children", Math.max(0, Number(e.target.value)))} className={inputCls} /></Field>
        <Field label="Price per adult"><input type="number" min={0} step="0.01" value={f.adultPrice} onChange={e => up("adultPrice", Number(e.target.value))} className={inputCls} /></Field>
        <Field label="Price per child"><input type="number" min={0} step="0.01" value={f.childPrice} onChange={e => up("childPrice", Number(e.target.value))} className={inputCls} /></Field>
        <Field label="Single rooms"><input type="number" min={0} max={f.adults} value={f.singleRooms} onChange={e => up("singleRooms", Math.max(0, Number(e.target.value)))} className={inputCls} /></Field>
        <Field label="Single supplement"><input type="number" min={0} step="0.01" value={f.singleSupplement} onChange={e => up("singleSupplement", Number(e.target.value))} className={inputCls} /></Field>
        <Field label="Discount"><input type="number" min={0} step="0.01" value={f.discount} onChange={e => up("discount", Number(e.target.value))} className={inputCls} /></Field>
        <Field label="Tax %"><input type="number" min={0} max={100} step="0.01" value={f.taxPercent} onChange={e => up("taxPercent", Number(e.target.value))} className={inputCls} /></Field>
      </div>
      <Field label="Notes"><textarea rows={2} value={f.notes} onChange={e => up("notes", e.target.value)} className={textareaCls} /></Field>
    </Modal>
  );
}

function PayDialog({ bookingId, balance, currency, onClose }: { bookingId: string; balance: number; currency: string; onClose: () => void }) {
  const pay = useAddTourPayment();
  const [amount, setAmount] = React.useState(balance);
  const [method, setMethod] = React.useState("cash");
  const [reference, setReference] = React.useState("");
  const [paidOn, setPaidOn] = React.useState(localToday());
  return (
    <Modal title="Take payment" onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button>
        <Button disabled={!(amount > 0) || amount > balance + 0.005 || pay.isPending}
          onClick={() => pay.mutate({ id: bookingId, data: { amount, method, reference: reference || null, paidOn } }, { onSuccess: onClose })}>
          Record {formatCurrency(amount || 0, currency)}</Button></>}>
      <p className="text-sm text-muted-foreground">Balance {formatCurrency(balance, currency)}. Taking money on an enquiry confirms it.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount"><input autoFocus type="number" min={0} max={balance} step="0.01" value={amount} onChange={e => setAmount(Number(e.target.value))} className={inputCls} /></Field>
        <Field label="Date"><input type="date" value={paidOn} max={localToday()} onChange={e => setPaidOn(e.target.value)} className={inputCls} /></Field>
        <Field label="Method"><select value={method} onChange={e => setMethod(e.target.value)} className={selectCls}>
          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase())}</option>)}</select></Field>
        <Field label="Reference"><input value={reference} onChange={e => setReference(e.target.value)} className={inputCls} placeholder="Receipt / transfer no." /></Field>
      </div>
      <div className="flex gap-1">
        {[0.3, 0.5, 1].map(p => <Button key={p} size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAmount(Math.round(balance * p * 100) / 100)}>{p === 1 ? "Full balance" : `${p * 100}%`}</Button>)}
      </div>
    </Modal>
  );
}

function CancelDialog({ bookingId, paid, currency, onClose }: { bookingId: string; paid: number; currency: string; onClose: () => void }) {
  const status = useTourBookingStatus();
  const [reason, setReason] = React.useState("");
  return (
    <Modal title="Cancel booking" onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Keep booking</Button>
        <Button variant="destructive" disabled={!reason.trim() || status.isPending}
          onClick={() => status.mutate({ id: bookingId, action: "cancel", reason }, { onSuccess: onClose })}>Cancel booking</Button></>}>
      <Field label="Reason"><textarea autoFocus rows={3} value={reason} onChange={e => setReason(e.target.value)} className={textareaCls} placeholder="Customer changed plans, visa refused…" /></Field>
      <p className="text-xs text-muted-foreground">Seats on the departure are released. {paid > 0 ? `${formatCurrency(paid, currency)} received stays on record; void payments you refund.` : ""} Cancel each supplier booking with the supplier too.</p>
    </Modal>
  );
}
