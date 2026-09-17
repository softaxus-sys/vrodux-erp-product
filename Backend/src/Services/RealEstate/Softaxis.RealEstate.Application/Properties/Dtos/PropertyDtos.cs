namespace Softaxis.RealEstate.Application.Properties.Dtos;

public sealed record PropertyLocationDto(string Address, string City, string Emirate);

public sealed record PropertyUnitDto(
    Guid Id, string UnitNumber, string UnitType, decimal Area, int Floor,
    decimal RentPerYear, decimal SalePrice, string Status,
    Guid? CurrentTenantId, string? CurrentTenantName);

/// <summary>
/// An image's metadata. Never carries the bytes: the gallery renders each image from
/// GET /properties/{propertyId}/images/{id}, so a property with twenty photos costs one small
/// JSON response instead of tens of megabytes of base64.
/// </summary>
public sealed record PropertyImageDto(
    Guid Id, string ContentType, string? FileName, string? Caption, int SortOrder, bool IsPrimary);

/// <summary>The bytes themselves. Only ever produced by the single-image serving endpoint.</summary>
public sealed record PropertyImageFileDto(byte[] Data, string ContentType);

public sealed record PropertyDto(
    Guid Id, string PropertyNumber, string Name, string PropertyType, string Status,
    PropertyLocationDto Location, decimal TotalArea, int TotalUnits, int OccupiedUnits,
    decimal MarketValue, string? Developer, string? Description, double OccupancyRate,
    IReadOnlyList<PropertyUnitDto> Units,
    bool ListOnWebsite = false,
    DateTime? PublishedAt = null,
    IReadOnlyList<PropertyImageDto>? Images = null,
    Guid? PrimaryImageId = null);

public sealed record PropertiesSummaryDto(
    int Total, int Residential, int Commercial, int Mixed,
    int TotalUnits, int OccupiedUnits, double OccupancyRate, decimal TotalMarketValue,
    int ListedOnWebsite = 0);
