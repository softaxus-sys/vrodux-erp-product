import * as React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Users, Clock, ArrowUpRight, UserCheck, UserX, Coffee, Banknote,
  TrendingUp, FileText, Activity, Target, DollarSign, UserPlus,
  Briefcase, Sparkles, Plus, ShoppingCart, Package, Receipt, ArrowRight,
} from "lucide-react";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { cn, formatCurrency, formatNumber, activeLocale } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useCurrency } from "@/hooks/use-currency";
import { useUsers } from "@/hooks/identity/use-users";
import { useRoles } from "@/hooks/identity/use-roles";
import { useAuditLogs } from "@/hooks/identity/use-audit-logs";
import {
  useHrSummary, useAttendanceSummary, useLeaveSummary, usePayrollSummary,
} from "@/hooks/hr/use-hr";
import { useLeadsSummary, useCrmSummary, useCustomersSummary } from "@/hooks/crm/use-crm";
import { useInvoiceSummary } from "@/hooks/finance/use-finance";
import { ActivityFeed } from "./activity-feed";
import { DashboardCharts } from "./dashboard-charts";
import type { ActivityItem } from "@/types";
import type { AttendanceSummaryDto, LeaveSummaryDto, PayrollSummaryDto } from "@/lib/hr/hr.api";

// ── Accent palette (maps to a soft icon chip gradient + solid accent) ──────────

type Accent = "blue" | "violet" | "emerald" | "amber" | "sky" | "rose";
const ACCENTS: Record<Accent, { chip: string; text: string; ring: string; bar: string }> = {
  blue:    { chip: "from-blue-500/15 to-blue-500/5",       text: "text-blue-600 dark:text-blue-400",       ring: "ring-blue-500/20",    bar: "bg-blue-500"    },
  violet:  { chip: "from-violet-500/15 to-violet-500/5",   text: "text-violet-600 dark:text-violet-400",   ring: "ring-violet-500/20",  bar: "bg-violet-500"  },
  emerald: { chip: "from-emerald-500/15 to-emerald-500/5", text: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/20", bar: "bg-emerald-500" },
  amber:   { chip: "from-amber-500/15 to-amber-500/5",     text: "text-amber-600 dark:text-amber-400",     ring: "ring-amber-500/20",   bar: "bg-amber-500"   },
  sky:     { chip: "from-sky-500/15 to-sky-500/5",         text: "text-sky-600 dark:text-sky-400",         ring: "ring-sky-500/20",     bar: "bg-sky-500"     },
  rose:    { chip: "from-rose-500/15 to-rose-500/5",       text: "text-rose-600 dark:text-rose-400",       ring: "ring-rose-500/20",    bar: "bg-rose-500"    },
};

interface Stat {
  id: string;
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent: Accent;
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ stat, index }: { stat: Stat; index: number }) {
  const a = ACCENTS[stat.accent];
  const Icon = stat.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg"
    >
      <span className={cn("absolute inset-x-0 top-0 h-1", a.bar)} />
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ring-1", a.chip, a.ring)}>
          <Icon className={cn("h-5 w-5", a.text)} />
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums">{stat.value}</p>
      {stat.sub && <p className="mt-1 text-xs text-muted-foreground">{stat.sub}</p>}
    </motion.div>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────────

function StatSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-start justify-between">
            <div className="h-3.5 w-24 rounded bg-muted" />
            <div className="h-10 w-10 rounded-xl bg-muted" />
          </div>
          <div className="h-8 w-28 rounded bg-muted" />
          <div className="mt-2 h-3 w-20 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

// ── Attendance / Payroll (HR) ───────────────────────────────────────────────────

function AttendanceCard({ summary, leaveSummary }: { summary?: AttendanceSummaryDto; leaveSummary?: LeaveSummaryDto }) {
  const { t } = useTranslation("dashboard");
  const total = summary?.totalEmployees ?? 0;
  const present = summary?.presentToday ?? 0;
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  const rows = [
    { label: t("attendance.present"),  value: present,                       Icon: UserCheck, color: "text-success",     bg: "bg-success/10" },
    { label: t("attendance.absent"),   value: summary?.absentToday ?? 0,     Icon: UserX,     color: "text-destructive", bg: "bg-destructive/10" },
    { label: t("attendance.late"),     value: summary?.lateToday ?? 0,       Icon: Clock,     color: "text-warning",     bg: "bg-warning/10" },
    { label: t("attendance.onLeave"), value: summary?.onLeaveToday ?? leaveSummary?.onLeaveToday ?? 0, Icon: Coffee, color: "text-primary", bg: "bg-primary/10" },
  ];
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{t("attendance.title")}</CardTitle>
            <CardDescription>{total > 0 ? t("attendance.ofEmployees", { pct, total }) : t("attendance.loading")}</CardDescription>
          </div>
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold",
            pct >= 90 ? "bg-success/10 text-success" : pct >= 70 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive")}>
            {t("attendance.percentPresent", { pct })}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className="h-full rounded-full bg-success" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {rows.map(({ label, value, Icon, color, bg }) => (
            <div key={label} className={cn("flex items-center gap-2.5 rounded-xl p-3", bg)}>
              <Icon className={cn("h-4 w-4 shrink-0", color)} />
              <div>
                <p className={cn("text-xl font-bold leading-none tabular-nums", color)}>{value}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PayrollCard({ summary, currency }: { summary?: PayrollSummaryDto; currency: string }) {
  const { t } = useTranslation("dashboard");
  const monthLabel = new Date().toLocaleDateString(activeLocale(), { month: "long", year: "numeric" });
  const rows = [
    { label: t("payroll.netThisMonth"), value: formatCurrency(summary?.thisMonth?.totalNetSalary ?? 0, currency), Icon: Banknote,   color: "text-success" },
    { label: t("payroll.employeesPaid"), value: formatNumber(summary?.thisMonth?.employeeCount ?? 0),             Icon: TrendingUp, color: "text-primary" },
    { label: t("payroll.paidRuns"),     value: formatNumber(summary?.allTime?.paid ?? 0),                          Icon: FileText,   color: "text-info" },
    { label: t("payroll.totalRuns"),    value: formatNumber(summary?.allTime?.total ?? 0),                         Icon: Activity,   color: "text-warning" },
  ];
  const pending = (summary?.allTime?.draft ?? 0) + (summary?.allTime?.processed ?? 0);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("payroll.title", { month: monthLabel })}</CardTitle>
        <CardDescription>{summary ? t("payroll.summary", { paid: summary.allTime.paid, pending }) : t("payroll.loading")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map(({ label, value, Icon, color }) => (
          <div key={label} className="flex items-center justify-between border-b border-border/30 py-1.5 last:border-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className={cn("h-3.5 w-3.5", color)} />{label}</div>
            <span className={cn("text-sm font-semibold", color)}>{value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Quick actions ───────────────────────────────────────────────────────────────

function QuickActions({ actions }: { actions: { label: string; to: string; icon: React.ElementType; accent: Accent }[] }) {
  const { t } = useTranslation("dashboard");
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("quickActions.title")}</CardTitle>
        <CardDescription>{t("quickActions.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2.5">
        {actions.map(({ label, to, icon: Icon, accent }) => {
          const a = ACCENTS[accent];
          return (
            <Link key={to} to={to}
              className="group flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-3 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm">
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ring-1", a.chip, a.ring)}>
                <Icon className={cn("h-4.5 w-4.5", a.text)} />
              </div>
              <span className="flex items-center gap-1 text-xs font-semibold">
                {label}
                <ArrowRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </span>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────────

export function DashboardView() {
  const { t } = useTranslation("dashboard");
  const { user, isRole, hasModuleAccess, tenant, hasRawPermission } = useAuthStore();
  const currency = useCurrency();

  const isAdmin = isRole(["super_admin", "tenant_admin"]);
  const canCrm = hasModuleAccess("crm");
  const canHr = hasModuleAccess("hr") || isRole(["hr_manager"]);
  const canFinance = hasModuleAccess("finance");
  const canSales = hasModuleAccess("sales");
  const canInventory = hasModuleAccess("inventory");

  // User counts, role counts and the audit trail are ADMIN data. They were fetched for every role,
  // so a restricted user (e.g. a Real Estate Agent with no settings permissions) saw the tenant's
  // headcount, role count and a live feed of other people's logins and user-creation events.
  // Gate on the same permissions the Settings screens require; the tiles hide when absent.
  const canSeeUsers = hasRawPermission("settings.users.view");
  const canSeeRoles = hasRawPermission("settings.roles.view");
  const canSeeAudit = hasRawPermission("settings.audit.view");

  // Data (React Query caches; modules the tenant lacks simply resolve empty)
  const { data: usersData, isLoading: usersLoading } = useUsers({ pageSize: 1 }, canSeeUsers);
  const { data: rolesData } = useRoles({}, canSeeRoles);
  const { data: auditData, isLoading: auditLoading } = useAuditLogs({ pageSize: 15 }, canSeeAudit);
  const { data: hrSummary } = useHrSummary();
  const { data: attSummary } = useAttendanceSummary();
  const { data: leaveSummary } = useLeaveSummary();
  const { data: payrollSummary } = usePayrollSummary();
  const { data: leads } = useLeadsSummary();
  const { data: deals } = useCrmSummary();
  const { data: customers } = useCustomersSummary();
  const { data: invoices } = useInvoiceSummary();

  const hour = new Date().getHours();
  const greeting = t(hour < 12 ? "greeting.morning" : hour < 17 ? "greeting.afternoon" : "greeting.evening");
  const firstName = user?.name?.split(" ")[0] ?? "";

  // ── Adaptive KPI set — pick the 4 most relevant for the tenant's modules ──────
  const stats: Stat[] = React.useMemo(() => {
    const s: Stat[] = [];
    if (canCrm) {
      s.push(
        { id: "leads", label: t("stat.totalLeads"), value: formatNumber(leads?.total ?? 0), sub: t("stat.newThisWeek", { count: leads?.newThisWeek ?? 0 }), icon: Target, accent: "blue" },
        { id: "pipeline", label: t("stat.pipelineValue"), value: formatCurrency(deals?.totalValue ?? 0, currency), sub: t("stat.openDeals", { count: deals?.totalDeals ?? 0 }), icon: TrendingUp, accent: "violet" },
        { id: "customers", label: t("stat.customers"), value: formatNumber(customers?.total ?? 0), sub: t("stat.activeCount", { count: customers?.active ?? 0 }), icon: Users, accent: "emerald" },
        { id: "conv", label: t("stat.conversionRate"), value: `${Math.round(leads?.conversionRate ?? 0)}%`, sub: t("stat.leadsConverted", { count: leads?.converted ?? 0 }), icon: Sparkles, accent: "amber" },
      );
    }
    if (canFinance) {
      s.push(
        { id: "revenue", label: t("stat.revenuePaid"), value: formatCurrency(invoices?.totalPaid ?? 0, currency), sub: t("stat.ofBilled", { amount: formatCurrency(invoices?.totalAmount ?? 0, currency) }), icon: DollarSign, accent: "emerald" },
        { id: "outstanding", label: t("stat.outstanding"), value: formatCurrency(invoices?.totalOutstanding ?? 0, currency), sub: t("stat.overdue", { amount: formatCurrency(invoices?.totalOverdue ?? 0, currency) }), icon: Receipt, accent: "rose" },
      );
    }
    if (canHr) {
      s.push(
        { id: "emp", label: t("stat.employees"), value: formatNumber(hrSummary?.total ?? 0), sub: t("stat.activeCount", { count: hrSummary?.active ?? 0 }), icon: Briefcase, accent: "sky" },
        { id: "present", label: t("stat.presentToday"), value: formatNumber(attSummary?.presentToday ?? 0), sub: t("stat.absentLeave", { absent: attSummary?.absentToday ?? 0, leave: leaveSummary?.pending ?? 0 }), icon: UserCheck, accent: "emerald" },
      );
    }
    // Fallback filler so there are always ≥4 tiles. Headcount/roles are admin numbers, so that
    // tile only appears for users allowed to see them; "your permissions" is about the viewer
    // themselves and is always safe to show.
    if (canSeeUsers)
      s.push({ id: "users", label: t("stat.teamMembers"), value: formatNumber(usersData?.totalCount ?? 0), sub: t("stat.rolesCount", { count: rolesData?.items?.length ?? 0 }), icon: Users, accent: "sky" });
    s.push(
      { id: "perms", label: t("stat.yourPermissions"), value: formatNumber(user?.permissions?.length ?? 0), sub: user?.roleName ?? (user?.role ?? "").replace(/_/g, " "), icon: Sparkles, accent: "violet" },
    );
    return s.slice(0, 4);
  }, [t, canCrm, canFinance, canHr, leads, deals, customers, invoices, hrSummary, attSummary, leaveSummary, usersData, rolesData, user, currency, canSeeUsers]);

  // ── Quick actions by module ───────────────────────────────────────────────────
  const actions = React.useMemo(() => {
    const list: { label: string; to: string; icon: React.ElementType; accent: Accent }[] = [];
    if (canCrm) list.push(
      { label: t("quickActions.newLead"), to: "/crm/leads", icon: UserPlus, accent: "blue" },
      { label: t("quickActions.addDeal"), to: "/crm/pipeline", icon: TrendingUp, accent: "violet" },
      { label: t("quickActions.newCustomer"), to: "/crm/customers", icon: Users, accent: "emerald" },
    );
    if (canSales) list.push({ label: t("quickActions.newOrder"), to: "/sales/orders", icon: ShoppingCart, accent: "sky" });
    if (canFinance) list.push({ label: t("quickActions.newInvoice"), to: "/finance/invoicing", icon: Receipt, accent: "amber" });
    if (canInventory) list.push({ label: t("quickActions.addProduct"), to: "/inventory/products", icon: Package, accent: "rose" });
    if (canHr) list.push({ label: t("quickActions.addEmployee"), to: "/hr/employees", icon: Briefcase, accent: "sky" });
    if (list.length === 0) list.push({ label: t("quickActions.settings"), to: "/settings/general", icon: Plus, accent: "blue" });
    return list.slice(0, 6);
  }, [t, canCrm, canSales, canFinance, canInventory, canHr]);

  const activities: ActivityItem[] = React.useMemo(() =>
    (auditData?.items ?? []).slice(0, 12).map((log) => ({
      id: log.id,
      type: (log.action ?? "").toLowerCase().replace(/[\s.]+/g, "_"),
      title: `${log.entityType ?? "System"}: ${log.action ?? "action"}`,
      description: log.succeeded ? (log.entityId ? `Entity: ${log.entityId}` : "Completed successfully") : "Action failed",
      user: log.userName ?? "System",
      timestamp: log.occurredOn,
      module: "settings" as const,
    })), [auditData?.items]);

  const dateStr = new Date().toLocaleDateString(activeLocale(), { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-6">

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-border p-6 sm:p-8 text-white"
        style={{ background: "linear-gradient(120deg, hsl(var(--primary)) 0%, #6d28d9 55%, #4f46e5 100%)" }}
      >
        {/* decorative glows */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 right-24 h-52 w-52 rounded-full bg-white/5 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              {tenant?.name ?? t("hero.workspace")}
            </div>
            <h1 className="text-2xl font-bold sm:text-3xl">{firstName ? `${greeting}، ${firstName}` : greeting}</h1>
            <p className="mt-1 max-w-xl text-sm text-white/80">
              {isAdmin ? t("hero.subtitleAdmin")
                : canCrm ? t("hero.subtitleCrm")
                : t("hero.subtitleDefault")}
            </p>
          </div>
          <div className="shrink-0 rounded-xl bg-white/10 px-4 py-3 text-right backdrop-blur">
            <p className="text-sm font-semibold">{dateStr}</p>
            <p className="mt-0.5 text-xs capitalize text-white/70">{user?.roleName ?? (user?.role ?? "").replace(/_/g, " ")}</p>
          </div>
        </div>
      </motion.div>

      {/* ── KPI stat cards ────────────────────────────────────────────────────── */}
      {usersLoading ? <StatSkeleton /> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat, i) => <StatCard key={stat.id} stat={stat} index={i} />)}
        </div>
      )}

      {/* ── Charts + Quick actions ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DashboardCharts />
        </div>
        <QuickActions actions={actions} />
      </div>

      {/* ── HR panels ─────────────────────────────────────────────────────────── */}
      {canHr && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2"><AttendanceCard summary={attSummary} leaveSummary={leaveSummary} /></div>
          <PayrollCard summary={payrollSummary} currency={currency} />
        </div>
      )}

      {/* ── Activity feed ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {auditLoading ? (
            <Card><CardHeader><CardTitle>{t("activity.title")}</CardTitle><CardDescription>{t("activity.subtitle")}</CardDescription></CardHeader>
              <CardContent className="space-y-3 p-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex animate-pulse gap-3">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2"><div className="h-3.5 w-48 rounded bg-muted" /><div className="h-3 w-32 rounded bg-muted" /></div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : activities.length > 0 ? (
            <ActivityFeed activities={activities} />
          ) : (
            <Card>
              <CardHeader><CardTitle>{t("activity.title")}</CardTitle><CardDescription>{t("activity.subtitle")}</CardDescription></CardHeader>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">{t("activity.empty")}</CardContent>
            </Card>
          )}
        </div>

        {/* Pipeline / snapshot */}
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{canCrm ? t("pipeline.title") : t("pipeline.snapshotTitle")}</CardTitle>
            <CardDescription>{canCrm ? t("pipeline.subtitle") : t("pipeline.snapshotSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {canCrm ? (
              <>
                <div className="rounded-xl border border-border bg-gradient-to-br from-violet-500/10 to-transparent p-4">
                  <p className="text-xs text-muted-foreground">{t("pipeline.openValue")}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(deals?.totalValue ?? 0, currency)}</p>
                </div>
                {[
                  { label: t("pipeline.wonValue"), value: formatCurrency(deals?.wonValue ?? 0, currency), color: "text-success" },
                  { label: t("pipeline.winRate"), value: `${Math.round(deals?.winRate ?? 0)}%`, color: "text-primary" },
                  { label: t("pipeline.avgDealSize"), value: formatCurrency(deals?.avgDealSize ?? 0, currency), color: "text-foreground" },
                  { label: t("pipeline.qualifiedLeads"), value: formatNumber(leads?.qualified ?? 0), color: "text-blue-600 dark:text-blue-400" },
                ].map((r) => (
                  <div key={r.label} className="flex items-center justify-between border-b border-border/30 py-1.5 last:border-0">
                    <span className="text-xs text-muted-foreground">{r.label}</span>
                    <span className={cn("text-sm font-semibold tabular-nums", r.color)}>{r.value}</span>
                  </div>
                ))}
                <Link to="/crm/pipeline" className="mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/5">
                  {t("pipeline.viewPipeline")} <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </>
            ) : (
              [
                ...(canSeeUsers ? [{ label: t("pipeline.teamMembers"), value: formatNumber(usersData?.totalCount ?? 0) }] : []),
                ...(canSeeRoles ? [{ label: t("pipeline.roles"), value: formatNumber(rolesData?.items?.length ?? 0) }] : []),
                { label: t("pipeline.yourPermissions"), value: formatNumber(user?.permissions?.length ?? 0) },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between border-b border-border/30 py-2 last:border-0">
                  <span className="text-xs text-muted-foreground">{r.label}</span>
                  <span className="text-sm font-semibold tabular-nums">{r.value}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
