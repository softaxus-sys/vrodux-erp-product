import * as React from "react";
import { motion } from "framer-motion";
import { Stamp, Clock, AlertTriangle, CalendarClock, DollarSign, FileWarning, IdCard, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatCurrency, getInitials } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useVisaDashboard } from "@/hooks/visa/use-visa";
import { CASE_STATUS_META, type VisaCaseStatus } from "@/lib/visa/visa.api";

function Bar({ label, value, max, tint }: { label: string; value: number; max: number; tint: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground truncate pr-2">{label}</span>
        <span className="text-muted-foreground shrink-0">{value}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", tint)} style={{ width: `${Math.max(pct, 3)}%` }} />
      </div>
    </div>
  );
}

export function VisaDashboardView() {
  const currency = useCurrency();
  const { data, isLoading } = useVisaDashboard();

  if (isLoading || !data) {
    return <div className="p-12 text-center text-sm text-muted-foreground">Loading visa dashboard…</div>;
  }

  const stats = [
    { label: "Total Cases",      value: data.totalCases,                                          sub: "All time",        icon: Stamp,        color: "text-primary bg-primary/10" },
    { label: "Open",             value: data.openCases,                                           sub: "In progress",     icon: Clock,        color: "text-blue-600 bg-blue-100 dark:bg-blue-900/20" },
    { label: "Overdue",          value: data.overdueCases,                                        sub: "Past SLA",        icon: AlertTriangle, color: "text-destructive bg-destructive/10" },
    { label: "Due This Week",    value: data.dueThisWeek,                                         sub: "Next 7 days",     icon: CalendarClock, color: "text-warning bg-warning/10" },
    { label: "Expiring Visas",   value: data.expiringVisas90,                                     sub: "Within 90 days",  icon: IdCard,       color: "text-amber-600 bg-amber-100 dark:bg-amber-900/20" },
    { label: "Open Fees",        value: formatCurrency(data.openServiceFees + data.openGovtFees, currency), sub: "Service + govt", icon: DollarSign, color: "text-success bg-success/10" },
  ];

  const maxStatus = Math.max(1, ...data.byStatus.map(s => s.count));
  const maxType = Math.max(1, ...data.byType.map(s => s.count));
  const maxRevenue = Math.max(1, ...data.revenueByType.map(r => r.serviceFees + r.govtFees));
  const maxWorkload = Math.max(1, ...data.workload.map(w => w.openCount));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Visa Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Case pipeline, workload, revenue and upcoming expiries</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="card-hover">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", s.color)}><s.icon className="h-4 w-4" /></div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{s.label}</p>
                  <p className="font-bold text-base leading-tight">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground/70">{s.sub}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By status */}
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-4">Cases by status</h3>
            {data.byStatus.length === 0 ? <p className="text-xs text-muted-foreground">No cases yet.</p> : (
              <div className="space-y-3">
                {data.byStatus.map(s => (
                  <Bar key={s.key} label={CASE_STATUS_META[s.key as VisaCaseStatus]?.label ?? s.key} value={s.count} max={maxStatus} tint="bg-primary" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* By type */}
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-4">Cases by visa type</h3>
            {data.byType.length === 0 ? <p className="text-xs text-muted-foreground">No cases yet.</p> : (
              <div className="space-y-3">
                {data.byType.slice(0, 8).map(s => (
                  <Bar key={s.key} label={s.key} value={s.count} max={maxType} tint="bg-violet-500" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue by type */}
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-4">Revenue by visa type</h3>
            {data.revenueByType.length === 0 ? <p className="text-xs text-muted-foreground">No revenue yet.</p> : (
              <div className="space-y-3">
                {data.revenueByType.slice(0, 8).map(r => (
                  <Bar key={r.key} label={`${r.key} · ${formatCurrency(r.serviceFees + r.govtFees, currency)}`}
                    value={Math.round(r.serviceFees + r.govtFees)} max={maxRevenue} tint="bg-success" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* PRO workload */}
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-1.5"><Users className="h-4 w-4" />PRO workload (open cases)</h3>
            {data.workload.length === 0 ? <p className="text-xs text-muted-foreground">No assigned open cases.</p> : (
              <div className="space-y-2">
                {data.workload.slice(0, 8).map(w => (
                  <div key={w.assignedTo} className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                      {getInitials(w.assignedTo)}
                    </div>
                    <span className="text-sm flex-1 truncate">{w.assignedTo}</span>
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.max(Math.round((w.openCount / maxWorkload) * 100), 5)}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-6 text-right">{w.openCount}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(data.expiringDocuments30 > 0 || data.expiringPassports90 > 0 || data.expiringVisas90 > 0) && (
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <FileWarning className="h-5 w-5 text-warning shrink-0" />
            <p className="text-sm">
              <span className="font-semibold">{data.expiringVisas90}</span> visa(s) and{" "}
              <span className="font-semibold">{data.expiringPassports90}</span> passport(s) expiring within 90 days,{" "}
              plus <span className="font-semibold">{data.expiringDocuments30}</span> document(s) within 30 days —
              see the <span className="font-medium">Renewals</span> page.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
