namespace Softaxis.Farming.Domain.Entities;

/// <summary>
/// Anything the farm produced on a day: litres of milk (per milking), eggs collected, fish harvested,
/// honey, wool, crop yield. Tied to an animal, a batch, or just a unit.
/// </summary>
public sealed class ProductionRecord
{
    private ProductionRecord() { }
    public ProductionRecord(string? byName) { Id = Guid.NewGuid(); RecordedByName = byName; CreatedAt = DateTime.UtcNow; }

    public Guid    Id          { get; private set; }
    public string  Date        { get; private set; } = string.Empty;
    public string  Type        { get; private set; } = FarmTypes.Dairy;
    public string  Product     { get; private set; } = FarmProducts.Milk;
    public decimal Quantity    { get; private set; }
    /// <summary>L, kg, pcs, trays, crates…</summary>
    public string  Uom         { get; private set; } = "L";
    /// <summary>morning | midday | evening — milkings and egg collections. Optional.</summary>
    public string? Session     { get; private set; }
    /// <summary>Grade or quality note: A, B, cracked, fat %…</summary>
    public string? Grade       { get; private set; }
    /// <summary>Spoiled / rejected quantity, already excluded from <see cref="Quantity"/>.</summary>
    public decimal Rejected    { get; private set; }
    public Guid?   AnimalId    { get; private set; }
    public Guid?   BatchId     { get; private set; }
    public Guid?   UnitId      { get; private set; }
    public string? Notes       { get; private set; }
    public string? RecordedByName { get; private set; }
    public bool    IsDeleted   { get; private set; }
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public void Update(string date, string type, string product, decimal qty, string uom, string? session, string? grade,
        decimal rejected, Guid? animalId, Guid? batchId, Guid? unitId, string? notes)
    {
        Date = date; Type = type; Product = product; Quantity = qty; Uom = uom.Trim(); Session = Text.OrNull(session);
        Grade = Text.OrNull(grade); Rejected = rejected; AnimalId = animalId; BatchId = batchId; UnitId = unitId;
        Notes = Text.OrNull(notes); UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>Feed (or fertiliser for crops) given on a day, with its cost.</summary>
public sealed class FeedRecord
{
    private FeedRecord() { }
    public FeedRecord(string? byName) { Id = Guid.NewGuid(); RecordedByName = byName; CreatedAt = DateTime.UtcNow; }

    public Guid    Id        { get; private set; }
    public string  Date      { get; private set; } = string.Empty;
    public string  FeedName  { get; private set; } = string.Empty;
    public decimal Quantity  { get; private set; }
    public string  Uom       { get; private set; } = "kg";
    public decimal Cost      { get; private set; }
    public Guid?   AnimalId  { get; private set; }
    public Guid?   BatchId   { get; private set; }
    public Guid?   UnitId    { get; private set; }
    public string? Notes     { get; private set; }
    public string? RecordedByName { get; private set; }
    public bool    IsDeleted { get; private set; }
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public void Update(string date, string feed, decimal qty, string uom, decimal cost, Guid? animalId, Guid? batchId,
        Guid? unitId, string? notes)
    {
        Date = date; FeedName = feed.Trim(); Quantity = qty; Uom = uom.Trim(); Cost = cost; AnimalId = animalId;
        BatchId = batchId; UnitId = unitId; Notes = Text.OrNull(notes); UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>Vaccination, treatment, deworming or check-up. A next-due date puts it on the reminders list.</summary>
public sealed class HealthRecord
{
    private HealthRecord() { }
    public HealthRecord(string? byName) { Id = Guid.NewGuid(); RecordedByName = byName; CreatedAt = DateTime.UtcNow; }

    public Guid    Id        { get; private set; }
    public string  Date      { get; private set; } = string.Empty;
    /// <summary>vaccination | treatment | deworming | checkup | other</summary>
    public string  Kind      { get; private set; } = "vaccination";
    public string  Title     { get; private set; } = string.Empty;
    public string? Medicine  { get; private set; }
    public string? Dose      { get; private set; }
    public string? VetName   { get; private set; }
    public decimal Cost      { get; private set; }
    public string? NextDueOn { get; private set; }
    /// <summary>Days milk or meat must not be sold after a treatment.</summary>
    public int     WithdrawalDays { get; private set; }
    public Guid?   AnimalId  { get; private set; }
    public Guid?   BatchId   { get; private set; }
    public string? Notes     { get; private set; }
    public string? RecordedByName { get; private set; }
    public bool    IsDeleted { get; private set; }
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public void Update(string date, string kind, string title, string? medicine, string? dose, string? vet, decimal cost,
        string? nextDue, int withdrawal, Guid? animalId, Guid? batchId, string? notes)
    {
        Date = date; Kind = kind; Title = title.Trim(); Medicine = Text.OrNull(medicine); Dose = Text.OrNull(dose);
        VetName = Text.OrNull(vet); Cost = cost; NextDueOn = Text.OrNull(nextDue); WithdrawalDays = withdrawal;
        AnimalId = animalId; BatchId = batchId; Notes = Text.OrNull(notes); UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>The follow-up was done (or is no longer needed): it leaves the reminders list.</summary>
    public void ClearDue() { NextDueOn = null; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>Deaths: one animal, or a number from a batch.</summary>
public sealed class MortalityRecord
{
    private MortalityRecord() { }
    public MortalityRecord(string date, Guid? animalId, Guid? batchId, int count, string? cause, string? notes, string? byName)
    {
        Id = Guid.NewGuid(); Date = date; AnimalId = animalId; BatchId = batchId; Count = count; Cause = Text.OrNull(cause);
        Notes = Text.OrNull(notes); RecordedByName = byName; CreatedAt = DateTime.UtcNow;
    }

    public Guid    Id        { get; private set; }
    public string  Date      { get; private set; } = string.Empty;
    public Guid?   AnimalId  { get; private set; }
    public Guid?   BatchId   { get; private set; }
    public int     Count     { get; private set; }
    public string? Cause     { get; private set; }
    public string? Notes     { get; private set; }
    public string? RecordedByName { get; private set; }
    public bool    IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; }

    public void Delete() => IsDeleted = true;
}

/// <summary>
/// A sale: milk to a collector, eggs, fish by the kg, live animals, crop. Selling an animal marks it sold;
/// selling head from a batch lowers its count.
/// </summary>
public sealed class FarmSale
{
    private FarmSale() { }
    public FarmSale(string? byName) { Id = Guid.NewGuid(); RecordedByName = byName; CreatedAt = DateTime.UtcNow; }

    public Guid    Id          { get; private set; }
    public string  Date        { get; private set; } = string.Empty;
    public string  Type        { get; private set; } = FarmTypes.Dairy;
    public string  Product     { get; private set; } = FarmProducts.Milk;
    public string? Buyer       { get; private set; }
    public string? BuyerPhone  { get; private set; }
    public decimal Quantity    { get; private set; }
    public string  Uom         { get; private set; } = "L";
    public decimal UnitPrice   { get; private set; }
    public decimal Total       => Math.Round(Quantity * UnitPrice, 2);
    public decimal AmountPaid  { get; private set; }
    public decimal Balance     => Math.Max(0, Total - AmountPaid);
    public Guid?   AnimalId    { get; private set; }
    public Guid?   BatchId     { get; private set; }
    /// <summary>Live head taken out of a batch by this sale (0 for produce).</summary>
    public int     HeadCount   { get; private set; }
    public string? Notes       { get; private set; }
    public string? RecordedByName { get; private set; }
    public bool    IsDeleted   { get; private set; }
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public void Update(string date, string type, string product, string? buyer, string? phone, decimal qty, string uom,
        decimal price, decimal paid, Guid? animalId, Guid? batchId, int head, string? notes)
    {
        Date = date; Type = type; Product = product; Buyer = Text.OrNull(buyer); BuyerPhone = Text.OrNull(phone);
        Quantity = qty; Uom = uom.Trim(); UnitPrice = price; AmountPaid = paid; AnimalId = animalId; BatchId = batchId;
        HeadCount = head; Notes = Text.OrNull(notes); UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>Costs other than feed and vet: labour, power, rent, equipment, transport, purchases of stock.</summary>
public sealed class FarmExpense
{
    private FarmExpense() { }
    public FarmExpense(string? byName) { Id = Guid.NewGuid(); RecordedByName = byName; CreatedAt = DateTime.UtcNow; }

    public Guid    Id          { get; private set; }
    public string  Date        { get; private set; } = string.Empty;
    public string  Category    { get; private set; } = "other";
    public string  Description { get; private set; } = string.Empty;
    public decimal Amount      { get; private set; }
    public string? Type        { get; private set; }
    public Guid?   UnitId      { get; private set; }
    public Guid?   BatchId     { get; private set; }
    public string? PaidTo      { get; private set; }
    public string? RecordedByName { get; private set; }
    public bool    IsDeleted   { get; private set; }
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public void Update(string date, string category, string description, decimal amount, string? type, Guid? unitId,
        Guid? batchId, string? paidTo)
    {
        Date = date; Category = category.Trim(); Description = description.Trim(); Amount = amount; Type = Text.OrNull(type);
        UnitId = unitId; BatchId = batchId; PaidTo = Text.OrNull(paidTo); UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
