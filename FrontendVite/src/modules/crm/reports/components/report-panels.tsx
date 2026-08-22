import * as React from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { ReportFilter, OwnerPerformanceRow } from "@/lib/crm/reports.api";
import {
  usePipelineReport, useWinLossReport, usePerformanceReport, useLeadSourceReport,
  useConversionReport, useVelocityReport, useActivityReport, useAccountRevenueReport,
} from "@/hooks/crm/use-crm-reports";
import {
  StatTile, ReportCard, BarList, ReportTable, EmptyState, ReportLoading, ReportError,
  useReportFormat, type Column,
} from "./report-primitives";
import { useRegisterExport, type RegisterExport } from "./report-export";

export interface PanelProps {
  filter:   ReportFilter;
  register: RegisterExport;
  /** Human-readable description of the active filter, embedded in exports. */
  subtitle: string;
}

/** Shared query-state handling so every panel behaves identically while loading or failing. */
function useGuard(query: { isLoading: boolean; error: unknown; data: unknown }) {
  if (query.isLoading) return <ReportLoading />;
  if (query.error) return <ReportError message={(query.error as Error)?.message} />;
  if (!query.data) return <EmptyState />;
  return null;
}

/**
 * Translated label for a value that comes back from the backend as a raw key (stage, source, …).
 * Falls back to a title-cased version of the key, so a value the backend starts sending before a
 * translation exists still renders readably instead of showing the raw key.
 */
function useLabels() {
  const { t } = useTranslation("crm");
  const titleCase = (v: string) =>
    v.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return React.useMemo(() => ({
    stage:    (v: string) => t(`stage.${v}`,        { defaultValue: titleCase(v) }),
    source:   (v: string) => t(`source.${v}`,       { defaultValue: titleCase(v) }),
    forecast: (v: string) => t(`forecast.${v}`,     { defaultValue: titleCase(v) }),
    activity: (v: string) => t(`activityType.${v}`, { defaultValue: titleCase(v) }),
    funnel:   (v: string) => t(`funnel.${v}`,       { defaultValue: titleCase(v) }),
  }), [t]);
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
      <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <p className="text-xs text-muted-foreground">{children}</p>
    </div>
  );
}

// ── 1. Sales pipeline ────────────────────────────────────────────────────────

export function PipelinePanel({ filter, register, subtitle }: PanelProps) {
  const { t } = useTranslation("crm");
  const L = useLabels();
  const q = usePipelineReport(filter);
  const CUR = useCurrency();
  const d = q.data;

  useRegisterExport(register, d ? {
    title: t("reports.catalogue.pipeline.title"), subtitle,
    columns: [t("reports.common.stage"), t("reports.common.deals"), t("reports.common.value"),
              t("reports.common.weighted"), t("reports.common.avgSize")],
    rows: d.byStage.map(s => [L.stage(s.stage), s.count, s.value, s.weightedValue, s.avgDealSize]),
  } : null);

  const guard = useGuard(q);
  if (guard || !d) return guard;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatTile index={0} label={t("reports.pipeline.openDeals")} value={d.openCount} />
        <StatTile index={1} label={t("reports.pipeline.openPipeline")} value={formatCurrency(d.openValue, CUR)} tone="primary" />
        <StatTile index={2} label={t("reports.pipeline.weightedForecast")} value={formatCurrency(d.weightedValue, CUR)}
          hint={t("reports.pipeline.weightedHint")} />
        <StatTile index={3} label={t("reports.pipeline.commit")} value={formatCurrency(d.commitValue, CUR)} tone="success" />
        <StatTile index={4} label={t("reports.pipeline.avgDeal")} value={formatCurrency(d.avgDealSize, CUR)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ReportCard title={t("reports.pipeline.valueByStage")} subtitle={t("reports.pipeline.valueByStageSub")}>
          <BarList rows={d.byStage.map(s => ({
            label: L.stage(s.stage), value: s.value, display: formatCurrency(s.value, CUR),
            sub: `· ${s.count}`,
            color: s.stage === "won" ? "bg-success" : s.stage === "lost" ? "bg-destructive" : "bg-primary",
          }))} />
        </ReportCard>

        <ReportCard title={t("reports.pipeline.forecastCategory")} subtitle={t("reports.pipeline.forecastCategorySub")}>
          <BarList
            rows={d.byForecastCategory.map(c => ({
              label: L.forecast(c.category), value: c.value,
              display: formatCurrency(c.value, CUR), sub: `· ${c.count}`,
            }))}
            emptyMessage={t("reports.pipeline.noForecast")}
          />
        </ReportCard>
      </div>

      <ReportCard title={t("reports.pipeline.stageDetail")}>
        <ReportTable
          rowKey={r => r.stage}
          rows={d.byStage}
          columns={[
            { key: "stage", header: t("reports.common.stage"),
              render: r => <span className="font-medium">{L.stage(r.stage)}</span> },
            { key: "count", header: t("reports.common.deals"), align: "right", render: r => r.count },
            { key: "value", header: t("reports.common.value"), align: "right", render: r => formatCurrency(r.value, CUR) },
            { key: "weighted", header: t("reports.common.weighted"), align: "right", render: r => formatCurrency(r.weightedValue, CUR) },
            { key: "avg", header: t("reports.common.avgSize"), align: "right", render: r => formatCurrency(r.avgDealSize, CUR) },
          ]}
        />
      </ReportCard>
    </div>
  );
}

// ── 2. Win / loss ────────────────────────────────────────────────────────────

export function WinLossPanel({ filter, register, subtitle }: PanelProps) {
  const { t } = useTranslation("crm");
  const { formatPeriod, pct, days } = useReportFormat();
  const q = useWinLossReport(filter);
  const CUR = useCurrency();
  const d = q.data;

  useRegisterExport(register, d ? {
    title: t("reports.catalogue.win-loss.title"), subtitle,
    columns: ["", t("reports.common.won"), t("reports.common.lost"),
              `${t("reports.common.won")} ${t("reports.common.value")}`,
              `${t("reports.common.lost")} ${t("reports.common.value")}`,
              t("reports.common.winRate")],
    rows: d.trend.map(x => [formatPeriod(x.period), x.won, x.lost, x.wonValue, x.lostValue, x.winRate]),
  } : null);

  const guard = useGuard(q);
  if (guard || !d) return guard;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatTile index={0} label={t("reports.common.won")} value={d.wonCount} tone="success"
          hint={formatCurrency(d.wonValue, CUR)} />
        <StatTile index={1} label={t("reports.common.lost")} value={d.lostCount} tone="danger"
          hint={formatCurrency(d.lostValue, CUR)} />
        <StatTile index={2} label={t("reports.common.winRate")} value={pct(d.winRate)} tone="primary" />
        <StatTile index={3} label={t("reports.winLoss.avgWonDeal")} value={formatCurrency(d.avgWonDealSize, CUR)} />
        <StatTile index={4} label={t("reports.winLoss.avgTimeToClose")} value={days(d.avgDaysToClose)} />
      </div>

      <ReportCard title={t("reports.winLoss.overTime")} subtitle={t("reports.winLoss.overTimeSub")}>
        {d.trend.length === 0 ? <EmptyState message={t("reports.winLoss.noClosed")} /> : (
          <div className="space-y-3">
            {d.trend.map(x => {
              const total = x.won + x.lost || 1;
              return (
                <div key={x.period}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xs font-medium">{formatPeriod(x.period)}</span>
                    <span className="text-xs text-muted-foreground">
                      {x.won} / {x.lost} · {pct(x.winRate)} · {formatCurrency(x.wonValue, CUR)}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden flex">
                    <div className="h-full bg-success" style={{ width: `${(x.won / total) * 100}%` }} />
                    <div className="h-full bg-destructive" style={{ width: `${(x.lost / total) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ReportCard>

      <ReportCard title={t("reports.winLoss.lossReasons")} subtitle={t("reports.winLoss.lossReasonsSub")}>
        <BarList
          rows={d.lossReasons.map(r => ({
            label: r.reason, value: r.count,
            display: `${r.count} · ${pct(r.share)}`,
            sub: `· ${formatCurrency(r.value, CUR)}`,
            color: "bg-destructive",
          }))}
          emptyMessage={t("reports.winLoss.noLost")}
        />
      </ReportCard>
    </div>
  );
}

// ── 3. Team performance ──────────────────────────────────────────────────────

export function PerformancePanel({ filter, register, subtitle }: PanelProps) {
  const { t } = useTranslation("crm");
  const { pct } = useReportFormat();
  const q = usePerformanceReport(filter);
  const CUR = useCurrency();
  const d = q.data;

  // Export carries a Team column and one row per (team, member), so the exported file matches what
  // is on screen. A member of two teams appears once per team — same as the rendered grouping.
  const exportRows = React.useMemo(() => {
    const row = (teamName: string, o: OwnerPerformanceRow) =>
      [teamName, o.ownerName, o.leadsOwned, o.leadsConverted, o.leadConversionRate,
       o.openDeals, o.openValue, o.wonDeals, o.wonValue, o.lostDeals, o.winRate,
       o.activitiesLogged, o.overdueActivities];

    if (!d) return [];
    const groups = d.teams ?? [];
    if (groups.length === 0) return d.owners.map(o => row("—", o));

    return [
      ...groups.flatMap(tm => tm.members.map(o => row(tm.teamName, o))),
      ...(d.ungrouped ?? []).map(o => row(t("reports.performance.unassignedTeam"), o)),
    ];
  }, [d, t]);

  useRegisterExport(register, d ? {
    title: t("reports.catalogue.performance.title"), subtitle, landscape: true,
    columns: [t("reports.performance.team"), t("reports.common.owner"), t("reports.common.leads"),
              t("reports.common.converted"), t("reports.performance.leadConv"), t("reports.common.deals"),
              t("reports.performance.openPipeline"), t("reports.common.won"),
              `${t("reports.common.won")} ${t("reports.common.value")}`,
              t("reports.common.lost"), t("reports.common.winRate"),
              t("reports.performance.activities"), t("reports.common.overdue")],
    rows: exportRows,
  } : null);

  const guard = useGuard(q);
  if (guard || !d) return guard;

  const teams = d.teams ?? [];
  const ungrouped = d.ungrouped ?? [];

  const columns: Column<typeof d.owners[number]>[] = [
    { key: "owner", header: t("reports.common.owner"),
      render: o => <span className="font-medium">{o.ownerName}</span> },
    { key: "leads", header: t("reports.common.leads"), align: "right", render: o => o.leadsOwned },
    { key: "conv", header: t("reports.common.converted"), align: "right",
      render: o => <>{o.leadsConverted} <span className="text-muted-foreground text-xs">({pct(o.leadConversionRate)})</span></> },
    { key: "open", header: t("reports.performance.openPipeline"), align: "right",
      render: o => <>{formatCurrency(o.openValue, CUR)} <span className="text-muted-foreground text-xs">({o.openDeals})</span></> },
    { key: "won", header: t("reports.common.won"), align: "right",
      render: o => <span className="text-success font-medium">{formatCurrency(o.wonValue, CUR)}</span> },
    { key: "winRate", header: t("reports.common.winRate"), align: "right", render: o => pct(o.winRate) },
    { key: "acts", header: t("reports.performance.activities"), align: "right", render: o => o.activitiesLogged },
    { key: "overdue", header: t("reports.common.overdue"), align: "right",
      render: o => o.overdueActivities > 0
        ? <span className="text-destructive font-medium">{o.overdueActivities}</span>
        : <span className="text-muted-foreground">0</span> },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile index={0} label={t("reports.performance.people")} value={d.owners.length} />
        <StatTile index={1} label={t("reports.performance.dealsWon")} value={d.totalWonDeals} tone="success" />
        <StatTile index={2} label={t("reports.performance.revenueWon")} value={formatCurrency(d.totalWonValue, CUR)} tone="success" />
        <StatTile index={3} label={t("reports.performance.topPerformer")}
          value={d.owners[0]?.ownerName ?? t("reports.common.none")}
          hint={d.owners[0] ? formatCurrency(d.owners[0].wonValue, CUR) : undefined} />
      </div>

      {/* Team-grouped scorecard. The API decides which teams the caller may see — every team for an
          admin or full-access role, only the teams they lead for a team lead — so this just renders
          what came back. Falls back to one flat table when no teams are visible, rather than showing
          an empty page to a tenant that has not set teams up. */}
      {teams.length > 0 ? (
        <div className="space-y-4">
          {teams.map(team => (
            <ReportCard
              key={team.teamId}
              title={team.teamName}
              subtitle={[
                team.teamLeadName ? `${t("reports.performance.teamLead")}: ${team.teamLeadName}` : null,
                // Counts members who actually own records in this period, not the team's roster —
                // labelled so it can't be misread as team size.
                t("reports.performance.membersWithActivity", { count: team.members.length }),
                `${t("reports.performance.teamTotals")}: ${formatCurrency(team.totalWonValue, CUR)}`,
              ].filter(Boolean).join(" · ")}
            >
              <ReportTable
                rowKey={(o, i) => o.ownerUserId ?? `${o.ownerName}-${i}`}
                rows={team.members}
                columns={columns}
                emptyMessage={t("reports.performance.noOwned")}
              />
            </ReportCard>
          ))}

          {ungrouped.length > 0 && (
            <ReportCard title={t("reports.performance.unassignedTeam")}>
              <ReportTable
                rowKey={(o, i) => o.ownerUserId ?? `${o.ownerName}-${i}`}
                rows={ungrouped}
                columns={columns}
                emptyMessage={t("reports.performance.noOwned")}
              />
            </ReportCard>
          )}
        </div>
      ) : (
        <ReportCard title={t("reports.performance.scorecard")} subtitle={t("reports.performance.scorecardSub")}>
          <ReportTable rowKey={(o, i) => o.ownerUserId ?? `${o.ownerName}-${i}`} rows={d.owners} columns={columns}
            emptyMessage={t("reports.performance.noOwned")} />
        </ReportCard>
      )}

      <ReportCard title={t("reports.performance.revenueByOwner")}>
        <BarList rows={d.owners.filter(o => o.wonValue > 0).map(o => ({
          label: o.ownerName, value: o.wonValue,
          display: formatCurrency(o.wonValue, CUR), sub: `· ${o.wonDeals}`, color: "bg-success",
        }))} emptyMessage={t("reports.performance.noRevenue")} />
      </ReportCard>
    </div>
  );
}

// ── 4. Lead source ROI ───────────────────────────────────────────────────────

export function LeadSourcePanel({ filter, register, subtitle }: PanelProps) {
  const { t } = useTranslation("crm");
  const L = useLabels();
  const { pct, days } = useReportFormat();
  const q = useLeadSourceReport(filter);
  const CUR = useCurrency();
  const d = q.data;

  useRegisterExport(register, d ? {
    title: t("reports.catalogue.lead-sources.title"), subtitle, landscape: true,
    columns: [t("reports.common.source"), t("reports.common.leads"), t("reports.common.converted"),
              t("reports.leadSources.convPct"), t("reports.common.value"), t("reports.common.deals"),
              t("reports.leadSources.wonValue"), t("reports.common.avgScore"),
              t("reports.leadSources.avgToConvert")],
    rows: d.sources.map(s => [L.source(s.source), s.leads, s.converted, s.conversionRate, s.estimatedValue,
      s.wonDeals, s.wonValue, s.avgScore, s.avgDaysToConvert]),
  } : null);

  const guard = useGuard(q);
  if (guard || !d) return guard;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile index={0} label={t("reports.common.leads")} value={d.totalLeads} />
        <StatTile index={1} label={t("reports.common.converted")} value={d.totalConverted} tone="success" />
        <StatTile index={2} label={t("reports.leadSources.conversionRate")} value={pct(d.overallConversionRate)} tone="primary" />
        <StatTile index={3} label={t("reports.leadSources.bestSource")}
          value={d.sources[0] ? L.source(d.sources[0].source) : t("reports.common.none")}
          hint={d.sources[0] ? formatCurrency(d.sources[0].wonValue, CUR) : undefined} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ReportCard title={t("reports.leadSources.leadsBySource")}>
          <BarList rows={d.sources.map(s => ({
            label: L.source(s.source), value: s.leads, display: String(s.leads),
            sub: `· ${pct(s.conversionRate)}`,
          }))} />
        </ReportCard>
        <ReportCard title={t("reports.leadSources.revenueBySource")} subtitle={t("reports.leadSources.revenueBySourceSub")}>
          <BarList rows={d.sources.filter(s => s.wonValue > 0).map(s => ({
            label: L.source(s.source), value: s.wonValue, display: formatCurrency(s.wonValue, CUR),
            sub: `· ${s.wonDeals}`, color: "bg-success",
          }))} emptyMessage={t("reports.leadSources.noAttributable")} />
        </ReportCard>
      </div>

      <ReportCard title={t("reports.leadSources.detail")}>
        <ReportTable
          rowKey={s => s.source}
          rows={d.sources}
          columns={[
            { key: "source", header: t("reports.common.source"),
              render: s => <span className="font-medium">{L.source(s.source)}</span> },
            { key: "leads", header: t("reports.common.leads"), align: "right", render: s => s.leads },
            { key: "conv", header: t("reports.common.converted"), align: "right", render: s => s.converted },
            { key: "rate", header: t("reports.leadSources.convPct"), align: "right", render: s => pct(s.conversionRate) },
            { key: "won", header: t("reports.leadSources.wonValue"), align: "right",
              render: s => <span className="text-success">{formatCurrency(s.wonValue, CUR)}</span> },
            { key: "score", header: t("reports.common.avgScore"), align: "right",
              render: s => s.avgScore || t("reports.common.none") },
            { key: "ttc", header: t("reports.leadSources.avgToConvert"), align: "right",
              render: s => days(s.avgDaysToConvert) },
          ]}
        />
      </ReportCard>
    </div>
  );
}

// ── 5. Lead conversion ───────────────────────────────────────────────────────

export function ConversionPanel({ filter, register, subtitle }: PanelProps) {
  const { t } = useTranslation("crm");
  const L = useLabels();
  const { formatPeriod, pct, days } = useReportFormat();
  const q = useConversionReport(filter);
  const d = q.data;

  useRegisterExport(register, d ? {
    title: t("reports.catalogue.conversion.title"), subtitle,
    columns: [t("reports.common.stage"), t("reports.common.leads"),
              t("reports.conversion.ofAll", { pct: "%" }), t("reports.leadSources.convPct")],
    rows: d.funnel.map(f => [L.funnel(f.stage), f.count, f.shareOfTotal, f.stepConversionRate]),
  } : null);

  const guard = useGuard(q);
  if (guard || !d) return guard;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile index={0} label={t("reports.common.leads")} value={d.totalLeads} />
        <StatTile index={1} label={t("reports.common.converted")} value={d.converted} tone="success" />
        <StatTile index={2} label={t("reports.conversion.conversionRate")} value={pct(d.conversionRate)} tone="primary" />
        <StatTile index={3} label={t("reports.conversion.avgTimeToConvert")} value={days(d.avgDaysToConvert)} />
      </div>

      <ReportCard title={t("reports.conversion.funnel")} subtitle={t("reports.conversion.funnelSub")}>
        {d.totalLeads === 0 ? <EmptyState message={t("reports.conversion.noLeads")} /> : (
          <div className="space-y-3">
            {d.funnel.map((f, i) => (
              <div key={f.stage}>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-xs font-medium">{L.funnel(f.stage)}</span>
                  <span className="text-xs text-muted-foreground">
                    {f.count} · {t("reports.conversion.ofAll", { pct: pct(f.shareOfTotal) })}
                    {i > 0 && (
                      <span className="ms-1.5">
                        {t("reports.conversion.fromPrevious", { pct: pct(f.stepConversionRate) })}
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-6 rounded-md bg-muted overflow-hidden">
                  <div className="h-full bg-primary/80" style={{ width: `${Math.max(f.shareOfTotal, 2)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </ReportCard>

      <div className="grid lg:grid-cols-2 gap-4">
        <ReportCard title={t("reports.conversion.trend")} subtitle={t("reports.conversion.trendSub")}>
          <BarList rows={d.trend.map(x => ({
            label: formatPeriod(x.period), value: x.created,
            display: `${x.converted}/${x.created}`, sub: `· ${pct(x.rate)}`,
          }))} emptyMessage={t("reports.conversion.noLeads")} />
        </ReportCard>

        <ReportCard title={t("reports.conversion.scoreQuality")} subtitle={t("reports.conversion.scoreQualitySub")}>
          <div className="space-y-4 pt-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium">{t("reports.conversion.convertedLeads")}</span>
                <span className="text-muted-foreground">
                  {t("reports.conversion.avgScoreLabel", { score: d.avgScoreConverted })}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-success rounded-full" style={{ width: `${d.avgScoreConverted}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium">{t("reports.conversion.notConverted")}</span>
                <span className="text-muted-foreground">
                  {t("reports.conversion.avgScoreLabel", { score: d.avgScoreUnconverted })}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-muted-foreground/50 rounded-full" style={{ width: `${d.avgScoreUnconverted}%` }} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">{t("reports.conversion.scoreHint")}</p>
          </div>
        </ReportCard>
      </div>
    </div>
  );
}

// ── 6. Sales velocity ────────────────────────────────────────────────────────

export function VelocityPanel({ filter, register, subtitle }: PanelProps) {
  const { t } = useTranslation("crm");
  const L = useLabels();
  const { days } = useReportFormat();
  const q = useVelocityReport(filter);
  const d = q.data;

  useRegisterExport(register, d ? {
    title: t("reports.catalogue.velocity.title"), subtitle,
    columns: [t("reports.common.stage"), t("reports.velocity.transitions"),
              t("reports.velocity.avgDays"), t("reports.velocity.medianDays"),
              t("reports.velocity.dealsHere")],
    rows: d.stages.map(s => [L.stage(s.stage), s.transitions, s.avgDays, s.medianDays, s.dealsCurrentlyHere]),
  } : null);

  const guard = useGuard(q);
  if (guard || !d) return guard;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile index={0} label={t("reports.velocity.avgCycle")} value={days(d.avgSalesCycleDays)} tone="primary" />
        <StatTile index={1} label={t("reports.velocity.avgToWin")} value={days(d.avgDaysToWin)} tone="success" />
        <StatTile index={2} label={t("reports.velocity.avgToLose")} value={days(d.avgDaysToLose)} />
        <StatTile index={3} label={t("reports.velocity.closedAnalysed")} value={d.closedDealsAnalysed} />
      </div>

      {d.historyNote && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-50 dark:bg-amber-950/20 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300">{d.historyNote}</p>
        </div>
      )}

      <ReportCard title={t("reports.velocity.timeInStage")} subtitle={t("reports.velocity.timeInStageSub")}>
        <BarList
          rows={d.stages.filter(s => s.transitions > 0).map(s => ({
            label: L.stage(s.stage), value: s.avgDays, display: days(s.avgDays),
            sub: `· ${t("reports.velocity.median", { days: s.medianDays })}`,
            color: s.avgDays > d.avgSalesCycleDays / 2 ? "bg-amber-500" : "bg-primary",
          }))}
          emptyMessage={t("reports.velocity.noMovements")}
        />
      </ReportCard>

      <ReportCard title={t("reports.velocity.detail")}>
        <ReportTable
          rowKey={s => s.stage}
          rows={d.stages}
          columns={[
            { key: "stage", header: t("reports.common.stage"),
              render: s => <span className="font-medium">{L.stage(s.stage)}</span> },
            { key: "now", header: t("reports.velocity.dealsHere"), align: "right", render: s => s.dealsCurrentlyHere },
            { key: "moves", header: t("reports.velocity.transitions"), align: "right", render: s => s.transitions },
            { key: "avg", header: t("reports.velocity.avgDays"), align: "right",
              render: s => s.transitions ? s.avgDays : t("reports.common.none") },
            { key: "median", header: t("reports.velocity.medianDays"), align: "right",
              render: s => s.transitions ? s.medianDays : t("reports.common.none") },
          ]}
        />
      </ReportCard>
    </div>
  );
}

// ── 7. Activities ────────────────────────────────────────────────────────────

export function ActivityPanel({ filter, register, subtitle }: PanelProps) {
  const { t } = useTranslation("crm");
  const L = useLabels();
  const { pct } = useReportFormat();
  const q = useActivityReport(filter);
  const d = q.data;

  useRegisterExport(register, d ? {
    title: t("reports.catalogue.activities.title"), subtitle,
    columns: [t("reports.common.owner"), t("reports.common.total"), t("reports.common.completed"),
              t("reports.common.open"), t("reports.common.overdue"), t("reports.activities.completion")],
    rows: d.byOwner.map(o => [o.owner, o.total, o.completed, o.open, o.overdue, o.completionRate]),
  } : null);

  const guard = useGuard(q);
  if (guard || !d) return guard;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatTile index={0} label={t("reports.activities.activities")} value={d.total} />
        <StatTile index={1} label={t("reports.common.completed")} value={d.completed} tone="success" />
        <StatTile index={2} label={t("reports.common.open")} value={d.open} />
        <StatTile index={3} label={t("reports.common.overdue")} value={d.overdue} tone={d.overdue > 0 ? "danger" : "default"} />
        <StatTile index={4} label={t("reports.activities.completionRate")} value={pct(d.completionRate)} tone="primary" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ReportCard title={t("reports.activities.byType")}>
          <BarList rows={d.byType.map(x => ({
            label: L.activity(x.type), value: x.total, display: String(x.total),
            sub: x.overdue > 0 ? `· ${t("reports.activities.overdueCount", { count: x.overdue })}` : undefined,
          }))} />
        </ReportCard>
        <ReportCard title={t("reports.activities.overdueByOwner")} subtitle={t("reports.activities.overdueByOwnerSub")}>
          <BarList
            rows={d.byOwner.filter(o => o.overdue > 0).map(o => ({
              label: o.owner, value: o.overdue, display: String(o.overdue), color: "bg-destructive",
            }))}
            emptyMessage={t("reports.activities.nothingOverdue")}
          />
        </ReportCard>
      </div>

      <ReportCard title={t("reports.activities.byOwner")}>
        <ReportTable
          rowKey={o => o.owner}
          rows={d.byOwner}
          columns={[
            { key: "owner", header: t("reports.common.owner"),
              render: o => <span className="font-medium">{o.owner}</span> },
            { key: "total", header: t("reports.common.total"), align: "right", render: o => o.total },
            { key: "done", header: t("reports.common.completed"), align: "right", render: o => o.completed },
            { key: "open", header: t("reports.common.open"), align: "right", render: o => o.open },
            { key: "overdue", header: t("reports.common.overdue"), align: "right",
              render: o => o.overdue > 0
                ? <span className="text-destructive font-medium">{o.overdue}</span>
                : <span className="text-muted-foreground">0</span> },
            { key: "rate", header: t("reports.activities.completion"), align: "right",
              render: o => pct(o.completionRate) },
          ]}
        />
      </ReportCard>
    </div>
  );
}

// ── 8. Account revenue ───────────────────────────────────────────────────────

export function AccountRevenuePanel({ filter, register, subtitle }: PanelProps) {
  const { t } = useTranslation("crm");
  const q = useAccountRevenueReport(filter);
  const CUR = useCurrency();
  const d = q.data;

  useRegisterExport(register, d ? {
    title: t("reports.catalogue.accounts.title"), subtitle, landscape: true,
    columns: [t("reports.common.account"), t("reports.common.tier"), t("reports.common.manager"),
              t("reports.common.deals"), t("reports.accounts.openPipeline"),
              t("reports.common.won"), `${t("reports.common.won")} ${t("reports.common.value")}`,
              t("reports.accounts.recordedRevenue")],
    rows: d.accounts.map(a => [a.name, a.tier, a.accountManager, a.totalDeals,
      a.openValue, a.wonDeals, a.wonValue, a.recordedRevenue]),
  } : null);

  const guard = useGuard(q);
  if (guard || !d) return guard;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile index={0} label={t("reports.accounts.accounts")} value={d.totalAccounts} />
        <StatTile index={1} label={t("reports.accounts.revenueWon")} value={formatCurrency(d.totalWonValue, CUR)} tone="success" />
        <StatTile index={2} label={t("reports.accounts.openPipeline")} value={formatCurrency(d.totalOpenValue, CUR)} tone="primary" />
        <StatTile index={3} label={t("reports.accounts.topAccount")}
          value={d.accounts[0]?.name ?? t("reports.common.none")}
          hint={d.accounts[0] ? formatCurrency(d.accounts[0].wonValue, CUR) : undefined} />
      </div>

      <ReportCard title={t("reports.accounts.topAccounts")}>
        <BarList rows={d.accounts.filter(a => a.wonValue > 0).slice(0, 12).map(a => ({
          label: a.name, value: a.wonValue, display: formatCurrency(a.wonValue, CUR),
          sub: `· ${a.wonDeals}`, color: "bg-success",
        }))} emptyMessage={t("reports.accounts.noLinkedWon")} />
      </ReportCard>

      <ReportCard title={t("reports.accounts.detail")}>
        <Note>{t("reports.accounts.note")}</Note>
        <div className="mt-4">
          <ReportTable
            rowKey={a => a.customerId}
            rows={d.accounts}
            columns={[
              { key: "name", header: t("reports.common.account"),
                render: a => <span className="font-medium">{a.name}</span> },
              { key: "tier", header: t("reports.common.tier"),
                render: a => <span className="capitalize">{a.tier}</span> },
              { key: "mgr", header: t("reports.common.manager"), render: a => a.accountManager },
              { key: "open", header: t("reports.common.open"), align: "right",
                render: a => <>{formatCurrency(a.openValue, CUR)} <span className="text-muted-foreground text-xs">({a.openDeals})</span></> },
              { key: "won", header: t("reports.common.won"), align: "right",
                render: a => <span className="text-success">{formatCurrency(a.wonValue, CUR)}</span> },
              { key: "rec", header: t("reports.accounts.recordedRevenue"), align: "right",
                render: a => <span className="text-muted-foreground">{formatCurrency(a.recordedRevenue, CUR)}</span> },
            ]}
          />
        </div>
      </ReportCard>
    </div>
  );
}
