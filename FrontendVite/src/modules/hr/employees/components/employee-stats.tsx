import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Users, UserCheck, Plane, Clock, AlertTriangle, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { HrSummaryDto } from "@/lib/hr/hr.api";

interface Props { summary: HrSummaryDto; }

export function EmployeeStats({ summary }: Props) {
  const { t } = useTranslation("hr");
  const stats = [
    { label: t("employees.stats.total"), value: summary.total, sub: t("employees.stats.totalSub"), icon: Users, color: "text-primary bg-primary/10" },
    { label: t("employees.stats.active"), value: summary.active, sub: t("employees.stats.activeSub"), icon: UserCheck, color: "text-success bg-success/10" },
    { label: t("employees.stats.onLeave"), value: summary.onLeave, sub: t("employees.stats.onLeaveSub"), icon: Plane, color: "text-info bg-info/10" },
    { label: t("employees.stats.probation"), value: summary.probation, sub: t("employees.stats.probationSub"), icon: Clock, color: "text-warning bg-warning/10" },
    { label: t("employees.stats.expiringDocs"), value: summary.expiringDocuments, sub: t("employees.stats.expiringDocsSub"), icon: AlertTriangle, color: "text-destructive bg-destructive/10" },
    { label: t("employees.stats.departments"), value: summary.departments, sub: t("employees.stats.departmentsSub"), icon: Building2, color: "text-muted-foreground bg-muted" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
      {stats.map((s, i) => {
        const Icon = s.icon;
        return (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="card-hover">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{s.label}</p>
                  <p className="font-bold text-lg leading-tight">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground/70 truncate">{s.sub}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

