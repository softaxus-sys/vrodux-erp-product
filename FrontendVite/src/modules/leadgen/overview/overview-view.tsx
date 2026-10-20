import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, Radar, Search, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/auth/can";
import { cn, formatNumber } from "@/lib/utils";
import { useDashboard, useMeta } from "@/hooks/leadgen/use-leadgen";
import { Banner, EmptyState, ErrorBlock, LeadGenFrame, LoadingBlock, NoAccess, SELECT, StatTile, StatusPill, TH, useCanAny } from "../shared/ui";

const RANGES = [7, 30, 90] as const;

export function OverviewView() {
  const { t } = useTranslation("leadgen");
  const navigate = useNavigate();
  const allowed = useCanAny(["leadgen.reports.view"]);
  const [days, setDays] = React.useState<number>(30);
  const dash = useDashboard(days, allowed);
  const meta = useMeta(allowed);

  if (!allowed) {
    return <LeadGenFrame title={t("overview.title")}><NoAccess permission="leadgen.reports.view" /></LeadGenFrame>;
  }

  const d = dash.data;
  const empty = d && d.funnel.discovered === 0 && d.sent === 0;
  const funnelMax = Math.max(1, d?.funnel.discovered ?? 1);

  const funnel = d ? [
    { key: "discovered", value: d.funnel.discovered },
    { key: "revealed", value: d.funnel.revealed },
    { key: "contacted", value: d.funnel.contacted },
    { key: "replied", value: d.funnel.replied },
    { key: "qualified", value: d.funnel.qualified },
    { key: "converted", value: d.funnel.converted },
  ] : [];

  return (
    <LeadGenFrame
      title={t("overview.title")} description={t("overview.description")}
      actions={
        <select className={cn(SELECT, "w-auto")} value={days} onChange={e => setDays(Number(e.target.value))} aria-label={t("overview.range")}>
          {RANGES.map(r => <option key={r} value={r}>{t("overview.lastDays", { count: r })}</option>)}
        </select>
      }>
      {meta.data && !meta.data.enabled && <Banner tone="bad">{t("banner.disabled")}</Banner>}
      {meta.data && meta.data.enabled && !meta.data.providerConfigured && (
        <Banner tone="warn">{t("banner.providerMissing")}</Banner>
      )}
      {meta.data && !meta.data.canSend && meta.data.sendBlockReason && (
        <Banner tone="warn" action={
          <Can permission="leadgen.settings.view"><Button size="sm" variant="outline" onClick={() => navigate("/lead-generation/settings")}>{t("banner.openSettings")}</Button></Can>
        }>{meta.data.sendBlockReason}</Banner>
      )}

      {dash.isLoading ? <LoadingBlock />
        : dash.error ? <ErrorBlock error={dash.error as Error} onRetry={() => dash.refetch()} />
        : d && (
          <>
            {d.attention.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-900/10 p-4">
                <p className="text-sm font-semibold mb-1.5">{t("overview.needsAttention")}</p>
                <ul className="text-sm space-y-1 list-disc ps-5">{d.attention.map((a, i) => <li key={i}>{a}</li>)}</ul>
              </div>
            )}

            {empty ? (
              <div className="rounded-xl border border-border bg-card">
                <EmptyState icon={Radar} title={t("overview.emptyTitle")} body={t("overview.emptyBody")}
                  action={<Can permission="leadgen.searches.create"><Button className="gap-2" onClick={() => navigate("/lead-generation/find")}><Search className="h-4 w-4" />{t("overview.startSearch")}</Button></Can>} />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                  <StatTile label={t("overview.revealed")} value={formatNumber(d.funnel.revealed)} />
                  <StatTile label={t("overview.sent")} value={formatNumber(d.sent)} />
                  <StatTile label={t("overview.replies")} value={formatNumber(d.replies)} hint={t("overview.replyRate", { pct: d.replyRatePercent })} tone={d.replies > 0 ? "good" : undefined} />
                  <StatTile label={t("overview.interested")} value={formatNumber(d.interested)} tone={d.interested > 0 ? "good" : undefined} />
                  <StatTile label={t("overview.bounceRate")} value={`${d.bounceRatePercent}%`} tone={d.bounceRatePercent > 3 ? "bad" : d.bounceRatePercent > 1.5 ? "warn" : undefined} hint={t("overview.bounceHint")} />
                  <StatTile label={t("overview.creditsSpent")} value={formatNumber(d.creditsSpent)} hint={d.creditsRefunded > 0 ? t("overview.refunded", { count: d.creditsRefunded }) : undefined} />
                </div>

                <div className="grid lg:grid-cols-5 gap-4">
                  <section className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
                    <h2 className="text-sm font-bold mb-4">{t("overview.funnel")}</h2>
                    <div className="space-y-3">
                      {funnel.map(f => (
                        <div key={f.key}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium">{t(`overview.stage.${f.key}`)}</span>
                            <span className="tabular-nums text-muted-foreground">{formatNumber(f.value)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(f.value > 0 ? 3 : 0, (f.value / funnelMax) * 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="lg:col-span-3 rounded-xl border border-border bg-card p-5">
                    <h2 className="text-sm font-bold mb-4">{t("overview.activity")}</h2>
                    <div className="h-56" dir="ltr">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={d.series} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} tick={{ fontSize: 11 }} minTickGap={24} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Area type="monotone" dataKey="sent" name={t("overview.sent")} stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} />
                          <Area type="monotone" dataKey="replies" name={t("overview.replies")} stroke="#16a34a" fill="#16a34a" fillOpacity={0.15} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                </div>

                <div className="grid lg:grid-cols-2 gap-4">
                  <section className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                      <h2 className="text-sm font-bold">{t("overview.campaigns")}</h2>
                      <Can permission="leadgen.campaigns.view"><Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/lead-generation/campaigns")}>{t("action.viewAll")}<ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" /></Button></Can>
                    </div>
                    {d.campaigns.length === 0
                      ? <EmptyState icon={Send} title={t("overview.noCampaigns")} />
                      : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="text-xs text-muted-foreground bg-muted/30">
                              <tr><th className={TH}>{t("overview.col.campaign")}</th><th className={TH}>{t("overview.col.sent")}</th><th className={TH}>{t("overview.col.replies")}</th><th className={TH}>{t("overview.col.rate")}</th></tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {d.campaigns.map(c => (
                                <tr key={c.id}>
                                  <td className="px-4 py-2.5"><div className="font-medium truncate max-w-[200px]">{c.name}</div><StatusPill status={c.status} /></td>
                                  <td className="px-4 py-2.5 tabular-nums">{c.sent}</td>
                                  <td className="px-4 py-2.5 tabular-nums">{c.replies}{c.interested > 0 && <span className="text-success text-xs ms-1">({t("overview.interestedCount", { count: c.interested })})</span>}</td>
                                  <td className="px-4 py-2.5 tabular-nums">{c.replyRatePercent}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                  </section>

                  <section className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="px-5 py-3 border-b border-border"><h2 className="text-sm font-bold">{t("overview.sources")}</h2><p className="text-xs text-muted-foreground">{t("overview.sourcesHint")}</p></div>
                    {d.sources.length === 0
                      ? <EmptyState icon={Search} title={t("overview.noSources")} />
                      : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="text-xs text-muted-foreground bg-muted/30">
                              <tr><th className={TH}>{t("overview.col.search")}</th><th className={TH}>{t("overview.col.revealed")}</th><th className={TH}>{t("overview.col.replied")}</th><th className={TH}>{t("overview.col.cost")}</th></tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {d.sources.map(s => (
                                <tr key={s.searchId}>
                                  <td className="px-4 py-2.5 font-medium truncate max-w-[200px]">{s.name}</td>
                                  <td className="px-4 py-2.5 tabular-nums">{s.revealed}<span className="text-muted-foreground">/{s.found}</span></td>
                                  <td className="px-4 py-2.5 tabular-nums">{s.replied}</td>
                                  <td className="px-4 py-2.5 tabular-nums">{s.replied > 0 ? t("overview.perReply", { count: s.costPerReply }) : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                  </section>
                </div>
              </>
            )}
          </>
        )}
    </LeadGenFrame>
  );
}
