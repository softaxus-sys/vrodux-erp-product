import { apiClient } from "@/lib/api-client";
import type { VerticalPage, VerticalPageParams } from "@/lib/verticals-shared";
import type { InsuranceClaimDto, InsuranceSummaryDto, PolicyDto, PolicyRenewalDto } from "@/types/insurance";

const BASE = "/api/insurance";

export const INSURANCE_POLICIES_VIEW = "insurance.policies.view";
export const INSURANCE_RENEWALS_VIEW = "insurance.renewals.view";
export const INSURANCE_CLAIMS_VIEW = "insurance.claims.view";

function qs(p: VerticalPageParams): string {
  const q = new URLSearchParams();
  q.set("page", String(p.page ?? 1));
  q.set("pageSize", String(p.pageSize ?? 30));
  if (p.status) q.set("status", p.status);
  if (p.search) q.set("search", p.search);
  return q.toString();
}

export const insuranceApi = {
  getSummary: (): Promise<InsuranceSummaryDto> => apiClient.get(`${BASE}/summary`),
  getPolicies: (p: VerticalPageParams): Promise<VerticalPage<PolicyDto>> => apiClient.get(`${BASE}/policies?${qs(p)}`),
  getRenewals: (p: VerticalPageParams): Promise<VerticalPage<PolicyRenewalDto>> => apiClient.get(`${BASE}/renewals?${qs(p)}`),
  getClaims: (p: VerticalPageParams): Promise<VerticalPage<InsuranceClaimDto>> => apiClient.get(`${BASE}/claims?${qs(p)}`),
};
