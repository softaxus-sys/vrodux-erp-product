import * as React from "react";
import { Map as MapIcon, Plus, Search, Trash2, ArrowUp, ArrowDown, CalendarPlus, Pencil, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can, useCan } from "@/components/auth/can";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { localToday } from "@/lib/hospitality/hospitality.api";
import type { DepartureStatus, ItineraryDayInput, TourDepartureDto, TourPackageDto } from "@/lib/hospitality/tours.api";
import {
  useTourPackages, useSavePackage, useDeletePackage, useTourDepartures, useSaveDeparture, useSetDepartureStatus, useDeleteDeparture,
} from "@/hooks/hospitality/use-tours";
import { Drawer, Modal, Field, Section, Empty, inputCls, selectCls, textareaCls, dayLabel, addDays } from "../../shared/hotel-ui";
import { Chip, DEPARTURE_STATUS, PACKAGE_CATEGORIES, SeatsBar } from "./tour-ui";
import { NewTourBookingDrawer } from "./new-tour-booking-drawer";

/** The agency's catalogue: packages with their itinerary, and the dated departures sold from them. */
export function PackagesView() {
  const currency = useCurrency();
  const [showInactive, setShowInactive] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const { data: packages = [], isLoading } = useTourPackages(showInactive);
  const [editing, setEditing] = React.useState<TourPackageDto | "new" | null>(null);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const shown = packages.filter(p => !search.trim() || `${p.name} ${p.code} ${p.destination ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const open = packages.find(p => p.id === openId) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tour packages</h1>
          <p className="text-sm text-muted-foreground">Trips you sell, with their day-by-day itinerary and scheduled departures.</p>
        </div>
        <Can permission="hospitality.tours.create"><Button className="gap-2 h-9" onClick={() => setEditing("new")}><Plus className="h-4 w-4" />New package</Button></Can>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, code or destination" className={`${inputCls} ps-9`} />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground px-1"><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />Show switched off</label>
      </div>

      {isLoading ? <div className="h-40 rounded-xl bg-muted/40 animate-pulse" /> : shown.length === 0 ? (
        <Empty icon={MapIcon} title={search ? "No package matches" : "No packages yet"} hint={search ? undefined : "Create your first trip: its itinerary, price per person and what is included."} />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {shown.map(p => (
            <button key={p.id} onClick={() => setOpenId(p.id)}
              className={cn("text-start rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition", !p.isActive && "opacity-60")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.code}{p.destination ? ` · ${p.destination}` : ""}</p>
                </div>
                {p.category && <span className="text-[11px] rounded-full bg-muted px-2 py-0.5 shrink-0">{p.category}</span>}
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{p.durationDays} day{p.durationDays === 1 ? "" : "s"} · {p.days.length} itinerary day{p.days.length === 1 ? "" : "s"}</p>
                  <p className="text-xs text-muted-foreground">{p.upcomingDepartures} upcoming departure{p.upcomingDepartures === 1 ? "" : "s"}</p>
                </div>
                <div className="text-end">
                  <p className="text-[11px] text-muted-foreground">from / adult</p>
                  <p className="font-bold tabular-nums">{formatCurrency(p.pricePerAdult, currency)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && <PackageDrawer pkg={open} onClose={() => setOpenId(null)} onEdit={() => setEditing(open)} />}
      {editing && <PackageForm pkg={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={p => { setEditing(null); setOpenId(p.id); }} />}
    </div>
  );
}

function PackageDrawer({ pkg, onClose, onEdit }: { pkg: TourPackageDto; onClose: () => void; onEdit: () => void }) {
  const currency = useCurrency();
  const { data: deps = [], isLoading } = useTourDepartures({ packageId: pkg.id });
  const del = useDeletePackage();
  const setStatus = useSetDepartureStatus();
  const delDep = useDeleteDeparture();
  const [depForm, setDepForm] = React.useState<TourDepartureDto | "new" | null>(null);
  const [bookOn, setBookOn] = React.useState<TourDepartureDto | null>(null);
  const [custom, setCustom] = React.useState(false);
  const canEdit = useCan("hospitality.tours.edit");
  const canBook = useCan("hospitality.tour-bookings.create");
  const today = localToday();

  return (
    <>
      <Drawer title={pkg.name} subtitle={`${pkg.code}${pkg.destination ? ` · ${pkg.destination}` : ""} · ${pkg.durationDays} days`} onClose={onClose} width="max-w-3xl"
        footer={<>
          <Can permission="hospitality.tours.delete"><Button variant="ghost" size="sm" className="gap-1.5 text-destructive" disabled={del.isPending}
            onClick={() => del.mutate(pkg.id, { onSuccess: onClose })}><Trash2 className="h-3.5 w-3.5" />Delete</Button></Can>
          {canBook && <Button variant="outline" size="sm" onClick={() => setCustom(true)}>Book on own dates</Button>}
          <Can permission="hospitality.tours.edit"><Button size="sm" className="gap-1.5" onClick={onEdit}><Pencil className="h-3.5 w-3.5" />Edit package</Button></Can>
        </>}>
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2">
            {([["Adult", pkg.pricePerAdult], ["Child", pkg.pricePerChild], ["Single room +", pkg.singleSupplement]] as const).map(([l, v]) => (
              <div key={l} className="rounded-xl border border-border bg-card p-3"><p className="text-[11px] text-muted-foreground">{l}</p><p className="font-bold tabular-nums">{formatCurrency(v, currency)}</p></div>
            ))}
          </div>

          <Section title="Departures" action={canEdit && <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setDepForm("new")}><CalendarPlus className="h-3.5 w-3.5" />Add departure</Button>}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : deps.length === 0 ? (
              <p className="text-xs text-muted-foreground">No scheduled departures. Add one for group trips, or book this package on a customer's own dates.</p>
            ) : (
              <div className="rounded-xl border border-border divide-y divide-border">
                {deps.map(d => (
                  <div key={d.id} className={cn("flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm", d.endDate < today && "opacity-60")}>
                    <div className="min-w-[150px]">
                      <p className="font-medium">{dayLabel(d.startDate)} → {dayLabel(d.endDate)}</p>
                      <p className="text-[11px] text-muted-foreground">{formatCurrency(d.adultPrice, currency)} / adult{d.hasPriceOverride ? " (special price)" : ""}</p>
                    </div>
                    <SeatsBar booked={d.seatsBooked} capacity={d.capacity} />
                    <Chip map={DEPARTURE_STATUS} value={d.status} />
                    <div className="ms-auto flex flex-wrap gap-1">
                      {canBook && d.status === "open" && d.seatsLeft > 0 && <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setBookOn(d)}><Users className="h-3.5 w-3.5" />Book</Button>}
                      {canEdit && <>
                        <select value={d.status} onChange={e => setStatus.mutate({ id: d.id, status: e.target.value as DepartureStatus })}
                          className="h-7 rounded-md border border-input bg-card text-xs px-1.5" aria-label="Departure status">
                          {Object.entries(DEPARTURE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setDepForm(d)} aria-label="Edit departure"><Pencil className="h-3.5 w-3.5" /></Button>
                      </>}
                      <Can permission="hospitality.tours.delete">{d.bookingCount === 0 && <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => delDep.mutate(d.id)} aria-label="Delete departure"><Trash2 className="h-3.5 w-3.5" /></Button>}</Can>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {pkg.description && <Section title="About the trip"><p className="text-sm whitespace-pre-line">{pkg.description}</p></Section>}

          <Section title="Itinerary">
            {pkg.days.length === 0 ? <p className="text-xs text-muted-foreground">No itinerary yet.</p> : (
              <ol className="space-y-2">
                {pkg.days.map(d => (
                  <li key={d.dayNumber} className="flex gap-3 rounded-xl border border-border bg-card p-3">
                    <span className="h-7 w-7 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{d.dayNumber}</span>
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">{d.title}</p>
                      {d.description && <p className="text-muted-foreground whitespace-pre-line">{d.description}</p>}
                      {(d.accommodation || d.meals) && <p className="text-[11px] text-muted-foreground mt-1">{[d.accommodation && `Stay: ${d.accommodation}`, d.meals && `Meals: ${d.meals}`].filter(Boolean).join(" · ")}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          {(pkg.inclusions || pkg.exclusions) && (
            <div className="grid sm:grid-cols-2 gap-3">
              {pkg.inclusions && <Section title="Included"><p className="text-sm whitespace-pre-line">{pkg.inclusions}</p></Section>}
              {pkg.exclusions && <Section title="Not included"><p className="text-sm whitespace-pre-line text-muted-foreground">{pkg.exclusions}</p></Section>}
            </div>
          )}
        </div>
      </Drawer>
      {depForm && <DepartureForm pkg={pkg} dep={depForm === "new" ? null : depForm} onClose={() => setDepForm(null)} />}
      {bookOn && <NewTourBookingDrawer prefill={{ departureId: bookOn.id, packageId: pkg.id }} onClose={() => setBookOn(null)} />}
      {custom && <NewTourBookingDrawer prefill={{ packageId: pkg.id }} onClose={() => setCustom(false)} />}
    </>
  );
}

function DepartureForm({ pkg, dep, onClose }: { pkg: TourPackageDto; dep: TourDepartureDto | null; onClose: () => void }) {
  const save = useSaveDeparture();
  const today = localToday();
  const [f, setF] = React.useState({
    startDate: dep?.startDate ?? addDays(today, 30),
    endDate: dep?.endDate ?? "",
    capacity: dep?.capacity ?? 20,
    adultPrice: dep?.hasPriceOverride ? String(dep.adultPrice) : "",
    childPrice: dep?.hasPriceOverride ? String(dep.childPrice) : "",
    notes: dep?.notes ?? "",
  });
  const autoEnd = addDays(f.startDate, pkg.durationDays - 1);
  const submit = () => save.mutate({ id: dep?.id, data: {
    packageId: pkg.id, startDate: f.startDate, endDate: f.endDate || null, capacity: f.capacity,
    adultPrice: f.adultPrice === "" ? null : Number(f.adultPrice), childPrice: f.childPrice === "" ? null : Number(f.childPrice), notes: f.notes || null,
  } }, { onSuccess: onClose });
  return (
    <Modal title={dep ? "Edit departure" : `New departure — ${pkg.name}`} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button disabled={!f.startDate || f.capacity < 1 || save.isPending} onClick={submit}>Save</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts"><input type="date" value={f.startDate} onChange={e => setF({ ...f, startDate: e.target.value })} className={inputCls} /></Field>
        <Field label="Ends" hint={`Blank = ${dayLabel(autoEnd)} (${pkg.durationDays} days)`}><input type="date" value={f.endDate} min={f.startDate} onChange={e => setF({ ...f, endDate: e.target.value })} className={inputCls} /></Field>
        <Field label="Seats"><input type="number" min={1} value={f.capacity} onChange={e => setF({ ...f, capacity: Math.max(1, Number(e.target.value)) })} className={inputCls} /></Field>
        <div />
        <Field label="Adult price" hint="Blank = package price"><input type="number" min={0} step="0.01" value={f.adultPrice} onChange={e => setF({ ...f, adultPrice: e.target.value })} className={inputCls} placeholder={String(pkg.pricePerAdult)} /></Field>
        <Field label="Child price" hint="Blank = package price"><input type="number" min={0} step="0.01" value={f.childPrice} onChange={e => setF({ ...f, childPrice: e.target.value })} className={inputCls} placeholder={String(pkg.pricePerChild)} /></Field>
      </div>
      <Field label="Notes (guide, meeting point…)"><textarea rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} className={textareaCls} /></Field>
      {dep && dep.bookingCount > 0 && <p className="text-[11px] text-muted-foreground">Bookings on this departure move to the new dates. Prices on existing bookings are not changed.</p>}
    </Modal>
  );
}

function PackageForm({ pkg, onClose, onSaved }: { pkg: TourPackageDto | null; onClose: () => void; onSaved: (p: TourPackageDto) => void }) {
  const save = useSavePackage();
  const [f, setF] = React.useState({
    code: pkg?.code ?? "", name: pkg?.name ?? "", destination: pkg?.destination ?? "", category: pkg?.category ?? "",
    durationDays: pkg?.durationDays ?? 5, description: pkg?.description ?? "", inclusions: pkg?.inclusions ?? "", exclusions: pkg?.exclusions ?? "",
    pricePerAdult: pkg?.pricePerAdult ?? 0, pricePerChild: pkg?.pricePerChild ?? 0, singleSupplement: pkg?.singleSupplement ?? 0, isActive: pkg?.isActive ?? true,
  });
  const [days, setDays] = React.useState<ItineraryDayInput[]>(pkg?.days.map(d => ({ ...d })) ?? []);
  const up = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(s => ({ ...s, [k]: v }));
  const setDay = (i: number, patch: Partial<ItineraryDayInput>) => setDays(ds => ds.map((d, j) => j === i ? { ...d, ...patch } : d));
  const move = (i: number, by: number) => setDays(ds => { const n = [...ds]; const [x] = n.splice(i, 1); n.splice(i + by, 0, x); return n; });
  const fillDays = () => setDays(ds => [...ds, ...Array.from({ length: Math.max(0, f.durationDays - ds.length) }, (_, i) => ({ title: `Day ${ds.length + i + 1}` }))]);
  const valid = f.code.trim() && f.name.trim() && f.durationDays >= 1 && days.every(d => d.title.trim());

  const submit = () => save.mutate({ id: pkg?.id, data: {
    ...f, destination: f.destination || null, category: f.category || null, description: f.description || null,
    inclusions: f.inclusions || null, exclusions: f.exclusions || null,
    days: days.map(d => ({ title: d.title, description: d.description || null, accommodation: d.accommodation || null, meals: d.meals || null })),
  } }, { onSuccess: r => onSaved(r as TourPackageDto) });

  return (
    <Drawer title={pkg ? `Edit ${pkg.name}` : "New tour package"} onClose={onClose} width="max-w-3xl"
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button disabled={!valid || save.isPending} onClick={submit}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin me-1" />}Save package</Button></>}>
      <div className="space-y-5">
        <Section title="Trip">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Code"><input value={f.code} onChange={e => up("code", e.target.value.toUpperCase())} maxLength={20} className={inputCls} placeholder="TUR7" /></Field>
            <Field label="Name" className="col-span-1 sm:col-span-3"><input autoFocus value={f.name} onChange={e => up("name", e.target.value)} className={inputCls} placeholder="Turkey Highlights — 7 days" /></Field>
            <Field label="Destination" className="col-span-2"><input value={f.destination} onChange={e => up("destination", e.target.value)} className={inputCls} placeholder="Istanbul, Cappadocia" /></Field>
            <Field label="Type"><input list="tour-cats" value={f.category} onChange={e => up("category", e.target.value)} className={inputCls} placeholder="Tour" />
              <datalist id="tour-cats">{PACKAGE_CATEGORIES.map(c => <option key={c} value={c} />)}</datalist></Field>
            <Field label="Days"><input type="number" min={1} max={365} value={f.durationDays} onChange={e => up("durationDays", Math.max(1, Number(e.target.value)))} className={inputCls} /></Field>
          </div>
          <Field label="Description"><textarea rows={3} value={f.description} onChange={e => up("description", e.target.value)} className={textareaCls} /></Field>
        </Section>

        <Section title="Price per person">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Adult"><input type="number" min={0} step="0.01" value={f.pricePerAdult} onChange={e => up("pricePerAdult", Number(e.target.value))} className={inputCls} /></Field>
            <Field label="Child"><input type="number" min={0} step="0.01" value={f.pricePerChild} onChange={e => up("pricePerChild", Number(e.target.value))} className={inputCls} /></Field>
            <Field label="Single room supplement"><input type="number" min={0} step="0.01" value={f.singleSupplement} onChange={e => up("singleSupplement", Number(e.target.value))} className={inputCls} /></Field>
          </div>
        </Section>

        <Section title={`Itinerary (${days.length} day${days.length === 1 ? "" : "s"})`} action={
          <div className="flex gap-1">
            {days.length < f.durationDays && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={fillDays}>Add {f.durationDays - days.length} empty days</Button>}
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setDays(ds => [...ds, { title: "" }])}><Plus className="h-3.5 w-3.5" />Day</Button>
          </div>}>
          {days.length === 0 ? <p className="text-xs text-muted-foreground">Add the plan for each day — it goes on the document the customer receives.</p> : (
            <div className="space-y-2">
              {days.map((d, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="h-7 w-7 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <input value={d.title} onChange={e => setDay(i, { title: e.target.value })} className={inputCls} placeholder="Arrive in Istanbul, transfer to hotel" aria-label={`Day ${i + 1} title`} />
                    <div className="flex shrink-0">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" disabled={i === days.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => setDays(ds => ds.filter((_, j) => j !== i))} aria-label="Remove day"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <textarea rows={2} value={d.description ?? ""} onChange={e => setDay(i, { description: e.target.value })} className={textareaCls} placeholder="What happens today" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={d.accommodation ?? ""} onChange={e => setDay(i, { accommodation: e.target.value })} className={inputCls} placeholder="Overnight at…" />
                    <input value={d.meals ?? ""} onChange={e => setDay(i, { meals: e.target.value })} className={inputCls} placeholder="Meals (B, L, D)" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Included (one per line)"><textarea rows={5} value={f.inclusions} onChange={e => up("inclusions", e.target.value)} className={textareaCls} placeholder={"6 nights hotel\nDaily breakfast\nAirport transfers"} /></Field>
          <Field label="Not included (one per line)"><textarea rows={5} value={f.exclusions} onChange={e => up("exclusions", e.target.value)} className={textareaCls} placeholder={"International flights\nVisa fees"} /></Field>
        </div>
        {pkg && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isActive} onChange={e => up("isActive", e.target.checked)} />On sale</label>}
        <select className={cn(selectCls, "hidden")} aria-hidden />
      </div>
    </Drawer>
  );
}
