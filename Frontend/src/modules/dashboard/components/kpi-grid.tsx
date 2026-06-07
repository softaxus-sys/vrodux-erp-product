"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn, formatCurrency, formatNumber, formatPercentage } from "@/lib/utils";
import type { KpiCard } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import {
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";

interface KpiCardProps {
  card: KpiCard;
  index: number;
}

function KpiCardComponent({ card, index }: KpiCardProps) {
  const colorMap = {
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
    info: "text-info bg-info/10",
  };

  const chartColorMap = {
    primary: "#3b82f6",
    success: "#22c55e",
    warning: "#f59e0b",
    destructive: "#ef4444",
    info: "#06b6d4",
  };

  const chartColor = chartColorMap[card.color ?? "primary"];

  const formattedValue =
    card.format === "currency" && typeof card.value === "number"
      ? formatCurrency(card.value, card.currency)
      : card.format === "number" && typeof card.value === "number"
        ? formatNumber(card.value)
        : String(card.value);

  const ChangeIcon =
    card.changeType === "increase"
      ? TrendingUp
      : card.changeType === "decrease"
        ? TrendingDown
        : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.07 }}
    >
      <Card className="card-hover overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-4">
            <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
            {card.change !== undefined && (
              <div
                className={cn(
                  "flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full",
                  card.changeType === "increase"
                    ? "bg-success/10 text-success"
                    : card.changeType === "decrease"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-muted text-muted-foreground"
                )}
              >
                <ChangeIcon className="h-3 w-3" />
                {formatPercentage(Math.abs(card.change ?? 0))}
              </div>
            )}
          </div>

          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-2xl font-bold tracking-tight">{formattedValue}</p>
              {card.changeLabel && (
                <p className="text-xs text-muted-foreground mt-0.5">{card.changeLabel}</p>
              )}
            </div>

            {card.trend && card.trend.length > 0 && (
              <div className="h-12 w-24 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={card.trend}>
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={chartColor}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function KpiGrid({ cards }: { cards: KpiCard[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <KpiCardComponent key={card.id} card={card} index={i} />
      ))}
    </div>
  );
}
