import { apiClient } from "@/lib/api-client";
import type {
  RenewalItemDto,
  VisaCaseDetailDto,
  VisaCaseSummaryDto,
  VisaCasesSummaryDto,
  VisaDashboardDto,
} from "@/types/visa";

const BASE = "/api/visa";

// Only one permission group exists on the backend (`visa.cases.*`) -- create/delete are left
// unused here since case creation (visa type + fee prefill + a dynamic applicant list) is
// desktop-appropriate, same call as Sales/Purchase order creation.
export const VISA_CASES_VIEW = "visa.cases.view";
export const VISA_CASES_EDIT = "visa.cases.edit";

export interface ChangeCaseStatusBody {
  status: string;
  govtReference?: string | null;
  rejectionReason?: string | null;
  visaExpiryDate?: string | null;
  note?: string | null;
  byName?: string;
}

export interface UpdateCaseDocumentBody {
  status: string;
  fileUrl?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  byName?: string;
}

export const visaApi = {
  getDashboard: (): Promise<VisaDashboardDto> => apiClient.get(`${BASE}/cases/dashboard`),
  getRenewals: (withinDays = 90): Promise<RenewalItemDto[]> => apiClient.get(`${BASE}/cases/renewals?withinDays=${withinDays}`),
  getSummary: (): Promise<VisaCasesSummaryDto> => apiClient.get(`${BASE}/cases/summary`),
  getCases: (status?: string): Promise<VisaCaseSummaryDto[]> =>
    apiClient.get(`${BASE}/cases${status && status !== "all" ? `?status=${status}` : ""}`),
  getCase: (id: string): Promise<VisaCaseDetailDto> => apiClient.get(`${BASE}/cases/${id}`),
  changeStatus: (id: string, body: ChangeCaseStatusBody): Promise<void> => apiClient.patch(`${BASE}/cases/${id}/status`, body),
  assign: (id: string, assignedTo: string, byName?: string): Promise<void> =>
    apiClient.patch(`${BASE}/cases/${id}/assign`, { assignedTo, byName }),
  updateDocument: (caseId: string, documentId: string, body: UpdateCaseDocumentBody): Promise<void> =>
    apiClient.put(`${BASE}/cases/${caseId}/documents/${documentId}`, body),
  addNote: (caseId: string, note: string, byName?: string): Promise<void> => apiClient.post(`${BASE}/cases/${caseId}/notes`, { note, byName }),
};
