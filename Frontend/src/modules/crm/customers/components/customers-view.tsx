"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Search, Plus, Download, Building2, LayoutGrid,
  List, Star, TrendingUp, Users, DollarSign, Award
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CustomerDrawer } from "./customer-drawer";
import { AddCustomerForm } from "./add-customer-form";
import { cn, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { useCustomers, useCustomerSummary } from "@/hooks/crm/use-customers";
import type { CustomerDto, CustomerStatus, CustomerTier } from "@/lib/crm/customers.api";

type ViewMode = "list" | "grid";

const TIER_CONFIG: Record<CustomerTier, { label: string; color: string; bg: string; icon: string }> = {
  platinum: { label: "Platinum", color: "text-violet-600", bg: "bg-violet-100 dark:bg-violet-900/30", icon: "💎" },
  gold:     { label: "Gold",     color: "text-amber-600",  bg: "bg-amber-100 dark:bg-amber-900/30",  icon: "🥇" },
  silver:   { label: "Silver",   color: "text-slate-600",  bg: "bg-slate-100 dark:bg-slate-700/50",  icon: "🥈" },
  standard: { label: "Standard", color: "text-muted-foreground", bg: "bg-muted",                     icon: "⭐" },
};

const STATUS_CONFIG: Record<CustomerStatus, { label: string; color: string; bg: string; dot: string }> = {
  active:   { label: "Active",   color: "text-success",          bg: "bg-success/10",     dot: "bg-success" },
  inactive: { label: "Inactive", color: "text-muted-foreground", bg: "bg-muted",          dot: "bg-muted-foreground" },
  at_risk:  { label: "At Risk",  color: "text-warning",          bg: "bg-warning/10",     dot: "bg-warning" },
  churned:  { label: "Churned",  color: "text-destructive",      bg: "bg-destructive/10", dot: "bg-destructive" },
};

function StatusBadge({ status }: { status: CustomerStatus }) {
  const c = STATUS_CONFIG[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold", c.color, c.bg)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />{c.label}
    </span>
  );
}

function TierBadge({ tier }: { tier: CustomerTier }) {
  const c = TIER_CONFIG[tier];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold", c.color, c.bg)}>
      {c.icon} {c.label}
    </span>
  );
}

function NpsStars({ score }: { score?: number }) {
  if (!score) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-1">
      <Star className={cn("h-3.5 w-3.5 fill-current", score >= 8 ? "text-success" : score >= 6 ? "text-warning" : "text-destructive")} />
      <span className="text-xs font-medium">{score}/10</span>
    </div>
  );
}

/* ── Grid card ── */
function CustomerCard({ customer, index, onClick }: { customer: CustomerDto; index: number; onClick: () => void }) {
  const tier = TIER_CONFIG[customer.tier];
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.04 }}>
      <Card className="card-hover cursor-pointer h-full" onClick={onClick}>
        <CardContent className="p-5 flex flex-col h-full">
          <div className="flex items-start justify-between gap-2 mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm leading-tight truncate">{customer.name}</p>
                <p className="text-xs text-muted-foreground">{customer.industry}</p>
              </div>
            </div>
            <TierBadge tier={customer.tier} />
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-muted/40 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground">Revenue</p>
              <p className="text-xs font-bold">{customer.totalRevenue > 0 ? formatCurrency(customer.totalRevenue, customer.currency) : "—"}</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground">Open Deals</p>
              <p className="text-xs font-bold">{customer.openDeals}</p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-border/50 mt-auto">
            <StatusBadge status={customer.status} />
            <div className="flex items-center gap-2">
              <NpsStars score={customer.npsScore} />
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[8px] font-bold bg-primary/10 text-primary">{getInitials(customer.accountManager)}</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function CustomersView() {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [tierFilter, setTierFilter] = React.useState("all");
  const [viewMode, setViewMode] = React.useState<ViewMode>("list");
  const [selectedCustomer, setSelectedCustomer] = React.useState<CustomerDto | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);

  const { data: customers = [], isLoading } = useCustomers();
  const { data: summary } = useCustomerSummary();

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return customers.filter(c => {
      const matchSearch = !search || c.name.toLowerCase().includes(q) || c.industry.toLowerCase().includes(q) || c.accountManager.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      const matchTier   = tierFilter === "all"   || c.tier   === tierFilter;
      return matchSearch && matchStatus && matchTier;
    });
  }, [customers, search, statusFilter, tierFilter]);

  const openDrawer = (c: CustomerDto) => { setSelectedCustomer(c); setDrawerOpen(true); };

  const totalRevenue  = summary?.totalRevenue ?? 0;
  const openDeals     = summary?.openDeals    ?? 0;
  const platinumCount = summary?.platinum     ?? 0;
  const avgNps        = summary?.avgNps       ?? 0;
  const activeCount   = summary?.active       ?? 0;
  const totalCount    = summary?.total        ?? customers.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage accounts, contacts, and relationship history</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-sm"><Download className="h-3.5 w-3.5" />Export</Button>
          <Button size="sm" className="h-9 gap-1.5 text-sm" onClick={() => setShowAddForm(true)}><Plus className="h-4 w-4" />Add Customer</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: "Total Accounts", value: totalCount,                              sub: "All customers",      icon: Users,      color: "text-primary bg-primary/10" },
          { label: "Active",         value: activeCount,                             sub: "Healthy accounts",   icon: Building2,  color: "text-success bg-success/10" },
          { label: "Total Revenue",  value: formatCurrency(totalRevenue, "AED"),     sub: "Lifetime value",     icon: DollarSign, color: "text-info bg-info/10" },
          { label: "Open Deals",     value: openDeals,                               sub: "In pipeline",        icon: TrendingUp, color: "text-warning bg-warning/10" },
          { label: "Platinum",       value: platinumCount,                           sub: "Top tier accounts",  icon: Award,      color: "text-violet-600 bg-violet-100 dark:bg-violet-900/20" },
          { label: "Avg NPS",        value: avgNps > 0 ? `${avgNps}/10` : "—",      sub: "Satisfaction score", icon: Star,       color: "text-amber-600 bg-amber-100 dark:bg-amber-900/20" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="card-hover">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}><s.icon className="h-4 w-4" /></div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{s.label}</p>
                  <p className="font-bold text-base leading-tight">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground/70 truncate">{s.sub}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search accounts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
          </div>
          {/* Status pills */}
          <div className="flex items-center gap-1 flex-wrap">
            {["all","active","at_risk","inactive","churned"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn("px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors",
                  statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
                {s === "all" ? "All" : s === "at_risk" ? "At Risk" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          {/* Tier filter */}
          <select value={tierFilter} onChange={e => setTierFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="all">All Tiers</option>
            {(["platinum","gold","silver","standard"] as CustomerTier[]).map(t => (
              <option key={t} value={t}>{TIER_CONFIG[t].label}</option>
            ))}
          </select>
        </div>
        {/* View toggle */}
        <div className="flex items-center bg-muted rounded-lg p-0.5 shrink-0">
          <button onClick={() => setViewMode("list")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              viewMode === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>
            <List className="h-3.5 w-3.5" />List
          </button>
          <button onClick={() => setViewMode("grid")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              viewMode === "grid" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>
            <LayoutGrid className="h-3.5 w-3.5" />Grid
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      )}

      {/* Grid view */}
      {!isLoading && viewMode === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((c, i) => (
            <CustomerCard key={c.id} customer={c} index={i} onClick={() => openDrawer(c)} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-20 text-muted-foreground text-sm">No customers found.</div>
          )}
        </div>
      )}

      {/* List view */}
      {!isLoading && viewMode === "list" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y border-border bg-muted/30">
                  <tr>
                    {["Company","Industry","Account Manager","Revenue","Open Deals","Tier","Last Activity","NPS","Status"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-16 text-muted-foreground text-sm">No customers found.</td></tr>
                  ) : filtered.map((c, i) => (
                    <motion.tr key={c.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }} className="erp-table-row cursor-pointer" onClick={() => openDrawer(c)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm leading-tight">{c.name}</p>
                            <p className="text-[11px] text-muted-foreground">{c.city}, {c.country}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{c.industry}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[9px] font-bold bg-primary/10 text-primary">{getInitials(c.accountManager)}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-muted-foreground whitespace-nowrap">{c.accountManager}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-sm whitespace-nowrap">
                        {c.totalRevenue > 0 ? formatCurrency(c.totalRevenue, c.currency) : <span className="text-muted-foreground font-normal">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">{c.openDeals}</td>
                      <td className="px-4 py-3"><TierBadge tier={c.tier} /></td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {c.lastActivity ? formatDate(c.lastActivity, "medium") : "—"}
                      </td>
                      <td className="px-4 py-3"><NpsStars score={c.npsScore} /></td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
              Showing {filtered.length} of {customers.length} customers
            </div>
          </CardContent>
        </Card>
      )}

      <CustomerDrawer customer={selectedCustomer} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AddCustomerForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}
