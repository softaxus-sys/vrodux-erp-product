namespace Softaxis.Farming.Domain.Entities;

/// <summary>
/// An individually tracked animal (cow, buffalo, goat, sheep, beef cattle). Status moves to sold or dead
/// through a sale or a mortality record, so the reason is always on file.
/// </summary>
public sealed class Animal
{
    private Animal() { }
    public Animal(string tag, string type) { Id = Guid.NewGuid(); TagNumber = tag.Trim(); Type = type; CreatedAt = DateTime.UtcNow; }

    public Guid    Id            { get; private set; }
    public string  TagNumber     { get; private set; } = string.Empty;
    public string? Name          { get; private set; }
    public string  Type          { get; private set; } = FarmTypes.Dairy;
    /// <summary>Cow, buffalo, goat, sheep, camel…</summary>
    public string? Species       { get; private set; }
    public string? Breed         { get; private set; }
    /// <summary>female | male</summary>
    public string  Sex           { get; private set; } = "female";
    public string? BirthDate     { get; private set; }
    public Guid?   UnitId        { get; private set; }
    public Guid?   DamId         { get; private set; }
    public Guid?   SireId        { get; private set; }
    /// <summary>born | purchased</summary>
    public string  Source        { get; private set; } = "purchased";
    public string? AcquiredOn    { get; private set; }
    public decimal PurchasePrice { get; private set; }
    public string  Status        { get; private set; } = AnimalStatus.Active;
    public string? StatusDate    { get; private set; }
    public string? StatusReason  { get; private set; }
    public string? Notes         { get; private set; }
    public bool    IsDeleted     { get; private set; }
    public DateTime  CreatedAt   { get; private set; }
    public DateTime? UpdatedAt   { get; private set; }

    public void Update(string tag, string? name, string type, string? species, string? breed, string sex, string? birthDate,
        Guid? unitId, Guid? damId, Guid? sireId, string source, string? acquiredOn, decimal price, string? notes)
    {
        TagNumber = tag.Trim(); Name = Text.OrNull(name); Type = type; Species = Text.OrNull(species); Breed = Text.OrNull(breed);
        Sex = sex; BirthDate = Text.OrNull(birthDate); UnitId = unitId; DamId = damId; SireId = sireId; Source = source;
        AcquiredOn = Text.OrNull(acquiredOn); PurchasePrice = price; Notes = Text.OrNull(notes); UpdatedAt = DateTime.UtcNow;
    }

    public void SetStatus(string status, string? date, string? reason)
    { Status = status; StatusDate = Text.OrNull(date); StatusReason = Text.OrNull(reason); UpdatedAt = DateTime.UtcNow; }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>
/// A group kept as one: a poultry flock, a pond stocking of fish, a crop planting, a set of hives.
/// Head count now = started with − deaths − sold, worked out on read so it cannot drift.
/// </summary>
public sealed class Batch
{
    private Batch() { }
    public Batch(string code, string type) { Id = Guid.NewGuid(); Code = code.Trim(); Type = type; CreatedAt = DateTime.UtcNow; }

    public Guid    Id           { get; private set; }
    public string  Code         { get; private set; } = string.Empty;
    public string  Type         { get; private set; } = FarmTypes.Poultry;
    /// <summary>layers | broilers | tilapia | wheat…</summary>
    public string? Species      { get; private set; }
    public string? Breed        { get; private set; }
    public Guid?   UnitId       { get; private set; }
    public string  StartDate    { get; private set; } = string.Empty;
    /// <summary>Birds, fish, plants or hives at the start. A crop planting may use 0 and track area instead.</summary>
    public int     InitialCount { get; private set; }
    /// <summary>Planted area in acres (crops) — 0 when not relevant.</summary>
    public decimal Area         { get; private set; }
    public decimal InitialCost  { get; private set; }
    public string? ExpectedEndDate { get; private set; }
    /// <summary>active | closed</summary>
    public string  Status       { get; private set; } = "active";
    public string? ClosedOn     { get; private set; }
    public string? Notes        { get; private set; }
    public bool    IsDeleted    { get; private set; }
    public DateTime  CreatedAt  { get; private set; }
    public DateTime? UpdatedAt  { get; private set; }

    public void Update(string code, string type, string? species, string? breed, Guid? unitId, string startDate,
        int initialCount, decimal area, decimal cost, string? expectedEnd, string? notes)
    {
        Code = code.Trim(); Type = type; Species = Text.OrNull(species); Breed = Text.OrNull(breed); UnitId = unitId;
        StartDate = startDate; InitialCount = initialCount; Area = area; InitialCost = cost;
        ExpectedEndDate = Text.OrNull(expectedEnd); Notes = Text.OrNull(notes); UpdatedAt = DateTime.UtcNow;
    }

    public void Close(string on) { Status = "closed"; ClosedOn = on; UpdatedAt = DateTime.UtcNow; }
    public void Reopen() { Status = "active"; ClosedOn = null; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>A service (natural or AI) and what came of it. Pending until a birth or a failure is recorded.</summary>
public sealed class BreedingRecord
{
    private BreedingRecord() { }
    public BreedingRecord(Guid animalId) { Id = Guid.NewGuid(); AnimalId = animalId; CreatedAt = DateTime.UtcNow; }

    public Guid    Id          { get; private set; }
    public Guid    AnimalId    { get; private set; }
    public string  ServiceDate { get; private set; } = string.Empty;
    /// <summary>natural | ai</summary>
    public string  Method      { get; private set; } = "natural";
    public Guid?   SireId      { get; private set; }
    /// <summary>Bull / buck name or semen straw code when the sire is not on file.</summary>
    public string? SireNote    { get; private set; }
    public string? ExpectedOn  { get; private set; }
    /// <summary>pending | born | failed</summary>
    public string  Outcome     { get; private set; } = "pending";
    public string? OutcomeOn   { get; private set; }
    public int     Offspring   { get; private set; }
    public string? Notes       { get; private set; }
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public void Update(string serviceDate, string method, Guid? sireId, string? sireNote, string? expectedOn, string? notes)
    {
        ServiceDate = serviceDate; Method = method; SireId = sireId; SireNote = Text.OrNull(sireNote);
        ExpectedOn = Text.OrNull(expectedOn); Notes = Text.OrNull(notes); UpdatedAt = DateTime.UtcNow;
    }

    public void RecordOutcome(string outcome, string? on, int offspring)
    { Outcome = outcome; OutcomeOn = Text.OrNull(on); Offspring = offspring; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>A weigh-in: one animal, or the average of a sample from a batch.</summary>
public sealed class WeightRecord
{
    private WeightRecord() { }
    public WeightRecord(string date, Guid? animalId, Guid? batchId, decimal weightKg, int sample, string? notes)
    {
        Id = Guid.NewGuid(); Date = date; AnimalId = animalId; BatchId = batchId; WeightKg = weightKg;
        SampleSize = sample < 1 ? 1 : sample; Notes = Text.OrNull(notes); CreatedAt = DateTime.UtcNow;
    }

    public Guid    Id         { get; private set; }
    public string  Date       { get; private set; } = string.Empty;
    public Guid?   AnimalId   { get; private set; }
    public Guid?   BatchId    { get; private set; }
    /// <summary>For a batch, the average weight of the sample.</summary>
    public decimal WeightKg   { get; private set; }
    public int     SampleSize { get; private set; } = 1;
    public string? Notes      { get; private set; }
    public DateTime CreatedAt { get; private set; }
}
