import { rawApiClient, type PagedResult } from "@/lib/api-client";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/finance/expenses`;

export interface ExpenseDto {
  id: string;
  expenseNumber: string;
  title: string;
  category: string;
  amount: number;
  expenseDate: string;
  paidBy: string | null;
  paymentMethod: string | null;
  reference: string | null;
  notes: string | null;
  status: string;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface GetExpensesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CreateExpenseRequest {
  title: string;
  category: string;
  amount: number;
  expenseDate: string;
  paidBy?: string | null;
  paymentMethod?: string | null;
  reference?: string | null;
  notes?: string | null;
}

export interface ApproveRequest {
  approverId: string;
}

export const expensesApi = {
  getAll: (params: GetExpensesParams = {}): Promise<PagedResult<ExpenseDto>> => {
    const qs = new URLSearchParams();
    if (params.page)     qs.set("page",     String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params.search)   qs.set("search",   params.search);
    if (params.status)   qs.set("status",   params.status);
    if (params.category) qs.set("category", params.category);
    if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
    if (params.dateTo)   qs.set("dateTo",   params.dateTo);
    return rawApiClient.get<PagedResult<ExpenseDto>>(`${BASE}?${qs}`);
  },

  getById: (id: string): Promise<ExpenseDto> =>
    rawApiClient.get<ExpenseDto>(`${BASE}/${id}`),

  create: (data: CreateExpenseRequest): Promise<ExpenseDto> =>
    rawApiClient.post<ExpenseDto>(BASE, data),

  update: (id: string, data: CreateExpenseRequest): Promise<void> =>
    rawApiClient.put<void>(`${BASE}/${id}`, data),

  approve: (id: string, data: ApproveRequest): Promise<void> =>
    rawApiClient.post<void>(`${BASE}/${id}/approve`, data),

  reject: (id: string, data: ApproveRequest): Promise<void> =>
    rawApiClient.post<void>(`${BASE}/${id}/reject`, data),

  markPaid: (id: string): Promise<void> =>
    rawApiClient.post<void>(`${BASE}/${id}/pay`),

  delete: (id: string): Promise<void> =>
    rawApiClient.delete<void>(`${BASE}/${id}`),
};
