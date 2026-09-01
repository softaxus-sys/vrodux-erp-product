import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/insurance`;

export interface PolicyDto {
  id: string; policyNumber: string; leadId?: string | null; dealId?: string | null; customerId?: string | null;
  holderName: string; productType: string; premium: number; sumInsured: number; startDate: string; endDate: string;
  status: string; agent?: string | null; notes?: string | null; createdAt: string;
}
export interface RenewalDto {
  id: string; policyId: string; policyNumber: string; holderName: string; renewalDate: string; newPremium: number; status: string; notes?: string | null; createdAt: string;
}
export interface ClaimDto {
  id: string; claimNumber: string; policyId: string; policyNumber: string; customerId?: string | null; holderName: string;
  claimDate: string; claimAmount: number; approvedAmount: number; status: string; reason?: string | null; notes?: string | null; createdAt: string;
}
export interface InsuranceSummaryDto {
  totalPolicies: number; activePolicies: number; proposals: number; premiumInForce: number; renewalsDue: number; openClaims: number; claimsPaid: number;
}

export interface CreatePolicyReq { leadId?: string | null; dealId?: string | null; customerId?: string | null; holderName: string; productType: string; premium: number; sumInsured: number; startDate: string; endDate: string; agent?: string | null; notes?: string | null; }
export interface RenewReq { renewalDate: string; newPremium?: number | null; notes?: string | null; }
export interface CreateClaimReq { policyId: string; claimDate: string; claimAmount: number; reason?: string | null; notes?: string | null; }

/** Paging for the vertical lists, which grow with the practice and are never pruned. */
export interface VerticalPageParams { page?: number; pageSize?: number; status?: string; search?: string; }

export interface VerticalPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
export const insuranceApi = {
  getSummary:   (): Promise<InsuranceSummaryDto> => rawApiClient.get(`${BASE}/summary`),  getPolicies: (p: VerticalPageParams = {}): Promise<VerticalPage<PolicyDto>> => {
    const qs = new URLSearchParams();
    qs.set("page", String(p.page ?? 1));
    qs.set("pageSize", String(p.pageSize ?? 30));
    if (p.status) qs.set("status", p.status);
    if (p.search?.trim()) qs.set("search", p.search.trim());
    return rawApiClient.get(`${BASE}/policies?${qs}`);
  },
  createPolicy: (d: CreatePolicyReq): Promise<PolicyDto> => rawApiClient.post(`${BASE}/policies`, d),
  setPolicyStatus:(id: string, status: string): Promise<void> => rawApiClient.patch(`${BASE}/policies/${id}/status`, { status }),
  renewPolicy:  (id: string, d: RenewReq): Promise<RenewalDto> => rawApiClient.post(`${BASE}/policies/${id}/renew`, d),
  deletePolicy: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/policies/${id}`),  getRenewals: (p: VerticalPageParams = {}): Promise<VerticalPage<RenewalDto>> => {
    const qs = new URLSearchParams();
    qs.set("page", String(p.page ?? 1));
    qs.set("pageSize", String(p.pageSize ?? 30));
    if (p.status) qs.set("status", p.status);
    if (p.search?.trim()) qs.set("search", p.search.trim());
    return rawApiClient.get(`${BASE}/renewals?${qs}`);
  },
  completeRenewal:(id: string): Promise<void> => rawApiClient.post(`${BASE}/renewals/${id}/complete`),
  setRenewalStatus:(id: string, status: string): Promise<void> => rawApiClient.patch(`${BASE}/renewals/${id}/status`, { status }),
  deleteRenewal:(id: string): Promise<void> => rawApiClient.delete(`${BASE}/renewals/${id}`),  getClaims: (p: VerticalPageParams = {}): Promise<VerticalPage<ClaimDto>> => {
    const qs = new URLSearchParams();
    qs.set("page", String(p.page ?? 1));
    qs.set("pageSize", String(p.pageSize ?? 30));
    if (p.status) qs.set("status", p.status);
    if (p.search?.trim()) qs.set("search", p.search.trim());
    return rawApiClient.get(`${BASE}/claims?${qs}`);
  },
  createClaim:  (d: CreateClaimReq): Promise<ClaimDto> => rawApiClient.post(`${BASE}/claims`, d),
  approveClaim: (id: string, amount: number): Promise<ClaimDto> => rawApiClient.post(`${BASE}/claims/${id}/approve`, { amount }),
  setClaimStatus:(id: string, status: string): Promise<void> => rawApiClient.patch(`${BASE}/claims/${id}/status`, { status }),
  deleteClaim:  (id: string): Promise<void> => rawApiClient.delete(`${BASE}/claims/${id}`),
};
