import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Mail, Phone, MapPin, Calendar, Building2, CreditCard,
  FileText, Shield, Award, AlertTriangle, CheckCircle2, Clock,
  Edit, Printer, ChevronRight, User, Briefcase, Banknote,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmployeeStatusBadge } from "./employee-status-badge";
import { formatDate, formatCurrency, getInitials, cn } from "@/lib/utils";
import type { EmployeeDto as Employee } from "@/lib/hr/hr.api";

type Tab = "overview" | "documents" | "payroll" | "leave";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Overview", icon: User },
  { id: "payroll", label: "Payroll", icon: Banknote },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "leave", label: "Leave", icon: Calendar },
];

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 flex justify-between gap-4">
        <span className="text-xs text-muted-foreground shrink-0">{label}</span>
        <span className="text-sm font-medium text-right">{value}</span>
      </div>
    </div>
  );
}

function OverviewTab({ emp }: { emp: Employee }) {
  return (
    <div className="space-y-6">
      {/* Personal */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Personal Information</h3>
        <div className="bg-muted/30 rounded-xl p-4 space-y-0">
          <InfoRow icon={Mail} label="Email" value={<a href={`mailto:${emp.email}`} className="text-primary hover:underline">{emp.email}</a>} />
          {emp.mobile    && <InfoRow icon={Phone}    label="Mobile"        value={emp.mobile} />}
          {emp.phone     && <InfoRow icon={Phone}    label="Office"        value={emp.phone} />}
          {emp.dateOfBirth && <InfoRow icon={Calendar} label="Date of Birth" value={formatDate(emp.dateOfBirth, "medium")} />}
          {emp.gender    && <InfoRow icon={User}     label="Gender"        value={<span className="capitalize">{emp.gender}</span>} />}
          {emp.nationality && <InfoRow icon={Shield}  label="Nationality"   value={emp.nationality} />}
          {emp.address   && <InfoRow icon={MapPin}   label="Address"       value={emp.address} />}
        </div>
      </div>

      {/* Employment */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Employment Details</h3>
        <div className="bg-muted/30 rounded-xl p-4 space-y-0">
          <InfoRow icon={Building2} label="Department"  value={emp.department  ?? "—"} />
          <InfoRow icon={Briefcase} label="Designation" value={emp.designation ?? "—"} />
          {emp.reportingTo && <InfoRow icon={User}   label="Reports To" value={emp.reportingTo} />}
          {emp.branch      && <InfoRow icon={MapPin} label="Branch"     value={emp.branch} />}
          <InfoRow icon={Calendar} label="Join Date" value={formatDate(emp.joinDate, "medium")} />
          <InfoRow icon={FileText} label="Contract Type" value={<span className="capitalize">{emp.contractType?.replace("_", " ") ?? "—"}</span>} />
          {emp.visaExpiry && <InfoRow icon={Calendar} label="Visa Expiry" value={formatDate(emp.visaExpiry, "medium")} />}
        </div>
      </div>

      {/* Skills */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Skills & Expertise</h3>
        <div className="flex flex-wrap gap-2">
          {(emp.skills ?? []).map(skill => (
            <span key={skill} className="px-2.5 py-1 rounded-full bg-primary/8 text-primary text-xs font-medium border border-primary/20">
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Emergency Contact */}
      {emp.emergencyContact && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Emergency Contact</h3>
          <div className="bg-muted/30 rounded-xl p-4 space-y-0">
            <InfoRow icon={User} label="Name" value={emp.emergencyContact.name ?? "—"} />
            <InfoRow icon={User} label="Relation" value={emp.emergencyContact.relation ?? "—"} />
            <InfoRow icon={Phone} label="Phone" value={emp.emergencyContact.phone ?? "—"} />
          </div>
        </div>
      )}
    </div>
  );
}

function PayrollTab({ emp }: { emp: Employee }) {
  const allowances = [
    { label: "Housing Allowance", amount: Math.round(emp.basicSalary * 0.25) },
    { label: "Transport Allowance", amount: Math.round(emp.basicSalary * 0.1) },
    { label: "Medical Allowance", amount: 1000 },
  ];
  const totalAllowances = allowances.reduce((s, a) => s + a.amount, 0);
  const grossSalary = emp.basicSalary + totalAllowances;

  return (
    <div className="space-y-6">
      {/* Salary breakdown */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Salary Structure</h3>
        <div className="bg-muted/30 rounded-xl p-4 space-y-0">
          <InfoRow icon={Banknote} label="Basic Salary" value={<span className="font-bold">{formatCurrency(emp.basicSalary, "AED")}</span>} />
          {allowances.map(a => (
            <InfoRow key={a.label} icon={CreditCard} label={a.label} value={formatCurrency(a.amount, "AED")} />
          ))}
          <div className="flex justify-between items-center pt-2 mt-1 border-t border-border">
            <span className="text-sm font-bold">Gross Salary</span>
            <span className="text-sm font-bold text-primary">{formatCurrency(grossSalary, "AED")}</span>
          </div>
        </div>
      </div>

      {/* Bank details */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Bank Details</h3>
        <div className="bg-muted/30 rounded-xl p-4 space-y-0">
          <InfoRow icon={Building2} label="Bank" value={emp.bankAccount ?? "Not provided"} />
          <InfoRow icon={CreditCard} label="IBAN" value={emp.iban ?? "Not provided"} />
          <InfoRow icon={Shield} label="Insurance" value={emp.medicalInsurance ?? "Not provided"} />
        </div>
      </div>

      {/* Payroll history */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Recent Payslips</h3>
        <div className="space-y-2">
          {["May 2026", "Apr 2026", "Mar 2026"].map((month, i) => (
            <div key={month} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{month} Payslip</p>
                  <p className="text-xs text-muted-foreground">Processed on {i === 0 ? "19" : i === 1 ? "18" : "17"} {month.split(" ")[0]} 2026</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{formatCurrency(grossSalary, "AED")}</span>
                <CheckCircle2 className="h-4 w-4 text-success" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DocumentsTab({ emp }: { emp: Employee }) {
  const docStatusConfig = {
    valid: { icon: CheckCircle2, className: "text-success", label: "Valid" },
    expiring: { icon: Clock, className: "text-warning", label: "Expiring Soon" },
    expired: { icon: AlertTriangle, className: "text-destructive", label: "Expired" },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Documents & Compliance</h3>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
          <FileText className="h-3 w-3" /> Upload
        </Button>
      </div>

      <div className="space-y-2.5">
        {(emp.documents ?? []).map((doc, i) => {
          const sc = docStatusConfig[doc.status];
          const Icon = sc.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
              <div className={cn(
                "flex items-center gap-3 p-3.5 rounded-xl border transition-colors cursor-pointer hover:bg-muted/30",
                doc.status === "expiring" ? "border-warning/30 bg-warning/5" :
                  doc.status === "expired" ? "border-destructive/30 bg-destructive/5" :
                    "border-border/50"
              )}>
                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                  doc.status === "valid" ? "bg-success/10" : doc.status === "expiring" ? "bg-warning/10" : "bg-destructive/10")}>
                  <FileText className={cn("h-4 w-4", sc.className)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{doc.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{doc.type}</span>
                    {doc.expiry && (
                      <>
                        <span className="text-muted-foreground/40 text-xs">·</span>
                        <span className="text-xs text-muted-foreground">Expires {formatDate(doc.expiry, "medium")}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn("text-[11px] font-semibold flex items-center gap-1", sc.className)}>
                    <Icon className="h-3 w-3" /> {sc.label}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* IDs */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-6 mb-3">Identity Numbers</h3>
        <div className="bg-muted/30 rounded-xl p-4 space-y-0">
          {emp.emiratesId && <InfoRow icon={Shield} label="Emirates ID" value={<span className="font-mono text-xs">{emp.emiratesId}</span>} />}
          <InfoRow icon={FileText} label="Passport No." value={<span className="font-mono text-xs">{emp.passportNumber}</span>} />
        </div>
      </div>
    </div>
  );
}

function LeaveTab({ emp }: { emp: Employee }) {
  const leaveTypes = [
    { type: "Annual Leave", balance: emp.annualLeaveBalance ?? 0, total: 30, color: "bg-primary" },
    { type: "Sick Leave",   balance: emp.sickLeaveBalance  ?? 0, total: 15, color: "bg-warning" },
    { type: "Unpaid Leave", balance: 0, total: 0, color: "bg-muted-foreground" },
  ];

  const recentLeaves = [
    { type: "Annual Leave", from: "2026-04-10", to: "2026-04-14", days: 5, status: "approved" },
    { type: "Sick Leave", from: "2026-03-02", to: "2026-03-03", days: 2, status: "approved" },
    { type: "Annual Leave", from: "2026-01-01", to: "2026-01-03", days: 3, status: "approved" },
  ];

  return (
    <div className="space-y-6">
      {/* Balances */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Leave Balances</h3>
        <div className="space-y-3">
          {leaveTypes.map(lt => (
            <div key={lt.type} className="bg-muted/30 rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-medium">{lt.type}</p>
                <p className="text-sm font-bold">
                  <span className="text-foreground">{lt.balance}</span>
                  <span className="text-muted-foreground font-normal"> / {lt.total} days</span>
                </p>
              </div>
              {lt.total > 0 && (
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", lt.color)}
                    style={{ width: `${Math.min((lt.balance / lt.total) * 100, 100)}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent requests */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Recent Leave History</h3>
          <Button variant="outline" size="sm" className="h-7 text-xs">Apply Leave</Button>
        </div>
        <div className="space-y-2">
          {recentLeaves.map((l, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{l.type}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(l.from, "medium")} – {formatDate(l.to, "medium")} · {l.days} days
                </p>
              </div>
              <span className="text-[11px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full capitalize">
                {l.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface DrawerProps { open: boolean; onClose: () => void; employee: Employee | null; }

export function EmployeeDrawer({ open, onClose, employee }: DrawerProps) {
  const [tab, setTab] = React.useState<Tab>("overview");

  // Reset tab when new employee selected
  React.useEffect(() => { if (employee) setTab("overview"); }, [employee]);

  return (
    <AnimatePresence>
      {open && employee && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />

          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-lg bg-card border-l border-border shadow-2xl z-50 flex flex-col"
          >
            {/* Drawer top bar */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Employee Profile</p>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8"><Printer className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
              </div>
            </div>

            {/* Profile header */}
            <div className="px-5 py-5 border-b border-border bg-muted/20 shrink-0">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16 shrink-0">
                  <AvatarImage src={employee.avatar} />
                  <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">
                    {getInitials(employee.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold leading-tight">{employee.fullName}</h2>
                      <p className="text-sm text-muted-foreground">{employee.designation}</p>
                    </div>
                    <EmployeeStatusBadge status={employee.status} />
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]">{employee.employeeId}</span>
                    <span>·</span>
                    <span>{employee.department}</span>
                    <span>·</span>
                    <span>{employee.branch}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-0 border-b border-border px-5 shrink-0">
              {TABS.map(t => {
                const Icon = t.icon;
                return (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors",
                      tab === t.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}>
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-5">
              <AnimatePresence mode="wait">
                <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
                  {tab === "overview" && <OverviewTab emp={employee} />}
                  {tab === "payroll" && <PayrollTab emp={employee} />}
                  {tab === "documents" && <DocumentsTab emp={employee} />}
                  {tab === "leave" && <LeaveTab emp={employee} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

