"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HardHat, Building2, CheckCircle2, PauseCircle, Pencil,
  Search, Plus, X, MapPin, Users, Calendar, TrendingUp, DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useProjects, useProjectSummary } from "@/hooks/construction/use-construction";
import type { ProjectDto, ProjectStatus, ProjectType } from "@/lib/construction/construction.api";
import { AddProjectForm } from "./add-project-form";

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bg: string; dot: string }> = {
  planning:    { label: "Planning",     color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20",    dot: "bg-blue-500" },
  in_progress: { label: "In Progress",  color: "text-primary",     bg: "bg-primary/10",                    dot: "bg-primary" },
  on_hold:     { label: "On Hold",      color: "text-warning",     bg: "bg-warning/10",                    dot: "bg-warning" },
  completed:   { label: "Completed",    color: "text-success",     bg: "bg-success/10",                    dot: "bg-success" },
  cancelled:   { label: "Cancelled",    color: "text-destructive", bg: "bg-destructive/10",                dot: "bg-destructive" },
};

const TYPE_LABELS: Record<ProjectType, string> = {
  residential:    "Residential",
  commercial:     "Commercial",
  infrastructure: "Infrastructure",
  industrial:     "Industrial",
};

const PHASE_STATUS_CONFIG = {
  not_started: { color: "bg-muted", label: "Not Started" },
  in_progress: { color: "bg-primary", label: "In Progress" },
  completed:   { color: "bg-success", label: "Completed" },
  delayed:     { color: "bg-destructive", label: "Delayed" },
};

function ProjectDrawer({ project, open, onClose }: { project: ProjectDto | null; open: boolean; onClose: () => void }) {
  const [tab, setTab] = React.useState<"overview" | "phases">("overview");
  React.useEffect(() => { if (open) setTab("overview"); }, [open]);
  if (!project) return null;
  const sc = STATUS_CONFIG[project.status];
  const spentPct = Math.round((project.budgetSpent / project.contractValue) * 100);

  return (
    <AnimatePresence>
      {open && (<>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
        <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className="fixed top-0 right-0 h-full w-full max-w-[600px] bg-background border-l border-border shadow-2xl z-50 flex flex-col">
          <div className="flex items-start justify-between px-6 py-5 border-b border-border">
            <div>
              <p className="text-xs text-muted-foreground font-mono">{project.projectNumber}</p>
              <p className="font-bold text-base">{project.name}</p>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                <MapPin className="h-3.5 w-3.5" />{project.location}
              </div>
              <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold mt-1.5", sc.color, sc.bg)}>
                <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />{sc.label}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
          <div className="flex border-b border-border px-6">
            {(["overview", "phases"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn("px-4 py-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
                  tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                {t === "phases" ? `Phases (${project.phases.length})` : "Overview"}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {tab === "overview" && (<>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Contract Value</p>
                  <p className="font-bold text-sm text-primary">{formatCurrency(project.contractValue, "AED")}</p>
                </div>
                <div className="bg-warning/5 border border-warning/20 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Spent</p>
                  <p className="font-bold text-sm text-warning">{formatCurrency(project.budgetSpent, "AED")}</p>
                </div>
                <div className="bg-success/5 border border-success/20 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Remaining</p>
                  <p className="font-bold text-sm text-success">{formatCurrency(project.budgetRemaining, "AED")}</p>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Overall Completion</span>
                  <span className="font-semibold">{project.completionPct}%</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${project.completionPct}%` }} transition={{ duration: 0.8 }}
                    className={cn("h-full rounded-full", project.completionPct >= 80 ? "bg-success" : project.completionPct >= 50 ? "bg-primary" : "bg-warning")} />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>Budget used: {spentPct}%</span>
                  <span>{project.workers > 0 ? `${project.workers} workers on site` : "No workers on site"}</span>
                </div>
              </div>
              <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Client</span><span className="font-medium">{project.client}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{TYPE_LABELS[project.projectType]}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Project Manager</span><span>{project.projectManager}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Site Engineer</span><span>{project.siteEngineer}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Start Date</span><span>{formatDate(project.startDate, "medium")}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">End Date</span><span>{formatDate(project.endDate, "medium")}</span></div>
              </div>
              {project.notes && <div><h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notes</h4>
                <p className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-3">{project.notes}</p></div>}
            </>)}
            {tab === "phases" && (
              <div className="space-y-3">
                {project.phases.map((phase, i) => {
                  const psc = PHASE_STATUS_CONFIG[phase.status];
                  return (
                    <motion.div key={phase.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className="bg-muted/30 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold">{phase.name}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(phase.startDate, "short")} — {formatDate(phase.endDate, "short")}</p>
                        </div>
                        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full text-white", psc.color)}>{psc.label}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", psc.color)} style={{ width: `${phase.completionPct}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{phase.completionPct}% complete</p>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="border-t border-border px-6 py-4 flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5 h-9"><Pencil className="h-3.5 w-3.5" />Edit</Button>
          </div>
        </motion.div>
      </>)}
    </AnimatePresence>
  );
}

const STATUS_FILTERS = ["all", "planning", "in_progress", "on_hold", "completed", "cancelled"] as const;

export function ProjectsView() {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<ProjectStatus | "all">("all");
  const [selected, setSelected] = React.useState<ProjectDto | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);

  const { data: projects = [], isLoading } = useProjects();
  const { data: summary } = useProjectSummary();

  const filtered = React.useMemo(() => {
    let list = projects;
    if (statusFilter !== "all") list = list.filter(p => p.status === statusFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(s) || p.projectNumber.toLowerCase().includes(s) || p.client.toLowerCase().includes(s) || p.location.toLowerCase().includes(s));
    }
    return list;
  }, [projects, search, statusFilter]);

  const STATS = [
    { label: "Total Projects",  value: summary?.total ?? projects.length,           icon: Building2,   color: "text-slate-600", bg: "bg-slate-100 dark:bg-slate-800/50" },
    { label: "In Progress",     value: summary?.inProgress ?? 0,                     icon: HardHat,     color: "text-primary",   bg: "bg-primary/10" },
    { label: "On Hold",         value: summary?.onHold ?? 0,                         icon: PauseCircle, color: "text-warning",   bg: "bg-warning/10" },
    { label: "Completed",       value: summary?.completed ?? 0,                      icon: CheckCircle2,color: "text-success",   bg: "bg-success/10" },
    { label: "Contract Value",  value: formatCurrency(summary?.totalContractValue ?? 0, "AED"), icon: DollarSign, color: "text-success", bg: "bg-success/10", isText: true },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Construction Projects</h1><p className="text-sm text-muted-foreground mt-0.5">Plan and monitor projects, budgets, and milestones</p></div>
        <Button className="gap-2 h-9" onClick={() => setShowAddForm(true)}><Plus className="h-4 w-4" />New Project</Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {STATS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", s.bg)}><Icon className={cn("h-5 w-5", s.color)} /></div>
              <div className="min-w-0"><p className="text-xs text-muted-foreground truncate">{s.label}</p><p className="font-bold text-sm leading-tight">{s.value}</p></div>
            </motion.div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search projects…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button key={f} onClick={() => setStatusFilter(f as ProjectStatus | "all")}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                statusFilter === f ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {f === "all" ? "All" : f === "in_progress" ? "In Progress" : f === "on_hold" ? "On Hold" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4">
        {filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center text-sm text-muted-foreground">No projects found.</div>
        ) : filtered.map((p, i) => {
          const sc = STATUS_CONFIG[p.status];
          const spentPct = Math.round((p.budgetSpent / p.contractValue) * 100);
          return (
            <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              onClick={() => { setSelected(p); setDrawerOpen(true); }}
              className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-muted-foreground">{p.projectNumber}</span>
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", sc.color, sc.bg)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />{sc.label}
                    </span>
                    <span className="text-[10px] bg-muted px-2 py-0.5 rounded font-medium">{TYPE_LABELS[p.projectType]}</span>
                  </div>
                  <p className="font-bold text-base">{p.name}</p>
                  <p className="text-sm text-muted-foreground">{p.client}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                    <MapPin className="h-3 w-3" />{p.location}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-base">{formatCurrency(p.contractValue, "AED")}</p>
                  <p className="text-xs text-muted-foreground">Contract Value</p>
                  {p.workers > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end mt-1">
                      <Users className="h-3 w-3" />{p.workers} workers
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-muted-foreground mb-1">Completion</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full", p.completionPct >= 80 ? "bg-success" : p.completionPct >= 50 ? "bg-primary" : "bg-warning")}
                        style={{ width: `${p.completionPct}%` }} />
                    </div>
                    <span className="font-semibold">{p.completionPct}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">Budget Spent</p>
                  <p className="font-semibold">{spentPct}% <span className="text-muted-foreground font-normal">({formatCurrency(p.budgetSpent, "AED")})</span></p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">Timeline</p>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span>{formatDate(p.endDate, "short")}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      <ProjectDrawer project={selected} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AddProjectForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}
