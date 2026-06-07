"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, X, Briefcase, Users, Clock,
  CheckCircle2, Star, MapPin, DollarSign, Calendar,
  Mail, Phone, Globe, ChevronRight, Award, ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { useJobPostings, useApplicants, useCreateJobPosting, useMoveApplicantStage } from "@/hooks/hr/use-recruitment";
import type { JobPostingDto, ApplicantDto } from "@/lib/hr/recruitment.api";

const JOB_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open:    { label: "Open",    color: "text-success",         bg: "bg-success/10" },
  closed:  { label: "Closed", color: "text-muted-foreground", bg: "bg-muted" },
  on_hold: { label: "On Hold", color: "text-warning",         bg: "bg-warning/10" },
  draft:   { label: "Draft",  color: "text-blue-600",         bg: "bg-blue-50 dark:bg-blue-900/20" },
};

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  applied:   { label: "Applied",   color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50" },
  screening: { label: "Screening", color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20" },
  interview: { label: "Interview", color: "text-violet-600",  bg: "bg-violet-50 dark:bg-violet-900/20" },
  offer:     { label: "Offer",     color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-900/20" },
  hired:     { label: "Hired",     color: "text-success",     bg: "bg-success/10" },
  rejected:  { label: "Rejected",  color: "text-destructive", bg: "bg-destructive/10" },
};

const STAGE_ORDER = ["applied", "screening", "interview", "offer", "hired", "rejected"];

function RatingStars({ rating }: { rating?: number | null }) {
  if (!rating) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={cn("h-3 w-3", i <= rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30")} />
      ))}
    </div>
  );
}

function ApplicantDrawer({ applicant, onClose }: { applicant: ApplicantDto; onClose: () => void }) {
  const moveStage = useMoveApplicantStage();
  const sc = STAGE_CONFIG[applicant.stage] ?? { label: applicant.stage, color: "text-foreground", bg: "bg-muted" };
  const currentIdx = STAGE_ORDER.filter(s => s !== "rejected").indexOf(applicant.stage);
  const nextStage  = STAGE_ORDER.filter(s => s !== "rejected")[currentIdx + 1];

  return (
    <AnimatePresence>
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
              {(applicant.currentRole || applicant.currentCompany) && (
                <p className="text-sm text-muted-foreground">
                  {[applicant.currentRole, applicant.currentCompany].filter(Boolean).join(" · ")}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1">
                {applicant.nationality && (
                  <>
                    <Globe className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{applicant.nationality}</span>
                  </>
                )}
                <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>{sc.label}</span>
              </div>
            </div>
          </div>

          {/* Applied for */}
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl">
            <p className="text-xs text-primary font-semibold uppercase tracking-wide mb-1">Applied For</p>
            <p className="text-sm font-medium">{applicant.jobTitle}</p>
          </div>

          {/* Contact & Details */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact & Details</h4>
            {[
              { icon: Mail,      label: "Email",      value: applicant.email },
              applicant.phone ? { icon: Phone, label: "Phone", value: applicant.phone } : null,
              applicant.experience != null ? { icon: Briefcase, label: "Experience", value: `${applicant.experience} year${applicant.experience !== 1 ? "s" : ""}` } : null,
              { icon: Calendar, label: "Applied", value: formatDate(applicant.appliedDate, "medium") },
              applicant.source ? { icon: Globe, label: "Source", value: applicant.source } : null,
            ].filter(Boolean).map((row: any) => (
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
                const isActive = stage === applicant.stage;
                const isPast   = i < currentIdx;
                return (
                  <div key={stage} className="flex-1 text-center">
                    <div className={cn("h-1.5 rounded-full mb-1.5", isPast ? "bg-primary" : isActive ? "bg-primary/70" : "bg-muted")} />
                    <p className={cn("text-[9px] font-medium capitalize", isActive ? "text-primary" : "text-muted-foreground")}>
                      {STAGE_CONFIG[stage]?.label ?? stage}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="border-t border-border px-6 py-4 flex items-center gap-2">
          {nextStage && (
            <Button size="sm" className="flex-1 gap-1.5" disabled={moveStage.isPending}
              onClick={() => { moveStage.mutate({ id: applicant.id, stage: nextStage }); onClose(); }}>
              Move to {STAGE_CONFIG[nextStage]?.label ?? nextStage}
            </Button>
          )}
          {applicant.stage !== "rejected" && (
            <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30"
              disabled={moveStage.isPending}
              onClick={() => { moveStage.mutate({ id: applicant.id, stage: "rejected" }); onClose(); }}>
              Reject
            </Button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function AddJobPostingModal({ onClose }: { onClose: () => void }) {
  const createJob = useCreateJobPosting();
  const [title, setTitle]       = React.useState("");
  const [department, setDept]   = React.useState("");
  const [branch, setBranch]     = React.useState("");
  const [salaryMin, setSalMin]  = React.useState("");
  const [salaryMax, setSalMax]  = React.useState("");
  const [expLevel, setExpLevel] = React.useState("");
  const [empType, setEmpType]   = React.useState("full_time");
  const [closing, setClosing]   = React.useState("");

  const isValid = !!title.trim() && !!department.trim();

  const handleSubmit = async () => {
    if (!isValid) return;
    await createJob.mutateAsync({
      title: title.trim(),
      department: department.trim(),
      branch: branch || null,
      salaryMin: salaryMin ? parseFloat(salaryMin) : null,
      salaryMax: salaryMax ? parseFloat(salaryMax) : null,
      currency: "AED",
      experienceLevel: expLevel || null,
      employmentType: empType,
      closingDate: closing || null,
    });
    onClose();
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed top-0 right-0 h-full w-full max-w-md bg-background border-l border-border shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <p className="font-bold text-base">Post Job</p>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Job Title *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Senior Developer" className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Department *</label>
              <Input value={department} onChange={e => setDept(e.target.value)} placeholder="e.g. IT" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Branch</label>
              <Input value={branch} onChange={e => setBranch(e.target.value)} placeholder="e.g. Dubai HQ" className="h-9" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Salary Min (AED)</label>
              <Input type="number" value={salaryMin} onChange={e => setSalMin(e.target.value)} placeholder="10000" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Salary Max (AED)</label>
              <Input type="number" value={salaryMax} onChange={e => setSalMax(e.target.value)} placeholder="20000" className="h-9" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Experience Level</label>
              <select value={expLevel} onChange={e => setExpLevel(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm">
                <option value="">Any</option>
                {["junior", "mid", "senior", "lead", "executive"].map(l => (
                  <option key={l} value={l} className="capitalize">{l}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</label>
              <select value={empType} onChange={e => setEmpType(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm">
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Closing Date</label>
            <Input type="date" value={closing} onChange={e => setClosing(e.target.value)} className="h-9" />
          </div>
        </div>
        <div className="border-t border-border px-6 py-4 flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!isValid || createJob.isPending}>
            {createJob.isPending ? "Posting…" : "Post Job"}
          </Button>
        </div>
      </motion.div>
    </>
  );
}

export function RecruitmentView() {
  const [search, setSearch]           = React.useState("");
  const [activeTab, setActiveTab]     = React.useState<"jobs" | "applicants">("jobs");
  const [stageFilter, setStageFilter] = React.useState("all");
  const [jobFilter, setJobFilter]     = React.useState("all");
  const [appPage, setAppPage]         = React.useState(1);
  const [selectedApplicant, setSelected] = React.useState<ApplicantDto | null>(null);
  const [showAddJob, setShowAddJob]   = React.useState(false);

  const { data: jobs = [], isLoading: jobsLoading } = useJobPostings({
    search: activeTab === "jobs" && search ? search : undefined,
    status: jobFilter !== "all" ? jobFilter : undefined,
  });

  const { data: appData, isLoading: appLoading } = useApplicants({
    search:   activeTab === "applicants" && search ? search : undefined,
    stage:    stageFilter !== "all" ? stageFilter : undefined,
    page:     appPage,
    pageSize: 20,
  });

  const applicants  = appData?.items      ?? [];
  const appTotal    = appData?.totalCount ?? 0;
  const appPages    = appData?.totalPages ?? 1;

  // Computed stats from jobs data
  const openJobs      = jobs.filter(j => j.status === "open").length;
  const totalApps     = jobs.reduce((s, j) => s + j.applicantCount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Recruitment</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage job postings and applicant pipeline</p>
        </div>
        <Button size="sm" className="h-9 gap-1.5" onClick={() => setShowAddJob(true)}>
          <Plus className="h-4 w-4" /> Post Job
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Open Positions",   value: openJobs,         color: "text-primary",     bg: "bg-primary/10",     icon: Briefcase },
          { label: "Total Applicants", value: totalApps,        color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20", icon: Users },
          { label: "Total Jobs",       value: jobs.length,      color: "text-muted-foreground", bg: "bg-muted",    icon: Award },
          { label: "Total Records",    value: appTotal,         color: "text-success",     bg: "bg-success/10",     icon: CheckCircle2 },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", s.bg)}>
              <s.icon className={cn("h-4 w-4", s.color)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="font-bold text-lg leading-tight">{s.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-border">
        {(["jobs", "applicants"] as const).map(t => (
          <button key={t} onClick={() => { setActiveTab(t); setSearch(""); }}
            className={cn("px-5 py-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
              activeTab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t === "jobs" ? "Job Postings" : "Applicants"}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input placeholder={activeTab === "jobs" ? "Search jobs…" : "Search applicants…"}
            value={search} onChange={e => { setSearch(e.target.value); setAppPage(1); }} className="pl-9 h-9 text-sm" />
        </div>
        {activeTab === "jobs" && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {["all", "open", "draft", "on_hold", "closed"].map(s => (
              <button key={s} onClick={() => setJobFilter(s)}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
                  jobFilter === s ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground")}>
                {s === "all" ? "All" : JOB_STATUS_CONFIG[s]?.label ?? s}
              </button>
            ))}
          </div>
        )}
        {activeTab === "applicants" && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {["all", ...STAGE_ORDER].map(s => (
              <button key={s} onClick={() => { setStageFilter(s); setAppPage(1); }}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
                  stageFilter === s ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground")}>
                {s === "all" ? "All" : STAGE_CONFIG[s]?.label ?? s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Jobs Grid */}
      {activeTab === "jobs" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {jobsLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-5 h-44 animate-pulse" />
            ))
          ) : jobs.length === 0 ? (
            <div className="col-span-3 text-center py-16 text-sm text-muted-foreground">No job postings found.</div>
          ) : jobs.map((job: JobPostingDto, i) => {
            const sc = JOB_STATUS_CONFIG[job.status] ?? { label: job.status, color: "text-foreground", bg: "bg-muted" };
            return (
              <motion.div key={job.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                className="bg-card border border-border rounded-xl p-5 flex flex-col hover:shadow-md transition-shadow cursor-pointer">
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
                  {job.branch && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{job.branch}</div>}
                  {(job.salaryMin != null || job.salaryMax != null) && (
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-3 w-3" />
                      {job.salaryMin != null && job.salaryMax != null
                        ? `${formatCurrency(job.salaryMin, job.currency)} – ${formatCurrency(job.salaryMax, job.currency)}`
                        : formatCurrency((job.salaryMin ?? job.salaryMax)!, job.currency)}
                    </div>
                  )}
                  {job.closingDate && (
                    <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />Closes {formatDate(job.closingDate, "medium")}</div>
                  )}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-semibold">{job.applicantCount}</span>
                    <span className="text-muted-foreground">applicants</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {job.experienceLevel && <span className="capitalize">{job.experienceLevel}</span>}
                    {job.experienceLevel && job.employmentType && <span>·</span>}
                    {job.employmentType && <span>{job.employmentType.replace("_", " ")}</span>}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Applicants Table */}
      {activeTab === "applicants" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Applicant","Applied For","Experience","Rating","Applied On","Stage"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
                <th className="px-4 py-3 w-6" />
              </tr>
            </thead>
            <tbody>
              {appLoading ? (
                <tr><td colSpan={7} className="text-center py-12 text-sm text-muted-foreground">Loading…</td></tr>
              ) : applicants.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-sm text-muted-foreground">No applicants found.</td></tr>
              ) : applicants.map((app: ApplicantDto, i) => {
                const sc = STAGE_CONFIG[app.stage] ?? { label: app.stage, color: "text-foreground", bg: "bg-muted" };
                return (
                  <motion.tr key={app.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border/30 last:border-0 hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => setSelected(app)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">{getInitials(app.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{app.name}</p>
                          {(app.currentRole || app.currentCompany) && (
                            <p className="text-[11px] text-muted-foreground">
                              {[app.currentRole, app.currentCompany].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{app.jobTitle}</td>
                    <td className="px-4 py-3 text-sm">{app.experience != null ? `${app.experience}y` : "—"}</td>
                    <td className="px-4 py-3"><RatingStars rating={app.rating} /></td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{formatDate(app.appliedDate, "medium")}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>{sc.label}</span>
                    </td>
                    <td className="px-4 py-3"><ChevronRight className="h-4 w-4 text-muted-foreground/40" /></td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
          {appPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10">
              <p className="text-xs text-muted-foreground">Page {appPage} of {appPages} · {appTotal} total</p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={appPage <= 1} onClick={() => setAppPage(p => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={appPage >= appPages} onClick={() => setAppPage(p => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedApplicant && <ApplicantDrawer applicant={selectedApplicant} onClose={() => setSelected(null)} />}
      {showAddJob && <AddJobPostingModal onClose={() => setShowAddJob(false)} />}
    </div>
  );
}
