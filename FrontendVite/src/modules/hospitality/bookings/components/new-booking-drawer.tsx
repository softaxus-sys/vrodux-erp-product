import * as React from "react";
import { BedDouble, Check, Loader2, Search, Star, UserPlus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { BOOKING_SOURCES, MEAL_PLAN_LABELS, localToday, type GuestDto, type RoomTypeAvailabilityDto } from "@/lib/hospitality/hospitality.api";
import { useAvailability, useCreateBooking, useGuests, useRatePlans } from "@/hooks/hospitality/use-hospitality";
import { Drawer, Field, Section, inputCls, selectCls, textareaCls, addDays, nightsBetween, dayLabel } from "../../shared/hotel-ui";

export interface NewBookingPrefill { roomId?: string; checkIn?: string; checkOut?: string }

const PAY_METHODS = [
  { value: "cash", label: "Cash" }, { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" }, { value: "cheque", label: "Cheque" },
];

/**
 * Taking a reservation: dates and party first, then only rooms that are actually free for every
 * night, each with the real price for the stay; then who is staying. The server re-checks and
 * re-prices everything on save — what is shown here is a quote, not the authority.
 */
export function NewBookingDrawer({ prefill, onClose, onCreated }:
  { prefill?: NewBookingPrefill; onClose: () => void; onCreated?: (id: string) => void }) {
  const currency = useCurrency();
  const fmt = (n: number) => formatCurrency(n, currency);
  const today = localToday();

  const [checkIn, setCheckIn] = React.useState(prefill?.checkIn ?? today);
  const [checkOut, setCheckOut] = React.useState(prefill?.checkOut ?? addDays(prefill?.checkIn ?? today, 1));
  const [adults, setAdults] = React.useState(2);
  const [children, setChildren] = React.useState(0);
  const { data: plans = [] } = useRatePlans();
  const [planId, setPlanId] = React.useState<string>("");
  React.useEffect(() => { if (!planId && plans.length) setPlanId(plans.find(p => p.isDefault)?.id ?? plans[0].id); }, [plans, planId]);

  const nights = nightsBetween(checkIn, checkOut);
  const search = nights > 0 && planId ? { checkIn, checkOut, adults, children, ratePlanId: planId } : null;
  const { data: avail, isFetching } = useAvailability(search);

  const [typeId, setTypeId] = React.useState<string | null>(null);
  const [roomId, setRoomId] = React.useState<string | null>(prefill?.roomId ?? null);

  // A room preselected from the calendar fixes its type once availability is known.
  React.useEffect(() => {
    if (!avail || !roomId) return;
    const t = avail.roomTypes.find(x => x.rooms.some(r => r.id === roomId));
    if (t) setTypeId(t.roomTypeId);
    else if (prefill?.roomId === roomId) setRoomId(null);
  }, [avail, roomId, prefill?.roomId]);

  const chosenType = avail?.roomTypes.find(t => t.roomTypeId === typeId) ?? null;
  const roomStillFree = !!chosenType && !!roomId && chosenType.rooms.some(r => r.id === roomId);

  // Guest
  const [guestQuery, setGuestQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => { const h = setTimeout(() => setDebounced(guestQuery), 250); return () => clearTimeout(h); }, [guestQuery]);
  const { data: matches } = useGuests({ search: debounced, pageSize: 6 });
  const [guest, setGuest] = React.useState<GuestDto | null>(null);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [nationality, setNationality] = React.useState("");
  const [source, setSource] = React.useState("direct");
  const [requests, setRequests] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [deposit, setDeposit] = React.useState("");
  const [method, setMethod] = React.useState("card");

  const pickGuest = (g: GuestDto) => {
    setGuest(g); setName(g.fullName); setEmail(g.email ?? ""); setPhone(g.phone ?? ""); setNationality(g.nationality ?? "");
    setGuestQuery("");
  };

  const create = useCreateBooking();
  const total = chosenType?.quote.total ?? 0;
  const depositNum = deposit.trim() ? Number(deposit) : 0;
  const minNightsOk = !chosenType || nights >= chosenType.quote.minNightsRequired;
  const canSave = roomStillFree && name.trim() && adults >= 1 && minNightsOk && depositNum >= 0 && depositNum <= total + 0.005 && !create.isPending;

  const save = () => create.mutate({
    roomId: roomId!, guestId: guest?.id ?? null, guestName: name.trim(), guestEmail: email || null, guestPhone: phone || null,
    guestNationality: nationality || null, checkIn, checkOut, nights, adults, children, source,
    specialRequests: requests || null, notes: notes || null, ratePlanId: planId,
    paidAmount: depositNum > 0 ? depositNum : null, paymentMethod: depositNum > 0 ? method : null,
  }, { onSuccess: r => { onCreated?.(r.id); onClose(); } });

  return (
    <Drawer title="New reservation" subtitle={nights > 0 ? `${nights} night${nights === 1 ? "" : "s"} · ${dayLabel(checkIn)} → ${dayLabel(checkOut)}` : "Pick the dates"}
      onClose={onClose} width="max-w-3xl"
      footer={<>
        {chosenType && <span className="me-auto text-sm">Stay total <span className="font-bold">{fmt(total)}</span></span>}
        <Button variant="ghost" onClick={onClose}>Close</Button>
        <Button disabled={!canSave} onClick={save} className="gap-1.5">{create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Confirm booking</Button>
      </>}>
      <div className="space-y-6">
        <Section title="1 · Dates and guests">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Field label="Arrival"><input type="date" value={checkIn} onChange={e => { setCheckIn(e.target.value); if (e.target.value >= checkOut) setCheckOut(addDays(e.target.value, 1)); }} className={inputCls} /></Field>
            <Field label="Departure"><input type="date" value={checkOut} min={addDays(checkIn, 1)} onChange={e => setCheckOut(e.target.value)} className={inputCls} /></Field>
            <Field label="Adults"><input type="number" min={1} max={20} value={adults} onChange={e => setAdults(Math.max(1, Number(e.target.value)))} className={inputCls} /></Field>
            <Field label="Children"><input type="number" min={0} max={20} value={children} onChange={e => setChildren(Math.max(0, Number(e.target.value)))} className={inputCls} /></Field>
            <Field label="Rate"><select value={planId} onChange={e => setPlanId(e.target.value)} className={selectCls}>
              {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          </div>
          {checkIn < today && <p className="text-xs text-warning flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />Arrival is in the past.</p>}
        </Section>

        <Section title="2 · Room" action={isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}>
          {!search ? <p className="text-xs text-muted-foreground">Pick dates to see what is free.</p> : !avail ? null : avail.roomTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No room types are set up yet. Add them under Rooms.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {avail.roomTypes.map(t => (
                <TypeCard key={t.roomTypeId} t={t} nights={nights} selected={typeId === t.roomTypeId} fmt={fmt}
                  onSelect={() => { setTypeId(t.roomTypeId); setRoomId(t.rooms[0]?.id ?? null); }} />
              ))}
            </div>
          )}
          {chosenType && (
            <div className="rounded-xl border border-border bg-card p-3 space-y-3">
              <Field label={`Room (${chosenType.rooms.length} free)`}>
                <select value={roomId ?? ""} onChange={e => setRoomId(e.target.value)} className={selectCls}>
                  {chosenType.rooms.map(r => (
                    <option key={r.id} value={r.id}>Room {r.roomNumber} · floor {r.floor}{r.view ? ` · ${r.view}` : ""}{r.housekeepingStatus === "dirty" ? " · needs cleaning" : ""}</option>
                  ))}
                </select>
              </Field>
              {!minNightsOk && <p className="text-xs text-destructive">This rate needs at least {chosenType.quote.minNightsRequired} nights on these dates.</p>}
              <div className="text-xs grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
                {chosenType.quote.nights.map(n => (
                  <span key={n.date} className="flex justify-between gap-2"><span className="text-muted-foreground">{dayLabel(n.date, { weekday: "short", day: "numeric" })}</span><span className="tabular-nums">{fmt(n.rate)}</span></span>
                ))}
              </div>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4">
                <span>Room {fmt(chosenType.quote.roomCharge)}</span>
                {chosenType.quote.serviceAmount > 0 && <span>Service {fmt(chosenType.quote.serviceAmount)}</span>}
                {chosenType.quote.taxAmount > 0 && <span>Tax {fmt(chosenType.quote.taxAmount)}</span>}
                {chosenType.quote.feeAmount > 0 && <span>Fees {fmt(chosenType.quote.feeAmount)}</span>}
              </div>
              {(() => { const plan = plans.find(p => p.id === planId); return plan ? <p className="text-xs text-muted-foreground">{MEAL_PLAN_LABELS[plan.mealPlan]} · {plan.isRefundable ? "Refundable" : "Non-refundable"}</p> : null; })()}
            </div>
          )}
        </Section>

        <Section title="3 · Guest">
          {!guest && (
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={guestQuery} onChange={e => setGuestQuery(e.target.value)} placeholder="Find a returning guest by name, email, phone or passport"
                className={cn(inputCls, "ps-9")} />
              {guestQuery.trim().length > 1 && (matches?.items.length ?? 0) > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-card shadow-lg overflow-hidden">
                  {matches!.items.map(g => (
                    <button key={g.id} type="button" onClick={() => pickGuest(g)} className="w-full text-start px-3 py-2 text-sm hover:bg-muted flex items-center gap-2">
                      {g.isVip && <Star className="h-3.5 w-3.5 text-warning fill-warning" />}
                      <span className="font-medium">{g.fullName}</span>
                      <span className="text-xs text-muted-foreground truncate">{g.email ?? g.phone ?? ""}</span>
                      <span className="ms-auto text-[11px] text-muted-foreground">{g.stayCount} stay{g.stayCount === 1 ? "" : "s"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {guest && (
            <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-sm">
              <Check className="h-4 w-4 text-primary" />Returning guest — {guest.stayCount} previous stay{guest.stayCount === 1 ? "" : "s"}
              {guest.isVip && <span className="text-[11px] font-semibold text-warning">VIP</span>}
              <button className="ms-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1" onClick={() => setGuest(null)}><UserPlus className="h-3.5 w-3.5" />New guest instead</button>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Full name"><input value={name} onChange={e => setName(e.target.value)} className={inputCls} /></Field>
            <Field label="Phone"><input value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} /></Field>
            <Field label="Email"><input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} /></Field>
            <Field label="Nationality"><input value={nationality} onChange={e => setNationality(e.target.value)} className={inputCls} /></Field>
            <Field label="Booked through"><select value={source} onChange={e => setSource(e.target.value)} className={selectCls}>{BOOKING_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></Field>
          </div>
          <Field label="Guest requests"><textarea rows={2} value={requests} onChange={e => setRequests(e.target.value)} className={textareaCls} placeholder="High floor, late arrival…" /></Field>
          <Field label="Internal notes"><textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={textareaCls} /></Field>
        </Section>

        <Section title="4 · Deposit (optional)">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount taken now"><input type="number" min={0} step="0.01" value={deposit} onChange={e => setDeposit(e.target.value)} className={inputCls} placeholder="0.00" /></Field>
            <Field label="Method"><select value={method} onChange={e => setMethod(e.target.value)} disabled={!depositNum} className={selectCls}>{PAY_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></Field>
          </div>
          {depositNum > total + 0.005 && chosenType && <p className="text-xs text-destructive">More than the stay total.</p>}
        </Section>
      </div>
    </Drawer>
  );
}

function TypeCard({ t, nights, selected, onSelect, fmt }: { t: RoomTypeAvailabilityDto; nights: number; selected: boolean; onSelect: () => void; fmt: (n: number) => string }) {
  const soldOut = t.availableCount === 0;
  return (
    <button type="button" disabled={soldOut} onClick={onSelect}
      className={cn("text-start rounded-xl border p-3 transition-colors",
        selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card hover:border-primary/50",
        soldOut && "opacity-50 cursor-not-allowed")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate flex items-center gap-1.5"><BedDouble className="h-4 w-4 text-muted-foreground" />{t.name}</p>
          <p className="text-[11px] text-muted-foreground">Up to {t.maxAdults} adults{t.maxChildren ? ` + ${t.maxChildren} children` : ""}</p>
        </div>
        <div className="text-end shrink-0">
          <p className="font-bold text-sm tabular-nums">{fmt(t.quote.total)}</p>
          <p className="text-[11px] text-muted-foreground">{nights > 0 ? `${fmt(t.quote.roomCharge / nights)} / night` : ""}</p>
        </div>
      </div>
      <p className={cn("text-[11px] mt-2 font-medium", soldOut ? "text-destructive" : t.availableCount <= 2 ? "text-warning" : "text-success")}>
        {soldOut ? (t.totalRooms === 0 ? "No rooms of this type" : "Sold out for these nights") : `${t.availableCount} of ${t.totalRooms} free`}
        {!t.fitsParty && !soldOut && <span className="text-warning"> · above the usual occupancy</span>}
      </p>
    </button>
  );
}
