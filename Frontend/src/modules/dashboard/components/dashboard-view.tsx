"use client";

import * as React from "react";
import { useAuthStore } from "@/store/auth.store";
import { KpiGrid } from "./kpi-grid";
import { RevenueChart } from "./revenue-chart";
import { ActivityFeed } from "./activity-feed";
import { UpcomingPayments } from "./upcoming-payments";
import { TopPerformers } from "./top-performers";
import { ModuleUsageChart } from "./module-usage-chart";
import { useKpiCards, useRecentActivity, useTopPerformers, useUpcomingPayments } from "@/hooks/dashboard/use-dashboard";

export function DashboardView() {
  const { user } = useAuthStore();
  const { data: kpiCards = [] }          = useKpiCards();
  const { data: recentActivity = [] }    = useRecentActivity();
  const { data: topPerformers = [] }     = useTopPerformers();
  const { data: upcomingPayments = [] }  = useUpcomingPayments();
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {greeting}, {user?.name?.split(" ")[0] ?? "there"} 👋
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Here's what's happening across your enterprise today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium">
              {new Date().toLocaleDateString("en-AE", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            <p className="text-xs text-muted-foreground">Dubai, UAE (GST+4)</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <KpiGrid cards={kpiCards} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <RevenueChart />
        </div>
        <div>
          <ModuleUsageChart />
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActivityFeed activities={recentActivity} />
        </div>
        <div className="space-y-6">
          <UpcomingPayments payments={upcomingPayments} />
          <TopPerformers performers={topPerformers} />
        </div>
      </div>
    </div>
  );
}
