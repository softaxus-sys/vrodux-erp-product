import * as React from "react";
import { Contact, Search, Plus, Star, Pencil, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/auth/can";
import { Pager } from "@/components/ui/pager";
import { formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { localToday, type GuestDto, type GuestRequest } from "@/lib/hospitality/hospitality.api";
import { useGuests, useGuest, useCreateGuest, useUpdateGuest, useDeleteGuest } from "@/hooks/hospitality/use-hospitality";
import { Drawer, Modal, Field, Section, Empty, StatusChip, inputCls, selectCls, textareaCls, dayLabel, addDays } from "../../shared/hotel-ui";
import { BookingDrawer } from "../../bookings/components/booking-drawer";

const PAGE_SIZE = 30;

export function GuestsView() {
  const currency = useCurrency();
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<GuestDto | "new" | null>(null);
  React.useEffect(() => { const h = setTimeout(() => { setDebounced(search); setPage(1); }, 300); return () => clearTimeout(h); }, [search]);
  const { data, isLoading, isFetching } = useGuests({ search: debounced, page, pageSize: PAGE_SIZE });
  const rows = data?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Guests</h1>
          <p className="text-sm text-muted-foreground">Profiles kept across stays. A booking finds the returning guest by email or phone.</p>
        </div>
        <Can permission="hospitality.guests.create"><Button className="gap-2 h-9" onClick={() => setEditing("new")}><Plus className="h-4 w-4" />Add guest</Button></Can>
      </div>
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, email, phone, passport or company" className={`${inputCls} ps-9`} />
      </div>
      {isLoading ? <div className="h-40 rounded-xl bg-muted/40 animate-pulse" /> : rows.length === 0 ? (
        <Empty icon={Contact} title={debounced ? "No guest matches" : "No guests yet"} hint={debounced ? undefined : "Guests are added automatically when a booking is taken."} />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr><th className="text-start font-medium px-4 py-2.5">Guest</th><th className="text-start font-medium px-4 py-2.5">Contact</th>
                <th className="text-start font-medium px-4 py-2.5">Nationality</th><th className="text-end font-medium px-4 py-2.5">Stays</th>
                <th className="text-end font-medium px-4 py-2.5">Spent</th><th className="text-start font-medium px-4 py-2.5">Last stay</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(g => (
                <tr key={g.id} onClick={() => setOpenId(g.id)} className="cursor-pointer hover:bg-muted/40">
                  <td className="px-4 py-2.5"><p className="font-medium flex items-center gap-1.5">{g.isVip && <Star className="h-3.5 w-3.5 text-warning fill-warning" />}{g.fullName}</p>{g.company && <p className="text-xs text-muted-foreground">{g.company}</p>}</td>
                  <td className="px-4 py-2.5"><p>{g.phone ?? "—"}</p><p className="text-xs text-muted-foreground">{g.email ?? ""}</p></td>
                  <td className="px-4 py-2.5">{g.nationality ?? "—"}</td>
                  <td className="px-4 py-2.5 text-end">{g.stayCount}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums">{formatCurrency(g.totalSpent, currency)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{g.lastStayOn ? dayLabel(g.lastStayOn, { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.totalPages > 1 && <Pager page={page} totalPages={data.totalPages} totalCount={data.totalCount} pageSize={PAGE_SIZE} busy={isFetching} onPage={setPage} />}
        </div>
      )}
      {openId && <GuestDrawer id={openId} onClose={() => setOpenId(null)} onEdit={g => setEditing(g)} />}
      {editing && <GuestDialog guest={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function GuestDrawer({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (g: GuestDto) => void }) {
  const currency = useCurrency();
  const { data, isLoading } = useGuest(id);
  const del = useDeleteGuest();
  const [booking, setBooking] = React.useState<string | null>(null);
  const g = data?.guest;
  const docSoon = g?.documentExpiry && g.documentExpiry <= addDays(localToday(), 180);

  return (
    <>
      <Drawer title={g ? <span className="flex items-center gap-2">{g.isVip && <Star className="h-4 w-4 text-warning fill-warning" />}{g.fullName}</span> : "Guest"}
        subtitle={g ? `${g.stayCount} stay${g.stayCount === 1 ? "" : "s"} · ${formatCurrency(g.totalSpent, currency)} spent` : undefined} onClose={onClose}
        footer={g && <>
          <Can permission="hospitality.guests.delete"><Button variant="ghost" size="sm" className="gap-1.5 text-destructive" disabled={del.isPending} onClick={() => del.mutate(g.id, { onSuccess: onClose })}><Trash2 className="h-3.5 w-3.5" />Delete</Button></Can>
          <Can permission="hospitality.guests.edit"><Button size="sm" className="gap-1.5" onClick={() => onEdit(g)}><Pencil className="h-3.5 w-3.5" />Edit</Button></Can>
        </>}>
        {isLoading || !g ? <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /> : (
          <div className="space-y-5">
            <Section title="Details">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm rounded-xl border border-border bg-card p-3">
                {([["Email", g.email], ["Phone", g.phone], ["Nationality", g.nationality], ["Date of birth", g.dateOfBirth],
                  ["Document", g.documentNumber ? `${(g.documentType ?? "").replace(/_/g, " ")} ${g.documentNumber}` : null],
                  ["Expires", g.documentExpiry], ["Company", g.company], ["Address", g.address]] as const).map(([k, v]) => (
                  <div key={k}><dt className="text-[11px] text-muted-foreground">{k}</dt><dd className="break-words">{v || "—"}</dd></div>
                ))}
              </dl>
              {docSoon && <p className="text-xs text-warning flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />The guest's document expires on {g.documentExpiry}.</p>}
              {g.notes && <p className="text-sm rounded-lg bg-muted/50 px-3 py-2">{g.notes}</p>}
            </Section>
            <Section title="Stays">
              {data!.bookings.length === 0 ? <p className="text-xs text-muted-foreground">No stays yet.</p> : (
                <div className="rounded-xl border border-border divide-y divide-border">
                  {data!.bookings.map(b => (
                    <button key={b.id} onClick={() => setBooking(b.id)} className="w-full text-start flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40">
                      <span className="w-12 font-semibold">{b.roomNumber}</span>
                      <span className="flex-1 text-muted-foreground">{dayLabel(b.checkIn)} → {dayLabel(b.checkOut)}</span>
                      <StatusChip status={b.status} />
                      <span className="tabular-nums w-24 text-end">{formatCurrency(b.totalAmount, currency)}</span>
                    </button>
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}
      </Drawer>
      {booking && <BookingDrawer bookingId={booking} onClose={() => setBooking(null)} />}
    </>
  );
}

const DOC_TYPES = [{ value: "passport", label: "Passport" }, { value: "national_id", label: "National ID" }, { value: "driving_licence", label: "Driving licence" }, { value: "other", label: "Other" }];

function GuestDialog({ guest, onClose }: { guest: GuestDto | null; onClose: () => void }) {
  const create = useCreateGuest();
  const update = useUpdateGuest();
  const [f, setF] = React.useState<GuestRequest>({
    fullName: guest?.fullName ?? "", email: guest?.email ?? "", phone: guest?.phone ?? "", nationality: guest?.nationality ?? "",
    documentType: guest?.documentType ?? "passport", documentNumber: guest?.documentNumber ?? "", documentExpiry: guest?.documentExpiry ?? "",
    dateOfBirth: guest?.dateOfBirth ?? "", address: guest?.address ?? "", company: guest?.company ?? "", isVip: guest?.isVip ?? false, notes: guest?.notes ?? "",
  });
  const up = (k: keyof GuestRequest, v: string | boolean) => setF(s => ({ ...s, [k]: v }));
  const clean = (): GuestRequest => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === "" ? null : v])) as GuestRequest;
  const submit = () => guest ? update.mutate({ id: guest.id, data: clean() }, { onSuccess: onClose }) : create.mutate(clean(), { onSuccess: onClose });
  return (
    <Modal title={guest ? guest.fullName : "Add guest"} onClose={onClose} width="max-w-lg"
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button disabled={!f.fullName.trim() || create.isPending || update.isPending} onClick={submit}>Save</Button></>}>
      <Field label="Full name"><input autoFocus value={f.fullName} onChange={e => up("fullName", e.target.value)} className={inputCls} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email"><input type="email" value={f.email ?? ""} onChange={e => up("email", e.target.value)} className={inputCls} /></Field>
        <Field label="Phone"><input value={f.phone ?? ""} onChange={e => up("phone", e.target.value)} className={inputCls} /></Field>
        <Field label="Nationality"><input value={f.nationality ?? ""} onChange={e => up("nationality", e.target.value)} className={inputCls} /></Field>
        <Field label="Date of birth"><input type="date" value={f.dateOfBirth ?? ""} onChange={e => up("dateOfBirth", e.target.value)} className={inputCls} /></Field>
        <Field label="Document"><select value={f.documentType ?? ""} onChange={e => up("documentType", e.target.value)} className={selectCls}>{DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}</select></Field>
        <Field label="Document number"><input value={f.documentNumber ?? ""} onChange={e => up("documentNumber", e.target.value)} className={inputCls} /></Field>
        <Field label="Document expiry"><input type="date" value={f.documentExpiry ?? ""} onChange={e => up("documentExpiry", e.target.value)} className={inputCls} /></Field>
        <Field label="Company"><input value={f.company ?? ""} onChange={e => up("company", e.target.value)} className={inputCls} /></Field>
      </div>
      <Field label="Address"><input value={f.address ?? ""} onChange={e => up("address", e.target.value)} className={inputCls} /></Field>
      <Field label="Notes (preferences, allergies…)"><textarea rows={2} value={f.notes ?? ""} onChange={e => up("notes", e.target.value)} className={textareaCls} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isVip} onChange={e => up("isVip", e.target.checked)} />VIP guest</label>
    </Modal>
  );
}
