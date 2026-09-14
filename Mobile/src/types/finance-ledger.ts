/**
 * Budgets, Journals, Tax/VAT, Recurring Invoices -- the rest of the Finance module beyond
 * Invoices/Expenses/Accounts/Banking (types/finance.ts). Split into its own file since
 * types/finance.ts was already ~270 lines before this; same convention as hr-directory.ts.
 * Mirrors FrontendVite/src/lib/finance/finance.api.ts's shapes exactly.
 */

// ── Budgets ─────────────────────────────────────────────────────────────────────────────────
export type BudgetStatus = "draft" | "approved" | "active" | "closed";

export interface BudgetDto {
  id: string;
  name: string;
  period: string;
  status: BudgetStatus;
  totalBudgeted: number;
  totalActual: number;
  variance: number;
  /** List DTO only carries the count -- there is no line-item detail endpoint on the backend. */
  lineCount: number;
}

export interface BudgetPageParams {
  period?: string;
  status?: BudgetStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface BudgetingSummaryDto {
  totalBudget: number;
  totalActual: number;
  overallVariance: number;
  variancePct: number;
  depsOverBudget: number;
  depsUnderBudget: number;
  utilisation: number;
}

export const BUDGET_STATUS_LABELS: Record<BudgetStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  active: "Active",
  closed: "Closed",
};

export const BUDGET_STATUS_TONE: Record<BudgetStatus, "success" | "warning" | "destructive" | "info" | "neutral"> = {
  draft: "neutral",
  approved: "info",
  active: "success",
  closed: "neutral",
};

// ── Journals ────────────────────────────────────────────────────────────────────────────────
export type JournalStatus = "draft" | "posted" | "reversed" | "voided";

export interface JournalLineDto {
  id: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
}

/** Returned by `GET /journals` -- lines are embedded even in the list response, so a detail
 *  screen never needs a second fetch (there is no `getJournalById` on the backend anyway). */
export interface JournalEntryDto {
  id: string;
  journalNumber: string;
  date: string;
  reference: string;
  description: string;
  status: JournalStatus;
  lines: JournalLineDto[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  createdBy: string;
  postedBy?: string;
  postedDate?: string;
  period: string;
}

export interface JournalPageParams {
  search?: string;
  status?: string;
  /** yyyy-MM, prefix-matched server-side. */
  period?: string;
  page?: number;
  pageSize?: number;
}

export interface JournalsSummaryDto {
  total: number;
  draft: number;
  posted: number;
  reversed: number;
  totalPostedValue: number;
  thisMonth: number;
}

export const JOURNAL_STATUS_LABELS: Record<JournalStatus, string> = {
  draft: "Draft",
  posted: "Posted",
  reversed: "Reversed",
  voided: "Voided",
};

export const JOURNAL_STATUS_TONE: Record<JournalStatus, "success" | "warning" | "destructive" | "info" | "neutral"> = {
  draft: "neutral",
  posted: "success",
  reversed: "warning",
  voided: "destructive",
};

// ── Tax / VAT ───────────────────────────────────────────────────────────────────────────────
export type TaxPeriodStatus = "open" | "filed" | "paid" | "overdue";

export interface TaxPeriodDto {
  id: string;
  period: string;
  from: string;
  to: string;
  status: TaxPeriodStatus;
  outputVat: number;
  inputVat: number;
  netVat: number;
  dueDate: string;
  filedDate?: string;
  paidDate?: string;
  penalty?: number;
}

export type TaxTransactionType = "sale" | "purchase";

export interface TaxTransactionDto {
  id: string;
  date: string;
  type: TaxTransactionType;
  reference: string;
  amount: number;
  vatAmount: number;
  vatRate: number;
  description: string;
  period: string;
}

export interface TaxSummaryDto {
  currentPeriodOutput: number;
  currentPeriodInput: number;
  currentNetVat: number;
  ytdVatPaid: number;
  nextDueDate: string;
  currentPeriod: string;
  registrationNumber: string;
}

export const TAX_PERIOD_STATUS_LABELS: Record<TaxPeriodStatus, string> = {
  open: "Open",
  filed: "Filed",
  paid: "Paid",
  overdue: "Overdue",
};

export const TAX_PERIOD_STATUS_TONE: Record<TaxPeriodStatus, "success" | "warning" | "destructive" | "info" | "neutral"> = {
  open: "info",
  filed: "warning",
  paid: "success",
  overdue: "destructive",
};

// ── Recurring Invoices ──────────────────────────────────────────────────────────────────────
export type RecurrenceFrequency = "weekly" | "monthly" | "quarterly" | "yearly";

export interface RecurringLineDto {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

/** List DTO already carries `lines[]` -- there is no `getRecurringInvoiceById`, the detail
 *  screen reuses the row passed in via navigation. */
export interface RecurringInvoiceDto {
  id: string;
  templateName: string;
  customerName: string;
  customerEmail?: string | null;
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate?: string | null;
  nextRunDate: string;
  dueDays: number;
  taxRate: number;
  notes?: string | null;
  isActive: boolean;
  lastGeneratedDate?: string | null;
  generatedCount: number;
  subTotal: number;
  total: number;
  lines: RecurringLineDto[];
  ccEmails?: string | null;
  autoSend: boolean;
  customerAddress?: string | null;
  customerTrn?: string | null;
}

export interface RecurringPageParams {
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface RecurringSummaryDto {
  total: number;
  active: number;
  dueSoon: number;
  generatedTotal: number;
  monthlyValue: number;
}

export const RECURRENCE_FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export interface GenerateRecurringResult {
  invoiceId: string;
  invoiceNumber: string;
  emailed: boolean;
}
