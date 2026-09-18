/** Insurance pack: Policies -> Renewals -> Claims.
 *  Read-only browse -- see README's Insurance section for what's deferred. */

export interface PolicyDto {
  id: string;
  policyNumber: string;
  leadId: string | null;
  dealId: string | null;
  customerId: string | null;
  holderName: string;
  productType: string;
  premium: number;
  sumInsured: number;
  startDate: string;
  endDate: string;
  status: string;
  agent: string | null;
  notes: string | null;
  createdAt: string;
}

export interface PolicyRenewalDto {
  id: string;
  policyId: string;
  policyNumber: string;
  holderName: string;
  renewalDate: string;
  newPremium: number;
  status: string;
  notes: string | null;
  createdAt: string;
}

export interface InsuranceClaimDto {
  id: string;
  claimNumber: string;
  policyId: string;
  policyNumber: string;
  customerId: string | null;
  holderName: string;
  claimDate: string;
  claimAmount: number;
  approvedAmount: number;
  status: string;
  reason: string | null;
  notes: string | null;
  createdAt: string;
}

export interface InsuranceSummaryDto {
  totalPolicies: number;
  activePolicies: number;
  proposals: number;
  premiumInForce: number;
  renewalsDue: number;
  openClaims: number;
  claimsPaid: number;
}
