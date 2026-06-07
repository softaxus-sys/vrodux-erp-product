import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/b2b`;

export interface ProposalDto {
  id: string; proposalNumber: string; leadId?: string | null; dealId?: string | null; customerId?: string | null;
  clientName: string; title: string; amount: number; validUntil: string; status: string; scope?: string | null; notes?: string | null; createdAt: string;
}
export interface ServiceContractDto {
  id: string; contractNumber: string; proposalId?: string | null; dealId?: string | null; customerId?: string | null;
  clientName: string; title: string; contractType: string; value: number; startDate: string; endDate: string;
  status: string; slaTier?: string | null; notes?: string | null; createdAt: string;
}
export interface SupportTicketDto {
  id: string; ticketNumber: string; contractId?: string | null; customerId?: string | null; clientName: string;
  subject: string; priority: string; status: string; description?: string | null; resolution?: string | null; createdAt: string;
}
export interface B2BSummaryDto {
  openProposals: number; proposalsValue: number; activeContracts: number; recurringRevenue: number;
  openTickets: number; criticalTickets: number; resolvedTickets: number;
}

export interface CreateProposalReq { leadId?: string | null; dealId?: string | null; customerId?: string | null; clientName: string; title: string; amount: number; validUntil: string; scope?: string | null; notes?: string | null; }
export interface CreateContractReq { proposalId?: string | null; dealId?: string | null; customerId?: string | null; clientName: string; title: string; contractType: string; value: number; startDate: string; endDate: string; slaTier?: string | null; notes?: string | null; }
export interface CreateTicketReq { contractId?: string | null; customerId?: string | null; clientName: string; subject: string; priority?: string | null; description?: string | null; }

export const b2bApi = {
  getSummary:   (): Promise<B2BSummaryDto> => rawApiClient.get(`${BASE}/summary`),

  getProposals: (): Promise<ProposalDto[]> => rawApiClient.get(`${BASE}/proposals`),
  createProposal:(d: CreateProposalReq): Promise<ProposalDto> => rawApiClient.post(`${BASE}/proposals`, d),
  setProposalStatus:(id: string, status: string): Promise<void> => rawApiClient.patch(`${BASE}/proposals/${id}/status`, { status }),
  deleteProposal:(id: string): Promise<void> => rawApiClient.delete(`${BASE}/proposals/${id}`),

  getContracts: (): Promise<ServiceContractDto[]> => rawApiClient.get(`${BASE}/contracts`),
  createContract:(d: CreateContractReq): Promise<ServiceContractDto> => rawApiClient.post(`${BASE}/contracts`, d),
  setContractStatus:(id: string, status: string): Promise<void> => rawApiClient.patch(`${BASE}/contracts/${id}/status`, { status }),
  deleteContract:(id: string): Promise<void> => rawApiClient.delete(`${BASE}/contracts/${id}`),

  getTickets:   (): Promise<SupportTicketDto[]> => rawApiClient.get(`${BASE}/tickets`),
  createTicket: (d: CreateTicketReq): Promise<SupportTicketDto> => rawApiClient.post(`${BASE}/tickets`, d),
  resolveTicket:(id: string, resolution?: string | null): Promise<void> => rawApiClient.post(`${BASE}/tickets/${id}/resolve`, { resolution }),
  setTicketStatus:(id: string, status: string): Promise<void> => rawApiClient.patch(`${BASE}/tickets/${id}/status`, { status }),
  deleteTicket: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/tickets/${id}`),
};
