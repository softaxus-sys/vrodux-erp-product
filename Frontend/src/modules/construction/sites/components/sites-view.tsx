"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Shield, Users, AlertTriangle, CheckCircle2, X, Plus, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { useSites } from "@/hooks/construction/use-construction";
import type { SiteDto, SiteStatus } from "@/lib/construction/construction.api";
import { AddSiteForm } from "./add-site-form";

const STATUS_CONFIG: Record<SiteStatus, { label: string; color: string; bg: string; dot: string }> = {
  active:    { label: "Active",    color: "text-success",           bg: "bg-success/10",     dot: "bg-success" },
  inactive:  { label: "Inactive",  color: "text-warning",           bg: "bg-warning/10",     dot: "bg-warning" },
  completed: { label: "Completed", color: "text-muted-foreground",  bg: "bg-muted",          dot: "bg-muted-foreground" },
};

function SiteDrawer({ site, open, onClose }: { site: SiteDto | null; open: boolean; onClose: () => void }) {
  if (!site) return null;
  const sc = STATUS_CONFIG[site.status];
  const today = new Date();
  const permitExpiry = site.permitExpiry !== "PENDING" ? new Date(site.permitExpiry) : null;
  const daysToExpiry = permitExpiry ? Math.round((permitExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const permitWarning = daysToExpiry !== null && daysToExpiry <= 30;

  return (
    <AnimatePresence>
      {open && (<>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
        <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className="fixed top-0 right-0 h-full w-full max-w-[560px] bg-background border-l border-border shadow-2xl z-50 flex flex-col">
          <div className="flex items-start justify-between px-6 py-5 border-b border-border">
            <div>
              <p className="font-mono text-xs text-muted-foreground">{site.siteCode}</p>
              <p className="font-bold text-base">{site.name}</p>
              <p className="text-sm text-muted-foreground">{site.projectName}</p>
              <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold mt-1.5", sc.color, sc.bg)}>
                <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />{sc.label}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Workers</p>
                <p className="font-bold text-lg text-primary">{site.workersCurrent}</p>
                <p className="text-[10px] text-muted-foreground">of {site.workersMax} max</p>
              </div>
              <div className={cn("border rounded-xl p-3 text-center", site.safetyScore >= 85 ? "bg-success/5 border-success/20" : site.safetyScore >= 70 ? "bg-warning/5 border-warning/20" : "bg-destructive/5 border-destructive/20")}>
                <p className="text-[10px] text-muted-foreground">Safety Score</p>
                <p className={cn("font-bold text-lg", site.safetyScore >= 85 ? "text-success" : site.safetyScore >= 70 ? "text-warning" : "text-destructive")}>
                  {site.safetyScore > 0 ? `${site.safetyScore}%` : "N/A"}
                </p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Area</p>
                <p className="font-bold text-lg">{site.area.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">sqm</p>
              </div>
            </div>
            {permitWarning && (
              <div className="flex items-center gap-2 bg-warning/10 border border-warning/30 rounded-xl px-4 py-3 text-sm text-warning">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Permit expires in <strong>{daysToExpiry} days</strong> — renewal required.</span>
              </div>
            )}
            <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Location</span><span className="text-right max-w-[200px]">{site.locationAddress}, {site.locationCity}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Site Manager</span><span>{site.siteManager}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Manager Phone</span><span className="font-mono text-xs">{site.siteManagerPhone}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Safety Officer</span><span>{site.safetyOfficer}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Officer Phone</span><span className="font-mono text-xs">{site.safetyOfficerPhone}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Start Date</span><span>{formatDate(site.startDate, "medium")}</span></div>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Permit Number</span>
                <span className="font-mono text-xs">{site.permitNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Permit Expiry</span>
                <span className={cn(permitWarning ? "text-warning font-semibold" : "")}>
                  {site.permitExpiry !== "PENDING" ? formatDate(site.permitExpiry, "medium") : "Pending"}
                </span>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Last Inspection</span><span>{site.lastInspection === "N/A" ? "N/A" : formatDate(site.lastInspection, "medium")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Next Inspection</span><span className="text-primary">{site.nextInspection === "N/A" ? "N/A" : formatDate(site.nextInspection, "medium")}</span></div>
            </div>
            {site.notes && <div><h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notes</h4>
              <p className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-3">{site.notes}</p></div>}
          </div>
        </motion.div>
      </>)}
    </AnimatePresence>
  );
}

export function SitesView() {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<SiteStatus | "all">("all");
  const [selected, setSelected] = React.useState<SiteDto | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);

  const { data: sites = [], isLoading } = useSites();

  const filtered = React.useMemo(() => {
    let list = sites;
    if (statusFilter !== "all") list = list.filter(s => s.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.siteCode.toLowerCase().includes(q) ||
        s.projectName.toLowerCase().includes(q) ||
        s.locationCity.toLowerCase().includes(q)
      );
    }
    return list;
  }, [sites, search, statusFilter]);

  const today = new Date();
  const totalWorkers = sites.reduce((s, x) => s + x.workersCurrent, 0);
  const activeSites  = sites.filter(s => s.status === "active").length;
  const avgSafety    = sites.length
    ? Math.round(sites.filter(s => s.safetyScore > 0).reduce((a, s) => a + s.safetyScore, 0) / (sites.filter(s => s.safetyScore > 0).length || 1))
    : 0;
  const permitsExpiring = sites.filter(s => {
    if (!s.permitExpiry || s.permitExpiry === "PENDING") return false;
    const exp = new Date(s.permitExpiry);
    const days = Math.round((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return days >= 0 && days <= 30;
  }).length;

  const STATS = [
    { label: "Total Sites",       value: sites.length,    icon: MapPin,       color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50" },
    { label: "Active",            value: activeSites,     icon: CheckCircle2, color: "text-success",     bg: "bg-success/10" },
    { label: "Total Workers",     value: totalWorkers,    icon: Users,        color: "text-primary",     bg: "bg-primary/10" },
    { label: "Avg Safety Score",  value: `${avgSafety}%`, icon: Shield,       color: "text-warning",     bg: "bg-warning/10" },
    { label: "Permits Expiring",  value: permitsExpiring, icon: AlertTriangle,color: "text-destructive", bg: "bg-destructive/10" },
  ];

  const FILTERS: { key: SiteStatus | "all"; label: string }[] = [
    { key: "all", label: "All" }, { key: "active", label: "Active" }, { key: "inactive", label: "Inactive" }, { key: "completed", label: "Completed" },
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
        <div><h1 className="text-2xl font-bold">Construction Sites</h1><p className="text-sm text-muted-foreground mt-0.5">Monitor site status, safety, permits, and workforce</p></div>
        <Button className="gap-2 h-9" onClick={() => setShowAddForm(true)}><Plus className="h-4 w-4" />Add Site</Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {STATS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", s.bg)}><Icon className={cn("h-5 w-5", s.color)} /></div>
              <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="font-bold text-lg leading-tight">{s.value}</p></div>
            </motion.div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search sites…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1.5">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                statusFilter === f.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Site</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Project</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Location</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Workers</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Safety</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Permit Exp.</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-sm text-muted-foreground">No sites found.</td></tr>
            ) : filtered.map((site, i) => {
              const sc = STATUS_CONFIG[site.status];
              const permitExpiry = site.permitExpiry !== "PENDING" && site.permitExpiry !== "N/A" ? new Date(site.permitExpiry) : null;
              const daysToExpiry = permitExpiry ? Math.round((permitExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
              const permitWarning = daysToExpiry !== null && daysToExpiry <= 30;
              return (
                <motion.tr key={site.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                  onClick={() => { setSelected(site); setDrawerOpen(true); }}
                  className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer">
                  <td className="px-4 py-3.5">
                    <p className="font-mono text-xs text-muted-foreground">{site.siteCode}</p>
                    <p className="text-sm font-semibold">{site.name}</p>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-muted-foreground hidden md:table-cell">{site.projectName}</td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />{site.locationCity}, {site.locationEmirate}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <p className="font-semibold text-sm">{site.workersCurrent}</p>
                    <p className="text-[10px] text-muted-foreground">of {site.workersMax}</p>
                  </td>
                  <td className="px-4 py-3.5 text-center hidden md:table-cell">
                    {site.safetyScore > 0 ? (
                      <span className={cn("text-sm font-bold", site.safetyScore >= 85 ? "text-success" : site.safetyScore >= 70 ? "text-warning" : "text-destructive")}>
                        {site.safetyScore}%
                      </span>
                    ) : <span className="text-muted-foreground text-sm">—</span>}
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <span className={cn("text-sm", permitWarning ? "text-destructive font-semibold" : "text-muted-foreground")}>
                      {site.permitExpiry === "PENDING" ? "Pending" : formatDate(site.permitExpiry, "short")}
                    </span>
                    {permitWarning && <p className="text-[10px] text-destructive">Expiring in {daysToExpiry}d</p>}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />{sc.label}
                    </span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </motion.div>
      <SiteDrawer site={selected} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AddSiteForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}
