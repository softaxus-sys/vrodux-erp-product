import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, User, AlertCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrency } from "@/hooks/use-currency";
import {
  useCreateEmployee, useUpdateEmployee, useEmployees, useEmployee, useDepartments, useCreateDepartment,
} from "@/hooks/hr/use-hr";
import type { EmployeeDto } from "@/lib/hr/hr.api";

const CONTRACT_TO_EMPLOYMENT: Record<string, string> = {
  full_time: "Full-Time", part_time: "Part-Time", contract: "Contract", intern: "Internship",
};

const DEFAULT_JOB_TITLES = ["Software Engineer", "Senior Engineer", "Team Lead", "Manager", "Director", "VP", "Analyst", "Coordinator", "Specialist", "Executive", "Intern"];
const EMPLOYMENT_TYPES = ["Full-Time", "Part-Time", "Contract", "Internship", "Probation"];
const NATIONALITIES   = ["UAE", "Indian", "Pakistani", "Filipino", "Egyptian", "Jordanian", "British", "American", "Other"];

/**
 * Ensures the currently-stored value is always offered. A <select> whose value is absent from
 * its options renders blank — which reads as "nothing saved" and, worse, saves as empty.
 */
function withCurrent(options: string[], current: string): string[] {
  const has = options.some(o => o.toLowerCase() === current.toLowerCase());
  return current && !has ? [current, ...options] : options;
}

interface AddEmployeeFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** When set the drawer edits this employee instead of creating a new one. */
  editing?: EmployeeDto | null;
}

export function AddEmployeeForm({ open, onClose, onSuccess, editing }: AddEmployeeFormProps) {
  const { t } = useTranslation("hr");
  const currency = useCurrency();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee(editing?.id ?? "");
  // The list row is only a 6-field summary (no email, phone, first/last name, join date or
  // compliance fields), so the form loads the full record before prefilling.
  const { data: fullRecord, isLoading: loadingRecord } = useEmployee(open && editing ? editing.id : null);
  const isEditing = !!editing;
  const saving = createEmployee.isPending || updateEmployee.isPending;
  const { data: employees } = useEmployees();
  const { data: departments } = useDepartments();
  const createDepartment = useCreateDepartment();
  const [newDepartment, setNewDepartment] = React.useState<string | null>(null);   // null = picker mode

  /** Creates the department for real (it is a record, not a free-text label) and selects it. */
  const saveNewDepartment = () => {
    const name = (newDepartment ?? "").trim();
    if (!name) return;
    createDepartment.mutate({ name }, {
      onSuccess: created => { setDepartment(created.name); setNewDepartment(null); },
    });
  };

  const [firstName, setFirstName]           = React.useState("");
  const [lastName, setLastName]             = React.useState("");
  const [email, setEmail]                   = React.useState("");
  const [phone, setPhone]                   = React.useState("");
  const [department, setDepartment]         = React.useState("");
  const [jobTitle, setJobTitle]             = React.useState("");
  const [customJobTitle, setCustomJobTitle] = React.useState(false);
  const [employmentType, setEmploymentType] = React.useState("Full-Time");
  const [startDate, setStartDate]           = React.useState("");
  const [salary, setSalary]                 = React.useState("");
  const [nationality, setNationality]       = React.useState("");
  const [emiratesId, setEmiratesId]         = React.useState("");
  const [passportNo, setPassportNo]         = React.useState("");
  const [visaExpiry, setVisaExpiry]         = React.useState("");
  const [reportingTo, setReportingTo]       = React.useState("");
  const [notes, setNotes]                   = React.useState("");
  const [bankAccount, setBankAccount]       = React.useState("");
  const [iban, setIban]                     = React.useState("");
  // Both are required by the UAE salary file and cannot be derived from anything already held.
  const [labourCard, setLabourCard]         = React.useState("");
  const [routingCode, setRoutingCode]       = React.useState("");
  const [insurance, setInsurance]           = React.useState("");
  const [apiError, setApiError]             = React.useState<string | null>(null);
  const [photo, setPhoto]                   = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
  const PHOTO_MAX_EDGE  = 512;

  /**
   * Downscales to a 512px square-ish JPEG before upload. The photo travels inside the employee
   * JSON, so a 2 MB original would be carried on every read of that employee; this keeps it to
   * a few tens of KB. Falls back to the original if the browser cannot decode it.
   */
  const downscale = (dataUrl: string): Promise<string> =>
    new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(dataUrl); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });

  const handlePhotoPick = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setApiError(t("employees.form.photoTypeError")); return; }
    if (file.size > MAX_PHOTO_BYTES)    { setApiError(t("employees.form.photoSizeError")); return; }
    const reader = new FileReader();
    reader.onload  = async () => { setPhoto(await downscale(reader.result as string)); setApiError(null); };
    reader.onerror = () => setApiError(t("employees.form.photoReadError"));
    reader.readAsDataURL(file);
  };

  // Designations come from the defaults plus every job title already used by an
  // employee, so a title added here is reusable on the next employee with no backend change.
  const jobTitles = React.useMemo(() => {
    const used = (employees ?? []).map(e => (e.designation ?? "").trim()).filter(Boolean);
    return Array.from(new Set([...DEFAULT_JOB_TITLES, ...used])).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const departmentOptions = React.useMemo(
    () => withCurrent((departments ?? []).map(d => d.name).filter(Boolean), department),
    [departments, department]
  );
  const nationalityOptions     = React.useMemo(() => withCurrent(NATIONALITIES, nationality), [nationality]);
  const employmentTypeOptions  = React.useMemo(() => withCurrent(EMPLOYMENT_TYPES, employmentType), [employmentType]);

  const isValid = firstName.trim() && lastName.trim() && email.trim() && department && jobTitle.trim() && startDate;

  const reset = () => {
    setFirstName(""); setLastName(""); setEmail(""); setPhone("");
    setDepartment(""); setJobTitle(""); setCustomJobTitle(false); setEmploymentType("Full-Time");
    setStartDate(""); setSalary(""); setNationality(""); setEmiratesId("");
    setPassportNo(""); setVisaExpiry(""); setReportingTo(""); setNotes(""); setPhoto(null); setNewDepartment(null);
    setBankAccount(""); setIban(""); setInsurance(""); setLabourCard(""); setRoutingCode("");
    setApiError(null);
  };

  React.useEffect(() => { if (!open) reset(); }, [open]);

  // Load the record being edited into the form each time the drawer opens on it.
  React.useEffect(() => {
    if (!open || !editing) return;
    const source = fullRecord ?? editing;   // fall back to the summary until the record arrives
    setFirstName(source.firstName ?? "");
    setLastName(source.lastName ?? "");
    setEmail(source.email ?? "");
    setPhone(source.phone ?? "");
    setDepartment(source.department ?? "");
    setJobTitle(source.designation ?? "");
    // A stored title that isn't in the dropdown must still be editable, so fall back to free text.
    setCustomJobTitle(!!source.designation && !DEFAULT_JOB_TITLES.includes(source.designation));
    setEmploymentType(CONTRACT_TO_EMPLOYMENT[source.contractType] ?? "Full-Time");
    setStartDate(source.joinDate ?? "");
    setSalary(source.basicSalary ? String(source.basicSalary) : "");
    setNationality(source.nationality ?? "");
    setEmiratesId(source.emiratesId ?? "");
    setPassportNo(source.passportNumber ?? "");
    setVisaExpiry(source.visaExpiry ?? "");
    setReportingTo(source.reportingTo ?? "");
    setBankAccount(source.bankAccount ?? "");
    setIban(source.iban ?? "");
    setLabourCard(source.labourCardNumber ?? "");
    setRoutingCode(source.bankRoutingCode ?? "");
    setInsurance(source.medicalInsurance ?? "");
    setPhoto(source.avatar ?? null);
    setApiError(null);
  }, [open, editing, fullRecord]);

  const handleSubmit = () => {
    if (!isValid) return;
    setApiError(null);
    const payload = {
        firstName:      firstName.trim(),
        lastName:       lastName.trim(),
        email:          email.trim(),
        phone:          phone.trim() || undefined,
        jobTitle:       jobTitle.trim() || undefined,
        departmentName: department || undefined,
        employmentType,
        basicSalary:    salary ? parseFloat(salary) : 0,
        joiningDate:    startDate,
        notes:          notes.trim() || undefined,
        avatarData:     photo ?? undefined,
        nationality:      nationality || undefined,
        emiratesId:       emiratesId.trim() || undefined,
        passportNumber:   passportNo.trim() || undefined,
        visaExpiry:       visaExpiry || undefined,
        reportingTo:      reportingTo.trim() || undefined,
        bankAccount:      bankAccount.trim() || undefined,
        iban:             iban.trim() || undefined,
        labourCardNumber: labourCard.trim() || undefined,
        bankRoutingCode:  routingCode.trim() || undefined,
        medicalInsurance: insurance.trim() || undefined,
    };
    const handlers = {
      onSuccess: () => { reset(); onSuccess?.(); onClose(); },
      onError:   (err: Error) => setApiError(err.message),
    };

    if (isEditing) updateEmployee.mutate({
      ...payload,
      status: fullRecord?.status ?? editing!.status,
      // Distinguish "no new photo" from "remove the photo" — the backend keeps the stored one
      // when avatarData is absent.
      removeAvatar: !photo && !!(fullRecord?.avatar ?? editing!.avatar),
    }, handlers);
    else           createEmployee.mutate(payload, handlers);
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
                <h2 className="text-base font-bold text-foreground">{isEditing ? t("employees.form.editTitle") : t("employees.form.title")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{isEditing ? t("employees.form.editSubtitle") : t("employees.form.subtitle")}</p>
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
                <div className="h-16 w-16 rounded-full overflow-hidden bg-muted/40 border-2 border-dashed border-border flex items-center justify-center">
                  {photo
                    ? <img src={photo} alt="" className="h-full w-full object-cover" />
                    : <User className="w-7 h-7 text-muted-foreground" />}
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={e => { handlePhotoPick(e.target.files?.[0]); e.target.value = ""; }}
                  />
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border hover:border-primary/40 hover:text-primary transition-colors text-muted-foreground">
                      <Upload className="w-3 h-3" /> {t("employees.form.uploadPhoto")}
                    </button>
                    {photo && (
                      <button type="button" onClick={() => setPhoto(null)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive transition-colors">
                        <Trash2 className="w-3 h-3" /> {t("employees.form.removePhoto")}
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{t("employees.form.photoHint")}</p>
                </div>
              </div>

              {/* Personal Info */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("employees.form.personalInformation")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("employees.form.firstName")}</label>
                    <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="John" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("employees.form.lastName")}</label>
                    <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("employees.form.email")}</label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john.smith@company.com" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("employees.form.phone")}</label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+971 50 000 0000" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("employees.form.nationality")}</label>
                    <select value={nationality} onChange={e => setNationality(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="">{t("employees.form.select")}</option>
                      {nationalityOptions.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Job Info */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("employees.form.jobInformation")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("employees.form.department")}</label>
                    {newDepartment !== null ? (
                      <div className="flex items-center gap-2">
                        <Input autoFocus value={newDepartment} onChange={e => setNewDepartment(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); saveNewDepartment(); } }}
                          placeholder={t("employees.form.newDepartmentPlaceholder")} className="h-9 text-sm" />
                        <Button type="button" size="sm" className="h-9 shrink-0"
                          onClick={saveNewDepartment}
                          disabled={!newDepartment.trim() || createDepartment.isPending}>
                          {createDepartment.isPending ? t("employees.form.saving") : t("employees.form.add")}
                        </Button>
                        <button type="button" onClick={() => setNewDepartment(null)}
                          className="shrink-0 text-xs text-muted-foreground hover:text-foreground">
                          {t("employees.form.cancel")}
                        </button>
                      </div>
                    ) : (
                      <select value={department}
                        onChange={e => {
                          if (e.target.value === "__add__") setNewDepartment("");
                          else setDepartment(e.target.value);
                        }}
                        className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                        <option value="">{t("employees.form.select")}</option>
                        {departmentOptions.map(d => <option key={d} value={d}>{d}</option>)}
                        <option value="__add__">{t("employees.form.addDepartment")}</option>
                      </select>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("employees.form.jobTitle")}</label>
                    {customJobTitle ? (
                      <div className="flex items-center gap-2">
                        <Input autoFocus value={jobTitle} onChange={e => setJobTitle(e.target.value)}
                          placeholder={t("employees.form.newJobTitlePlaceholder")} className="h-9 text-sm" />
                        <button type="button" onClick={() => { setCustomJobTitle(false); setJobTitle(""); }}
                          className="shrink-0 text-xs text-primary hover:underline">
                          {t("employees.form.backToList")}
                        </button>
                      </div>
                    ) : (
                      <select value={jobTitle}
                        onChange={e => {
                          if (e.target.value === "__add__") { setCustomJobTitle(true); setJobTitle(""); }
                          else setJobTitle(e.target.value);
                        }}
                        className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                        <option value="">{t("employees.form.select")}</option>
                        {jobTitles.map(jt => <option key={jt} value={jt}>{jt}</option>)}
                        <option value="__add__">{t("employees.form.addJobTitle")}</option>
                      </select>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("employees.form.employmentType")}</label>
                    <select value={employmentType} onChange={e => setEmploymentType(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {employmentTypeOptions.map(et => <option key={et} value={et}>{et}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("employees.form.startDate")}</label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("employees.form.basicSalary", { currency })}</label>
                    <Input type="number" min={0} step={100} value={salary} onChange={e => setSalary(e.target.value)} placeholder="0.00" className="h-9 text-sm text-right" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("employees.form.reportingTo")}</label>
                    <Input value={reportingTo} onChange={e => setReportingTo(e.target.value)} placeholder={t("employees.form.reportingToPlaceholder")} className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("employees.form.documentsCompliance")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("employees.form.emiratesId")}</label>
                    <Input value={emiratesId} onChange={e => setEmiratesId(e.target.value)} placeholder="784-XXXX-XXXXXXX-X" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("employees.form.passportNo")}</label>
                    <Input value={passportNo} onChange={e => setPassportNo(e.target.value)} placeholder="A12345678" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("employees.form.visaExpiry")}</label>
                    <Input type="date" value={visaExpiry} onChange={e => setVisaExpiry(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Bank & payroll — the IBAN feeds the WPS SIF export */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("employees.form.bankPayroll")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("employees.form.bankName")}</label>
                    <Input value={bankAccount} onChange={e => setBankAccount(e.target.value)} placeholder={t("employees.form.bankNamePlaceholder")} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("employees.form.iban")}</label>
                    <Input value={iban} onChange={e => setIban(e.target.value)} placeholder="AE07 0331 2345 6789 0123 456" className="h-9 text-sm" />
                  </div>
                  {/* Required by the UAE Wage Protection System. Neither is derivable: an IBAN
                      carries a 3-digit bank code, while WPS wants the agent's 9-digit routing
                      code, and MOHRE identifies the person by labour card, not by our employee
                      number. Without them the salary file rejects this employee. */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("employees.form.labourCard")}</label>
                    <Input value={labourCard} onChange={e => setLabourCard(e.target.value)}
                      placeholder="12345678901234" className="h-9 text-sm font-mono" />
                    <p className="text-[11px] text-muted-foreground">{t("employees.form.labourCardHint")}</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("employees.form.routingCode")}</label>
                    <Input value={routingCode} onChange={e => setRoutingCode(e.target.value)}
                      placeholder="123456789" className="h-9 text-sm font-mono" />
                    <p className="text-[11px] text-muted-foreground">{t("employees.form.routingCodeHint")}</p>
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("employees.form.insurance")}</label>
                    <Input value={insurance} onChange={e => setInsurance(e.target.value)} placeholder={t("employees.form.insurancePlaceholder")} className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("employees.form.notes")}</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder={t("employees.form.notesPlaceholder")} rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose} disabled={saving}>{t("employees.form.cancel")}</Button>
              <Button onClick={handleSubmit} disabled={!isValid || saving || loadingRecord}>
                {loadingRecord
                  ? t("employees.form.loadingRecord")
                  : saving ? t("employees.form.saving")
                  : isEditing ? t("employees.form.saveChanges")
                  : t("employees.form.saveEmployee")}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

