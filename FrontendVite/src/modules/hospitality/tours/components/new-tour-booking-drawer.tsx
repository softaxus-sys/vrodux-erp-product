import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { localToday } from "@/lib/hospitality/hospitality.api";
import type { CreateTourBookingRequest } from "@/lib/hospitality/tours.api";
import { useTourPackages, useTourDepartures, useCreateTourBooking } from "@/hooks/hospitality/use-tours";
import { Drawer, Field, Section, inputCls, selectCls, textareaCls, addDays } from "../../shared/hotel-ui";
import { BOOKING_SOURCES } from "./tour-ui";

interface Props {
  /** Starting choices — a departure fixes the package and dates; a package alone means a custom-dated trip. */
  prefill?: { departureId?: string; packageId?: string };
  onClose: () => void;
  onCreated?: (bookingId: string) => void;
}

const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : 0; };

/** Creates a tour booking, either on a scheduled departure (dates + prices come from it) or as a custom trip on a package. */
export function NewTourBookingDrawer({ prefill, onClose, onCreated }: Props) {
  const currency = useCurrency();
  const packages = useTourPackages();
  const create = useCreateTourBooking();

  const [packageId, setPackageId] = React.useState(prefill?.packageId ?? "");
  const [departureId, setDepartureId] = React.useState(prefill?.departureId ?? "");
  const departures = useTourDepartures({ packageId: packageId || undefined, from: localToday() }, !!packageId);
  const pkg = packages.data?.find(p => p.id === packageId);
  const departure = departures.data?.find(d => d.id === departureId);

  const [title, setTitle] = React.useState("");
  const [startDate, setStartDate] = React.useState(localToday());
  const [endDate, setEndDate] = React.useState(addDays(localToday(), 6));
  const [customerName, setCustomerName] = React.useState("");
  const [customerEmail, setCustomerEmail] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [adults, setAdults] = React.useState("2");
  const [children, setChildren] = React.useState("0");
  const [singleRooms, setSingleRooms] = React.useState("0");
  const [adultPrice, setAdultPrice] = React.useState("");
  const [childPrice, setChildPrice] = React.useState("");
  const [discount, setDiscount] = React.useState("0");
  const [taxPercent, setTaxPercent] = React.useState("0");
  const [source, setSource] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [confirm, setConfirm] = React.useState(true);

  // A package's duration suggests the end date for a custom trip.
  React.useEffect(() => {
    if (!departureId && pkg) setEndDate(addDays(startDate, Math.max(0, pkg.durationDays - 1)));
  }, [pkg?.id, startDate, departureId]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Prices default from the departure, else the package; typing overrides.
  const unitAdult = adultPrice !== "" ? num(adultPrice) : departure?.adultPrice ?? pkg?.pricePerAdult ?? 0;
  const unitChild = childPrice !== "" ? num(childPrice) : departure?.childPrice ?? pkg?.pricePerChild ?? 0;
  const single = pkg?.singleSupplement ?? 0;
  const a = Math.floor(num(adults)), c = Math.floor(num(children)), s = Math.floor(num(singleRooms));
  const subtotal = a * unitAdult + c * unitChild + s * single;
  const after = Math.max(0, subtotal - num(discount));
  const total = after + after * num(taxPercent) / 100;

  const seatsLeft = departure?.seatsLeft;
  const overSeats = seatsLeft !== undefined && a + c > seatsLeft;
  const valid = customerName.trim() && a + c > 0 && (departureId || (startDate && endDate && endDate >= startDate)) && (departureId || title.trim() || pkg);

  const submit = () => {
    const body: CreateTourBookingRequest = {
      departureId: departureId || null, packageId: packageId || null,
      title: departureId ? null : (title.trim() || pkg?.name || null),
      startDate: departureId ? null : startDate, endDate: departureId ? null : endDate,
      customerName: customerName.trim(), customerEmail: customerEmail.trim() || null, customerPhone: customerPhone.trim() || null,
      adults: a, children: c, singleRooms: s,
      adultPrice: adultPrice !== "" ? num(adultPrice) : null, childPrice: childPrice !== "" ? num(childPrice) : null, singleSupplement: null,
      discount: num(discount), taxPercent: num(taxPercent), source: source || null, notes: notes.trim() || null, confirm,
    };
    create.mutate(body, { onSuccess: r => { onCreated?.(r.id); onClose(); } });
  };

  return (
    <Drawer title="New tour booking" subtitle={pkg ? pkg.name : "Choose a package or enter a custom trip"} onClose={onClose} width="max-w-2xl"
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="text-sm"><span className="text-muted-foreground">Total </span><span className="font-bold tabular-nums">{formatCurrency(total, currency)}</span></div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={!valid || overSeats || create.isPending} onClick={submit} className="gap-2">
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{confirm ? "Create & confirm" : "Save as enquiry"}
            </Button>
          </div>
        </div>
      }>
      <div className="space-y-6">
        <Section title="Trip">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Package">
              <select className={selectCls} value={packageId} onChange={e => { setPackageId(e.target.value); setDepartureId(""); setAdultPrice(""); setChildPrice(""); }}>
                <option value="">Custom trip (no package)</option>
                {(packages.data ?? []).filter(p => p.isActive || p.id === packageId).map(p => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
              </select>
            </Field>
            <Field label="Departure" hint={packageId ? undefined : "Pick a package to see its departures"}>
              <select className={selectCls} value={departureId} disabled={!packageId} onChange={e => { setDepartureId(e.target.value); setAdultPrice(""); setChildPrice(""); }}>
                <option value="">Custom dates</option>
                {(departures.data ?? []).filter(d => d.status === "open" || d.id === departureId).map(d =>
                  <option key={d.id} value={d.id}>{d.startDate} → {d.endDate} · {d.seatsLeft} seats left</option>)}
              </select>
            </Field>
            {!departureId && (
              <>
                <Field label="Trip title" className="sm:col-span-2"><input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} placeholder={pkg?.name ?? "e.g. Family trip to Istanbul"} /></Field>
                <Field label="Start date"><input type="date" className={inputCls} value={startDate} onChange={e => setStartDate(e.target.value)} /></Field>
                <Field label="End date"><input type="date" className={inputCls} min={startDate} value={endDate} onChange={e => setEndDate(e.target.value)} /></Field>
              </>
            )}
          </div>
          {overSeats && <p className="text-xs text-destructive mt-2" role="alert">Only {seatsLeft} seat(s) left on this departure.</p>}
        </Section>

        <Section title="Customer">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Name" className="sm:col-span-2"><input className={inputCls} value={customerName} onChange={e => setCustomerName(e.target.value)} autoFocus /></Field>
            <Field label="Email"><input type="email" className={inputCls} value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} /></Field>
            <Field label="Phone"><input className={inputCls} value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} /></Field>
            <Field label="Source">
              <select className={selectCls} value={source} onChange={e => setSource(e.target.value)}>
                <option value="">—</option>{BOOKING_SOURCES.map(x => <option key={x}>{x}</option>)}
              </select>
            </Field>
          </div>
        </Section>

        <Section title="Travellers and price">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Adults"><input type="number" min={0} className={inputCls} value={adults} onChange={e => setAdults(e.target.value)} /></Field>
            <Field label="Children"><input type="number" min={0} className={inputCls} value={children} onChange={e => setChildren(e.target.value)} /></Field>
            <Field label="Single rooms" hint={single ? `+${formatCurrency(single, currency)} each` : undefined}><input type="number" min={0} className={inputCls} value={singleRooms} onChange={e => setSingleRooms(e.target.value)} /></Field>
            <Field label="Adult price"><input type="number" min={0} className={inputCls} value={adultPrice} placeholder={String(unitAdult)} onChange={e => setAdultPrice(e.target.value)} /></Field>
            <Field label="Child price"><input type="number" min={0} className={inputCls} value={childPrice} placeholder={String(unitChild)} onChange={e => setChildPrice(e.target.value)} /></Field>
            <Field label="Discount"><input type="number" min={0} className={inputCls} value={discount} onChange={e => setDiscount(e.target.value)} /></Field>
            <Field label="Tax %"><input type="number" min={0} className={inputCls} value={taxPercent} onChange={e => setTaxPercent(e.target.value)} /></Field>
          </div>
        </Section>

        <Field label="Notes"><textarea rows={3} className={textareaCls} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input type="checkbox" className="mt-1" checked={confirm} onChange={e => setConfirm(e.target.checked)} />
          <span><span className="font-medium">Confirm the booking now</span><span className="block text-xs text-muted-foreground">Untick to keep it as an enquiry until the customer commits.</span></span>
        </label>
      </div>
    </Drawer>
  );
}
