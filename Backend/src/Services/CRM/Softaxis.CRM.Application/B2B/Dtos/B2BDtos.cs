namespace Softaxis.CRM.Application.B2B.Dtos;

public sealed record ProposalDto(
    Guid Id, string ProposalNumber, Guid? LeadId, Guid? DealId, Guid? CustomerId, string ClientName,
    string Title, decimal Amount, string ValidUntil, string Status, string? Scope, string? Notes, DateTime CreatedAt);

public sealed record ServiceContractDto(
    Guid Id, string ContractNumber, Guid? ProposalId, Guid? DealId, Guid? CustomerId, string ClientName,
    string Title, string ContractType, decimal Value, string StartDate, string EndDate, string Status,
    string? SlaTier, string? Notes, DateTime CreatedAt);

public sealed record SupportTicketDto(
    Guid Id, string TicketNumber, Guid? ContractId, Guid? CustomerId, string ClientName, string Subject,
    string Priority, string Status, string? Description, string? Resolution, DateTime CreatedAt);

public sealed record B2BSummaryDto(
    int OpenProposals, decimal ProposalsValue, int ActiveContracts, decimal RecurringRevenue,
    int OpenTickets, int CriticalTickets, int ResolvedTickets);
