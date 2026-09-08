import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, Target, Award, BarChart3, Percent } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, fitTextClass, cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { CrmSummaryDto } from "@/lib/crm/crm.api";

interface Props { summary: CrmSummaryDto; }

export function PipelineStats({ summary }: Props) {
  const { t } = useTranslation("crm");
  const currency = useCurrency();
  const stats = [
    { label: t("pipeline.stats.pipelineValue"), value: formatCurrency(summary.totalValue, currency),   sub: t("pipeline.stats.activeDeals"),       icon: DollarSign, color: "text-primary bg-primary/10" },
    { label: t("pipeline.stats.wonValue"),      value: formatCurrency(summary.wonValue, currency),      sub: t("pipeline.stats.closedThisQuarter"), icon: Award,      color: "text-success bg-success/10" },
    { label: t("pipeline.stats.winRate"),       value: `${summary.winRate}%`,                        sub: t("pipeline.stats.wonVsLost"),         icon: Percent,    color: "text-info bg-info/10" },
    { label: t("pipeline.stats.totalDeals"),    value: summary.totalDeals,                           sub: t("pipeline.stats.allStages"),         icon: BarChart3,  color: "text-violet-600 bg-violet-100 dark:bg-violet-900/20" },
    { label: t("pipeline.stats.avgDealSize"),   value: formatCurrency(summary.avgDealSize, currency),   sub: t("pipeline.stats.perActiveDeal"),     icon: TrendingUp, color: "text-warning bg-warning/10" },
    { label: t("pipeline.stats.lostDeals"),     value: summary.lostDeals,                            sub: t("pipeline.stats.needFollowUp"),      icon: Target,     color: "text-destructive bg-destructive/10" },
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
                  <p className={cn("font-bold leading-tight truncate", fitTextClass(s.value, "lg"))} title={String(s.value)}>{s.value}</p>
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

