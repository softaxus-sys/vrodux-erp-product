export type ReportCategory = "POS" | "Inventory";

export interface ReportFilterOption {
  value: string;
  label: string;
}

/** A single-select filter -- `param` is the exact outgoing query-string key the backend expects
 *  (already resolved from the web registry's UI-facing filter key to its real API param, e.g.
 *  "reason" on the web becomes "writeOffReason" here -- see lib/reports.api.ts's top-of-file note). */
export interface ReportFilterDef {
  param: string;
  label: string;
  options: ReportFilterOption[];
  required?: boolean;
}

export interface ReportNumberFilterDef {
  param: string;
  label: string;
  defaultValue: number;
}

export interface ReportDef {
  id: string;
  title: string;
  description: string;
  category: ReportCategory;
  /** Undefined = universal; defined = only shown when the tenant's resolved country matches. */
  countries?: string[];
  badges?: string[];
  regulator?: string;
  dateRange: boolean;
  /** At most one -- no report in the registry needs more than a single functional select filter
   *  beyond date range (see lib/reports.api.ts's cross-check against the web runner). */
  filter?: ReportFilterDef;
  numberFilter?: ReportNumberFilterDef;
}

export interface ReportResult {
  columns: string[];
  rows: Record<string, unknown>[];
  totalCount: number;
}
