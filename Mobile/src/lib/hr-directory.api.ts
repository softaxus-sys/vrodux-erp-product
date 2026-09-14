import { apiClient } from "@/lib/api-client";
import type { ContractType, DepartmentDto, EmployeeDto, HrSummaryDto } from "@/types/hr-directory";

const BASE = "/api/hr";

/** Employee-directory permission (distinct from `hr.self.*`, which gates one's own record --
 *  see lib/hr.api.ts). No dedicated `hr.departments.*` key exists on the backend; department
 *  writes reuse these same three (confirmed in DepartmentsController.cs). */
export const HR_EMPLOYEES_VIEW = "hr.employees.view";
export const HR_EMPLOYEES_CREATE = "hr.employees.create";
export const HR_EMPLOYEES_EDIT = "hr.employees.edit";

const CONTRACT_TYPE_MAP: Record<string, ContractType> = {
  "Full-Time": "full_time", full_time: "full_time",
  "Part-Time": "part_time", part_time: "part_time",
  Contract: "contract", contract: "contract",
  Internship: "intern", intern: "intern",
};

function splitName(fullName?: string): { first: string; last: string } {
  const parts = (fullName ?? "").trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

/**
 * `/employees/all` and `/employees/{id}` return raw backend field names (employeeNumber,
 * departmentName, jobTitle, joiningDate, employmentType, ...), not this app's EmployeeDto shape --
 * the normalization happens client-side, same as the web app's own mapEmployee(). Date fields fall
 * back to `undefined`, never `""` (an empty string reaching `new Date("")` is `Invalid Date`).
 */
function mapEmployee(raw: any): EmployeeDto {
  const employmentType: string = raw.employmentType ?? raw.contractType ?? "Full-Time";
  const names = splitName(raw.fullName);
  return {
    id: raw.id,
    employeeId: raw.employeeNumber ?? raw.employeeId ?? "",
    firstName: raw.firstName ?? names.first,
    lastName: raw.lastName ?? names.last,
    fullName: raw.fullName ?? `${raw.firstName ?? ""} ${raw.lastName ?? ""}`.trim(),
    avatar: raw.avatarData ?? raw.avatar ?? undefined,
    email: raw.email ?? "",
    phone: raw.phone ?? "",
    mobile: raw.mobile ?? raw.phone ?? "",
    gender: raw.gender ?? "male",
    nationality: raw.nationality ?? "",
    dateOfBirth: raw.dateOfBirth ?? undefined,
    department: raw.departmentName ?? raw.department ?? "",
    designation: raw.jobTitle ?? raw.designation ?? "",
    reportingTo: raw.reportingTo ?? "",
    branch: raw.branch ?? "",
    contractType: CONTRACT_TYPE_MAP[employmentType] ?? "full_time",
    status: raw.status ?? "active",
    joinDate: raw.joiningDate ?? raw.joinDate ?? undefined,
    endDate: raw.terminationDate ?? raw.endDate ?? undefined,
    basicSalary: raw.basicSalary ?? 0,
    currency: raw.currency ?? "AED",
    bankAccount: raw.bankAccount ?? undefined,
    iban: raw.iban ?? undefined,
    emiratesId: raw.emiratesId ?? undefined,
    passportNumber: raw.passportNumber ?? "",
    visaExpiry: raw.visaExpiry ?? undefined,
    medicalInsurance: raw.medicalInsurance ?? undefined,
    labourCardNumber: raw.labourCardNumber ?? undefined,
    bankRoutingCode: raw.bankRoutingCode ?? undefined,
    userId: raw.userId ?? undefined,
    linkedAccount: raw.linkedAccount ?? undefined,
    annualLeaveBalance: raw.annualLeaveBalance ?? 0,
    sickLeaveBalance: raw.sickLeaveBalance ?? 0,
    skills: raw.skills ?? [],
    address: raw.address ?? "",
    emergencyContact: raw.emergencyContact ?? undefined,
    documents: raw.documents ?? [],
  };
}

function mapDepartment(raw: any): DepartmentDto {
  return {
    id: raw.id,
    name: raw.name ?? "",
    code: raw.code ?? undefined,
    description: raw.description ?? undefined,
    managerId: raw.managerId ?? undefined,
    isActive: raw.isActive ?? true,
    employeeCount: raw.employeeCount ?? 0,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt ?? undefined,
  };
}

export const hrDirectoryApi = {
  /**
   * The full roster in one call, client-filtered -- mirrors the web app exactly (it never calls
   * the paginated `/employees` endpoint either; `/employees/all` is the only list route wired
   * up). A sparse response is expected here: the backend intentionally withholds most fields
   * (and always withholds `basicSalary`) unless the caller holds `hr.employees.view` or a payroll
   * permission -- callers with only e.g. `hr.leaves.create` still get the roster for a dropdown,
   * just without the fields this directory screen wants to show.
   */
  getEmployees: (includeInactive = false): Promise<EmployeeDto[]> =>
    apiClient
      .get<any>(`${BASE}/employees/all${includeInactive ? "?includeInactive=true" : ""}`)
      .then((r) => (Array.isArray(r) ? r : (r?.items ?? [])).map(mapEmployee)),

  getEmployeeById: (id: string): Promise<EmployeeDto> =>
    apiClient.get<any>(`${BASE}/employees/${id}`).then(mapEmployee),

  getSummary: (): Promise<HrSummaryDto> => apiClient.get(`${BASE}/employees/summary`),

  getDepartments: (): Promise<DepartmentDto[]> =>
    apiClient
      .get<any>(`${BASE}/departments`)
      .then((r) => (Array.isArray(r) ? r : (r?.items ?? [])).map(mapDepartment)),
};
