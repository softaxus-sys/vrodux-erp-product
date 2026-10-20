import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";

const BASE = `${getApiBaseUrl()}/api/finance/tax/uae`;

export const EMIRATES = [
  { code: "AUH", name: "Abu Dhabi" }, { code: "DXB", name: "Dubai" }, { code: "SHJ", name: "Sharjah" },
  { code: "AJM", name: "Ajman" }, { code: "UAQ", name: "Umm Al Quwain" }, { code: "RAK", name: "Ras Al Khaimah" },
  { code: "FUJ", name: "Fujairah" },
] as const;

export interface UaeVatProfileDto {
  configured: boolean;
  trn: string; nameEn: string; nameAr?: string | null; address?: string | null; defaultEmirate: string;
  taxAgencyName?: string | null; tan?: string | null; taxAgentName?: string | null; taan?: string | null;
}
export type UpsertUaeVatProfileRequest = Omit<UaeVatProfileDto, "configured">;

export interface UaeVatIntegrationDto { environment: "sandbox" | "production"; submissionAvailable: boolean; unavailableReason?: string | null }

export type VatReturnStatus =
  | "draft" | "validated" | "reconciled" | "approved" | "ready_to_submit"
  | "submitted" | "acknowledged" | "rejected" | "filed_via_portal";

export interface VatBox { box: string; label: string; amount: number; vat: number; adjustment: number }
export interface VatReturnIssue { severity: "error" | "warning" | "info"; code: string; message: string; reference?: string | null }
export interface VatReconciliation { returnNetVat: number; ledgerNetVat: number; glNetVat: number | null; difference: number; reconciled: boolean; basis: string }
export interface VatReturnAttemptDto {
  id: string; attemptNumber: number; environment: string; outcome: string; httpStatus?: number | null;
  externalReference?: string | null; message?: string | null; startedByName?: string | null; startedAt: string; completedAt?: string | null;
}
export interface VatReturnDto {
  id: string; taxPeriodId: string; periodLabel: string; fromDate: string; toDate: string; status: VatReturnStatus;
  trn: string; outputVat: number; inputVat: number; netVat: number;
  boxes: VatBox[]; issues: VatReturnIssue[]; reconciliation: VatReconciliation | null;
  hasBlockingErrors: boolean; isReconciled: boolean;
  preparedByName?: string | null; preparedAt?: string | null; approvedByName?: string | null; approvedAt?: string | null;
  environment?: string | null; submissionReference?: string | null; submittedAt?: string | null; acknowledgedAt?: string | null;
  rejectionReason?: string | null; filedByName?: string | null; contentHash?: string | null; hasFiles: boolean;
  attempts: VatReturnAttemptDto[];
}

export const uaeVatApi = {
  getProfile:     (): Promise<UaeVatProfileDto> => rawApiClient.get(`${BASE}/profile`),
  saveProfile:    (p: UpsertUaeVatProfileRequest): Promise<UaeVatProfileDto> => rawApiClient.put(`${BASE}/profile`, p),
  getIntegration: (): Promise<UaeVatIntegrationDto> => rawApiClient.get(`${BASE}/integration`),
  getReturns:     (taxPeriodId?: string): Promise<VatReturnDto[]> =>
    rawApiClient.get(`${BASE}/returns${taxPeriodId ? `?taxPeriodId=${taxPeriodId}` : ""}`),
  prepare:        (taxPeriodId: string): Promise<VatReturnDto> => rawApiClient.post(`${BASE}/periods/${taxPeriodId}/prepare`),
  approve:        (id: string): Promise<VatReturnDto> => rawApiClient.post(`${BASE}/returns/${id}/approve`),
  markReady:      (id: string): Promise<VatReturnDto> => rawApiClient.post(`${BASE}/returns/${id}/ready`),
  submit:         (id: string): Promise<VatReturnDto> => rawApiClient.post(`${BASE}/returns/${id}/submit`),
  recordPortalFiling: (id: string, reference: string): Promise<VatReturnDto> =>
    rawApiClient.post(`${BASE}/returns/${id}/portal-filing`, { reference }),
  download: async (id: string, kind: "faf" | "xml" | "attempts", fallbackName: string) => {
    const { blob, fileName } = await rawApiClient.getBlob(`${BASE}/returns/${id}/files/${kind}`);
    // Saved byte-for-byte (no BOM): the FAF and its content hash must match what the server froze.
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fileName ?? fallbackName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
