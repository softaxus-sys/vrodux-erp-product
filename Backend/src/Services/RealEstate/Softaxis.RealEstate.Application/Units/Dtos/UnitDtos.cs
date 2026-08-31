namespace Softaxis.RealEstate.Application.Units.Dtos;

public sealed record UnitDto(
    Guid Id, Guid PropertyId, string UnitNumber, string UnitType, decimal Area, int Floor,
    decimal RentPerYear, decimal SalePrice, string Status, Guid? CurrentTenantId, string? CurrentTenantName,
    string? Furnishing = null, string? View = null, int? Bedrooms = null, int? Bathrooms = null,
    int Parking = 0, decimal ServiceCharge = 0, string? Notes = null);

public sealed record UnitsSummaryDto(
    int Total, int Vacant, int Rented, int Sold, int Maintenance,
    decimal TotalAnnualRent, double OccupancyRate);
