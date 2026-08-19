import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Layers, Scale, CheckCircle2, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { CrmSummaryDto } from "@/lib/crm/crm.api";

interface Props { summary: CrmSummaryDto; }

/**
 * Forecast roll-up across all open deals (excludes won/lost).
 * Weighted = sum of value times probability. Commit / Best case use each deal's forecast category.
 */
export function ForecastBar({ summary }: Props) {
  const { t } = useTranslation("crm");
  const currency = useCurrency();
  const cells = [
    { label: t("pipeline.forecast.openPipeline"),     value: summary.openValue,     sub: t("pipeline.forecast.allActiveDeals"),     icon: Layers,       color: "text-slate-600 bg-slate-100 dark:bg-slate-800/50" },
    { label: t("pipeline.forecast.weightedForecast"), value: summary.weightedValue, sub: t("pipeline.forecast.probabilityAdjusted"), icon: Scale,        color: "text-primary bg-primary/10" },
    { label: t("pipeline.forecast.bestCase"),         value: summary.bestCaseValue, sub: t("pipeline.forecast.commitPlusBest"),     icon: TrendingUp,   color: "text-blue-600 bg-blue-100 dark:bg-blue-900/25" },
    { label: t("pipeline.forecast.commit"),           value: summary.commitValue,   sub: t("pipeline.forecast.highConfidence"),     icon: CheckCircle2, color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/25" },
  ];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("pipeline.forecast.heading")}</p>
          <p className="text-[11px] text-muted-foreground/70">{t("pipeline.forecast.openDealsOnly")}</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cells.map((c, i) => {
            const Icon = c.icon;
            return (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3"
              >
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${c.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{c.label}</p>
                  <p className="font-bold text-base leading-tight">{formatCurrency(c.value, currency)}</p>
                  <p className="text-[11px] text-muted-foreground/70 truncate">{c.sub}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
