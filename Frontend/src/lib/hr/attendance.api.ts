import { rawApiClient, type PagedResult } from "@/lib/api-client";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/hr/attendance`;

export interface AttendanceLogDto {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  workingHours: number | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface GetAttendanceParams {
  page?: number;
  pageSize?: number;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  employeeId?: string;
}

export interface CreateAttendanceRequest {
  employeeId: string;
  employeeName: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  workingHours?: number | null;
  status: string;
  notes?: string | null;
}

export interface UpdateAttendanceRequest {
  checkIn?: string | null;
  checkOut?: string | null;
  workingHours?: number | null;
  status: string;
  notes?: string | null;
}

export const attendanceApi = {
  getAll: (params: GetAttendanceParams = {}): Promise<PagedResult<AttendanceLogDto>> => {
    const qs = new URLSearchParams();
    if (params.page)       qs.set("page",       String(params.page));
    if (params.pageSize)   qs.set("pageSize",   String(params.pageSize));
    if (params.date)       qs.set("date",       params.date);
    if (params.dateFrom)   qs.set("dateFrom",   params.dateFrom);
    if (params.dateTo)     qs.set("dateTo",     params.dateTo);
    if (params.status)     qs.set("status",     params.status);
    if (params.employeeId) qs.set("employeeId", params.employeeId);
    return rawApiClient.get<PagedResult<AttendanceLogDto>>(`${BASE}?${qs}`);
  },

  getById: (id: string): Promise<AttendanceLogDto> =>
    rawApiClient.get<AttendanceLogDto>(`${BASE}/${id}`),

  create: (data: CreateAttendanceRequest): Promise<AttendanceLogDto> =>
    rawApiClient.post<AttendanceLogDto>(BASE, data),

  update: (id: string, data: UpdateAttendanceRequest): Promise<void> =>
    rawApiClient.put<void>(`${BASE}/${id}`, data),

  delete: (id: string): Promise<void> =>
    rawApiClient.delete<void>(`${BASE}/${id}`),
};
