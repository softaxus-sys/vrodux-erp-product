import { apiClient, type PagedResult } from "@/lib/api-client";
import type {
  AccountDto,
  AccountingSummaryDto,
  AccountsPageParams,
  AccountTypeDto,
  BankAccountDto,
  BankingSummaryDto,
  BankTransactionDto,
  BankTxPageParams,
  CreateExpensePayload,
  ExpenseDto,
  ExpensesPageParams,
  InvoiceDto,
  InvoicesPageParams,
  InvoiceSummaryDto,
} from "@/types/finance";

const BASE = "/api/finance";

export const FINANCE_INVOICING_VIEW = "finance.invoicing.view";
export const FINANCE_INVOICING_EDIT = "finance.invoicing.edit";
export const FINANCE_EXPENSES_VIEW = "finance.expenses.view";
export const FINANCE_EXPENSES_CREATE = "finance.expenses.create";
/**
 * `.view` keys below aren't confirmed against an exact backend call site (grepping the web app
 * found only `.create`/`.edit` in live UI code -- no `<Can>`/hasRawPermission gate on plain reads
 * anywhere in accounting-view.tsx/banking-view.tsx, since page access there is gated only by the
 * `finance` module guard). Named by analogy with every other module's `<key>.view` convention
 * (hr.employees.view, sales.orders.view, ...) -- verify against the real permission seed before
 * relying on a 403 to mean "no access" vs "key doesn't exist".
 */
export const FINANCE_ACCOUNTING_VIEW = "finance.accounting.view";
export const FINANCE_BANKING_VIEW = "finance.banking.view";

function buildAccountsQuery(p: AccountsPageParams): string {
  const qs = new URLSearchParams();
  if (p.search?.trim()) qs.set("search", p.search.trim());
  if (p.accountType) qs.set("accountType", p.accountType);
  if (p.isActive !== undefined) qs.set("isActive", String(p.isActive));
  return qs.toString();
}

function buildBankTxQuery(p: BankTxPageParams): string {
  const qs = new URLSearchParams();
  qs.set("page", String(p.page ?? 1));
  qs.set("pageSize", String(p.pageSize ?? 30));
  if (p.accountId) qs.set("accountId", p.accountId);
  if (p.type) qs.set("type", p.type);
  if (p.search?.trim()) qs.set("search", p.search.trim());
  if (p.reconciled !== undefined) qs.set("reconciled", String(p.reconciled));
  return qs.toString();
}

function buildInvoicesQuery(p: InvoicesPageParams): string {
  const qs = new URLSearchParams();
  qs.set("page", String(p.page ?? 1));
  qs.set("pageSize", String(p.pageSize ?? 25));
  if (p.search?.trim()) qs.set("search", p.search.trim());
  if (p.status && p.status !== "all") qs.set("status", p.status);
  return qs.toString();
}

function buildExpensesQuery(p: ExpensesPageParams): string {
  const qs = new URLSearchParams();
  qs.set("page", String(p.page ?? 1));
  qs.set("pageSize", String(p.pageSize ?? 25));
  if (p.search?.trim()) qs.set("search", p.search.trim());
  if (p.status && p.status !== "all") qs.set("status", p.status);
  if (p.category && p.category !== "all") qs.set("category", p.category);
  return qs.toString();
}

export const financeApi = {
  // ── Invoices ───────────────────────────────────────────────────────────
  getInvoices: (params: InvoicesPageParams = {}): Promise<PagedResult<InvoiceSummaryDto>> =>
    apiClient.get(`${BASE}/invoices?${buildInvoicesQuery(params)}`),

  getInvoice: (id: string): Promise<InvoiceDto> => apiClient.get(`${BASE}/invoices/${id}`),

  sendInvoice: (id: string): Promise<void> => apiClient.post(`${BASE}/invoices/${id}/send`),

  markInvoicePaid: (id: string): Promise<void> => apiClient.post(`${BASE}/invoices/${id}/pay`),

  // ── Expenses ───────────────────────────────────────────────────────────
  getExpenses: (params: ExpensesPageParams = {}): Promise<PagedResult<ExpenseDto>> =>
    apiClient.get(`${BASE}/expenses?${buildExpensesQuery(params)}`),

  getExpense: (id: string): Promise<ExpenseDto> => apiClient.get(`${BASE}/expenses/${id}`),

  createExpense: (payload: CreateExpensePayload): Promise<ExpenseDto> =>
    apiClient.post(`${BASE}/expenses`, payload),

  // ── Accounts (chart of accounts) ──────────────────────────────────────
  getAccounts: (params: AccountsPageParams = {}): Promise<AccountDto[]> => {
    const qs = buildAccountsQuery(params);
    return apiClient.get(`${BASE}/accounts${qs ? `?${qs}` : ""}`);
  },

  getAccount: (id: string): Promise<AccountDto> => apiClient.get(`${BASE}/accounts/${id}`),

  getAccountingSummary: (): Promise<AccountingSummaryDto> => apiClient.get(`${BASE}/accounts/summary`),

  getAccountTypes: (): Promise<AccountTypeDto[]> => apiClient.get(`${BASE}/account-types`),

  // ── Banking ────────────────────────────────────────────────────────────
  getBankAccounts: (): Promise<BankAccountDto[]> => apiClient.get(`${BASE}/banking/accounts`),

  getBankTransactions: (params: BankTxPageParams = {}): Promise<PagedResult<BankTransactionDto>> =>
    apiClient.get(`${BASE}/banking/transactions?${buildBankTxQuery(params)}`),

  getBankingSummary: (): Promise<BankingSummaryDto> => apiClient.get(`${BASE}/banking/summary`),

  reconcileTransaction: (id: string): Promise<void> =>
    apiClient.post(`${BASE}/banking/transactions/${id}/reconcile`),
};
