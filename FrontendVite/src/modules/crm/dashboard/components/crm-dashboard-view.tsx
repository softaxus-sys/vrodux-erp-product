import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { TrendingUp, Users, Briefcase, Target, DollarSign, CheckCircle2, ListTodo, AlertTriangle } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useCrmDashboard } from "@/hooks/crm/use-crm";
import { useCurrency } from "@/hooks/use-currency";

const STAGE_KEYS = new Set(["lead", "qualified", "proposal", "negotiation", "won", "lost"]);
const FUNNEL_KEYS = new Set(["new", "contacted", "qualified", "converted"]);

export function CrmDashboardView() {
  const { t } = useTranslation("crm");
  const { data, isLoading } = useCrmDashboard();
  const CUR = useCurrency();

  if (isLoading || !data) {
    return <div className="p-12 text-center text-sm text-muted-foreground">{t("dashboard.loading")}</div>;
  }

  const stats = [
    { label: t("dashboard.openPipeline"), value: formatCurrency(data.openPipelineValue, CUR), icon: DollarSign, color: "text-primary", bg: "bg-primary/10" },
    { label: t("dashboard.wonRevenue"), value: formatCurrency(data.wonValue, CUR), icon: TrendingUp, color: "text-success", bg: "bg-success/10" },
    { label: t("dashboard.winRate"), value: `${data.winRate}%`, icon: Target, color: "text-violet-600", bg: "bg-violet-100 dark:bg-violet-900/30" },
    { label: t("dashboard.totalLeads"), value: data.totalLeads, icon: Users, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30" },
    { label: t("dashboard.activeDeals"), value: data.totalDeals, icon: Briefcase, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30" },
    { label: t("dashboard.openTasks"), value: data.openTasks, icon: ListTodo, color: "text-slate-600", bg: "bg-slate-100 dark:bg-slate-800/50" },
  ];

  const maxFunnel = Math.max(1, ...data.leadFunnel.map(f => f.count));
  const maxPipeVal = Math.max(1, ...data.pipelineByStage.map(p => p.value));
  const maxSource = Math.max(1, ...data.leadsBySource.map(s => s.count));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <TrendingUp className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("dashboard.subtitle")}</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-xl p-4">
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mb-2", s.bg)}>
                <Icon className={cn("h-4.5 w-4.5", s.color)} />
              </div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="font-bold text-lg leading-tight mt-0.5">{s.value}</p>
            </motion.div>
          );
        })}
      </div>

      {data.overdueTasks > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-destructive/10 text-destructive px-4 py-2.5 text-sm font-medium">
          <AlertTriangle className="h-4 w-4" />{t("dashboard.overdueTasks", { count: data.overdueTasks })}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Pipeline by stage */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-bold mb-4">{t("dashboard.pipelineByStage")}</h3>
          <div className="space-y-3">
            {data.pipelineByStage.map(p => (
              <div key={p.stage}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{STAGE_KEYS.has(p.stage) ? t(`stage.${p.stage}`) : p.stage} <span className="text-muted-foreground">({p.count})</span></span>
                  <span className="tabular-nums text-muted-foreground">{formatCurrency(p.value, CUR)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full", p.stage === "won" ? "bg-success" : p.stage === "lost" ? "bg-destructive" : "bg-primary")}
                    style={{ width: `${(p.value / maxPipeVal) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lead funnel */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-bold mb-4">{t("dashboard.leadFunnel")}</h3>
          <div className="space-y-3">
            {data.leadFunnel.map(f => (
              <div key={f.stage}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{FUNNEL_KEYS.has(f.stage) ? t(`funnel.${f.stage}`) : f.stage}</span>
                  <span className="tabular-nums text-muted-foreground">{f.count}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${(f.count / maxFunnel) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" />{t("dashboard.wonLost")}</span>
            <span className="font-semibold">{data.wonCount} / {data.lostCount}</span>
          </div>
        </div>
      </div>

      {/* Leads by source */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-bold mb-4">{t("dashboard.leadsBySource")}</h3>
        {data.leadsBySource.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("dashboard.noLeads")}</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
            {data.leadsBySource.map(s => (
              <div key={s.source}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{t(`source.${s.source}`, { defaultValue: s.source.replace(/_/g, " ") })}</span>
                  <span className="tabular-nums text-muted-foreground">{s.count}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-violet-500" style={{ width: `${(s.count / maxSource) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
