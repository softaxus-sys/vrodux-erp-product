namespace Softaxis.RealEstate.Application.Listings.Dtos;

/// <summary>
/// One row of the agency's stock list: a unit, together with the building it sits in.
///
/// <para>Flattened on purpose. An agency works from a marketing sheet where every line is one
/// apartment in one tower, and splitting that across a Properties screen and a Units screen meant
/// two lookups to answer a question the sheet answers in a glance. The building's fields are
/// repeated on each of its units, which is exactly how the source spreadsheet reads.</para>
/// </summary>
public sealed record ListingDto(
    // ── identity ──
    /// <summary>The unit's id. A listing IS a unit, so this is what edit and delete act on.</summary>
    Guid Id,
    Guid PropertyId,
    string PropertyNumber,

    // ── the building ──
    string PropertyName,
    string PropertyType,
    string Category,
    string Address,
    string City,
    string Emirate,
    bool ListOnWebsite,
    Guid? PrimaryImageId,
    int ImageCount,

    // ── the unit ──
    string UnitNumber,
    string UnitType,
    decimal Area,
    int Floor,
    decimal RentPerYear,
    decimal SalePrice,
    string Status,
    Guid? CurrentTenantId,
    string? CurrentTenantName,
    string? Furnishing,
    string? View,
    int? Bedrooms,
    int? Bathrooms,
    int Parking,
    decimal ServiceCharge,
    string? Notes,

    // ── the listing ──
    string? Purpose,
    string? ListedOn,
    string? BedsLabel,
    string? PriceLabel,
    string? AreaLabel,
    bool HasMedia,
    bool IsListed,
    string? ListedBy,
    string? AgentName,
    string? OwnerName,
    string? OwnerPhone,
    string? OwnerPhoneAlt);

/// <summary>
/// The tiles above the stock list.
/// </summary>
/// <remarks>
/// Rent and sale totals are kept apart rather than added together. A portfolio holding 60M of
/// asking prices and 2M of annual rent has no meaningful single "value", and one number would
/// read as though it did.
/// </remarks>
public sealed record ListingsSummaryDto(
    int Total,
    int ForRent,
    int ForSale,
    int Vacant,
    int Rented,
    int WithMedia,
    int Advertised,
    decimal TotalAnnualRent,
    decimal TotalAskingPrice,
    int Buildings);
