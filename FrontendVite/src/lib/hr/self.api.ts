import { rawApiClient } from "@/lib/api-client";
import { mapAttendance } from "@/lib/hr/hr.api";
import type { LeaveRequestDto, AttendanceRecordDto, EmployeePayslipDto } from "@/lib/hr/hr.api";
import type { LeaveBalanceLineDto } from "@/lib/hr/hr.api";

const API_ROOT = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const BASE = `${API_ROOT}/api/hr/me`;

/**
 * Employee self-service.
 *
 * No call here passes an employee id — the backend resolves the subject from the token. That is
 * deliberate and is the reason these endpoints cannot return a colleague's data.
 */

export interface MyProfileDto {
  employeeId: string;
  employeeNumber: string;
  fullName: string;
  email: string;
  phone?: string | null;
  jobTitle?: string | null;
  departmentName?: string | null;
  employmentType: string;
  joiningDate: string;
  status: string;
  basicSalary: number;
  nationality?: string | null;
  emiratesId?: string | null;
  passportNumber?: string | null;
  visaExpiry?: string | null;
  bankAccount?: string | null;
  iban?: string | null;
  avatarData?: string | null;
}

export interface MyAttendanceTodayDto {
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  workingHours?: number | null;
  status?: string | null;
  /** 0 = on time, >0 = minutes late, null/undefined = nothing to judge yet. */
  lateMinutes?: number | null;
  /** The office hours it was judged against, so the screen needs no second call. */
  scheduleStart?: string | null;
  scheduleEnd?: string | null;
  graceMinutes?: number;
  isWorkingDay?: boolean;
}

export interface ApplyLeavePayload {
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string;
}

/** Raised when the signed-in user has no employee record linked — a normal state, not a fault. */
export const NOT_LINKED_HINT = "not linked to an employee record";

/** Paging for the self-service history lists — leave, attendance and payslips all grow for as
 *  long as the person is employed, so none of them can be fetched whole. */
export interface SelfPageParams {
  page?: number;
  pageSize?: number;
}

export interface SelfPaged<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

function pageQs(p: SelfPageParams, defaultSize: number): string {
  const qs = new URLSearchParams();
  qs.set("page", String(p.page ?? 1));
  qs.set("pageSize", String(p.pageSize ?? defaultSize));
  return qs.toString();
}

export const selfApi = {
  getProfile: (): Promise<MyProfileDto> => rawApiClient.get(`${BASE}/profile`),

  getLeaves: (p: SelfPageParams = {}): Promise<SelfPaged<LeaveRequestDto>> =>
    rawApiClient.get(`${BASE}/leaves?${pageQs(p, 25)}`),

  getLeaveBalances: (year?: number): Promise<LeaveBalanceLineDto[]> =>
    rawApiClient.get(`${BASE}/leave-balances${year ? `?year=${year}` : ""}`),

  applyForLeave: (payload: ApplyLeavePayload): Promise<LeaveRequestDto> =>
    rawApiClient.post(`${BASE}/leaves`, payload),

  cancelLeave: (leaveId: string): Promise<void> =>
    rawApiClient.post(`${BASE}/leaves/${leaveId}/cancel`, {}),

  getAttendance: (p: SelfPageParams & { fromDate?: string; toDate?: string } = {}): Promise<SelfPaged<AttendanceRecordDto>> => {
    const qs = new URLSearchParams(pageQs(p, 31));
    if (p.fromDate) qs.set("fromDate", p.fromDate);
    if (p.toDate)   qs.set("toDate", p.toDate);
    // Same boundary mapping the admin client uses — the backend field names differ from the UI's.
    return rawApiClient.get(`${BASE}/attendance?${qs}`)
      .then((r: any) => ({ ...r, items: (r.items ?? []).map(mapAttendance) }));
  },

  getAttendanceToday: (): Promise<MyAttendanceTodayDto> =>
    rawApiClient.get(`${BASE}/attendance/today`),

  checkIn:  (): Promise<MyAttendanceTodayDto> => rawApiClient.post(`${BASE}/attendance/check-in`, {}),
  checkOut: (): Promise<MyAttendanceTodayDto> => rawApiClient.post(`${BASE}/attendance/check-out`, {}),

  getPayslips: (p: SelfPageParams = {}): Promise<SelfPaged<EmployeePayslipDto>> =>
    rawApiClient.get(`${BASE}/payslips?${pageQs(p, 24)}`),
};
