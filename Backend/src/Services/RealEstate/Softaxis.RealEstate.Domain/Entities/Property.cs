namespace Softaxis.RealEstate.Domain.Entities;

public sealed class Property
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string PropertyNumber { get; private set; } = null!;
    public string Name { get; private set; } = null!;

    /// <summary>
    /// The kind of property, as the workspace words it — "Apartment", "Villa", "Townhouse",
    /// "Plot", or anything else they add.
    ///
    /// <para>Free text on purpose. It used to hold one of three codes (residential/commercial/mixed),
    /// so eight display types collapsed into them and a "Warehouse" reopened as "Commercial
    /// Building". The broad bucket that summaries count now lives in <see cref="Category"/>, which
    /// leaves this column free to say what the property actually is.</para>
    /// </summary>
    public string PropertyType { get; private set; } = null!;

    /// <summary>
    /// residential / commercial / mixed — the bucket the portfolio summary counts by.
    ///
    /// <para>Separate from <see cref="PropertyType"/> because an agency sheet carries both: "Villa"
    /// in the type column and "Residential" beside it. Folding them together is what made the type
    /// list lossy.</para>
    /// </summary>
    public string Category { get; private set; } = "residential";

    public string Address { get; private set; } = null!;
    public string City { get; private set; } = null!;
    public string Emirate { get; private set; } = null!;
    public decimal TotalArea { get; private set; }
    public int TotalUnits { get; private set; }
    public int OccupiedUnits { get; private set; }
    public string Status { get; private set; } = "available"; // available/partially_occupied/fully_occupied
    public decimal MarketValue { get; private set; }
    public string? Developer { get; private set; }
    public string? Description { get; private set; }

    /// <summary>
    /// Whether this property is published to the client's public website.
    ///
    /// Defaults to false: a property is created here for portfolio management, and publishing it
    /// is a separate, deliberate decision. Defaulting to true would push every building a client
    /// records — including ones they manage but do not market — onto their public site.
    /// </summary>
    public bool ListOnWebsite { get; private set; }

    /// <summary>When it was last published, so the website can show genuinely new listings first.</summary>
    public DateTime? PublishedAt { get; private set; }

    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;
    public List<PropertyUnit> Units { get; private set; } = [];
    public List<PropertyImage> Images { get; private set; } = [];

    public Property(string name, string propertyType, string address, string city, string emirate,
        decimal totalArea, int totalUnits, decimal marketValue, string? developer, string? description,
        string? category = null)
    {
        PropertyNumber = $"PROP-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpper()}";
        Name = name; PropertyType = propertyType; Address = address; City = city; Emirate = emirate;
        TotalArea = totalArea; TotalUnits = totalUnits; MarketValue = marketValue;
        Developer = developer; Description = description;
        Category = NormaliseCategory(category);
    }

    public void Update(string name, string propertyType, string address, string city, string emirate,
        decimal totalArea, int totalUnits, decimal marketValue, string? developer, string? description,
        string? category = null)
    {
        Name = name; PropertyType = propertyType; Address = address; City = city; Emirate = emirate;
        TotalArea = totalArea; TotalUnits = totalUnits; MarketValue = marketValue;
        Developer = developer; Description = description;

        // Null leaves it alone. Callers that only know about the other fields — PropertyCounts,
        // for one — must not reset the category to the default on every unit added.
        if (category is not null) Category = NormaliseCategory(category);

        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Keeps the category to the three values the summary counts. An unrecognised word falls back
    /// to residential rather than creating a fourth bucket nothing tallies.
    /// </summary>
    private static string NormaliseCategory(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return "residential";
        var t = raw.Trim().ToLowerInvariant();
        if (t.StartsWith("commerc")) return "commercial";
        if (t.StartsWith("mixed"))   return "mixed";
        return "residential";
    }

    /// <summary>
    /// Publishes to, or withdraws from, the public website.
    ///
    /// PublishedAt is stamped only on the transition into published, and deliberately kept on
    /// withdrawal — re-listing a property that came off the market briefly should not present it
    /// as brand new, and the original publication date is the honest one.
    /// </summary>
    public void SetWebsiteListing(bool listed)
    {
        if (listed && !ListOnWebsite) PublishedAt = DateTime.UtcNow;
        ListOnWebsite = listed;
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateOccupancy(int occupied)
    {
        OccupiedUnits = occupied;
        Status = occupied == 0 ? "available" : occupied >= TotalUnits ? "fully_occupied" : "partially_occupied";
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
