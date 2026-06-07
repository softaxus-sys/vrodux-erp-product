"use client";

import * as React from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useModuleUsageChart } from "@/hooks/dashboard/use-dashboard";

export function ModuleUsageChart() {
  const { data: chartData = [] } = useModuleUsageChart();
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Module Activity</CardTitle>
        <CardDescription>Usage distribution across ERP modules</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <RadarChart data={chartData}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            />
            <Radar
              name="Usage"
              dataKey="value"
              stroke="hsl(221.2 83.2% 53.3%)"
              fill="hsl(221.2 83.2% 53.3%)"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
