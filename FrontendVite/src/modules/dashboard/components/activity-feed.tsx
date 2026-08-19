import * as React from "react";
import { useTranslation } from "react-i18next";
import { DollarSign, Users, ShoppingCart, Handshake, Package, Building, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ActivityItem } from "@/types";

const activityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  invoice_created: DollarSign,
  employee_onboarded: Users,
  po_approved: ShoppingCart,
  deal_won: Handshake,
  inventory_alert: Package,
  contract_renewed: Building,
};

const activityColors: Record<string, string> = {
  invoice_created: "bg-primary/10 text-primary",
  employee_onboarded: "bg-success/10 text-success",
  po_approved: "bg-info/10 text-info",
  deal_won: "bg-success/10 text-success",
  inventory_alert: "bg-warning/10 text-warning",
  contract_renewed: "bg-primary/10 text-primary",
};

export function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  const { t } = useTranslation("dashboard");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("activity.title")}</CardTitle>
        <CardDescription>{t("activity.liveFeed")}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/50">
          {activities.map((activity) => {
            const Icon = activityIcons[activity.type] ?? FileText;
            const colorClass = activityColors[activity.type] ?? "bg-muted text-muted-foreground";

            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors"
              >
                <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5", colorClass)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{activity.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {activity.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] text-muted-foreground/70">
                      {t("activity.by", { user: activity.user })}
                    </span>
                    <span className="text-[11px] text-muted-foreground/40">·</span>
                    <span className="text-[11px] text-muted-foreground/70">
                      {formatDate(activity.timestamp, "relative")}
                    </span>
                    <span className="text-[10px] capitalize px-1.5 py-0.5 rounded bg-muted text-muted-foreground ml-auto">
                      {activity.module.replace(/-/g, " ")}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

