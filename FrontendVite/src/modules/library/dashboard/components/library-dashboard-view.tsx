import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useLibraryDashboard } from "@/hooks/library/use-library";
import { PageHeader, TH, useCanAny } from "../../shared/ui";

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

function Panel({ title, to, linkLabel, children }: {
  title: string; to?: string; linkLabel?: string; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-bold">{title}</h2>
          {to && (
            <Link to={to} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              {linkLabel}<ArrowRight className="h-3 w-3 rtl:rotate-180" />
            </Link>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function LibraryDashboardView() {
  const { t } = useTranslation("library");
  const currency = useCurrency();
  const { data: d, isLoading, isError, error, refetch } = useLibraryDashboard();
  // Only those who can open library setup are offered the way there.
  const canSetup = useCanAny(["library.setup.view", "library.setup.edit"]);

  if (isLoading) return <div className="p-12 text-center text-sm text-muted-foreground">{t("loading")}</div>;
  if (isError || !d)
    return (
      <div className="p-12 text-center space-y-3">
        <p className="text-sm text-destructive">{(error as Error)?.message ?? t("loadFailed")}</p>
        <button onClick={() => refetch()} className="text-sm font-medium text-primary hover:underline">{t("action.retry")}</button>
      </div>
    );

  return (
    <div className="space-y-6">
      <PageHeader title={t("dashboard.title")} description={t("dashboard.description")} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label={t("dashboard.tile.onLoan")} value={d.onLoan} to="/library/circulation?tab=loans"
          hint={t("dashboard.tile.dueToday", { count: d.dueToday })} />
        <Tile label={t("dashboard.tile.overdue")} value={d.overdue} tone={d.overdue > 0 ? "text-destructive" : undefined}
          to="/library/circulation?tab=loans&status=overdue" />
        <Tile label={t("dashboard.tile.available")} value={d.available} to="/library/catalogue"
          hint={t("dashboard.tile.ofCopies", { copies: d.copies, titles: d.titles })} />
        <Tile label={t("dashboard.tile.members")} value={d.activeMembers} to="/library/members" />
        <Tile label={t("dashboard.tile.ready")} value={d.readyReservations} tone={d.readyReservations > 0 ? "text-success" : undefined}
          to="/library/circulation?tab=reservations" hint={t("dashboard.tile.waiting", { count: d.waitingReservations })} />
        <Tile label={t("dashboard.tile.inTransit")} value={d.inTransit} to="/library/circulation?tab=transfers" />
        <Tile label={t("dashboard.tile.fines")} value={formatCurrency(d.unpaidFines, currency)} to="/library/fines"
          tone={d.unpaidFines > 0 ? "text-amber-600" : undefined} />
        <Tile label={t("dashboard.tile.last30")} value={d.issuedLast30Days}
          hint={t("dashboard.tile.returned", { count: d.returnedLast30Days })} />
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <Panel title={t("dashboard.branches")} to={canSetup ? "/library/setup" : undefined} linkLabel={t("dashboard.manage")}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className={TH}>{t("col.branch")}</th>
                    <th className="text-end font-semibold px-4 py-3">{t("col.copies")}</th>
                    <th className="text-end font-semibold px-4 py-3">{t("col.available")}</th>
                    <th className="text-end font-semibold px-4 py-3">{t("col.onLoan")}</th>
                    <th className="text-end font-semibold px-4 py-3">{t("col.overdue")}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.branches.map(b => (
                    <tr key={b.branchId} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{b.name}</td>
                      <td className="px-4 py-3 text-end tabular-nums">{b.copies}</td>
                      <td className="px-4 py-3 text-end tabular-nums">{b.available}</td>
                      <td className="px-4 py-3 text-end tabular-nums">{b.onLoan}</td>
                      <td className={cn("px-4 py-3 text-end tabular-nums", b.overdue > 0 && "text-destructive font-semibold")}>{b.overdue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="lg:col-span-2">
          <Panel title={t("dashboard.topTitles")}>
            {d.topTitles.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("dashboard.topTitlesEmpty")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {d.topTitles.map(x => (
                  <li key={x.titleId} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{x.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{x.authors || "—"}</p>
                    </div>
                    <span className="text-xs font-semibold tabular-nums shrink-0">{t("dashboard.loans", { count: x.loans })}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
