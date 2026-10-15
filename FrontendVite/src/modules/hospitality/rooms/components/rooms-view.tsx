import * as React from "react";
import { BedDouble, Layers, Wrench, Plus, Pencil, Trash2, SprayCan, CheckCircle2, Power, Users, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can, useCan } from "@/components/auth/can";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { localToday, type RoomDto, type RoomTypeDto } from "@/lib/hospitality/hospitality.api";
import {
  useRooms, useRoomsSummary, useRoomTypes, useRoomBlocks, useCreateRoom, useUpdateRoom, useDeleteRoom,
  useSetMaintenance, useSetHousekeeping, useCreateRoomType, useUpdateRoomType, useDeleteRoomType,
  useCreateBlock, useDeleteBlock,
} from "@/hooks/hospitality/use-hospitality";
import { Stat, Modal, Field, Empty, inputCls, selectCls, textareaCls, roomStatus, dayLabel, addDays } from "../../shared/hotel-ui";

type Tab = "rooms" | "types" | "blocks";

export function RoomsView() {
  const [tab, setTab] = React.useState<Tab>("rooms");
  const { data: summary } = useRoomsSummary();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Rooms</h1>
        <p className="text-sm text-muted-foreground">Room types, the rooms themselves, and nights a room is out of order.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Rooms" value={summary?.total ?? 0} icon={BedDouble} />
        <Stat label="Occupied now" value={summary?.occupied ?? 0} hint={`${summary?.occupancyRate ?? 0}% of rooms`} icon={Percent} tone="text-success bg-success/10" />
        <Stat label="To clean" value={summary?.dirtyRooms ?? 0} icon={SprayCan} tone="text-warning bg-warning/10" />
        <Stat label="Out of service" value={summary?.maintenance ?? 0} icon={Wrench} tone="text-destructive bg-destructive/10" />
      </div>
      <div className="flex gap-1 p-1 rounded-lg bg-muted/50 w-fit">
        {([["rooms", "Rooms", BedDouble], ["types", "Room types", Layers], ["blocks", "Out of order", Wrench]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium",
            tab === id ? "bg-card shadow-sm" : "text-muted-foreground")}><Icon className="h-4 w-4" />{label}</button>
        ))}
      </div>
      {tab === "rooms" ? <RoomsTab /> : tab === "types" ? <TypesTab /> : <BlocksTab />}
    </div>
  );
}

// ─── Rooms ────────────────────────────────────────────────────────────────────

function RoomsTab() {
  const currency = useCurrency();
  const { data: rooms = [], isLoading } = useRooms();
  const { data: types = [] } = useRoomTypes(true);
  const [editing, setEditing] = React.useState<RoomDto | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<RoomDto | null>(null);
  const del = useDeleteRoom();
  const maint = useSetMaintenance();
  const hk = useSetHousekeeping();
  const canEdit = useCan("hospitality.rooms.edit");
  const canHk = useCan("hospitality.housekeeping.edit") || canEdit;
  const typeRate = (id: string | null) => types.find(t => t.id === id)?.baseRate ?? 0;

  const floors = React.useMemo(() => [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b), [rooms]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Can permission="hospitality.rooms.create">
          <Button className="gap-2 h-9" disabled={types.length === 0} title={types.length === 0 ? "Add a room type first" : undefined} onClick={() => setEditing("new")}><Plus className="h-4 w-4" />Add room</Button>
        </Can>
      </div>
      {isLoading ? <div className="h-40 rounded-xl bg-muted/40 animate-pulse" /> : rooms.length === 0 ? (
        <Empty icon={BedDouble} title="No rooms yet" hint={types.length === 0 ? "Start with a room type (e.g. Standard King), then add the rooms of that type." : "Add the rooms you sell."} />
      ) : floors.map(floor => (
        <div key={floor} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Floor {floor}</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {rooms.filter(r => r.floor === floor).map(r => {
              const st = roomStatus(r.status);
              return (
                <div key={r.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-lg font-bold leading-tight">{r.roomNumber}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.roomType} · sleeps {r.capacity}{r.view ? ` · ${r.view}` : ""}</p>
                    </div>
                    <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap", st.chip)}>{st.label}</span>
                  </div>
                  {r.currentGuestName && <p className="text-xs flex items-center gap-1"><Users className="h-3.5 w-3.5 text-muted-foreground" />{r.currentGuestName}</p>}
                  <div className="flex items-center justify-between text-xs">
                    <span className={cn("font-medium", r.housekeepingStatus === "dirty" ? "text-warning" : "text-success")}>
                      {r.housekeepingStatus === "dirty" ? "Needs cleaning" : r.housekeepingStatus === "inspected" ? "Inspected" : "Clean"}
                    </span>
                    <span className="text-muted-foreground">{formatCurrency(r.ratePerNight > 0 ? r.ratePerNight : typeRate(r.roomTypeId), currency)}/night{r.ratePerNight > 0 ? "" : " (type)"}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1 border-t border-border">
                    {canHk && r.housekeepingStatus === "dirty" && (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => hk.mutate({ id: r.id, status: "clean" })}><CheckCircle2 className="h-3.5 w-3.5" />Clean</Button>
                    )}
                    {canHk && r.housekeepingStatus === "clean" && (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => hk.mutate({ id: r.id, status: "inspected" })}><CheckCircle2 className="h-3.5 w-3.5" />Inspected</Button>
                    )}
                    {canEdit && (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" disabled={!!r.currentBookingId && r.status !== "maintenance"}
                        onClick={() => maint.mutate({ id: r.id, on: r.status !== "maintenance" })}>
                        <Power className="h-3.5 w-3.5" />{r.status === "maintenance" ? "Back in service" : "Out of service"}
                      </Button>
                    )}
                    <span className="ms-auto flex">
                      {canEdit && <button onClick={() => setEditing(r)} className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted" aria-label="Edit room"><Pencil className="h-3.5 w-3.5" /></button>}
                      <Can permission="hospitality.rooms.delete"><button onClick={() => setDeleting(r)} className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10" aria-label="Delete room"><Trash2 className="h-3.5 w-3.5" /></button></Can>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {editing && <RoomDialog room={editing === "new" ? null : editing} types={types} onClose={() => setEditing(null)} />}
      {deleting && (
        <Modal title={`Delete room ${deleting.roomNumber}?`} onClose={() => setDeleting(null)}
          footer={<><Button variant="ghost" onClick={() => setDeleting(null)}>Keep</Button>
            <Button variant="destructive" disabled={del.isPending} onClick={() => del.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}>Delete</Button></>}>
          <p className="text-sm">Past stays in this room keep their records. A room with upcoming bookings cannot be deleted until they are moved.</p>
        </Modal>
      )}
    </div>
  );
}

function RoomDialog({ room, types, onClose }: { room: RoomDto | null; types: RoomTypeDto[]; onClose: () => void }) {
  const create = useCreateRoom();
  const update = useUpdateRoom();
  const [f, setF] = React.useState({
    roomNumber: room?.roomNumber ?? "", roomTypeId: room?.roomTypeId ?? types.find(t => t.isActive)?.id ?? "",
    floor: room?.floor ?? 1, capacity: room?.capacity ?? 0, ratePerNight: room?.ratePerNight ?? 0,
    view: room?.view ?? "", hasBalcony: room?.hasBalcony ?? false, notes: room?.notes ?? "",
  });
  const type = types.find(t => t.id === f.roomTypeId);
  const pending = create.isPending || update.isPending;
  const submit = () => {
    const data = { ...f, view: f.view || null, notes: f.notes || null };
    room ? update.mutate({ id: room.id, data }, { onSuccess: onClose }) : create.mutate(data, { onSuccess: onClose });
  };
  return (
    <Modal title={room ? `Room ${room.roomNumber}` : "Add room"} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button disabled={!f.roomNumber.trim() || !f.roomTypeId || pending} onClick={submit}>Save</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Room number"><input autoFocus value={f.roomNumber} onChange={e => setF({ ...f, roomNumber: e.target.value })} className={inputCls} /></Field>
        <Field label="Floor"><input type="number" value={f.floor} onChange={e => setF({ ...f, floor: Number(e.target.value) })} className={inputCls} /></Field>
      </div>
      <Field label="Room type"><select value={f.roomTypeId} onChange={e => setF({ ...f, roomTypeId: e.target.value })} className={selectCls}>
        {types.map(t => <option key={t.id} value={t.id}>{t.name}{t.isActive ? "" : " (off)"}</option>)}</select></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sleeps" hint={`0 = the type's ${type ? type.maxAdults + type.maxChildren : ""}`}><input type="number" min={0} value={f.capacity} onChange={e => setF({ ...f, capacity: Number(e.target.value) })} className={inputCls} /></Field>
        <Field label="Own nightly rate" hint="0 = the type's rate"><input type="number" min={0} step="0.01" value={f.ratePerNight} onChange={e => setF({ ...f, ratePerNight: Number(e.target.value) })} className={inputCls} /></Field>
        <Field label="View"><input value={f.view} onChange={e => setF({ ...f, view: e.target.value })} className={inputCls} placeholder="Sea, city, garden…" /></Field>
        <label className="flex items-center gap-2 text-sm pt-5"><input type="checkbox" checked={f.hasBalcony} onChange={e => setF({ ...f, hasBalcony: e.target.checked })} />Balcony</label>
      </div>
      <Field label="Notes"><textarea rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} className={textareaCls} /></Field>
    </Modal>
  );
}

// ─── Room types ───────────────────────────────────────────────────────────────

function TypesTab() {
  const currency = useCurrency();
  const { data: types = [], isLoading } = useRoomTypes(true);
  const [editing, setEditing] = React.useState<RoomTypeDto | "new" | null>(null);
  const del = useDeleteRoomType();
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Can permission="hospitality.rooms.create"><Button className="gap-2 h-9" onClick={() => setEditing("new")}><Plus className="h-4 w-4" />Add room type</Button></Can></div>
      {isLoading ? <div className="h-40 rounded-xl bg-muted/40 animate-pulse" /> : types.length === 0 ? (
        <Empty icon={Layers} title="No room types yet" hint="A room type is what you sell — Standard King, Deluxe Twin, Suite. Rates and availability are by type." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {types.map(t => (
            <div key={t.id} className={cn("rounded-xl border border-border bg-card p-4 space-y-2", !t.isActive && "opacity-60")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><p className="font-semibold truncate">{t.name}</p><p className="text-xs text-muted-foreground">{t.code}{t.isActive ? "" : " · switched off"}</p></div>
                <p className="font-bold tabular-nums">{formatCurrency(t.baseRate, currency)}<span className="text-xs font-normal text-muted-foreground">/night</span></p>
              </div>
              <p className="text-xs text-muted-foreground">Up to {t.maxAdults} adults{t.maxChildren ? ` + ${t.maxChildren} children` : ""} · {t.roomCount} room{t.roomCount === 1 ? "" : "s"}</p>
              {t.amenities && <p className="text-xs">{t.amenities}</p>}
              {t.description && <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
              <div className="flex justify-end gap-1 pt-1 border-t border-border">
                <Can permission="hospitality.rooms.edit"><Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setEditing(t)}><Pencil className="h-3.5 w-3.5" />Edit</Button></Can>
                <Can permission="hospitality.rooms.delete"><Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-destructive" disabled={t.roomCount > 0 || del.isPending}
                  title={t.roomCount > 0 ? "Move or delete its rooms first" : undefined} onClick={() => del.mutate(t.id)}><Trash2 className="h-3.5 w-3.5" />Delete</Button></Can>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && <TypeDialog type={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TypeDialog({ type, onClose }: { type: RoomTypeDto | null; onClose: () => void }) {
  const create = useCreateRoomType();
  const update = useUpdateRoomType();
  const [f, setF] = React.useState({
    code: type?.code ?? "", name: type?.name ?? "", baseRate: type?.baseRate ?? 0, maxAdults: type?.maxAdults ?? 2,
    maxChildren: type?.maxChildren ?? 1, description: type?.description ?? "", amenities: type?.amenities ?? "", isActive: type?.isActive ?? true,
  });
  const submit = () => {
    const data = { ...f, description: f.description || null, amenities: f.amenities || null };
    type ? update.mutate({ id: type.id, data }, { onSuccess: onClose }) : create.mutate(data, { onSuccess: onClose });
  };
  return (
    <Modal title={type ? type.name : "Add room type"} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button disabled={!f.code.trim() || !f.name.trim() || f.maxAdults < 1 || create.isPending || update.isPending} onClick={submit}>Save</Button></>}>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Code"><input value={f.code} onChange={e => setF({ ...f, code: e.target.value.toUpperCase() })} className={inputCls} placeholder="STDK" maxLength={20} /></Field>
        <Field label="Name" className="col-span-2"><input autoFocus value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={inputCls} placeholder="Standard King" /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Base rate / night"><input type="number" min={0} step="0.01" value={f.baseRate} onChange={e => setF({ ...f, baseRate: Number(e.target.value) })} className={inputCls} /></Field>
        <Field label="Max adults"><input type="number" min={1} value={f.maxAdults} onChange={e => setF({ ...f, maxAdults: Number(e.target.value) })} className={inputCls} /></Field>
        <Field label="Max children"><input type="number" min={0} value={f.maxChildren} onChange={e => setF({ ...f, maxChildren: Number(e.target.value) })} className={inputCls} /></Field>
      </div>
      <p className="text-[11px] text-muted-foreground">The base rate applies on nights no season of the rate plan covers.</p>
      <Field label="Amenities"><input value={f.amenities} onChange={e => setF({ ...f, amenities: e.target.value })} className={inputCls} placeholder="Wi-Fi, Sea view, Bathtub" /></Field>
      <Field label="Description"><textarea rows={2} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} className={textareaCls} /></Field>
      {type && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isActive} onChange={e => setF({ ...f, isActive: e.target.checked })} />On sale</label>}
    </Modal>
  );
}

// ─── Out of order ─────────────────────────────────────────────────────────────

function BlocksTab() {
  const { data: blocks = [], isLoading } = useRoomBlocks();
  const { data: rooms = [] } = useRooms();
  const create = useCreateBlock();
  const del = useDeleteBlock();
  const today = localToday();
  const [f, setF] = React.useState({ roomId: "", fromDate: today, toDate: addDays(today, 1), reason: "" });
  const valid = f.roomId && f.reason.trim() && f.toDate > f.fromDate;
  return (
    <div className="space-y-4">
      <Can permission="hospitality.rooms.edit">
        <div className="rounded-xl border border-border bg-card p-4 grid sm:grid-cols-5 gap-3 items-end">
          <Field label="Room"><select value={f.roomId} onChange={e => setF({ ...f, roomId: e.target.value })} className={selectCls}>
            <option value="">Pick a room</option>{rooms.map(r => <option key={r.id} value={r.id}>{r.roomNumber} · {r.roomType}</option>)}</select></Field>
          <Field label="From night"><input type="date" value={f.fromDate} onChange={e => setF({ ...f, fromDate: e.target.value })} className={inputCls} /></Field>
          <Field label="Back in service"><input type="date" value={f.toDate} min={addDays(f.fromDate, 1)} onChange={e => setF({ ...f, toDate: e.target.value })} className={inputCls} /></Field>
          <Field label="Reason"><input value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} className={inputCls} placeholder="Repainting" /></Field>
          <Button disabled={!valid || create.isPending} onClick={() => create.mutate(f, { onSuccess: () => setF({ ...f, reason: "" }) })}>Take out of order</Button>
        </div>
      </Can>
      {isLoading ? <div className="h-24 rounded-xl bg-muted/40 animate-pulse" /> : blocks.length === 0 ? (
        <Empty icon={Wrench} title="No rooms are out of order" hint="Take a room out for a run of nights here; it disappears from availability on those nights only." />
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {blocks.map(b => (
            <div key={b.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="font-semibold w-16">{b.roomNumber}</span>
              <span className="text-muted-foreground">{dayLabel(b.fromDate)} → {dayLabel(b.toDate)}</span>
              <span className="flex-1 truncate">{b.reason}</span>
              <Can permission="hospitality.rooms.edit"><Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => del.mutate(b.id)}>Back in service</Button></Can>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
