/**
 * Trimmed mirror of FrontendVite/src/lib/hr/self.api.ts's DTOs -- self-service only
 * (api/hr/me/*). The backend resolves the subject from the JWT on every one of these
 * routes, so there is no employee-id param anywhere in this file by construction.
 */
export type LeaveType = "annual" | "sick" | "unpaid" | "maternity" | "paternity" | "emergency" | "hajj";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
export type AttendanceStatus =
  | "present"
  | "absent"
  | "late"
  | "half_day"
  | "on_leave"
  | "holiday"
  | "weekend"
  | "remote";

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

export interface AttendanceRecordDto {
  id: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  hoursWorked?: number;
  status: AttendanceStatus;
  note?: string;
  lateMinutes?: number;
}

export interface LeaveRequestDto {
  id: string;
  leaveType: LeaveType;
  fromDate?: string;
  toDate?: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedOn?: string;
  rejectionReason?: string;
}

export interface LeaveBalanceLineDto {
  leaveType: string;
  entitlementDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  isPaid: boolean;
  year: number;
}

export interface ApplyLeavePayload {
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string;
}

export interface EmployeePayslipDto {
  runId: string;
  slipId: string;
  runNumber: string;
  period: string;
  runStatus: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  processedAt?: string | null;
  paidAt?: string | null;
}

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

/** Raised when the signed-in user has no employee record linked -- a normal state, not a fault. */
export const NOT_LINKED_ERROR_CODE = "Employee.NotLinked";

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annual: "Annual",
  sick: "Sick",
  unpaid: "Unpaid",
  maternity: "Maternity",
  paternity: "Paternity",
  emergency: "Emergency",
  hajj: "Hajj",
};

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

/** Badge tone per status -- consumed by <Badge tone={...}>. Co-located with the labels above. */
export const LEAVE_STATUS_TONE: Record<LeaveStatus, "success" | "warning" | "destructive" | "neutral"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  cancelled: "neutral",
};

export const ATTENDANCE_STATUS_TONE: Record<AttendanceStatus, "success" | "warning" | "destructive" | "info" | "neutral"> = {
  present: "success",
  absent: "destructive",
  late: "warning",
  half_day: "warning",
  on_leave: "info",
  holiday: "neutral",
  weekend: "neutral",
  remote: "info",
};
