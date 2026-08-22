/**
 * Report Registry — country-aware, compliance-tagged report definitions.
 *
 * Architecture:
 *  - `countries` undefined → universal (shown for all countries)
 *  - `countries: ["ae"]`   → UAE-only (FTA / VAT 5%)
 *  - `countries: ["pk"]`   → Pakistan-only (FBR/SRB / GST 17%)
 *  - `countries: ["ae","pk"]` → shown for both but not others
 *
 * Adding a new country in future:
 *  1. Add its entry to COUNTRY_CONFIGS below.
 *  2. Tag relevant reports with the country code.
 *  3. The UI auto-discovers it from COUNTRY_CONFIGS — no view changes needed.
 */

import { REPORT_CATALOGUE as CRM_REPORT_CATALOGUE } from "@/lib/crm/reports.api";
import type { ModuleKey } from "@/types/global";

// ─── Country Config ───────────────────────────────────────────────────────────

export interface CountryConfig {
  code: string;           // ISO 3166-1 alpha-2
  name: string;
  flag: string;           // emoji flag
  currency: string;       // ISO 4217
  taxLabel: string;       // "VAT" | "GST" | "Sales Tax"
  taxRates: number[];     // primary rates, %
  regulator: string;      // "FTA" | "FBR" | "SRB" | "HMRC" | "IRS" …
  regulatorFull: string;
  invoicePrefix?: string; // invoice number prefix convention
  fiscalYearStartMonth: number; // 1-12
}

export const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
  ae: {
    code:                 "ae",
    name:                 "UAE",
    flag:                 "🇦🇪",
    currency:             "AED",
    taxLabel:             "VAT",
    taxRates:             [5],
    regulator:            "FTA",
    regulatorFull:        "Federal Tax Authority",
    invoicePrefix:        "INV",
    fiscalYearStartMonth: 1,
  },
  pk: {
    code:                 "pk",
    name:                 "Pakistan",
    flag:                 "🇵🇰",
    currency:             "PKR",
    taxLabel:             "GST",
    taxRates:             [17, 18, 25], // standard + luxury + reduced pharma
    regulator:            "FBR",
    regulatorFull:        "Federal Board of Revenue",
    invoicePrefix:        "SI",
    fiscalYearStartMonth: 7, // July–June fiscal year
  },
  // ── Future: add SA, IN, US, GB, etc. ──────────────────────────────────────
  // sa: { code: "sa", name: "Saudi Arabia", flag: "🇸🇦", currency: "SAR",
  //   taxLabel: "VAT", taxRates: [15], regulator: "ZATCA", ... },
  // in: { code: "in", name: "India", flag: "🇮🇳", currency: "INR",
  //   taxLabel: "GST", taxRates: [5,12,18,28], regulator: "GSTN", ... },
};

// ─── Report Definition ────────────────────────────────────────────────────────

/**
 * Which subscribed module each report category belongs to. The hub only shows categories whose
 * module the tenant actually has, so a tenant without POS never sees POS reports.
 *
 * Every category must appear here — the `Record` (not `Partial<Record>`) makes adding a category
 * without deciding its module a compile error, rather than a category that silently shows to everyone.
 */
export const CATEGORY_MODULE: Record<ReportCategory, ModuleKey> = {
  POS:           "pos",
  Inventory:     "inventory",
  Finance:       "finance",
  Sales:         "sales",
  Purchase:      "purchase",
  HR:            "hr",
  CRM:           "crm",
  "Real Estate": "real-estate",
  Construction:  "construction",
};

export type ReportCategory =
  | "POS"
  | "Inventory"
  | "Finance"
  | "Sales"
  | "Purchase"
  | "HR"
  | "CRM"
  | "Real Estate"
  | "Construction";

export type ReportBadge =
  | "Popular"
  | "Required"      // legally mandated
  | "New"
  | "Beta"
  | "FBR"           // Pakistan regulator
  | "FTA"           // UAE regulator
  | "SRB"           // Sindh Revenue Board
  | "HMRC"
  | "Universal";

export interface ReportFilter {
  key: string;
  label: string;
  type: "date-range" | "select" | "multi-select" | "text" | "number-range";
  options?: { value: string; label: string }[];
  required?: boolean;
}

export interface ReportDefinition {
  id: string;
  title: string;
  description: string;
  longDescription?: string;
  category: ReportCategory;
  icon: string;              // lucide icon name
  color: string;             // tailwind text colour
  bg: string;                // tailwind bg colour
  badges?: ReportBadge[];
  /** Undefined = universal; defined = only shown when active country matches */
  countries?: string[];
  /** Regulatory body that mandates or recommends this report */
  regulator?: string;
  /** Specific compliance article/section reference */
  complianceRef?: string;
  /** Columns shown in preview table */
  previewColumns: string[];
  /** Filters shown in the run-report panel */
  filters: ReportFilter[];
  /** Supported export formats */
  exportFormats: ("PDF" | "Excel" | "CSV" | "XML")[];
  /**
   * Deep-link target. When set, the hub navigates here instead of opening the tabular runner.
   *
   * Some reports are analytical rather than table-shaped — funnels, trends, forecast rollups — and
   * flattening them into the runner's `{ rows, totalCount }` contract would throw away the very thing
   * that makes them readable. Those live in their own module and are listed here for discoverability,
   * so users still find every report in one place.
   */
  href?: string;
  /**
   * Optional third level inside a category — the report *type*, e.g. CRM → "Sales" / "Leads" /
   * "Accounts". Categories whose reports declare none render flat, so POS and Inventory are not
   * given an invented grouping just to fill the level.
   */
  subGroup?: string;
  /** Module key required to see this entry, checked with `hasModuleAccess`. */
  requiresModule?: ModuleKey;
  /** Raw permission key required to see this entry, checked with `hasRawPermission`. */
  requiresPermission?: string;
}

// ─── Shared Filter Templates ──────────────────────────────────────────────────

const DATE_RANGE: ReportFilter = {
  key: "dateRange", label: "Date Range", type: "date-range", required: true,
};

const CASHIER_FILTER: ReportFilter = {
  key: "cashier", label: "Cashier", type: "select",
  options: [{ value: "all", label: "All Cashiers" }],
};

const PAYMENT_METHOD_FILTER: ReportFilter = {
  key: "paymentMethod", label: "Payment Method", type: "multi-select",
  options: [
    { value: "Cash",      label: "Cash" },
    { value: "Card",      label: "Card / POS" },
    { value: "EasyPaisa", label: "EasyPaisa" },
    { value: "JazzCash",  label: "JazzCash" },
    { value: "BankTransfer", label: "Bank Transfer" },
  ],
};

const WAREHOUSE_FILTER: ReportFilter = {
  key: "warehouse", label: "Warehouse / Store", type: "select",
  options: [{ value: "all", label: "All Warehouses" }],
};

const CATEGORY_FILTER: ReportFilter = {
  key: "category", label: "Category", type: "multi-select",
  options: [{ value: "all", label: "All Categories" }],
};

const STATUS_FILTER: ReportFilter = {
  key: "status", label: "Status", type: "select",
  options: [
    { value: "all",       label: "All" },
    { value: "completed", label: "Completed" },
    { value: "voided",    label: "Voided" },
    { value: "refunded",  label: "Refunded" },
  ],
};

const BRANCH_FILTER: ReportFilter = {
  key: "branch", label: "Branch", type: "select",
  options: [{ value: "all", label: "All Branches" }],
};

// ─── Report Registry ──────────────────────────────────────────────────────────

export const REPORT_REGISTRY: ReportDefinition[] = [

  // ══════════════════════════════════════════════════════════════════════════
  // POS — UNIVERSAL
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: "pos-shift-summary",
    title: "Shift Summary (Z-Report)",
    description: "End-of-shift totals: sales, voids, refunds, cash drawer, payment breakdown.",
    longDescription: "Equivalent to the traditional Z-Report printed by POS hardware. Summarises a single cashier shift: opening/closing cash, total sales, total voids, refunds, and net revenue by payment method.",
    category: "POS",
    icon: "Receipt",
    color: "text-primary",
    bg: "bg-primary/10",
    badges: ["Popular", "Universal"],
    previewColumns: ["Session", "Cashier", "Opened At", "Closed At", "Sales", "Voids", "Refunds", "Net Revenue", "Cash (Opening)", "Cash (Closing)"],
    filters: [DATE_RANGE, CASHIER_FILTER, BRANCH_FILTER],
    exportFormats: ["PDF", "Excel", "CSV"],
  },

  {
    id: "pos-daily-sales",
    title: "Daily Sales Summary",
    description: "Hourly and daily sales totals, transaction count, average basket size.",
    category: "POS",
    icon: "TrendingUp",
    color: "text-success",
    bg: "bg-success/10",
    badges: ["Popular", "Universal"],
    previewColumns: ["Date", "Transactions", "Gross Sales", "Discounts", "Returns", "Net Sales", "Avg Basket", "Top Product"],
    filters: [DATE_RANGE, BRANCH_FILTER, CASHIER_FILTER, PAYMENT_METHOD_FILTER],
    exportFormats: ["PDF", "Excel", "CSV"],
  },

  {
    id: "pos-product-performance",
    title: "Product Sales Performance",
    description: "Units sold, revenue, gross margin, and rank per product.",
    category: "POS",
    icon: "BarChart3",
    color: "text-primary",
    bg: "bg-primary/10",
    badges: ["Universal"],
    previewColumns: ["Product", "SKU", "Category", "Units Sold", "Revenue", "Cost", "Gross Margin", "Margin %"],
    filters: [DATE_RANGE, CATEGORY_FILTER, BRANCH_FILTER, WAREHOUSE_FILTER],
    exportFormats: ["PDF", "Excel", "CSV"],
  },

  {
    id: "pos-category-sales",
    title: "Category Sales Analysis",
    description: "Sales by product category with contribution percentages.",
    category: "POS",
    icon: "PieChart",
    color: "text-warning",
    bg: "bg-warning/10",
    badges: ["Universal"],
    previewColumns: ["Category", "Transactions", "Units Sold", "Revenue", "Contribution %", "Avg Price"],
    filters: [DATE_RANGE, BRANCH_FILTER],
    exportFormats: ["PDF", "Excel", "CSV"],
  },

  {
    id: "pos-cashier-performance",
    title: "Cashier Performance Report",
    description: "Transactions handled, revenue collected, discounts given, and voids per cashier.",
    category: "POS",
    icon: "Users",
    color: "text-success",
    bg: "bg-success/10",
    badges: ["Universal"],
    previewColumns: ["Cashier", "Shifts", "Transactions", "Net Sales", "Avg Basket", "Discounts Given", "Voids", "Refunds"],
    filters: [DATE_RANGE, BRANCH_FILTER, CASHIER_FILTER],
    exportFormats: ["PDF", "Excel"],
  },

  {
    id: "pos-payment-analysis",
    title: "Payment Method Analysis",
    description: "Revenue split by cash, card, and digital wallets.",
    category: "POS",
    icon: "CreditCard",
    color: "text-primary",
    bg: "bg-primary/10",
    badges: ["Universal"],
    previewColumns: ["Payment Method", "Transactions", "Total Amount", "% of Revenue", "Avg Transaction"],
    filters: [DATE_RANGE, BRANCH_FILTER, CASHIER_FILTER],
    exportFormats: ["PDF", "Excel", "CSV"],
  },

  {
    id: "pos-void-refund",
    title: "Void & Refund Report",
    description: "All voided and refunded transactions with reason codes and authorised-by.",
    category: "POS",
    icon: "RotateCcw",
    color: "text-destructive",
    bg: "bg-destructive/10",
    badges: ["Universal"],
    previewColumns: ["Txn #", "Date", "Cashier", "Type", "Reason", "Amount", "Authorised By", "Original Txn #"],
    filters: [DATE_RANGE, STATUS_FILTER, CASHIER_FILTER, BRANCH_FILTER],
    exportFormats: ["PDF", "Excel", "CSV"],
  },

  {
    id: "pos-discount-analysis",
    title: "Discount & Promotion Analysis",
    description: "Discounts applied by type, amount, and impact on gross margin.",
    category: "POS",
    icon: "Tag",
    color: "text-warning",
    bg: "bg-warning/10",
    badges: ["Universal"],
    previewColumns: ["Date", "Txn #", "Cashier", "Discount Type", "Discount %", "Discount Amount", "Net Sale", "Margin Impact"],
    filters: [DATE_RANGE, CASHIER_FILTER, BRANCH_FILTER],
    exportFormats: ["PDF", "Excel", "CSV"],
  },

  {
    id: "pos-hourly-heatmap",
    title: "Hourly Sales Heatmap",
    description: "Peak-hour analysis: transaction volume and revenue by hour of day.",
    category: "POS",
    icon: "Clock",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    badges: ["Universal"],
    previewColumns: ["Hour", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Avg Revenue"],
    filters: [DATE_RANGE, BRANCH_FILTER],
    exportFormats: ["Excel", "CSV"],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // POS — UAE (FTA / VAT 5%)
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: "pos-uae-vat-sales-report",
    title: "VAT Sales Report (FTA)",
    description: "Output VAT summary by standard-rated, zero-rated, and exempt supplies — FTA format.",
    longDescription: "Complies with UAE Federal Tax Authority (FTA) VAT Return requirements under Federal Decree-Law No. 8 of 2017. Shows output VAT collected per supply type (Standard 5%, Zero-rated, Exempt) for Box 1/2/3 of the VAT return.",
    category: "POS",
    icon: "FileText",
    color: "text-primary",
    bg: "bg-primary/10",
    badges: ["Required", "FTA"],
    countries: ["ae"],
    regulator: "FTA",
    complianceRef: "Federal Decree-Law No. 8 of 2017, Article 67",
    previewColumns: ["Supply Type", "Taxable Amount (AED)", "VAT Amount (AED)", "Box Ref"],
    filters: [
      DATE_RANGE,
      BRANCH_FILTER,
      { key: "taxPeriod", label: "Tax Period", type: "select", required: true,
        options: [
          { value: "monthly", label: "Monthly" },
          { value: "quarterly", label: "Quarterly" },
        ],
      },
    ],
    exportFormats: ["PDF", "Excel", "XML"],
  },

  {
    id: "pos-uae-tax-invoice-listing",
    title: "Tax Invoice Listing (FTA)",
    description: "All tax invoices issued with TRN, VAT amount, and supply type — required by FTA.",
    longDescription: "UAE businesses registered for VAT must issue tax invoices for each supply over AED 10,000, and simplified tax invoices below that threshold. This report lists all invoices with their TRN (Tax Registration Number), supply date, customer TRN (if B2B), taxable amount, and VAT amount for audit purposes.",
    category: "POS",
    icon: "FileSearch",
    color: "text-success",
    bg: "bg-success/10",
    badges: ["Required", "FTA"],
    countries: ["ae"],
    regulator: "FTA",
    complianceRef: "UAE VAT Executive Regulation, Article 59",
    previewColumns: ["Invoice #", "Date", "Customer TRN", "Taxable Amt (AED)", "VAT 5% (AED)", "Total (AED)", "Supply Type"],
    filters: [
      DATE_RANGE,
      BRANCH_FILTER,
      { key: "invoiceType", label: "Invoice Type", type: "select",
        options: [
          { value: "all",        label: "All" },
          { value: "tax",        label: "Tax Invoice (>AED 10,000)" },
          { value: "simplified", label: "Simplified Tax Invoice" },
        ],
      },
    ],
    exportFormats: ["PDF", "Excel", "XML"],
  },

  {
    id: "pos-uae-trn-reconciliation",
    title: "TRN Sales Reconciliation",
    description: "Match POS daily totals to TRN-level invoice records for FTA audit trail.",
    category: "POS",
    icon: "CheckSquare",
    color: "text-warning",
    bg: "bg-warning/10",
    badges: ["FTA"],
    countries: ["ae"],
    regulator: "FTA",
    previewColumns: ["Date", "TRN", "POS Total (AED)", "Invoice Total (AED)", "Variance", "Status"],
    filters: [DATE_RANGE, BRANCH_FILTER],
    exportFormats: ["PDF", "Excel"],
  },

  {
    id: "pos-uae-zero-rated-exempt",
    title: "Zero-Rated & Exempt Supplies Report",
    description: "Itemised report of zero-rated and VAT-exempt sales for FTA Box 3/4.",
    category: "POS",
    icon: "Shield",
    color: "text-slate-500",
    bg: "bg-slate-500/10",
    badges: ["FTA"],
    countries: ["ae"],
    regulator: "FTA",
    complianceRef: "UAE VAT Law, Schedule 1 & 2",
    previewColumns: ["Date", "Product", "Category", "Supply Type", "Amount (AED)", "VAT Rate"],
    filters: [DATE_RANGE, BRANCH_FILTER, CATEGORY_FILTER],
    exportFormats: ["PDF", "Excel"],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // POS — PAKISTAN (FBR / GST 17%)
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: "pos-pk-daily-sales-register",
    title: "Daily Sales Register (FBR POS)",
    description: "FBR-compliant daily sales register for Tier-1 POS retailers under SRO 1257.",
    longDescription: "Required under FBR's Tier-1 Retailer regime (SRO 1257(I)/2019 and SRO 446(I)/2019). Every POS transaction must be transmitted to FBR in real-time. This report generates the daily sales register in FBR-required format including STRN, invoice number sequence, and GST breakdown.",
    category: "POS",
    icon: "ClipboardList",
    color: "text-success",
    bg: "bg-success/10",
    badges: ["Required", "FBR"],
    countries: ["pk"],
    regulator: "FBR",
    complianceRef: "SRO 1257(I)/2019 — Tier-1 Retailer POS Integration",
    previewColumns: ["Invoice #", "Date/Time", "STRN", "Customer NTN", "Gross Amount (PKR)", "GST 17% (PKR)", "Net Amount (PKR)", "FBR Status"],
    filters: [
      DATE_RANGE,
      BRANCH_FILTER,
      { key: "fbrstatus", label: "FBR Sync Status", type: "select",
        options: [
          { value: "all",    label: "All" },
          { value: "synced", label: "Synced" },
          { value: "failed", label: "Failed / Pending" },
        ],
      },
    ],
    exportFormats: ["PDF", "Excel", "XML"],
  },

  {
    id: "pos-pk-gst-sales-report",
    title: "GST Sales Report (FBR)",
    description: "Output GST summary: standard-rated (17%), reduced, and exempt supplies for Sales Tax Return.",
    longDescription: "Generates data required for filing the Monthly Sales Tax Return (Form STR-7) under the Sales Tax Act 1990. Covers output tax on standard-rated (17%), reduced-rate (e.g. 5% on pharmaceuticals), and exempt supplies. Segregates inter-provincial supplies for SRB (Sindh) and PRA (Punjab) coordination.",
    category: "POS",
    icon: "FileText",
    color: "text-primary",
    bg: "bg-primary/10",
    badges: ["Required", "FBR"],
    countries: ["pk"],
    regulator: "FBR",
    complianceRef: "Sales Tax Act 1990, Section 26 — Form STR-7",
    previewColumns: ["Tax Period", "Supply Type", "Taxable Value (PKR)", "GST Rate", "GST Amount (PKR)", "Annex"],
    filters: [
      DATE_RANGE,
      BRANCH_FILTER,
      { key: "taxPeriod", label: "Tax Period", type: "select", required: true,
        options: [
          { value: "monthly",   label: "Monthly (STR-7)" },
          { value: "quarterly", label: "Quarterly" },
        ],
      },
    ],
    exportFormats: ["PDF", "Excel", "XML"],
  },

  {
    id: "pos-pk-wht-report",
    title: "Withholding Tax Report (Section 153)",
    description: "WHT deducted on goods supplied by unregistered persons — for monthly WHT return.",
    longDescription: "Under Section 153 of the Income Tax Ordinance 2001, buyers must deduct WHT when making payments for goods to non-filers (7.5%) and filers (4.5%) above specified thresholds. Generates the data required for filing monthly Withholding Statement (Form 149 / 165).",
    category: "POS",
    icon: "Percent",
    color: "text-destructive",
    bg: "bg-destructive/10",
    badges: ["Required", "FBR"],
    countries: ["pk"],
    regulator: "FBR",
    complianceRef: "Income Tax Ordinance 2001, Section 153 & 165",
    previewColumns: ["Vendor/Supplier", "NTN/CNIC", "Filer Status", "Payment Amount (PKR)", "WHT Rate", "WHT Deducted (PKR)", "Month"],
    filters: [
      DATE_RANGE,
      { key: "filerStatus", label: "Filer Status", type: "select",
        options: [
          { value: "all",          label: "All" },
          { value: "filer",        label: "Filer (4.5%)" },
          { value: "non_filer",    label: "Non-Filer (7.5%)" },
        ],
      },
    ],
    exportFormats: ["PDF", "Excel"],
  },

  {
    id: "pos-pk-cash-memo-register",
    title: "Cash Memo Register",
    description: "Sequential cash memo log for non-registered retailers — FBR audit requirement.",
    category: "POS",
    icon: "Receipt",
    color: "text-warning",
    bg: "bg-warning/10",
    badges: ["FBR"],
    countries: ["pk"],
    regulator: "FBR",
    complianceRef: "Sales Tax Act 1990, Section 23",
    previewColumns: ["Memo #", "Date", "Customer", "Items", "Gross (PKR)", "GST (PKR)", "Net (PKR)", "Cash Received"],
    filters: [DATE_RANGE, BRANCH_FILTER, CASHIER_FILTER],
    exportFormats: ["PDF", "Excel"],
  },

  {
    id: "pos-pk-srb-services-report",
    title: "SRB Services Tax Report (Sindh)",
    description: "Sindh Sales Tax on services — 13% rate — for SRB return filing.",
    longDescription: "Applicable to businesses providing taxable services in Sindh under the Sindh Sales Tax on Services Act 2011. Separate from federal GST on goods. Common for restaurants, IT services, and hospitality in Sindh.",
    category: "POS",
    icon: "FileSearch",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    badges: ["Required", "SRB"],
    countries: ["pk"],
    regulator: "SRB",
    complianceRef: "Sindh Sales Tax on Services Act 2011",
    previewColumns: ["Invoice #", "Date", "Service Type", "Taxable Value (PKR)", "SST 13% (PKR)", "Total (PKR)", "SRB Filed"],
    filters: [DATE_RANGE, BRANCH_FILTER,
      { key: "serviceType", label: "Service Type", type: "select",
        options: [
          { value: "all",         label: "All Services" },
          { value: "restaurant",  label: "Restaurant / F&B" },
          { value: "it",          label: "IT / Tech Services" },
          { value: "hospitality", label: "Hospitality" },
        ],
      },
    ],
    exportFormats: ["PDF", "Excel"],
  },

  {
    id: "pos-pk-cash-reconciliation",
    title: "Cashier Cash Reconciliation",
    description: "Opening cash + sales − refunds vs closing count: over/short by cashier.",
    category: "POS",
    icon: "Banknote",
    color: "text-success",
    bg: "bg-success/10",
    badges: ["Universal"],
    countries: ["pk"],
    previewColumns: ["Cashier", "Shift Date", "Opening Cash", "Cash Sales", "Cash Refunds", "Expected", "Counted", "Over/Short"],
    filters: [DATE_RANGE, CASHIER_FILTER, BRANCH_FILTER],
    exportFormats: ["PDF", "Excel"],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // INVENTORY — UNIVERSAL
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: "inv-stock-valuation",
    title: "Stock Valuation Report",
    description: "Current inventory value by item, category, and warehouse using selected costing method.",
    category: "Inventory",
    icon: "Package",
    color: "text-primary",
    bg: "bg-primary/10",
    badges: ["Popular", "Universal"],
    previewColumns: ["Product", "SKU", "Category", "Warehouse", "Qty on Hand", "Unit Cost", "Total Value", "Valuation Method"],
    filters: [
      DATE_RANGE,
      WAREHOUSE_FILTER,
      CATEGORY_FILTER,
      { key: "valuationMethod", label: "Costing Method", type: "select",
        options: [
          { value: "wac",  label: "Weighted Average Cost (WAC)" },
          { value: "fifo", label: "First In First Out (FIFO)" },
          { value: "lifo", label: "Last In First Out (LIFO)" },
        ],
      },
    ],
    exportFormats: ["PDF", "Excel", "CSV"],
  },

  {
    id: "inv-abc-analysis",
    title: "ABC Analysis (Inventory Velocity)",
    description: "Classify items by movement velocity: A (fast), B (medium), C (slow/dead).",
    category: "Inventory",
    icon: "BarChart3",
    color: "text-success",
    bg: "bg-success/10",
    badges: ["Popular", "Universal"],
    previewColumns: ["Product", "SKU", "Category", "Annual Usage Value", "Cumulative %", "Class", "Reorder Qty"],
    filters: [DATE_RANGE, WAREHOUSE_FILTER, CATEGORY_FILTER],
    exportFormats: ["PDF", "Excel", "CSV"],
  },

  {
    id: "inv-reorder-alert",
    title: "Reorder Alert Report",
    description: "Items at or below reorder point with recommended purchase quantities.",
    category: "Inventory",
    icon: "AlertTriangle",
    color: "text-destructive",
    bg: "bg-destructive/10",
    badges: ["Popular", "Universal"],
    previewColumns: ["Product", "SKU", "Warehouse", "Qty on Hand", "Reorder Level", "Shortage", "Lead Time (days)", "Suggested PO Qty"],
    filters: [WAREHOUSE_FILTER, CATEGORY_FILTER,
      { key: "urgency", label: "Urgency", type: "select",
        options: [
          { value: "all",      label: "All" },
          { value: "critical", label: "Critical (0 stock)" },
          { value: "low",      label: "Low (< reorder point)" },
        ],
      },
    ],
    exportFormats: ["PDF", "Excel", "CSV"],
  },

  {
    id: "inv-stock-movement",
    title: "Stock Movement History",
    description: "All inward receipts, outward issues, transfers, and adjustments per item.",
    category: "Inventory",
    icon: "ArrowLeftRight",
    color: "text-primary",
    bg: "bg-primary/10",
    badges: ["Universal"],
    previewColumns: ["Date", "Product", "SKU", "Movement Type", "From", "To", "Qty", "Unit Cost", "Total Value", "Reference"],
    filters: [DATE_RANGE, WAREHOUSE_FILTER, CATEGORY_FILTER,
      { key: "movementType", label: "Movement Type", type: "multi-select",
        options: [
          { value: "receipt",    label: "Purchase Receipt" },
          { value: "issue",      label: "POS Issue / Sale" },
          { value: "transfer",   label: "Warehouse Transfer" },
          { value: "adjustment", label: "Adjustment" },
          { value: "return",     label: "Return / Refund" },
        ],
      },
    ],
    exportFormats: ["PDF", "Excel", "CSV"],
  },

  {
    id: "inv-slow-dead-stock",
    title: "Slow-Moving & Dead Stock",
    description: "Items with no movement within selected period — tied-up capital analysis.",
    category: "Inventory",
    icon: "TrendingDown",
    color: "text-warning",
    bg: "bg-warning/10",
    badges: ["Universal"],
    previewColumns: ["Product", "SKU", "Category", "Last Movement", "Days Idle", "Qty on Hand", "Value (Cost)", "Suggested Action"],
    filters: [
      WAREHOUSE_FILTER,
      CATEGORY_FILTER,
      { key: "idleDays", label: "Idle for more than (days)", type: "number-range" },
    ],
    exportFormats: ["PDF", "Excel", "CSV"],
  },

  {
    id: "inv-warehouse-stock",
    title: "Warehouse-wise Stock Summary",
    description: "Stock quantity and value split by warehouse / storage location.",
    category: "Inventory",
    icon: "Warehouse",
    color: "text-primary",
    bg: "bg-primary/10",
    badges: ["Universal"],
    previewColumns: ["Warehouse", "Category", "Total SKUs", "Total Qty", "Total Value (Cost)", "Total Value (Retail)", "Utilisation %"],
    filters: [WAREHOUSE_FILTER, CATEGORY_FILTER],
    exportFormats: ["PDF", "Excel", "CSV"],
  },

  {
    id: "inv-expiry-tracking",
    title: "Expiry & Batch Tracking",
    description: "Items approaching or past expiry, with batch numbers — for FMCG and pharma.",
    category: "Inventory",
    icon: "Calendar",
    color: "text-destructive",
    bg: "bg-destructive/10",
    badges: ["Universal"],
    previewColumns: ["Product", "SKU", "Batch #", "Expiry Date", "Days to Expiry", "Qty", "Value", "Action"],
    filters: [
      WAREHOUSE_FILTER,
      CATEGORY_FILTER,
      { key: "expiryWindow", label: "Expiring Within", type: "select",
        options: [
          { value: "7",   label: "7 days" },
          { value: "30",  label: "30 days" },
          { value: "60",  label: "60 days" },
          { value: "90",  label: "90 days" },
          { value: "180", label: "180 days" },
        ],
      },
    ],
    exportFormats: ["PDF", "Excel"],
  },

  {
    id: "inv-shrinkage",
    title: "Inventory Shrinkage Report",
    description: "Losses from theft, damage, and unaccounted variances vs opening stock.",
    category: "Inventory",
    icon: "Minus",
    color: "text-destructive",
    bg: "bg-destructive/10",
    badges: ["Universal"],
    previewColumns: ["Product", "SKU", "Opening Qty", "Received", "Sold", "Adjusted", "Closing (System)", "Counted", "Variance", "Variance Value"],
    filters: [DATE_RANGE, WAREHOUSE_FILTER, CATEGORY_FILTER],
    exportFormats: ["PDF", "Excel"],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // INVENTORY — UAE (FTA / VAT)
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: "inv-uae-input-vat",
    title: "Input VAT on Purchases (FTA)",
    description: "Recoverable input VAT on inventory purchases — for VAT Return Box 9.",
    longDescription: "UAE VAT-registered businesses can recover input VAT paid on goods purchased for business use. This report lists all purchase invoices with supplier TRN, input VAT amount, and eligibility for recovery. Maps to Box 9 (Total value of purchases and expenses) and Box 10 (VAT on purchases) of the FTA VAT Return.",
    category: "Inventory",
    icon: "FileText",
    color: "text-success",
    bg: "bg-success/10",
    badges: ["Required", "FTA"],
    countries: ["ae"],
    regulator: "FTA",
    complianceRef: "UAE VAT Law, Articles 54–55 (Input Tax)",
    previewColumns: ["Supplier", "Supplier TRN", "Invoice #", "Date", "Taxable Amount (AED)", "Input VAT 5% (AED)", "Recoverable", "Box Ref"],
    filters: [
      DATE_RANGE,
      WAREHOUSE_FILTER,
      { key: "recoverable", label: "Recoverable Status", type: "select",
        options: [
          { value: "all",       label: "All" },
          { value: "yes",       label: "Fully Recoverable" },
          { value: "partial",   label: "Partial (Mixed Use)" },
          { value: "blocked",   label: "Blocked (Non-Business)" },
        ],
      },
    ],
    exportFormats: ["PDF", "Excel", "XML"],
  },

  {
    id: "inv-uae-stock-adjustment-vat",
    title: "Stock Adjustment VAT Implications",
    description: "Write-offs and adjustments with VAT treatment — FTA may require output tax on disposals.",
    longDescription: "Under UAE VAT rules, when goods are disposed of for non-business purposes, the business may need to account for output VAT on the market value. This report flags all stock write-offs and adjustments with their VAT implications.",
    category: "Inventory",
    icon: "AlertTriangle",
    color: "text-warning",
    bg: "bg-warning/10",
    badges: ["FTA"],
    countries: ["ae"],
    regulator: "FTA",
    complianceRef: "UAE VAT Executive Regulation, Article 36 (Deemed Supply)",
    previewColumns: ["Date", "Product", "Adj Type", "Qty", "Cost (AED)", "Market Value (AED)", "VAT Due (AED)", "Treatment"],
    filters: [DATE_RANGE, WAREHOUSE_FILTER],
    exportFormats: ["PDF", "Excel"],
  },

  {
    id: "inv-uae-consignment",
    title: "Consignment Stock Report (UAE)",
    description: "Goods held on consignment from suppliers — liability tracking and VAT point of supply.",
    category: "Inventory",
    icon: "Package",
    color: "text-primary",
    bg: "bg-primary/10",
    badges: ["FTA"],
    countries: ["ae"],
    regulator: "FTA",
    previewColumns: ["Supplier", "Supplier TRN", "Product", "Received Date", "Qty Received", "Qty Sold", "Qty Remaining", "VAT Status"],
    filters: [DATE_RANGE, WAREHOUSE_FILTER],
    exportFormats: ["PDF", "Excel"],
  },

  {
    id: "inv-uae-wac-valuation",
    title: "WAC Stock Valuation (UAE Standard)",
    description: "Inventory valued on Weighted Average Cost — standard method under UAE IFRS practice.",
    category: "Inventory",
    icon: "Calculator",
    color: "text-primary",
    bg: "bg-primary/10",
    badges: ["FTA", "Popular"],
    countries: ["ae"],
    regulator: "FTA",
    previewColumns: ["Product", "Opening Qty", "Receipts", "Issues", "Closing Qty", "WAC Unit Cost (AED)", "Closing Value (AED)"],
    filters: [DATE_RANGE, WAREHOUSE_FILTER, CATEGORY_FILTER],
    exportFormats: ["PDF", "Excel"],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // INVENTORY — PAKISTAN (FBR / GST)
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: "inv-pk-fifo-valuation",
    title: "FIFO Stock Valuation (FBR)",
    description: "Inventory valued on FIFO basis — required for certain sectors under FBR rules.",
    longDescription: "Under the Income Tax Rules 2002 and Sales Tax Act 1990, certain businesses (particularly trading, pharmaceutical, and food) are required to use FIFO for inventory valuation. This report shows opening stock, purchases, COGS, and closing stock using FIFO cost layers.",
    category: "Inventory",
    icon: "Layers",
    color: "text-primary",
    bg: "bg-primary/10",
    badges: ["Required", "FBR"],
    countries: ["pk"],
    regulator: "FBR",
    complianceRef: "Income Tax Rules 2002, Rule 34 — Stock Valuation",
    previewColumns: ["Product", "SKU", "Opening Qty", "Opening Value (PKR)", "Purchases", "COGS (FIFO)", "Closing Qty", "Closing Value (PKR)"],
    filters: [DATE_RANGE, WAREHOUSE_FILTER, CATEGORY_FILTER],
    exportFormats: ["PDF", "Excel"],
  },

  {
    id: "inv-pk-annual-stock-return",
    title: "Annual Stock Return (FBR)",
    description: "Opening + purchases − sales = closing stock — required for annual income tax return.",
    longDescription: "Corporate taxpayers in Pakistan must reconcile their stock in the annual Income Tax Return (Form IT-II). This report generates the stock reconciliation statement matching purchases per purchase register, sales per sales register, and physical closing stock.",
    category: "Inventory",
    icon: "FileText",
    color: "text-success",
    bg: "bg-success/10",
    badges: ["Required", "FBR"],
    countries: ["pk"],
    regulator: "FBR",
    complianceRef: "Income Tax Ordinance 2001, Section 35 — Stock Accounting",
    previewColumns: ["Category", "Opening Stock (PKR)", "Purchases (PKR)", "COGS (PKR)", "Closing Stock (PKR)", "Gross Profit"],
    filters: [
      { key: "fiscalYear", label: "Fiscal Year", type: "select", required: true,
        options: [
          { value: "2024-25", label: "FY 2024–25 (Jul–Jun)" },
          { value: "2023-24", label: "FY 2023–24 (Jul–Jun)" },
          { value: "2022-23", label: "FY 2022–23 (Jul–Jun)" },
        ],
      },
      WAREHOUSE_FILTER,
    ],
    exportFormats: ["PDF", "Excel"],
  },

  {
    id: "inv-pk-input-tax-credit",
    title: "Input Tax Credit Register (FBR)",
    description: "GST paid on inventory purchases eligible as input tax credit against output tax.",
    longDescription: "Registered persons under the Sales Tax Act 1990 can claim input tax credit on goods purchased in furtherance of taxable supplies. This report is Annex-C of Form STR-7 (Monthly Sales Tax Return). Includes supplier STRN verification and eligible/blocked amounts.",
    category: "Inventory",
    icon: "FileCheck",
    color: "text-primary",
    bg: "bg-primary/10",
    badges: ["Required", "FBR"],
    countries: ["pk"],
    regulator: "FBR",
    complianceRef: "Sales Tax Act 1990, Section 8 — Annex C of STR-7",
    previewColumns: ["Supplier", "STRN", "Invoice #", "Date", "Taxable Value (PKR)", "GST 17% (PKR)", "Eligible ITC (PKR)", "Blocked"],
    filters: [DATE_RANGE, WAREHOUSE_FILTER,
      { key: "itcStatus", label: "ITC Status", type: "select",
        options: [
          { value: "all",     label: "All" },
          { value: "eligible", label: "Eligible" },
          { value: "blocked", label: "Blocked (Schedule II)" },
        ],
      },
    ],
    exportFormats: ["PDF", "Excel", "XML"],
  },

  {
    id: "inv-pk-write-off",
    title: "Inventory Write-Off Report (FBR)",
    description: "Written-off stocks with supporting documentation for FBR tax deduction claim.",
    longDescription: "Under Section 20(1)(xv) of the Income Tax Ordinance 2001, losses on disposal of trading stock at below cost may be deductible. Write-offs must be supported by documentation. This report lists all write-offs with reason codes, approval status, and tax treatment.",
    category: "Inventory",
    icon: "Trash2",
    color: "text-destructive",
    bg: "bg-destructive/10",
    badges: ["FBR"],
    countries: ["pk"],
    regulator: "FBR",
    complianceRef: "Income Tax Ordinance 2001, Section 20 (Deductible Losses)",
    previewColumns: ["Date", "Product", "Batch #", "Qty Written Off", "Cost Value (PKR)", "Reason", "Approved By", "Tax Treatment"],
    filters: [DATE_RANGE, WAREHOUSE_FILTER,
      { key: "reason", label: "Write-Off Reason", type: "select",
        options: [
          { value: "all",      label: "All" },
          { value: "expired",  label: "Expired / Obsolete" },
          { value: "damaged",  label: "Damaged" },
          { value: "theft",    label: "Theft / Shrinkage" },
          { value: "other",    label: "Other" },
        ],
      },
    ],
    exportFormats: ["PDF", "Excel"],
  },

  {
    id: "inv-pk-provincial-movement",
    title: "Inter-Provincial Stock Movement",
    description: "Stock transferred between provinces — relevant for multi-jurisdiction GST treatment.",
    longDescription: "Pakistan has federal GST (FBR) on goods and provincial sales tax on services. When goods move between provinces (e.g. from Punjab warehouse to Sindh branch), the transaction may have different tax implications. This report helps reconcile stock movements for provincial tax authorities (PRA, SRB, KPRA, BRA).",
    category: "Inventory",
    icon: "ArrowLeftRight",
    color: "text-warning",
    bg: "bg-warning/10",
    badges: ["FBR"],
    countries: ["pk"],
    regulator: "FBR",
    previewColumns: ["Date", "Product", "From Province", "From Warehouse", "To Province", "To Warehouse", "Qty", "Value (PKR)", "GST Treatment"],
    filters: [DATE_RANGE,
      { key: "fromProvince", label: "From Province", type: "select",
        options: [
          { value: "punjab",   label: "Punjab" },
          { value: "sindh",    label: "Sindh" },
          { value: "kpk",      label: "Khyber Pakhtunkhwa" },
          { value: "baloch",   label: "Balochistan" },
          { value: "federal",  label: "Federal / ICT" },
        ],
      },
    ],
    exportFormats: ["PDF", "Excel"],
  },
];

// ─── Helper Functions ─────────────────────────────────────────────────────────

/** All unique categories present in the registry */
export const REGISTRY_CATEGORIES = [
  ...new Set(REPORT_REGISTRY.map(r => r.category))
] as ReportCategory[];

/** Filter reports for a given country code (also includes universals) */
export function getReportsForCountry(
  countryCode: string,
  category?: ReportCategory
): ReportDefinition[] {
  return REPORT_REGISTRY.filter(r => {
    const countryMatch = !r.countries || r.countries.includes(countryCode);
    const catMatch     = !category || r.category === category;
    return countryMatch && catMatch;
  });
}

/** Total count by category for a country */
export function getCountsByCategory(countryCode: string): Record<string, number> {
  const reports = getReportsForCountry(countryCode);
  return reports.reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + 1;
    return acc;
  }, {});
}

// ─── CRM (deep-linked analytical reports) ─────────────────────────────────────

/**
 * CRM reports are analytical — funnels, trends, win-rate splits, forecast rollups — so they render in
 * the CRM module rather than the tabular runner (see `ReportDefinition.href`). They are listed here so
 * the hub stays the one place to find every report.
 *
 * Derived from the CRM module's own catalogue so the two can never drift out of sync; titles and
 * descriptions shown in the hub come from the same source the CRM section uses.
 */
const CRM_ICONS: Record<string, string> = {
  pipeline: "BarChart3", "win-loss": "TrendingUp", velocity: "Clock",
  performance: "Users", conversion: "Filter", "lead-sources": "PieChart",
  activities: "ClipboardList", accounts: "Building2",
};

const CRM_COLORS: Record<string, { color: string; bg: string }> = {
  pipeline:       { color: "text-primary",     bg: "bg-primary/10" },
  "win-loss":     { color: "text-success",     bg: "bg-success/10" },
  velocity:       { color: "text-warning",     bg: "bg-warning/10" },
  performance:    { color: "text-primary",     bg: "bg-primary/10" },
  conversion:     { color: "text-success",     bg: "bg-success/10" },
  "lead-sources": { color: "text-warning",     bg: "bg-warning/10" },
  activities:     { color: "text-destructive", bg: "bg-destructive/10" },
  accounts:       { color: "text-primary",     bg: "bg-primary/10" },
};

export const CRM_REPORTS: ReportDefinition[] = CRM_REPORT_CATALOGUE.map(r => ({
  id:          `crm-${r.id}`,
  title:       r.title,
  description: r.description,
  category:    "CRM" as ReportCategory,
  icon:        CRM_ICONS[r.id] ?? "BarChart3",
  color:       CRM_COLORS[r.id]?.color ?? "text-primary",
  bg:          CRM_COLORS[r.id]?.bg ?? "bg-primary/10",
  // Filters and preview columns live in the CRM section's own UI; the hub only needs the card.
  previewColumns: [],
  filters:        [],
  exportFormats:  ["PDF", "CSV"],
  // The CRM catalogue's own grouping (Sales / Leads / Accounts) becomes the report-type level.
  subGroup:       r.group,
  href:               `/crm/reports?report=${r.id}`,
  requiresModule:     "crm",
  requiresPermission: "crm.reports.view",
}));
