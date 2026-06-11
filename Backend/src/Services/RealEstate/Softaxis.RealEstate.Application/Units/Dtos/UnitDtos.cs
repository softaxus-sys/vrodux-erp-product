namespace Softaxis.RealEstate.Application.Units.Dtos;

public sealed record UnitDto(
    Guid Id, Guid PropertyId, string UnitNumber, string UnitType, decimal Area, int Floor,
    decimal RentPerYear, decimal SalePrice, string Status, Guid? CurrentTenantId, string? CurrentTenantName);

public sealed record UnitsSummaryDto(
    int Total, int Vacant, int Rented, int Sold, int Maintenance,
    decimal TotalAnnualRent, double OccupancyRate);
