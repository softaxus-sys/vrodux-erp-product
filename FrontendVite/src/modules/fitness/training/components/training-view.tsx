import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { Plus, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/auth/can";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { addDays, fitnessApi, localToday, PAYMENT_METHODS, type PtPackageDto, type PtSessionDto, type TrainerDto } from "@/lib/fitness/fitness.api";
import { useAct, useBranches, useMembers, usePtPackages, usePtSessions, useTrainers, useWorkingBranch } from "@/hooks/fitness/use-fitness";
import { ProgramsPanel } from "../../programs/components/programs-panel";
import { PaymentModal } from "../../members/components/members-view";
import { ConfirmDialog, Field, FormModal, Modal, PageHeader, Pill, SELECT, Tabs, TableState, TH, num, orUndef, useDebounced } from "../../shared/ui";
import { Loader2 } from "lucide-react";

function TrainerForm({ trainer, onClose }: { trainer?: TrainerDto; onClose: () => void }) {
  const { data: branches = [] } = useBranches(true);
  const save = useAct((b: Record<string, unknown>) => fitnessApi.saveTrainer(trainer?.id ?? null, b), "Trainer saved.", ["trainers"]);
  return (
    <FormModal title={trainer ? `Edit ${trainer.name}` : "New trainer"} pending={save.isPending} onClose={onClose}
      initial={{ name: trainer?.name ?? "", phone: trainer?.phone ?? "", email: trainer?.email ?? "", branchId: trainer?.branchId ?? "", specialties: trainer?.specialties ?? "",
        certifications: trainer?.certifications ?? "", sessionRate: String(trainer?.sessionRate ?? 0), commissionPct: String(trainer?.commissionPct ?? 0), bio: trainer?.bio ?? "", isActive: trainer?.isActive ?? true }}
      fields={[
        { key: "name", label: "Name", required: true }, { key: "phone", label: "Phone" }, { key: "email", label: "Email", type: "email" },
        { key: "branchId", label: "Branch", type: "select", options: branches.map(b => ({ value: b.id, label: b.name })) },
        { key: "specialties", label: "Specialties" }, { key: "certifications", label: "Certifications" },
        { key: "sessionRate", label: "Rate per session", type: "number" }, { key: "commissionPct", label: "Commission %", type: "number" },
        { key: "bio", label: "Bio", type: "textarea" }, { key: "isActive", label: "Active", type: "checkbox" },
      ]}
      onSubmit={v => save.mutate({ name: String(v.name).trim(), phone: orUndef(v.phone), email: orUndef(v.email), branchId: orUndef(v.branchId), specialties: orUndef(v.specialties),
        certifications: orUndef(v.certifications), bio: orUndef(v.bio), sessionRate: num(v.sessionRate), commissionPct: num(v.commissionPct), isActive: !!v.isActive }, { onSuccess: onClose })} />
  );
}

function SellPackage({ onClose }: { onClose: () => void }) {
  const { data: trainers = [] } = useTrainers(true);
  const cur = useCurrency();
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search);
  const { data: found } = useMembers({ search: q, pageSize: 5 });
  const [member, setMember] = React.useState<{ id: string; name: string } | null>(null);
  const [trainerId, setTrainerId] = React.useState("");
  const [sessions, setSessions] = React.useState("10");
  const trainer = trainers.find(t => t.id === trainerId);
  const [price, setPrice] = React.useState("");
  React.useEffect(() => { if (trainer) setPrice(String(trainer.sessionRate * num(sessions))); }, [trainerId, sessions]);
  const [paid, setPaid] = React.useState("0");
  const [method, setMethod] = React.useState("cash");
  const [expires, setExpires] = React.useState("");
  const sell = useAct((b: Record<string, unknown>) => fitnessApi.sellPt(b), "Package sold.");
  return (
    <Modal title="Sell training package" size="md" onClose={onClose}
      footer={<><Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" className="gap-1.5" disabled={!member || !trainerId || num(sessions) < 1 || num(paid) > num(price) || sell.isPending}
          onClick={() => sell.mutate({ memberId: member!.id, trainerId, sessions: num(sessions), price: num(price), expiresOn: orUndef(expires), amountPaid: num(paid), paymentMethod: num(paid) > 0 ? method : undefined }, { onSuccess: onClose })}>
          {sell.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Sell</Button></>}>
      <Field label="Member *">
        {member ? <div className="flex justify-between rounded-lg border border-border px-3 py-2 text-sm">{member.name}<button className="text-xs text-muted-foreground" onClick={() => setMember(null)}>Change</button></div> : (
          <div className="space-y-1.5"><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search member…" className="h-9" />
            {q && (found?.items ?? []).map(m => <button key={m.id} className="block w-full text-start rounded-md px-3 py-1.5 text-sm hover:bg-muted" onClick={() => setMember({ id: m.id, name: m.fullName })}>{m.fullName} <span className="text-xs text-muted-foreground">{m.memberNumber}</span></button>)}</div>)}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Trainer *"><select className={SELECT} value={trainerId} onChange={e => setTrainerId(e.target.value)}><option value="">Choose…</option>{trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        <Field label="Sessions"><Input type="number" min={1} value={sessions} onChange={e => setSessions(e.target.value)} className="h-9" /></Field>
        <Field label={`Price (${cur})`}><Input type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} className="h-9" /></Field>
        <Field label="Expires on"><Input type="date" value={expires} onChange={e => setExpires(e.target.value)} className="h-9" /></Field>
        <Field label="Paid now"><Input type="number" min={0} value={paid} onChange={e => setPaid(e.target.value)} className="h-9" /></Field>
        {num(paid) > 0 && <Field label="Method"><select className={SELECT} value={method} onChange={e => setMethod(e.target.value)}>{PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></Field>}
      </div>
    </Modal>
  );
}

function BookSession({ pkg, onClose }: { pkg: PtPackageDto; onClose: () => void }) {
  const { branchId } = useWorkingBranch();
  const book = useAct((b: Record<string, unknown>) => fitnessApi.bookPt(b), "Session booked.");
  return (
    <FormModal title="Book a session" subtitle={`${pkg.memberName} · ${pkg.remaining} left`} size="sm" pending={book.isPending} onClose={onClose}
      initial={{ date: localToday(), startTime: "10:00", durationMinutes: "60", notes: "" }}
      fields={[{ key: "date", label: "Date", type: "date", required: true }, { key: "startTime", label: "Start", type: "time", required: true },
        { key: "durationMinutes", label: "Minutes", type: "number", required: true }, { key: "notes", label: "Notes" }]}
      onSubmit={v => book.mutate({ packageId: pkg.id, date: v.date, startTime: v.startTime, durationMinutes: num(v.durationMinutes), branchId: branchId || undefined, notes: orUndef(v.notes) }, { onSuccess: onClose })} />
  );
}

function PackagesPanel() {
  const cur = useCurrency();
  const { data = [], isLoading, error } = usePtPackages({});
  const [selling, setSelling] = React.useState(false);
  const [booking, setBooking] = React.useState<PtPackageDto | null>(null);
  const [paying, setPaying] = React.useState<PtPackageDto | null>(null);
  const cancel = useAct((id: string) => fitnessApi.cancelPt(id), "Package cancelled.");
  return (
    <div className="space-y-3">
      <Can permission="fitness.training.create"><Button size="sm" className="gap-1.5" onClick={() => setSelling(true)}><Plus className="h-4 w-4" />Sell package</Button></Can>
      <Card className="overflow-hidden"><TableState loading={isLoading} error={error as Error | null} empty={data.length === 0} emptyText="No training packages sold yet." icon={UserCog} />
        {data.length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/30 text-xs text-muted-foreground"><tr><th className={TH}>Member</th><th className={TH}>Trainer</th><th className={TH}>Sessions</th><th className={TH}>Balance</th><th className={TH}>State</th><th /></tr></thead>
          <tbody className="divide-y divide-border">{data.map(p => (
            <tr key={p.id}><td className="px-4 py-2.5">{p.memberName}<p className="text-xs text-muted-foreground">{p.name}</p></td><td className="px-4 py-2.5">{p.trainerName}</td>
              <td className="px-4 py-2.5 tabular-nums">{p.usedSessions}/{p.totalSessions}</td><td className={cn("px-4 py-2.5 tabular-nums", p.balance > 0 && "text-red-600")}>{p.balance > 0 ? formatCurrency(p.balance, cur) : "—"}</td>
              <td className="px-4 py-2.5"><Pill state={p.state} /></td>
              <td className="px-4 py-2.5 text-end space-x-2 whitespace-nowrap">
                {p.state === "active" && <Can permission="fitness.training.create"><button className="text-xs text-primary" onClick={() => setBooking(p)}>Book</button></Can>}
                {p.balance > 0 && !p.isCancelled && <Can permission="fitness.payments.create"><button className="text-xs text-primary" onClick={() => setPaying(p)}>Pay</button></Can>}
                {!p.isCancelled && <Can permission="fitness.training.edit"><button className="text-xs text-red-600" onClick={() => cancel.mutate(p.id)}>Cancel</button></Can>}</td></tr>))}</tbody></table></div>}
      </Card>
      <AnimatePresence>
        {selling && <SellPackage onClose={() => setSelling(false)} />}
        {booking && <BookSession pkg={booking} onClose={() => setBooking(null)} />}
        {paying && <PaymentModal memberId={paying.memberId} memberName={paying.memberName ?? ""} ptPackageId={paying.id} balance={paying.balance} onClose={() => setPaying(null)} />}
      </AnimatePresence>
    </div>
  );
}

function SessionsPanel() {
  const [from, setFrom] = React.useState(localToday());
  const { data = [], isLoading, error } = usePtSessions({ from, to: addDays(from, 13) });
  const [closing, setClosing] = React.useState<{ s: PtSessionDto; status: string } | null>(null);
  const [log, setLog] = React.useState("");
  const close = useAct((a: { id: string; status: string; log?: string }) => fitnessApi.closePt(a.id, a.status, a.log), "Session closed.");
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm"><Field label="From"><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9" /></Field><span className="text-muted-foreground self-end pb-2">next 14 days</span></div>
      <Card className="overflow-hidden"><TableState loading={isLoading} error={error as Error | null} empty={data.length === 0} emptyText="No training sessions in this range." icon={UserCog} />
        {data.length > 0 && <table className="w-full text-sm"><thead className="bg-muted/30 text-xs text-muted-foreground"><tr><th className={TH}>When</th><th className={TH}>Member</th><th className={TH}>Trainer</th><th className={TH}>State</th><th /></tr></thead>
          <tbody className="divide-y divide-border">{data.map(s => (
            <tr key={s.id}><td className="px-4 py-2.5">{formatDate(s.date)} {s.startTime}</td><td className="px-4 py-2.5">{s.memberName}</td><td className="px-4 py-2.5">{s.trainerName}</td><td className="px-4 py-2.5"><Pill state={s.status} /></td>
              <td className="px-4 py-2.5 text-end space-x-2 whitespace-nowrap">{s.status === "scheduled" && <Can permission="fitness.training.edit">
                <button className="text-xs text-primary" onClick={() => { setClosing({ s, status: "completed" }); setLog(""); }}>Done</button>
                <button className="text-xs text-amber-600" onClick={() => setClosing({ s, status: "no_show" })}>No-show</button>
                <button className="text-xs text-red-600" onClick={() => setClosing({ s, status: "cancelled" })}>Cancel</button></Can>}</td></tr>))}</tbody></table>}
      </Card>
      <AnimatePresence>{closing && (
        <ConfirmDialog title={closing.status === "completed" ? "Mark session as given?" : closing.status === "no_show" ? "Mark as no-show?" : "Cancel this session?"} destructive={closing.status !== "completed"}
          confirmLabel="Confirm" pending={close.isPending}
          body={<div className="space-y-2"><p>{closing.status === "cancelled" ? "A cancelled session does not use one of the package's sessions." : "This uses one session from the package."}</p>
            {closing.status === "completed" && <Input placeholder="Session notes (optional)" value={log} onChange={e => setLog(e.target.value)} className="h-9" />}</div>}
          onConfirm={() => close.mutate({ id: closing.s.id, status: closing.status, log: orUndef(log) }, { onSuccess: () => setClosing(null) })} onClose={() => setClosing(null)} />)}</AnimatePresence>
    </div>
  );
}

function TrainersPanel() {
  const cur = useCurrency();
  const { data = [], isLoading } = useTrainers();
  const [edit, setEdit] = React.useState<TrainerDto | "new" | null>(null);
  const del = useAct((id: string) => fitnessApi.deleteTrainer(id), "Trainer removed.");
  return (
    <div className="space-y-3">
      <Can permission="fitness.training.create"><Button size="sm" className="gap-1.5" onClick={() => setEdit("new")}><Plus className="h-4 w-4" />New trainer</Button></Can>
      <Card className="overflow-hidden"><TableState loading={isLoading} empty={data.length === 0} emptyText="No trainers yet." icon={UserCog} />
        {data.length > 0 && <table className="w-full text-sm"><thead className="bg-muted/30 text-xs text-muted-foreground"><tr><th className={TH}>Trainer</th><th className={TH}>Rate</th><th className={TH}>Clients</th><th className={TH}>Upcoming</th><th /></tr></thead>
          <tbody className="divide-y divide-border">{data.map(t => (
            <tr key={t.id}><td className="px-4 py-2.5">{t.name}{!t.isActive && <span className="text-xs text-muted-foreground"> (off)</span>}<p className="text-xs text-muted-foreground">{t.specialties}</p></td>
              <td className="px-4 py-2.5 tabular-nums">{formatCurrency(t.sessionRate, cur)}</td><td className="px-4 py-2.5">{t.clients}</td><td className="px-4 py-2.5">{t.upcomingSessions}</td>
              <td className="px-4 py-2.5 text-end space-x-2"><Can permission="fitness.training.edit"><button className="text-xs text-primary" onClick={() => setEdit(t)}>Edit</button></Can>
                <Can permission="fitness.training.delete"><button className="text-xs text-red-600" onClick={() => del.mutate(t.id)}>Delete</button></Can></td></tr>))}</tbody></table>}
      </Card>
      <AnimatePresence>{edit && <TrainerForm trainer={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />}</AnimatePresence>
    </div>
  );
}

export function TrainingView() {
  const [tab, setTab] = React.useState<"packages" | "sessions" | "trainers" | "programs">("packages");
  return (
    <div className="space-y-5">
      <PageHeader title="Personal training" description="Trainers, packages sold to members and the sessions on the diary." />
      <Tabs value={tab} onChange={setTab as (v: string) => void} items={[{ value: "packages", label: "Packages" }, { value: "sessions", label: "Sessions" }, { value: "trainers", label: "Trainers" }, { value: "programs", label: "Program templates" }]} />
      {tab === "packages" ? <PackagesPanel /> : tab === "sessions" ? <SessionsPanel /> : tab === "programs" ? <ProgramsPanel /> : <TrainersPanel />}
    </div>
  );
}
