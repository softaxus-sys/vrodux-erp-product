namespace Softaxis.Farming.Domain.Entities;

/// <summary>
/// The kinds of farming a workspace runs. One module covers them all: each farm unit has a type, and the
/// screens and default products follow from it. Every type is on for a new workspace.
/// </summary>
public static class FarmTypes
{
    public const string Dairy = "dairy", Poultry = "poultry", Fish = "fish", GoatSheep = "goat_sheep",
        Cattle = "cattle", Crops = "crops", Beekeeping = "beekeeping", Other = "other";

    public static readonly string[] All = [Dairy, Poultry, Fish, GoatSheep, Cattle, Crops, Beekeeping, Other];

    /// <summary>Types kept as named individuals (ear tags). The rest are kept as batches (flocks, ponds, plantings).</summary>
    public static readonly string[] Individual = [Dairy, GoatSheep, Cattle];

    /// <summary>Days from service to birth when the user gives no expected date.</summary>
    public static int GestationDays(string type, string? species) => type switch
    {
        Dairy or Cattle => 283,
        GoatSheep => species?.Trim().ToLowerInvariant() is "sheep" ? 147 : 150,
        _ => 0,
    };
}

public static class FarmProducts
{
    public const string Milk = "milk", Eggs = "eggs", Fish = "fish", Meat = "meat", Wool = "wool",
        Honey = "honey", Crop = "crop", Manure = "manure", Animals = "animals", Other = "other";

    public static readonly string[] All = [Milk, Eggs, Fish, Meat, Wool, Honey, Crop, Manure, Animals, Other];
}

public static class AnimalStatus
{
    public const string Active = "active", Sold = "sold", Dead = "dead", Culled = "culled";
    public static readonly string[] All = [Active, Sold, Dead, Culled];
}

/// <summary>One row per workspace: which farm types are switched on. Created on first read.</summary>
public sealed class FarmSettings
{
    private FarmSettings() { }

    public static FarmSettings CreateDefault() => new()
    {
        Id = Guid.NewGuid(), EnabledTypes = string.Join(',', FarmTypes.All), CreatedAt = DateTime.UtcNow,
    };

    public Guid    Id           { get; private set; }
    /// <summary>Comma-separated <see cref="FarmTypes"/>.</summary>
    public string  EnabledTypes { get; private set; } = string.Empty;
    public string? MilkUnit     { get; private set; } = "L";
    public DateTime  CreatedAt  { get; private set; }
    public DateTime? UpdatedAt  { get; private set; }

    public IReadOnlyList<string> Types =>
        EnabledTypes.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    public void Update(IEnumerable<string> types, string? milkUnit)
    {
        EnabledTypes = string.Join(',', types.Where(FarmTypes.All.Contains).Distinct());
        MilkUnit = Text.OrNull(milkUnit) ?? "L";
        UpdatedAt = DateTime.UtcNow;
    }
}

/// <summary>A farm site. Most workspaces have one; a group can run several.</summary>
public sealed class Farm
{
    private Farm() { }
    public Farm(string name) { Id = Guid.NewGuid(); Name = name.Trim(); CreatedAt = DateTime.UtcNow; }

    public Guid    Id        { get; private set; }
    public string  Name      { get; private set; } = string.Empty;
    public string? Location  { get; private set; }
    public decimal AreaAcres { get; private set; }
    public string? Manager   { get; private set; }
    public string? Phone     { get; private set; }
    public string? Notes     { get; private set; }
    public bool    IsDeleted { get; private set; }
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public void Update(string name, string? location, decimal area, string? manager, string? phone, string? notes)
    {
        Name = name.Trim(); Location = Text.OrNull(location); AreaAcres = area; Manager = Text.OrNull(manager);
        Phone = Text.OrNull(phone); Notes = Text.OrNull(notes); UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>A shed, barn, pen, pond, tank, field or apiary on a farm.</summary>
public sealed class FarmUnit
{
    private FarmUnit() { }
    public FarmUnit(Guid farmId, string name, string type)
    { Id = Guid.NewGuid(); FarmId = farmId; Name = name.Trim(); Type = type; CreatedAt = DateTime.UtcNow; }

    public Guid    Id        { get; private set; }
    public Guid    FarmId    { get; private set; }
    public string  Name      { get; private set; } = string.Empty;
    public string  Type      { get; private set; } = FarmTypes.Other;
    /// <summary>shed | barn | pen | pond | tank | field | greenhouse | apiary | other</summary>
    public string  Kind      { get; private set; } = "shed";
    /// <summary>Head capacity (animals, birds, fish) or area in acres for a field.</summary>
    public decimal Capacity  { get; private set; }
    public string? Notes     { get; private set; }
    public bool    IsActive  { get; private set; } = true;
    public bool    IsDeleted { get; private set; }
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public void Update(Guid farmId, string name, string type, string kind, decimal capacity, string? notes, bool active)
    {
        FarmId = farmId; Name = name.Trim(); Type = type; Kind = Text.OrNull(kind) ?? "shed"; Capacity = capacity;
        Notes = Text.OrNull(notes); IsActive = active; UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

internal static class Text
{
    public static string? OrNull(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
