using Softaxis.RealEstate.Application.Units.Dtos;
using Softaxis.RealEstate.Domain.Entities;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Units;

internal static class UnitMappings
{
    public static UnitDto ToDto(PropertyUnit u) => new(
        u.Id, u.PropertyId, u.UnitNumber, u.UnitType, u.Area, u.Floor,
        u.RentPerYear, u.SalePrice, u.Status, u.CurrentTenantId, u.CurrentTenantName,
        u.Furnishing, u.View, u.Bedrooms, u.Bathrooms, u.Parking, u.ServiceCharge, u.Notes);
}
