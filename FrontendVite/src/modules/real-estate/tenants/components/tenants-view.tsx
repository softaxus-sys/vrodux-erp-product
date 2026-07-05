import * as React from "react";
import { motion } from "framer-motion";
import {
  Search, Users, UserCheck, Building2, User,
  AlertTriangle, Star, Plus,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, getInitials } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { TenantDto as Tenant, TenantStatus } from "@/lib/real-estate/re.api";
import { useTenants, useTenantSummary, useUnits } from "@/hooks/real-estate/use-re";
import { TenantsDrawer } from "./tenants-drawer";
import { AddTenantForm } from "./add-tenant-form";

const TYPE_FILTERS: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Individual", value: "individual" },
  { label: "Corporate", value: "corporate" },
];

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: "All Statuses", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Blacklisted", value: "blacklisted" },
];

const STATUS_CONFIG: Record<TenantStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "text-success bg-success/10" },
  inactive: { label: "Inactive", className: "text-muted-foreground bg-muted" },
  blacklisted: { label: "Blacklisted", className: "text-destructive bg-destructive/10" },
};

const PAYMENT_BADGE: Record<string, string> = {
  excellent: "text-success bg-success/10",
  good: "text-primary bg-primary/10",
  fair: "text-warning bg-warning/10",
  poor: "text-destructive bg-destructive/10",
};

export function TenantsView() {
  const currency = useCurrency();
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Tenant | null>(null);
  const [showAddForm, setShowAddForm] = React.useState(false);

  const { data: tenants = [] } = useTenants();
  const { data: tenantSummary } = useTenantSummary();
  const { data: units = [] } = useUnits();

  const avgPaymentScore = React.useMemo(() => {
    if (tenants.length === 0) return 0;
    const scores: Record<string, number> = { excellent: 4, good: 3, fair: 2, poor: 1 };
    return Math.round((tenants.reduce((s, t) => s + (scores[t.paymentHistory] ?? 0), 0) / tenants.length) * 10) / 10;
  }, [tenants]);

  const STAT_CARDS = [
    {
      label: "Total Tenants",
      value: (tenantSummary?.total ?? tenants.length).toString(),
      icon: Users,
      color: "text-primary bg-primary/10",
    },
    {
      label: "Active",
      value: (tenantSummary?.active ?? tenants.filter(t => t.status === "active").length).toString(),
      icon: UserCheck,
      color: "text-success bg-success/10",
    },
    {
      label: "Corporate",
      value: (tenantSummary?.corporate ?? tenants.filter(t => t.type === "corporate").length).toString(),
      icon: Building2,
      color: "text-blue-600 bg-blue-500/10",
    },
    {
      label: "Individual",
      value: (tenantSummary?.individual ?? tenants.filter(t => t.type === "individual").length).toString(),
      icon: User,
      color: "text-purple-600 bg-purple-500/10",
    },
    {
      label: "Outstanding",
      value: formatCurrency(
        Number.isFinite(tenantSummary?.totalOutstanding)
          ? (tenantSummary!.totalOutstanding as number)
          : tenants.reduce((s, t) => s + (t.outstandingBalance ?? 0), 0),
        currency,
      ),
      icon: AlertTriangle,
      color: "text-destructive bg-destructive/10",
    },
    {
      label: "Avg Rating",
      value: `${avgPaymentScore}/4`,
      icon: Star,
      color: "text-warning bg-warning/10",
    },
  ];

  const filtered = React.useMemo(() => {
    return tenants.filter((t) => {
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        t.name.toLowerCase().includes(q) ||
        t.tenantCode.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.contactPerson.toLowerCase().includes(q);
      const matchType = typeFilter === "all" || t.type === typeFilter;
      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      return matchSearch && matchType && matchStatus;
    });
  }, [search, typeFilter, statusFilter, tenants]);

  const handleView = (t: Tenant) => {
    setSelected(t);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tenants</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Manage tenant profiles, payment history, and rental agreements.
          </p>
        </div>
        <Button size="sm" className="gap-2 shrink-0" onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4" /> Add Tenant
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAT_CARDS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2"
            >
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", s.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
                <p className="text-base font-bold leading-tight truncate">{s.value}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search name, code, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                typeFilter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {f.label}
            </button>
          ))}
          <span className="w-px h-4 bg-border mx-1" />
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                statusFilter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Tenant
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Email
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Units
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Monthly Rent
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Outstanding
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Payment
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-muted-foreground text-sm">
                    No tenants found.
                  </td>
                </tr>
              ) : (
                filtered.map((tenant, i) => (
                  <motion.tr
                    key={tenant.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => handleView(tenant)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">
                            {getInitials(tenant.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-sm leading-tight">{tenant.name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            {tenant.tenantCode}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize",
                          tenant.type === "corporate"
                            ? "bg-blue-500/10 text-blue-600"
                            : "bg-purple-500/10 text-purple-600"
                        )}
                      >
                        {tenant.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{tenant.email}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium">
                      {tenant.totalUnits}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold whitespace-nowrap">
                      {tenant.monthlyRent > 0
                        ? formatCurrency(tenant.monthlyRent, currency)
                        : <span className="text-muted-foreground font-normal">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {tenant.outstandingBalance > 0 ? (
                        <span className="text-sm font-bold text-destructive whitespace-nowrap">
                          {formatCurrency(tenant.outstandingBalance, currency)}
                        </span>
                      ) : (
                        <span className="text-sm text-success font-semibold">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize",
                          PAYMENT_BADGE[tenant.paymentHistory]
                        )}
                      >
                        {tenant.paymentHistory}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                          STATUS_CONFIG[tenant.status].className
                        )}
                      >
                        {STATUS_CONFIG[tenant.status].label}
                      </span>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
          <span>
            Showing {filtered.length} of {tenants.length} tenants
          </span>
        </div>
      </div>

      <TenantsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} tenant={selected} units={units} />
      <AddTenantForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}

