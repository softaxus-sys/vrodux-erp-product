using Softaxis.RealEstate.Application.Tenants.Dtos;
using Softaxis.RealEstate.Domain.Entities;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Tenants;

internal static class TenantMappings
{
    public static TenantDto ToDto(Tenant t) => new(
        t.Id, t.TenantNumber, t.Name, t.TenantType, t.Email, t.Phone,
        t.NationalId, t.CompanyName, t.TradeLicense, t.Nationality,
        t.Status, t.ActiveContracts, t.TotalPaid);
}
