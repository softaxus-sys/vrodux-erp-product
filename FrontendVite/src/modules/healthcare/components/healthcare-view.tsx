import * as React from "react";
import { motion } from "framer-motion";
import { Users, CalendarClock, Stethoscope, Activity, Plus, X, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useHealthcareSummary, usePatients, useAppointments, useTreatmentPlans,
  useCreatePatient, useDeletePatient,
  useCreateAppointment, useSetApptStatus, useDeleteAppointment,
  useCreatePlan, useSetPlanStatus, useDeletePlan,
} from "@/hooks/healthcare/use-healthcare";
import type { PatientDto } from "@/lib/healthcare/healthcare.api";

type Tab = "patients" | "appointments" | "treatments";
const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: "patients", label: "Patients", icon: Users },
  { key: "appointments", label: "Appointments", icon: CalendarClock },
  { key: "treatments", label: "Treatment Plans", icon: Stethoscope },
];
const today = () => new Date().toISOString().slice(0, 10);
const badge = (s: string) => ({
  active: "bg-success/10 text-success", inactive: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-100 text-blue-700", completed: "bg-success/10 text-success", cancelled: "bg-destructive/10 text-destructive", no_show: "bg-muted text-muted-foreground",
  on_hold: "bg-warning/10 text-warning",
}[s] ?? "bg-muted text-muted-foreground");

export function HealthcareView() {
  const [tab, setTab] = React.useState<Tab>("patients");
  const { data: s } = useHealthcareSummary();
  const { data: patients = [] } = usePatients();
  const stats = [
    { label: "Patients", value: s?.patients ?? 0, icon: Users, color: "text-primary bg-primary/10" },
    { label: "Scheduled", value: s?.scheduledAppointments ?? 0, icon: CalendarClock, color: "text-blue-600 bg-blue-100" },
    { label: "Today", value: s?.todayAppointments ?? 0, icon: CalendarClock, color: "text-warning bg-warning/10" },
    { label: "Completed Visits", value: s?.completedAppointments ?? 0, icon: Check, color: "text-success bg-success/10" },
    { label: "Active Treatments", value: s?.activeTreatments ?? 0, icon: Activity, color: "text-violet-600 bg-violet-100" },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Stethoscope className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Healthcare</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Lead → Patient Registration → Appointment → Treatment → Follow-up</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((x, i) => { const Icon = x.icon; return (
          <motion.div key={x.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-card border border-border rounded-xl p-4">
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mb-2", x.color)}><Icon className="h-4.5 w-4.5" /></div>
            <p className="text-xs text-muted-foreground">{x.label}</p><p className="font-bold text-lg leading-tight mt-0.5">{x.value}</p>
          </motion.div>); })}
      </div>
      <div className="flex items-center gap-1.5">
        {TABS.map(t => { const Icon = t.icon; return (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn("flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all",
            tab === t.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted")}>
            <Icon className="h-4 w-4" />{t.label}</button>); })}
      </div>
      {tab === "patients" && <PatientsTab />}
      {tab === "appointments" && <AppointmentsTab patients={patients} />}
      {tab === "treatments" && <TreatmentsTab patients={patients} />}
    </div>
  );
}

function AddBar({ open, setOpen, label, children, onSave, saving, canSave }:
  { open: boolean; setOpen: (v: boolean) => void; label: string; children: React.ReactNode; onSave: () => void; saving: boolean; canSave: boolean }) {
  if (!open) return <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{label}</Button>;
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex flex-wrap items-center gap-2">
      {children}
      <div className="ml-auto flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen(false)} disabled={saving}><X className="h-3.5 w-3.5" /></Button>
        <Button size="sm" onClick={onSave} disabled={!canSave || saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </div>
  );
}
function Table({ cols, children, empty, emptyMsg }: { cols: string[]; children: React.ReactNode; empty: boolean; emptyMsg: string }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full"><thead><tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
        {cols.map((c, i) => <th key={i} className={cn("px-4 py-3 font-semibold", i === cols.length - 1 ? "text-right" : "text-left")}>{c}</th>)}
      </tr></thead>
      <tbody>{empty ? <tr><td colSpan={cols.length} className="text-center py-12 text-sm text-muted-foreground">{emptyMsg}</td></tr> : children}</tbody></table>
    </div>
  );
}
function PatientSelect({ value, onChange, patients }: { value: string; onChange: (id: string, name: string) => void; patients: PatientDto[] }) {
  return (
    <select value={value} onChange={e => { const p = patients.find(x => x.id === e.target.value); onChange(e.target.value, p?.fullName ?? ""); }}
      className="h-9 px-2 rounded-lg border border-border bg-background text-sm">
      <option value="">Patient…</option>
      {patients.map(p => <option key={p.id} value={p.id}>{p.fullName} · {p.patientNumber}</option>)}
    </select>
  );
}

function PatientsTab() {
  const { data: rows = [] } = usePatients();
  const create = useCreatePatient(); const del = useDeletePatient();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(""); const [gender, setGender] = React.useState("male"); const [phone, setPhone] = React.useState(""); const [doctor, setDoctor] = React.useState("");
  const save = () => create.mutate({ fullName: name.trim(), gender, phone: phone.trim() || null, assignedDoctor: doctor.trim() || null },
    { onSuccess: () => { setOpen(false); setName(""); setPhone(""); setDoctor(""); } });
  return (
    <div className="space-y-3">
      <AddBar open={open} setOpen={setOpen} label="Register Patient" onSave={save} saving={create.isPending} canSave={!!name.trim()}>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="h-9 w-44 text-sm" />
        <select value={gender} onChange={e => setGender(e.target.value)} className="h-9 px-2 rounded-lg border border-border bg-background text-sm"><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select>
        <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" className="h-9 w-36 text-sm" />
        <Input value={doctor} onChange={e => setDoctor(e.target.value)} placeholder="Assigned doctor" className="h-9 w-40 text-sm" />
      </AddBar>
      <Table cols={["Patient #", "Name", "Gender", "Phone", "Doctor", "Status", ""]} empty={rows.length === 0} emptyMsg="No patients yet.">
        {rows.map(p => (
          <tr key={p.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
            <td className="px-4 py-2.5 font-mono text-xs">{p.patientNumber}</td>
            <td className="px-4 py-2.5 text-sm font-medium">{p.fullName}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground capitalize">{p.gender}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground">{p.phone || "—"}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground">{p.assignedDoctor || "—"}</td>
            <td className="px-4 py-2.5"><span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize", badge(p.status))}>{p.status}</span></td>
            <td className="px-4 py-2.5 text-right"><button title="Delete" onClick={() => del.mutate(p.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function AppointmentsTab({ patients }: { patients: PatientDto[] }) {
  const { data: rows = [] } = useAppointments();
  const create = useCreateAppointment(); const setStatus = useSetApptStatus(); const del = useDeleteAppointment();
  const [open, setOpen] = React.useState(false);
  const [pid, setPid] = React.useState(""); const [pname, setPname] = React.useState(""); const [doctor, setDoctor] = React.useState(""); const [when, setWhen] = React.useState(today()); const [reason, setReason] = React.useState("");
  const save = () => create.mutate({ patientId: pid, patientName: pname, doctor: doctor.trim(), scheduledAt: when, reason: reason.trim() || null },
    { onSuccess: () => { setOpen(false); setPid(""); setPname(""); setDoctor(""); setReason(""); } });
  return (
    <div className="space-y-3">
      <AddBar open={open} setOpen={setOpen} label="Book Appointment" onSave={save} saving={create.isPending} canSave={!!pid && !!doctor.trim()}>
        <PatientSelect value={pid} onChange={(id, n) => { setPid(id); setPname(n); }} patients={patients} />
        <Input value={doctor} onChange={e => setDoctor(e.target.value)} placeholder="Doctor" className="h-9 w-36 text-sm" />
        <Input type="date" value={when} onChange={e => setWhen(e.target.value)} className="h-9 w-40 text-sm" />
        <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason" className="h-9 w-44 text-sm" />
      </AddBar>
      <Table cols={["Appt #", "Patient", "Doctor", "Scheduled", "Status", ""]} empty={rows.length === 0} emptyMsg="No appointments yet.">
        {rows.map(a => (
          <tr key={a.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
            <td className="px-4 py-2.5 font-mono text-xs">{a.appointmentNumber}</td>
            <td className="px-4 py-2.5 text-sm font-medium">{a.patientName}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground">{a.doctor}</td>
            <td className="px-4 py-2.5 text-sm">{a.scheduledAt}</td>
            <td className="px-4 py-2.5"><span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize", badge(a.status))}>{a.status.replace("_", " ")}</span></td>
            <td className="px-4 py-2.5 text-right"><div className="flex items-center justify-end gap-1">
              {a.status === "scheduled" && <button title="Mark completed" onClick={() => setStatus.mutate({ id: a.id, status: "completed" })} className="p-1.5 rounded text-success hover:bg-success/10"><Check className="h-3.5 w-3.5" /></button>}
              <button title="Delete" onClick={() => del.mutate(a.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div></td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function TreatmentsTab({ patients }: { patients: PatientDto[] }) {
  const { data: rows = [] } = useTreatmentPlans();
  const create = useCreatePlan(); const setStatus = useSetPlanStatus(); const del = useDeletePlan();
  const [open, setOpen] = React.useState(false);
  const [pid, setPid] = React.useState(""); const [pname, setPname] = React.useState(""); const [dx, setDx] = React.useState(""); const [plan, setPlan] = React.useState(""); const [doctor, setDoctor] = React.useState("");
  const save = () => create.mutate({ patientId: pid, patientName: pname, diagnosis: dx.trim(), plan: plan.trim(), doctor: doctor.trim(), startDate: today() },
    { onSuccess: () => { setOpen(false); setPid(""); setPname(""); setDx(""); setPlan(""); setDoctor(""); } });
  return (
    <div className="space-y-3">
      <AddBar open={open} setOpen={setOpen} label="New Treatment Plan" onSave={save} saving={create.isPending} canSave={!!pid && !!dx.trim() && !!plan.trim()}>
        <PatientSelect value={pid} onChange={(id, n) => { setPid(id); setPname(n); }} patients={patients} />
        <Input value={dx} onChange={e => setDx(e.target.value)} placeholder="Diagnosis" className="h-9 w-44 text-sm" />
        <Input value={plan} onChange={e => setPlan(e.target.value)} placeholder="Plan" className="h-9 w-52 text-sm" />
        <Input value={doctor} onChange={e => setDoctor(e.target.value)} placeholder="Doctor" className="h-9 w-32 text-sm" />
      </AddBar>
      <Table cols={["Patient", "Diagnosis", "Plan", "Doctor", "Status", ""]} empty={rows.length === 0} emptyMsg="No treatment plans yet.">
        {rows.map(t => (
          <tr key={t.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
            <td className="px-4 py-2.5 text-sm font-medium">{t.patientName}</td>
            <td className="px-4 py-2.5 text-sm">{t.diagnosis}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground">{t.plan}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground">{t.doctor}</td>
            <td className="px-4 py-2.5"><span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize", badge(t.status))}>{t.status.replace("_", " ")}</span></td>
            <td className="px-4 py-2.5 text-right"><div className="flex items-center justify-end gap-1">
              {t.status === "active" && <button title="Mark completed" onClick={() => setStatus.mutate({ id: t.id, status: "completed" })} className="p-1.5 rounded text-success hover:bg-success/10"><Check className="h-3.5 w-3.5" /></button>}
              <button title="Delete" onClick={() => del.mutate(t.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div></td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
