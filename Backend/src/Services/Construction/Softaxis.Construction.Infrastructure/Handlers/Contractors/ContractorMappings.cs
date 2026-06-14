using Softaxis.Construction.Application.Contractors.Dtos;
using Softaxis.Construction.Domain.Entities;

namespace Softaxis.Construction.Infrastructure.Handlers.Contractors;

internal static class ContractorMappings
{
    public static ContractorDto ToDto(Contractor c) => new(
        c.Id, c.CompanyName, c.Trade, c.ContactPerson, c.Email, c.Phone, c.City,
        c.LicenseNumber, c.LicenseExpiry, c.ActiveProjects, c.CompletedProjects,
        c.TotalContractValue, c.Rating);
}
