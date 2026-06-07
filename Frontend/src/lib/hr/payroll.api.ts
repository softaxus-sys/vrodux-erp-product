import { rawApiClient, type PagedResult } from "@/lib/api-client";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/hr/payroll`;

export interface PayrollSlipDto {
  id: string;
  employeeId: string;
  employeeName: string;
  jobTitle: string | null;
  departmentName: string | null;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  notes: string | null;
}

export interface PayrollRunDto {
  id: string;
  runNumber: string;
  period: string;
  totalBasicSalary: number;
  totalAllowances: number;
  totalDeductions: number;
  totalNetSalary: number;
  status: string;
  notes: string | null;
  slipCount: number;
  processedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface PayrollRunDetailDto extends Omit<PayrollRunDto, "slipCount"> {
  slips: PayrollSlipDto[];
}

export interface GetPayrollParams {
  page?: number;
  pageSize?: number;
  period?: string;
  status?: string;
}

export interface SlipRequest {
  employeeId: string;
  employeeName: string;
  jobTitle?: string | null;
  departmentName?: string | null;
  basicSalary: number;
  allowances: number;
  deductions: number;
  notes?: string | null;
}

export interface CreatePayrollRunRequest {
  period: string;
  notes?: string | null;
  slips: SlipRequest[];
}

export interface GeneratePayrollRequest {
  period: string;
  notes?: string | null;
}

export const payrollApi = {
  getAll: (params: GetPayrollParams = {}): Promise<PagedResult<PayrollRunDto>> => {
    const qs = new URLSearchParams();
    if (params.page)     qs.set("page",     String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params.period)   qs.set("period",   params.period);
    if (params.status)   qs.set("status",   params.status);
    return rawApiClient.get<PagedResult<PayrollRunDto>>(`${BASE}?${qs}`);
  },

  getById: (id: string): Promise<PayrollRunDetailDto> =>
    rawApiClient.get<PayrollRunDetailDto>(`${BASE}/${id}`),

  create: (data: CreatePayrollRunRequest): Promise<PayrollRunDetailDto> =>
    rawApiClient.post<PayrollRunDetailDto>(BASE, data),

  generate: (data: GeneratePayrollRequest): Promise<PayrollRunDetailDto> =>
    rawApiClient.post<PayrollRunDetailDto>(`${BASE}/generate`, data),

  process: (id: string): Promise<void> =>
    rawApiClient.post<void>(`${BASE}/${id}/process`),

  pay: (id: string): Promise<void> =>
    rawApiClient.post<void>(`${BASE}/${id}/pay`),

  delete: (id: string): Promise<void> =>
    rawApiClient.delete<void>(`${BASE}/${id}`),
};
