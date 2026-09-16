import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { usePartyStatement } from "@/hooks/finance/use-finance";
import { exportPdf } from "@/lib/pdf";
import { toCsv, downloadFile } from "@/lib/csv";

interface StatementDrawerProps {
  side: "ar" | "ap";
  partyId?: string | null;
  partyName?: string;
  open: boolean;
  onClose: () => void;
}

export function StatementDrawer({ side, partyId, partyName, open, onClose }: StatementDrawerProps) {
  const { t } = useTranslation("finance");
  const currency = useCurrency();
  const [from, setFrom] = React.useState("");
  const [to, setTo]     = React.useState("");

  // Reset the range each time a different party is opened, or one party's filter silently
  // carries over to the next and the statement looks wrong for no visible reason.
  React.useEffect(() => { if (open) { setFrom(""); setTo(""); } }, [open, partyId]);

  const { data, isLoading, isError, error } = usePartyStatement(
    side, open ? partyId ?? undefined : undefined, { from: from || undefined, to: to || undefined });

  const title = data?.partyName ?? partyName ?? "";

  const rows = data?.lines ?? [];
  const columns = [
    t("ageing.statement.date"), t("ageing.statement.type"), t("ageing.statement.reference"),
    t("ageing.statement.debit"), t("ageing.statement.credit"), t("ageing.statement.balance"),
  ];
  const rangeLabel = from || to
    ? `${from ? formatDate(from) : "…"} → ${to ? formatDate(to) : "…"}`
    : t("ageing.statement.allTime");

  const exportCsv = () => {
    if (!data) return;
    const csv = toCsv(rows.map(l => ({
      [columns[0]]: l.date, [columns[1]]: l.type, [columns[2]]: l.reference,
      [columns[3]]: l.debit, [columns[4]]: l.credit, [columns[5]]: l.balance,
    })), columns);
    downloadFile(`statement_${title.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`, csv);
  };

  const exportPdfDoc = () => {
    if (!data) return;
    exportPdf({
      title: t("ageing.statement.title", { name: title }),
      subtitle: `${rangeLabel} · ${t("ageing.statement.closing")}: ${formatCurrency(data.closingBalance, currency)}`,
      columns,
      rows: rows.map(l => [
        formatDate(l.date), l.type, l.reference,
        l.debit ? formatCurrency(l.debit, currency) : "—",
        l.credit ? formatCurrency(l.credit, currency) : "—",
        formatCurrency(l.balance, currency),
      ]),
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="fixed end-0 top-0 h-full w-full max-w-3xl bg-card border-s border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}>

            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="min-w-0">
                <h2 className="text-base font-bold truncate">{t("ageing.statement.title", { name: title })}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {side === "ar" ? t("ageing.statement.arSub") : t("ageing.statement.apSub")}
                </p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-3 border-b border-border flex items-end gap-3 flex-wrap shrink-0">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{t("ageing.from")}</label>
                <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 text-sm w-40" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{t("ageing.to")}</label>
                <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 text-sm w-40" />
              </div>
              {(from || to) && (
                <Button variant="ghost" size="sm" className="h-8" onClick={() => { setFrom(""); setTo(""); }}>
                  {t("ageing.clear")}
                </Button>
              )}
              <div className="ms-auto flex gap-2">
                <Button variant="outline" size="sm" className="h-8" onClick={exportCsv} disabled={!data || rows.length === 0}>CSV</Button>
                <Button variant="outline" size="sm" className="h-8" onClick={exportPdfDoc} disabled={!data || rows.length === 0}>PDF</Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">{t("ageing.statement.loading")}</span>
                </div>
              ) : isError ? (
                <div className="p-6 text-center">
                  <p className="text-sm font-semibold text-destructive">{t("ageing.statement.failed")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{(error as Error)?.message}</p>
                </div>
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                  <FileText className="h-8 w-8 opacity-40" />
                  <p className="text-sm">{t("ageing.statement.empty")}</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="sticky top-0 bg-muted/60 backdrop-blur">
                    <tr className="border-b border-border">
                      {columns.map((c, i) => (
                        <th key={c} className={cn("px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide",
                          i >= 3 ? "text-end" : "text-start")}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((l, i) => (
                      <tr key={`${l.reference}-${i}`} className="border-b border-border/40 last:border-0">
                        <td className="px-4 py-2.5 text-sm whitespace-nowrap">{formatDate(l.date)}</td>
                        <td className="px-4 py-2.5 text-xs"><span className="bg-muted px-2 py-0.5 rounded">{l.type}</span></td>
                        <td className="px-4 py-2.5 text-sm font-mono">{l.reference}</td>
                        <td className="px-4 py-2.5 text-sm text-end tabular-nums">{l.debit ? formatCurrency(l.debit, currency) : "—"}</td>
                        <td className="px-4 py-2.5 text-sm text-end tabular-nums">{l.credit ? formatCurrency(l.credit, currency) : "—"}</td>
                        <td className="px-4 py-2.5 text-sm text-end tabular-nums font-semibold">{formatCurrency(l.balance, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {data && rows.length > 0 && (
              <div className="px-6 py-4 border-t border-border grid grid-cols-3 gap-3 shrink-0 bg-muted/20">
                <div><p className="text-[11px] text-muted-foreground">{t("ageing.statement.debit")}</p>
                  <p className="font-bold text-sm tabular-nums">{formatCurrency(data.totalDebit, currency)}</p></div>
                <div><p className="text-[11px] text-muted-foreground">{t("ageing.statement.credit")}</p>
                  <p className="font-bold text-sm tabular-nums">{formatCurrency(data.totalCredit, currency)}</p></div>
                <div><p className="text-[11px] text-muted-foreground">{t("ageing.statement.closing")}</p>
                  <p className="font-bold text-sm tabular-nums text-primary">{formatCurrency(data.closingBalance, currency)}</p></div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
