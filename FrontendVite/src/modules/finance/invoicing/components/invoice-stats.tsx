import * as React from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { DollarSign, CheckCircle2, AlertTriangle, Clock, FileEdit } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { InvoiceSummaryDto } from "@/lib/finance/finance.api";
import type { Currency } from "@/types/global";
import type { TFunction } from "i18next";

interface InvoiceStatsProps {
  summary: InvoiceSummaryDto;
}

const stats = (summary: InvoiceSummaryDto, currency: Currency, t: TFunction) => [
  {
    label: t("invoicing.stats.totalInvoiced"),
    value: formatCurrency(summary.totalAmount, currency),
    sub: t("invoicing.stats.invoicesCount", { count: summary.totalInvoices }),
    icon: DollarSign,
    color: "text-primary bg-primary/10",
  },
  {
    label: t("invoicing.stats.collected"),
    value: formatCurrency(summary.totalPaid, currency),
    sub: t("invoicing.stats.collectedSub"),
    icon: CheckCircle2,
    color: "text-success bg-success/10",
  },
  {
    label: t("invoicing.stats.outstanding"),
    value: formatCurrency(summary.totalOutstanding, currency),
    sub: t("invoicing.stats.outstandingSub"),
    icon: Clock,
    color: "text-warning bg-warning/10",
  },
  {
    label: t("invoicing.stats.overdue"),
    value: formatCurrency(summary.totalOverdue, currency),
    sub: t("invoicing.stats.overdueSub"),
    icon: AlertTriangle,
    color: "text-destructive bg-destructive/10",
  },
  {
    label: t("invoicing.stats.drafts"),
    value: String(summary.draftCount),
    sub: t("invoicing.stats.draftsSub"),
    icon: FileEdit,
    color: "text-muted-foreground bg-muted",
  },
];

export function InvoiceStats({ summary }: InvoiceStatsProps) {
  const { t } = useTranslation("finance");
  const currency = useCurrency();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {stats(summary, currency, t).map((stat, i) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <Card className="card-hover">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${stat.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                  <p className="font-bold text-sm leading-tight">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground/70">{stat.sub}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

