import { rawApiClient } from "@/lib/api-client";

const API_ROOT = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const BASE = `${API_ROOT}/api/crm/reports`;

// ── Shared filter ───────────────────────────────────────────────────────────

export interface ReportFilter {
  /** Inclusive start date, `yyyy-MM-dd`. */
  from?:        string;
  /** Inclusive end date, `yyyy-MM-dd`. */
  to?:          string;
  ownerUserId?: string;
  source?:      string;
  stage?:       string;
  customerId?:  string;
}

function toQuery(filter: ReportFilter): string {
  const p = new URLSearchParams();
  // Only send set values — an empty string would bind as a real filter and match nothing.
  for (const [k, v] of Object.entries(filter)) {
    if (v !== undefined && v !== null && v !== "") p.append(k, String(v));
  }
  const q = p.toString();
  return q ? `?${q}` : "";
}

// ── Report DTOs (mirror Softaxis.CRM.Application.Reports.Dtos) ───────────────

export interface PipelineStageRow {
  stage: string; count: number; value: number; weightedValue: number; avgDealSize: number;
}
export interface ForecastCategoryRow { category: string; count: number; value: number }
export interface SalesPipelineReport {
  byStage: PipelineStageRow[];
  byForecastCategory: ForecastCategoryRow[];
  openCount: number; openValue: number; weightedValue: number;
  commitValue: number; bestCaseValue: number; avgDealSize: number;
}

export interface WinLossTrendPoint {
  period: string; won: number; lost: number;
  wonValue: number; lostValue: number; winRate: number;
}
export interface LossReasonRow { reason: string; count: number; value: number; share: number }
export interface WinLossReport {
  wonCount: number; lostCount: number; wonValue: number; lostValue: number;
  winRate: number; avgWonDealSize: number; avgDaysToClose: number;
  trend: WinLossTrendPoint[]; lossReasons: LossReasonRow[];
}

export interface OwnerPerformanceRow {
  ownerUserId: string | null; ownerName: string;
  leadsOwned: number; leadsConverted: number; leadConversionRate: number;
  openDeals: number; openValue: number;
  wonDeals: number; wonValue: number; lostDeals: number; winRate: number;
  activitiesLogged: number; overdueActivities: number;
}
export interface TeamPerformance {
  teamId: string;
  teamName: string;
  teamLeadName: string | null;
  members: OwnerPerformanceRow[];
  totalLeads: number;
  totalWonDeals: number;
  totalWonValue: number;
  totalOpenValue: number;
}
export interface SalesPerformanceReport {
  owners: OwnerPerformanceRow[];
  totalWonValue: number;
  totalWonDeals: number;
  /** Every team for a full-access role; only the teams they lead for a team lead. */
  teams: TeamPerformance[] | null;
  /** Visible people belonging to none of those teams — never silently dropped. */
  ungrouped: OwnerPerformanceRow[] | null;
}

export interface LeadSourceRow {
  source: string; leads: number; converted: number; conversionRate: number;
  estimatedValue: number; wonDeals: number; wonValue: number;
  avgScore: number; avgDaysToConvert: number;
}
export interface LeadSourceReport {
  sources: LeadSourceRow[]; totalLeads: number; totalConverted: number; overallConversionRate: number;
}

export interface FunnelStage {
  stage: string; count: number; shareOfTotal: number; stepConversionRate: number;
}
export interface ConversionTrendPoint { period: string; created: number; converted: number; rate: number }
export interface LeadConversionReport {
  funnel: FunnelStage[]; trend: ConversionTrendPoint[];
  totalLeads: number; converted: number; conversionRate: number;
  avgDaysToConvert: number; avgScoreConverted: number; avgScoreUnconverted: number;
}

export interface StageDurationRow {
  stage: string; transitions: number; avgDays: number; medianDays: number; dealsCurrentlyHere: number;
}
export interface VelocityReport {
  stages: StageDurationRow[];
  avgSalesCycleDays: number; avgDaysToWin: number; avgDaysToLose: number;
  closedDealsAnalysed: number; hasHistory: boolean; historyNote: string | null;
}

export interface ActivityTypeRow {
  type: string; total: number; completed: number; open: number; overdue: number;
}
export interface ActivityOwnerRow {
  owner: string; total: number; completed: number; open: number; overdue: number; completionRate: number;
}
export interface ActivityReport {
  byType: ActivityTypeRow[]; byOwner: ActivityOwnerRow[];
  total: number; completed: number; open: number; overdue: number; completionRate: number;
}

export interface AccountRevenueRow {
  customerId: string; name: string; industry: string; tier: string; accountManager: string;
  totalDeals: number; openDeals: number; openValue: number;
  wonDeals: number; wonValue: number; recordedRevenue: number; lastActivity: string | null;
}
export interface AccountRevenueReport {
  accounts: AccountRevenueRow[]; totalAccounts: number;
  totalWonValue: number; totalOpenValue: number;
}

// ── Catalogue ───────────────────────────────────────────────────────────────

export type ReportId =
  | "pipeline" | "win-loss" | "performance" | "lead-sources"
  | "conversion" | "velocity" | "activities" | "accounts";

// Titles/descriptions here are English fallbacks only — the UI renders the translated
// `crm:reports.catalogue.<id>.*` keys. They document the catalogue at a glance.
export interface ReportMeta {
  id:          ReportId;
  title:       string;
  description: string;
  /** Lucide icon name, resolved by the reports hub. */
  icon:        string;
  group:       "Sales" | "Leads" | "Accounts";
}

export const REPORT_CATALOGUE: ReportMeta[] = [
  { id: "pipeline",     group: "Sales",    icon: "Workflow",   title: "Sales Pipeline",
    description: "Open opportunities by stage and forecast category, with weighted value." },
  { id: "win-loss",     group: "Sales",    icon: "Trophy",     title: "Win / Loss Analysis",
    description: "Won vs lost over time, win rate, and why deals are being lost." },
  { id: "velocity",     group: "Sales",    icon: "Gauge",      title: "Sales Velocity",
    description: "How long deals sit in each stage and how long a full cycle takes." },
  { id: "performance",  group: "Sales",    icon: "Users",      title: "Team Performance",
    description: "Per-owner scorecard across leads, opportunities and activities." },
  { id: "conversion",   group: "Leads",    icon: "Filter",     title: "Lead Conversion",
    description: "Funnel drop-off, conversion trend and time to convert." },
  { id: "lead-sources", group: "Leads",    icon: "Radio",      title: "Lead Source ROI",
    description: "Which sources deliver leads that actually become revenue." },
  { id: "activities",   group: "Leads",    icon: "ListChecks", title: "Activity Report",
    description: "Call, meeting and task volume, completion rate and overdue load." },
  { id: "accounts",     group: "Accounts", icon: "Building2",  title: "Account Revenue",
    description: "Revenue and open pipeline rolled up per account." },
];

// ── Client ──────────────────────────────────────────────────────────────────

export const crmReportsApi = {
  pipeline:    (f: ReportFilter = {}): Promise<SalesPipelineReport> =>
    rawApiClient.get(`${BASE}/pipeline${toQuery(f)}`),
  winLoss:     (f: ReportFilter = {}): Promise<WinLossReport> =>
    rawApiClient.get(`${BASE}/win-loss${toQuery(f)}`),
  performance: (f: ReportFilter = {}): Promise<SalesPerformanceReport> =>
    rawApiClient.get(`${BASE}/performance${toQuery(f)}`),
  leadSources: (f: ReportFilter = {}): Promise<LeadSourceReport> =>
    rawApiClient.get(`${BASE}/lead-sources${toQuery(f)}`),
  conversion:  (f: ReportFilter = {}): Promise<LeadConversionReport> =>
    rawApiClient.get(`${BASE}/conversion${toQuery(f)}`),
  velocity:    (f: ReportFilter = {}): Promise<VelocityReport> =>
    rawApiClient.get(`${BASE}/velocity${toQuery(f)}`),
  activities:  (f: ReportFilter = {}): Promise<ActivityReport> =>
    rawApiClient.get(`${BASE}/activities${toQuery(f)}`),
  accounts:    (f: ReportFilter = {}): Promise<AccountRevenueReport> =>
    rawApiClient.get(`${BASE}/accounts${toQuery(f)}`),
};
