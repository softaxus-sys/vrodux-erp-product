import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Loader2, AlertCircle, Search, CalendarDays, Users, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExportMenu } from "@/components/ui/export-menu";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useAuthStore } from "@/store/auth.store";
import { useArAging, useApAging } from "@/hooks/finance/use-finance";
import { AGING_BUCKETS, type AgingBucket, type AgingLineDto, type AgingReportDto } from "@/lib/finance/finance.api";
import { useLazyList } from "@/hooks/use-lazy-list";
import { exportPdf } from "@/lib/pdf";
import { toCsv, downloadFile } from "@/lib/csv";
import { StatementDrawer } from "./statement-drawer";

type Side = "ar" | "ap";

/** Older money is redder — the row colour should carry the same urgency as the number. */
const BUCKET_STYLE: Record<AgingBucket, { text: string; bg: string; dot: string }> = {
  "current": { text: "text-success",          bg: "bg-success/10",     dot: "bg-success" },
  "1-30":    { text: "text-primary",          bg: "bg-primary/10",     dot: "bg-primary" },
  "31-60":   { text: "text-warning",          bg: "bg-warning/10",     dot: "bg-warning" },
  "61-90":   { text: "text-orange-600",       bg: "bg-orange-500/10",  dot: "bg-orange-500" },
  "90+":     { text: "text-destructive",      bg: "bg-destructive/10", dot: "bg-destructive" },
};

const TODAY = () => new Date().toISOString().split("T")[0];

export function AgeingView() {
  const { t } = useTranslation("finance");
  const currency = useCurrency();
  const hasRawPermission = useAuthStore(s => s.hasRawPermission);

  // AR and AP are gated by different permissions server-side (finance.invoicing.view vs
  // finance.expenses.view), so a user may legitimately be entitled to only one of them.
  const canAr = hasRawPermission("finance.invoicing.view");
  const canAp = hasRawPermission("finance.expenses.view");

  const [side, setSide] = React.useState<Side>(canAr ? "ar" : "ap");
  const [asOf, setAsOf] = React.useState(TODAY());
  const [search, setSearch] = React.useState("");
  const [bucket, setBucket] = React.useState<AgingBucket | "">("");
  const [statementFor, setStatementFor] = React.useState<{ id: string; name: string } | null>(null);

  const allowed = side === "ar" ? canAr : canAp;
  const ar = useArAging(asOf, canAr && side === "ar");
  const ap = useApAging(asOf, canAp && side === "ap");
  const { data, isLoading, isError, error, refetch } = side === "ar" ? ar : ap;

  const report: AgingReportDto | undefined = data;

  const lines = React.useMemo(() => {
    let rows = report?.lines ?? [];
    if (bucket) rows = rows.filter(l => l.bucket === bucket);
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter(l =>
      l.partyName.toLowerCase().includes(q) || l.documentNumber.toLowerCase().includes(q));
    // Most overdue first: that is the collection/payment worklist order.
    return [...rows].sort((a, b) => b.daysOverdue - a.daysOverdue || b.amountDue - a.amountDue);
  }, [report?.lines, bucket, search]);

  const { visible, hasMore, loadMore, sentinelRef, shown, total } = useLazyList(lines, 40);

  const filteredTotal = React.useMemo(() => lines.reduce((s, l) => s + l.amountDue, 0), [lines]);

  /** Parties ranked by what they owe — who to chase first, which a document list alone does not show. */
  const byParty = React.useMemo(() => {
    const map = new Map<string, { id?: string | null; name: string; due: number; count: number; worst: number }>();
    for (const l of lines) {
      const key = l.partyId ?? l.partyName;
      const e = map.get(key) ?? { id: l.partyId, name: l.partyName, due: 0, count: 0, worst: 0 };
      e.due += l.amountDue; e.count += 1; e.worst = Math.max(e.worst, l.daysOverdue);
      map.set(key, e);
    }
    return [...map.values()].sort((a, b) => b.due - a.due).slice(0, 6);
  }, [lines]);

  const partyLabel = side === "ar" ? t("ageing.customer") : t("ageing.supplier");
  const COLUMNS = [
    partyLabel, t("ageing.document"), t("ageing.docDate"), t("ageing.dueDate"),
    t("ageing.total"), t("ageing.paid"), t("ageing.due"), t("ageing.daysOverdue"), t("ageing.bucket"),
  ];
  const reportTitle = side === "ar" ? t("ageing.arTitle") : t("ageing.apTitle");
  const subtitle = `${t("ageing.asOf")} ${formatDate(report?.asOf ?? asOf)} · ${shown}/${total} · ${formatCurrency(filteredTotal, currency)}`;

  const exportRows = () => lines.map(l => [
    l.partyName, l.documentNumber, formatDate(l.documentDate), formatDate(l.dueDate),
    formatCurrency(l.total, currency), formatCurrency(l.amountPaid, currency),
    formatCurrency(l.amountDue, currency), l.daysOverdue > 0 ? String(l.daysOverdue) : "—",
    bucketLabel(l.bucket, t),
  ]);

  const exportCsv = () => {
    const csv = toCsv(lines.map(l => ({
      [COLUMNS[0]]: l.partyName, [COLUMNS[1]]: l.documentNumber,
      [COLUMNS[2]]: l.documentDate, [COLUMNS[3]]: l.dueDate,
      [COLUMNS[4]]: l.total, [COLUMNS[5]]: l.amountPaid, [COLUMNS[6]]: l.amountDue,
      [COLUMNS[7]]: l.daysOverdue, [COLUMNS[8]]: bucketLabel(l.bucket, t),
    })), COLUMNS);
    downloadFile(`${side}_ageing_${report?.asOf ?? asOf}.csv`, csv);
  };

  const exportPdfDoc = () => exportPdf({
    title: reportTitle, subtitle, columns: COLUMNS, rows: exportRows(), landscape: true,
  });

  if (!canAr && !canAp) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2 text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground opacity-50" />
        <p className="text-sm font-semibold">{t("ageing.denied.title")}</p>
        <p className="text-xs text-muted-foreground max-w-sm">{t("ageing.denied.body")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{t("ageing.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("ageing.subtitle")}</p>
        </div>
        <ExportMenu onCsv={exportCsv} onPdf={exportPdfDoc} />
      </div>

      {/* Side switch + as-of */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
          {([["ar", t("ageing.receivables"), canAr], ["ap", t("ageing.payables"), canAp]] as const).map(([k, label, ok]) => (
            <button key={k} disabled={!ok} onClick={() => { setSide(k as Side); setBucket(""); }}
              title={ok ? undefined : t("ageing.noAccess")}
              className={cn("px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all",
                !ok ? "opacity-40 cursor-not-allowed text-muted-foreground"
                    : side === k ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
          <label className="text-xs text-muted-foreground">{t("ageing.asOf")}</label>
          <Input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="h-8 text-sm w-40" />
          {asOf !== TODAY() && (
            <Button variant="ghost" size="sm" className="h-8" onClick={() => setAsOf(TODAY())}>{t("ageing.today")}</Button>
          )}
        </div>
      </div>

      {!allowed ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
          <AlertCircle className="h-7 w-7 text-muted-foreground opacity-50" />
          <p className="text-sm">{t("ageing.noAccess")}</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">{t("ageing.loading")}</span>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <div>
            <p className="text-sm font-semibold">{t("ageing.failed")}</p>
            <p className="text-xs text-muted-foreground mt-1">{(error as Error)?.message}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>{t("ageing.retry")}</Button>
        </div>
      ) : (
        <>
          {/* Bucket totals double as filters */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {AGING_BUCKETS.map((b, i) => {
              const amount = report?.bucketTotals.find(x => x.bucket === b)?.amount ?? 0;
              const st = BUCKET_STYLE[b];
              const on = bucket === b;
              return (
                <motion.button key={b} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  onClick={() => setBucket(on ? "" : b)}
                  className={cn("text-start bg-card border rounded-xl p-4 transition-all hover:shadow-sm",
                    on ? "border-primary ring-2 ring-primary/20" : "border-border")}>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
                    <p className="text-xs text-muted-foreground">{bucketLabel(b, t)}</p>
                  </div>
                  <p className={cn("font-bold text-base mt-1 tabular-nums", st.text)}>{formatCurrency(amount, currency)}</p>
                </motion.button>
              );
            })}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="bg-primary/5 border border-primary/30 rounded-xl p-4">
              <p className="text-xs text-muted-foreground">{t("ageing.totalDue")}</p>
              <p className="font-bold text-base mt-1 tabular-nums text-primary">
                {formatCurrency(report?.totalDue ?? 0, currency)}
              </p>
            </motion.div>
          </div>

          {/* Top parties */}
          {byParty.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {side === "ar" ? t("ageing.topCustomers") : t("ageing.topSuppliers")}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {byParty.map(p => (
                  <button key={p.name} disabled={!p.id}
                    onClick={() => p.id && setStatementFor({ id: p.id, name: p.name })}
                    title={p.id ? t("ageing.openStatement") : t("ageing.noStatement")}
                    className={cn("flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-start transition-colors",
                      p.id ? "hover:bg-muted/50 cursor-pointer" : "cursor-default")}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t("ageing.docsCount", { count: p.count })}
                        {p.worst > 0 && ` · ${t("ageing.worstOverdue", { days: p.worst })}`}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums shrink-0">{formatCurrency(p.due, currency)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input placeholder={side === "ar" ? t("ageing.searchArPh") : t("ageing.searchApPh")}
                value={search} onChange={e => setSearch(e.target.value)} className="ps-9 h-9 text-sm" />
            </div>
            {bucket && (
              <Button variant="ghost" size="sm" className="h-8" onClick={() => setBucket("")}>
                {t("ageing.clearBucket", { bucket: bucketLabel(bucket, t) })}
              </Button>
            )}
            <span className="text-xs text-muted-foreground ms-auto">
              {t("ageing.filteredTotal")}: <span className="font-semibold tabular-nums text-foreground">{formatCurrency(filteredTotal, currency)}</span>
            </span>
          </div>

          {/* Lines */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-start px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{partyLabel}</th>
                    <th className="text-start px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("ageing.document")}</th>
                    <th className="text-start px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("ageing.dueDate")}</th>
                    <th className="text-end px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("ageing.total")}</th>
                    <th className="text-end px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("ageing.paid")}</th>
                    <th className="text-end px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("ageing.due")}</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("ageing.bucket")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12">
                      <Receipt className="h-7 w-7 mx-auto text-muted-foreground opacity-40 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {search || bucket ? t("ageing.emptyFiltered") : t("ageing.emptyNone")}
                      </p>
                    </td></tr>
                  ) : visible.map((l: AgingLineDto, i) => {
                    const st = BUCKET_STYLE[l.bucket] ?? BUCKET_STYLE["current"];
                    return (
                      <motion.tr key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 12) * 0.02 }}
                        onClick={() => l.partyId && setStatementFor({ id: l.partyId, name: l.partyName })}
                        className={cn("border-b border-border/40 last:border-0 transition-colors",
                          l.partyId ? "hover:bg-muted/20 cursor-pointer" : "")}>
                        <td className="px-4 py-3 text-sm font-medium">{l.partyName}</td>
                        <td className="px-4 py-3 text-sm font-mono">{l.documentNumber}</td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {formatDate(l.dueDate)}
                          {l.daysOverdue > 0 && (
                            <span className={cn("ms-2 text-[11px] font-semibold", st.text)}>
                              +{t("ageing.daysShort", { days: l.daysOverdue })}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-end tabular-nums">{formatCurrency(l.total, currency)}</td>
                        <td className="px-4 py-3 text-sm text-end tabular-nums text-muted-foreground">{formatCurrency(l.amountPaid, currency)}</td>
                        <td className={cn("px-4 py-3 text-sm text-end tabular-nums font-semibold", st.text)}>{formatCurrency(l.amountDue, currency)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold", st.text, st.bg)}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />{bucketLabel(l.bucket, t)}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div ref={sentinelRef} className="flex items-center justify-center py-4 border-t border-border/40">
                <Button variant="outline" size="sm" className="h-8" onClick={loadMore}>{t("ageing.loadMore")}</Button>
              </div>
            )}
            {total > 0 && (
              <div className="px-4 py-2.5 border-t border-border/40 bg-muted/20">
                <p className="text-[11px] text-muted-foreground">{t("ageing.showing", { shown, total })}</p>
              </div>
            )}
          </div>
        </>
      )}

      <StatementDrawer
        side={side}
        partyId={statementFor?.id}
        partyName={statementFor?.name}
        open={!!statementFor}
        onClose={() => setStatementFor(null)}
      />
    </div>
  );
}

function bucketLabel(b: AgingBucket, t: (k: string) => string) {
  return b === "current" ? t("ageing.buckets.current") : t(`ageing.buckets.${b.replace("+", "plus")}`);
}
