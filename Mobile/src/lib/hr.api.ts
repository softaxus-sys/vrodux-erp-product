import { apiClient } from "@/lib/api-client";
import type {
  ApplyLeavePayload,
  AttendanceRecordDto,
  EmployeePayslipDto,
  LeaveBalanceLineDto,
  LeaveRequestDto,
  MyAttendanceTodayDto,
  MyProfileDto,
  SelfPageParams,
  SelfPaged,
} from "@/types/hr";

const BASE = "/api/hr/me";

/** Individual `hr.self.*` permission keys -- each self-service action is gated separately
 *  (profile/attendance/leave/payslip), unlike CRM's tiered view/edit pattern. */
export const HR_SELF_VIEW = "hr.self.view";
export const HR_SELF_ATTENDANCE = "hr.self.attendance";
export const HR_SELF_LEAVE = "hr.self.leave-request";
export const HR_SELF_PAYSLIP = "hr.self.payslip";

function pageQs(p: SelfPageParams, defaultSize: number): string {
  const qs = new URLSearchParams();
  qs.set("page", String(p.page ?? 1));
  qs.set("pageSize", String(p.pageSize ?? defaultSize));
  return qs.toString();
}

export const hrSelfApi = {
  getProfile: (): Promise<MyProfileDto> => apiClient.get(`${BASE}/profile`),

  getAttendanceToday: (): Promise<MyAttendanceTodayDto> => apiClient.get(`${BASE}/attendance/today`),

  getAttendance: (p: SelfPageParams & { fromDate?: string; toDate?: string } = {}): Promise<SelfPaged<AttendanceRecordDto>> => {
    const qs = new URLSearchParams(pageQs(p, 31));
    if (p.fromDate) qs.set("fromDate", p.fromDate);
    if (p.toDate) qs.set("toDate", p.toDate);
    return apiClient.get(`${BASE}/attendance?${qs}`);
  },

  checkIn: (): Promise<MyAttendanceTodayDto> => apiClient.post(`${BASE}/attendance/check-in`, {}),
  checkOut: (): Promise<MyAttendanceTodayDto> => apiClient.post(`${BASE}/attendance/check-out`, {}),

  getLeaves: (p: SelfPageParams = {}): Promise<SelfPaged<LeaveRequestDto>> =>
    apiClient.get(`${BASE}/leaves?${pageQs(p, 25)}`),

  getLeaveBalances: (year?: number): Promise<LeaveBalanceLineDto[]> =>
    apiClient.get(`${BASE}/leave-balances${year ? `?year=${year}` : ""}`),

  applyForLeave: (payload: ApplyLeavePayload): Promise<LeaveRequestDto> =>
    apiClient.post(`${BASE}/leaves`, payload),

  cancelLeave: (leaveId: string): Promise<void> => apiClient.post(`${BASE}/leaves/${leaveId}/cancel`, {}),

  getPayslips: (p: SelfPageParams = {}): Promise<SelfPaged<EmployeePayslipDto>> =>
    apiClient.get(`${BASE}/payslips?${pageQs(p, 24)}`),
};
