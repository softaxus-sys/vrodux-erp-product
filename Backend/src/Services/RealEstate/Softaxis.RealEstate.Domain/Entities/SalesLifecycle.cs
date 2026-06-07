namespace Softaxis.RealEstate.Domain.Entities;

// ── CRM-linked property sales lifecycle ──────────────────────────────────────
// Lead → Site Visit → Reservation → Booking → Payment Plan.
// Each entity carries the CRM Lead/Deal/Customer IDs so the Real Estate pack
// REUSES the core CRM (Leads / Pipeline / Customers) — it never duplicates them.

/// <summary>A scheduled or completed viewing of a property/unit by a CRM lead or customer.</summary>
public sealed class SiteVisit
{
    private SiteVisit() { }
    public SiteVisit(Guid? leadId, Guid? customerId, string customerName, Guid propertyId, Guid? unitId,
        string scheduledAt, string assignedTo, string? notes)
    {
        Id = Guid.NewGuid();
        VisitNumber = $"SV-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..5].ToUpper()}";
        LeadId = leadId; CustomerId = customerId; CustomerName = customerName.Trim();
        PropertyId = propertyId; UnitId = unitId; ScheduledAt = scheduledAt;
        AssignedTo = assignedTo.Trim(); Notes = notes?.Trim(); Status = "scheduled";
        CreatedAt = DateTime.UtcNow;
    }
    public Guid     Id           { get; private set; }
    public string   VisitNumber  { get; private set; } = string.Empty;
    public Guid?    LeadId       { get; private set; }
    public Guid?    CustomerId   { get; private set; }
    public string   CustomerName { get; private set; } = string.Empty;
    public Guid     PropertyId   { get; private set; }
    public Guid?    UnitId       { get; private set; }
    public string   ScheduledAt  { get; private set; } = string.Empty;
    public string   Status       { get; private set; } = "scheduled"; // scheduled | completed | cancelled | no_show
    public string?  Feedback     { get; private set; }
    public string   AssignedTo   { get; private set; } = string.Empty;
    public string?  Notes        { get; private set; }
    public bool     IsDeleted    { get; private set; }
    public DateTime CreatedAt    { get; private set; }
    public DateTime UpdatedAt    { get; private set; } = DateTime.UtcNow;

    public void Complete(string? feedback) { Status = "completed"; Feedback = feedback?.Trim(); UpdatedAt = DateTime.UtcNow; }
    public void SetStatus(string s) { Status = s; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>A unit held for a buyer (token paid) ahead of a confirmed booking.</summary>
public sealed class Reservation
{
    private Reservation() { }
    public Reservation(Guid? leadId, Guid? dealId, Guid? customerId, string customerName,
        Guid propertyId, Guid unitId, string reservationDate, string expiryDate, decimal tokenAmount, string? notes)
    {
        Id = Guid.NewGuid();
        ReservationNumber = $"RES-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..5].ToUpper()}";
        LeadId = leadId; DealId = dealId; CustomerId = customerId; CustomerName = customerName.Trim();
        PropertyId = propertyId; UnitId = unitId; ReservationDate = reservationDate; ExpiryDate = expiryDate;
        TokenAmount = tokenAmount; Notes = notes?.Trim(); Status = "active";
        CreatedAt = DateTime.UtcNow;
    }
    public Guid     Id                { get; private set; }
    public string   ReservationNumber { get; private set; } = string.Empty;
    public Guid?    LeadId            { get; private set; }
    public Guid?    DealId            { get; private set; }
    public Guid?    CustomerId        { get; private set; }
    public string   CustomerName      { get; private set; } = string.Empty;
    public Guid     PropertyId        { get; private set; }
    public Guid     UnitId            { get; private set; }
    public string   ReservationDate   { get; private set; } = string.Empty;
    public string   ExpiryDate        { get; private set; } = string.Empty;
    public decimal  TokenAmount       { get; private set; }
    public string   Status            { get; private set; } = "active"; // active | converted | expired | cancelled
    public string?  Notes             { get; private set; }
    public bool     IsDeleted         { get; private set; }
    public DateTime CreatedAt         { get; private set; }
    public DateTime UpdatedAt         { get; private set; } = DateTime.UtcNow;

    public void SetStatus(string s) { Status = s; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>A confirmed property sale with an installment payment plan and handover tracking.</summary>
public sealed class Booking
{
    private Booking() { }
    public Booking(Guid? dealId, Guid? customerId, string customerName, Guid propertyId, Guid unitId,
        string bookingDate, decimal salePrice, decimal downPayment, int installmentCount, string? broker, string? notes)
    {
        Id = Guid.NewGuid();
        BookingNumber = $"BKG-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..5].ToUpper()}";
        DealId = dealId; CustomerId = customerId; CustomerName = customerName.Trim();
        PropertyId = propertyId; UnitId = unitId; BookingDate = bookingDate;
        SalePrice = salePrice; DownPayment = downPayment; InstallmentCount = installmentCount;
        PaidAmount = downPayment; Broker = broker?.Trim(); Notes = notes?.Trim(); Status = "booked";
        CreatedAt = DateTime.UtcNow;
    }
    public Guid     Id               { get; private set; }
    public string   BookingNumber    { get; private set; } = string.Empty;
    public Guid?    DealId           { get; private set; }
    public Guid?    CustomerId       { get; private set; }
    public string   CustomerName     { get; private set; } = string.Empty;
    public Guid     PropertyId       { get; private set; }
    public Guid     UnitId           { get; private set; }
    public string   BookingDate      { get; private set; } = string.Empty;
    public decimal  SalePrice        { get; private set; }
    public decimal  DownPayment      { get; private set; }
    public int      InstallmentCount { get; private set; }
    public decimal  PaidAmount       { get; private set; }
    public string   Status           { get; private set; } = "booked"; // booked | in_payment | handover | completed | cancelled
    public string?  Broker           { get; private set; }
    public string?  Notes            { get; private set; }
    public bool     IsDeleted        { get; private set; }
    public DateTime CreatedAt        { get; private set; }
    public DateTime UpdatedAt        { get; private set; } = DateTime.UtcNow;

    public decimal Balance          => Math.Max(0, SalePrice - PaidAmount);
    public decimal InstallmentAmount => InstallmentCount > 0 ? Math.Round((SalePrice - DownPayment) / InstallmentCount, 2) : 0;

    public void RecordPayment(decimal amount)
    {
        PaidAmount = Math.Min(SalePrice, PaidAmount + Math.Abs(amount));
        if (Status == "booked") Status = "in_payment";
        if (PaidAmount >= SalePrice && Status != "handover") Status = "handover";
        UpdatedAt = DateTime.UtcNow;
    }
    public void SetStatus(string s) { Status = s; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
