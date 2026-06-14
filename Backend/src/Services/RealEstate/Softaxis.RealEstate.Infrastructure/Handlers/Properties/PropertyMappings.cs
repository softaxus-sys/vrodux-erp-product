using Softaxis.RealEstate.Application.Properties.Dtos;
using Softaxis.RealEstate.Domain.Entities;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Properties;

internal static class PropertyMappings
{
    public static PropertyDto ToDto(Property p) => new(
        p.Id, p.PropertyNumber, p.Name, p.PropertyType, p.Status,
        new PropertyLocationDto(p.Address, p.City, p.Emirate),
        p.TotalArea, p.TotalUnits, p.OccupiedUnits, p.MarketValue, p.Developer, p.Description,
        p.TotalUnits > 0 ? Math.Round((double)p.OccupiedUnits / p.TotalUnits * 100, 1) : 0,
        p.Units.Where(u => !u.IsDeleted).Select(ToDto).ToList());

    public static PropertyUnitDto ToDto(PropertyUnit u) => new(
        u.Id, u.UnitNumber, u.UnitType, u.Area, u.Floor, u.RentPerYear, u.SalePrice, u.Status,
        u.CurrentTenantId, u.CurrentTenantName);
}
