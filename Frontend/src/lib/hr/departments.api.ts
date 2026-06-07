import { rawApiClient } from "@/lib/api-client";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/hr/departments`;

export interface DepartmentDto {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  managerId: string | null;
  isActive: boolean;
  employeeCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface UpsertDepartmentRequest {
  name: string;
  code?: string | null;
  description?: string | null;
  managerId?: string | null;
  isActive?: boolean;
}

export const departmentsApi = {
  getAll: (params?: { search?: string; isActive?: boolean }): Promise<DepartmentDto[]> => {
    const qs = new URLSearchParams();
    if (params?.search)              qs.set("search",   params.search);
    if (params?.isActive !== undefined) qs.set("isActive", String(params.isActive));
    const q = qs.toString();
    return rawApiClient.get<DepartmentDto[]>(q ? `${BASE}?${q}` : BASE);
  },

  getById: (id: string): Promise<DepartmentDto> =>
    rawApiClient.get<DepartmentDto>(`${BASE}/${id}`),

  create: (data: UpsertDepartmentRequest): Promise<DepartmentDto> =>
    rawApiClient.post<DepartmentDto>(BASE, data),

  update: (id: string, data: UpsertDepartmentRequest): Promise<void> =>
    rawApiClient.put<void>(`${BASE}/${id}`, data),

  delete: (id: string): Promise<void> =>
    rawApiClient.delete<void>(`${BASE}/${id}`),
};
