using Softaxis.RealEstate.Application.Contracts.Dtos;
using Softaxis.RealEstate.Domain.Entities;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Contracts;

internal static class ContractMappings
{
    public static ContractDto ToDto(LeaseContract c) => new(
        c.Id, c.ContractNumber, c.PropertyId, c.PropertyName, c.UnitId, c.UnitNumber,
        c.TenantId, c.TenantName, c.StartDate, c.EndDate, c.AnnualRent, c.Cheques,
        c.SecurityDeposit, c.Status, c.TotalPaid, c.Balance, c.EjariNumber, c.Notes);
}
