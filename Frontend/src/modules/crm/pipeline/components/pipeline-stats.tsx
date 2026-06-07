"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, Target, Award, BarChart3, Percent } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { DealSummaryDto } from "@/lib/crm/deals.api";

interface Props { summary: DealSummaryDto; }

export function PipelineStats({ summary }: Props) {
  const stats = [
    { label: "Pipeline Value",  value: formatCurrency(summary.totalValue, "AED"),   sub: "Active deals",         icon: DollarSign, color: "text-primary bg-primary/10" },
    { label: "Won Value",       value: formatCurrency(summary.wonValue, "AED"),      sub: "Closed this quarter",  icon: Award,      color: "text-success bg-success/10" },
    { label: "Win Rate",        value: `${summary.winRate}%`,                        sub: "Won vs Lost",          icon: Percent,    color: "text-info bg-info/10" },
    { label: "Total Deals",     value: summary.totalDeals,                           sub: "All stages",           icon: BarChart3,  color: "text-violet-600 bg-violet-100 dark:bg-violet-900/20" },
    { label: "Avg Deal Size",   value: formatCurrency(summary.avgDealSize, "AED"),   sub: "Per active deal",      icon: TrendingUp, color: "text-warning bg-warning/10" },
    { label: "Lost Deals",      value: summary.lostDeals,                            sub: "Need follow-up",       icon: Target,     color: "text-destructive bg-destructive/10" },
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
                  <p className="font-bold text-base leading-tight">{s.value}</p>
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
