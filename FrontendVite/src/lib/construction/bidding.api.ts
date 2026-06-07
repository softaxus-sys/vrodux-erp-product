import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/construction`;

export interface RfqDto {
  id: string; rfqNumber: string; leadId?: string | null; customerId?: string | null;
  clientName: string; projectTitle: string; scope?: string | null; budget?: number | null;
  dueDate: string; status: string; assignedTo: string; notes?: string | null; createdAt: string;
}
export interface EstimateDto {
  id: string; estimateNumber: string; rfqId?: string | null; dealId?: string | null; customerId?: string | null;
  clientName: string; title: string; amount: number; validUntil: string; status: string; notes?: string | null; createdAt: string;
}
export interface ConContractDto {
  id: string; contractNumber: string; dealId?: string | null; customerId?: string | null; estimateId?: string | null; projectId?: string | null;
  clientName: string; title: string; contractValue: number; startDate: string; endDate: string; status: string; contractor?: string | null; notes?: string | null; createdAt: string;
}
export interface ConBiddingSummaryDto {
  openRfqs: number; totalRfqs: number; pendingEstimates: number; estimatedValue: number; activeContracts: number; contractValue: number;
}

export interface CreateRfqReq { leadId?: string | null; customerId?: string | null; clientName: string; projectTitle: string; scope?: string | null; budget?: number | null; dueDate: string; assignedTo?: string | null; notes?: string | null; }
export interface CreateEstimateReq { rfqId?: string | null; dealId?: string | null; customerId?: string | null; clientName: string; title: string; amount: number; validUntil: string; notes?: string | null; }
export interface CreateContractReq { dealId?: string | null; customerId?: string | null; estimateId?: string | null; clientName: string; title: string; contractValue: number; startDate: string; endDate: string; contractor?: string | null; notes?: string | null; }

export const conBiddingApi = {
  getSummary:     (): Promise<ConBiddingSummaryDto> => rawApiClient.get(`${BASE}/bidding/summary`),

  getRfqs:        (): Promise<RfqDto[]> => rawApiClient.get(`${BASE}/rfqs`),
  createRfq:      (d: CreateRfqReq): Promise<RfqDto> => rawApiClient.post(`${BASE}/rfqs`, d),
  setRfqStatus:   (id: string, status: string): Promise<void> => rawApiClient.patch(`${BASE}/rfqs/${id}/status`, { status }),
  deleteRfq:      (id: string): Promise<void> => rawApiClient.delete(`${BASE}/rfqs/${id}`),

  getEstimates:   (): Promise<EstimateDto[]> => rawApiClient.get(`${BASE}/estimates`),
  createEstimate: (d: CreateEstimateReq): Promise<EstimateDto> => rawApiClient.post(`${BASE}/estimates`, d),
  setEstimateStatus:(id: string, status: string): Promise<void> => rawApiClient.patch(`${BASE}/estimates/${id}/status`, { status }),
  deleteEstimate: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/estimates/${id}`),

  getContracts:   (): Promise<ConContractDto[]> => rawApiClient.get(`${BASE}/contracts`),
  createContract: (d: CreateContractReq): Promise<ConContractDto> => rawApiClient.post(`${BASE}/contracts`, d),
  setContractStatus:(id: string, status: string): Promise<void> => rawApiClient.patch(`${BASE}/contracts/${id}/status`, { status }),
  deleteContract: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/contracts/${id}`),
};
