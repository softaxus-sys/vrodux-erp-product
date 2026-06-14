namespace Softaxis.RealEstate.Application.Properties.Dtos;

public sealed record PropertyLocationDto(string Address, string City, string Emirate);

public sealed record PropertyUnitDto(
    Guid Id, string UnitNumber, string UnitType, decimal Area, int Floor,
    decimal RentPerYear, decimal SalePrice, string Status,
    Guid? CurrentTenantId, string? CurrentTenantName);

public sealed record PropertyDto(
    Guid Id, string PropertyNumber, string Name, string PropertyType, string Status,
    PropertyLocationDto Location, decimal TotalArea, int TotalUnits, int OccupiedUnits,
    decimal MarketValue, string? Developer, string? Description, double OccupancyRate,
    IReadOnlyList<PropertyUnitDto> Units);

public sealed record PropertiesSummaryDto(
    int Total, int Residential, int Commercial, int Mixed,
    int TotalUnits, int OccupiedUnits, double OccupancyRate, decimal TotalMarketValue);
