using Softaxis.CRM.Application.B2B.Dtos;
using Softaxis.CRM.Domain.Entities;

namespace Softaxis.CRM.Infrastructure.Handlers.B2B;

internal static class B2BMappings
{
    public static ProposalDto ToDto(Proposal p) => new(
        p.Id, p.ProposalNumber, p.LeadId, p.DealId, p.CustomerId, p.ClientName,
        p.Title, p.Amount, p.ValidUntil, p.Status, p.Scope, p.Notes, p.CreatedAt);

    public static ServiceContractDto ToDto(ServiceContract c) => new(
        c.Id, c.ContractNumber, c.ProposalId, c.DealId, c.CustomerId, c.ClientName,
        c.Title, c.ContractType, c.Value, c.StartDate, c.EndDate, c.Status, c.SlaTier, c.Notes, c.CreatedAt);

    public static SupportTicketDto ToDto(SupportTicket t) => new(
        t.Id, t.TicketNumber, t.ContractId, t.CustomerId, t.ClientName, t.Subject,
        t.Priority, t.Status, t.Description, t.Resolution, t.CreatedAt);
}
