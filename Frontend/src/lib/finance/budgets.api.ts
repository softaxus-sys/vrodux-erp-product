import { rawApiClient } from "@/lib/api-client";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/finance/budgets`;

export interface BudgetLineDto {
  id: string;
  category: string;
  accountName: string | null;
  budgetedAmount: number;
  actualAmount: number;
  variance: number;
}

export interface BudgetSummaryDto {
  id: string;
  name: string;
  period: string;
  status: string;
  totalBudgeted: number;
  totalActual: number;
  variance: number;
  lineCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface BudgetDto extends Omit<BudgetSummaryDto, "lineCount"> {
  notes: string | null;
  lines: BudgetLineDto[];
}

export interface BudgetLineRequest {
  category: string;
  accountName?: string | null;
  budgetedAmount: number;
}

export interface CreateBudgetRequest {
  name: string;
  period: string;
  notes?: string | null;
  lines: BudgetLineRequest[];
}

export interface UpdateBudgetRequest extends CreateBudgetRequest {
  status: string;
}

export const budgetsApi = {
  getAll: (params?: { period?: string; status?: string }): Promise<BudgetSummaryDto[]> => {
    const qs = new URLSearchParams();
    if (params?.period) qs.set("period", params.period);
    if (params?.status) qs.set("status", params.status);
    const q = qs.toString();
    return rawApiClient.get<BudgetSummaryDto[]>(q ? `${BASE}?${q}` : BASE);
  },

  getById: (id: string): Promise<BudgetDto> =>
    rawApiClient.get<BudgetDto>(`${BASE}/${id}`),

  create: (data: CreateBudgetRequest): Promise<BudgetDto> =>
    rawApiClient.post<BudgetDto>(BASE, data),

  update: (id: string, data: UpdateBudgetRequest): Promise<void> =>
    rawApiClient.put<void>(`${BASE}/${id}`, data),

  delete: (id: string): Promise<void> =>
    rawApiClient.delete<void>(`${BASE}/${id}`),
};
