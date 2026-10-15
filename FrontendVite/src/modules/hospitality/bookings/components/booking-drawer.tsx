import * as React from "react";
import {
  BedDouble, CalendarRange, LogIn, LogOut, ArrowRightLeft, Ban, UserX, Pencil, Printer, Receipt, Plus,
  CreditCard, Loader2, Percent, Trash2, Mail, Phone, Globe, Users, StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can, useCan } from "@/components/auth/can";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { exportPdf } from "@/lib/pdf";
import { useCurrency } from "@/hooks/use-currency";
import {
  BOOKING_SOURCES, FOLIO_CATEGORIES, MEAL_PLAN_LABELS, localToday,
  type BookingDto, type FolioDto, type MealPlan,
} from "@/lib/hospitality/hospitality.api";
import {
  useBooking, useFolio, useAvailability, useAmendStay, useMoveRoom, useCancelBooking, useMarkNoShow,
  useCheckInBooking, useCheckOutBooking, useRecordBookingPayment, usePostCharge, useVoidCharge,
  useSetDiscount, useUpdateBookingDetails,
} from "@/hooks/hospitality/use-hospitality";
import { Drawer, Modal, Field, Section, StatusChip, inputCls, selectCls, textareaCls, dayLabel, nightsBetween } from "../../shared/hotel-ui";

const PAY_METHODS = [
  { value: "cash", label: "Cash" }, { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" }, { value: "cheque", label: "Cheque" },
];

type Dialog = null | "amend" | "move" | "cancel" | "noshow" | "pay" | "charge" | "discount" | "details" | "checkout";

/** One stay: what it is, what it costs, and everything the desk can do to it. */
export function BookingDrawer({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const currency = useCurrency();
  const { data: b, isLoading } = useBooking(bookingId);
  const { data: folio } = useFolio(bookingId);
  const [tab, setTab] = React.useState<"overview" | "folio">("overview");
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const checkIn = useCheckInBooking();
  const checkOut = useCheckOutBooking();
  const canEdit = useCan("hospitality.bookings.edit");
  const today = localToday();
  const fmt = (n: number) => formatCurrency(n, currency);

  if (isLoading || !b) {
    return <Drawer title="Booking" onClose={onClose}><div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></Drawer>;
  }

  const open = b.status === "confirmed" || b.status === "checked_in";
  const arrivingOrPast = b.checkIn <= today;

  const footer = canEdit && (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => folio && printFolio(folio, b, currency)}><Printer className="h-3.5 w-3.5" />Print bill</Button>
      {b.status === "confirmed" && (
        <>
          {arrivingOrPast && <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setDialog("noshow")}><UserX className="h-3.5 w-3.5" />No-show</Button>}
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={() => setDialog("cancel")}><Ban className="h-3.5 w-3.5" />Cancel</Button>
          <Button size="sm" className="gap-1.5" disabled={!arrivingOrPast || checkIn.isPending}
            title={arrivingOrPast ? undefined : `Arrives ${dayLabel(b.checkIn)}`}
            onClick={() => checkIn.mutate({ id: b.id })}>
            {checkIn.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}Check in
          </Button>
        </>
      )}
      {b.status === "checked_in" && (
        <Button size="sm" className="gap-1.5" disabled={checkOut.isPending}
          onClick={() => (b.balance > 0.005 ? setDialog("checkout") : checkOut.mutate({ id: b.id }))}>
          {checkOut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}Check out
        </Button>
      )}
    </>
  );

  return (
    <>
      <Drawer
        onClose={onClose}
        title={<span className="flex items-center gap-2">{b.guestName}<StatusChip status={b.status} /></span>}
        subtitle={<span>{b.bookingNumber} · Room {b.roomNumber} · {dayLabel(b.checkIn)} → {dayLabel(b.checkOut)} ({b.nights} night{b.nights === 1 ? "" : "s"})</span>}
        footer={footer}>
        <div className="flex gap-1 p-1 rounded-lg bg-muted/50 w-fit mb-4">
          {(["overview", "folio"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-3 py-1.5 rounded-md text-xs font-semibold capitalize", tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground")}>
              {t === "folio" ? "Bill (folio)" : "Overview"}
            </button>
          ))}
        </div>

        {/* Money at a glance — the question every guest at the desk asks first. */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Money label="Total" value={fmt(b.totalAmount)} />
          <Money label="Paid" value={fmt(b.paidAmount)} tone="text-success" />
          <Money label={b.balance < 0 ? "Refund due" : "Balance"} value={fmt(Math.abs(b.balance))} tone={b.balance > 0.005 ? "text-destructive" : b.balance < -0.005 ? "text-warning" : "text-foreground"} />
        </div>

        {tab === "overview" ? (
          <Overview b={b} open={open} canEdit={canEdit} onAction={setDialog} />
        ) : folio ? (
          <FolioPanel folio={folio} open={open} onAction={setDialog} />
        ) : (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        )}
      </Drawer>

      {dialog === "amend" && <AmendDialog b={b} onClose={() => setDialog(null)} />}
      {dialog === "move" && <MoveDialog b={b} onClose={() => setDialog(null)} />}
      {dialog === "cancel" && <CancelDialog b={b} kind="cancel" onClose={() => setDialog(null)} />}
      {dialog === "noshow" && <CancelDialog b={b} kind="noshow" onClose={() => setDialog(null)} />}
      {dialog === "pay" && <PayDialog b={b} onClose={() => setDialog(null)} />}
      {dialog === "charge" && <ChargeDialog b={b} onClose={() => setDialog(null)} />}
      {dialog === "discount" && <DiscountDialog b={b} folio={folio} onClose={() => setDialog(null)} />}
      {dialog === "details" && <DetailsDialog b={b} onClose={() => setDialog(null)} />}
      {dialog === "checkout" && <CheckoutBalanceDialog b={b} onPay={() => setDialog("pay")} onClose={() => setDialog(null)} />}
    </>
  );
}

function Money({ label, value, tone = "text-foreground" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("text-base font-bold tabular-nums truncate", tone)}>{value}</p>
    </div>
  );
}

function Overview({ b, open, canEdit, onAction }: { b: BookingDto; open: boolean; canEdit: boolean; onAction: (d: Dialog) => void }) {
  const source = BOOKING_SOURCES.find(s => s.value === b.source)?.label ?? b.source;
  const rows: [React.ElementType, string, React.ReactNode][] = [
    [BedDouble, "Room", `${b.roomNumber} · ${b.roomType}`],
    [CalendarRange, "Stay", `${dayLabel(b.checkIn, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} → ${dayLabel(b.checkOut, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}`],
    [Users, "Guests", `${b.adults} adult${b.adults === 1 ? "" : "s"}${b.children ? `, ${b.children} child${b.children === 1 ? "" : "ren"}` : ""}`],
    [Receipt, "Rate", b.ratePlanName ? `${b.ratePlanName}${b.mealPlan ? ` · ${MEAL_PLAN_LABELS[b.mealPlan as MealPlan] ?? b.mealPlan}` : ""}` : "—"],
    [Globe, "Source", source],
    [Mail, "Email", b.guestEmail || "—"],
    [Phone, "Phone", b.guestPhone || "—"],
  ];

  return (
    <div className="space-y-5">
      {open && canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onAction("amend")}><CalendarRange className="h-3.5 w-3.5" />Change dates</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onAction("move")}><ArrowRightLeft className="h-3.5 w-3.5" />Move room</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onAction("details")}><Pencil className="h-3.5 w-3.5" />Edit details</Button>
        </div>
      )}

      <Section title="Stay">
        <dl className="rounded-xl border border-border divide-y divide-border bg-card">
          {rows.map(([Icon, k, v]) => (
            <div key={k} className="flex items-start gap-3 px-3 py-2.5 text-sm">
              <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <dt className="w-20 shrink-0 text-muted-foreground">{k}</dt>
              <dd className="min-w-0 break-words">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {(b.specialRequests || b.notes || b.cancelReason) && (
        <Section title="Notes">
          <div className="space-y-2 text-sm">
            {b.specialRequests && <p className="rounded-lg bg-muted/50 px-3 py-2"><span className="font-medium">Guest request: </span>{b.specialRequests}</p>}
            {b.notes && <p className="rounded-lg bg-muted/50 px-3 py-2 flex gap-2"><StickyNote className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />{b.notes}</p>}
            {b.cancelReason && <p className="rounded-lg bg-destructive/10 text-destructive px-3 py-2">Cancelled: {b.cancelReason}</p>}
          </div>
        </Section>
      )}

      <Section title="Timeline">
        <ul className="text-xs text-muted-foreground space-y-1">
          {b.createdAt && <li>Booked {formatDate(b.createdAt, "medium")}</li>}
          {b.actualCheckInAt && <li>Checked in {formatDate(b.actualCheckInAt, "medium")}</li>}
          {b.actualCheckOutAt && <li>Checked out {formatDate(b.actualCheckOutAt, "medium")}</li>}
        </ul>
      </Section>
    </div>
  );
}

function FolioPanel({ folio, open, onAction }: { folio: FolioDto; open: boolean; onAction: (d: Dialog) => void }) {
  const currency = useCurrency();
  const fmt = (n: number) => formatCurrency(n, currency);
  const voidCharge = useVoidCharge();
  const [voiding, setVoiding] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");
  const categoryLabel = (c: string) => FOLIO_CATEGORIES.find(x => x.value === c)?.label ?? c;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {open && <Can permission="hospitality.folio.create"><Button variant="outline" size="sm" className="gap-1.5" onClick={() => onAction("charge")}><Plus className="h-3.5 w-3.5" />Post charge</Button></Can>}
        {folio.status !== "cancelled" && <Can permission="hospitality.bookings.edit"><Button variant="outline" size="sm" className="gap-1.5" disabled={folio.balance <= 0.005} onClick={() => onAction("pay")}><CreditCard className="h-3.5 w-3.5" />Take payment</Button></Can>}
        {open && <Can permission="hospitality.folio.approve"><Button variant="outline" size="sm" className="gap-1.5" onClick={() => onAction("discount")}><Percent className="h-3.5 w-3.5" />Discount</Button></Can>}
      </div>

      <Section title={`Room nights (${folio.nights.length})`}>
        {folio.nights.length === 0 ? <p className="text-xs text-muted-foreground">No nights are charged on this stay.</p> : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {folio.nights.map(n => (
                  <tr key={n.date}>
                    <td className="px-3 py-2">{dayLabel(n.date)}{n.isWeekend && <span className="ms-2 text-[10px] text-muted-foreground">weekend</span>}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{n.season ?? ""}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{fmt(n.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Charges">
        {folio.charges.length === 0 ? <p className="text-xs text-muted-foreground">Nothing posted beyond the room.</p> : (
          <div className="rounded-xl border border-border divide-y divide-border">
            {folio.charges.map(c => (
              <div key={c.id} className={cn("px-3 py-2 text-sm", c.isVoided && "opacity-60")}>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate", c.isVoided && "line-through")}>{c.description}</p>
                    <p className="text-[11px] text-muted-foreground">{categoryLabel(c.category)} · {dayLabel(c.date)} · {c.quantity} × {fmt(c.unitPrice)}{c.postedBy ? ` · ${c.postedBy}` : ""}</p>
                    {c.isVoided && <p className="text-[11px] text-destructive">Voided: {c.voidReason}</p>}
                  </div>
                  <span className={cn("tabular-nums", c.isVoided && "line-through")}>{fmt(c.amount)}</span>
                  {!c.isVoided && folio.status !== "checked_out" && (
                    <Can permission="hospitality.folio.approve">
                      <button onClick={() => { setVoiding(c.id); setReason(""); }} aria-label="Void charge"
                        className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                    </Can>
                  )}
                </div>
                {voiding === c.id && (
                  <div className="mt-2 flex gap-2">
                    <input autoFocus value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is it voided?" className={inputCls} />
                    <Button size="sm" variant="destructive" disabled={!reason.trim() || voidCharge.isPending}
                      onClick={() => voidCharge.mutate({ id: folio.bookingId, chargeId: c.id, reason }, { onSuccess: () => setVoiding(null) })}>Void</Button>
                    <Button size="sm" variant="ghost" onClick={() => setVoiding(null)}>Keep</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Total">
        <div className="rounded-xl border border-border bg-card p-3 text-sm space-y-1.5">
          <Line label="Room" value={fmt(folio.roomCharge)} />
          {folio.extrasTotal > 0 && <Line label="Charges" value={fmt(folio.extrasTotal)} />}
          {folio.discountAmount > 0 && <Line label={`Discount${folio.discountReason ? ` (${folio.discountReason})` : ""}`} value={`− ${fmt(folio.discountAmount)}`} />}
          {folio.serviceAmount > 0 && <Line label={`Service charge ${folio.serviceChargePercent}%`} value={fmt(folio.serviceAmount)} />}
          {folio.taxAmount > 0 && <Line label={`${folio.taxLabel} ${folio.taxPercent}%`} value={fmt(folio.taxAmount)} />}
          {folio.feeAmount > 0 && <Line label={folio.nightlyFeeLabel ?? "Nightly fee"} value={fmt(folio.feeAmount)} />}
          <div className="border-t border-border pt-1.5"><Line label="Total" value={fmt(folio.total)} bold /></div>
          <Line label="Paid" value={fmt(folio.paid)} />
          <Line label={folio.balance < 0 ? "Refund due" : "Balance due"} value={fmt(Math.abs(folio.balance))} bold />
        </div>
      </Section>

      <Section title="Payments">
        {folio.payments.length === 0 ? <p className="text-xs text-muted-foreground">No payments yet.</p> : (
          <div className="rounded-xl border border-border divide-y divide-border">
            {folio.payments.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>{dayLabel(p.paidOn)} · {PAY_METHODS.find(m => m.value === p.method)?.label ?? p.method}{p.reference ? ` · ${p.reference}` : ""}</span>
                <span className="tabular-nums text-success">{fmt(p.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return <div className={cn("flex justify-between gap-3", bold && "font-semibold")}><span className="text-muted-foreground">{label}</span><span className="tabular-nums">{value}</span></div>;
}

// ─── Dialogs ──────────────────────────────────────────────────────────────────

function AmendDialog({ b, onClose }: { b: BookingDto; onClose: () => void }) {
  const amend = useAmendStay();
  const inHouse = b.status === "checked_in";
  const [ci, setCi] = React.useState(b.checkIn);
  const [co, setCo] = React.useState(b.checkOut);
  const nights = nightsBetween(ci, co);
  return (
    <Modal title="Change dates" onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button>
        <Button disabled={nights < 1 || amend.isPending || (ci === b.checkIn && co === b.checkOut)}
          onClick={() => amend.mutate({ id: b.id, checkIn: ci, checkOut: co }, { onSuccess: onClose })}>Save dates</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Arrival" hint={inHouse ? "The guest is in house." : undefined}><input type="date" value={ci} disabled={inHouse} onChange={e => setCi(e.target.value)} className={inputCls} /></Field>
        <Field label="Departure"><input type="date" value={co} min={ci} onChange={e => setCo(e.target.value)} className={inputCls} /></Field>
      </div>
      <p className="text-xs text-muted-foreground">{nights > 0 ? `${nights} night${nights === 1 ? "" : "s"}.` : "Departure must be after arrival."} Nights already booked keep their price; new nights are priced at today's rates.</p>
    </Modal>
  );
}

function MoveDialog({ b, onClose }: { b: BookingDto; onClose: () => void }) {
  const currency = useCurrency();
  const move = useMoveRoom();
  const from = b.status === "checked_in" && localToday() > b.checkIn ? localToday() : b.checkIn;
  const { data, isLoading } = useAvailability({ checkIn: from, checkOut: b.checkOut, adults: b.adults, children: b.children, excludeBookingId: b.id });
  const [roomId, setRoomId] = React.useState("");
  const [reprice, setReprice] = React.useState(false);
  const options = (data?.roomTypes ?? []).flatMap(t => t.rooms.filter(r => r.id !== b.roomId).map(r => ({ ...r, typeName: t.name, typeId: t.roomTypeId, nightly: t.quote.nights[0]?.rate ?? 0 })));

  return (
    <Modal title={`Move ${b.guestName}`} onClose={onClose} width="max-w-lg"
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button>
        <Button disabled={!roomId || move.isPending} onClick={() => move.mutate({ id: b.id, roomId, reprice }, { onSuccess: onClose })}>Move</Button></>}>
      <p className="text-xs text-muted-foreground">Rooms free from {dayLabel(from)} to {dayLabel(b.checkOut)} that sleep {b.adults + b.children}.</p>
      {isLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /> : options.length === 0 ? (
        <p className="text-sm text-destructive">No other room is free for these nights.</p>
      ) : (
        <div className="max-h-72 overflow-y-auto rounded-xl border border-border divide-y divide-border">
          {options.map(r => (
            <label key={r.id} className={cn("flex items-center gap-3 px-3 py-2 text-sm cursor-pointer", roomId === r.id && "bg-primary/5")}>
              <input type="radio" name="move-room" checked={roomId === r.id} onChange={() => setRoomId(r.id)} />
              <span className="font-medium w-14">{r.roomNumber}</span>
              <span className="flex-1 text-muted-foreground truncate">{r.typeName} · floor {r.floor}{r.view ? ` · ${r.view}` : ""}</span>
              {r.housekeepingStatus === "dirty" && <span className="text-[10px] text-warning">needs cleaning</span>}
              <span className="text-xs tabular-nums">{formatCurrency(r.nightly, currency)}</span>
            </label>
          ))}
        </div>
      )}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={reprice} onChange={e => setReprice(e.target.checked)} className="mt-1" />
        <span>Charge the new room's rate<span className="block text-xs text-muted-foreground">Leave off for a free upgrade or a move the hotel caused — the guest keeps the price they booked.</span></span>
      </label>
    </Modal>
  );
}

function CancelDialog({ b, kind, onClose }: { b: BookingDto; kind: "cancel" | "noshow"; onClose: () => void }) {
  const currency = useCurrency();
  const cancel = useCancelBooking();
  const noShow = useMarkNoShow();
  const [reason, setReason] = React.useState("");
  const [fee, setFee] = React.useState("");
  const pending = cancel.isPending || noShow.isPending;
  const feeNum = fee.trim() ? Number(fee) : null;
  const submit = () => kind === "cancel"
    ? cancel.mutate({ id: b.id, reason, fee: feeNum }, { onSuccess: onClose })
    : noShow.mutate({ id: b.id, fee: feeNum }, { onSuccess: onClose });

  return (
    <Modal title={kind === "cancel" ? "Cancel booking" : "Mark as no-show"} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Keep booking</Button>
        <Button variant="destructive" disabled={pending || (kind === "cancel" && !reason.trim()) || (feeNum !== null && !(feeNum >= 0))} onClick={submit}>
          {kind === "cancel" ? "Cancel booking" : "Mark no-show"}</Button></>}>
      {kind === "cancel" && <Field label="Reason"><textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} className={textareaCls} placeholder="Guest changed plans…" /></Field>}
      <Field label={kind === "cancel" ? "Cancellation fee (optional)" : "No-show charge (optional)"}
        hint={`The room nights come off the bill. ${b.paidAmount > 0 ? `${formatCurrency(b.paidAmount, currency)} already paid stays recorded; anything above the fee shows as a refund due.` : ""}`}>
        <input type="number" min={0} step="0.01" value={fee} onChange={e => setFee(e.target.value)} className={inputCls} placeholder="0.00" />
      </Field>
    </Modal>
  );
}

function PayDialog({ b, onClose }: { b: BookingDto; onClose: () => void }) {
  const currency = useCurrency();
  const pay = useRecordBookingPayment();
  const [amount, setAmount] = React.useState(String(Math.max(0, b.balance)));
  const [method, setMethod] = React.useState("card");
  const [reference, setReference] = React.useState("");
  const n = Number(amount);
  const valid = amount.trim() !== "" && n > 0 && n <= b.balance + 0.005;
  return (
    <Modal title="Take payment" onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button>
        <Button disabled={!valid || pay.isPending} onClick={() => pay.mutate({ id: b.id, amount: n, method, reference: reference || null }, { onSuccess: onClose })}>Record {valid ? formatCurrency(n, currency) : ""}</Button></>}>
      <p className="text-xs text-muted-foreground">Still owed: {formatCurrency(b.balance, currency)}</p>
      <Field label="Amount"><input type="number" min={0} step="0.01" autoFocus value={amount} onChange={e => setAmount(e.target.value)} className={inputCls} /></Field>
      {n > b.balance + 0.005 && <p className="text-xs text-destructive">More than is owed.</p>}
      <Field label="Method"><select value={method} onChange={e => setMethod(e.target.value)} className={selectCls}>{PAY_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></Field>
      <Field label="Reference (optional)"><input value={reference} onChange={e => setReference(e.target.value)} className={inputCls} placeholder="Card slip / transfer ref" /></Field>
    </Modal>
  );
}

function ChargeDialog({ b, onClose }: { b: BookingDto; onClose: () => void }) {
  const currency = useCurrency();
  const post = usePostCharge();
  const [category, setCategory] = React.useState("minibar");
  const [description, setDescription] = React.useState("");
  const [qty, setQty] = React.useState("1");
  const [price, setPrice] = React.useState("");
  const q = Number(qty), p = Number(price);
  const valid = description.trim() && q > 0 && p > 0;
  return (
    <Modal title="Post a charge" onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button>
        <Button disabled={!valid || post.isPending} onClick={() => post.mutate({ id: b.id, category, description, quantity: q, unitPrice: p }, { onSuccess: onClose })}>
          Post {valid ? formatCurrency(q * p, currency) : ""}</Button></>}>
      <Field label="Category"><select value={category} onChange={e => { setCategory(e.target.value); if (!description) setDescription(FOLIO_CATEGORIES.find(c => c.value === e.target.value)?.label ?? ""); }} className={selectCls}>
        {FOLIO_CATEGORIES.filter(c => c.value !== "cancellation_fee").map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></Field>
      <Field label="Description"><input autoFocus value={description} onChange={e => setDescription(e.target.value)} className={inputCls} placeholder="2 × water, 1 × juice" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantity"><input type="number" min={0} step="1" value={qty} onChange={e => setQty(e.target.value)} className={inputCls} /></Field>
        <Field label="Unit price"><input type="number" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)} className={inputCls} /></Field>
      </div>
      <p className="text-xs text-muted-foreground">Service charge and tax are added on the bill.</p>
    </Modal>
  );
}

function DiscountDialog({ b, folio, onClose }: { b: BookingDto; folio?: FolioDto; onClose: () => void }) {
  const set = useSetDiscount();
  const [amount, setAmount] = React.useState(String(b.discountAmount || ""));
  const [reason, setReason] = React.useState("");
  const n = amount.trim() ? Number(amount) : 0;
  const max = (folio?.roomCharge ?? b.roomCharge) + (folio?.extrasTotal ?? b.extrasTotal);
  const valid = n >= 0 && n <= max && (n === 0 || reason.trim());
  return (
    <Modal title="Discount" onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button>
        <Button disabled={!valid || set.isPending} onClick={() => set.mutate({ id: b.id, amount: n, reason: reason || null }, { onSuccess: onClose })}>{n === 0 ? "Remove discount" : "Save"}</Button></>}>
      <Field label="Amount off before service and tax"><input type="number" min={0} step="0.01" autoFocus value={amount} onChange={e => setAmount(e.target.value)} className={inputCls} /></Field>
      {n > max && <p className="text-xs text-destructive">More than the bill before tax.</p>}
      <Field label="Reason"><input value={reason} onChange={e => setReason(e.target.value)} className={inputCls} placeholder="Returning guest, complaint…" /></Field>
    </Modal>
  );
}

function DetailsDialog({ b, onClose }: { b: BookingDto; onClose: () => void }) {
  const save = useUpdateBookingDetails();
  const [f, setF] = React.useState({
    guestName: b.guestName, guestEmail: b.guestEmail, guestPhone: b.guestPhone, guestNationality: b.guestNationality,
    adults: b.adults, children: b.children, source: b.source, specialRequests: b.specialRequests ?? "", notes: b.notes ?? "",
  });
  const up = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(s => ({ ...s, [k]: v }));
  return (
    <Modal title="Edit booking details" onClose={onClose} width="max-w-lg"
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button>
        <Button disabled={!f.guestName.trim() || f.adults < 1 || save.isPending} onClick={() => save.mutate({ id: b.id, data: f }, { onSuccess: onClose })}>Save</Button></>}>
      <Field label="Guest name"><input value={f.guestName} onChange={e => up("guestName", e.target.value)} className={inputCls} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email"><input type="email" value={f.guestEmail} onChange={e => up("guestEmail", e.target.value)} className={inputCls} /></Field>
        <Field label="Phone"><input value={f.guestPhone} onChange={e => up("guestPhone", e.target.value)} className={inputCls} /></Field>
        <Field label="Nationality"><input value={f.guestNationality} onChange={e => up("guestNationality", e.target.value)} className={inputCls} /></Field>
        <Field label="Source"><select value={f.source} onChange={e => up("source", e.target.value)} className={selectCls}>{BOOKING_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></Field>
        <Field label="Adults"><input type="number" min={1} value={f.adults} onChange={e => up("adults", Number(e.target.value))} className={inputCls} /></Field>
        <Field label="Children"><input type="number" min={0} value={f.children} onChange={e => up("children", Number(e.target.value))} className={inputCls} /></Field>
      </div>
      <Field label="Guest requests"><textarea rows={2} value={f.specialRequests} onChange={e => up("specialRequests", e.target.value)} className={textareaCls} /></Field>
      <Field label="Internal notes"><textarea rows={2} value={f.notes} onChange={e => up("notes", e.target.value)} className={textareaCls} /></Field>
    </Modal>
  );
}

function CheckoutBalanceDialog({ b, onPay, onClose }: { b: BookingDto; onPay: () => void; onClose: () => void }) {
  const currency = useCurrency();
  const checkOut = useCheckOutBooking();
  return (
    <Modal title="Money is still owed" onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button>
        <Button variant="outline" disabled={checkOut.isPending} onClick={() => checkOut.mutate({ id: b.id, allowBalance: true }, { onSuccess: onClose })}>Check out, leave balance open</Button>
        <Button onClick={onPay}>Take payment</Button></>}>
      <p className="text-sm">{b.guestName} still owes <span className="font-semibold">{formatCurrency(b.balance, currency)}</span>.</p>
      <p className="text-xs text-muted-foreground">Leave the balance open only when a company or agent will pay later. It stays on the booking until it is paid.</p>
    </Modal>
  );
}

// ─── Print ────────────────────────────────────────────────────────────────────

function printFolio(f: FolioDto, b: BookingDto, currency: string) {
  const fmt = (n: number) => formatCurrency(n, currency);
  const rows: (string | number)[][] = [
    ...f.nights.map(n => [n.date, `Room ${f.roomNumber}${n.season ? ` (${n.season})` : ""}`, "1", fmt(n.rate)]),
    ...f.charges.filter(c => !c.isVoided).map(c => [c.date, c.description, String(c.quantity), fmt(c.amount)]),
  ];
  const totals: [string, number][] = [["Subtotal", f.roomCharge + f.extrasTotal]];
  if (f.discountAmount) totals.push([`Discount${f.discountReason ? ` — ${f.discountReason}` : ""}`, -f.discountAmount]);
  if (f.serviceAmount) totals.push([`Service charge ${f.serviceChargePercent}%`, f.serviceAmount]);
  if (f.taxAmount) totals.push([`${f.taxLabel} ${f.taxPercent}%`, f.taxAmount]);
  if (f.feeAmount) totals.push([f.nightlyFeeLabel ?? "Nightly fee", f.feeAmount]);
  totals.push(["Total", f.total], ["Paid", -f.paid], [f.balance < 0 ? "Refund due" : "Balance due", Math.abs(f.balance)]);
  for (const [label, v] of totals) rows.push(["", label, "", fmt(v)]);
  exportPdf({
    title: `Guest bill — ${f.bookingNumber}`,
    subtitle: `${b.guestName} · Room ${f.roomNumber} · ${f.checkIn} to ${f.checkOut}`,
    columns: ["Date", "Description", "Qty", "Amount"],
    rows,
  });
}
