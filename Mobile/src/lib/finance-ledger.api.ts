import { apiClient, type PagedResult } from "@/lib/api-client";
import type {
  BudgetDto,
  BudgetingSummaryDto,
  BudgetPageParams,
  BudgetStatus,
  GenerateRecurringResult,
  JournalEntryDto,
  JournalPageParams,
  JournalsSummaryDto,
  RecurringInvoiceDto,
  RecurringPageParams,
  RecurringSummaryDto,
  TaxPeriodDto,
  TaxSummaryDto,
  TaxTransactionDto,
} from "@/types/finance-ledger";

const BASE = "/api/finance";

/**
 * No `.view` permission gate exists anywhere in the web UI for any of these four areas (grepped
 * for `finance\.(budgeting|journals|tax)\.view` -- no matches; GL has no permission strings at
 * all). Only mutating actions are gated. Recurring invoices has no dedicated key either --
 * its one gated action in the web app reuses `finance.invoicing.create`. Same reasoning as
 * FINANCE_ACCOUNTING_VIEW/FINANCE_BANKING_VIEW in finance.api.ts: these screens are shown to
 * anyone who already reached the Finance tab (proven module access), not gated on an invented
 * `.view` string that risks hiding the feature from everyone if it doesn't actually exist.
 */
export const FINANCE_BUDGETING_CREATE = "finance.budgeting.create";
export const FINANCE_JOURNALS_CREATE = "finance.journals.create";
export const FINANCE_TAX_CREATE = "finance.tax.create";

function buildBudgetsQuery(p: BudgetPageParams): string {
  const qs = new URLSearchParams();
  qs.set("page", String(p.page ?? 1));
  qs.set("pageSize", String(p.pageSize ?? 30));
  if (p.period) qs.set("period", p.period);
  if (p.status) qs.set("status", p.status);
  if (p.search?.trim()) qs.set("search", p.search.trim());
  return qs.toString();
}

function buildJournalsQuery(p: JournalPageParams): string {
  const qs = new URLSearchParams();
  qs.set("page", String(p.page ?? 1));
  qs.set("pageSize", String(p.pageSize ?? 30));
  if (p.search?.trim()) qs.set("search", p.search.trim());
  if (p.status) qs.set("status", p.status);
  if (p.period) qs.set("period", p.period);
  return qs.toString();
}

function buildRecurringQuery(p: RecurringPageParams): string {
  const qs = new URLSearchParams();
  qs.set("page", String(p.page ?? 1));
  qs.set("pageSize", String(p.pageSize ?? 30));
  if (p.search?.trim()) qs.set("search", p.search.trim());
  if (p.isActive !== undefined) qs.set("isActive", String(p.isActive));
  return qs.toString();
}

export const financeLedgerApi = {
  // ── Budgets ──────────────────────────────────────────────────────────────
  // No getBudgetById/update/delete exist on the backend client -- the list DTO
  // (name/period/status/variance/lineCount) is all there is; no separate detail screen.
  getBudgets: (params: BudgetPageParams = {}): Promise<PagedResult<BudgetDto>> =>
    apiClient.get(`${BASE}/budgets?${buildBudgetsQuery(params)}`),

  getBudgetingSummary: (): Promise<BudgetingSummaryDto> => apiClient.get(`${BASE}/budgets/summary`),

  changeBudgetStatus: (id: string, status: BudgetStatus): Promise<void> =>
    apiClient.post(`${BASE}/budgets/${id}/status`, { status }),

  // ── Journals (read side -- /journals; writes live on the separate /journal-entries
  //     controller, mirrored here since a mobile "Post"/"Void" action needs them) ──────────
  getJournals: (params: JournalPageParams = {}): Promise<PagedResult<JournalEntryDto>> =>
    apiClient.get(`${BASE}/journals?${buildJournalsQuery(params)}`),

  getJournalsSummary: (): Promise<JournalsSummaryDto> => apiClient.get(`${BASE}/journals/summary`),

  postJournalEntry: (id: string): Promise<void> => apiClient.post(`${BASE}/journal-entries/${id}/post`),

  voidJournalEntry: (id: string): Promise<void> => apiClient.post(`${BASE}/journal-entries/${id}/void`),

  // ── Tax / VAT ────────────────────────────────────────────────────────────
  getTaxPeriods: (): Promise<TaxPeriodDto[]> => apiClient.get(`${BASE}/tax/periods`),

  // A period is required -- omitting it reads every invoice/bill the tenant has ever issued.
  getTaxTransactions: (period: string): Promise<TaxTransactionDto[]> =>
    apiClient.get(`${BASE}/tax/transactions?period=${encodeURIComponent(period)}`),

  getTaxSummary: (): Promise<TaxSummaryDto> => apiClient.get(`${BASE}/tax/summary`),

  fileTaxPeriod: (id: string): Promise<void> => apiClient.post(`${BASE}/tax/periods/${id}/file`),

  payTaxPeriod: (id: string): Promise<void> => apiClient.post(`${BASE}/tax/periods/${id}/pay`),

  // ── Recurring Invoices ───────────────────────────────────────────────────
  // No getRecurringInvoiceById -- the list DTO already carries `lines[]` in full, so the detail
  // screen reuses the row passed in via navigation params instead of a second fetch.
  getRecurringInvoices: (params: RecurringPageParams = {}): Promise<PagedResult<RecurringInvoiceDto>> =>
    apiClient.get(`${BASE}/recurring-invoices?${buildRecurringQuery(params)}`),

  getRecurringSummary: (): Promise<RecurringSummaryDto> => apiClient.get(`${BASE}/recurring-invoices/summary`),

  pauseRecurringInvoice: (id: string): Promise<void> => apiClient.post(`${BASE}/recurring-invoices/${id}/pause`),

  resumeRecurringInvoice: (id: string): Promise<void> => apiClient.post(`${BASE}/recurring-invoices/${id}/resume`),

  generateRecurringNow: (id: string): Promise<GenerateRecurringResult> =>
    apiClient.post(`${BASE}/recurring-invoices/${id}/generate`),
};
