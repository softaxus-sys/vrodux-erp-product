import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, X, Briefcase, Users, Clock,
  CheckCircle2, Star, MapPin, DollarSign, Calendar,
  Mail, Phone, Globe, ChevronRight, Award
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import type { JobPostingDto as JobPosting, ApplicantDto as Applicant, ApplicantStage, JobStatus } from "@/lib/hr/hr.api";
import { useJobPostings, useApplicants, useRecruitmentSummary } from "@/hooks/hr/use-hr";
import { toCsv, downloadFile } from "@/lib/csv";
import { exportPdf } from "@/lib/pdf";
import { ExportMenu } from "@/components/ui/export-menu";
import { AddJobPostingForm } from "./add-job-posting-form";

const JOB_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open:     { label: "Open",     color: "text-success",          bg: "bg-success/10" },
  closed:   { label: "Closed",   color: "text-muted-foreground", bg: "bg-muted" },
  on_hold:  { label: "On Hold",  color: "text-warning",          bg: "bg-warning/10" },
  draft:    { label: "Draft",    color: "text-info",             bg: "bg-info/10" },
};
const JOB_STATUS_FALLBACK = { label: "Unknown", color: "text-muted-foreground", bg: "bg-muted" };

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  applied:    { label: "Applied",    color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50" },
  screening:  { label: "Screening",  color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20" },
  interview:  { label: "Interview",  color: "text-violet-600",  bg: "bg-violet-50 dark:bg-violet-900/20" },
  offer:      { label: "Offer",      color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-900/20" },
  hired:      { label: "Hired",      color: "text-success",     bg: "bg-success/10" },
  rejected:   { label: "Rejected",   color: "text-destructive", bg: "bg-destructive/10" },
};
const STAGE_FALLBACK = { label: "Unknown", color: "text-muted-foreground", bg: "bg-muted" };

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

function ApplicantDrawer({ applicant, open, onClose }: { applicant: Applicant | null; open: boolean; onClose: () => void }) {
  if (!applicant) return null;
  const sc = STAGE_CONFIG[applicant.stage] ?? STAGE_FALLBACK;
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
              <p className="font-bold text-base">Applicant Profile</p>
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
                    <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>{sc.label}</span>
                  </div>
                </div>
              </div>

              {/* Applied for */}
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl">
                <p className="text-xs text-primary font-semibold uppercase tracking-wide mb-1">Applied For</p>
                <p className="text-sm font-medium">{applicant.jobTitle}</p>
              </div>

              {/* Details */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact & Details</h4>
                {[
                  { icon: Mail,     label: "Email",      value: applicant.email },
                  { icon: Phone,    label: "Phone",      value: applicant.phone },
                  { icon: Briefcase,label: "Experience", value: `${applicant.experience} year${applicant.experience > 1 ? "s" : ""}` },
                  { icon: Calendar, label: "Applied",    value: formatDate(applicant.appliedDate, "medium") },
                  { icon: Globe,    label: "Source",     value: applicant.source },
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
                    <span className="text-xs text-muted-foreground">Rating</span>
                    <RatingStars rating={applicant.rating} />
                  </div>
                </div>
              </div>

              {applicant.notes && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notes</h4>
                  <p className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-3 leading-relaxed">{applicant.notes}</p>
                </div>
              )}

              {/* Stage pipeline */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Hiring Pipeline</h4>
                <div className="flex items-center gap-1">
                  {STAGE_ORDER.filter(s => s !== "rejected").map((stage, i) => {
                    const idx = STAGE_ORDER.filter(s => s !== "rejected").indexOf(applicant.stage as "applied" | "screening" | "interview" | "offer" | "hired");
                    const isActive = stage === applicant.stage;
                    const isPast = i < idx;
                    return (
                      <div key={stage} className="flex-1 text-center">
                        <div className={cn("h-1.5 rounded-full mb-1.5", isPast ? "bg-primary" : isActive ? "bg-primary/70" : "bg-muted")} />
                        <p className={cn("text-[9px] font-medium capitalize", isActive ? "text-primary" : "text-muted-foreground")}>
                          {(STAGE_CONFIG[stage] ?? STAGE_FALLBACK).label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="border-t border-border px-6 py-4 flex items-center gap-2">
              <Button size="sm" className="flex-1 gap-1.5">Move to Next Stage</Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30">Reject</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function RecruitmentView() {
  const [search, setSearch] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"jobs" | "applicants">("jobs");
  const [stageFilter, setStageFilter] = React.useState("all");
  const [selectedApplicant, setSelectedApplicant] = React.useState<Applicant | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);

  const { data: jobPostings = [] } = useJobPostings();
  const { data: applicants = [] } = useApplicants();

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
          <h1 className="text-2xl font-bold">Recruitment</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage job postings and applicant pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu onCsv={exportCsv} onPdf={exportPdfReport} />
          <Button size="sm" className="h-9 gap-1.5 text-sm" onClick={() => setShowAddForm(true)}><Plus className="h-4 w-4" />Post Job</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: "Open Positions",    value: recruitmentSummary?.openPositions    ?? jobPostings.filter(j => j.status === "open").length,           color: "text-primary bg-primary/10",         icon: Briefcase },
          { label: "Total Applicants",  value: recruitmentSummary?.totalApplicants  ?? applicants.length,                                           color: "text-info bg-info/10",               icon: Users },
          { label: "In Interview",      value: recruitmentSummary?.inInterview      ?? applicants.filter(a => a.stage === "interview").length,       color: "text-violet-600 bg-violet-100 dark:bg-violet-900/20", icon: Users },
          { label: "Pending Offers",    value: recruitmentSummary?.offers           ?? applicants.filter(a => a.stage === "offer").length,           color: "text-amber-600 bg-amber-100 dark:bg-amber-900/20", icon: Award },
          { label: "Hired This Month",  value: recruitmentSummary?.hiredThisMonth   ?? applicants.filter(a => a.stage === "hired").length,           color: "text-success bg-success/10",         icon: CheckCircle2 },
          { label: "Avg Time to Hire",  value: `${recruitmentSummary?.avgTimeToHire ?? 0}d`,                                                        color: "text-muted-foreground bg-muted",     icon: Clock },
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
        {(["jobs","applicants"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={cn("px-5 py-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
              activeTab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t === "jobs" ? "Job Postings" : "Applicants"}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder={activeTab === "jobs" ? "Search jobs..." : "Search applicants..."} value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        {activeTab === "applicants" && (
          <div className="flex items-center gap-1 flex-wrap">
            {["all", ...STAGE_ORDER].map(s => (
              <button key={s} onClick={() => setStageFilter(s)}
                className={cn("px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors",
                  stageFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
                {s === "all" ? "All" : STAGE_CONFIG[s as ApplicantStage].label}
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
                      <span className={cn("shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>{sc.label}</span>
                    </div>
                    <div className="space-y-1.5 text-xs text-muted-foreground mb-4 flex-1">
                      <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{job.branch}</div>
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="h-3 w-3" />
                        {formatCurrency(job.salaryMin, job.currency)} – {formatCurrency(job.salaryMax, job.currency)}
                      </div>
                      <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />Closes {formatDate(job.closingDate, "medium")}</div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-border/50">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-semibold">{job.applicants}</span>
                        <span className="text-muted-foreground">applicants</span>
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
                    {["Applicant","Applied For","Experience","Rating","Applied On","Stage",""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredApplicants.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-16 text-muted-foreground text-sm">No applicants found.</td></tr>
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
                          <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>{sc.label}</span>
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
              Showing {filteredApplicants.length} of {applicants.length} applicants
            </div>
          </CardContent>
        </Card>
      )}

      <ApplicantDrawer applicant={selectedApplicant} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AddJobPostingForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}


