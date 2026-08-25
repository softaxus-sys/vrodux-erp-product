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

export const selfApi = {
  getProfile: (): Promise<MyProfileDto> => rawApiClient.get(`${BASE}/profile`),

  getLeaves: (): Promise<LeaveRequestDto[]> => rawApiClient.get(`${BASE}/leaves`),

  getLeaveBalances: (year?: number): Promise<LeaveBalanceLineDto[]> =>
    rawApiClient.get(`${BASE}/leave-balances${year ? `?year=${year}` : ""}`),

  applyForLeave: (payload: ApplyLeavePayload): Promise<LeaveRequestDto> =>
    rawApiClient.post(`${BASE}/leaves`, payload),

  cancelLeave: (leaveId: string): Promise<void> =>
    rawApiClient.post(`${BASE}/leaves/${leaveId}/cancel`, {}),

  getAttendance: (fromDate?: string, toDate?: string): Promise<AttendanceRecordDto[]> => {
    const qs = new URLSearchParams();
    if (fromDate) qs.set("fromDate", fromDate);
    if (toDate)   qs.set("toDate", toDate);
    const q = qs.toString();
    // Same boundary mapping the admin client uses — the backend field names differ from the UI's.
    return rawApiClient.get(`${BASE}/attendance${q ? `?${q}` : ""}`)
      .then((r: any) => (Array.isArray(r) ? r : []).map(mapAttendance));
  },

  getAttendanceToday: (): Promise<MyAttendanceTodayDto> =>
    rawApiClient.get(`${BASE}/attendance/today`),

  checkIn:  (): Promise<MyAttendanceTodayDto> => rawApiClient.post(`${BASE}/attendance/check-in`, {}),
  checkOut: (): Promise<MyAttendanceTodayDto> => rawApiClient.post(`${BASE}/attendance/check-out`, {}),

  getPayslips: (): Promise<EmployeePayslipDto[]> => rawApiClient.get(`${BASE}/payslips`),
};
