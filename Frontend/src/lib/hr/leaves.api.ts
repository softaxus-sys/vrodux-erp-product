import { rawApiClient, type PagedResult } from "@/lib/api-client";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/hr/leaves`;

export interface LeaveDto {
  id: string;
  leaveNumber: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string | null;
  status: string;
  approvedById: string | null;
  approverNotes: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface GetLeavesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  leaveType?: string;
  employeeId?: string;
}

export interface CreateLeaveRequest {
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string | null;
}

export interface ApproveRejectRequest {
  approverId: string;
  notes?: string | null;
}

export const leavesApi = {
  getAll: (params: GetLeavesParams = {}): Promise<PagedResult<LeaveDto>> => {
    const qs = new URLSearchParams();
    if (params.page)       qs.set("page",       String(params.page));
    if (params.pageSize)   qs.set("pageSize",   String(params.pageSize));
    if (params.search)     qs.set("search",     params.search);
    if (params.status)     qs.set("status",     params.status);
    if (params.leaveType)  qs.set("leaveType",  params.leaveType);
    if (params.employeeId) qs.set("employeeId", params.employeeId);
    return rawApiClient.get<PagedResult<LeaveDto>>(`${BASE}?${qs}`);
  },

  getById: (id: string): Promise<LeaveDto> =>
    rawApiClient.get<LeaveDto>(`${BASE}/${id}`),

  create: (data: CreateLeaveRequest): Promise<LeaveDto> =>
    rawApiClient.post<LeaveDto>(BASE, data),

  approve: (id: string, data: ApproveRejectRequest): Promise<void> =>
    rawApiClient.post<void>(`${BASE}/${id}/approve`, data),

  reject: (id: string, data: ApproveRejectRequest): Promise<void> =>
    rawApiClient.post<void>(`${BASE}/${id}/reject`, data),

  cancel: (id: string): Promise<void> =>
    rawApiClient.post<void>(`${BASE}/${id}/cancel`),

  delete: (id: string): Promise<void> =>
    rawApiClient.delete<void>(`${BASE}/${id}`),
};
