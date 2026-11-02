namespace Softaxis.Fitness.Domain.Entities;

public static class EquipmentStatus
{
    public const string Working = "working", NeedsService = "needs_service", OutOfOrder = "out_of_order", Retired = "retired";
    public static readonly string[] All = [Working, NeedsService, OutOfOrder, Retired];
}

/// <summary>A machine or piece of kit on the floor, with its service history.</summary>
public sealed class Equipment
{
    private Equipment() { }

    public Equipment(string name, Guid branchId) { Id = Guid.NewGuid(); Name = name.Trim(); BranchId = branchId; CreatedAt = DateTime.UtcNow; }

    public Guid    Id                  { get; private set; }
    public string  Name                { get; private set; } = string.Empty;
    public string? Category            { get; private set; }
    public string? Brand               { get; private set; }
    public string? Model               { get; private set; }
    public string? SerialNumber        { get; private set; }
    public Guid    BranchId            { get; private set; }
    public string? Location            { get; private set; }
    public string? PurchasedOn         { get; private set; }
    public decimal PurchaseCost        { get; private set; }
    public string? WarrantyUntil       { get; private set; }
    /// <summary>Days between routine services. 0 = no schedule.</summary>
    public int     ServiceIntervalDays { get; private set; }
    public string? LastServicedOn      { get; private set; }
    public string? NextServiceOn       { get; private set; }
    public string  Status              { get; private set; } = EquipmentStatus.Working;
    public string? Notes               { get; private set; }
    public bool    IsDeleted           { get; private set; }
    public DateTime  CreatedAt         { get; private set; }
    public DateTime? UpdatedAt         { get; private set; }

    public void Update(string name, string? category, string? brand, string? model, string? serial, Guid branchId,
        string? location, string? purchasedOn, decimal cost, string? warrantyUntil, int intervalDays,
        string? nextServiceOn, string status, string? notes)
    {
        Name = name.Trim(); Category = Text.OrNull(category); Brand = Text.OrNull(brand); Model = Text.OrNull(model);
        SerialNumber = Text.OrNull(serial); BranchId = branchId; Location = Text.OrNull(location);
        PurchasedOn = Text.OrNull(purchasedOn); PurchaseCost = cost; WarrantyUntil = Text.OrNull(warrantyUntil);
        ServiceIntervalDays = intervalDays; NextServiceOn = Text.OrNull(nextServiceOn); Status = status;
        Notes = Text.OrNull(notes); UpdatedAt = DateTime.UtcNow;
    }

    public void RecordService(string on, string? nextOn, string status)
    { LastServicedOn = on; NextServiceOn = nextOn; Status = status; UpdatedAt = DateTime.UtcNow; }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public sealed class MaintenanceLog
{
    private MaintenanceLog() { }

    public MaintenanceLog(Guid equipmentId, string date, string type, string description, decimal cost,
        string? performedBy, string statusAfter, string? byName)
    {
        Id = Guid.NewGuid(); EquipmentId = equipmentId; Date = date; Type = type; Description = description.Trim();
        Cost = cost; PerformedBy = Text.OrNull(performedBy); StatusAfter = statusAfter; RecordedByName = byName;
        CreatedAt = DateTime.UtcNow;
    }

    public Guid    Id             { get; private set; }
    public Guid    EquipmentId    { get; private set; }
    public string  Date           { get; private set; } = string.Empty;
    /// <summary>service | repair | inspection | issue</summary>
    public string  Type           { get; private set; } = "service";
    public string  Description    { get; private set; } = string.Empty;
    public decimal Cost           { get; private set; }
    public string? PerformedBy    { get; private set; }
    public string  StatusAfter    { get; private set; } = EquipmentStatus.Working;
    public string? RecordedByName { get; private set; }
    public DateTime CreatedAt     { get; private set; }
}

/// <summary>A locker, either free, rented to a member until a date, or out of use.</summary>
public sealed class Locker
{
    private Locker() { }

    public Locker(string number, Guid branchId) { Id = Guid.NewGuid(); Number = number.Trim(); BranchId = branchId; CreatedAt = DateTime.UtcNow; }

    public Guid    Id            { get; private set; }
    public string  Number        { get; private set; } = string.Empty;
    public Guid    BranchId      { get; private set; }
    public string? Area          { get; private set; }
    public string? Size          { get; private set; }
    public decimal MonthlyRate   { get; private set; }
    public Guid?   MemberId      { get; private set; }
    public string? AssignedFrom  { get; private set; }
    public string? AssignedUntil { get; private set; }
    public bool    OutOfUse      { get; private set; }
    public string? Notes         { get; private set; }
    public bool    IsDeleted     { get; private set; }
    public DateTime  CreatedAt   { get; private set; }
    public DateTime? UpdatedAt   { get; private set; }

    public void Update(string number, string? area, string? size, decimal rate, bool outOfUse, string? notes)
    { Number = number.Trim(); Area = Text.OrNull(area); Size = Text.OrNull(size); MonthlyRate = rate; OutOfUse = outOfUse; Notes = Text.OrNull(notes); UpdatedAt = DateTime.UtcNow; }

    public void Assign(Guid memberId, string from, string? until)
    { MemberId = memberId; AssignedFrom = from; AssignedUntil = Text.OrNull(until); UpdatedAt = DateTime.UtcNow; }

    public void Release() { MemberId = null; AssignedFrom = null; AssignedUntil = null; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public static class LeadStatus
{
    public const string New = "new", Contacted = "contacted", TrialBooked = "trial_booked",
        Visited = "visited", Converted = "converted", Lost = "lost";
    public static readonly string[] All = [New, Contacted, TrialBooked, Visited, Converted, Lost];
}

/// <summary>An enquiry — someone who asked about joining. Kept in the module so a gym does not need CRM.</summary>
public sealed class FitnessLead
{
    private FitnessLead() { }

    public FitnessLead(string name) { Id = Guid.NewGuid(); Name = name.Trim(); CreatedAt = DateTime.UtcNow; }

    public Guid    Id               { get; private set; }
    public string  Name             { get; private set; } = string.Empty;
    public string? Phone            { get; private set; }
    public string? Email            { get; private set; }
    public string? Gender           { get; private set; }
    public string? Source           { get; private set; }
    public string? Interest         { get; private set; }
    public Guid?   BranchId         { get; private set; }
    public Guid?   AssignedToUserId { get; private set; }
    public string? AssignedToName   { get; private set; }
    public string  Status           { get; private set; } = LeadStatus.New;
    public string? TrialDate        { get; private set; }
    public string? FollowUpOn       { get; private set; }
    public string? LostReason       { get; private set; }
    public string? Notes            { get; private set; }
    public Guid?   MemberId         { get; private set; }
    public bool    IsDeleted        { get; private set; }
    public DateTime  CreatedAt      { get; private set; }
    public DateTime? UpdatedAt      { get; private set; }

    public void Update(string name, string? phone, string? email, string? gender, string? source, string? interest,
        Guid? branchId, Guid? assignedToUserId, string? assignedToName, string status, string? trialDate,
        string? followUpOn, string? lostReason, string? notes)
    {
        Name = name.Trim(); Phone = Text.OrNull(phone); Email = Text.OrNull(email); Gender = Text.OrNull(gender);
        Source = Text.OrNull(source); Interest = Text.OrNull(interest); BranchId = branchId;
        AssignedToUserId = assignedToUserId; AssignedToName = Text.OrNull(assignedToName);
        if (Status != LeadStatus.Converted) Status = status;
        TrialDate = Text.OrNull(trialDate); FollowUpOn = Text.OrNull(followUpOn);
        LostReason = Status == LeadStatus.Lost ? Text.OrNull(lostReason) : null; Notes = Text.OrNull(notes);
        UpdatedAt = DateTime.UtcNow;
    }

    public void Convert(Guid memberId) { MemberId = memberId; Status = LeadStatus.Converted; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>Running number used for receipts and member numbers, one row per kind per tenant.</summary>
public sealed class FitnessCounter
{
    private FitnessCounter() { }
    public FitnessCounter(string kind) { Id = Guid.NewGuid(); Kind = kind; }
    public Guid   Id    { get; private set; }
    public string Kind  { get; private set; } = string.Empty;
    public int    Value { get; private set; }
    public int Next() => ++Value;
}
