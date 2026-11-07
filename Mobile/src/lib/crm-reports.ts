/**
 * The eight CRM reports, described as data so one screen can render all of them. Each names the tiles to
 * show and the tables to list; percentages already arrive as 0-100 from the server, money is in the
 * workspace currency. Mirrors the web section (`modules/crm/reports`), minus charts and export.
 */
export type ReportFmt = "int" | "money" | "pct" | "days" | "text";

export interface ReportTile { field: string; label: string; fmt: ReportFmt; primary?: boolean }
export interface ReportColumn { field: string; label: string; fmt?: ReportFmt }
export interface ReportTable {
  field: string;
  title: string;
  /** First column is the row's name; the rest are shown as "label value" pairs underneath. */
  columns: ReportColumn[];
}
export interface ReportDef {
  id: string;
  title: string;
  description: string;
  icon: "bar-chart-2" | "award" | "users" | "target" | "filter" | "clock" | "activity" | "briefcase";
  /** Which date the range applies to -- shown so a figure is never misread. */
  rangeNote: string;
  tiles: ReportTile[];
  tables: ReportTable[];
  note?: (d: Record<string, any>) => string | null;
}

export const CRM_REPORT_DEFS: ReportDef[] = [
  {
    id: "pipeline", title: "Sales pipeline", description: "Open value by stage and forecast category", icon: "bar-chart-2",
    rangeNote: "Opportunities created in the range",
    tiles: [
      { field: "openCount", label: "Open deals", fmt: "int" },
      { field: "openValue", label: "Open value", fmt: "money", primary: true },
      { field: "weightedValue", label: "Weighted", fmt: "money" },
      { field: "commitValue", label: "Commit", fmt: "money" },
      { field: "bestCaseValue", label: "Best case", fmt: "money" },
      { field: "avgDealSize", label: "Avg deal", fmt: "money" },
    ],
    tables: [
      { field: "byStage", title: "By stage", columns: [{ field: "stage", label: "Stage" }, { field: "count", label: "Deals", fmt: "int" }, { field: "value", label: "Value", fmt: "money" }, { field: "weightedValue", label: "Weighted", fmt: "money" }] },
      { field: "byForecastCategory", title: "By forecast", columns: [{ field: "category", label: "Category" }, { field: "count", label: "Deals", fmt: "int" }, { field: "value", label: "Value", fmt: "money" }] },
    ],
  },
  {
    id: "win-loss", title: "Win / loss", description: "Win rate, loss reasons and trend", icon: "award",
    rangeNote: "Opportunities closed in the range",
    tiles: [
      { field: "wonCount", label: "Won", fmt: "int" },
      { field: "lostCount", label: "Lost", fmt: "int" },
      { field: "winRate", label: "Win rate", fmt: "pct", primary: true },
      { field: "wonValue", label: "Won value", fmt: "money" },
      { field: "avgWonDealSize", label: "Avg won deal", fmt: "money" },
      { field: "avgDaysToClose", label: "Avg to close", fmt: "days" },
    ],
    tables: [
      { field: "lossReasons", title: "Why deals were lost", columns: [{ field: "reason", label: "Reason" }, { field: "count", label: "Deals", fmt: "int" }, { field: "share", label: "Share", fmt: "pct" }] },
      { field: "trend", title: "By period", columns: [{ field: "period", label: "Period" }, { field: "won", label: "Won", fmt: "int" }, { field: "lost", label: "Lost", fmt: "int" }, { field: "winRate", label: "Win rate", fmt: "pct" }] },
    ],
  },
  {
    id: "performance", title: "Team performance", description: "Leads, deals and revenue per person and team", icon: "users",
    rangeNote: "Closed deals, and leads and activities created in the range",
    tiles: [
      { field: "totalWonDeals", label: "Deals won", fmt: "int" },
      { field: "totalWonValue", label: "Won value", fmt: "money", primary: true },
    ],
    tables: [
      { field: "teams", title: "By team", columns: [{ field: "teamName", label: "Team" }, { field: "totalLeads", label: "Leads", fmt: "int" }, { field: "totalWonDeals", label: "Won", fmt: "int" }, { field: "totalWonValue", label: "Won value", fmt: "money" }, { field: "totalOpenValue", label: "Open value", fmt: "money" }] },
      { field: "owners", title: "By person", columns: [{ field: "ownerName", label: "Person" }, { field: "leadsOwned", label: "Leads", fmt: "int" }, { field: "leadsConverted", label: "Converted", fmt: "int" }, { field: "wonDeals", label: "Won", fmt: "int" }, { field: "wonValue", label: "Won value", fmt: "money" }, { field: "winRate", label: "Win rate", fmt: "pct" }, { field: "overdueActivities", label: "Overdue", fmt: "int" }] },
    ],
  },
  {
    id: "lead-sources", title: "Lead sources", description: "Which sources convert and earn", icon: "target",
    rangeNote: "Leads created in the range",
    tiles: [
      { field: "totalLeads", label: "Leads", fmt: "int" },
      { field: "totalConverted", label: "Converted", fmt: "int" },
      { field: "overallConversionRate", label: "Conversion", fmt: "pct", primary: true },
    ],
    tables: [
      { field: "sources", title: "By source", columns: [{ field: "source", label: "Source" }, { field: "leads", label: "Leads", fmt: "int" }, { field: "converted", label: "Converted", fmt: "int" }, { field: "conversionRate", label: "Rate", fmt: "pct" }, { field: "wonValue", label: "Won value", fmt: "money" }, { field: "avgScore", label: "Avg score", fmt: "int" }] },
    ],
  },
  {
    id: "conversion", title: "Lead conversion", description: "Funnel, trend and time to convert", icon: "filter",
    rangeNote: "Leads created in the range (a snapshot, not a cohort)",
    tiles: [
      { field: "totalLeads", label: "Leads", fmt: "int" },
      { field: "converted", label: "Converted", fmt: "int" },
      { field: "conversionRate", label: "Conversion", fmt: "pct", primary: true },
      { field: "avgDaysToConvert", label: "Avg to convert", fmt: "days" },
    ],
    tables: [
      { field: "funnel", title: "Funnel", columns: [{ field: "stage", label: "Stage" }, { field: "count", label: "Leads", fmt: "int" }, { field: "shareOfTotal", label: "Of all", fmt: "pct" }, { field: "stepConversionRate", label: "From previous", fmt: "pct" }] },
      { field: "trend", title: "By period", columns: [{ field: "period", label: "Period" }, { field: "created", label: "Created", fmt: "int" }, { field: "converted", label: "Converted", fmt: "int" }, { field: "rate", label: "Rate", fmt: "pct" }] },
    ],
  },
  {
    id: "velocity", title: "Sales velocity", description: "How long deals sit in each stage", icon: "clock",
    rangeNote: "Stage changes in the range",
    tiles: [
      { field: "avgSalesCycleDays", label: "Sales cycle", fmt: "days", primary: true },
      { field: "avgDaysToWin", label: "To win", fmt: "days" },
      { field: "avgDaysToLose", label: "To lose", fmt: "days" },
      { field: "closedDealsAnalysed", label: "Deals analysed", fmt: "int" },
    ],
    tables: [
      { field: "stages", title: "Time in stage", columns: [{ field: "stage", label: "Stage" }, { field: "avgDays", label: "Average", fmt: "days" }, { field: "medianDays", label: "Median", fmt: "days" }, { field: "dealsCurrentlyHere", label: "Here now", fmt: "int" }] },
    ],
    note: (d) => (d.hasHistory === false ? (d.historyNote as string | null) ?? "Stage timings build up from the day tracking started." : null),
  },
  {
    id: "activities", title: "Activities", description: "Volume, completion and overdue work", icon: "activity",
    rangeNote: "Activities created in the range",
    tiles: [
      { field: "total", label: "Total", fmt: "int" },
      { field: "completed", label: "Completed", fmt: "int" },
      { field: "open", label: "Open", fmt: "int" },
      { field: "overdue", label: "Overdue", fmt: "int" },
      { field: "completionRate", label: "Completion", fmt: "pct", primary: true },
    ],
    tables: [
      { field: "byType", title: "By type", columns: [{ field: "type", label: "Type" }, { field: "total", label: "Total", fmt: "int" }, { field: "completed", label: "Done", fmt: "int" }, { field: "overdue", label: "Overdue", fmt: "int" }] },
      { field: "byOwner", title: "By person", columns: [{ field: "owner", label: "Person" }, { field: "total", label: "Total", fmt: "int" }, { field: "completed", label: "Done", fmt: "int" }, { field: "overdue", label: "Overdue", fmt: "int" }, { field: "completionRate", label: "Completion", fmt: "pct" }] },
    ],
  },
  {
    id: "accounts", title: "Account revenue", description: "Won and open value by account", icon: "briefcase",
    rangeNote: "Opportunities closed in the range",
    tiles: [
      { field: "totalAccounts", label: "Accounts", fmt: "int" },
      { field: "totalWonValue", label: "Won value", fmt: "money", primary: true },
      { field: "totalOpenValue", label: "Open value", fmt: "money" },
    ],
    tables: [
      { field: "accounts", title: "Accounts", columns: [{ field: "name", label: "Account" }, { field: "wonDeals", label: "Won", fmt: "int" }, { field: "wonValue", label: "Won value", fmt: "money" }, { field: "openValue", label: "Open value", fmt: "money" }, { field: "recordedRevenue", label: "Recorded", fmt: "money" }] },
    ],
  },
];

export const reportDef = (id: string) => CRM_REPORT_DEFS.find((r) => r.id === id);
