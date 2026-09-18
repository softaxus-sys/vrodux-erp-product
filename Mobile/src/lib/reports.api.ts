import { apiClient } from "@/lib/api-client";
import type { ReportDef, ReportResult } from "@/types/reports";

/**
 * Generic tabular reports -- POS (`GET /api/reports/{reportId}`) and Inventory
 * (`GET /api/inventory/reports/{reportId}`) both return the same shape, `{ columns, rows,
 * totalCount }`, where every row dictionary is keyed by the exact strings in `columns`. Mirrors
 * `FrontendVite/src/modules/reports/config/report-registry.ts` and its runner's `buildApiParams`
 * -- trimmed to only the filters that actually reach the backend.
 *
 * **CRM's 8 reports are deliberately excluded.** They're analytical (funnels, win/loss trends,
 * forecast rollups), not tabular -- the web registry itself gives them `href` deep links into the
 * CRM module instead of the generic runner, because flattening them into `{rows, totalCount}`
 * would throw away the thing that makes them readable. That reasoning applies identically here,
 * and there's no CRM reports screen on mobile to deep-link into yet.
 *
 * **Every non-CRM report is genuinely runnable here** -- not a trimmed-down subset. Cross-checking
 * the web runner's own `buildApiParams()` switch found that several filters the registry *displays*
 * (cashier/warehouse/category/branch pickers, `invoiceType`, `fbrstatus`, `filerStatus`,
 * `serviceType`, `recoverable`, `urgency`) are never actually forwarded to the API today --
 * they're rendered but wired to nothing. Only `dateRange`, `paymentMethod`, `status`, `taxPeriod`,
 * `valuationMethod`, `fiscalYear`, `movementType`, `itcStatus`, `writeOffReason`, `fromProvince`,
 * `idleDays`, and `expiryWindowDays` have real effect -- so this registry only reproduces those,
 * which means mobile's version filters exactly as effectively as web's, nothing lost.
 */

const POS_BASE = "/api/reports";
const INVENTORY_BASE = "/api/inventory/reports";

/**
 * Keyed generically rather than one named field per backend param -- the runner screen builds
 * this from whichever single `ReportDef.filter`/`numberFilter` the tapped report declares, so the
 * param name isn't known until render time. `buildQuery` below just serialises whatever is here;
 * the named keys this can validly hold are documented on the top-of-file note (from/to plus the
 * twelve mapped filter params).
 */
export type ReportRunParams = Record<string, string | number | undefined>;

function buildQuery(params: ReportRunParams): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export const reportsApi = {
  runPos: (reportId: string, params: ReportRunParams): Promise<ReportResult> =>
    apiClient.get(`${POS_BASE}/${encodeURIComponent(reportId)}${buildQuery(params)}`),
  runInventory: (reportId: string, params: ReportRunParams): Promise<ReportResult> =>
    apiClient.get(`${INVENTORY_BASE}/${encodeURIComponent(reportId)}${buildQuery(params)}`),
};

/** Same tenant-country resolution as `FrontendVite/src/modules/reports/components/reports-view.tsx`'s
 *  `resolveCountryCode` -- only the codes this registry actually tags a report with matter here. */
export function resolveCountryCode(tenantCountry?: string, tenantCurrency?: string): string {
  const c = (tenantCountry ?? "").toLowerCase().trim();
  if (c === "ae" || c === "uae" || c === "united arab emirates" || c === "emirates") return "ae";
  if (c === "pk" || c === "pakistan") return "pk";
  const currencyMap: Record<string, string> = { AED: "ae", PKR: "pk" };
  return currencyMap[(tenantCurrency ?? "").toUpperCase()] ?? "pk"; // Vrodux default
}

const PAYMENT_METHOD_OPTIONS = [
  { value: "Cash", label: "Cash" },
  { value: "Card", label: "Card / POS" },
  { value: "EasyPaisa", label: "EasyPaisa" },
  { value: "JazzCash", label: "JazzCash" },
  { value: "BankTransfer", label: "Bank Transfer" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "voided", label: "Voided" },
  { value: "refunded", label: "Refunded" },
];

export const REPORT_REGISTRY: ReportDef[] = [
  // ── POS — universal ────────────────────────────────────────────────────────────────────────
  {
    id: "pos-shift-summary",
    title: "Shift Summary (Z-Report)",
    description: "End-of-shift totals: sales, voids, refunds, cash drawer, payment breakdown.",
    category: "POS",
    badges: ["Popular"],
    dateRange: true,
  },
  {
    id: "pos-daily-sales",
    title: "Daily Sales Summary",
    description: "Hourly and daily sales totals, transaction count, average basket size.",
    category: "POS",
    badges: ["Popular"],
    dateRange: true,
    filter: { param: "paymentMethod", label: "Payment Method", options: PAYMENT_METHOD_OPTIONS },
  },
  {
    id: "pos-product-performance",
    title: "Product Sales Performance",
    description: "Units sold, revenue, gross margin, and rank per product.",
    category: "POS",
    dateRange: true,
  },
  {
    id: "pos-category-sales",
    title: "Category Sales Analysis",
    description: "Sales by product category with contribution percentages.",
    category: "POS",
    dateRange: true,
  },
  {
    id: "pos-cashier-performance",
    title: "Cashier Performance Report",
    description: "Transactions handled, revenue collected, discounts given, and voids per cashier.",
    category: "POS",
    dateRange: true,
  },
  {
    id: "pos-payment-analysis",
    title: "Payment Method Analysis",
    description: "Revenue split by cash, card, and digital wallets.",
    category: "POS",
    dateRange: true,
  },
  {
    id: "pos-void-refund",
    title: "Void & Refund Report",
    description: "All voided and refunded transactions with reason codes and authorised-by.",
    category: "POS",
    dateRange: true,
    filter: { param: "status", label: "Status", options: STATUS_OPTIONS },
  },
  {
    id: "pos-discount-analysis",
    title: "Discount & Promotion Analysis",
    description: "Discounts applied by type, amount, and impact on gross margin.",
    category: "POS",
    dateRange: true,
  },
  {
    id: "pos-hourly-heatmap",
    title: "Hourly Sales Heatmap",
    description: "Peak-hour analysis: transaction volume and revenue by hour of day.",
    category: "POS",
    dateRange: true,
  },

  // ── POS — UAE (FTA / VAT 5%) ───────────────────────────────────────────────────────────────
  {
    id: "pos-uae-vat-sales-report",
    title: "VAT Sales Report (FTA)",
    description: "Output VAT summary by standard-rated, zero-rated, and exempt supplies — FTA format.",
    category: "POS",
    countries: ["ae"],
    badges: ["Required"],
    regulator: "FTA",
    dateRange: true,
    filter: {
      param: "taxPeriod",
      label: "Tax Period",
      required: true,
      options: [
        { value: "monthly", label: "Monthly" },
        { value: "quarterly", label: "Quarterly" },
      ],
    },
  },
  {
    id: "pos-uae-tax-invoice-listing",
    title: "Tax Invoice Listing (FTA)",
    description: "All tax invoices issued with TRN, VAT amount, and supply type — required by FTA.",
    category: "POS",
    countries: ["ae"],
    badges: ["Required"],
    regulator: "FTA",
    dateRange: true,
  },
  {
    id: "pos-uae-trn-reconciliation",
    title: "TRN Sales Reconciliation",
    description: "Match POS daily totals to TRN-level invoice records for FTA audit trail.",
    category: "POS",
    countries: ["ae"],
    regulator: "FTA",
    dateRange: true,
  },
  {
    id: "pos-uae-zero-rated-exempt",
    title: "Zero-Rated & Exempt Supplies Report",
    description: "Itemised report of zero-rated and VAT-exempt sales for FTA Box 3/4.",
    category: "POS",
    countries: ["ae"],
    regulator: "FTA",
    dateRange: true,
  },

  // ── POS — Pakistan (FBR / GST 17%) ─────────────────────────────────────────────────────────
  {
    id: "pos-pk-daily-sales-register",
    title: "Daily Sales Register (FBR POS)",
    description: "FBR-compliant daily sales register for Tier-1 POS retailers under SRO 1257.",
    category: "POS",
    countries: ["pk"],
    badges: ["Required"],
    regulator: "FBR",
    dateRange: true,
  },
  {
    id: "pos-pk-gst-sales-report",
    title: "GST Sales Report (FBR)",
    description: "Output GST summary: standard-rated (17%), reduced, and exempt supplies for Sales Tax Return.",
    category: "POS",
    countries: ["pk"],
    badges: ["Required"],
    regulator: "FBR",
    dateRange: true,
    filter: {
      param: "taxPeriod",
      label: "Tax Period",
      required: true,
      options: [
        { value: "monthly", label: "Monthly (STR-7)" },
        { value: "quarterly", label: "Quarterly" },
      ],
    },
  },
  {
    id: "pos-pk-wht-report",
    title: "Withholding Tax Report (Section 153)",
    description: "WHT deducted on goods supplied by unregistered persons — for monthly WHT return.",
    category: "POS",
    countries: ["pk"],
    badges: ["Required"],
    regulator: "FBR",
    dateRange: true,
  },
  {
    id: "pos-pk-cash-memo-register",
    title: "Cash Memo Register",
    description: "Sequential cash memo log for non-registered retailers — FBR audit requirement.",
    category: "POS",
    countries: ["pk"],
    regulator: "FBR",
    dateRange: true,
  },
  {
    id: "pos-pk-srb-services-report",
    title: "SRB Services Tax Report (Sindh)",
    description: "Sindh Sales Tax on services — 13% rate — for SRB return filing.",
    category: "POS",
    countries: ["pk"],
    badges: ["Required"],
    regulator: "SRB",
    dateRange: true,
  },
  {
    id: "pos-pk-cash-reconciliation",
    title: "Cashier Cash Reconciliation",
    description: "Opening cash + sales − refunds vs closing count: over/short by cashier.",
    category: "POS",
    countries: ["pk"],
    dateRange: true,
  },

  // ── Inventory — universal ──────────────────────────────────────────────────────────────────
  {
    id: "inv-stock-valuation",
    title: "Stock Valuation Report",
    description: "Current inventory value by item, category, and warehouse using selected costing method.",
    category: "Inventory",
    badges: ["Popular"],
    dateRange: true,
    filter: {
      param: "valuationMethod",
      label: "Costing Method",
      options: [
        { value: "wac", label: "Weighted Average Cost (WAC)" },
        { value: "fifo", label: "First In First Out (FIFO)" },
        { value: "lifo", label: "Last In First Out (LIFO)" },
      ],
    },
  },
  {
    id: "inv-abc-analysis",
    title: "ABC Analysis (Inventory Velocity)",
    description: "Classify items by movement velocity: A (fast), B (medium), C (slow/dead).",
    category: "Inventory",
    badges: ["Popular"],
    dateRange: true,
  },
  {
    id: "inv-reorder-alert",
    title: "Reorder Alert Report",
    description: "Items at or below reorder point with recommended purchase quantities.",
    category: "Inventory",
    badges: ["Popular"],
    dateRange: false,
  },
  {
    id: "inv-stock-movement",
    title: "Stock Movement History",
    description: "All inward receipts, outward issues, transfers, and adjustments per item.",
    category: "Inventory",
    dateRange: true,
    filter: {
      param: "movementType",
      label: "Movement Type",
      options: [
        { value: "receipt", label: "Purchase Receipt" },
        { value: "issue", label: "POS Issue / Sale" },
        { value: "transfer", label: "Warehouse Transfer" },
        { value: "adjustment", label: "Adjustment" },
        { value: "return", label: "Return / Refund" },
      ],
    },
  },
  {
    id: "inv-slow-dead-stock",
    title: "Slow-Moving & Dead Stock",
    description: "Items with no movement within selected period — tied-up capital analysis.",
    category: "Inventory",
    dateRange: false,
    numberFilter: { param: "idleDays", label: "Idle for more than (days)", defaultValue: 90 },
  },
  {
    id: "inv-warehouse-stock",
    title: "Warehouse-wise Stock Summary",
    description: "Stock quantity and value split by warehouse / storage location.",
    category: "Inventory",
    dateRange: false,
  },
  {
    id: "inv-expiry-tracking",
    title: "Expiry & Batch Tracking",
    description: "Items approaching or past expiry, with batch numbers — for FMCG and pharma.",
    category: "Inventory",
    dateRange: false,
    filter: {
      param: "expiryWindowDays",
      label: "Expiring Within",
      options: [
        { value: "7", label: "7 days" },
        { value: "30", label: "30 days" },
        { value: "60", label: "60 days" },
        { value: "90", label: "90 days" },
        { value: "180", label: "180 days" },
      ],
    },
  },
  {
    id: "inv-shrinkage",
    title: "Inventory Shrinkage Report",
    description: "Losses from theft, damage, and unaccounted variances vs opening stock.",
    category: "Inventory",
    dateRange: true,
  },

  // ── Inventory — UAE (FTA / VAT) ────────────────────────────────────────────────────────────
  {
    id: "inv-uae-input-vat",
    title: "Input VAT on Purchases (FTA)",
    description: "Recoverable input VAT on inventory purchases — for VAT Return Box 9.",
    category: "Inventory",
    countries: ["ae"],
    badges: ["Required"],
    regulator: "FTA",
    dateRange: true,
  },
  {
    id: "inv-uae-stock-adjustment-vat",
    title: "Stock Adjustment VAT Implications",
    description: "Write-offs and adjustments with VAT treatment — FTA may require output tax on disposals.",
    category: "Inventory",
    countries: ["ae"],
    regulator: "FTA",
    dateRange: true,
  },
  {
    id: "inv-uae-consignment",
    title: "Consignment Stock Report (UAE)",
    description: "Goods held on consignment from suppliers — liability tracking and VAT point of supply.",
    category: "Inventory",
    countries: ["ae"],
    regulator: "FTA",
    dateRange: true,
  },
  {
    id: "inv-uae-wac-valuation",
    title: "WAC Stock Valuation (UAE Standard)",
    description: "Inventory valued on Weighted Average Cost — standard method under UAE IFRS practice.",
    category: "Inventory",
    countries: ["ae"],
    badges: ["Popular"],
    regulator: "FTA",
    dateRange: true,
  },

  // ── Inventory — Pakistan (FBR / GST) ───────────────────────────────────────────────────────
  {
    id: "inv-pk-fifo-valuation",
    title: "FIFO Stock Valuation (FBR)",
    description: "Inventory valued on FIFO basis — required for certain sectors under FBR rules.",
    category: "Inventory",
    countries: ["pk"],
    badges: ["Required"],
    regulator: "FBR",
    dateRange: true,
  },
  {
    id: "inv-pk-annual-stock-return",
    title: "Annual Stock Return (FBR)",
    description: "Opening + purchases − sales = closing stock — required for annual income tax return.",
    category: "Inventory",
    countries: ["pk"],
    badges: ["Required"],
    regulator: "FBR",
    dateRange: false,
    filter: {
      param: "fiscalYear",
      label: "Fiscal Year",
      required: true,
      options: [
        { value: "2024-25", label: "FY 2024–25 (Jul–Jun)" },
        { value: "2023-24", label: "FY 2023–24 (Jul–Jun)" },
        { value: "2022-23", label: "FY 2022–23 (Jul–Jun)" },
      ],
    },
  },
  {
    id: "inv-pk-input-tax-credit",
    title: "Input Tax Credit Register (FBR)",
    description: "GST paid on inventory purchases eligible as input tax credit against output tax.",
    category: "Inventory",
    countries: ["pk"],
    badges: ["Required"],
    regulator: "FBR",
    dateRange: true,
    filter: {
      param: "itcStatus",
      label: "ITC Status",
      options: [
        { value: "all", label: "All" },
        { value: "eligible", label: "Eligible" },
        { value: "blocked", label: "Blocked (Schedule II)" },
      ],
    },
  },
  {
    id: "inv-pk-write-off",
    title: "Inventory Write-Off Report (FBR)",
    description: "Written-off stocks with supporting documentation for FBR tax deduction claim.",
    category: "Inventory",
    countries: ["pk"],
    regulator: "FBR",
    dateRange: true,
    filter: {
      param: "writeOffReason",
      label: "Write-Off Reason",
      options: [
        { value: "all", label: "All" },
        { value: "expired", label: "Expired / Obsolete" },
        { value: "damaged", label: "Damaged" },
        { value: "theft", label: "Theft / Shrinkage" },
        { value: "other", label: "Other" },
      ],
    },
  },
  {
    id: "inv-pk-provincial-movement",
    title: "Inter-Provincial Stock Movement",
    description: "Stock transferred between provinces — relevant for multi-jurisdiction GST treatment.",
    category: "Inventory",
    countries: ["pk"],
    regulator: "FBR",
    dateRange: true,
    filter: {
      param: "fromProvince",
      label: "From Province",
      options: [
        { value: "punjab", label: "Punjab" },
        { value: "sindh", label: "Sindh" },
        { value: "kpk", label: "Khyber Pakhtunkhwa" },
        { value: "baloch", label: "Balochistan" },
        { value: "federal", label: "Federal / ICT" },
      ],
    },
  },
];
