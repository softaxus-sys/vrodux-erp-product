import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { RefreshCw, Coins, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  useExchangeRates, useRefreshRates, useUpdateTenantCurrency, useCurrencyConverter,
} from "@/hooks/finance/use-exchange-rates";
import { useCurrency } from "@/hooks/use-currency";
import { Can } from "@/components/auth/can";

// Currencies we ship in the master (matches the Finance seed). USD is the immutable base.
const CURRENCY_OPTIONS = [
  "USD", "AED", "EUR", "GBP", "SAR", "KWD", "BHD", "OMR", "PKR", "INR",
];

export function CurrencySettingsView() {
  const { t } = useTranslation("settings");
  const operating = useCurrency();
  const { data: rates = [], isLoading } = useExchangeRates();
  const refresh = useRefreshRates();
  const updateCurrency = useUpdateTenantCurrency();
  const { between, rateMap } = useCurrencyConverter();

  const [selected, setSelected] = React.useState(operating);
  React.useEffect(() => setSelected(operating), [operating]);

  // Converter preview
  const [amount, setAmount] = React.useState(100);
  const [from, setFrom] = React.useState("USD");
  const [to, setTo] = React.useState(operating);
  React.useEffect(() => setTo(operating), [operating]);
  const converted = between(amount, from, to);

  // Latest rate per currency (USD per 1 unit), for the table.
  const latest = React.useMemo(() => {
    const map = new Map<string, { rate: number; date: string }>();
    for (const r of rates) {
      const c = r.currencyCode.toUpperCase();
      const cur = map.get(c);
      if (!cur || r.rateDate > cur.date) map.set(c, { rate: r.rate, date: r.rateDate });
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rates]);

  const asOf = latest.reduce<string | null>((acc, [, v]) => (!acc || v.date > acc ? v.date : acc), null);

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("currency.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("currency.description")}
          </p>
        </div>
        <Can permission="finance.accounting.edit">
          <Button size="sm" variant="outline" className="gap-1.5 h-9"
            onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            <RefreshCw className={cn("h-4 w-4", refresh.isPending && "animate-spin")} />
            {t("currency.refreshNow")}
          </Button>
        </Can>
      </div>

      {/* Operating currency */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Coins className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm">{t("currency.operating")}</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          The currency your amounts are displayed in across the app. Base for exchange rates is always USD.
        </p>
        <div className="flex items-center gap-2">
          <select value={selected} onChange={(e) => setSelected(e.target.value)}
            className="bg-card border border-border rounded-lg h-9 px-3 text-sm min-w-[160px]">
            {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <Button size="sm" className="h-9"
            disabled={selected === operating || updateCurrency.isPending}
            onClick={() => updateCurrency.mutate(selected)}>
            {updateCurrency.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("currency.save")}
          </Button>
          <span className="text-xs text-muted-foreground ml-1">{t("currency.current")} <b className="text-foreground">{operating}</b></span>
        </div>
      </div>

      {/* Converter preview */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-sm mb-3">{t("currency.converter")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="number" value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="h-9 w-32" />
          <select value={from} onChange={(e) => setFrom(e.target.value)}
            className="bg-card border border-border rounded-lg h-9 px-3 text-sm">
            {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <select value={to} onChange={(e) => setTo(e.target.value)}
            className="bg-card border border-border rounded-lg h-9 px-3 text-sm">
            {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="text-sm font-semibold ml-2 whitespace-nowrap">
            = {formatCurrency(converted, to)}
          </span>
        </div>
        {!rateMap[from] || !rateMap[to] ? (
          <p className="text-[11px] text-warning mt-2">{t("currency.rateUnavailable")}</p>
        ) : null}
      </div>

      {/* Rates table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="font-semibold text-sm">{t("currency.rates")} <span className="text-muted-foreground font-normal">{t("currency.usdBase")}</span></h2>
          {asOf && <span className="text-xs text-muted-foreground">{t("currency.asOf", { date: formatDate(asOf) })}</span>}
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("currency.colCurrency")}</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("currency.colUsdPerUnit")}</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("currency.colUnitsPerUsd")}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50">
                <td className="px-5 py-2.5 font-semibold">USD <span className="text-[10px] text-primary ml-1">base</span></td>
                <td className="px-5 py-2.5 text-right font-mono">1.000000</td>
                <td className="px-5 py-2.5 text-right font-mono">1.000000</td>
              </tr>
              {latest.map(([code, v]) => (
                <tr key={code} className="border-b border-border/50 last:border-0">
                  <td className="px-5 py-2.5 font-medium">{code}</td>
                  <td className="px-5 py-2.5 text-right font-mono">{v.rate.toFixed(6)}</td>
                  <td className="px-5 py-2.5 text-right font-mono">{v.rate > 0 ? (1 / v.rate).toFixed(6) : "—"}</td>
                </tr>
              ))}
              {latest.length === 0 && (
                <tr><td colSpan={3} className="px-5 py-10 text-center text-muted-foreground text-sm">{t("currency.noRates")}</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="text-[11px] text-muted-foreground">
        Recorded transaction amounts are never changed — conversion is applied for display and reporting only.
      </motion.p>
    </div>
  );
}
