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

export const insuranceApi = {
  getSummary:   (): Promise<InsuranceSummaryDto> => rawApiClient.get(`${BASE}/summary`),

  getPolicies:  (): Promise<PolicyDto[]> => rawApiClient.get(`${BASE}/policies`),
  createPolicy: (d: CreatePolicyReq): Promise<PolicyDto> => rawApiClient.post(`${BASE}/policies`, d),
  setPolicyStatus:(id: string, status: string): Promise<void> => rawApiClient.patch(`${BASE}/policies/${id}/status`, { status }),
  renewPolicy:  (id: string, d: RenewReq): Promise<RenewalDto> => rawApiClient.post(`${BASE}/policies/${id}/renew`, d),
  deletePolicy: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/policies/${id}`),

  getRenewals:  (): Promise<RenewalDto[]> => rawApiClient.get(`${BASE}/renewals`),
  completeRenewal:(id: string): Promise<void> => rawApiClient.post(`${BASE}/renewals/${id}/complete`),
  setRenewalStatus:(id: string, status: string): Promise<void> => rawApiClient.patch(`${BASE}/renewals/${id}/status`, { status }),
  deleteRenewal:(id: string): Promise<void> => rawApiClient.delete(`${BASE}/renewals/${id}`),

  getClaims:    (): Promise<ClaimDto[]> => rawApiClient.get(`${BASE}/claims`),
  createClaim:  (d: CreateClaimReq): Promise<ClaimDto> => rawApiClient.post(`${BASE}/claims`, d),
  approveClaim: (id: string, amount: number): Promise<ClaimDto> => rawApiClient.post(`${BASE}/claims/${id}/approve`, { amount }),
  setClaimStatus:(id: string, status: string): Promise<void> => rawApiClient.patch(`${BASE}/claims/${id}/status`, { status }),
  deleteClaim:  (id: string): Promise<void> => rawApiClient.delete(`${BASE}/claims/${id}`),
};
