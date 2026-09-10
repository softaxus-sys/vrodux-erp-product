import { apiClient, type PagedResult } from "@/lib/api-client";
import type {
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
};
