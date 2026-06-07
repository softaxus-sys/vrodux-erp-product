import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3, PieChart, TrendingUp, FileText, Download, Filter,
  DollarSign, Package, Users, ShoppingCart, Building2, HardHat,
  ArrowUpRight, Calendar, Search, Receipt, CreditCard, Clock,
  Tag, RotateCcw, AlertTriangle, Warehouse, Layers, CheckSquare,
  ArrowLeftRight, Minus, TrendingDown, Shield, Calculator, FileCheck,
  Trash2, Banknote, ClipboardList, Percent, FileSearch, FileCode2,
  FileSpreadsheet, Globe2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  COUNTRY_CONFIGS,
  getReportsForCountry,
  type ReportDefinition,
  type ReportCategory,
} from "../config/report-registry";
import { ReportRunnerModal } from "./report-runner-modal";
import { useAuthStore } from "@/store/auth.store";

// ─── Icon Map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  BarChart3, PieChart, TrendingUp, FileText, Download, Filter,
  DollarSign, Package, Users, ShoppingCart, Building2, HardHat,
  Calendar, Search, Receipt, CreditCard, Clock, Tag, RotateCcw,
  AlertTriangle, Warehouse, Layers, CheckSquare, ArrowLeftRight,
  Minus, TrendingDown, Shield, Calculator, FileCheck, Trash2,
  Banknote, ClipboardList, Percent, FileSearch, FileCode2, FileSpreadsheet,
};

function ReportIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? FileText;
  return <Icon className={className} />;
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
  Universal: "bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400",
};

function BadgeChip({ label }: { label: string }) {
  return (
    <span className={cn(
      "text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wide",
      BADGE_STYLE[label] ?? "bg-muted text-muted-foreground border-border"
    )}>
      {label}
    </span>
  );
}

// ─── Report Card ──────────────────────────────────────────────────────────────

function ReportCard({
  report, index, onRun,
}: {
  report: ReportDefinition;
  index: number;
  onRun: (r: ReportDefinition) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.03 }}
      onClick={() => onRun(report)}
      className="group bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", report.bg)}>
          <ReportIcon name={report.icon} className={cn("h-4 w-4", report.color)} />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {report.badges?.slice(0, 2).map(b => <BadgeChip key={b} label={b} />)}
          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-0.5" />
        </div>
      </div>

      <p className="text-sm font-semibold mb-1 group-hover:text-primary transition-colors leading-snug">
        {report.title}
      </p>
      <p className="text-xs text-muted-foreground leading-relaxed">{report.description}</p>

      {report.complianceRef && (
        <p className="text-[10px] text-primary/60 mt-2 font-mono leading-tight truncate">
          {report.complianceRef}
        </p>
      )}

      <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
          <BarChart3 className="h-3 w-3" />Run Report
        </button>
        <div className="flex items-center gap-1">
          {report.exportFormats.map(f => (
            <span key={f} className="text-[9px] font-bold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
              {f}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Category definitions ──────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<ReportCategory, { icon: React.ElementType; color: string; bg: string }> = {
  POS:           { icon: Receipt,      color: "text-primary",    bg: "bg-primary/10" },
  Inventory:     { icon: Package,      color: "text-success",    bg: "bg-success/10" },
  Finance:       { icon: DollarSign,   color: "text-warning",    bg: "bg-warning/10" },
  Sales:         { icon: TrendingUp,   color: "text-success",    bg: "bg-success/10" },
  Purchase:      { icon: ShoppingCart, color: "text-primary",    bg: "bg-primary/10" },
  HR:            { icon: Users,        color: "text-primary",    bg: "bg-primary/10" },
  "Real Estate": { icon: Building2,    color: "text-success",    bg: "bg-success/10" },
  Construction:  { icon: HardHat,      color: "text-warning",    bg: "bg-warning/10" },
};

// ─── Universal static reports (Finance / Sales / Purchase / HR / RE / Const.) ─

const STATIC_REPORTS: ReportDefinition[] = [
  // Finance
  { id: "finance-pl",           title: "Profit & Loss Statement",      category: "Finance",      icon: "TrendingUp",   color: "text-success",    bg: "bg-success/10",    badges: ["Popular", "Universal"], description: "Income, expenses, and net profit by period",                     previewColumns: ["Account", "Current Period", "YTD", "Budget", "Variance"],                                                   filters: [{ key: "dateRange", label: "Date Range", type: "date-range", required: true }], exportFormats: ["PDF", "Excel"] },
  { id: "finance-bs",           title: "Balance Sheet",                category: "Finance",      icon: "BarChart3",    color: "text-primary",    bg: "bg-primary/10",    badges: ["Universal"],             description: "Assets, liabilities, and equity snapshot",                       previewColumns: ["Account", "Current", "Previous", "Movement"],                                                               filters: [{ key: "dateRange", label: "As At Date", type: "date-range", required: true }], exportFormats: ["PDF", "Excel"] },
  { id: "finance-cf",           title: "Cash Flow Statement",          category: "Finance",      icon: "DollarSign",   color: "text-warning",    bg: "bg-warning/10",    badges: ["Universal"],             description: "Operating, investing, and financing cash flows",                  previewColumns: ["Activity", "Amount", "% of Total"],                                                                         filters: [{ key: "dateRange", label: "Date Range", type: "date-range", required: true }], exportFormats: ["PDF", "Excel"] },
  { id: "finance-ar-aging",     title: "Accounts Receivable Ageing",   category: "Finance",      icon: "FileText",     color: "text-destructive", bg: "bg-destructive/10",badges: ["Universal"],             description: "Outstanding receivables by age bucket",                          previewColumns: ["Customer", "Current", "1-30 Days", "31-60 Days", "61-90 Days", "90+ Days", "Total"],                        filters: [{ key: "dateRange", label: "As At Date", type: "date-range" }], exportFormats: ["PDF", "Excel", "CSV"] },
  { id: "finance-vat",          title: "Tax & VAT Summary",            category: "Finance",      icon: "PieChart",     color: "text-primary",    bg: "bg-primary/10",    badges: ["Universal"],             description: "Input/output VAT and net payable by period",                     previewColumns: ["Tax Type", "Taxable Amount", "Tax Amount", "Box / Line Ref"],                                               filters: [{ key: "dateRange", label: "Date Range", type: "date-range", required: true }], exportFormats: ["PDF", "Excel", "XML"] },
  { id: "finance-budget",       title: "Budget vs Actual",             category: "Finance",      icon: "BarChart3",    color: "text-warning",    bg: "bg-warning/10",    badges: ["Universal"],             description: "Variance analysis across all departments",                       previewColumns: ["Department", "Budget", "Actual", "Variance", "Variance %"],                                                 filters: [{ key: "dateRange", label: "Period", type: "date-range" }], exportFormats: ["PDF", "Excel"] },
  // Sales
  { id: "sales-revenue",        title: "Sales Revenue Report",         category: "Sales",        icon: "TrendingUp",   color: "text-success",    bg: "bg-success/10",    badges: ["Popular", "Universal"],  description: "Revenue breakdown by product, customer, region",                 previewColumns: ["Product", "Qty Sold", "Revenue", "COGS", "Gross Profit", "GP %"],                                           filters: [{ key: "dateRange", label: "Date Range", type: "date-range" }], exportFormats: ["PDF", "Excel", "CSV"] },
  { id: "sales-quotation-cr",   title: "Quotation Conversion Rate",    category: "Sales",        icon: "BarChart3",    color: "text-primary",    bg: "bg-primary/10",    badges: ["Universal"],             description: "Quote-to-order conversion funnel analysis",                      previewColumns: ["Stage", "Count", "Value", "Conversion %"],                                                                  filters: [{ key: "dateRange", label: "Date Range", type: "date-range" }], exportFormats: ["PDF", "Excel"] },
  { id: "sales-customers",      title: "Customer Sales Analysis",      category: "Sales",        icon: "Users",        color: "text-success",    bg: "bg-success/10",    badges: ["Universal"],             description: "Top customers by revenue and order frequency",                   previewColumns: ["Customer", "Orders", "Revenue", "Avg Order", "Last Order"],                                                 filters: [{ key: "dateRange", label: "Date Range", type: "date-range" }], exportFormats: ["PDF", "Excel", "CSV"] },
  // Purchase
  { id: "purchase-po",          title: "Purchase Order Report",        category: "Purchase",     icon: "ShoppingCart", color: "text-primary",    bg: "bg-primary/10",    badges: ["Universal"],             description: "POs by vendor, status, and delivery performance",                previewColumns: ["PO #", "Vendor", "Date", "Amount", "Status", "Delivery"],                                                   filters: [{ key: "dateRange", label: "Date Range", type: "date-range" }], exportFormats: ["PDF", "Excel", "CSV"] },
  { id: "purchase-vendor-perf", title: "Vendor Performance",           category: "Purchase",     icon: "Users",        color: "text-warning",    bg: "bg-warning/10",    badges: ["Universal"],             description: "On-time delivery, quality, and cost metrics",                    previewColumns: ["Vendor", "POs", "On-Time %", "Quality Score", "Avg Lead Time"],                                            filters: [{ key: "dateRange", label: "Date Range", type: "date-range" }], exportFormats: ["PDF", "Excel"] },
  // HR
  { id: "hr-headcount",         title: "Headcount & Payroll Cost",     category: "HR",           icon: "Users",        color: "text-primary",    bg: "bg-primary/10",    badges: ["Universal"],             description: "Employee count and payroll cost by department",                  previewColumns: ["Department", "Headcount", "Basic Salary", "Allowances", "Deductions", "Net Payroll"],                       filters: [{ key: "dateRange", label: "Period", type: "date-range" }], exportFormats: ["PDF", "Excel"] },
  { id: "hr-leave",             title: "Leave Utilisation",            category: "HR",           icon: "Calendar",     color: "text-warning",    bg: "bg-warning/10",    badges: ["Universal"],             description: "Leave taken vs entitlement by employee and team",                previewColumns: ["Employee", "Leave Type", "Entitled", "Taken", "Balance"],                                                   filters: [{ key: "dateRange", label: "Period", type: "date-range" }], exportFormats: ["PDF", "Excel"] },
  // Real Estate
  { id: "re-occupancy",         title: "Occupancy Report",             category: "Real Estate",  icon: "Building2",    color: "text-success",    bg: "bg-success/10",    badges: ["Universal"],             description: "Unit occupancy rates across all properties",                     previewColumns: ["Property", "Units", "Occupied", "Vacant", "Occupancy %"],                                                   filters: [{ key: "dateRange", label: "As At", type: "date-range" }], exportFormats: ["PDF", "Excel"] },
  { id: "re-rental",            title: "Rental Income Report",         category: "Real Estate",  icon: "DollarSign",   color: "text-primary",    bg: "bg-primary/10",    badges: ["Popular", "Universal"],  description: "Rental income by property, unit, and period",                    previewColumns: ["Property", "Unit", "Tenant", "Rent", "Received", "Outstanding"],                                            filters: [{ key: "dateRange", label: "Period", type: "date-range" }], exportFormats: ["PDF", "Excel"] },
  // Construction
  { id: "con-cost",             title: "Project Cost Report",          category: "Construction", icon: "HardHat",      color: "text-warning",    bg: "bg-warning/10",    badges: ["Universal"],             description: "Budget vs actual cost by project and phase",                     previewColumns: ["Project", "Phase", "Budget", "Actual", "Committed", "Variance"],                                            filters: [{ key: "dateRange", label: "Period", type: "date-range" }], exportFormats: ["PDF", "Excel"] },
  { id: "con-boq",              title: "BOQ Progress Report",          category: "Construction", icon: "FileText",     color: "text-primary",    bg: "bg-primary/10",    badges: ["Universal"],             description: "Bill of quantities completion and variation summary",             previewColumns: ["Item", "Scheduled Qty", "Completed Qty", "Progress %", "Variation"],                                        filters: [{ key: "dateRange", label: "Period", type: "date-range" }], exportFormats: ["PDF", "Excel"] },
];

// ─── Resolve country code from tenant ─────────────────────────────────────────

const CURRENCY_TO_COUNTRY: Record<string, string> = {
  AED: "ae", PKR: "pk", SAR: "sa", OMR: "om",
  INR: "in", GBP: "gb", USD: "us", EUR: "eu",
  QAR: "qa", KWD: "kw", BHD: "bh",
};

/**
 * Resolve a 2-letter country code from tenant.country (primary) with
 * tenant.currency as automatic fallback.  Handles legacy string values
 * ("Pakistan", "UAE", "United Arab Emirates", etc.) stored before the
 * explicit country code field was introduced.
 */
function resolveCountryCode(tenantCountry?: string | null, tenantCurrency?: string | null): string {
  // 1. Try the stored country string / code
  const c = (tenantCountry ?? "").toLowerCase().trim();
  if (c === "ae" || c === "uae" || c === "united arab emirates" || c === "emirates") return "ae";
  if (c === "pk" || c === "pakistan")                                                 return "pk";
  if (c === "sa" || c === "saudi arabia" || c === "ksa")                              return "sa";
  if (c === "om" || c === "oman")                                                     return "om";
  if (c === "qa" || c === "qatar")                                                    return "qa";
  if (c === "kw" || c === "kuwait")                                                   return "kw";
  if (c === "bh" || c === "bahrain")                                                  return "bh";
  if (c === "in" || c === "india")                                                    return "in";
  if (c === "gb" || c === "uk" || c === "united kingdom")                             return "gb";
  if (c === "us" || c === "usa" || c === "united states")                             return "us";
  // Already a known COUNTRY_CONFIGS key?
  if (COUNTRY_CONFIGS[c]) return c;
  // 2. Fallback: derive from currency (catches the case where country was never
  //    explicitly saved but currency was set correctly in regional settings)
  const code = CURRENCY_TO_COUNTRY[(tenantCurrency ?? "").toUpperCase()];
  if (code) return code;
  return "pk"; // Vrodux default
}

// ─── View ─────────────────────────────────────────────────────────────────────

export function ReportsView() {
  const { tenant } = useAuthStore();

  // ── Country — derived from tenant, not user-selectable in this view ──────
  const countryCode = React.useMemo(
    () => resolveCountryCode(tenant?.country, tenant?.currency),
    [tenant?.country, tenant?.currency]
  );
  const country = COUNTRY_CONFIGS[countryCode] ?? {
    // Fallback if code is unknown (future country not yet in COUNTRY_CONFIGS)
    code: countryCode, name: countryCode.toUpperCase(), flag: "🌍",
    currency: "—", taxLabel: "Tax", taxRates: [0],
    regulator: "—", regulatorFull: "Local Authority", fiscalYearStartMonth: 1,
  };

  // ── UI state ─────────────────────────────────────────────────────────────
  const [activeCategory, setActiveCategory] = React.useState<string>("All");
  const [search, setSearch]                 = React.useState("");
  const [selectedReport, setSelectedReport] = React.useState<ReportDefinition | null>(null);

  // ── Merge country-filtered registry reports with universal statics ────────
  const allReports = React.useMemo(() => {
    const registryReports = getReportsForCountry(countryCode);
    const registryIds = new Set(registryReports.map(r => r.id));
    const extras = STATIC_REPORTS.filter(r => !registryIds.has(r.id));
    return [...registryReports, ...extras];
  }, [countryCode]);

  // ── Unique categories ─────────────────────────────────────────────────────
  const allCategories = React.useMemo(
    () => ["All", ...new Set(allReports.map(r => r.category))],
    [allReports]
  );

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = React.useMemo(() => {
    let list = allReports;
    if (activeCategory !== "All") list = list.filter(r => r.category === activeCategory);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(r =>
        r.title.toLowerCase().includes(s) ||
        r.description.toLowerCase().includes(s) ||
        r.category.toLowerCase().includes(s) ||
        (r.complianceRef ?? "").toLowerCase().includes(s) ||
        r.badges?.some(b => b.toLowerCase().includes(s))
      );
    }
    return list;
  }, [allReports, activeCategory, search]);

  // ── Group by category ─────────────────────────────────────────────────────
  const grouped = React.useMemo(() => {
    if (activeCategory !== "All") return { [activeCategory]: filtered };
    return filtered.reduce<Record<string, ReportDefinition[]>>((acc, r) => {
      if (!acc[r.category]) acc[r.category] = [];
      acc[r.category].push(r);
      return acc;
    }, {});
  }, [filtered, activeCategory]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalReports      = allReports.length;
  const posCount          = allReports.filter(r => r.category === "POS").length;
  const invCount          = allReports.filter(r => r.category === "Inventory").length;
  const requiredCount     = allReports.filter(r => r.badges?.includes("Required")).length;
  const countrySpecific   = allReports.filter(r => r.countries?.includes(countryCode)).length;

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-2xl font-bold">Reports</h1>
            {/* Active country badge — read-only, driven by tenant */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-card text-xs font-semibold">
              <span className="text-base leading-none">{country.flag}</span>
              <span className="text-foreground">{country.name}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{country.regulator}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{country.taxLabel} {country.taxRates[0]}%</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {countrySpecific} {country.regulator}-specific + {totalReports - countrySpecific} universal reports for your jurisdiction
          </p>
        </div>
        <Button variant="outline" className="gap-2 h-9 shrink-0">
          <Filter className="h-4 w-4" />Schedule Report
        </Button>
      </div>

      {/* ── Compliance banner ── */}
      <motion.div
        key={countryCode}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-4 px-4 py-3.5 rounded-xl border bg-card"
      >
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-xl leading-none">
          {country.flag}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold mb-0.5">
            {country.name} · {country.regulatorFull} ({country.regulator})
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Showing reports for <strong>{country.name}</strong> jurisdiction.
            {requiredCount > 0 && (
              <> <strong className="text-destructive">{requiredCount} legally-required</strong> reports are tagged{" "}
                <BadgeChip label="Required" />{" "}and include statute references.</>
            )}
            {" "}All {country.regulator}-tagged reports comply with {country.regulatorFull} regulations.
            Fiscal year: {new Date(2024, country.fiscalYearStartMonth - 1).toLocaleString("en", { month: "long" })}–
            {new Date(2024, country.fiscalYearStartMonth - 2 + 12).toLocaleString("en", { month: "long" })}.
            {" "}Currency: <strong>{country.currency}</strong>.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Auto-detected from account settings</span>
        </div>
      </motion.div>

      {/* ── Quick Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Reports",      value: totalReports,    icon: FileText,      color: "text-primary",     bg: "bg-primary/10" },
          { label: "POS Reports",        value: posCount,        icon: Receipt,       color: "text-success",     bg: "bg-success/10" },
          { label: "Inventory Reports",  value: invCount,        icon: Package,       color: "text-warning",     bg: "bg-warning/10" },
          { label: `${country.regulator} Required`, value: requiredCount, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", s.bg)}>
                <Icon className={cn("h-5 w-5", s.color)} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground leading-tight">{s.label}</p>
                <p className="font-bold text-xl leading-tight">{s.value}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Search + Category Filter ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            placeholder={`Search ${country.name} reports…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 h-9 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {allCategories.map(c => {
            const cfg = c !== "All" ? CATEGORY_CONFIG[c as ReportCategory] : null;
            const CatIcon = cfg?.icon;
            const count = c === "All"
              ? filtered.length
              : filtered.filter(r => r.category === c).length;
            return (
              <button key={c} onClick={() => setActiveCategory(c)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  activeCategory === c
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}>
                {CatIcon && <CatIcon className="h-3 w-3" />}
                {c}
                {count > 0 && (
                  <span className={cn(
                    "text-[9px] font-bold px-1 rounded-full",
                    activeCategory === c ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Grouped Report Cards ── */}
      <AnimatePresence mode="wait">
        <motion.div key={`${countryCode}-${activeCategory}-${search}`} className="space-y-8">
          {Object.entries(grouped).map(([category, reports], gi) => {
            const cfg = CATEGORY_CONFIG[category as ReportCategory];
            const CatIcon = cfg?.icon ?? FileText;
            const reqCount = reports.filter(r => r.badges?.includes("Required")).length;
            const cntryCount = reports.filter(r => r.countries?.includes(countryCode)).length;

            return (
              <motion.div key={`${countryCode}-${category}`}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: gi * 0.04 }}>

                {/* Category header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", cfg?.bg ?? "bg-muted/50")}>
                    <CatIcon className={cn("h-3.5 w-3.5", cfg?.color ?? "text-muted-foreground")} />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">{category}</h3>
                  <span className="text-xs text-muted-foreground">{reports.length} reports</span>
                  {reqCount > 0 && (
                    <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full border border-destructive/20">
                      {reqCount} required
                    </span>
                  )}
                  {cntryCount > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border"
                      style={{ color: "var(--color-primary)", background: "hsl(var(--primary) / 0.08)", borderColor: "hsl(var(--primary) / 0.25)" }}>
                      {country.flag} {cntryCount} {country.regulator}-specific
                    </span>
                  )}
                  <div className="flex-1 h-px bg-border" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {reports.map((report, i) => (
                    <ReportCard key={report.id} report={report} index={i} onRun={setSelectedReport} />
                  ))}
                </div>
              </motion.div>
            );
          })}

          {filtered.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-card border border-border rounded-xl p-12 text-center text-sm text-muted-foreground">
              No reports match your search.
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Report Runner Modal ── */}
      <ReportRunnerModal
        report={selectedReport}
        countryCode={countryCode}
        onClose={() => setSelectedReport(null)}
      />
    </div>
  );
}
