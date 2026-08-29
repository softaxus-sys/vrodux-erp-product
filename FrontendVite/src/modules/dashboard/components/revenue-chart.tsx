import * as React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { useRevenueChart } from "@/hooks/dashboard/use-dashboard";
import { useCurrency, useCurrencyOptions } from "@/hooks/use-currency";

const CustomTooltip = ({ active, payload, label }: any) => {
  const currency = useCurrency();
  if (active && payload?.length) {
    return (
      <div className="bg-card border border-border rounded-lg shadow-enterprise-md p-3 text-sm">
        <p className="font-semibold mb-2">{label}</p>
        <div className="space-y-1">
          <p className="text-primary">Revenue: {formatCurrency(payload[0]?.value, currency)}</p>
          <p className="text-muted-foreground">Expenses: {formatCurrency(payload[1]?.value, currency)}</p>
        </div>
      </div>
    );
  }
  return null;
};

export function RevenueChart() {
  const { data: chartData = [] } = useRevenueChart();
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Revenue Overview</CardTitle>
            <CardDescription>Monthly revenue vs expenses — FY 2026</CardDescription>
          </div>
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-primary" />
              <span className="text-muted-foreground">Revenue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
              <span className="text-muted-foreground">Expenses</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(221.2 83.2% 53.3%)" stopOpacity={0.15} />
                <stop offset="95%" stopColor="hsl(221.2 83.2% 53.3%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(215.4 16.3% 46.9%)" stopOpacity={0.1} />
                <stop offset="95%" stopColor="hsl(215.4 16.3% 46.9%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(221.2 83.2% 53.3%)"
              strokeWidth={2}
              fill="url(#colorRevenue)"
            />
            <Area
              type="monotone"
              dataKey="secondaryValue"
              stroke="hsl(215.4 16.3% 46.9%)"
              strokeWidth={1.5}
              fill="url(#colorExpenses)"
              strokeDasharray="4 2"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

