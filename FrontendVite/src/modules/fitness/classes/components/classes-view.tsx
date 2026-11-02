import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, Dumbbell, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/auth/can";
import { cn, formatDate } from "@/lib/utils";
import { addDays, fitnessApi, localToday, type ClassTypeDto, type SessionDto } from "@/lib/fitness/fitness.api";
import { useAct, useBookings, useBranches, useClassTypes, useMembers, useSessions, useTrainers, useWorkingBranch } from "@/hooks/fitness/use-fitness";
import { ConfirmDialog, FormModal, Modal, PageHeader, Pill, SELECT, Tabs, TableState, TH, num, orUndef, useDebounced } from "../../shared/ui";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekStart = (d: string) => addDays(d, -new Date(`${d}T00:00:00`).getDay());

function TypeForm({ type, onClose }: { type?: ClassTypeDto; onClose: () => void }) {
  const save = useAct((b: Record<string, unknown>) => fitnessApi.saveClassType(type?.id ?? null, b), "Class saved.", ["class-types", "sessions"]);
  return (
    <FormModal title={type ? `Edit ${type.name}` : "New class"} pending={save.isPending} onClose={onClose} onSubmit={v => save.mutate({
      name: String(v.name).trim(), description: orUndef(v.description), level: orUndef(v.level), durationMinutes: num(v.durationMinutes),
      capacity: num(v.capacity), color: orUndef(v.color), creditCost: num(v.creditCost), dropInPrice: num(v.dropInPrice), isActive: !!v.isActive,
    }, { onSuccess: onClose })}
      initial={{ name: type?.name ?? "", description: type?.description ?? "", level: type?.level ?? "", durationMinutes: String(type?.durationMinutes ?? 60), capacity: String(type?.capacity ?? 20),
        color: type?.color ?? "#6366f1", creditCost: String(type?.creditCost ?? 1), dropInPrice: String(type?.dropInPrice ?? 0), isActive: type?.isActive ?? true }}
      fields={[
        { key: "name", label: "Name", required: true, span: 2 }, { key: "level", label: "Level", type: "select", options: ["All levels", "Beginner", "Intermediate", "Advanced"].map(x => ({ value: x, label: x })) },
        { key: "color", label: "Colour", type: "text", placeholder: "#6366f1" },
        { key: "durationMinutes", label: "Minutes", type: "number", required: true }, { key: "capacity", label: "Capacity", type: "number", required: true },
        { key: "creditCost", label: "Class credits used", type: "number" }, { key: "dropInPrice", label: "Drop-in price", type: "number" },
        { key: "description", label: "Description", type: "textarea" }, { key: "isActive", label: "Open for scheduling", type: "checkbox" },
      ]} />
  );
}

function ScheduleForm({ branchId, date, onClose }: { branchId: string; date: string; onClose: () => void }) {
  const { data: types = [] } = useClassTypes(true);
  const { data: trainers = [] } = useTrainers(true);
  const { data: branches = [] } = useBranches(true);
  const save = useAct((b: Record<string, unknown>) => fitnessApi.schedule(b), "Class scheduled.", ["sessions"]);
  return (
    <FormModal title="Schedule a class" size="lg" pending={save.isPending} onClose={onClose}
      initial={{ classTypeId: types[0]?.id ?? "", branchId, trainerId: "", date, startTime: "18:00", repeatWeeks: "0", room: "", capacity: "", ...Object.fromEntries(DAYS.map((_, i) => [`wd${i}`, false])) }}
      fields={[
        { key: "classTypeId", label: "Class", type: "select", required: true, options: types.map(t => ({ value: t.id, label: t.name })) },
        { key: "branchId", label: "Branch", type: "select", required: true, options: branches.map(b => ({ value: b.id, label: b.name })) },
        { key: "trainerId", label: "Trainer", type: "select", options: trainers.map(t => ({ value: t.id, label: t.name })) }, { key: "room", label: "Room / studio" },
        { key: "date", label: "First date", type: "date", required: true }, { key: "startTime", label: "Start time", type: "time", required: true },
        { key: "capacity", label: "Capacity", type: "number", hint: "Blank uses the class default." }, { key: "repeatWeeks", label: "Repeat for extra weeks", type: "number", hint: "0 = just this day." },
        ...DAYS.map((d, i): import("../../shared/ui").FormField => ({ key: `wd${i}`, label: d, type: "checkbox", ...(i === 0 ? { hint: "tick the days to repeat on" } : {}) })),
      ]}
      onSubmit={v => save.mutate({
        classTypeId: v.classTypeId, branchId: v.branchId, trainerId: orUndef(v.trainerId), date: v.date, startTime: v.startTime, room: orUndef(v.room),
        capacity: orUndef(v.capacity) ? num(v.capacity) : undefined, repeatWeeks: num(v.repeatWeeks),
        weekdays: DAYS.map((_, i) => i).filter(i => !!v[`wd${i}`]),
      }, { onSuccess: onClose })} />
  );
}

function BookingsModal({ session, onClose }: { session: SessionDto; onClose: () => void }) {
  const { data = [], isLoading } = useBookings({ sessionId: session.id });
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search);
  const { data: found } = useMembers({ search: q, state: "active", pageSize: 5 }, );
  const book = useAct((memberId: string) => fitnessApi.book(session.id, memberId, true), "Booked.");
  const cancel = useAct((id: string) => fitnessApi.cancelBooking(id), "Booking cancelled.");
  const mark = useAct((a: { id: string; s: "attended" | "no_show" }) => fitnessApi.markAttendance(a.id, a.s));
  return (
    <Modal side size="md" onClose={onClose} title={session.className} subtitle={`${formatDate(session.date)} · ${session.startTime}–${session.endTime} · ${session.booked}/${session.capacity} booked`}>
      <Can permission="fitness.classes.create">
        <div className="space-y-1.5">
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Add a member — search name or number…" className="h-9" />
          {q && (found?.items ?? []).map(m => <button key={m.id} className="block w-full text-start rounded-md px-3 py-1.5 text-sm hover:bg-muted" onClick={() => book.mutate(m.id, { onSuccess: () => setSearch("") })}>{m.fullName} <span className="text-xs text-muted-foreground">{m.memberNumber} · {m.planName ?? "no plan"}</span></button>)}
        </div>
      </Can>
      <TableState loading={isLoading} empty={data.length === 0} emptyText="Nobody booked yet." icon={CalendarDays} />
      <div className="divide-y divide-border">{data.map(b => (
        <div key={b.id} className="flex items-center justify-between py-2 text-sm gap-2">
          <div className="min-w-0"><p className="font-medium truncate">{b.memberName}{b.waitlistPosition ? ` (#${b.waitlistPosition})` : ""}</p><p className="text-xs text-muted-foreground">{b.memberNumber}</p></div>
          <div className="flex items-center gap-1 shrink-0"><Pill state={b.status} />
            <Can permission="fitness.classes.edit">
              {b.status === "booked" && <Button size="sm" variant="ghost" onClick={() => mark.mutate({ id: b.id, s: "attended" })}>Here</Button>}
              {(b.status === "booked" || b.status === "waitlisted") && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => cancel.mutate(b.id)}>Cancel</Button>}
            </Can></div>
        </div>))}</div>
    </Modal>
  );
}

function SchedulePanel() {
  const { branchId, branches, setBranchId } = useWorkingBranch();
  const [start, setStart] = React.useState(weekStart(localToday()));
  const [adding, setAdding] = React.useState(false);
  const [open, setOpen] = React.useState<SessionDto | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<SessionDto | null>(null);
  const [series, setSeries] = React.useState(false);
  const { data = [], isLoading, error } = useSessions({ from: start, to: addDays(start, 6), branchId: branchId || undefined });
  const cancel = useAct((a: { id: string; series: boolean }) => fitnessApi.cancelSession(a.id, undefined, a.series), "Cancelled — members got their credits back.");
  const complete = useAct((id: string) => fitnessApi.completeSession(id, true), "Class closed.");
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setStart(addDays(start, -7))}><ChevronLeft className="h-4 w-4 rtl:rotate-180" /></Button>
        <span className="text-sm font-medium tabular-nums">{formatDate(start)} – {formatDate(addDays(start, 6))}</span>
        <Button variant="outline" size="sm" onClick={() => setStart(addDays(start, 7))}><ChevronRight className="h-4 w-4 rtl:rotate-180" /></Button>
        <Button variant="ghost" size="sm" onClick={() => setStart(weekStart(localToday()))}>This week</Button>
        {branches.length > 1 && <select className={cn(SELECT, "w-auto ms-auto")} value={branchId} onChange={e => setBranchId(e.target.value)}>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}
        <Can permission="fitness.classes.create"><Button size="sm" className={cn("gap-1.5", branches.length <= 1 && "ms-auto")} onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Schedule</Button></Can>
      </div>
      <TableState loading={isLoading} error={error as Error | null} empty={!isLoading && data.length === 0} emptyText="No classes this week." icon={CalendarDays} />
      <div className="grid gap-3">
        {days.map(d => {
          const list = data.filter(s => s.date === d);
          if (list.length === 0) return null;
          return (
            <Card key={d} className="p-3"><p className="text-xs font-semibold text-muted-foreground uppercase mb-2">{DAYS[new Date(`${d}T00:00:00`).getDay()]} {formatDate(d)}</p>
              <div className="space-y-2">{list.map(s => (
                <div key={s.id} className={cn("flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2", s.status === "cancelled" && "opacity-50")} style={{ borderInlineStartColor: s.color ?? undefined, borderInlineStartWidth: 4 }}>
                  <div className="min-w-0 flex-1"><p className="font-medium text-sm">{s.className} <span className="text-muted-foreground font-normal">{s.startTime}–{s.endTime}</span></p>
                    <p className="text-xs text-muted-foreground">{[s.trainerName, s.room, s.branchName].filter(Boolean).join(" · ")}</p></div>
                  <span className={cn("text-xs tabular-nums", s.booked >= s.capacity && "text-red-600 font-semibold")}>{s.booked}/{s.capacity}{s.waitlisted > 0 ? ` +${s.waitlisted} waiting` : ""}</span>
                  <Pill state={s.status} />
                  <Button size="sm" variant="outline" onClick={() => setOpen(s)}>Bookings</Button>
                  <Can permission="fitness.classes.edit">{s.status === "scheduled" && <>
                    <Button size="sm" variant="ghost" disabled={complete.isPending} onClick={() => complete.mutate(s.id)}>Close</Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => { setCancelTarget(s); setSeries(false); }}>Cancel</Button></>}</Can>
                </div>))}</div>
            </Card>);
        })}
      </div>
      <AnimatePresence>
        {adding && <ScheduleForm branchId={branchId} date={localToday()} onClose={() => setAdding(false)} />}
        {open && <BookingsModal session={open} onClose={() => setOpen(null)} />}
        {cancelTarget && (
          <ConfirmDialog title={`Cancel ${cancelTarget.className}?`} confirmLabel="Cancel class" pending={cancel.isPending}
            body={<div className="space-y-2"><p>{cancelTarget.booked} booked members get their credits back.</p>
              {cancelTarget.seriesId && <label className="flex items-center gap-2"><input type="checkbox" checked={series} onChange={e => setSeries(e.target.checked)} />Also cancel every later class in this series</label>}</div>}
            onConfirm={() => cancel.mutate({ id: cancelTarget.id, series }, { onSuccess: () => setCancelTarget(null) })} onClose={() => setCancelTarget(null)} />)}
      </AnimatePresence>
    </div>
  );
}

function TypesPanel() {
  const { data = [], isLoading } = useClassTypes();
  const [edit, setEdit] = React.useState<ClassTypeDto | "new" | null>(null);
  const del = useAct((id: string) => fitnessApi.deleteClassType(id), "Class removed.");
  return (
    <div className="space-y-3">
      <Can permission="fitness.classes.create"><Button size="sm" className="gap-1.5" onClick={() => setEdit("new")}><Plus className="h-4 w-4" />New class</Button></Can>
      <Card className="overflow-hidden"><TableState loading={isLoading} empty={data.length === 0} emptyText="No classes yet — add Yoga, Spin, HIIT…" icon={Dumbbell} />
        {data.length > 0 && <table className="w-full text-sm"><thead className="bg-muted/30 text-xs text-muted-foreground"><tr><th className={TH}>Class</th><th className={TH}>Minutes</th><th className={TH}>Capacity</th><th className={TH}>Credits</th><th /></tr></thead>
          <tbody className="divide-y divide-border">{data.map(t => (
            <tr key={t.id}><td className="px-4 py-2.5"><span className="inline-block h-2.5 w-2.5 rounded-full me-2" style={{ background: t.color ?? "#999" }} />{t.name}{!t.isActive && <span className="text-xs text-muted-foreground"> (off)</span>}</td>
              <td className="px-4 py-2.5">{t.durationMinutes}</td><td className="px-4 py-2.5">{t.capacity}</td><td className="px-4 py-2.5">{t.creditCost}</td>
              <td className="px-4 py-2.5 text-end space-x-2"><Can permission="fitness.classes.edit"><button className="text-xs text-primary" onClick={() => setEdit(t)}>Edit</button></Can>
                <Can permission="fitness.classes.delete"><button className="text-xs text-red-600" onClick={() => del.mutate(t.id)}>Delete</button></Can></td></tr>))}</tbody></table>}
      </Card>
      <AnimatePresence>{edit && <TypeForm type={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />}</AnimatePresence>
    </div>
  );
}

export function ClassesView() {
  const [tab, setTab] = React.useState<"schedule" | "types">("schedule");
  return (
    <div className="space-y-5">
      <PageHeader title="Classes" description="Weekly timetable, bookings, waitlists and the class types you offer." />
      <Tabs value={tab} onChange={setTab as (v: string) => void} items={[{ value: "schedule", label: "Timetable" }, { value: "types", label: "Class types" }]} />
      {tab === "schedule" ? <SchedulePanel /> : <TypesPanel />}
    </div>
  );
}
