import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, X, Briefcase, Users, Clock,
  CheckCircle2, Star, MapPin, DollarSign, Calendar,
  Mail, Phone, Globe, ChevronRight, Award, MoreVertical, UserPlus,
  ExternalLink, FileDown
} from "lucide-react";
import { toast } from "sonner";
import i18n from "@/i18n";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import type { JobPostingDto as JobPosting, ApplicantDto as Applicant, ApplicantStage, JobStatus } from "@/lib/hr/hr.api";
import { useJobPostings, useApplicants, useRecruitmentSummary, useUpdateJobStatus, useUpdateApplicantStage } from "@/hooks/hr/use-hr";
import { hrApi } from "@/lib/hr/hr.api";
import { toCsv, downloadFile } from "@/lib/csv";
import { exportPdf } from "@/lib/pdf";
import { ExportMenu } from "@/components/ui/export-menu";
import { AddJobPostingForm } from "./add-job-posting-form";
import { AddApplicantForm } from "./add-applicant-form";
import { Can } from "@/components/auth/can";
import { useCurrency } from "@/hooks/use-currency";

const JOB_STATUS_CONFIG: Record<string, { key: string; color: string; bg: string }> = {
  open:     { key: "open",    color: "text-success",          bg: "bg-success/10" },
  closed:   { key: "closed",  color: "text-muted-foreground", bg: "bg-muted" },
  on_hold:  { key: "on_hold", color: "text-warning",          bg: "bg-warning/10" },
  draft:    { key: "draft",   color: "text-info",             bg: "bg-info/10" },
};
const JOB_STATUS_FALLBACK = { key: "unknown", color: "text-muted-foreground", bg: "bg-muted" };

const STAGE_CONFIG: Record<string, { key: string; color: string; bg: string }> = {
  applied:    { key: "applied",   color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50" },
  screening:  { key: "screening", color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20" },
  interview:  { key: "interview", color: "text-violet-600",  bg: "bg-violet-50 dark:bg-violet-900/20" },
  offer:      { key: "offer",     color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-900/20" },
  hired:      { key: "hired",     color: "text-success",     bg: "bg-success/10" },
  rejected:   { key: "rejected",  color: "text-destructive", bg: "bg-destructive/10" },
};
const STAGE_FALLBACK = { key: "unknown", color: "text-muted-foreground", bg: "bg-muted" };

const STAGE_ORDER: ApplicantStage[] = ["applied", "screening", "interview", "offer", "hired", "rejected"];

function RatingStars({ rating }: { rating?: number }) {
  if (!rating) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={cn("h-3 w-3", i <= rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30")} />
      ))}
    </div>
  );
}

async function downloadApplicantResume(applicant: Applicant) {
  const token = useAuthStore.getState().token;
  try {
    const res = await fetch(hrApi.getApplicantResumeUrl(applicant.id), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Failed to download resume.");

    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] ?? `${applicant.name}-resume`;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.error(i18n.t("recruitment.drawer.downloadFailed", { ns: "hr" }));
  }
}

function ApplicantDrawer({ applicant, open, onClose }: { applicant: Applicant | null; open: boolean; onClose: () => void }) {
  const { t } = useTranslation("hr");
  const updateStage = useUpdateApplicantStage();

  if (!applicant) return null;
  const sc = STAGE_CONFIG[applicant.stage] ?? STAGE_FALLBACK;

  const activeStages = STAGE_ORDER.filter(s => s !== "rejected");
  const currentIdx = activeStages.indexOf(applicant.stage as typeof activeStages[number]);
  const nextStage = currentIdx >= 0 && currentIdx < activeStages.length - 1 ? activeStages[currentIdx + 1] : null;
  const isFinal = applicant.stage === "hired" || applicant.stage === "rejected";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-background border-l border-border shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <p className="font-bold text-base">{t("recruitment.drawer.title")}</p>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Profile header */}
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">{getInitials(applicant.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-base">{applicant.name}</p>
                  <p className="text-sm text-muted-foreground">{applicant.currentRole} · {applicant.currentCompany}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Globe className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{applicant.nationality}</span>
                    <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>{t(`applicantStage.${sc.key}`)}</span>
                  </div>
                </div>
              </div>

              {/* Applied for */}
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl">
                <p className="text-xs text-primary font-semibold uppercase tracking-wide mb-1">{t("recruitment.drawer.appliedFor")}</p>
                <p className="text-sm font-medium">{applicant.jobTitle}</p>
              </div>

              {applicant.hasResume && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => downloadApplicantResume(applicant)}
                >
                  <FileDown className="h-3.5 w-3.5" />
                  {t("recruitment.drawer.downloadResume")}
                </Button>
              )}

              {/* Details */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("recruitment.drawer.contactDetails")}</h4>
                {[
                  { icon: Mail,     label: t("recruitment.drawer.email"),      value: applicant.email },
                  { icon: Phone,    label: t("recruitment.drawer.phone"),      value: applicant.phone },
                  { icon: Briefcase,label: t("recruitment.drawer.experience"), value: t("recruitment.drawer.years", { count: applicant.experience }) },
                  { icon: Calendar, label: t("recruitment.drawer.applied"),    value: formatDate(applicant.appliedDate, "medium") },
                  { icon: Globe,    label: t("recruitment.drawer.source"),     value: applicant.source },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-3 py-2 border-b border-border/40">
                    <row.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 flex justify-between">
                      <span className="text-xs text-muted-foreground">{row.label}</span>
                      <span className="text-sm font-medium text-right">{row.value}</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-3 py-2">
                  <Star className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">{t("recruitment.drawer.rating")}</span>
                    <RatingStars rating={applicant.rating} />
                  </div>
                </div>
              </div>

              {applicant.notes && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("recruitment.drawer.notes")}</h4>
                  <p className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-3 leading-relaxed">{applicant.notes}</p>
                </div>
              )}

              {/* Stage pipeline */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("recruitment.drawer.hiringPipeline")}</h4>
                <div className="flex items-center gap-1">
                  {STAGE_ORDER.filter(s => s !== "rejected").map((stage, i) => {
                    const idx = STAGE_ORDER.filter(s => s !== "rejected").indexOf(applicant.stage as "applied" | "screening" | "interview" | "offer" | "hired");
                    const isActive = stage === applicant.stage;
                    const isPast = i < idx;
                    return (
                      <div key={stage} className="flex-1 text-center">
                        <div className={cn("h-1.5 rounded-full mb-1.5", isPast ? "bg-primary" : isActive ? "bg-primary/70" : "bg-muted")} />
                        <p className={cn("text-[9px] font-medium", isActive ? "text-primary" : "text-muted-foreground")}>
                          {t(`applicantStage.${(STAGE_CONFIG[stage] ?? STAGE_FALLBACK).key}`)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {!isFinal && (
              <div className="border-t border-border px-6 py-4 flex items-center gap-2">
                <Button
                  size="sm"
                  className="flex-1 gap-1.5"
                  disabled={!nextStage || updateStage.isPending}
                  onClick={() => nextStage && updateStage.mutate({ id: applicant.id, stage: nextStage })}
                >
                  {t("recruitment.drawer.moveToNext")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive border-destructive/30"
                  disabled={updateStage.isPending}
                  onClick={() => updateStage.mutate({ id: applicant.id, stage: "rejected" })}
                >
                  {t("recruitment.drawer.reject")}
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function RecruitmentView() {
  const currency = useCurrency();
  const { t } = useTranslation("hr");
  const [search, setSearch] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"jobs" | "applicants">("jobs");
  const [stageFilter, setStageFilter] = React.useState("all");
  const [selectedApplicant, setSelectedApplicant] = React.useState<Applicant | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [applicantFormJob, setApplicantFormJob] = React.useState<{ id: string; title: string } | null>(null);

  const { data: jobPostings = [] } = useJobPostings();
  const { data: applicants = [] } = useApplicants();
  const updateJobStatus = useUpdateJobStatus();
  const tenantSlug = useAuthStore(s => s.tenant?.slug);

  const JOB_STATUSES: JobStatus[] = ["draft", "open", "on_hold", "closed"];

  const exportCsv = () => {
    const csv = toCsv(jobPostings.map(j => ({
      "Title":            j.title,
      "Department":       j.department,
      "Type":             j.type,
      "Experience Level": j.experienceLevel,
      "Status":           j.status,
      "Salary Min":       j.salaryMin,
      "Salary Max":       j.salaryMax,
      "Currency":         j.currency,
      "Applicants":       j.applicants,
      "Posted":           j.postedDate,
      "Closing":          j.closingDate,
      "Hiring Manager":   j.hiringManager,
    })), ["Title","Department","Type","Experience Level","Status","Salary Min","Salary Max","Currency","Applicants","Posted","Closing","Hiring Manager"]);
    downloadFile(`job_postings_${new Date().toISOString().split("T")[0]}.csv`, csv);
  };

  const exportPdfReport = () => exportPdf({
    title: "Job Postings",
    subtitle: `${jobPostings.length} postings · ${applicants.length} applicants`,
    columns: ["Title","Department","Type","Level","Status","Salary Range","Applicants","Posted","Closing"],
    rows: jobPostings.map(j => [j.title, j.department, j.type, j.experienceLevel, j.status, `${j.currency} ${j.salaryMin.toLocaleString()}–${j.salaryMax.toLocaleString()}`, j.applicants, j.postedDate, j.closingDate]),
    landscape: true,
  });
  const { data: recruitmentSummary } = useRecruitmentSummary();

  const filteredJobs = React.useMemo(() =>
    jobPostings.filter(j =>
      !search || j.title.toLowerCase().includes(search.toLowerCase()) || j.department.toLowerCase().includes(search.toLowerCase())
    ),
  [search, jobPostings]);

  const filteredApplicants = React.useMemo(() => {
    const q = search.toLowerCase();
    return applicants.filter(a => {
      const matchSearch = !search || a.name.toLowerCase().includes(q) || a.jobTitle.toLowerCase().includes(q);
      const matchStage = stageFilter === "all" || a.stage === stageFilter;
      return matchSearch && matchStage;
    });
  }, [search, stageFilter, applicants]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("recruitment.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("recruitment.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {tenantSlug && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-sm"
              onClick={() => window.open(`/careers/${tenantSlug}`, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="h-4 w-4" />{t("recruitment.careersPage")}
            </Button>
          )}
          <ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} />
          <Can permission="hr.recruitment.create"><Button size="sm" className="h-9 gap-1.5 text-sm" onClick={() => setShowAddForm(true)}><Plus className="h-4 w-4" />{t("recruitment.postJob")}</Button></Can>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: t("recruitment.stat.openPositions"),   value: recruitmentSummary?.openPositions    ?? jobPostings.filter(j => j.status === "open").length,           color: "text-primary bg-primary/10",         icon: Briefcase },
          { label: t("recruitment.stat.totalApplicants"), value: recruitmentSummary?.totalApplicants  ?? applicants.length,                                           color: "text-info bg-info/10",               icon: Users },
          { label: t("recruitment.stat.inInterview"),     value: recruitmentSummary?.inInterview      ?? applicants.filter(a => a.stage === "interview").length,       color: "text-violet-600 bg-violet-100 dark:bg-violet-900/20", icon: Users },
          { label: t("recruitment.stat.pendingOffers"),   value: recruitmentSummary?.offers           ?? applicants.filter(a => a.stage === "offer").length,           color: "text-amber-600 bg-amber-100 dark:bg-amber-900/20", icon: Award },
          { label: t("recruitment.stat.hiredThisMonth"),  value: recruitmentSummary?.hiredThisMonth   ?? applicants.filter(a => a.stage === "hired").length,           color: "text-success bg-success/10",         icon: CheckCircle2 },
          { label: t("recruitment.stat.avgTimeToHire"),   value: `${recruitmentSummary?.avgTimeToHire ?? 0}d`,                                                        color: "text-muted-foreground bg-muted",     icon: Clock },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="card-hover">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}><s.icon className="h-4 w-4" /></div>
                <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="font-bold text-lg leading-tight">{s.value}</p></div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-border">
        {(["jobs","applicants"] as const).map(tk => (
          <button key={tk} onClick={() => setActiveTab(tk)}
            className={cn("px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === tk ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t(`recruitment.tab.${tk}`)}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder={activeTab === "jobs" ? t("recruitment.searchJobs") : t("recruitment.searchApplicants")} value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        {activeTab === "applicants" && (
          <div className="flex items-center gap-1 flex-wrap">
            {["all", ...STAGE_ORDER].map(s => (
              <button key={s} onClick={() => setStageFilter(s)}
                className={cn("px-3 py-1 rounded-full text-xs font-medium transition-colors",
                  stageFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
                {s === "all" ? t("recruitment.filterAll") : t(`applicantStage.${s}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Jobs Grid */}
      {activeTab === "jobs" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredJobs.map((job, i) => {
            const sc = JOB_STATUS_CONFIG[job.status] ?? JOB_STATUS_FALLBACK;
            return (
              <motion.div key={job.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}>
                <Card className="card-hover cursor-pointer h-full">
                  <CardContent className="p-5 flex flex-col h-full">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="font-semibold text-sm leading-tight">{job.title}</p>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                          <Briefcase className="h-3 w-3" />{job.department}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>{t(`jobStatus.${sc.key}`)}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                              onClick={e => e.stopPropagation()}
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setApplicantFormJob({ id: job.id, title: job.title })}>
                              <UserPlus className="h-3.5 w-3.5 mr-2" />{t("recruitment.job.addApplicant")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {JOB_STATUSES.map(st => (
                              <DropdownMenuItem
                                key={st}
                                disabled={job.status === st}
                                onClick={() => updateJobStatus.mutate({ id: job.id, status: st })}
                              >
                                {t(`jobStatus.${(JOB_STATUS_CONFIG[st] ?? JOB_STATUS_FALLBACK).key}`)}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-xs text-muted-foreground mb-4 flex-1">
                      <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{job.branch}</div>
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="h-3 w-3" />
                        {formatCurrency(job.salaryMin, job.currency || currency)} – {formatCurrency(job.salaryMax, job.currency || currency)}
                      </div>
                      <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />{t("recruitment.job.closes", { date: formatDate(job.closingDate, "medium") })}</div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-border/50">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-semibold">{job.applicants}</span>
                        <span className="text-muted-foreground">{t("recruitment.job.applicants")}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="capitalize">{job.experienceLevel}</span>
                        <span>·</span>
                        <span>{job.type.replace("_", " ")}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Applicants Table */}
      {activeTab === "applicants" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y border-border bg-muted/30">
                  <tr>
                    {[
                      ["applicant", t("recruitment.applicantsTable.applicant")], ["appliedFor", t("recruitment.applicantsTable.appliedFor")],
                      ["experience", t("recruitment.applicantsTable.experience")], ["rating", t("recruitment.applicantsTable.rating")],
                      ["appliedOn", t("recruitment.applicantsTable.appliedOn")], ["stage", t("recruitment.applicantsTable.stage")], ["actions", ""],
                    ].map(([k, h]) => (
                      <th key={k} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredApplicants.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-16 text-muted-foreground text-sm">{t("recruitment.emptyApplicants")}</td></tr>
                  ) : filteredApplicants.map((app, i) => {
                    const sc = STAGE_CONFIG[app.stage] ?? STAGE_FALLBACK;
                    return (
                      <motion.tr key={app.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }} className="erp-table-row cursor-pointer"
                        onClick={() => { setSelectedApplicant(app); setDrawerOpen(true); }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">{getInitials(app.name)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{app.name}</p>
                              <p className="text-[11px] text-muted-foreground">{app.currentRole} · {app.currentCompany}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{app.jobTitle}</td>
                        <td className="px-4 py-3 text-sm">{app.experience}y</td>
                        <td className="px-4 py-3"><RatingStars rating={app.rating} /></td>
                        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{formatDate(app.appliedDate, "medium")}</td>
                        <td className="px-4 py-3">
                          <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>{t(`applicantStage.${sc.key}`)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
              {t("recruitment.showingApplicants", { shown: filteredApplicants.length, total: applicants.length })}
            </div>
          </CardContent>
        </Card>
      )}

      <ApplicantDrawer applicant={selectedApplicant} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AddJobPostingForm open={showAddForm} onClose={() => setShowAddForm(false)} />
      <AddApplicantForm
        open={!!applicantFormJob}
        jobId={applicantFormJob?.id ?? null}
        jobTitle={applicantFormJob?.title}
        onClose={() => setApplicantFormJob(null)}
      />
    </div>
  );
}


