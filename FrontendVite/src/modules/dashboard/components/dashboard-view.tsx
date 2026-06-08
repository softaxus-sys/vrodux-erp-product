import * as React from "react";
import { motion } from "framer-motion";
import {
  Users, Shield, Clock, CheckCircle2, AlertCircle, Briefcase,
  UserCheck, UserX, Coffee, Building2, TrendingUp, Banknote,
  FileText, Activity, Server, Zap,
} from "lucide-react";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useUsers } from "@/hooks/identity/use-users";
import { useRoles } from "@/hooks/identity/use-roles";
import { useAuditLogs } from "@/hooks/identity/use-audit-logs";
import {
  useHrSummary,
  useAttendanceSummary,
  useLeaveSummary,
  usePayrollSummary,
} from "@/hooks/hr/use-hr";
import { KpiGrid } from "./kpi-grid";
import { ActivityFeed } from "./activity-feed";
import { DashboardCharts } from "./dashboard-charts";
import type { KpiCard, ActivityItem } from "@/types";
import type { AttendanceSummaryDto, LeaveSummaryDto, PayrollSummaryDto } from "@/lib/hr/hr.api";

// ── Backend service registry ───────────────────────────────────────────────────

type ServiceStatus = "live" | "pending";
interface BackendService {
  name:    string;
  modules: string[];
  status:  ServiceStatus;
}

const BACKEND_SERVICES: BackendService[] = [
  { name: "Identity",     modules: ["Auth", "Users", "Roles", "Audit"],          status: "live"    },
  { name: "HR",           modules: ["Employees", "Attendance", "Payroll"],        status: "live"    },
  { name: "Finance",      modules: ["Invoicing", "Journals", "GL", "Tax"],        status: "pending" },
  { name: "Sales",        modules: ["Orders", "Quotations", "Returns"],           status: "pending" },
  { name: "Purchase",     modules: ["PO", "Vendors", "Approvals"],               status: "pending" },
  { name: "Inventory",    modules: ["Stock", "Movements", "Transfers"],           status: "pending" },
  { name: "CRM",          modules: ["Leads", "Customers", "Pipeline"],            status: "pending" },
  { name: "POS",          modules: ["Retail", "Restaurant", "Sessions"],          status: "pending" },
  { name: "Construction", modules: ["Projects", "Sites", "Contractors"],          status: "pending" },
  { name: "Real Estate",  modules: ["Properties", "Units", "Tenants"],            status: "pending" },
  { name: "Hospitality",  modules: ["Rooms", "Bookings", "Housekeeping"],         status: "pending" },
  { name: "Dashboard",    modules: ["KPI API", "Charts API", "Reports API"],      status: "pending" },
];

const LIVE_COUNT = BACKEND_SERVICES.filter(s => s.status === "live").length;

// ── Skeletons ─────────────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse">
          <div className="h-3.5 w-24 bg-muted rounded mb-4" />
          <div className="h-7 w-28 bg-muted rounded mb-1.5" />
          <div className="h-3 w-20 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>System audit trail</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/50">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex gap-3 p-4 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-48 bg-muted rounded" />
                <div className="h-3 w-32 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Attendance Card ────────────────────────────────────────────────────────────

function AttendanceCard({
  summary,
  leaveSummary,
}: {
  summary: AttendanceSummaryDto | undefined;
  leaveSummary: LeaveSummaryDto | undefined;
}) {
  const total    = summary?.totalEmployees ?? 0;
  const present  = summary?.presentToday   ?? 0;
  const absent   = summary?.absentToday    ?? 0;
  const late     = summary?.lateToday      ?? 0;
  const onLeave  = summary?.onLeaveToday   ?? leaveSummary?.onLeaveToday ?? 0;
  const pct      = total > 0 ? Math.round((present / total) * 100) : 0;

  const rows = [
    { label: "Present",  value: present, Icon: UserCheck,  color: "text-success",     bg: "bg-success/10"     },
    { label: "Absent",   value: absent,  Icon: UserX,      color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Late",     value: late,    Icon: Clock,      color: "text-warning",     bg: "bg-warning/10"     },
    { label: "On Leave", value: onLeave, Icon: Coffee,     color: "text-primary",     bg: "bg-primary/10"     },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Today's Attendance</CardTitle>
            <CardDescription>
              {total > 0 ? `${pct}% of ${total} employees` : "Loading attendance…"}
            </CardDescription>
          </div>
          <span className={cn(
            "text-xs font-semibold px-2.5 py-1 rounded-full",
            pct >= 90 ? "bg-success/10 text-success" : pct >= 70 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive",
          )}>
            {pct}% present
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full rounded-full bg-success"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {rows.map(({ label, value, Icon, color, bg }) => (
            <div key={label} className={cn("flex items-center gap-2.5 rounded-xl p-3", bg)}>
              <Icon className={cn("h-4 w-4 shrink-0", color)} />
              <div>
                <p className={cn("text-xl font-bold leading-none", color)}>{value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Payroll Quick Card ─────────────────────────────────────────────────────────

function PayrollCard({ summary }: { summary: PayrollSummaryDto | undefined }) {
  const rows = [
    { label: "Net Payroll",    value: formatCurrency(summary?.totalNetPayroll   ?? 0, "AED"), Icon: Banknote,   color: "text-success" },
    { label: "Gross Payroll",  value: formatCurrency(summary?.totalGrossPayroll ?? 0, "AED"), Icon: TrendingUp,  color: "text-primary" },
    { label: "Deductions",     value: formatCurrency(summary?.totalDeductions   ?? 0, "AED"), Icon: FileText,    color: "text-warning"  },
    { label: "YTD Total",      value: formatCurrency(summary?.ytdTotal           ?? 0, "AED"), Icon: Activity,    color: "text-info"    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Payroll — {summary?.currentMonth ?? "Current Period"}</CardTitle>
        <CardDescription>
          {summary
            ? `${summary.paidRuns} paid · ${summary.pendingRuns} pending`
            : "Loading payroll data…"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map(({ label, value, Icon, color }) => (
          <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon className={cn("h-3.5 w-3.5", color)} />
              {label}
            </div>
            <span className={cn("text-sm font-semibold", color)}>{value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Backend Services Status ────────────────────────────────────────────────────

function BackendStatusGrid() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Backend Services</CardTitle>
            <CardDescription>
              {LIVE_COUNT} of {BACKEND_SERVICES.length} microservices live
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-success">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            {LIVE_COUNT} live
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {BACKEND_SERVICES.map((svc) => (
            <div
              key={svc.name}
              className={cn(
                "rounded-lg border p-2.5",
                svc.status === "live"
                  ? "border-success/30 bg-success/5"
                  : "border-border bg-muted/20",
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className={cn(
                  "h-1.5 w-1.5 rounded-full shrink-0",
                  svc.status === "live" ? "bg-success" : "bg-muted-foreground/40",
                )} />
                <span className="text-xs font-semibold truncate">{svc.name}</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight truncate">
                {svc.modules.join(" · ")}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Role Quick Info Card ───────────────────────────────────────────────────────

function RoleInfoCard({ role, permissions }: { role?: string; permissions: number }) {
  const roleLabel = (role ?? "user").replace(/_/g, " ");
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Your Access</CardTitle>
        <CardDescription>Role & permission summary</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <p className="text-sm font-semibold capitalize">{roleLabel}</p>
            <p className="text-xs text-muted-foreground">{permissions} permission{permissions !== 1 ? "s" : ""} granted</p>
          </div>
        </div>
        <div className="space-y-0 divide-y divide-border/40">
          {[
            { label: "Dashboard",  access: true  },
            { label: "HR",         access: role === "hr_manager" || role === "super_admin" || role === "tenant_admin" || role === "manager" },
            { label: "Finance",    access: role === "accountant"  || role === "super_admin" || role === "tenant_admin" || role === "manager" },
            { label: "Settings",   access: role === "super_admin" || role === "tenant_admin" },
          ].map(({ label, access }) => (
            <div key={label} className="flex items-center justify-between py-2">
              <span className="text-xs text-muted-foreground">{label}</span>
              {access
                ? <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                : <AlertCircle  className="h-3.5 w-3.5 text-muted-foreground/40" />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Dashboard View ────────────────────────────────────────────────────────

export function DashboardView() {
  const { user, isRole } = useAuthStore();

  const isAdmin = isRole(["super_admin", "tenant_admin"]);
  const isHR    = isRole(["hr_manager"]) || isAdmin;

  // ── Identity data (always available) ────────────────────────────────────────
  const { data: usersData,  isLoading: usersLoading  } = useUsers({ pageSize: 1 });
  const { data: rolesData                             } = useRoles();
  const { data: auditData,  isLoading: auditLoading  } = useAuditLogs({ pageSize: 15 });

  // ── HR data (available when HR service is up) ────────────────────────────────
  const { data: hrSummary     } = useHrSummary();
  const { data: attSummary    } = useAttendanceSummary();
  const { data: leaveSummary  } = useLeaveSummary();
  const { data: payrollSummary} = usePayrollSummary();

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // ── Build KPI cards ──────────────────────────────────────────────────────────

  const kpiCards: KpiCard[] = React.useMemo(() => {
    if (isHR) {
      return [
        {
          id:          "kpi-emp",
          label:       "Total Employees",
          value:       hrSummary?.totalEmployees ?? 0,
          format:      "number",
          color:       "primary",
          changeLabel: hrSummary
            ? `${hrSummary.departments} dept${hrSummary.departments !== 1 ? "s" : ""} · ${hrSummary.activeEmployees} active`
            : undefined,
        },
        {
          id:          "kpi-present",
          label:       "Present Today",
          value:       attSummary?.presentToday ?? 0,
          format:      "number",
          color:       "success",
          changeLabel: attSummary
            ? `${attSummary.lateToday} late · ${attSummary.absentToday} absent`
            : undefined,
        },
        {
          id:          "kpi-leave",
          label:       "Pending Leave Requests",
          value:       leaveSummary?.pending ?? 0,
          format:      "number",
          color:       "warning",
          changeLabel: leaveSummary
            ? `${leaveSummary.onLeaveToday} on leave today`
            : undefined,
        },
        {
          id:          "kpi-sys-users",
          label:       isAdmin ? "System Users" : "New Hires (Month)",
          value:       isAdmin ? (usersData?.totalCount ?? 0) : (hrSummary?.newThisMonth ?? 0),
          format:      "number",
          color:       "info",
          changeLabel: isAdmin
            ? `${rolesData?.items?.length ?? 0} roles configured`
            : (hrSummary ? `${hrSummary.probation} on probation` : undefined),
        },
      ];
    }

    // Generic role: show what Identity can provide
    return [
      {
        id:          "kpi-users",
        label:       "System Users",
        value:       usersData?.totalCount ?? 0,
        format:      "number",
        color:       "primary",
        changeLabel: `${rolesData?.items?.length ?? 0} roles configured`,
      },
      {
        id:          "kpi-roles",
        label:       "Active Roles",
        value:       rolesData?.items?.length ?? 0,
        format:      "number",
        color:       "info",
        changeLabel: "permission-based access",
      },
      {
        id:          "kpi-perms",
        label:       "Your Permissions",
        value:       user?.permissions?.length ?? 0,
        format:      "number",
        color:       "success",
        changeLabel: `role: ${(user?.role ?? "").replace(/_/g, " ")}`,
      },
      {
        id:          "kpi-services",
        label:       "Live Services",
        value:       `${LIVE_COUNT}/${BACKEND_SERVICES.length}`,
        format:      "text",
        color:       "warning",
        changeLabel: `${BACKEND_SERVICES.length - LIVE_COUNT} pending build`,
      },
    ];
  }, [isHR, isAdmin, hrSummary, attSummary, leaveSummary, usersData, rolesData, user]);

  // ── Convert audit logs → ActivityItem[] ─────────────────────────────────────

  const activities: ActivityItem[] = React.useMemo(() => {
    return (auditData?.items ?? []).slice(0, 12).map((log) => ({
      id:          log.id,
      type:        (log.action ?? "").toLowerCase().replace(/[\s.]+/g, "_"),
      title:       `${log.entityType ?? "System"}: ${log.action ?? "action"}`,
      description: log.succeeded
        ? (log.entityId ? `Entity: ${log.entityId}` : "Completed successfully")
        : "Action failed",
      user:        log.userName ?? "System",
      timestamp:   log.occurredOn,
      module:      "settings" as const,
    }));
  }, [auditData?.items]);

  const isLoading = usersLoading;

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold">
            {greeting}, {user?.name?.split(" ")[0] ?? "there"} 👋
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {isAdmin
              ? "Enterprise overview — all modules at a glance."
              : isHR
                ? "HR dashboard — your workforce at a glance."
                : "Here's what's happening in your workspace today."}
          </p>
        </div>
        <div className="hidden sm:block text-right shrink-0 ml-6">
          <p className="text-sm font-medium">
            {new Date().toLocaleDateString("en-PK", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </p>
          <p className="text-xs text-muted-foreground capitalize mt-0.5">
            {(user?.role ?? "").replace(/_/g, " ")}
          </p>
        </div>
      </motion.div>

      {/* ── KPI Cards ───────────────────────────────────────────────────────── */}
      {isLoading ? <KpiSkeleton /> : <KpiGrid cards={kpiCards} />}

      {/* ── Module Charts ────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
      >
        <div className="flex items-center gap-2 mb-5">
          <div className="h-px flex-1 bg-border/50" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 px-2 select-none">
            Module Analytics
          </span>
          <div className="h-px flex-1 bg-border/50" />
        </div>
        <DashboardCharts />
      </motion.div>

      {/* ── HR-specific panels (hr_manager + admins) ────────────────────────── */}
      {isHR && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <AttendanceCard summary={attSummary} leaveSummary={leaveSummary} />
          </div>
          <div>
            <PayrollCard summary={payrollSummary} />
          </div>
        </div>
      )}

      {/* ── Activity Feed + Side Panel ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {auditLoading ? (
            <ActivitySkeleton />
          ) : activities.length > 0 ? (
            <ActivityFeed activities={activities} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>System audit trail from Identity service</CardDescription>
              </CardHeader>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No recent audit activity found.
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          {isAdmin
            ? <BackendStatusGrid />
            : <RoleInfoCard role={user?.role} permissions={user?.permissions?.length ?? 0} />}
        </div>
      </div>

    </div>
  );
}
