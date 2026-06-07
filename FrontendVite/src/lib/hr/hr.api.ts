import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/hr`;

// ─── Constants ────────────────────────────────────────────────────────────────

export const DEPARTMENTS = [
  "All Departments",
  "Technology",
  "Finance",
  "Human Resources",
  "Sales & Marketing",
  "Operations",
  "Real Estate",
  "Construction",
  "Legal",
  "Administration",
];

// ─── Employees ────────────────────────────────────────────────────────────────

export type EmployeeStatus = "active" | "inactive" | "on_leave" | "probation" | "terminated" | "suspended";
export type Gender       = "male" | "female";
export type ContractType = "full_time" | "part_time" | "contract" | "intern";

export interface EmployeeDocument {
  name: string;
  type: string;
  expiry?: string;
  status: "valid" | "expiring" | "expired";
}

export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
}

export interface EmployeeDto {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatar?: string;
  email: string;
  phone: string;
  mobile: string;
  gender: Gender;
  nationality: string;
  dateOfBirth: string;
  department: string;
  designation: string;
  reportingTo: string;
  branch: string;
  contractType: ContractType;
  status: EmployeeStatus;
  joinDate: string;
  endDate?: string;
  basicSalary: number;
  currency: string;
  bankAccount?: string;
  iban?: string;
  emiratesId?: string;
  passportNumber: string;
  visaExpiry?: string;
  medicalInsurance?: string;
  annualLeaveBalance: number;
  sickLeaveBalance: number;
  skills: string[];
  address: string;
  emergencyContact: EmergencyContact;
  documents: EmployeeDocument[];
}

export interface HrSummaryDto {
  total: number;
  active: number;
  onLeave: number;
  probation: number;
  newThisMonth: number;
  expiringDocuments: number;
  departments: number;
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export type AttendanceStatus = "present" | "absent" | "late" | "half_day" | "half-day" | "on_leave" | "holiday" | "weekend" | "remote";

export interface AttendanceRecordDto {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  hoursWorked?: number;
  status: AttendanceStatus;
  note?: string;
}

export interface AttendanceSummaryDto {
  presentToday: number;
  lateToday: number;
  absentToday: number;
  onLeaveToday: number;
  avgHoursThisMonth: number;
  totalEmployees: number;
}

// ─── Leaves ───────────────────────────────────────────────────────────────────

export type LeaveType   = "annual" | "sick" | "unpaid" | "maternity" | "paternity" | "emergency" | "hajj";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface LeaveRequestDto {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
  approvedBy?: string;
  approvedOn?: string;
  rejectionReason?: string;
  coveringEmployee?: string;
}

export interface LeaveBalanceDto {
  employeeId: string;
  employeeName: string;
  department: string;
  annual: { entitled: number; taken: number; balance: number };
  sick: { entitled: number; taken: number; balance: number };
  unpaid: { entitled: number; taken: number; balance: number };
}

export interface LeaveSummaryDto {
  totalRequests: number;
  pending: number;
  approved: number;
  rejected: number;
  onLeaveToday: number;
  avgLeaveDays: number;
}

// ─── Payroll ──────────────────────────────────────────────────────────────────

export type PayrollStatus  = "draft" | "processing" | "processed" | "approved" | "paid" | "failed";
export type PayslipStatus  = "generated" | "sent" | "viewed";

export interface PayrollDeductionDto { label: string; amount: number; }
export interface PayrollAllowanceDto { label: string; amount: number; }

export interface PayslipDto {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  department: string;
  designation: string;
  payPeriod: string;
  basicSalary: number;
  allowances: PayrollAllowanceDto[];
  deductions: PayrollDeductionDto[];
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  currency: string;
  bank: string;
  iban: string;
  status: PayslipStatus;
  paidOn?: string;
}

// Matches actual backend response shape
export interface PayrollRunDto {
  id: string;
  runNumber: string;
  period: string;           // e.g. "2026-05"
  totalBasicSalary: number;
  totalAllowances: number;
  totalDeductions: number;
  totalNetSalary: number;
  status: PayrollStatus;
  notes?: string;
  slipCount: number;
  processedAt?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
  payslips?: PayslipDto[];  // only populated via detail endpoint, not list
}

export interface PayrollSummaryDto {
  currentMonth: string;
  totalEmployees: number;
  totalNetPayroll: number;
  totalGrossPayroll: number;
  totalDeductions: number;
  status: PayrollStatus;
  paidRuns: number;
  pendingRuns: number;
  ytdTotal: number;
}

// ─── Performance ──────────────────────────────────────────────────────────────

export type ReviewStatus = "pending" | "in_progress" | "completed" | "overdue";
export type Rating = 1 | 2 | 3 | 4 | 5;

export interface PerformanceGoalDto {
  id: string;
  title: string;
  target: string;
  progress: number;
  status: "on_track" | "at_risk" | "achieved" | "missed";
  dueDate: string;
}

export interface PerformanceReviewDto {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  reviewPeriod: string;
  reviewType: "annual" | "mid_year" | "probation" | "pip";
  status: ReviewStatus;
  overallRating?: Rating;
  technicalRating?: Rating;
  communicationRating?: Rating;
  teamworkRating?: Rating;
  leadershipRating?: Rating;
  reviewedBy: string;
  dueDate: string;
  completedDate?: string;
  strengths?: string;
  improvements?: string;
  goals: PerformanceGoalDto[];
}

export interface PerformanceSummaryDto {
  totalReviews: number;
  completed: number;
  pending: number;
  inProgress: number;
  overdue: number;
  avgRating: number;
}

// ─── Recruitment ──────────────────────────────────────────────────────────────

export type JobStatus       = "open" | "closed" | "on_hold" | "draft";
export type ApplicantStage  = "applied" | "screening" | "interview" | "offer" | "hired" | "rejected";
export type ExperienceLevel = "junior" | "mid" | "senior" | "lead" | "executive";

export interface JobPostingDto {
  id: string;
  title: string;
  department: string;
  branch: string;
  type: "full_time" | "part_time" | "contract";
  experienceLevel: ExperienceLevel;
  salaryMin: number;
  salaryMax: number;
  currency: string;
  status: JobStatus;
  postedDate: string;
  closingDate: string;
  applicants: number;
  description: string;
  requirements: string[];
  hiringManager: string;
}

export interface ApplicantDto {
  id: string;
  jobId: string;
  jobTitle: string;
  name: string;
  email: string;
  phone: string;
  nationality: string;
  currentRole: string;
  currentCompany: string;
  experience: number;
  stage: ApplicantStage;
  appliedDate: string;
  rating?: number;
  notes?: string;
  source: string;
}

export interface RecruitmentSummaryDto {
  openPositions: number;
  totalApplicants: number;
  inInterview: number;
  offers: number;
  hiredThisMonth: number;
  avgTimeToHire: number;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const hrApi = {
  // Employees
  getEmployees:    (): Promise<EmployeeDto[]>     => rawApiClient.get(`${BASE}/employees/all`),
  getHrSummary:    (): Promise<HrSummaryDto>      => rawApiClient.get(`${BASE}/employees/summary`),

  // Attendance
  getAttendance:        (): Promise<AttendanceRecordDto[]>   => rawApiClient.get(`${BASE}/attendance?pageSize=500`).then((r: any) => r.items ?? r),
  getAttendanceSummary: (): Promise<AttendanceSummaryDto>    => rawApiClient.get(`${BASE}/attendance/summary`),

  // Leaves
  getLeaveRequests: (): Promise<LeaveRequestDto[]>  => rawApiClient.get(`${BASE}/leaves?pageSize=500`).then((r: any) => r.items ?? r),
  getLeaveBalances: (): Promise<LeaveBalanceDto[]>  => rawApiClient.get(`${BASE}/leaves/balances?pageSize=500`).then((r: any) => r.items ?? r),
  getLeaveSummary:  (): Promise<LeaveSummaryDto>    => rawApiClient.get(`${BASE}/leaves/summary`),

  // Payroll
  getPayrollRuns:    (): Promise<PayrollRunDto[]>    => rawApiClient.get(`${BASE}/payroll?pageSize=500`).then((r: any) => r.items ?? r),
  getPayrollSummary: (): Promise<PayrollSummaryDto>  => rawApiClient.get(`${BASE}/payroll/summary`),

  // Performance
  getPerformanceReviews: (): Promise<PerformanceReviewDto[]>  => rawApiClient.get(`${BASE}/performance?pageSize=500`).then((r: any) => r.items ?? r),
  getPerformanceSummary: (): Promise<PerformanceSummaryDto>   => rawApiClient.get(`${BASE}/performance/summary`),

  // Recruitment
  getJobPostings:        (): Promise<JobPostingDto[]>         => rawApiClient.get(`${BASE}/recruitment/jobs?pageSize=500`).then((r: any) => r.items ?? r),
  getApplicants:         (): Promise<ApplicantDto[]>          => rawApiClient.get(`${BASE}/recruitment/applicants?pageSize=500`).then((r: any) => r.items ?? r),
  getRecruitmentSummary: (): Promise<RecruitmentSummaryDto>   => rawApiClient.get(`${BASE}/recruitment/summary`),
};
