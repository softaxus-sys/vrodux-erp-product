import { apiClient } from "@/lib/api-client";
import type { VerticalPage, VerticalPageParams } from "@/lib/verticals-shared";
import type { B2BSummaryDto, ProposalDto, ServiceContractDto, SupportTicketDto } from "@/types/b2b";

const BASE = "/api/b2b";

// Read-only for this pass -- create/status-edit/delete deferred, same call as every other
// module's multi-field creation forms (see README). GetSummary gates the pack's whole tab.
export const B2B_PROPOSALS_VIEW = "b2b.proposals.view";
export const B2B_CONTRACTS_VIEW = "b2b.contracts.view";
export const B2B_TICKETS_VIEW = "b2b.tickets.view";

function qs(p: VerticalPageParams): string {
  const q = new URLSearchParams();
  q.set("page", String(p.page ?? 1));
  q.set("pageSize", String(p.pageSize ?? 30));
  if (p.status) q.set("status", p.status);
  if (p.search) q.set("search", p.search);
  return q.toString();
}

export const b2bApi = {
  getSummary: (): Promise<B2BSummaryDto> => apiClient.get(`${BASE}/summary`),
  getProposals: (p: VerticalPageParams): Promise<VerticalPage<ProposalDto>> => apiClient.get(`${BASE}/proposals?${qs(p)}`),
  getContracts: (p: VerticalPageParams): Promise<VerticalPage<ServiceContractDto>> => apiClient.get(`${BASE}/contracts?${qs(p)}`),
  getTickets: (p: VerticalPageParams): Promise<VerticalPage<SupportTicketDto>> => apiClient.get(`${BASE}/tickets?${qs(p)}`),
};
