namespace Softaxis.RealEstate.Domain.Entities;

public sealed class Property
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string PropertyNumber { get; private set; } = null!;
    public string Name { get; private set; } = null!;
    public string PropertyType { get; private set; } = null!; // residential/commercial/mixed
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
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;
    public List<PropertyUnit> Units { get; private set; } = [];

    public Property(string name, string propertyType, string address, string city, string emirate,
        decimal totalArea, int totalUnits, decimal marketValue, string? developer, string? description)
    {
        PropertyNumber = $"PROP-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpper()}";
        Name = name; PropertyType = propertyType; Address = address; City = city; Emirate = emirate;
        TotalArea = totalArea; TotalUnits = totalUnits; MarketValue = marketValue;
        Developer = developer; Description = description;
    }

    public void Update(string name, string propertyType, string address, string city, string emirate,
        decimal totalArea, int totalUnits, decimal marketValue, string? developer, string? description)
    {
        Name = name; PropertyType = propertyType; Address = address; City = city; Emirate = emirate;
        TotalArea = totalArea; TotalUnits = totalUnits; MarketValue = marketValue;
        Developer = developer; Description = description;
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

    private static string? Trim(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    public void Occupy(Guid tenantId, string tenantName)
    {
        CurrentTenantId = tenantId; CurrentTenantName = tenantName;
        Status = "rented"; UpdatedAt = DateTime.UtcNow;
    }

    public void Vacate() { CurrentTenantId = null; CurrentTenantName = null; Status = "vacant"; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
