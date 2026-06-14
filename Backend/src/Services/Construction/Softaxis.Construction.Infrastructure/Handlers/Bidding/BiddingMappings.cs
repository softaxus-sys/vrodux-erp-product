using Softaxis.Construction.Application.Bidding.Dtos;
using Softaxis.Construction.Domain.Entities;

namespace Softaxis.Construction.Infrastructure.Handlers.Bidding;

internal static class BiddingMappings
{
    public static RfqDto ToDto(Rfq x) => new(
        x.Id, x.RfqNumber, x.LeadId, x.CustomerId, x.ClientName, x.ProjectTitle,
        x.Scope, x.Budget, x.DueDate, x.Status, x.AssignedTo, x.Notes, x.CreatedAt);

    public static EstimateDto ToDto(Estimate x) => new(
        x.Id, x.EstimateNumber, x.RfqId, x.DealId, x.CustomerId, x.ClientName,
        x.Title, x.Amount, x.ValidUntil, x.Status, x.Notes, x.CreatedAt);

    public static ConstructionContractDto ToDto(ConstructionContract x) => new(
        x.Id, x.ContractNumber, x.DealId, x.CustomerId, x.EstimateId, x.ProjectId,
        x.ClientName, x.Title, x.ContractValue, x.StartDate, x.EndDate,
        x.Status, x.Contractor, x.Notes, x.CreatedAt);
}
