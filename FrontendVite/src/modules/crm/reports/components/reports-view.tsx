import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  BarChart3, Workflow, Trophy, Gauge, Users, Filter, Radio, ListChecks, Building2,
  ChevronLeft, CalendarRange, RotateCcw, ShieldOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/ui/export-menu";
import { Can, useCan } from "@/components/auth/can";
import { useAssignableByTeam } from "@/hooks/identity/use-assignable-by-team";
import { REPORT_CATALOGUE, type ReportFilter, type ReportId } from "@/lib/crm/reports.api";
import {
  PipelinePanel, WinLossPanel, PerformancePanel, LeadSourcePanel,
  ConversionPanel, VelocityPanel, ActivityPanel, AccountRevenuePanel, type PanelProps,
} from "./report-panels";
import { exportPayloadCsv, exportPayloadPdf, type ReportExportPayload } from "./report-export";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Workflow, Trophy, Gauge, Users, Filter, Radio, ListChecks, Building2,
};

const PANELS: Record<ReportId, React.ComponentType<PanelProps>> = {
  pipeline:       PipelinePanel,
  "win-loss":     WinLossPanel,
  performance:    PerformancePanel,
  "lead-sources": LeadSourcePanel,
  conversion:     ConversionPanel,
  velocity:       VelocityPanel,
  activities:     ActivityPanel,
  accounts:       AccountRevenuePanel,
};

// Ranges are computed on use — a hardcoded preset list silently rots once its dates pass.
function iso(d: Date): string {
  return d.toISOString().split("T")[0];
}
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
}

const PRESETS: { id: string; labelKey: string; range: () => { from?: string; to?: string } }[] = [
  { id: "all",   labelKey: "allTime",   range: () => ({ from: undefined, to: undefined }) },
  { id: "30d",   labelKey: "last30",    range: () => ({ from: daysAgo(30), to: iso(new Date()) }) },
  { id: "90d",   labelKey: "last90",    range: () => ({ from: daysAgo(90), to: iso(new Date()) }) },
  { id: "mtd",   labelKey: "thisMonth", range: () => {
    const n = new Date();
    return { from: iso(new Date(n.getFullYear(), n.getMonth(), 1)), to: iso(n) };
  } },
  { id: "ytd",   labelKey: "thisYear",  range: () => {
    const n = new Date();
    return { from: iso(new Date(n.getFullYear(), 0, 1)), to: iso(n) };
  } },
];

const DEAL_STAGES = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];
const GROUPS = ["Sales", "Leads", "Accounts"] as const;

export function CrmReportsView() {
  const { t } = useTranslation("crm");
  const [searchParams, setSearchParams] = useSearchParams();

  // Deep link from the central Reports hub: /crm/reports?report=win-loss. Validated against the
  // catalogue so a stale or hand-typed id lands on the catalogue instead of a blank panel.
  const requested = searchParams.get("report");
  const initial = REPORT_CATALOGUE.some(r => r.id === requested) ? (requested as ReportId) : null;

  const [selected, setSelected] = React.useState<ReportId | null>(initial);

  // Consume the param once so a later "back to catalogue" isn't undone by a re-read on re-render.
  React.useEffect(() => {
    if (!requested) return;
    const next = new URLSearchParams(searchParams);
    next.delete("report");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested]);
  const [filter, setFilter] = React.useState<ReportFilter>({});
  const [preset, setPreset] = React.useState("all");
  const [exportPayload, setExportPayload] = React.useState<ReportExportPayload | null>(null);

  const canExport = useCan("crm.reports.export");

  // Owner filter, scoped to the people whose figures this caller can actually see.
  //
  // It used to read /api/users, which is [Authorize]-only and returns EVERY tenant user — so a team
  // lead saw other teams' leads and members in the dropdown, and could select someone outside their
  // scope. The reports themselves were never at risk (the guard scopes the data, so picking an
  // outsider just returned nothing), but the list leaked the tenant's roster and offered choices that
  // could only ever come back empty.
  //
  // The assignable pool is resolved server-side from the caller's tier — everyone for an admin, their
  // own team members for a team lead — which is exactly the right set, and it groups by team so the
  // filter reads the same way as the assignment pickers.
  const { groups: ownerGroups, options: users } = useAssignableByTeam();

  // Stable identity — panels register through this inside an effect, so a fresh function each render
  // would re-register (and re-render this component) on every tick.
  const register = React.useCallback((p: ReportExportPayload | null) => setExportPayload(p), []);

  const meta = selected ? REPORT_CATALOGUE.find(r => r.id === selected) : null;

  const applyPreset = (id: string) => {
    setPreset(id);
    setFilter(f => ({ ...f, ...PRESETS.find(p => p.id === id)!.range() }));
  };

  const resetFilters = () => { setPreset("all"); setFilter({}); };

  const hasActiveFilters = Boolean(filter.from || filter.to || filter.ownerUserId || filter.stage);

  /** Filter description embedded in every export, so a printed report explains its own scope. */
  const subtitle = React.useMemo(() => {
    const parts: string[] = [];
    parts.push(filter.from || filter.to
      ? `${filter.from ?? "…"} → ${filter.to ?? "…"}`
      : t("reports.filters.allTime"));
    if (filter.ownerUserId) {
      const u = users.find(x => x.id === filter.ownerUserId);
      parts.push(`${t("reports.filters.owner")}: ${u?.fullName || "—"}`);
    }
    if (filter.stage) parts.push(`${t("reports.filters.stage")}: ${t(`stage.${filter.stage}`, { defaultValue: filter.stage })}`);
    if (selected) parts.push(t("reports.filters.datedBy", { basis: t(`reports.basis.${selected}`) }));
    return parts.join(" · ");
  }, [filter, users, selected, t]);

  const Panel = selected ? PANELS[selected] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {selected && (
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rtl:rotate-180"
              onClick={() => setSelected(null)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <BarChart3 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">
              {meta ? t(`reports.catalogue.${meta.id}.title`) : t("reports.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {meta ? t(`reports.catalogue.${meta.id}.description`) : t("reports.subtitle")}
            </p>
          </div>
        </div>

        {selected && canExport && (
          <ExportMenu
            disabled={!exportPayload}
            onCsv={() => exportPayload && exportPayloadCsv(exportPayload)}
            onPdf={() => exportPayload && exportPayloadPdf(exportPayload)}
          />
        )}
      </div>

      {/* Filter bar — only meaningful once a report is open */}
      {selected && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <CalendarRange className="h-4 w-4 text-muted-foreground" />
            {PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                  preset === p.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                {t(`reports.filters.${p.labelKey}`)}
              </button>
            ))}

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs ms-auto" onClick={resetFilters}>
                <RotateCcw className="h-3 w-3" />
                {t("reports.filters.reset")}
              </Button>
            )}
          </div>

          <div className="flex items-end gap-3 flex-wrap">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">{t("reports.filters.from")}</span>
              <input
                type="date"
                value={filter.from ?? ""}
                max={filter.to || undefined}
                onChange={e => { setPreset("custom"); setFilter(f => ({ ...f, from: e.target.value || undefined })); }}
                className="h-9 rounded-md border border-border bg-card px-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">{t("reports.filters.to")}</span>
              <input
                type="date"
                value={filter.to ?? ""}
                min={filter.from || undefined}
                onChange={e => { setPreset("custom"); setFilter(f => ({ ...f, to: e.target.value || undefined })); }}
                className="h-9 rounded-md border border-border bg-card px-2 text-sm"
              />
            </label>

            <label className="flex flex-col gap-1 min-w-[180px]">
              <span className="text-[11px] text-muted-foreground">{t("reports.filters.owner")}</span>
              <select
                value={filter.ownerUserId ?? ""}
                onChange={e => setFilter(f => ({ ...f, ownerUserId: e.target.value || undefined }))}
                className="h-9 rounded-md border border-border bg-card px-2 text-sm"
              >
                <option value="">{t("reports.filters.everyone")}</option>
                {ownerGroups.map(g => (
                  <optgroup key={g.team} label={g.team}>
                    {/* Keyed by team + user — someone in two teams appears under each; the value is
                        the same user id either way, since the filter is by owner, not by team. */}
                    {g.members.map(u => (
                      <option key={`${g.team}-${u.id}`} value={u.id}>{u.fullName}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            {(selected === "pipeline" || selected === "velocity") && (
              <label className="flex flex-col gap-1 min-w-[150px]">
                <span className="text-[11px] text-muted-foreground">{t("reports.filters.stage")}</span>
                <select
                  value={filter.stage ?? ""}
                  onChange={e => setFilter(f => ({ ...f, stage: e.target.value || undefined }))}
                  className="h-9 rounded-md border border-border bg-card px-2 text-sm"
                >
                  <option value="">{t("reports.filters.allStages")}</option>
                  {DEAL_STAGES.map(s => (
                    <option key={s} value={s}>{t(`stage.${s}`, { defaultValue: s })}</option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            {t("reports.filters.datedBy", { basis: t(`reports.basis.${selected}`) })}
          </p>
        </div>
      )}

      {/* Catalogue or the open report */}
      <AnimatePresence mode="wait">
        {!selected ? (
          <motion.div key="catalogue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="space-y-6">
            {GROUPS.map(group => {
              const items = REPORT_CATALOGUE.filter(r => r.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group}>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    {t(`reports.groups.${group}`)}
                  </h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {items.map((r, i) => {
                      const Icon = ICONS[r.icon] ?? BarChart3;
                      return (
                        <motion.button
                          key={r.id}
                          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          onClick={() => setSelected(r.id)}
                          className="text-start bg-card border border-border rounded-xl p-4 hover:border-primary/50 hover:shadow-sm transition-all"
                        >
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                            <Icon className="h-4.5 w-4.5 text-primary" />
                          </div>
                          <p className="font-semibold text-sm">{t(`reports.catalogue.${r.id}.title`)}</p>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            {t(`reports.catalogue.${r.id}.description`)}
                          </p>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div key={selected} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {Panel && <Panel filter={filter} register={register} subtitle={subtitle} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Route wrapper: reports are their own permission, so deny once here rather than 403-ing per chart. */
export function CrmReportsPage() {
  const { t } = useTranslation("crm");
  return (
    <Can
      permission="crm.reports.view"
      fallback={
        <div className="p-12 text-center">
          <ShieldOff className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm font-medium">{t("reports.noAccessTitle")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("reports.noAccessHint")}</p>
        </div>
      }
    >
      <CrmReportsView />
    </Can>
  );
}
