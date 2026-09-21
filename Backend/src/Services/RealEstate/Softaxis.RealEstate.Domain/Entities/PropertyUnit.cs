namespace Softaxis.RealEstate.Domain.Entities;

/// <summary>
/// One unit, and the listing that markets it.
///
/// <para>Split out of Property.cs when it grew the listing columns — the fields an agency sheet
/// carries per row: what the unit is being offered for, at what price, who owns it and who is
/// handling it. PropertyImage is already a file of its own, so this follows the same shape.</para>
/// </summary>
public sealed class PropertyUnit
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid PropertyId { get; private set; }
    public string UnitNumber { get; private set; } = null!;
    public string UnitType { get; private set; } = null!; // studio/1br/2br/3br/office/retail
    public decimal Area { get; private set; }
    public int Floor { get; private set; }
    public decimal RentPerYear { get; private set; }
    public decimal SalePrice { get; private set; }
    public string Status { get; private set; } = "vacant"; // vacant/rented/sold/maintenance
    public Guid? CurrentTenantId { get; private set; }
    public string? CurrentTenantName { get; private set; }

    // The Add Unit form has always collected these. There was nowhere to put them, so every one
    // was silently discarded on save — the same trap as the tenant profile fields (Module 50b).
    public string? Furnishing    { get; private set; }   // unfurnished / semi_furnished / fully_furnished
    public string? View          { get; private set; }
    public int?    Bedrooms      { get; private set; }
    public int?    Bathrooms     { get; private set; }
    public int     Parking       { get; private set; }
    public decimal ServiceCharge { get; private set; }
    public string? Notes         { get; private set; }

    // ── The listing ───────────────────────────────────────────────────────────
    // An agency works from a marketing sheet, not a property register: every row is a unit being
    // offered. These are that row's columns, and until now the only home any of them had was a
    // sentence glued onto the end of Notes by the importer.

    /// <summary>rent / sale — what this unit is being offered for. Null when it is not on offer.</summary>
    public string? Purpose { get; private set; }

    /// <summary>The date the listing was taken on, as yyyy-MM-dd.</summary>
    /// <remarks>
    /// A plain calendar date, matching RentInstallment.DueDate. A DateTime would drag a timezone
    /// into a value that has none, which is how attendance ended up four hours out.
    /// </remarks>
    public string? ListedOn { get; private set; }

    /// <summary>
    /// The layout exactly as the sheet words it — "2bhk+maid", "4bhk+study+roof", "studio".
    ///
    /// <para>Kept alongside the parsed <see cref="Bedrooms"/> count rather than instead of it.
    /// "4bhk+terrace closed as extra 1 room" is a real cell: the number is what sorts and filters,
    /// the words are what the agent quotes to a buyer, and neither substitutes for the other.</para>
    /// </summary>
    public string? BedsLabel { get; private set; }

    /// <summary>
    /// The price cell as written — "700k(rented till 29 feb 2026 in 55k)", "3.25M(mortgage),3.22M(cash)".
    ///
    /// <para>Most of these cells carry a condition, not just a number. <see cref="RentPerYear"/> and
    /// <see cref="SalePrice"/> hold whatever could be read as a figure; this holds what was actually
    /// agreed, which is the part a negotiation turns on.</para>
    /// </summary>
    public string? PriceLabel { get; private set; }

    /// <summary>Area as written — "plot area 1225.47sqft, built up area 2234.35sqft".</summary>
    public string? AreaLabel { get; private set; }

    /// <summary>Whether photographs or video exist for this unit.</summary>
    public bool HasMedia { get; private set; }

    /// <summary>Whether it is advertised on a portal. The permit number sits in <see cref="ListedBy"/>.</summary>
    public bool IsListed { get; private set; }

    /// <summary>Who advertised it, and under which permit number.</summary>
    public string? ListedBy { get; private set; }

    /// <summary>The agent handling it — the sheet's "contact with" column.</summary>
    public string? AgentName { get; private set; }

    public string? OwnerName     { get; private set; }
    public string? OwnerPhone    { get; private set; }

    /// <summary>
    /// A second contact number. These sheets routinely carry two, and dropping one loses the only
    /// reachable line for the owner as often as not.
    /// </summary>
    public string? OwnerPhoneAlt { get; private set; }

    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public PropertyUnit(Guid propertyId, string unitNumber, string unitType, decimal area, int floor,
        decimal rentPerYear, decimal salePrice)
    {
        PropertyId = propertyId; UnitNumber = unitNumber; UnitType = unitType;
        Area = area; Floor = floor; RentPerYear = rentPerYear; SalePrice = salePrice;
    }

    public void Update(string unitNumber, string unitType, decimal area, int floor,
        decimal rentPerYear, decimal salePrice)
    {
        UnitNumber = unitNumber; UnitType = unitType; Area = area; Floor = floor;
        RentPerYear = rentPerYear; SalePrice = salePrice; UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>The optional detail fields, kept off the constructor so it stays readable.</summary>
    public void SetDetails(string? furnishing, string? view, int? bedrooms, int? bathrooms,
        int parking, decimal serviceCharge, string? notes)
    {
        Furnishing = Trim(furnishing); View = Trim(view);
        Bedrooms = bedrooms; Bathrooms = bathrooms;
        Parking = Math.Max(0, parking); ServiceCharge = Math.Max(0, serviceCharge);
        Notes = Trim(notes);
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// The marketing side of the row. A second setter rather than twelve more constructor
    /// parameters, for the same reason SetDetails is one.
    /// </summary>
    public void SetListing(string? purpose, string? listedOn, string? bedsLabel, string? priceLabel,
        string? areaLabel, bool hasMedia, bool isListed, string? listedBy, string? agentName,
        string? ownerName, string? ownerPhone, string? ownerPhoneAlt)
    {
        Purpose = NormalisePurpose(purpose);
        ListedOn = Trim(listedOn);
        BedsLabel = Trim(bedsLabel); PriceLabel = Trim(priceLabel); AreaLabel = Trim(areaLabel);
        HasMedia = hasMedia; IsListed = isListed;
        ListedBy = Trim(listedBy); AgentName = Trim(agentName);
        OwnerName = Trim(ownerName); OwnerPhone = Trim(ownerPhone); OwnerPhoneAlt = Trim(ownerPhoneAlt);
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// rent / sale, or null when the cell says neither. The purpose decides whether a unit appears
    /// under rentals or under sales, so an unreadable value is left unset rather than guessed.
    /// </summary>
    private static string? NormalisePurpose(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var t = raw.Trim().ToLowerInvariant();
        if (t.Contains("sale") || t.Contains("sell") || t.Contains("buy")) return "sale";
        if (t.Contains("rent") || t.Contains("lease") || t.Contains("let")) return "rent";
        return null;
    }

    private static string? Trim(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    public void Occupy(Guid tenantId, string tenantName)
    {
        CurrentTenantId = tenantId; CurrentTenantName = tenantName;
        Status = "rented"; UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Records occupancy where no tenant record exists — an import knows a unit is let but not to
    /// whom. Occupy() requires a tenant, and inventing one to satisfy it would put a fictional
    /// person on the unit and into every report that counts tenants.
    /// </summary>
    public void SetOccupancy(string status)
    {
        Status = status; UpdatedAt = DateTime.UtcNow;
    }

    public void Vacate() { CurrentTenantId = null; CurrentTenantName = null; Status = "vacant"; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
