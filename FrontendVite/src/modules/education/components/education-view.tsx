import * as React from "react";
import { motion } from "framer-motion";
import { GraduationCap, FileText, Users, DollarSign, BookOpen, Plus, X, Trash2, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, fitTextClass } from "@/lib/utils";
import {
  useEducationSummary, useAdmissions, useStudents, useEnrollments,
  useCreateAdmission, useSetAdmissionStatus, useEnrollAdmission, useDeleteAdmission,
  useCreateStudent, useDeleteStudent,
  useCreateEnrollment, useRecordFee, useDeleteEnrollment,
} from "@/hooks/education/use-education";
import type { StudentDto } from "@/lib/education/education.api";
import { Can } from "@/components/auth/can";
import { useCurrency } from "@/hooks/use-currency";

type Tab = "admissions" | "students" | "enrollments";
const TABS: { key: Tab; label: string; icon: typeof FileText }[] = [
  { key: "admissions", label: "Admissions", icon: FileText },
  { key: "students", label: "Students", icon: Users },
  { key: "enrollments", label: "Enrollments & Fees", icon: BookOpen },
];
const today = () => new Date().toISOString().slice(0, 10);
const badge = (s: string) => ({
  inquiry: "bg-blue-100 text-blue-700", applied: "bg-warning/10 text-warning", offer: "bg-violet-100 text-violet-700",
  accepted: "bg-success/10 text-success", rejected: "bg-destructive/10 text-destructive",
  enrolled: "bg-success/10 text-success", graduated: "bg-violet-100 text-violet-700", inactive: "bg-muted text-muted-foreground",
  active: "bg-success/10 text-success", completed: "bg-violet-100 text-violet-700", withdrawn: "bg-destructive/10 text-destructive",
}[s] ?? "bg-muted text-muted-foreground");

export function EducationView() {
  const CUR = useCurrency();
  const [tab, setTab] = React.useState<Tab>("admissions");
  const { data: s } = useEducationSummary();
  const { data: students = [] } = useStudents();
  const stats = [
    { label: "Open Inquiries", value: s?.openInquiries ?? 0, icon: FileText, color: "text-blue-600 bg-blue-100" },
    { label: "Enrolled Students", value: s?.enrolledStudents ?? 0, icon: Users, color: "text-primary bg-primary/10" },
    { label: "Active Enrollments", value: s?.activeEnrollments ?? 0, icon: BookOpen, color: "text-violet-600 bg-violet-100" },
    { label: "Fees Collected", value: formatCurrency(s?.feesCollected ?? 0, CUR), icon: DollarSign, color: "text-success bg-success/10" },
    { label: "Fees Outstanding", value: formatCurrency(s?.feesOutstanding ?? 0, CUR), icon: DollarSign, color: "text-destructive bg-destructive/10" },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Education</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Lead → Admission Inquiry → Application → Enrollment → Student Lifecycle</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((x, i) => { const Icon = x.icon; return (
          <motion.div key={x.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-card border border-border rounded-xl p-4 min-w-0">
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mb-2", x.color)}><Icon className="h-4.5 w-4.5" /></div>
            <p className="text-xs text-muted-foreground truncate">{x.label}</p><p className={cn("font-bold leading-tight mt-0.5 truncate", fitTextClass(x.value, "lg"))} title={String(x.value)}>{x.value}</p>
          </motion.div>); })}
      </div>
      <div className="flex items-center gap-1.5">
        {TABS.map(t => { const Icon = t.icon; return (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn("flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all",
            tab === t.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted")}>
            <Icon className="h-4 w-4" />{t.label}</button>); })}
      </div>
      {tab === "admissions" && <AdmissionsTab />}
      {tab === "students" && <StudentsTab />}
      {tab === "enrollments" && <EnrollmentsTab students={students} />}
    </div>
  );
}

function AddBar({ open, setOpen, label, children, onSave, saving, canSave, perm }:
  { open: boolean; setOpen: (v: boolean) => void; label: string; children: React.ReactNode; onSave: () => void; saving: boolean; canSave: boolean; perm?: string }) {
  if (!open) return <Can permission={perm}><Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{label}</Button></Can>;
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

function AdmissionsTab() {
  const { data: rows = [] } = useAdmissions();
  const create = useCreateAdmission(); const setStatus = useSetAdmissionStatus(); const enroll = useEnrollAdmission(); const del = useDeleteAdmission();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(""); const [program, setProgram] = React.useState(""); const [term, setTerm] = React.useState("Fall 2026"); const [guardian, setGuardian] = React.useState("");
  const save = () => create.mutate({ applicantName: name.trim(), program: program.trim(), intakeTerm: term, guardianName: guardian.trim() || null },
    { onSuccess: () => { setOpen(false); setName(""); setProgram(""); setGuardian(""); } });
  return (
    <div className="space-y-3">
      <AddBar perm="education.admissions.create" open={open} setOpen={setOpen} label="New Admission" onSave={save} saving={create.isPending} canSave={!!name.trim() && !!program.trim()}>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Applicant" className="h-9 w-40 text-sm" />
        <Input value={program} onChange={e => setProgram(e.target.value)} placeholder="Program" className="h-9 w-44 text-sm" />
        <Input value={term} onChange={e => setTerm(e.target.value)} placeholder="Intake term" className="h-9 w-32 text-sm" />
        <Input value={guardian} onChange={e => setGuardian(e.target.value)} placeholder="Guardian" className="h-9 w-36 text-sm" />
      </AddBar>
      <Table cols={["Admission #", "Applicant", "Program", "Term", "Status", ""]} empty={rows.length === 0} emptyMsg="No admissions yet.">
        {rows.map(a => (
          <tr key={a.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
            <td className="px-4 py-2.5 font-mono text-xs">{a.admissionNumber}</td>
            <td className="px-4 py-2.5 text-sm font-medium">{a.applicantName}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground">{a.program}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground">{a.intakeTerm}</td>
            <td className="px-4 py-2.5"><span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize", badge(a.status))}>{a.status}</span></td>
            <td className="px-4 py-2.5 text-right"><div className="flex items-center justify-end gap-1">
              {a.status === "inquiry" && <button title="Mark applied" onClick={() => setStatus.mutate({ id: a.id, status: "applied" })} className="p-1.5 rounded text-warning hover:bg-warning/10"><ArrowRight className="h-3.5 w-3.5" /></button>}
              {(a.status === "applied" || a.status === "offer") && !a.studentId && <button title="Accept & enroll" onClick={() => enroll.mutate(a.id)} className="p-1.5 rounded text-success hover:bg-success/10"><Check className="h-3.5 w-3.5" /></button>}
              <Can permission="education.admissions.delete"><button title="Delete" onClick={() => del.mutate(a.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></Can>
            </div></td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function StudentsTab() {
  const { data: rows = [] } = useStudents();
  const create = useCreateStudent(); const del = useDeleteStudent();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(""); const [program, setProgram] = React.useState(""); const [gender, setGender] = React.useState("male"); const [guardian, setGuardian] = React.useState("");
  const save = () => create.mutate({ fullName: name.trim(), program: program.trim() || null, gender, guardianName: guardian.trim() || null },
    { onSuccess: () => { setOpen(false); setName(""); setProgram(""); setGuardian(""); } });
  return (
    <div className="space-y-3">
      <AddBar perm="education.students.create" open={open} setOpen={setOpen} label="Add Student" onSave={save} saving={create.isPending} canSave={!!name.trim()}>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="h-9 w-44 text-sm" />
        <select value={gender} onChange={e => setGender(e.target.value)} className="h-9 px-2 rounded-lg border border-border bg-background text-sm"><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select>
        <Input value={program} onChange={e => setProgram(e.target.value)} placeholder="Program" className="h-9 w-44 text-sm" />
        <Input value={guardian} onChange={e => setGuardian(e.target.value)} placeholder="Guardian" className="h-9 w-36 text-sm" />
      </AddBar>
      <Table cols={["Student #", "Name", "Program", "Guardian", "Status", ""]} empty={rows.length === 0} emptyMsg="No students yet.">
        {rows.map(p => (
          <tr key={p.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
            <td className="px-4 py-2.5 font-mono text-xs">{p.studentNumber}</td>
            <td className="px-4 py-2.5 text-sm font-medium">{p.fullName}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground">{p.program || "—"}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground">{p.guardianName || "—"}</td>
            <td className="px-4 py-2.5"><span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize", badge(p.status))}>{p.status}</span></td>
            <td className="px-4 py-2.5 text-right"><Can permission="education.students.delete"><button title="Delete" onClick={() => del.mutate(p.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></Can></td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function EnrollmentsTab({ students }: { students: StudentDto[] }) {
  const CUR = useCurrency();
  const { data: rows = [] } = useEnrollments();
  const create = useCreateEnrollment(); const pay = useRecordFee(); const del = useDeleteEnrollment();
  const [open, setOpen] = React.useState(false);
  const [sid, setSid] = React.useState(""); const [sname, setSname] = React.useState(""); const [course, setCourse] = React.useState(""); const [term, setTerm] = React.useState("Fall 2026"); const [fee, setFee] = React.useState("");
  const save = () => create.mutate({ studentId: sid, studentName: sname, course: course.trim(), term, feeTotal: parseFloat(fee) || 0 },
    { onSuccess: () => { setOpen(false); setSid(""); setSname(""); setCourse(""); setFee(""); } });
  return (
    <div className="space-y-3">
      <AddBar perm="education.enrollments.create" open={open} setOpen={setOpen} label="New Enrollment" onSave={save} saving={create.isPending} canSave={!!sid && !!course.trim()}>
        <select value={sid} onChange={e => { const st = students.find(x => x.id === e.target.value); setSid(e.target.value); setSname(st?.fullName ?? ""); }} className="h-9 px-2 rounded-lg border border-border bg-background text-sm">
          <option value="">Student…</option>
          {students.map(st => <option key={st.id} value={st.id}>{st.fullName} · {st.studentNumber}</option>)}
        </select>
        <Input value={course} onChange={e => setCourse(e.target.value)} placeholder="Course" className="h-9 w-44 text-sm" />
        <Input value={term} onChange={e => setTerm(e.target.value)} placeholder="Term" className="h-9 w-32 text-sm" />
        <Input type="number" value={fee} onChange={e => setFee(e.target.value)} placeholder="Fee total" className="h-9 w-28 text-sm text-right" />
      </AddBar>
      <Table cols={["Enrollment #", "Student", "Course", "Fee", "Paid", "Balance", "Status", ""]} empty={rows.length === 0} emptyMsg="No enrollments yet.">
        {rows.map(e => (
          <tr key={e.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
            <td className="px-4 py-2.5 font-mono text-xs">{e.enrollmentNumber}</td>
            <td className="px-4 py-2.5 text-sm font-medium">{e.studentName}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground">{e.course}</td>
            <td className="px-4 py-2.5 text-sm">{formatCurrency(e.feeTotal, CUR)}</td>
            <td className="px-4 py-2.5 text-sm text-success">{formatCurrency(e.feePaid, CUR)}</td>
            <td className="px-4 py-2.5 text-sm font-semibold">{formatCurrency(e.feeBalance, CUR)}</td>
            <td className="px-4 py-2.5"><span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize", badge(e.status))}>{e.status}</span></td>
            <td className="px-4 py-2.5 text-right"><div className="flex items-center justify-end gap-1">
              {e.feeBalance > 0 && <button title="Record fee payment" onClick={() => pay.mutate({ id: e.id, amount: e.feeBalance })} className="p-1.5 rounded text-success hover:bg-success/10"><DollarSign className="h-3.5 w-3.5" /></button>}
              <Can permission="education.enrollments.delete"><button title="Delete" onClick={() => del.mutate(e.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></Can>
            </div></td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
