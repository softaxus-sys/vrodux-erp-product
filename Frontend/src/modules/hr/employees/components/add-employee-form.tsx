"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateEmployee } from "@/hooks/hr/use-employees";
import { useDepartments } from "@/hooks/hr/use-departments";

const JOB_TITLES = [
  "Software Engineer", "Senior Engineer", "Team Lead", "Manager", "Director",
  "VP", "Analyst", "Coordinator", "Specialist", "Executive", "Intern",
];
const EMPLOYMENT_TYPES = ["full-time", "part-time", "contract", "internship", "probation"];

interface AddEmployeeFormProps {
  open: boolean;
  onClose: () => void;
}

export function AddEmployeeForm({ open, onClose }: AddEmployeeFormProps) {
  const { data: departments = [] } = useDepartments({ isActive: true });
  const createEmployee = useCreateEmployee();

  const [firstName, setFirstName]           = React.useState("");
  const [lastName, setLastName]             = React.useState("");
  const [email, setEmail]                   = React.useState("");
  const [phone, setPhone]                   = React.useState("");
  const [departmentId, setDepartmentId]     = React.useState("");
  const [jobTitle, setJobTitle]             = React.useState("");
  const [employmentType, setEmploymentType] = React.useState("full-time");
  const [joiningDate, setJoiningDate]       = React.useState("");
  const [basicSalary, setBasicSalary]       = React.useState("");
  const [notes, setNotes]                   = React.useState("");

  const isValid = firstName.trim() && lastName.trim() && email.trim() && joiningDate && employmentType;

  const reset = () => {
    setFirstName(""); setLastName(""); setEmail(""); setPhone("");
    setDepartmentId(""); setJobTitle(""); setEmploymentType("full-time");
    setJoiningDate(""); setBasicSalary(""); setNotes("");
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  const handleSave = async () => {
    if (!isValid) return;
    const dept = departments.find(d => d.id === departmentId);
    await createEmployee.mutateAsync({
      firstName,
      lastName,
      email,
      phone: phone || null,
      jobTitle: jobTitle || null,
      departmentId: departmentId || null,
      departmentName: dept?.name ?? null,
      employmentType,
      basicSalary: parseFloat(basicSalary) || 0,
      joiningDate,
      notes: notes || null,
    });
    onClose();
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
                </div>
              </div>

              {/* Job Info */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Job Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Department</label>
                    <select
                      value={departmentId}
                      onChange={e => setDepartmentId(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">— None —</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Job Title</label>
                    <select
                      value={jobTitle}
                      onChange={e => setJobTitle(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">— Select —</option>
                      {JOB_TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Employment Type *</label>
                    <select
                      value={employmentType}
                      onChange={e => setEmploymentType(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {EMPLOYMENT_TYPES.map(t => <option key={t} value={t} className="capitalize">{t.replace("-", " ")}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Joining Date *</label>
                    <Input type="date" value={joiningDate} onChange={e => setJoiningDate(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Basic Salary (AED)</label>
                    <Input
                      type="number" min={0} step={100}
                      value={basicSalary}
                      onChange={e => setBasicSalary(e.target.value)}
                      placeholder="0.00"
                      className="h-9 text-sm text-right"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Offer letter details, onboarding notes…"
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={!isValid || createEmployee.isPending}
              >
                {createEmployee.isPending ? "Saving…" : "Save Employee"}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
