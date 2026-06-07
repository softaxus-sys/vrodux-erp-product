"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Users, UserCheck, Plane, Clock, AlertTriangle, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
interface HrSummary {
  total: number;
  active: number;
  onLeave: number;
  probation: number;
  newThisMonth: number;
  expiringDocuments: number;
  departments: number;
}

interface Props { summary: HrSummary; }

export function EmployeeStats({ summary }: Props) {
  const stats = [
    { label: "Total Employees", value: summary.total, sub: "Across all branches", icon: Users, color: "text-primary bg-primary/10" },
    { label: "Active", value: summary.active, sub: "Currently working", icon: UserCheck, color: "text-success bg-success/10" },
    { label: "On Leave", value: summary.onLeave, sub: "Annual / sick leave", icon: Plane, color: "text-info bg-info/10" },
    { label: "Probation", value: summary.probation, sub: "New joiners", icon: Clock, color: "text-warning bg-warning/10" },
    { label: "Expiring Docs", value: summary.expiringDocuments, sub: "Need renewal soon", icon: AlertTriangle, color: "text-destructive bg-destructive/10" },
    { label: "Departments", value: summary.departments, sub: "Active departments", icon: Building2, color: "text-muted-foreground bg-muted" },
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
