import { rawApiClient, type PagedResult } from "@/lib/api-client";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/hr/employees`;

export interface EmployeeDto {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string | null;
  jobTitle: string | null;
  departmentId: string | null;
  departmentName: string | null;
  employmentType: string;
  basicSalary: number;
  joiningDate: string;
  terminationDate: string | null;
  status: string;
  managerId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface EmployeeSimpleDto {
  id: string;
  employeeNumber: string;
  fullName: string;
  jobTitle: string | null;
  departmentName: string | null;
  basicSalary: number;
}

export interface GetEmployeesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  employmentType?: string;
  departmentId?: string;
}

export interface CreateEmployeeRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  jobTitle?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  employmentType: string;
  basicSalary: number;
  joiningDate: string;
  managerId?: string | null;
  notes?: string | null;
}

export interface UpdateEmployeeRequest extends CreateEmployeeRequest {
  status: string;
}

export const employeesApi = {
  getAll: (params: GetEmployeesParams = {}): Promise<PagedResult<EmployeeDto>> => {
    const qs = new URLSearchParams();
    if (params.page)           qs.set("page",           String(params.page));
    if (params.pageSize)       qs.set("pageSize",       String(params.pageSize));
    if (params.search)         qs.set("search",         params.search);
    if (params.status)         qs.set("status",         params.status);
    if (params.employmentType) qs.set("employmentType", params.employmentType);
    if (params.departmentId)   qs.set("departmentId",   params.departmentId);
    return rawApiClient.get<PagedResult<EmployeeDto>>(`${BASE}?${qs}`);
  },

  getAll2: (): Promise<EmployeeSimpleDto[]> =>
    rawApiClient.get<EmployeeSimpleDto[]>(`${BASE}/all`),

  getById: (id: string): Promise<EmployeeDto> =>
    rawApiClient.get<EmployeeDto>(`${BASE}/${id}`),

  create: (data: CreateEmployeeRequest): Promise<EmployeeDto> =>
    rawApiClient.post<EmployeeDto>(BASE, data),

  update: (id: string, data: UpdateEmployeeRequest): Promise<void> =>
    rawApiClient.put<void>(`${BASE}/${id}`, data),

  delete: (id: string): Promise<void> =>
    rawApiClient.delete<void>(`${BASE}/${id}`),
};
