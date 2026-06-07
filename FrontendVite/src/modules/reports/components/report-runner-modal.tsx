/**
 * ReportRunnerModal — slide-over panel for running, previewing, and exporting a report.
 * Calls real backend APIs (POS /api/reports/{id} and Inventory /api/inventory/reports/{id}).
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Download, FileText, FileSpreadsheet, FileCode2,
  Play, Loader2, ChevronDown, Info, ExternalLink, ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReportDefinition, ReportFilter, CountryConfig } from "../config/report-registry";
import { COUNTRY_CONFIGS } from "../config/report-registry";
import { reportsApi }          from "@/lib/pos/reports.api";
import { inventoryReportsApi } from "@/lib/inventory/reports.api";
import type { ReportResult }   from "@/lib/pos/reports.api";
import { useAuthStore }        from "@/store/auth.store";
import { appSettingsApi }      from "@/lib/identity/app-settings.api";
import {
  exportPdf, exportExcel, exportCsv, exportXml,
  type TenantInfo,
} from "../utils/report-exporter";

// ─── Export Format Icons ──────────────────────────────────────────────────────

const FORMAT_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  PDF:   { icon: FileText,        label: "PDF",   color: "text-destructive", bg: "bg-destructive/10" },
  Excel: { icon: FileSpreadsheet, label: "Excel", color: "text-success",     bg: "bg-success/10" },
  CSV:   { icon: FileText,        label: "CSV",   color: "text-primary",     bg: "bg-primary/10" },
  XML:   { icon: FileCode2,       label: "XML",   color: "text-warning",     bg: "bg-warning/10" },
};

// ─── Filter Input (controlled) ────────────────────────────────────────────────

interface FilterInputProps {
  filter: ReportFilter;
  value: string;
  onChange: (key: string, value: string) => void;
}

function FilterInput({ filter, value, onChange }: FilterInputProps) {
  const today    = new Date().toISOString().split("T")[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  if (filter.type === "date-range") {
    // Encode as "from|to"
    const [from, to_] = value.split("|");
    return (
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">From</label>
          <input type="date" value={from || monthAgo}
            onChange={e => onChange(filter.key, `${e.target.value}|${to_ || today}`)}
            className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div className="flex-1">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">To</label>
          <input type="date" value={to_ || today}
            onChange={e => onChange(filter.key, `${from || monthAgo}|${e.target.value}`)}
            className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
      </div>
    );
  }

  if (filter.type === "select" || filter.type === "multi-select") {
    return (
      <div className="relative">
        <select value={value} onChange={e => onChange(filter.key, e.target.value)}
          className="w-full h-8 pl-2.5 pr-8 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none">
          {filter.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
      </div>
    );
  }

  if (filter.type === "number-range") {
    const [min, max] = value.split("|");
    return (
      <div className="flex gap-2">
        <input type="number" placeholder="Min" value={min || ""}
          onChange={e => onChange(filter.key, `${e.target.value}|${max || ""}`)}
          className="flex-1 h-8 px-2.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
        <input type="number" placeholder="Max" value={max || ""}
          onChange={e => onChange(filter.key, `${min || ""}|${e.target.value}`)}
          className="flex-1 h-8 px-2.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </div>
    );
  }

  return (
    <input type="text" value={value} placeholder={`Enter ${filter.label.toLowerCase()}…`}
      onChange={e => onChange(filter.key, e.target.value)}
      className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
  );
}

// ─── Badge chip ───────────────────────────────────────────────────────────────

const BADGE_STYLE: Record<string, string> = {
  Required:  "bg-destructive/10 text-destructive border-destructive/30",
  Popular:   "bg-primary/10 text-primary border-primary/30",
  New:       "bg-success/10 text-success border-success/30",
  Beta:      "bg-warning/10 text-warning border-warning/30",
  FBR:       "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  FTA:       "bg-blue-500/10 text-blue-600 border-blue-500/30",
  SRB:       "bg-purple-500/10 text-purple-600 border-purple-500/30",
  HMRC:      "bg-indigo-500/10 text-indigo-600 border-indigo-500/30",
  Universal: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400",
};

function BadgeChip({ label }: { label: string }) {
  return (
    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wide", BADGE_STYLE[label] ?? "bg-muted text-muted-foreground border-border")}>
      {label}
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Default tenant info — used while the async fetch is in flight. */
function defaultTenant(
  companyName: string,
  primaryColor: string,
  currency?: string,
  country?: string,
): TenantInfo {
  return { companyName, primaryColor, currency, country };
}

/** Build API params from filter state */
function buildApiParams(
  filterState: Record<string, string>,
  reportId:    string
): Record<string, string> {
  const params: Record<string, string> = {};

  for (const [key, val] of Object.entries(filterState)) {
    if (!val) continue;
    if (key === "dateRange") {
      const [from, to] = val.split("|");
      if (from) params.from = from;
      if (to)   params.to   = to;
    } else if (key === "idleDays") {
      const [min] = val.split("|");
      if (min) params.idleDays = min;
    } else if (key === "expiryWindow") {
      params.expiryWindowDays = val;
    } else if (key === "valuationMethod") {
      params.valuationMethod = val;
    } else if (key === "paymentMethod") {
      params.paymentMethod = val;
    } else if (key === "status") {
      params.status = val;
    } else if (key === "taxPeriod") {
      params.taxPeriod = val;
    } else if (key === "fiscalYear") {
      params.fiscalYear = val;
    } else if (key === "movementType") {
      params.movementType = val;
    } else if (key === "itcStatus") {
      params.itcStatus = val;
    } else if (key === "reason") {
      params.writeOffReason = val;
    } else if (key === "fromProvince") {
      params.fromProvince = val;
    }
    // cashier, category, warehouse, branch → skip (no IDs in frontend filter yet)
  }

  return params;
}


// ─── Format a cell value for display ─────────────────────────────────────────

function formatCell(v: unknown, currency: string): string {
  if (v == null) return "—";
  if (typeof v === "number") {
    // If it looks like a monetary amount (large number or has decimals)
    if (Number.isFinite(v)) return v.toLocaleString("en", { minimumFractionDigits: v % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 });
  }
  return String(v);
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface ReportRunnerModalProps {
  report: ReportDefinition | null;
  countryCode: string;
  onClose: () => void;
}

export function ReportRunnerModal({ report, countryCode, onClose }: ReportRunnerModalProps) {
  const [running, setRunning]         = React.useState(false);
  const [hasRun, setHasRun]           = React.useState(false);
  const [result, setResult]           = React.useState<ReportResult | null>(null);
  const [error, setError]             = React.useState<string | null>(null);
  const [activeTab, setActiveTab]     = React.useState<"filters" | "preview" | "info">("filters");
  const [filterState, setFilterState] = React.useState<Record<string, string>>({});
  const [tenantInfo, setTenantInfo]   = React.useState<TenantInfo>(() => {
    const t  = useAuthStore.getState().tenant;
    return defaultTenant(
      t?.branding?.companyName ?? "Vrodux",
      t?.branding?.primaryColor ?? "#2563eb",
      t?.currency,
      t?.country,
    );
  });

  const country = COUNTRY_CONFIGS[countryCode] ?? COUNTRY_CONFIGS["ae"];

  // ── Fetch detailed company / regional settings once on mount ─────────────────
  React.useEffect(() => {
    const t  = useAuthStore.getState().tenant;
    const pc = t?.branding?.primaryColor ?? "#2563eb";
    const cn = t?.branding?.companyName  ?? "Vrodux";

    Promise.all([
      appSettingsApi.getCategory("company").catch(() => ({} as Record<string, string>)),
      appSettingsApi.getCategory("regional").catch(() => ({} as Record<string, string>)),
    ]).then(([company, regional]) => {
      setTenantInfo({
        companyName:     company["name"]           || cn,
        legalName:       company["legalName"]      || undefined,
        address:         company["address"]        || undefined,
        phone:           company["phone"]          || undefined,
        email:           company["email"]          || undefined,
        website:         company["website"]        || undefined,
        registrationNo:  company["registrationNo"] || undefined,
        vatTrn:          regional["vatTrn"]        || undefined,
        primaryColor:    pc,
        currency:        regional["currency"]      || t?.currency,
        country:         regional["country"]       || t?.country,
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset on report change
  React.useEffect(() => {
    setHasRun(false);
    setResult(null);
    setError(null);
    setActiveTab("filters");
    setRunning(false);
    // Init filter defaults
    const defaults: Record<string, string> = {};
    report?.filters.forEach(f => {
      if (f.type === "date-range") {
        const today    = new Date().toISOString().split("T")[0];
        const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
        defaults[f.key] = `${monthAgo}|${today}`;
      } else if (f.options?.length) {
        defaults[f.key] = f.options[0].value;
      }
    });
    setFilterState(defaults);
  }, [report?.id]);

  const handleFilterChange = (key: string, value: string) => {
    setFilterState(prev => ({ ...prev, [key]: value }));
  };

  const handleRun = async () => {
    if (!report) return;
    setRunning(true);
    setError(null);
    try {
      const apiParams = buildApiParams(filterState, report.id);
      let data: ReportResult;

      if (report.category === "Inventory") {
        data = await inventoryReportsApi.run(report.id, apiParams);
      } else {
        // POS (and any future POS-like)
        data = await reportsApi.run(report.id, apiParams);
      }

      setResult(data);
      setHasRun(true);
      setActiveTab("preview");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to run report. Check API connection.");
    } finally {
      setRunning(false);
    }
  };

  /** Extracts { from, to } from the "dateRange" filter (stored as "from|to"). */
  const dateRange = React.useMemo(() => {
    const dr = filterState["dateRange"];
    if (!dr) return undefined;
    const [from, to] = dr.split("|");
    return from && to ? { from, to } : undefined;
  }, [filterState]);

  const handleExport = (fmt: string) => {
    if (!result || !report) return;
    const opts = { result, report, country, tenant: tenantInfo, dateRange };
    if (fmt === "CSV")   exportCsv(opts);
    if (fmt === "Excel") exportExcel(opts);
    if (fmt === "XML")   exportXml(opts);
    if (fmt === "PDF")   exportPdf(opts);
    if (fmt === "all") {
      if (report.exportFormats.includes("CSV"))   exportCsv(opts);
      if (report.exportFormats.includes("Excel")) exportExcel(opts);
    }
  };

  const displayRows = result?.rows ?? [];
  const displayCols = result?.columns ?? report?.previewColumns ?? [];

  return (
    <AnimatePresence>
      {report && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-2xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="flex items-start gap-3 min-w-0">
                <button onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {report.badges?.map(b => <BadgeChip key={b} label={b} />)}
                  </div>
                  <h2 className="text-base font-bold leading-tight">{report.title}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{report.description}</p>
                </div>
              </div>
              <button onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-2">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Compliance ref */}
            {report.complianceRef && (
              <div className="px-6 py-2 bg-primary/5 border-b border-border flex items-center gap-2 shrink-0">
                <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-[11px] text-primary font-medium">{report.complianceRef}</span>
                {report.regulator && (
                  <a href="#" className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary">
                    <ExternalLink className="h-3 w-3" />{report.regulator} guidelines
                  </a>
                )}
              </div>
            )}

            {/* Tabs */}
            <div className="flex items-center gap-0 px-6 border-b border-border shrink-0">
              {(["filters", "preview", "info"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  disabled={tab === "preview" && !hasRun}
                  className={cn(
                    "px-4 py-2.5 text-xs font-semibold capitalize border-b-2 transition-all",
                    activeTab === tab
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                    tab === "preview" && !hasRun && "opacity-40 cursor-not-allowed"
                  )}>
                  {tab}
                  {tab === "preview" && hasRun && (
                    <span className="ml-1.5 text-[9px] font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">
                      {result?.totalCount ?? 0}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">

              {/* ── FILTERS ── */}
              {activeTab === "filters" && (
                <div className="px-6 py-5 space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Configure parameters then click <strong>Run Report</strong> to generate results from the database.
                  </p>
                  {error && (
                    <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive font-medium">
                      {error}
                    </div>
                  )}
                  {report.filters.map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-semibold mb-1.5">
                        {f.label}
                        {f.required && <span className="text-destructive ml-1">*</span>}
                      </label>
                      <FilterInput
                        filter={f}
                        value={filterState[f.key] ?? ""}
                        onChange={handleFilterChange}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* ── PREVIEW (data table) ── */}
              {activeTab === "preview" && hasRun && result && (
                <div className="overflow-x-auto">
                  <div className="px-6 pt-4 pb-2 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Showing <strong>{displayRows.length}</strong> of <strong>{result.totalCount}</strong> rows · {country.flag} {country.name}
                    </p>
                    {result.totalCount > displayRows.length && (
                      <span className="text-[10px] bg-warning/10 text-warning border border-warning/30 px-2 py-0.5 rounded-full">
                        Use Export for full dataset
                      </span>
                    )}
                  </div>
                  {displayRows.length === 0 ? (
                    <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                      No data found for the selected filters.
                    </div>
                  ) : (
                    <table className="w-full text-xs min-w-[600px]">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          {displayCols.map(col => (
                            <th key={col} className="px-4 py-2.5 text-left font-semibold text-muted-foreground whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {displayRows.map((row, ri) => (
                          <tr key={ri} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                            {displayCols.map(col => (
                              <td key={col} className="px-4 py-2.5 text-foreground whitespace-nowrap font-mono text-[11px]">
                                {formatCell(row[col], country.currency)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* ── INFO ── */}
              {activeTab === "info" && (
                <div className="px-6 py-5 space-y-5">
                  {report.longDescription && (
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl text-xs text-primary/80 leading-relaxed">
                      {report.longDescription}
                    </div>
                  )}

                  <div className="space-y-3">
                    {[
                      { label: "Category",       value: report.category },
                      { label: "Country",        value: report.countries?.map(c => COUNTRY_CONFIGS[c]?.name).join(", ") ?? "All Countries" },
                      { label: "Regulator",      value: report.regulator ?? "N/A" },
                      { label: "Compliance",     value: report.complianceRef ?? "—" },
                      { label: "Export Formats", value: report.exportFormats.join(", ") },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between text-xs border-b border-border/40 pb-2">
                        <span className="text-muted-foreground font-medium">{label}</span>
                        <span className="font-semibold text-right max-w-xs">{value}</span>
                      </div>
                    ))}
                  </div>

                  <div>
                    <p className="text-xs font-semibold mb-2">Report Columns</p>
                    <div className="flex flex-wrap gap-1.5">
                      {report.previewColumns.map(col => (
                        <span key={col} className="text-[10px] bg-muted/50 border border-border px-2 py-0.5 rounded-full text-muted-foreground">
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="px-6 py-4 border-t border-border shrink-0 bg-card">
              <div className="flex items-center gap-2">
                {/* Run button */}
                <Button
                  onClick={handleRun}
                  disabled={running}
                  className="gap-2 h-9 flex-1"
                >
                  {running
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating…</>
                    : <><Play className="h-3.5 w-3.5" />{hasRun ? "Re-run Report" : "Run Report"}</>
                  }
                </Button>

                {/* Export buttons */}
                {report.exportFormats.map(fmt => {
                  const cfg = FORMAT_CONFIG[fmt];
                  if (!cfg) return null;
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={fmt}
                      onClick={() => handleExport(fmt)}
                      disabled={!hasRun || !result}
                      title={`Export as ${fmt}`}
                      className={cn(
                        "flex items-center gap-1.5 px-3 h-9 rounded-lg border text-xs font-semibold transition-all",
                        hasRun && result
                          ? `${cfg.bg} ${cfg.color} border-current/20 hover:opacity-90`
                          : "border-border text-muted-foreground opacity-40 cursor-not-allowed"
                      )}>
                      <Icon className="h-3.5 w-3.5" />
                      {fmt}
                    </button>
                  );
                })}

                {/* Download all */}
                {hasRun && result && (
                  <button onClick={() => handleExport("all")}
                    className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary transition-all">
                    <Download className="h-3.5 w-3.5" />All
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
