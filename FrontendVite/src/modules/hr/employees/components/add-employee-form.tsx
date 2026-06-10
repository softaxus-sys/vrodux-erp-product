import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, User, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateEmployee } from "@/hooks/hr/use-hr";

const DEPARTMENTS = ["IT", "Finance", "HR", "Sales", "Operations", "Marketing", "Management", "Procurement", "Legal"];
const JOB_TITLES  = ["Software Engineer", "Senior Engineer", "Team Lead", "Manager", "Director", "VP", "Analyst", "Coordinator", "Specialist", "Executive", "Intern"];
const EMPLOYMENT_TYPES = ["Full-Time", "Part-Time", "Contract", "Internship", "Probation"];
const NATIONALITIES   = ["UAE", "Indian", "Pakistani", "Filipino", "Egyptian", "Jordanian", "British", "American", "Other"];

interface AddEmployeeFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddEmployeeForm({ open, onClose, onSuccess }: AddEmployeeFormProps) {
  const createEmployee = useCreateEmployee();

  const [firstName, setFirstName]           = React.useState("");
  const [lastName, setLastName]             = React.useState("");
  const [email, setEmail]                   = React.useState("");
  const [phone, setPhone]                   = React.useState("");
  const [department, setDepartment]         = React.useState("");
  const [jobTitle, setJobTitle]             = React.useState("");
  const [employmentType, setEmploymentType] = React.useState("Full-Time");
  const [startDate, setStartDate]           = React.useState("");
  const [salary, setSalary]                 = React.useState("");
  const [nationality, setNationality]       = React.useState("");
  const [emiratesId, setEmiratesId]         = React.useState("");
  const [passportNo, setPassportNo]         = React.useState("");
  const [visaExpiry, setVisaExpiry]         = React.useState("");
  const [reportingTo, setReportingTo]       = React.useState("");
  const [notes, setNotes]                   = React.useState("");
  const [apiError, setApiError]             = React.useState<string | null>(null);

  const isValid = firstName.trim() && lastName.trim() && email.trim() && department && jobTitle && startDate;

  const reset = () => {
    setFirstName(""); setLastName(""); setEmail(""); setPhone("");
    setDepartment(""); setJobTitle(""); setEmploymentType("Full-Time");
    setStartDate(""); setSalary(""); setNationality(""); setEmiratesId("");
    setPassportNo(""); setVisaExpiry(""); setReportingTo(""); setNotes("");
    setApiError(null);
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  const handleSubmit = () => {
    if (!isValid) return;
    setApiError(null);
    createEmployee.mutate(
      {
        firstName:      firstName.trim(),
        lastName:       lastName.trim(),
        email:          email.trim(),
        phone:          phone.trim() || undefined,
        jobTitle:       jobTitle || undefined,
        departmentName: department || undefined,
        employmentType,
        basicSalary:    salary ? parseFloat(salary) : 0,
        joiningDate:    startDate,
        notes:          notes.trim() || undefined,
      },
      {
        onSuccess: () => { reset(); onSuccess?.(); onClose(); },
        onError:   (err: Error) => setApiError(err.message),
      }
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">New Employee</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Add a new employee to the system</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* API Error */}
              {apiError && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {apiError}
                </div>
              )}

              {/* Avatar upload */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-muted/40 border-2 border-dashed border-border flex items-center justify-center">
                  <User className="w-7 h-7 text-muted-foreground" />
                </div>
                <div>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border hover:border-primary/40 hover:text-primary transition-colors text-muted-foreground">
                    <Upload className="w-3 h-3" /> Upload Photo
                  </button>
                  <p className="text-[11px] text-muted-foreground mt-1">JPG or PNG, max 2MB</p>
                </div>
              </div>

              {/* Personal Info */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Personal Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">First Name *</label>
                    <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="John" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Last Name *</label>
                    <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email *</label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john.smith@company.com" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+971 50 000 0000" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nationality</label>
                    <select value={nationality} onChange={e => setNationality(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">Select…</option>
                      {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Job Info */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Job Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Department *</label>
                    <select value={department} onChange={e => setDepartment(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">Select…</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Job Title *</label>
                    <select value={jobTitle} onChange={e => setJobTitle(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">Select…</option>
                      {JOB_TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Employment Type</label>
                    <select value={employmentType} onChange={e => setEmploymentType(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Start Date *</label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Basic Salary (AED)</label>
                    <Input type="number" min={0} step={100} value={salary} onChange={e => setSalary(e.target.value)} placeholder="0.00" className="h-9 text-sm text-right" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reporting To</label>
                    <Input value={reportingTo} onChange={e => setReportingTo(e.target.value)} placeholder="Manager name…" className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Documents & Compliance</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Emirates ID</label>
                    <Input value={emiratesId} onChange={e => setEmiratesId(e.target.value)} placeholder="784-XXXX-XXXXXXX-X" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Passport No.</label>
                    <Input value={passportNo} onChange={e => setPassportNo(e.target.value)} placeholder="A12345678" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Visa Expiry</label>
                    <Input type="date" value={visaExpiry} onChange={e => setVisaExpiry(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Offer letter details, onboarding notes…" rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose} disabled={createEmployee.isPending}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!isValid || createEmployee.isPending}>
                {createEmployee.isPending ? "Saving…" : "Save Employee"}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

