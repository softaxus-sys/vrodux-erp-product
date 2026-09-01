import * as React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Mail, Phone, MapPin, Calendar, Building2, CreditCard,
  FileText, Shield, Award, AlertTriangle, CheckCircle2, Clock, Download, Trash2,
  Edit, Printer, ChevronRight, User, Briefcase, Banknote,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/auth/can";
import { EmployeeStatusBadge } from "./employee-status-badge";
import { formatDate, formatCurrency, formatFileSize, getInitials, cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import {
  useEmployeePayslips, useLeaveRequests, useEmployeeLeaveBalances, useEmployee,
  useEmployeeDocuments, useUploadEmployeeDocument, useDeleteEmployeeDocument,
} from "@/hooks/hr/use-hr";
import {
  employeeDocumentsApi, EMPLOYEE_DOCUMENT_TYPES, EXPIRING_DOCUMENT_TYPES,
  type EmployeeDocumentDto,
} from "@/lib/hr/employee-documents.api";
import { useCan } from "@/components/auth/can";
import { LinkedAccountPanel } from "./linked-account-panel";
import { exportPdf } from "@/lib/pdf";
import type { EmployeeDto as Employee } from "@/lib/hr/hr.api";

type Tab = "overview" | "documents" | "payroll" | "leave";

const TABS: { id: Tab; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", icon: User },
  { id: "payroll", icon: Banknote },
  { id: "documents", icon: FileText },
  { id: "leave", icon: Calendar },
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
  const { t } = useTranslation("hr");
  return (
    <div className="space-y-6">
      {/* Personal */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t("employees.drawer.personalInformation")}</h3>
        <div className="bg-muted/30 rounded-xl p-4 space-y-0">
          <InfoRow icon={Mail} label={t("employees.drawer.email")} value={<a href={`mailto:${emp.email}`} className="text-primary hover:underline">{emp.email}</a>} />
          {emp.mobile    && <InfoRow icon={Phone}    label={t("employees.drawer.mobile")}       value={emp.mobile} />}
          {emp.phone     && <InfoRow icon={Phone}    label={t("employees.drawer.office")}       value={emp.phone} />}
          {emp.dateOfBirth && <InfoRow icon={Calendar} label={t("employees.drawer.dateOfBirth")} value={formatDate(emp.dateOfBirth, "medium")} />}
          {emp.gender    && <InfoRow icon={User}     label={t("employees.drawer.gender")}       value={<span className="capitalize">{emp.gender}</span>} />}
          {emp.nationality && <InfoRow icon={Shield}  label={t("employees.drawer.nationality")}  value={emp.nationality} />}
          {emp.address   && <InfoRow icon={MapPin}   label={t("employees.drawer.address")}      value={emp.address} />}
        </div>
      </div>

      {/* Employment */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t("employees.drawer.employmentDetails")}</h3>
        <div className="bg-muted/30 rounded-xl p-4 space-y-0">
          <InfoRow icon={Building2} label={t("employees.drawer.department")}  value={emp.department  ?? "—"} />
          <InfoRow icon={Briefcase} label={t("employees.drawer.designation")} value={emp.designation ?? "—"} />
          {emp.reportingTo && <InfoRow icon={User}   label={t("employees.drawer.reportsTo")} value={emp.reportingTo} />}
          {emp.branch      && <InfoRow icon={MapPin} label={t("employees.drawer.branch")}    value={emp.branch} />}
          <InfoRow icon={Calendar} label={t("employees.drawer.joinDate")} value={formatDate(emp.joinDate, "medium")} />
          <InfoRow icon={FileText} label={t("employees.drawer.contractType")} value={<span className="capitalize">{emp.contractType?.replace("_", " ") ?? "—"}</span>} />
          {emp.visaExpiry && <InfoRow icon={Calendar} label={t("employees.drawer.visaExpiry")} value={formatDate(emp.visaExpiry, "medium")} />}
        </div>
      </div>

      {/* Skills */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t("employees.drawer.skills")}</h3>
        <div className="flex flex-wrap gap-2">
          {(emp.skills ?? []).map(skill => (
            <span key={skill} className="px-2.5 py-1 rounded-full bg-primary/8 text-primary text-xs font-medium border border-primary/20">
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Login account — a User is a login, an Employee is a job; the link is explicit. */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t("employees.drawer.loginAccount")}</h3>
        <LinkedAccountPanel emp={emp} />
      </div>

      {/* Emergency Contact */}
      {emp.emergencyContact && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t("employees.drawer.emergencyContact")}</h3>
          <div className="bg-muted/30 rounded-xl p-4 space-y-0">
            <InfoRow icon={User} label={t("employees.drawer.name")} value={emp.emergencyContact.name ?? "—"} />
            <InfoRow icon={User} label={t("employees.drawer.relation")} value={emp.emergencyContact.relation ?? "—"} />
            <InfoRow icon={Phone} label={t("employees.drawer.phone")} value={emp.emergencyContact.phone ?? "—"} />
          </div>
        </div>
      )}
    </div>
  );
}

function PayrollTab({ emp }: { emp: Employee }) {
  const { t } = useTranslation("hr");
  const currency = useCurrency();
  // The drawer shows the most recent six; asking the server for six is what keeps a long
  // employment history off the wire, rather than fetching all of them and slicing.
  const { data: payslipPage, isLoading } = useEmployeePayslips(emp.id, { pageSize: 6 });
  const payslips = payslipPage?.items ?? [];

  // Allowances and deductions are not stored on the employee record — they are entered
  // per payroll run. So the structure below reports the latest issued payslip rather than
  // inventing a percentage split of the basic salary.
  const latest = payslips?.[0];
  const grossSalary = latest ? latest.basicSalary + latest.allowances : emp.basicSalary;

  return (
    <div className="space-y-6">
      {/* Salary breakdown */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t("employees.drawer.salaryStructure")}</h3>
        <div className="bg-muted/30 rounded-xl p-4 space-y-0">
          <InfoRow icon={Banknote} label={t("employees.drawer.basicSalary")} value={<span className="font-bold">{formatCurrency(emp.basicSalary, currency)}</span>} />
          {latest ? (
            <>
              <InfoRow icon={CreditCard} label={t("employees.drawer.allowances")} value={formatCurrency(latest.allowances, currency)} />
              <InfoRow icon={CreditCard} label={t("employees.drawer.deductions")} value={formatCurrency(latest.deductions, currency)} />
              <div className="flex justify-between items-center pt-2 mt-1 border-t border-border">
                <span className="text-sm font-bold">{t("employees.drawer.grossSalary")}</span>
                <span className="text-sm font-bold text-primary">{formatCurrency(grossSalary, currency)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground pt-2">{t("employees.drawer.fromLatestPayslip", { period: latest.period })}</p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground pt-2">{t("employees.drawer.noAllowanceData")}</p>
          )}
        </div>
      </div>

      {/* Bank details */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t("employees.drawer.bankDetails")}</h3>
        <div className="bg-muted/30 rounded-xl p-4 space-y-0">
          <InfoRow icon={Building2} label={t("employees.drawer.bank")} value={emp.bankAccount ?? t("employees.drawer.notProvided")} />
          <InfoRow icon={CreditCard} label={t("employees.drawer.iban")} value={emp.iban ?? t("employees.drawer.notProvided")} />
          <InfoRow icon={Shield} label={t("employees.drawer.insurance")} value={emp.medicalInsurance ?? t("employees.drawer.notProvided")} />
        </div>
      </div>

      {/* Payroll history — processed/paid runs only */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t("employees.drawer.recentPayslips")}</h3>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">{t("employees.drawer.loadingPayslips")}</p>
        ) : !payslips.length ? (
          <p className="text-xs text-muted-foreground">{t("employees.drawer.noPayslips")}</p>
        ) : (
          <div className="space-y-2">
            {payslips.map(slip => (
              <div key={slip.slipId} className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t("employees.drawer.payslip", { month: slip.period })}</p>
                    <p className="text-xs text-muted-foreground">
                      {slip.runStatus === "paid"
                        ? t("employees.drawer.paidOn", { date: formatDate(slip.paidAt) })
                        : t("employees.drawer.processedOn", { date: formatDate(slip.processedAt) })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{formatCurrency(slip.netSalary, currency)}</span>
                  {slip.runStatus === "paid"
                    ? <CheckCircle2 className="h-4 w-4 text-success" />
                    : <Clock className="h-4 w-4 text-warning" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentsTab({ emp }: { emp: Employee }) {
  const { t } = useTranslation("hr");
  const { data: documents, isLoading } = useEmployeeDocuments(emp.id);
  const upload = useUploadEmployeeDocument();
  const remove = useDeleteEmployeeDocument();
  const canEdit   = useCan("hr.employees.edit");
  const canDelete = useCan("hr.employees.delete");

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [docType, setDocType] = React.useState<string>("passport");
  const [expiry, setExpiry]   = React.useState("");
  const [pendingDelete, setPendingDelete] = React.useState<EmployeeDocumentDto | null>(null);

  const daysUntil = (date?: string | null) => {
    if (!date) return null;
    const diff = new Date(date).getTime() - Date.now();
    return Number.isNaN(diff) ? null : Math.ceil(diff / 86_400_000);
  };

  const handlePick = (file: File | undefined) => {
    if (!file) return;
    upload.mutate(
      { employeeId: emp.id, file, documentType: docType, expiryDate: expiry || undefined },
      { onSuccess: () => setExpiry("") }
    );
  };

  // Identifiers held on the employee record. Kept alongside the attachments because a number and
  // a scan are different things: HR needs the number to hand, and the file as proof.
  const identifiers = [
    { key: "emiratesId", label: t("employees.drawer.emiratesId"), value: emp.emiratesId },
    { key: "passport",   label: t("employees.drawer.passportNo"), value: emp.passportNumber },
    { key: "visa",       label: t("employees.drawer.visaExpiry"),
      value: emp.visaExpiry ? formatDate(emp.visaExpiry, "medium") : undefined },
  ];

  return (
    <div className="space-y-6">
      {/* Attachments */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{t("employees.drawer.attachments")}</h3>
          {canEdit && (
            <div className="flex items-center gap-1.5">
              <select value={docType} onChange={e => setDocType(e.target.value)}
                className="h-7 px-2 rounded-lg border border-border bg-card text-[11px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                {EMPLOYEE_DOCUMENT_TYPES.map(dt => (
                  <option key={dt} value={dt}>{t("employees.drawer.docType." + dt, { defaultValue: dt })}</option>
                ))}
              </select>
              {EXPIRING_DOCUMENT_TYPES.has(docType) && (
                <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)}
                  title={t("employees.drawer.expiryOptional")}
                  className="h-7 px-2 rounded-lg border border-border bg-card text-[11px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
              )}
              <input ref={fileInputRef} type="file" className="hidden"
                onChange={e => { handlePick(e.target.files?.[0]); e.target.value = ""; }} />
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5"
                onClick={() => fileInputRef.current?.click()} disabled={upload.isPending}>
                <FileText className="h-3 w-3" />
                {upload.isPending ? t("employees.drawer.uploading") : t("employees.drawer.upload")}
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <p className="text-xs text-muted-foreground">{t("employees.drawer.loadingDocuments")}</p>
        ) : !documents?.length ? (
          <p className="text-xs text-muted-foreground">{t("employees.drawer.noDocuments")}</p>
        ) : (
          <div className="space-y-2.5">
            {documents.map((doc, i) => {
              const left   = daysUntil(doc.expiryDate);
              const status = left === null ? "none" : left < 0 ? "expired" : left <= 60 ? "expiring" : "valid";
              const cfg = {
                valid:    { icon: CheckCircle2,  className: "text-success",          label: t("employees.drawer.docStatus.valid"),    box: "border-border/50",                      tint: "bg-success/10" },
                expiring: { icon: Clock,         className: "text-warning",          label: t("employees.drawer.docStatus.expiring"), box: "border-warning/30 bg-warning/5",         tint: "bg-warning/10" },
                expired:  { icon: AlertTriangle, className: "text-destructive",      label: t("employees.drawer.docStatus.expired"),  box: "border-destructive/30 bg-destructive/5", tint: "bg-destructive/10" },
                none:     { icon: FileText,      className: "text-muted-foreground", label: "",                                      box: "border-border/50",                      tint: "bg-muted" },
              }[status];
              const Icon = cfg.icon;
              return (
                <motion.div key={doc.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <div className={cn("flex items-center gap-3 p-3.5 rounded-xl border", cfg.box)}>
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", cfg.tint)}>
                      <FileText className={cn("h-4 w-4", cfg.className)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.fileName}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {t("employees.drawer.docType." + doc.documentType, { defaultValue: doc.documentType })}
                        </span>
                        <span className="text-muted-foreground/40 text-xs">·</span>
                        <span className="text-xs text-muted-foreground">{formatFileSize(doc.sizeBytes)}</span>
                        {doc.expiryDate && (
                          <>
                            <span className="text-muted-foreground/40 text-xs">·</span>
                            <span className="text-xs text-muted-foreground">
                              {t("employees.drawer.expires", { date: formatDate(doc.expiryDate, "medium") })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {status !== "none" && (
                        <span className={cn("text-[11px] font-semibold flex items-center gap-1", cfg.className)}>
                          <Icon className="h-3 w-3" /> {cfg.label}
                        </span>
                      )}
                      <button type="button" onClick={() => employeeDocumentsApi.download(doc)}
                        title={t("employees.drawer.download")}
                        className="text-muted-foreground hover:text-primary transition-colors">
                        <Download className="h-4 w-4" />
                      </button>
                      {canDelete && (
                        <button type="button" onClick={() => setPendingDelete(doc)}
                          title={t("employees.drawer.deleteDocument")}
                          className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Identifiers stored on the employee record */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t("employees.drawer.identityNumbers")}</h3>
        <div className="bg-muted/30 rounded-xl p-4 space-y-0">
          {identifiers.map(item => (
            <InfoRow key={item.key} icon={Shield} label={item.label}
              value={<span className="font-mono text-xs">{item.value || t("employees.drawer.notProvided")}</span>} />
          ))}
        </div>
      </div>

      {/* Delete confirmation — never window.confirm */}
      <AnimatePresence>
        {pendingDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
            <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }} exit={{ scale: 0.96 }}
              className="bg-card border border-border rounded-2xl shadow-2xl p-5 w-full max-w-sm">
              <p className="font-semibold text-sm">{t("employees.drawer.deleteDocumentTitle")}</p>
              <p className="text-xs text-muted-foreground mt-1 break-all">{pendingDelete.fileName}</p>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => setPendingDelete(null)}>
                  {t("employees.drawer.cancel")}
                </Button>
                <Button variant="destructive" size="sm" disabled={remove.isPending}
                  onClick={() => {
                    remove.mutate({ employeeId: emp.id, documentId: pendingDelete.id });
                    setPendingDelete(null);
                  }}>
                  {t("employees.drawer.deleteDocument")}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Falls back to a readable label for tenant-created types like "home leave". */
function titleCaseType(v: string): string {
  return v.replace(/[_-]+/g, " ").replace(/w/g, c => c.toUpperCase());
}

function LeaveTab({ emp }: { emp: Employee }) {
  const { t } = useTranslation("hr");
  // Requests are fetched for this employee only — the list used to be a hardcoded sample.
  const { data: leaves, isLoading } = useLeaveRequests(emp.id);
  // Entitlement comes from the tenant's leave policy and usage from this employee's own
  // requests — both server-side. Nothing here is a fixed 30/15 assumption any more.
  const CURRENT_YEAR = new Date().getFullYear();
  const [year, setYear] = React.useState(CURRENT_YEAR);
  // Current year plus the two before it — enough to answer "what did they take last year?"
  // without inventing a range that predates the tenant.
  const yearOptions = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];
  const { data: balances, isLoading: isBalancesLoading } = useEmployeeLeaveBalances(emp.id, year);

  // Types the employee has actually used come first — an untouched entitlement is the least
  // interesting row on the screen.
  const orderedBalances = React.useMemo(() => {
    const used = (b: { usedDays: number; pendingDays: number }) => b.usedDays + b.pendingDays;
    return [...(balances ?? [])].sort((x, y2) =>
      (used(y2) > 0 ? 1 : 0) - (used(x) > 0 ? 1 : 0) ||
      used(y2) - used(x) ||
      y2.entitlementDays - x.entitlementDays);
  }, [balances]);

  const barColor = (leaveType: string) =>
    leaveType === "annual" ? "bg-primary" : leaveType === "sick" ? "bg-warning" : "bg-info";

  const statusClass: Record<string, string> = {
    approved:  "text-success bg-success/10",
    pending:   "text-warning bg-warning/10",
    rejected:  "text-destructive bg-destructive/10",
    cancelled: "text-muted-foreground bg-muted",
  };

  return (
    <div className="space-y-6">
      {/* Balances */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{t("employees.drawer.leaveBalances")}</h3>
          {/* Balances are per calendar year, so the year has to be selectable — otherwise last
              year's usage is unreachable the moment January arrives. */}
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="h-7 px-2 rounded-lg border border-border bg-card text-[11px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {isBalancesLoading ? (
          <p className="text-xs text-muted-foreground">{t("employees.drawer.loadingBalances")}</p>
        ) : !balances?.length ? (
          <p className="text-xs text-muted-foreground">{t("employees.drawer.noLeavePolicies")}</p>
        ) : (
          <div className="space-y-3">
            {orderedBalances.map(b => {
              // A policy with no fixed entitlement (unpaid, or a custom type added at 0 days) is
              // still real — it is approved case by case. Hiding it made a policy the tenant had
              // just created look like it had not saved.
              const hasEntitlement = b.entitlementDays > 0;
              const used = b.usedDays + b.pendingDays;
              return (
                <div key={b.leaveType} className="bg-muted/30 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-medium truncate">{t(`leaveType.${b.leaveType}`, { defaultValue: titleCaseType(b.leaveType) })}</p>
                      {!b.isPaid && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                          {t("leaves.policies.unpaid")}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold shrink-0">
                      {hasEntitlement ? (
                        <>
                          <span className="text-foreground">{b.remainingDays}</span>
                          <span className="text-muted-foreground font-normal"> {t("employees.drawer.daysOf", { total: b.entitlementDays })}</span>
                        </>
                      ) : (
                        <span className="text-xs font-normal text-muted-foreground">{t("employees.drawer.noFixedEntitlement")}</span>
                      )}
                    </p>
                  </div>

                  {hasEntitlement && (
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", barColor(b.leaveType))}
                        style={{ width: `${Math.min((b.remainingDays / b.entitlementDays) * 100, 100)}%` }}
                      />
                    </div>
                  )}

                  <p className={cn("text-[11px] mt-2", used > 0 ? "text-foreground" : "text-muted-foreground")}>
                    {t("employees.drawer.leaveUsage", { used: b.usedDays, pending: b.pendingDays, year: b.year })}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent requests */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t("employees.drawer.recentLeaveHistory")}</h3>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">{t("employees.drawer.loadingLeaves")}</p>
        ) : !leaves?.length ? (
          <p className="text-xs text-muted-foreground">{t("employees.drawer.noLeaves")}</p>
        ) : (
          <div className="space-y-2">
            {leaves.slice(0, 8).map(l => (
              <div key={l.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t(`leaveType.${l.leaveType}`, { defaultValue: l.leaveType })}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(l.fromDate, "medium")} – {formatDate(l.toDate, "medium")} · {t("employees.drawer.days", { count: l.days })}
                  </p>
                </div>
                <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0", statusClass[l.status] ?? "text-muted-foreground bg-muted")}>
                  {t(`leaveStatus.${l.status}`, { defaultValue: l.status })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface DrawerProps { open: boolean; onClose: () => void; employee: Employee | null; onEdit?: (employee: Employee) => void; }

export function EmployeeDrawer({ open, onClose, employee: listRow, onEdit }: DrawerProps) {
  const { t } = useTranslation("hr");
  const currency = useCurrency();
  const [tab, setTab] = React.useState<Tab>("overview");

  // The list row is a 6-field summary, so the profile loads the full record and falls back to
  // the summary until it arrives (avoids a flash of empty contact/compliance rows).
  const { data: fullRecord } = useEmployee(open && listRow ? listRow.id : null);
  const employee = fullRecord ?? listRow;

  // Prints the profile as a two-column fact sheet through the shared PDF helper.
  const printProfile = () => {
    if (!employee) return;
    exportPdf({
      title:    employee.fullName,
      subtitle: [employee.designation, employee.department, employee.employeeId].filter(Boolean).join(" · "),
      columns:  [t("employees.drawer.field"), t("employees.drawer.value")],
      rows: [
        [t("employees.drawer.employeeId"),   employee.employeeId],
        [t("employees.drawer.email"),        employee.email],
        [t("employees.drawer.phone"),        employee.phone || "—"],
        [t("employees.drawer.nationality"),  employee.nationality || "—"],
        [t("employees.drawer.department"),   employee.department || "—"],
        [t("employees.drawer.designation"),  employee.designation || "—"],
        [t("employees.drawer.contractType"), employee.contractType],
        [t("employees.drawer.status"),       employee.status],
        [t("employees.drawer.joinDate"),     formatDate(employee.joinDate, "medium")],
        [t("employees.drawer.reportsTo"),    employee.reportingTo || "—"],
        [t("employees.drawer.basicSalary"),  formatCurrency(employee.basicSalary, currency)],
        [t("employees.drawer.bank"),         employee.bankAccount || "—"],
        [t("employees.drawer.iban"),         employee.iban || "—"],
        [t("employees.drawer.emiratesId"),   employee.emiratesId || "—"],
        [t("employees.drawer.passportNo"),   employee.passportNumber || "—"],
        [t("employees.drawer.visaExpiry"),   employee.visaExpiry ? formatDate(employee.visaExpiry, "medium") : "—"],
      ],
    });
  };

  // Reset tab when new employee selected
  React.useEffect(() => { if (listRow) setTab("overview"); }, [listRow?.id]);

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
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t("employees.drawer.profile")}</p>
              <div className="flex items-center gap-1">
                <Can permission="hr.employees.edit">
                  <Button variant="ghost" size="icon" className="h-8 w-8"
                    onClick={() => onEdit?.(employee)}><Edit className="h-3.5 w-3.5" /></Button>
                </Can>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={printProfile}
                  title={t("employees.drawer.printProfile")}><Printer className="h-3.5 w-3.5" /></Button>
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
              {TABS.map(tb => {
                const Icon = tb.icon;
                return (
                  <button key={tb.id} onClick={() => setTab(tb.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors",
                      tab === tb.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}>
                    <Icon className="h-3.5 w-3.5" />
                    {t(`employees.drawer.tab.${tb.id}`)}
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

