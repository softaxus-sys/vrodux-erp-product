namespace Softaxis.RealEstate.Application.PublicListings.Dtos;

/// <summary>
/// What a tenant's public website is allowed to see.
///
/// This is a deliberately narrower shape than PropertyDto, not a rename of it. Two things are
/// withheld on purpose:
///
///  - MarketValue. That is the owner's internal valuation of the building, not an asking price.
///    Publishing it would disclose what a landlord thinks their portfolio is worth to anyone
///    who opens the website. Marketed prices live on the units (rent / sale), and those are
///    published.
///  - Occupancy and current tenant names. Who lives in unit 402 is personal data, and a
///    building's occupancy rate is commercial information. The website gets the count of
///    AVAILABLE units, which is the only part a buyer or renter needs.
/// </summary>
public sealed record PublicPropertyDto(
    Guid Id,
    string Reference,
    string Name,
    string PropertyType,
    string Address,
    string City,
    string Emirate,
    decimal TotalArea,
    int TotalUnits,
    /// <summary>Units currently free. The inverse — who is in the rest — is never sent.</summary>
    int AvailableUnits,
    string? Developer,
    string? Description,
    DateTime? PublishedAt,
    /// <summary>
    /// Signed, expiring image paths (relative to the API host), cover first. They stop working
    /// when the property is withdrawn, the integration is disabled or the key is regenerated.
    /// </summary>
    IReadOnlyList<string> ImageUrls,
    IReadOnlyList<PublicUnitDto> Units);

/// <summary>
/// A marketable unit. Carries the asking figures and the physical description, and nothing
/// about who occupies it.
/// </summary>
public sealed record PublicUnitDto(
    Guid Id,
    string UnitNumber,
    string UnitType,
    decimal Area,
    int Floor,
    decimal RentPerYear,
    decimal SalePrice,
    string? Furnishing,
    string? View,
    int? Bedrooms,
    int? Bathrooms,
    int Parking);

/// <summary>Enough for a website to render its own header without a second call.</summary>
public sealed record PublicCompanyDto(string Name);
