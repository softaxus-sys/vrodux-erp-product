/**
 * Employee directory + departments (`/api/hr/employees`, `/api/hr/departments`) -- distinct from
 * types/hr.ts's self-service shapes (`/api/hr/me/*`, subject resolved from the JWT). This is the
 * admin/manager-facing directory: every call takes an explicit employee id, gated on
 * `hr.employees.*` rather than `hr.self.*`.
 *
 * Mirrors FrontendVite/src/lib/hr/hr.api.ts's `mapEmployee()`-normalized `EmployeeDto` -- one
 * shape for both the list (`GET /employees/all`, sparse -- only ~6 fields populated) and the
 * detail call (`GET /employees/{id}`, full record). Missing list fields read as `undefined`, not
 * `""`, so `formatDate`/similar null-safe helpers never see an empty string as if it were real
 * data (same rule CLAUDE.md documents for the web mapper).
 */
export type EmployeeStatus = "active" | "inactive" | "on_leave" | "probation" | "terminated" | "suspended";
export type ContractType = "full_time" | "part_time" | "contract" | "intern";

export interface EmergencyContact {
  name?: string;
  relation?: string;
  phone?: string;
}

export interface EmployeeDocument {
  name: string;
  type: string;
  expiry?: string;
  status: "valid" | "expiring" | "expired";
}

export interface LinkedAccountDto {
  userId: string;
  email: string;
  username: string;
  fullName: string;
  status: string;
  emailVerified: boolean;
  lastLoginAt?: string | null;
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
  gender: "male" | "female";
  nationality: string;
  dateOfBirth?: string;
  department: string;
  designation: string;
  reportingTo: string;
  branch: string;
  contractType: ContractType;
  status: EmployeeStatus;
  joinDate?: string;
  endDate?: string;
  basicSalary: number;
  currency: string;
  bankAccount?: string;
  iban?: string;
  emiratesId?: string;
  passportNumber: string;
  visaExpiry?: string;
  medicalInsurance?: string;
  labourCardNumber?: string;
  bankRoutingCode?: string;
  userId?: string;
  linkedAccount?: LinkedAccountDto;
  annualLeaveBalance: number;
  sickLeaveBalance: number;
  skills: string[];
  address: string;
  emergencyContact?: EmergencyContact;
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

/** Full backend shape (`GET /api/hr/departments`) -- richer than the web app's own stripped-down
 *  dropdown DTO, and worth showing in full on a dedicated mobile screen (employeeCount especially). */
export interface DepartmentDto {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  managerId?: string | null;
  isActive: boolean;
  employeeCount: number;
  createdAt: string;
  updatedAt?: string | null;
}

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  on_leave: "On leave",
  probation: "Probation",
  terminated: "Terminated",
  suspended: "Suspended",
};

/** Badge tone per status -- consumed by <Badge tone={...}>. */
export const EMPLOYEE_STATUS_TONE: Record<EmployeeStatus, "success" | "warning" | "destructive" | "info" | "neutral"> = {
  active: "success",
  inactive: "neutral",
  on_leave: "info",
  probation: "warning",
  terminated: "destructive",
  suspended: "destructive",
};

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  intern: "Intern",
};
