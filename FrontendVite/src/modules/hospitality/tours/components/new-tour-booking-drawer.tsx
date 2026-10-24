import * as React from "react";
import { Loader2, UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { localToday, type GuestDto } from "@/lib/hospitality/hospitality.api";
import { useGuests } from "@/hooks/hospitality/use-hospitality";
import { useCreateTourBooking, useTourDepartures, useTourPackages } from "@/hooks/hospitality/use-tours";
import { Drawer, Field, Section, inputCls, selectCls, textareaCls, dayLabel, addDays } from "../../shared/hotel-ui";
import { BOOKING_SOURCES, SeatsBar } from "./tour-ui";

export interface NewTourBookingPrefill { departureId?: string; packageId?: string }

type Mode = "departure" | "package" | "custom";

/** Takes a booking: a seat on a scheduled departure, a package on the customer's own dates, or a tailor-made trip. */
export function NewTourBookingDrawer({ prefill, onClose, onCreated }:
  { prefill?: NewTourBookingPrefill; onClose: () => void; onCreated?: (id: string) => void }) {
  const currency = useCurrency();
  const today = localToday();
  const { data: packages = [] } = useTourPackages();
  const { data: departures = [] } = useTourDepartures({ from: today, includeClosed: false });
  const create = useCreateTourBooking();

  const [mode, setMode] = React.useState<Mode>(prefill?.departureId ? "departure" : prefill?.packageId ? "package" : "departure");
  const [departureId, setDepartureId] = React.useState(prefill?.departureId ?? "");
  const [packageId, setPackageId] = React.useState(prefill?.packageId ?? "");
  const [title, setTitle] = React.useState("");
  const [start, setStart] = React.useState(addDays(today, 14));
  const [end, setEnd] = React.useState("");

  const [adults, setAdults] = React.useState(2);
  const [children, setChildren] = React.useState(0);
  const [singles, setSingles] = React.useState(0);
  const [adultPrice, setAdultPrice] = React.useState<string>("");
  const [childPrice, setChildPrice] = React.useState<string>("");
  const [discount, setDiscount] = React.useState(0);
  const [tax, setTax] = React.useState(0);

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [guest, setGuest] = React.useState<GuestDto | null>(null);
  const [source, setSource] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [confirm, setConfirm] = React.useState(false);

  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => { const h = setTimeout(() => setDebounced(name.trim().length >= 2 && !guest ? name.trim() : ""), 300); return () => clearTimeout(h); }, [name, guest]);
  const { data: matches } = useGuests({ search: debounced, pageSize: 5 });

  const dep = departures.find(d => d.id === departureId);
  const pkg = packages.find(p => p.id === (mode === "departure" ? dep?.packageId : packageId));

  // Price inputs start from the departure / package price but can be overridden for this customer.
  const baseAdult = mode === "departure" ? dep?.adultPrice ?? 0 : mode === "package" ? pkg?.pricePerAdult ?? 0 : 0;
  const baseChild = mode === "departure" ? dep?.childPrice ?? 0 : mode === "package" ? pkg?.pricePerChild ?? 0 : 0;
  const ap = adultPrice === "" ? baseAdult : Number(adultPrice);
  const cp = childPrice === "" ? baseChild : Number(childPrice);
  const sup = pkg?.singleSupplement ?? 0;
  const subtotal = adults * ap + children * cp + singles * sup;
  const net = Math.max(0, subtotal - discount);
  const taxAmt = Math.round(net * tax) / 100;
  const total = net + taxAmt;

  const autoEnd = pkg ? addDays(start, pkg.durationDays - 1) : "";
  const tripEnd = mode === "departure" ? dep?.endDate : end || autoEnd;
  const seatsShort = mode === "departure" && dep ? adults + children > dep.seatsLeft : false;

  const valid = name.trim() && adults >= 1 && !seatsShort && (
    mode === "departure" ? !!dep :
    mode === "package" ? !!pkg && !!start :
    title.trim() && start && end && end >= start);

  const submit = () => create.mutate({
    departureId: mode === "departure" ? departureId : null,
    packageId: mode === "package" ? packageId : null,
    title: mode === "custom" ? title : null,
    startDate: mode === "departure" ? null : start,
    endDate: mode === "departure" ? null : (end || null),
    guestId: guest?.id ?? null, customerName: name.trim(), customerEmail: email || null, customerPhone: phone || null,
    adults, children, singleRooms: singles,
    adultPrice: adultPrice === "" ? (mode === "custom" ? 0 : null) : Number(adultPrice),
    childPrice: childPrice === "" ? (mode === "custom" ? 0 : null) : Number(childPrice),
    singleSupplement: null, discount, taxPercent: tax, source: source || null, notes: notes || null, confirm,
  }, { onSuccess: r => { onClose(); onCreated?.(r.id); } });

  const pick = (g: GuestDto) => { setGuest(g); setName(g.fullName); setEmail(g.email ?? ""); setPhone(g.phone ?? ""); };

  return (
    <Drawer title="New tour booking" onClose={onClose} width="max-w-2xl"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Close</Button>
        <Button disabled={!valid || create.isPending} onClick={submit}>
          {create.isPending && <Loader2 className="h-4 w-4 animate-spin me-1" />}Create booking — {formatCurrency(total, currency)}
        </Button>
      </>}>
      <div className="space-y-5">
        <div className="grid grid-cols-3 rounded-lg border border-border overflow-hidden text-sm">
          {([["departure", "Group departure"], ["package", "Package, own dates"], ["custom", "Tailor-made"]] as const).map(([m, l]) => (
            <button key={m} onClick={() => { setMode(m); setAdultPrice(""); setChildPrice(""); }}
              className={cn("h-9 px-2", mode === m ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>{l}</button>
          ))}
        </div>

        <Section title="Trip">
          {mode === "departure" && (departures.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open departures. Add one from Tour packages, or book a package on the customer's own dates.</p>
          ) : (
            <div className="rounded-xl border border-border divide-y divide-border max-h-64 overflow-y-auto">
              {departures.map(d => (
                <button key={d.id} onClick={() => setDepartureId(d.id)} disabled={d.seatsLeft === 0}
                  className={cn("w-full text-start flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/40 disabled:opacity-50",
                    d.id === departureId && "bg-primary/10 ring-1 ring-inset ring-primary")}>
                  <div className="flex-1 min-w-[180px]">
                    <p className="font-medium">{d.packageName}</p>
                    <p className="text-[11px] text-muted-foreground">{dayLabel(d.startDate)} → {dayLabel(d.endDate)} · {formatCurrency(d.adultPrice, currency)} / adult</p>
                  </div>
                  <SeatsBar booked={d.seatsBooked} capacity={d.capacity} />
                </button>
              ))}
            </div>
          ))}
          {mode === "package" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Package" className="col-span-2">
                <select value={packageId} onChange={e => setPackageId(e.target.value)} className={selectCls}>
                  <option value="">Choose a package…</option>
                  {packages.map(p => <option key={p.id} value={p.id}>{p.name} · {p.durationDays} days</option>)}
                </select>
              </Field>
              <Field label="Starts"><input type="date" value={start} onChange={e => setStart(e.target.value)} className={inputCls} /></Field>
              <Field label="Ends" hint={autoEnd ? `Blank = ${dayLabel(autoEnd)}` : undefined}><input type="date" value={end} min={start} onChange={e => setEnd(e.target.value)} className={inputCls} /></Field>
            </div>
          )}
          {mode === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Trip title" className="col-span-2"><input autoFocus value={title} onChange={e => setTitle(e.target.value)} className={inputCls} placeholder="Maldives honeymoon, 5 nights" /></Field>
              <Field label="Starts"><input type="date" value={start} onChange={e => setStart(e.target.value)} className={inputCls} /></Field>
              <Field label="Ends"><input type="date" value={end} min={start} onChange={e => setEnd(e.target.value)} className={inputCls} /></Field>
              <p className="col-span-2 text-[11px] text-muted-foreground">Add the hotels, flights and transfers as supplier bookings after creating it. Each can be sold as an extra on top of the per-person price.</p>
            </div>
          )}
        </Section>

        <Section title="Customer">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lead customer" className="col-span-2 relative">
              <div className="relative">
                <input value={name} onChange={e => { setName(e.target.value); setGuest(null); }} className={inputCls} placeholder="Full name" />
                {guest && <button onClick={() => setGuest(null)} className="absolute end-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-[11px] text-emerald-600" title="Unlink">
                  <UserCheck className="h-3.5 w-3.5" />Returning customer<X className="h-3 w-3" /></button>}
              </div>
              {!guest && (matches?.items.length ?? 0) > 0 && (
                <div className="mt-1 rounded-lg border border-border bg-card shadow-sm divide-y divide-border">
                  {matches!.items.map(g => (
                    <button key={g.id} onClick={() => pick(g)} className="w-full text-start px-3 py-1.5 text-sm hover:bg-muted/50">
                      {g.fullName} <span className="text-xs text-muted-foreground">{[g.phone, g.email].filter(Boolean).join(" · ")}</span>
                    </button>
                  ))}
                </div>
              )}
            </Field>
            <Field label="Phone"><input value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} /></Field>
            <Field label="Email"><input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} /></Field>
            <Field label="Source"><select value={source} onChange={e => setSource(e.target.value)} className={selectCls}>
              <option value="">—</option>{BOOKING_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}</select></Field>
          </div>
        </Section>

        <Section title="Travellers and price">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Adults"><input type="number" min={1} value={adults} onChange={e => setAdults(Math.max(1, Number(e.target.value)))} className={inputCls} /></Field>
            <Field label="Children"><input type="number" min={0} value={children} onChange={e => setChildren(Math.max(0, Number(e.target.value)))} className={inputCls} /></Field>
            <Field label="Single rooms" hint={sup ? `+${formatCurrency(sup, currency)} each` : undefined}>
              <input type="number" min={0} max={adults} value={singles} onChange={e => setSingles(Math.min(adults, Math.max(0, Number(e.target.value))))} className={inputCls} /></Field>
            <Field label="Price per adult"><input type="number" min={0} step="0.01" value={adultPrice} placeholder={String(baseAdult)} onChange={e => setAdultPrice(e.target.value)} className={inputCls} /></Field>
            <Field label="Price per child"><input type="number" min={0} step="0.01" value={childPrice} placeholder={String(baseChild)} onChange={e => setChildPrice(e.target.value)} className={inputCls} /></Field>
            <div />
            <Field label="Discount"><input type="number" min={0} step="0.01" value={discount} onChange={e => setDiscount(Math.max(0, Number(e.target.value)))} className={inputCls} /></Field>
            <Field label="Tax %"><input type="number" min={0} max={100} step="0.01" value={tax} onChange={e => setTax(Math.min(100, Math.max(0, Number(e.target.value))))} className={inputCls} /></Field>
          </div>
          {seatsShort && <p className="text-xs text-destructive">Only {dep!.seatsLeft} seat{dep!.seatsLeft === 1 ? "" : "s"} left on this departure.</p>}
          <div className="rounded-xl bg-muted/40 p-3 text-sm space-y-1">
            <Row l={`${adults} × adult`} v={adults * ap} c={currency} />
            {children > 0 && <Row l={`${children} × child`} v={children * cp} c={currency} />}
            {singles > 0 && <Row l={`${singles} × single supplement`} v={singles * sup} c={currency} />}
            {discount > 0 && <Row l="Discount" v={-discount} c={currency} />}
            {tax > 0 && <Row l={`Tax ${tax}%`} v={taxAmt} c={currency} />}
            <div className="flex justify-between font-bold border-t border-border pt-1"><span>Total</span><span className="tabular-nums">{formatCurrency(total, currency)}</span></div>
            {tripEnd && <p className="text-[11px] text-muted-foreground">Travelling {dayLabel(mode === "departure" ? dep!.startDate : start)} → {dayLabel(tripEnd)}</p>}
          </div>
        </Section>

        <Field label="Notes"><textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={textareaCls} placeholder="Special requests, dietary needs…" /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} />
          Confirmed now <span className="text-muted-foreground text-xs">(otherwise it stays an enquiry until confirmed or a deposit is taken)</span></label>
      </div>
    </Drawer>
  );
}

function Row({ l, v, c }: { l: string; v: number; c: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{l}</span><span className="tabular-nums">{formatCurrency(v, c)}</span></div>;
}
