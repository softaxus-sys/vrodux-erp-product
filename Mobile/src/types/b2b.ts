/** B2B Services pack: Proposals -> Service Contracts (AMC/SLA/Retainer) -> Support Tickets.
 *  Read-only browse -- see README's B2B section for why creation/status-editing is deferred. */

export interface ProposalDto {
  id: string;
  proposalNumber: string;
  leadId: string | null;
  dealId: string | null;
  customerId: string | null;
  clientName: string;
  title: string;
  amount: number;
  validUntil: string;
  status: string;
  scope: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ServiceContractDto {
  id: string;
  contractNumber: string;
  proposalId: string | null;
  dealId: string | null;
  customerId: string | null;
  clientName: string;
  title: string;
  contractType: string;
  value: number;
  startDate: string;
  endDate: string;
  status: string;
  slaTier: string | null;
  notes: string | null;
  createdAt: string;
}

export interface SupportTicketDto {
  id: string;
  ticketNumber: string;
  contractId: string | null;
  customerId: string | null;
  clientName: string;
  subject: string;
  priority: string;
  status: string;
  description: string | null;
  resolution: string | null;
  createdAt: string;
}

export interface B2BSummaryDto {
  openProposals: number;
  proposalsValue: number;
  activeContracts: number;
  recurringRevenue: number;
  openTickets: number;
  criticalTickets: number;
  resolvedTickets: number;
}
