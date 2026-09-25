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
    /// <summary>
    /// Confidential — null when <see cref="HasConfidentialAccess"/> is false. Never sent to a
    /// caller who is not permitted to see it, masked server-side before the DTO leaves the handler.
    /// </summary>
    string? UnitNumber,
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

    // ── confidentiality ──
    /// <summary>The account allowed to see this listing's confidential columns. Null = nobody has
    /// claimed it yet — only the tenant admin / a permission holder can see it until assigned.</summary>
    Guid? AgentUserId,
    /// <summary>
    /// Whether THIS caller can see <see cref="UnitNumber"/> and the owner fields below. Carried on
    /// the DTO so the UI can show a "Restricted" indicator rather than a value that merely looks
    /// empty — a hidden-because-restricted cell should never read the same as an unrecorded one.
    /// </summary>
    bool HasConfidentialAccess,
    /// <summary>
    /// The listing's own "Restrict to owner/agent only" setting — always sent as-is, never masked,
    /// since knowing WHETHER a listing is locked down reveals nothing about the owner themselves.
    /// Drives the checkbox on the edit form; true by default for every new listing.
    /// </summary>
    bool RestrictConfidentialDetails,
    /// <summary>
    /// Whether THIS caller may CHANGE the confidential fields, reassign the agent, or flip the
    /// restriction checkbox — narrower than <see cref="HasConfidentialAccess"/> on purpose. An
    /// unrestricted listing sets that to true for everyone (anyone may VIEW it), but this stays
    /// false for anyone who is not the tenant admin or the listing's own agent — unchecking the
    /// restriction must open viewing, never editing the owner's phone number, to the rest of staff.
    /// </summary>
    bool CanManageConfidential,

    // ── confidential (null unless HasConfidentialAccess) ──
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
