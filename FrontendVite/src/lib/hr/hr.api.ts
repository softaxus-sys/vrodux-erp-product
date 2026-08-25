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

/** Unified DTO — populated from backend, rich fields optional for future extension */
export interface EmployeeDto {
  id: string;
  employeeId: string;        // maps from backend employeeNumber
  firstName: string;
  lastName: string;
  fullName: string;
  avatar?: string;
  email: string;
  phone: string;
  mobile: string;
  gender: Gender;
  nationality: string;
  dateOfBirth?: string;
  department: string;        // maps from backend departmentName
  designation: string;       // maps from backend jobTitle
  reportingTo: string;
  branch: string;
  contractType: ContractType; // maps from backend employmentType
  status: EmployeeStatus;
  joinDate?: string;         // maps from backend joiningDate
  endDate?: string;
  basicSalary: number;
  currency: string;
  bankAccount?: string;
  iban?: string;
  emiratesId?: string;
  passportNumber: string;
  visaExpiry?: string;
  medicalInsurance?: string;
  /** MOHRE Person ID and the agent bank routing code — both required by a WPS salary file. */
  labourCardNumber?: string;
  bankRoutingCode?: string;
  /** Identity login linked to this employee, if any. */
  userId?: string;
  linkedAccount?: LinkedAccountDto;
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

/** NOTE: "half-day" removed — use "half_day" consistently */
export type AttendanceStatus = "present" | "absent" | "late" | "half_day" | "on_leave" | "holiday" | "weekend" | "remote";

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
  /** Minutes past the grace period at check-in; 0 = on time, undefined = not judged. */
  lateMinutes?: number;
}

/** The tenant's office hours — what "on time" means. */
export interface WorkScheduleDto {
  id: string;
  name: string;
  startTime: string;      // HH:mm, local to timeZoneId
  endTime: string;        // HH:mm
  graceMinutes: number;
  workingDays: number[];  // 0 = Sunday
  timeZoneId: string;
}

export type WorkSchedulePayload = Omit<WorkScheduleDto, "id">;

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

/** Unified DTO — populated from backend, legacy field names normalised */
export interface LeaveRequestDto {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  leaveType: LeaveType;
  fromDate?: string;   // maps from backend startDate
  toDate?: string;     // maps from backend endDate
  days: number;        // maps from backend totalDays
  reason: string;
  status: LeaveStatus;
  appliedOn?: string;  // maps from backend createdAt
  approvedBy?: string;
  approvedOn?: string;
  rejectionReason?: string;
  coveringEmployee?: string;
}

export interface LeavePolicyDto {
  id: string;
  leaveType: string;
  annualEntitlementDays: number;
  isPaid: boolean;
  description?: string | null;
  isActive: boolean;
}

/** One leave type's position for an employee — every figure is derived server-side. */
export interface LeaveBalanceLineDto {
  leaveType: string;
  entitlementDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  isPaid: boolean;
  year: number;
}

export interface LeaveBalanceDto {
  employeeId: string;
  employeeName: string;
  department?: string | null;
  balances: LeaveBalanceLineDto[];
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

export type PayrollStatus  = "draft" | "processing" | "processed" | "finance_approved" | "approved" | "paid" | "failed" | "rejected";
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

/** Employer identifiers a UAE WPS salary file must carry. Blank until HR fills them in. */
export interface WpsConfigDto {
  employerUniqueId: string;
  employerBankRoutingCode: string;
  fileSequence: number;
  isComplete: boolean;
}

export interface WpsIssueDto { employeeName: string; problem: string; }

export interface WpsSifFileDto {
  fileName: string;
  content: string;
  recordCount: number;
  totalSalary: number;
  /** Employees left out because their record is incomplete — each reason is in "issues". */
  excludedCount: number;
  issues: WpsIssueDto[];
}

// Matches actual backend response shape
export interface PayrollRunDto {
  id: string;
  runNumber: string;
  period: string;
  totalBasicSalary: number;
  totalAllowances: number;
  totalDeductions: number;
  totalNetSalary: number;
  status: PayrollStatus;
  notes?: string;
  createdByName?: string;
  rejectionReason?: string | null;
  rejectedByName?: string | null;
  /** Set once Finance has signed the run off; until then it cannot be paid. */
  financeApprovedByName?: string | null;
  financeApprovedAt?: string | null;
  /** The accounting entry the approval posted. */
  journalEntryId?: string | null;
  journalEntryNumber?: string | null;
  slipCount: number;
  processedAt?: string | null;
  paidAt?: string | null;
  rejectedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  payslips?: PayslipDto[];
}

/** Matches backend: { allTime: {...}, thisMonth: {...} | null } */
export interface PayrollSummaryDto {
  allTime: {
    draft: number;
    processed: number;
    paid: number;
    total: number;
  };
  thisMonth: {
    status: PayrollStatus;
    totalNetSalary: number;
    employeeCount: number;
  } | null;
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
  hasResume: boolean;
}

export interface RecruitmentSummaryDto {
  openPositions: number;
  totalApplicants: number;
  inInterview: number;
  offers: number;
  hiredThisMonth: number;
  avgTimeToHire: number;
}

// ─── Mutation Payloads ────────────────────────────────────────────────────────

/** Live state of the Identity login linked to an employee. HR stores none of this. */
export interface LinkedAccountDto {
  userId: string;
  email: string;
  username: string;
  fullName: string;
  status: string;
  emailVerified: boolean;
  lastLoginAt?: string | null;
}

/** A login that might be the same person — a suggestion for a human to confirm. */
export interface UserMatchDto {
  userId: string;
  email: string;
  username: string;
  fullName: string;
  status: string;
  /** Set when the login already belongs to another employee; then it cannot be linked. */
  alreadyLinkedToEmployeeName?: string | null;
  /**
   * The address has no login in this workspace but already has one elsewhere. A Vrodux login is
   * identified by email platform-wide, so it can neither be linked here nor created again.
   */
  registeredInAnotherWorkspace?: boolean;
}

export interface DepartmentOptionDto {
  id: string;
  name: string;
  code?: string;
}

export interface CreateEmployeePayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  departmentId?: string;
  departmentName?: string;
  employmentType: string;
  basicSalary: number;
  joiningDate: string;
  managerId?: string;
  notes?: string;
  /** Profile photo as a data URI. Omit to keep the existing one; set removeAvatar to clear it. */
  avatarData?: string;
  nationality?: string;
  emiratesId?: string;
  passportNumber?: string;
  visaExpiry?: string;
  reportingTo?: string;
  bankAccount?: string;
  iban?: string;
  medicalInsurance?: string;
  labourCardNumber?: string;
  bankRoutingCode?: string;
}

export interface UpdateEmployeePayload extends CreateEmployeePayload {
  status: string;
  /** Explicitly clear the stored photo — a missing avatarData means "leave it alone". */
  removeAvatar?: boolean;
}

export interface CreateLeavePayload {
  employeeId: string;
  employeeName: string;
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

export interface CreatePayrollRunPayload {
  period: string;
  notes?: string;
  slips: Array<{
    employeeId: string;
    employeeName: string;
    jobTitle?: string;
    departmentName?: string;
    basicSalary: number;
    allowances: number;
    deductions: number;
    notes?: string;
  }>;
}

export interface GeneratePayrollPayload {
  period: string;
  notes?: string;
}

export interface MarkAttendancePayload {
  employeeId: string;
  employeeName: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  workingHours?: number | null;
  status: string;
  notes?: string | null;
}

export interface UpdateAttendancePayload {
  checkIn?: string | null;
  checkOut?: string | null;
  workingHours?: number | null;
  status: string;
  notes?: string | null;
}

export interface CreateJobPostingPayload {
  title: string;
  department: string;
  branch: string;
  type: string;
  experienceLevel: string;
  headcount: number;
  salaryMin: number;
  salaryMax: number;
  currency: string;
  closingDate?: string;
  hiringManager?: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  status: "draft" | "open";
}

export interface CreateApplicantPayload {
  jobId: string;
  name: string;
  email: string;
  phone?: string;
  nationality?: string;
  currentRole?: string;
  currentCompany?: string;
  experience: number;
  source?: string;
  notes?: string;
}

export interface CreateReviewPayload {
  employeeId: string;
  reviewPeriod: string;
  reviewType: PerformanceReviewDto["reviewType"];
  dueDate: string;
  reviewedBy: string;
}

export interface CompleteReviewPayload {
  overallRating?: Rating;
  technicalRating?: Rating;
  communicationRating?: Rating;
  teamworkRating?: Rating;
  leadershipRating?: Rating;
  strengths?: string;
  improvements?: string;
}

export interface CreateGoalPayload {
  title: string;
  target: string;
  dueDate: string;
}

export interface UpdateGoalPayload {
  progress: number;
  status: PerformanceGoalDto["status"];
}

// ─── Response mapper helpers ──────────────────────────────────────────────────

/** Best-effort split for sources that only carry a combined name (e.g. the list endpoint). */
function splitName(fullName?: string): { first: string; last: string } {
  const parts = (fullName ?? "").trim().split(/s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/**
 * Backend AttendanceLogDto -> UI AttendanceRecordDto. The names genuinely differ
 * (workingHours/notes vs hoursWorked/note), so without this the Hours column and the CSV/PDF
 * export were permanently blank — the data was in the response under another name.
 */
export function mapAttendance(raw: any): AttendanceRecordDto {
  return {
    id:           raw.id,
    employeeId:   raw.employeeId,
    employeeName: raw.employeeName ?? "",
    department:   raw.department ?? raw.departmentName ?? "",
    date:         raw.date ?? "",
    checkIn:      raw.checkIn  ?? undefined,
    checkOut:     raw.checkOut ?? undefined,
    hoursWorked:  raw.hoursWorked ?? raw.workingHours ?? undefined,
    status:       (raw.status as AttendanceStatus) ?? "present",
    note:         raw.note ?? raw.notes ?? undefined,
    lateMinutes:  raw.lateMinutes ?? undefined,
  };
}

/** Map raw backend employee to unified EmployeeDto */
function mapEmployee(raw: any): EmployeeDto {
  const employmentType: string = raw.employmentType ?? raw.contractType ?? "Full-Time";
  const contractTypeMap: Record<string, ContractType> = {
    "Full-Time": "full_time", "full_time": "full_time",
    "Part-Time": "part_time", "part_time": "part_time",
    "Contract":  "contract",  "contract":  "contract",
    "Internship":"intern",    "intern":    "intern",
  };
  return {
    id:                raw.id,
    employeeId:        raw.employeeNumber ?? raw.employeeId ?? "",
    firstName:         raw.firstName ?? splitName(raw.fullName).first,
    lastName:          raw.lastName  ?? splitName(raw.fullName).last,
    fullName:          raw.fullName  ?? `${raw.firstName ?? ""} ${raw.lastName ?? ""}`.trim(),
    avatar:            raw.avatarData ?? raw.avatar,
    email:             raw.email     ?? "",
    phone:             raw.phone     ?? "",
    mobile:            raw.mobile    ?? raw.phone ?? "",
    gender:            raw.gender    ?? "male",
    nationality:       raw.nationality ?? "",
    dateOfBirth:       raw.dateOfBirth ?? undefined,
    department:        raw.departmentName ?? raw.department ?? "",
    designation:       raw.jobTitle  ?? raw.designation ?? "",
    reportingTo:       raw.reportingTo ?? "",
    branch:            raw.branch    ?? "",
    contractType:      contractTypeMap[employmentType] ?? "full_time",
    status:            (raw.status as EmployeeStatus) ?? "active",
    joinDate:          raw.joiningDate ?? raw.joinDate ?? undefined,
    endDate:           raw.terminationDate ?? raw.endDate,
    basicSalary:       raw.basicSalary ?? 0,
    currency:          raw.currency  ?? "AED",
    bankAccount:       raw.bankAccount,
    iban:              raw.iban,
    emiratesId:        raw.emiratesId,
    passportNumber:    raw.passportNumber ?? "",
    visaExpiry:        raw.visaExpiry,
    medicalInsurance:  raw.medicalInsurance,
    labourCardNumber:  raw.labourCardNumber,
    bankRoutingCode:   raw.bankRoutingCode,
    annualLeaveBalance:raw.annualLeaveBalance ?? 0,
    sickLeaveBalance:  raw.sickLeaveBalance  ?? 0,
    skills:            raw.skills     ?? [],
    address:           raw.address    ?? "",
    emergencyContact:  raw.emergencyContact ?? { name: "", relation: "", phone: "" },
    documents:         raw.documents  ?? [],
    userId:            raw.userId ?? undefined,
    linkedAccount:     raw.linkedAccount ?? undefined,
  };
}

/** Map raw backend leave to unified LeaveRequestDto */
function mapLeave(raw: any): LeaveRequestDto {
  return {
    id:               raw.id,
    employeeId:       raw.employeeId  ?? "",
    employeeName:     raw.employeeName ?? "",
    department:       raw.department  ?? "",
    designation:      raw.designation ?? "",
    leaveType:        (raw.leaveType as LeaveType) ?? "annual",
    fromDate:         raw.fromDate    ?? raw.startDate  ?? undefined,
    toDate:           raw.toDate      ?? raw.endDate    ?? undefined,
    days:             raw.days        ?? raw.totalDays  ?? 0,
    reason:           raw.reason      ?? "",
    status:           (raw.status as LeaveStatus) ?? "pending",
    appliedOn:        raw.appliedOn   ?? raw.createdAt  ?? undefined,
    approvedBy:       raw.approvedBy,
    approvedOn:       raw.approvedOn  ?? raw.approvedAt,
    rejectionReason:  raw.rejectionReason ?? raw.approverNotes,
    coveringEmployee: raw.coveringEmployee,
  };
}

/** Map raw backend applicant to unified ApplicantDto */
function mapApplicant(raw: any): ApplicantDto {
  return {
    id:             raw.id,
    jobId:          raw.jobId ?? raw.jobPostingId ?? "",
    jobTitle:       raw.jobTitle ?? "",
    name:           raw.name ?? "",
    email:          raw.email ?? "",
    phone:          raw.phone ?? "",
    nationality:    raw.nationality ?? "",
    currentRole:    raw.currentRole ?? "",
    currentCompany: raw.currentCompany ?? "",
    experience:     raw.experience ?? raw.experienceYears ?? 0,
    stage:          (raw.stage as ApplicantStage) ?? "applied",
    appliedDate:    raw.appliedDate ?? undefined,
    rating:         raw.rating ?? undefined,
    notes:          raw.notes ?? undefined,
    source:         raw.source ?? "",
    hasResume:      raw.hasResume ?? false,
  };
}

/** Map raw backend review to unified PerformanceReviewDto */
function mapPerformanceReview(raw: any): PerformanceReviewDto {
  return {
    id:                  raw.id,
    employeeId:          raw.employeeId ?? "",
    employeeName:        raw.employeeName ?? "",
    department:          raw.department ?? "",
    designation:         raw.designation ?? "",
    reviewPeriod:        raw.reviewPeriod ?? "",
    reviewType:          (raw.reviewType as PerformanceReviewDto["reviewType"]) ?? "annual",
    status:              (raw.status as ReviewStatus) ?? "pending",
    overallRating:       raw.overallRating ?? undefined,
    technicalRating:     raw.technicalRating ?? undefined,
    communicationRating: raw.communicationRating ?? undefined,
    teamworkRating:      raw.teamworkRating ?? undefined,
    leadershipRating:    raw.leadershipRating ?? undefined,
    reviewedBy:          raw.reviewedBy ?? "",
    dueDate:             raw.dueDate ?? "",
    completedDate:       raw.completedDate ?? undefined,
    strengths:           raw.strengths ?? undefined,
    improvements:        raw.improvements ?? undefined,
    goals:               (raw.goals ?? []).map((g: any) => ({
      id:       g.id,
      title:    g.title ?? "",
      target:   g.target ?? "",
      progress: g.progress ?? 0,
      status:   g.status ?? "on_track",
      dueDate:  g.dueDate ?? "",
    })),
  };
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const hrApi = {
  // ── Employees ─────────────────────────────────────────────────────────────
  /** @param includeInactive the list page wants everyone; pickers want active staff only. */
  getEmployees: (includeInactive = false): Promise<EmployeeDto[]> =>
    rawApiClient.get(`${BASE}/employees/all${includeInactive ? "?includeInactive=true" : ""}`).then((r: any) =>
      (Array.isArray(r) ? r : r.items ?? []).map(mapEmployee)),

  /**
   * Full employee record. The list endpoint (/employees/all) returns a 6-field summary —
   * no email, phone, first/last name, join date or compliance fields — so any screen that
   * edits or details an employee must load the record by id, not reuse the list row.
   */
  getEmployeeById: (id: string): Promise<EmployeeDto> =>
    rawApiClient.get(`${BASE}/employees/${id}`).then(mapEmployee),

  /** Real departments (hr.departments). The forms used to offer a hardcoded list whose names
   *  did not match a single stored department, so an employee's department never pre-selected. */
  getDepartments: (): Promise<DepartmentOptionDto[]> =>
    rawApiClient.get(`${BASE}/departments`).then((r: any) =>
      (Array.isArray(r) ? r : r.items ?? [])
        .filter((d: any) => d.isActive !== false)
        .map((d: any) => ({ id: d.id, name: d.name ?? "", code: d.code ?? undefined }))),

  createDepartment: (payload: { name: string; code?: string }): Promise<DepartmentOptionDto> =>
    rawApiClient.post(`${BASE}/departments`, { ...payload, isActive: true })
      .then((d: any) => ({ id: d.id, name: d.name ?? payload.name, code: d.code ?? undefined })),

  /** Suggestion only — linking is a separate, explicit call. */
  findUserMatch: (email: string): Promise<UserMatchDto | null> =>
    rawApiClient.get(`${BASE}/employees/user-match?email=${encodeURIComponent(email)}`),

  linkEmployeeUser: (employeeId: string, userId: string): Promise<void> =>
    rawApiClient.post(`${BASE}/employees/${employeeId}/link-user`, { userId }),

  unlinkEmployeeUser: (employeeId: string): Promise<void> =>
    rawApiClient.delete(`${BASE}/employees/${employeeId}/link-user`),

  getHrSummary: (): Promise<HrSummaryDto> =>
    rawApiClient.get(`${BASE}/employees/summary`),

  createEmployee: (payload: CreateEmployeePayload): Promise<EmployeeDto> =>
    rawApiClient.post(`${BASE}/employees`, payload).then(mapEmployee),

  updateEmployee: (id: string, payload: UpdateEmployeePayload): Promise<void> =>
    rawApiClient.put(`${BASE}/employees/${id}`, payload),

  deleteEmployee: (id: string): Promise<void> =>
    rawApiClient.delete(`${BASE}/employees/${id}`),

  // ── Attendance ────────────────────────────────────────────────────────────
  getAttendance: (): Promise<AttendanceRecordDto[]> =>
    rawApiClient.get(`${BASE}/attendance?pageSize=500`)
      .then((r: any) => (Array.isArray(r) ? r : r.items ?? []).map(mapAttendance)),
 
  getAttendanceSummary: (): Promise<AttendanceSummaryDto> =>
    rawApiClient.get(`${BASE}/attendance/summary`),

  getWorkSchedule: (): Promise<WorkScheduleDto> =>
    rawApiClient.get(`${BASE}/attendance/schedule`),

  updateWorkSchedule: (payload: WorkSchedulePayload): Promise<WorkScheduleDto> =>
    rawApiClient.put(`${BASE}/attendance/schedule`, payload),

  markAttendance: (payload: MarkAttendancePayload): Promise<AttendanceRecordDto> =>
    rawApiClient.post(`${BASE}/attendance`, payload).then(mapAttendance),

  updateAttendance: (id: string, payload: UpdateAttendancePayload): Promise<void> =>
    rawApiClient.put(`${BASE}/attendance/${id}`, payload),

  deleteAttendance: (id: string): Promise<void> =>
    rawApiClient.delete(`${BASE}/attendance/${id}`),

  // ── Leaves ────────────────────────────────────────────────────────────────
  getLeaveRequests: (employeeId?: string): Promise<LeaveRequestDto[]> =>
    rawApiClient.get(`${BASE}/leaves?pageSize=500${employeeId ? `&employeeId=${employeeId}` : ""}`).then((r: any) =>
      (r.items ?? r ?? []).map(mapLeave)),

  getLeaveBalances: (year?: number): Promise<LeaveBalanceDto[]> =>
    rawApiClient.get(`${BASE}/leaves/balances${year ? `?year=${year}` : ""}`),

  getEmployeeLeaveBalances: (employeeId: string, year?: number): Promise<LeaveBalanceLineDto[]> =>
    rawApiClient.get(`${BASE}/leaves/balances/${employeeId}${year ? `?year=${year}` : ""}`),

  getLeavePolicies: (): Promise<LeavePolicyDto[]> =>
    rawApiClient.get(`${BASE}/leaves/policies`),

  createLeavePolicy: (payload: { leaveType: string; annualEntitlementDays: number; isPaid: boolean; description?: string }): Promise<LeavePolicyDto> =>
    rawApiClient.post(`${BASE}/leaves/policies`, payload),

  updateLeavePolicy: (id: string, payload: { annualEntitlementDays: number; isPaid: boolean; description?: string; isActive: boolean }): Promise<void> =>
    rawApiClient.put(`${BASE}/leaves/policies/${id}`, payload),

  deleteLeavePolicy: (id: string): Promise<void> =>
    rawApiClient.delete(`${BASE}/leaves/policies/${id}`),

  getLeaveSummary: (): Promise<LeaveSummaryDto> =>
    rawApiClient.get(`${BASE}/leaves/summary`),

  createLeave: (payload: CreateLeavePayload): Promise<LeaveRequestDto> =>
    rawApiClient.post(`${BASE}/leaves`, payload).then(mapLeave),

  deleteLeave: (id: string): Promise<void> =>
    rawApiClient.delete(`${BASE}/leaves/${id}`),

  approveLeave: (id: string): Promise<void> =>
    rawApiClient.post(`${BASE}/leaves/${id}/approve`, {}),

  rejectLeave: (id: string, reason?: string): Promise<void> =>
    rawApiClient.post(`${BASE}/leaves/${id}/reject`, { reason: reason ?? null }),

  // ── Payroll ───────────────────────────────────────────────────────────────
  getPayrollRuns: (): Promise<PayrollRunDto[]> =>
    rawApiClient.get(`${BASE}/payroll?pageSize=500`).then((r: any) => r.items ?? r),

  /**
   * The detail response names the collection `slips`; this client has always called it
   * `payslips`, so `run.payslips` was permanently undefined — which is why the WPS preview was
   * empty and the generated file reported 0 records. Normalised here, at the boundary.
   */
  getPayrollRunById: (id: string): Promise<PayrollRunDto> =>
    rawApiClient.get(`${BASE}/payroll/${id}`)
      .then((r: any) => ({ ...r, payslips: r.payslips ?? r.slips ?? [] })),

  /** Payslips issued to one employee — the API returns processed/paid runs only. */
  getEmployeePayslips: (employeeId: string): Promise<EmployeePayslipDto[]> =>
    rawApiClient.get(`${BASE}/payroll/employees/${employeeId}/slips`),

  getPayrollSummary: (): Promise<PayrollSummaryDto> =>
    rawApiClient.get(`${BASE}/payroll/summary`),

  createPayrollRun: (payload: CreatePayrollRunPayload): Promise<PayrollRunDto> =>
    rawApiClient.post(`${BASE}/payroll`, payload),

  generatePayrollRun: (payload: GeneratePayrollPayload): Promise<PayrollRunDto> =>
    rawApiClient.post(`${BASE}/payroll/generate`, payload),

  deletePayrollRun: (id: string): Promise<void> =>
    rawApiClient.delete(`${BASE}/payroll/${id}`),

  rejectPayrollRun: (id: string, reason?: string): Promise<void> =>
    rawApiClient.post(`${BASE}/payroll/${id}/reject`, { reason: reason ?? null }),

  reopenPayrollRun: (id: string): Promise<void> =>
    rawApiClient.post(`${BASE}/payroll/${id}/reopen`, {}),

  updatePayrollSlip: (runId: string, slipId: string, payload: { allowances: number; deductions: number; notes?: string }): Promise<void> =>
    rawApiClient.put(`${BASE}/payroll/${runId}/slips/${slipId}`, payload),

  processPayrollRun: (id: string): Promise<void> =>
    rawApiClient.post(`${BASE}/payroll/${id}/process`, {}),

  /** Finance signs the run off. Only after this can it be paid. */
  financeApprovePayrollRun: (id: string): Promise<void> =>
    rawApiClient.post(`${BASE}/payroll/${id}/finance-approve`, {}),

  /** Records the journal entry the approval posted, so payroll links to the ledger. */
  linkPayrollJournalEntry: (id: string, payload: { journalEntryId: string; journalEntryNumber?: string }): Promise<void> =>
    rawApiClient.patch(`${BASE}/payroll/${id}/journal-entry`, payload),

  payPayrollRun: (id: string): Promise<void> =>
    rawApiClient.post(`${BASE}/payroll/${id}/pay`, {}),
 
  // ── WPS (UAE Wage Protection System) ────────────────────────────────────
  getWpsConfig: (): Promise<WpsConfigDto> =>
    rawApiClient.get(`${BASE}/payroll/wps/config`),

  updateWpsConfig: (payload: { employerUniqueId: string; employerBankRoutingCode: string }): Promise<WpsConfigDto> =>
    rawApiClient.put(`${BASE}/payroll/wps/config`, payload),

  /** Built on the server: the employer identifiers never reach the browser. */
  getWpsSif: (runId: string): Promise<WpsSifFileDto> =>
    rawApiClient.get(`${BASE}/payroll/${runId}/wps-sif`),

  sendPayslipEmail: (runId: string, slipId: string): Promise<{ sentTo: string; sentAt: string }> =>
    rawApiClient.post(`${BASE}/payroll/${runId}/slips/${slipId}/send-email`, {}),

  // ── Performance ───────────────────────────────────────────────────────────
  getPerformanceReviews: (): Promise<PerformanceReviewDto[]> =>
    rawApiClient.get(`${BASE}/performance?pageSize=500`).then((r: any) => (r.items ?? r).map(mapPerformanceReview)),

  getPerformanceSummary: (): Promise<PerformanceSummaryDto> =>
    rawApiClient.get(`${BASE}/performance/summary`),

  createPerformanceReview: (payload: CreateReviewPayload): Promise<PerformanceReviewDto> =>
    rawApiClient.post(`${BASE}/performance`, payload).then(mapPerformanceReview),

  startPerformanceReview: (id: string): Promise<void> =>
    rawApiClient.post(`${BASE}/performance/${id}/start`, {}),

  completePerformanceReview: (id: string, payload: CompleteReviewPayload): Promise<PerformanceReviewDto> =>
    rawApiClient.post(`${BASE}/performance/${id}/complete`, payload).then(mapPerformanceReview),

  deletePerformanceReview: (id: string): Promise<void> =>
    rawApiClient.delete(`${BASE}/performance/${id}`),

  addPerformanceGoal: (id: string, payload: CreateGoalPayload): Promise<PerformanceReviewDto> =>
    rawApiClient.post(`${BASE}/performance/${id}/goals`, payload).then(mapPerformanceReview),

  updatePerformanceGoal: (id: string, goalId: string, payload: UpdateGoalPayload): Promise<void> =>
    rawApiClient.put(`${BASE}/performance/${id}/goals/${goalId}`, payload),

  deletePerformanceGoal: (id: string, goalId: string): Promise<void> =>
    rawApiClient.delete(`${BASE}/performance/${id}/goals/${goalId}`),

  // ── Recruitment ───────────────────────────────────────────────────────────
  getJobPostings: (): Promise<JobPostingDto[]> =>
    rawApiClient.get(`${BASE}/recruitment/jobs?pageSize=500`).then((r: any) => r.items ?? r),

  getApplicants: (): Promise<ApplicantDto[]> =>
    rawApiClient.get(`${BASE}/recruitment/applicants?pageSize=500`).then((r: any) => (r.items ?? r).map(mapApplicant)),

  getRecruitmentSummary: (): Promise<RecruitmentSummaryDto> =>
    rawApiClient.get(`${BASE}/recruitment/summary`),

  createJobPosting: (payload: CreateJobPostingPayload): Promise<JobPostingDto> =>
    rawApiClient.post(`${BASE}/recruitment/jobs`, payload),

  deleteJobPosting: (id: string): Promise<void> =>
    rawApiClient.delete(`${BASE}/recruitment/jobs/${id}`),

  updateJobStatus: (id: string, status: string): Promise<void> =>
    rawApiClient.post(`${BASE}/recruitment/jobs/${id}/status`, { status }),

  createApplicant: (payload: CreateApplicantPayload): Promise<ApplicantDto> =>
    rawApiClient.post(`${BASE}/recruitment/applicants`, payload).then(mapApplicant),

  updateApplicantStage: (id: string, stage: ApplicantStage): Promise<void> =>
    rawApiClient.put(`${BASE}/recruitment/applicants/${id}/stage`, { stage }),

  deleteApplicant: (id: string): Promise<void> =>
    rawApiClient.delete(`${BASE}/recruitment/applicants/${id}`),

  getApplicantResumeUrl: (id: string): string =>
    `${BASE}/recruitment/applicants/${id}/resume`,
};
