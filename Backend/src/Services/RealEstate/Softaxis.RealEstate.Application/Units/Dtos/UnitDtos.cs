namespace Softaxis.RealEstate.Application.Units.Dtos;

public sealed record UnitDto(
    Guid Id, Guid PropertyId, string UnitNumber, string UnitType, decimal Area, int Floor,
    decimal RentPerYear, decimal SalePrice, string Status, Guid? CurrentTenantId, string? CurrentTenantName,
    string? Furnishing = null, string? View = null, int? Bedrooms = null, int? Bathrooms = null,
    int Parking = 0, decimal ServiceCharge = 0, string? Notes = null,
    // The listing columns. Trailing and optional so every existing caller maps unchanged.
    string? Purpose = null, string? ListedOn = null, string? BedsLabel = null,
    string? PriceLabel = null, string? AreaLabel = null,
    bool HasMedia = false, bool IsListed = false, string? ListedBy = null, string? AgentName = null,
    string? OwnerName = null, string? OwnerPhone = null, string? OwnerPhoneAlt = null);

public sealed record UnitsSummaryDto(
    int Total, int Vacant, int Rented, int Sold, int Maintenance,
    decimal TotalAnnualRent, double OccupancyRate);
