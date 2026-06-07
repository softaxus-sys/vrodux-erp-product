import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HardHat, Star, AlertTriangle, Ban, CheckCircle2, X, Plus, Search, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { type ContractorDto as Contractor, type ContractorStatus, type ContractorTrade } from "@/lib/construction/construction.api";
import { useContractors, useContractorsSummary } from "@/hooks/construction/use-construction";
import { AddContractorForm } from "./add-contractor-form";

const STATUS_CONFIG: Record<ContractorStatus, { label: string; color: string; bg: string; dot: string }> = {
  active:      { label: "Active",      color: "text-success",     bg: "bg-success/10",     dot: "bg-success" },
  inactive:    { label: "Inactive",    color: "text-warning",     bg: "bg-warning/10",     dot: "bg-warning" },
  blacklisted: { label: "Blacklisted", color: "text-destructive", bg: "bg-destructive/10", dot: "bg-destructive" },
};

const TRADE_LABELS: Record<ContractorTrade, string> = {
  civil: "Civil", mep: "MEP", structural: "Structural", finishing: "Finishing",
  landscaping: "Landscaping", hvac: "HVAC", electrical: "Electrical",
  plumbing: "Plumbing", it_infra: "IT Infrastructure", safety: "Safety",
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={cn("h-3 w-3", i <= Math.round(rating) ? "text-warning fill-warning" : "text-muted-foreground")} />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

function ContractorDrawer({ contractor, open, onClose }: { contractor: Contractor | null; open: boolean; onClose: () => void }) {
  if (!contractor) return null;
  const sc = STATUS_CONFIG[contractor.status];
  const today = new Date("2026-05-20");
  const licenseExpiry = new Date(contractor.licenseExpiry);
  const daysToLicExpiry = Math.round((licenseExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const licenseWarning = daysToLicExpiry <= 60;

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
              <p className="font-mono text-xs text-muted-foreground">{contractor.contractorCode}</p>
              <p className="font-bold text-base">{contractor.companyName}</p>
              <p className="text-sm text-muted-foreground">{contractor.tradeName}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />{sc.label}
                </span>
                <StarRating rating={contractor.rating} />
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Contract Value</p>
                <p className="font-bold text-sm text-primary">{formatCurrency(contractor.totalContractValue, "AED")}</p>
              </div>
              <div className="bg-success/5 border border-success/20 rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Active</p>
                <p className="font-bold text-lg text-success">{contractor.activeProjects}</p>
                <p className="text-[10px] text-muted-foreground">projects</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Completed</p>
                <p className="font-bold text-lg">{contractor.completedProjects}</p>
                <p className="text-[10px] text-muted-foreground">projects</p>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Trade Specializations</h4>
              <div className="flex flex-wrap gap-1.5">
                {contractor.trade.map(t => (
                  <span key={t} className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">{TRADE_LABELS[t]}</span>
                ))}
              </div>
            </div>
            {licenseWarning && contractor.status !== "blacklisted" && (
              <div className="flex items-center gap-2 bg-warning/10 border border-warning/30 rounded-xl px-4 py-3 text-sm text-warning">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>License expires in <strong>{daysToLicExpiry} days</strong> — renewal required.</span>
              </div>
            )}
            {contractor.status === "blacklisted" && (
              <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-sm text-destructive">
                <Ban className="h-4 w-4 shrink-0" />
                <span>This contractor is <strong>blacklisted</strong>. Do not engage.</span>
              </div>
            )}
            <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Contact Person</span><span>{contractor.contactPerson}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="text-primary text-xs">{contractor.email}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span className="font-mono text-xs">{contractor.phone}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Location</span><span>{contractor.location.city}, {contractor.location.country}</span></div>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">License No.</span><span className="font-mono text-xs">{contractor.licenseNumber}</span></div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">License Expiry</span>
                <span className={cn(licenseWarning ? "text-warning font-semibold" : "")}>{formatDate(contractor.licenseExpiry, "medium")}</span>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Insurance Provider</span><span>{contractor.insurance.provider}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Insurance Expiry</span><span>{contractor.insurance.expiry === "N/A" ? "N/A" : formatDate(contractor.insurance.expiry, "medium")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Coverage</span><span>{contractor.insurance.covered}</span></div>
            </div>
            {contractor.notes && <div><h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notes</h4>
              <p className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-3">{contractor.notes}</p></div>}
          </div>
        </motion.div>
      </>)}
    </AnimatePresence>
  );
}

export function ContractorsView() {
  const { data: contractors = [], isLoading } = useContractors();
  const { data: contractorsSummary }          = useContractorsSummary();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<ContractorStatus | "all">("all");
  const [selected, setSelected] = React.useState<Contractor | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);

  const filtered = React.useMemo(() => {
    let list = contractors;
    if (statusFilter !== "all") list = list.filter(c => c.status === statusFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(c => c.companyName.toLowerCase().includes(s) || c.contractorCode.toLowerCase().includes(s) || c.contactPerson.toLowerCase().includes(s));
    }
    return list;
  }, [contractors, search, statusFilter]);

  const today = new Date("2026-05-20");

  const STATS = [
    { label: "Total",       value: contractorsSummary?.total ?? contractors.length,                                         icon: HardHat,    color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50" },
    { label: "Active",      value: contractorsSummary?.active ?? contractors.filter(c=>c.status==="active").length,          icon: CheckCircle2,color: "text-success",    bg: "bg-success/10" },
    { label: "Blacklisted", value: contractorsSummary?.blacklisted ?? contractors.filter(c=>c.status==="blacklisted").length,icon: Ban,        color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Avg Rating",  value: `${contractorsSummary?.avgRating ?? 0}★`,                                                icon: Star,       color: "text-warning",     bg: "bg-warning/10" },
    { label: "Total Value", value: formatCurrency(contractorsSummary?.totalContractValue ?? contractors.reduce((s,c)=>s+c.totalContractValue,0), "AED"), icon: Shield, color: "text-primary", bg: "bg-primary/10", isText: true },
  ];

  const FILTERS: { key: ContractorStatus | "all"; label: string }[] = [
    { key: "all", label: "All" }, { key: "active", label: "Active" }, { key: "inactive", label: "Inactive" }, { key: "blacklisted", label: "Blacklisted" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Contractors</h1><p className="text-sm text-muted-foreground mt-0.5">Manage contractor registry, licenses, and performance</p></div>
        <Button className="gap-2 h-9" onClick={() => setShowAddForm(true)}><Plus className="h-4 w-4" />Add Contractor</Button>
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
          <Input placeholder="Search contractors…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
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
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contractor</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Trade</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">License Exp.</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rating</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Projects</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contract Value</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-sm text-muted-foreground">No contractors found.</td></tr>
            ) : filtered.map((c, i) => {
              const sc = STATUS_CONFIG[c.status];
              const licenseExpiry = new Date(c.licenseExpiry);
              const daysToExpiry = Math.round((licenseExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              const licWarning = daysToExpiry <= 60 && c.status !== "blacklisted";
              return (
                <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                  onClick={() => { setSelected(c); setDrawerOpen(true); }}
                  className={cn("border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer",
                    c.status === "blacklisted" ? "border-l-2 border-l-destructive" : "")}>
                  <td className="px-4 py-3.5">
                    <p className="font-mono text-xs text-muted-foreground">{c.contractorCode}</p>
                    <p className="text-sm font-semibold">{c.companyName}</p>
                    <p className="text-xs text-muted-foreground">{c.contactPerson}</p>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {c.trade.slice(0, 2).map(t => (
                        <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">{TRADE_LABELS[t]}</span>
                      ))}
                      {c.trade.length > 2 && <span className="text-[10px] text-muted-foreground">+{c.trade.length - 2}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <span className={cn("text-sm", licWarning ? "text-warning font-semibold" : "text-muted-foreground")}>
                      {c.licenseExpiry === "N/A" ? "N/A" : formatDate(c.licenseExpiry, "short")}
                    </span>
                    {licWarning && <p className="text-[10px] text-warning">Expiring in {daysToExpiry}d</p>}
                  </td>
                  <td className="px-4 py-3.5 text-center"><StarRating rating={c.rating} /></td>
                  <td className="px-4 py-3.5 text-center hidden md:table-cell">
                    <p className="text-sm font-semibold">{c.activeProjects} <span className="text-xs text-muted-foreground font-normal">active</span></p>
                    <p className="text-[10px] text-muted-foreground">{c.completedProjects} done</p>
                  </td>
                  <td className="px-4 py-3.5 text-right font-semibold text-sm">{formatCurrency(c.totalContractValue, "AED")}</td>
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
      <ContractorDrawer contractor={selected} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AddContractorForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}

