import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useTradeDashboard } from "@/hooks/trade/use-trade";
import { JOURNEY, statusMeta } from "@/lib/trade/trade.api";
import { PageHeader, Pill } from "../../shared/ui";

function Tile({ label, value, hint, tone, to }: {
  label: string; value: React.ReactNode; hint?: string; tone?: string; to?: string;
}) {
  const body = (
    <Card className={cn("h-full", to && "hover:border-primary/50 transition-colors")}>
      <CardContent className="p-4">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={cn("text-2xl font-bold mt-1 tabular-nums truncate", tone)}>{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

/** What each kind of attention item means, as styling — the wording comes from the server label via i18n. */
const ATTENTION_TONE: Record<string, string> = {
  delayed: "text-amber-600", demurrage: "text-destructive", free_time: "text-amber-600",
  payment_overdue: "text-destructive", payment_due: "text-amber-600", lc_expired: "text-destructive", lc_expiring: "text-amber-600",
  document_expired: "text-destructive", document_expiring: "text-amber-600",
};

export function TradeDashboardView() {
  const { t } = useTranslation("trade");
  const currency = useCurrency();
  const { data: d, isLoading, isError, error, refetch } = useTradeDashboard();

  if (isLoading) return <div className="p-12 text-center text-sm text-muted-foreground">{t("loading")}</div>;
  if (isError || !d)
    return (
      <div className="p-12 text-center space-y-3">
        <p className="text-sm text-destructive">{(error as Error)?.message ?? t("loadFailed")}</p>
        <button onClick={() => refetch()} className="text-sm font-medium text-primary hover:underline">{t("action.retry")}</button>
      </div>
    );

  const counts = new Map(d.byStatus.map(s => [s.status, s.count]));
  const max = Math.max(1, ...JOURNEY.map(s => counts.get(s) ?? 0));

  return (
    <div className="space-y-5">
      <PageHeader title={t("dashboard.title")} description={t("dashboard.description")} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label={t("dashboard.openImports")} value={d.openImports} to="/trade/shipments?open=1" />
        <Tile label={t("dashboard.openExports")} value={d.openExports} to="/trade/shipments?open=1" />
        <Tile label={t("dashboard.arrivingSoon")} value={d.arrivingSoon} hint={t("dashboard.next14")} />
        <Tile label={t("dashboard.delayed")} value={d.delayed} tone={d.delayed > 0 ? "text-amber-600" : undefined} hint={t("dashboard.pastEta")} />
        <Tile label={t("dashboard.atCustoms")} value={d.atCustoms} />
        <Tile label={t("dashboard.openValue")} value={formatCurrency(d.openGoodsValue, currency)} hint={t("dashboard.openValueHint")} />
        {d.canSeePayments && (
          <Tile label={t("dashboard.paymentsDue")} value={formatCurrency(d.paymentsDue, currency)}
            hint={d.paymentsOverdue > 0 ? t("dashboard.overdueCount", { count: d.paymentsOverdue }) : t("dashboard.next14")}
            tone={d.paymentsOverdue > 0 ? "text-destructive" : undefined} />
        )}
        <Tile label={t("dashboard.documents")} value={d.documentsExpiring + d.documentsExpired}
          hint={t("dashboard.documentsHint", { expiring: d.documentsExpiring, expired: d.documentsExpired })}
          tone={d.documentsExpired > 0 ? "text-destructive" : undefined} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-border"><h2 className="text-sm font-bold">{t("dashboard.attention")}</h2></div>
            {d.attention.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">{t("dashboard.allClear")}</p>
            ) : (
              <ul className="divide-y divide-border max-h-[420px] overflow-y-auto">
                {d.attention.map((a, i) => (
                  <li key={`${a.kind}-${a.shipmentId}-${i}`}>
                    <Link to={`/trade/shipments?id=${a.shipmentId}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30">
                      {a.direction === "import" ? <ArrowDownToLine className="h-4 w-4 text-blue-600 shrink-0" /> : <ArrowUpFromLine className="h-4 w-4 text-emerald-600 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-sm font-medium truncate", ATTENTION_TONE[a.kind])}>{t(`attention.${a.kind}`, { defaultValue: a.label })}</p>
                        <p className="text-xs text-muted-foreground truncate">{a.shipmentNumber}{a.date && ` · ${formatDate(a.date)}`}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="text-sm font-bold">{t("dashboard.pipeline")}</h2>
            {JOURNEY.map(s => {
              const n = counts.get(s) ?? 0;
              return (
                <div key={s} className="space-y-1">
                  <div className="flex justify-between text-xs"><span>{t(`status.${s}`)}</span><span className="tabular-nums font-semibold">{n}</span></div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${(n / max) * 100}%` }} /></div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-bold">{t("dashboard.recent")}</h2>
            <Link to="/trade/shipments" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              {t("dashboard.viewAll")}<ArrowRight className="h-3 w-3 rtl:rotate-180" />
            </Link>
          </div>
          {d.recent.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">{t("list.empty")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {d.recent.map(s => (
                <li key={s.id}>
                  <Link to={`/trade/shipments?id=${s.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{s.shipmentNumber}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.partnerName ?? "—"} · {t(`direction.${s.direction}`)}</p>
                    </div>
                    <Pill meta={statusMeta(s.status)}>{t(`status.${s.status}`)}</Pill>
                    <span className="text-sm tabular-nums w-32 text-end">{formatCurrency(s.goodsValue, s.currency)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
