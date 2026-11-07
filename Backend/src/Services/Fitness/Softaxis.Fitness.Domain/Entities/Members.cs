namespace Softaxis.Fitness.Domain.Entities;

public static class MemberStatus
{
    public const string Active      = "active";
    public const string Inactive    = "inactive";
    public const string Blacklisted = "blacklisted";
    public static readonly string[] All = [Active, Inactive, Blacklisted];
}

/// <summary>A person who trains here. Their access comes from their subscriptions, not this row.</summary>
public sealed class FitnessMember
{
    private FitnessMember() { }

    public FitnessMember(string memberNumber, string firstName, string? lastName, Guid? homeBranchId, string joinedOn)
    {
        Id = Guid.NewGuid();
        MemberNumber = memberNumber;
        FirstName = firstName.Trim();
        LastName = Text.OrNull(lastName);
        HomeBranchId = homeBranchId;
        JoinedOn = joinedOn;
        CreatedAt = DateTime.UtcNow;
    }

    public Guid    Id               { get; private set; }
    public string  MemberNumber     { get; private set; } = string.Empty;
    public string  FirstName        { get; private set; } = string.Empty;
    public string? LastName         { get; private set; }
    public string  FullName         => string.IsNullOrEmpty(LastName) ? FirstName : $"{FirstName} {LastName}";
    public string? Gender           { get; private set; }
    public string? DateOfBirth      { get; private set; }
    public string? Phone            { get; private set; }
    public string? Email            { get; private set; }
    public string? Address          { get; private set; }
    public string? NationalId       { get; private set; }
    public string? EmergencyName    { get; private set; }
    public string? EmergencyPhone   { get; private set; }
    /// <summary>Injuries, conditions, medication — what a trainer must know before a session.</summary>
    public string? HealthNotes      { get; private set; }
    public string? FitnessGoal      { get; private set; }
    public string? Source           { get; private set; }
    public string? ReferredBy       { get; private set; }
    public string? Notes            { get; private set; }
    /// <summary>Photo as a data URI, shown at the front desk when the member checks in.</summary>
    public string? PhotoData        { get; private set; }
    public Guid?   HomeBranchId     { get; private set; }
    public Guid?   TrainerId        { get; private set; }
    public string  JoinedOn         { get; private set; } = string.Empty;
    public string? WaiverSignedOn   { get; private set; }
    public string  Status           { get; private set; } = MemberStatus.Active;
    public string? StatusReason     { get; private set; }
    public Guid?   LeadId           { get; private set; }
    /// <summary>Hash of the PIN the member signs in to the online portal with. Null = no online access.</summary>
    public string?   PortalPinHash        { get; private set; }
    public int       PortalFailedAttempts { get; private set; }
    /// <summary>Sign-in is refused until this moment after too many wrong PINs.</summary>
    public DateTime? PortalLockedUntil    { get; private set; }
    public bool    IsDeleted        { get; private set; }
    public DateTime  CreatedAt      { get; private set; }
    public DateTime? UpdatedAt      { get; private set; }

    public void Update(string firstName, string? lastName, string? gender, string? dob, string? phone, string? email,
        string? address, string? nationalId, string? emergencyName, string? emergencyPhone, string? healthNotes,
        string? goal, string? source, string? referredBy, string? notes, Guid? homeBranchId, Guid? trainerId,
        string? waiverSignedOn)
    {
        FirstName = firstName.Trim();
        LastName = Text.OrNull(lastName);
        Gender = Text.OrNull(gender);
        DateOfBirth = Text.OrNull(dob);
        Phone = Text.OrNull(phone);
        Email = Text.OrNull(email)?.ToLowerInvariant();
        Address = Text.OrNull(address);
        NationalId = Text.OrNull(nationalId);
        EmergencyName = Text.OrNull(emergencyName);
        EmergencyPhone = Text.OrNull(emergencyPhone);
        HealthNotes = Text.OrNull(healthNotes);
        FitnessGoal = Text.OrNull(goal);
        Source = Text.OrNull(source);
        ReferredBy = Text.OrNull(referredBy);
        Notes = Text.OrNull(notes);
        HomeBranchId = homeBranchId;
        TrainerId = trainerId;
        WaiverSignedOn = Text.OrNull(waiverSignedOn);
        UpdatedAt = DateTime.UtcNow;
    }

    public const int PortalMaxAttempts = 5;
    public const int PortalLockMinutes = 15;

    /// <summary>Sets or replaces the PIN. Any earlier lock is lifted.</summary>
    public void SetPortalPin(string pinHash) { PortalPinHash = pinHash; PortalFailedAttempts = 0; PortalLockedUntil = null; UpdatedAt = DateTime.UtcNow; }
    public void ClearPortalPin() { PortalPinHash = null; PortalFailedAttempts = 0; PortalLockedUntil = null; UpdatedAt = DateTime.UtcNow; }
    public void RecordPortalSuccess() { PortalFailedAttempts = 0; PortalLockedUntil = null; }

    /// <summary>A PIN is short, so guesses are counted: five wrong ones lock sign-in for a while.</summary>
    public void RecordPortalFailure()
    {
        PortalFailedAttempts++;
        if (PortalFailedAttempts >= PortalMaxAttempts) { PortalLockedUntil = DateTime.UtcNow.AddMinutes(PortalLockMinutes); PortalFailedAttempts = 0; }
    }

    public void SetPhoto(string? data) { PhotoData = Text.OrNull(data); UpdatedAt = DateTime.UtcNow; }
    public void SetStatus(string status, string? reason) { Status = status; StatusReason = Text.OrNull(reason); UpdatedAt = DateTime.UtcNow; }
    public void LinkLead(Guid leadId) => LeadId = leadId;
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public static class SubscriptionStatus
{
    /// <summary>Paid for or on credit, and running (or starting in the future).</summary>
    public const string Active    = "active";
    public const string Frozen    = "frozen";
    public const string Cancelled = "cancelled";
    // "expired" and "upcoming" are derived from the dates, never stored.
}

/// <summary>
/// One membership sold to a member. Copies the plan's figures at the time of sale, so later plan
/// changes never rewrite what was bought.
/// </summary>
public sealed class Subscription
{
    private Subscription() { }

    public Subscription(Guid memberId, MembershipPlan plan, Guid? branchId, string startDate, decimal price,
        decimal discount, decimal joiningFee, Guid? renewedFromId, Guid? soldByUserId, string? soldByName, string? notes)
    {
        Id = Guid.NewGuid();
        MemberId = memberId;
        PlanId = plan.Id;
        PlanName = plan.Name;
        Category = plan.Category;
        BranchId = branchId;
        StartDate = startDate;
        DurationDays = plan.DurationDays;
        Price = price;
        Discount = discount;
        JoiningFee = joiningFee;
        ClassCredits = plan.ClassCredits;
        ClassCreditsLeft = plan.ClassCredits;
        PtSessionsLeft = plan.PtSessions;
        VisitsPerDay = plan.VisitsPerDay;
        TotalVisits = plan.TotalVisits;
        AllowFreeze = plan.AllowFreeze;
        MaxFreezeDays = plan.MaxFreezeDays;
        GuestPassesLeft = plan.GuestPasses;
        AllBranches = plan.AllBranches;
        AccessFrom = plan.AccessFrom;
        AccessUntil = plan.AccessUntil;
        RenewedFromId = renewedFromId;
        SoldByUserId = soldByUserId;
        SoldByName = soldByName;
        Notes = notes;
        CreatedAt = DateTime.UtcNow;
    }

    public Guid    Id               { get; private set; }
    public Guid    MemberId         { get; private set; }
    public Guid    PlanId           { get; private set; }
    public string  PlanName         { get; private set; } = string.Empty;
    public string  Category         { get; private set; } = PlanCategory.Gym;
    public Guid?   BranchId         { get; private set; }
    public string  StartDate        { get; private set; } = string.Empty;
    /// <summary>Last day the member may train. Set by the handler (start + duration − 1, plus days frozen).</summary>
    public string  EndDate          { get; private set; } = string.Empty;
    public int     DurationDays     { get; private set; }
    public decimal Price            { get; private set; }
    public decimal Discount         { get; private set; }
    public decimal JoiningFee       { get; private set; }
    public decimal Total            => Math.Max(0, Price - Discount) + JoiningFee;
    public decimal AmountPaid       { get; private set; }
    public decimal Balance          => Math.Max(0, Total - AmountPaid);
    public int?    ClassCredits     { get; private set; }
    public int?    ClassCreditsLeft { get; private set; }
    public int     PtSessionsLeft   { get; private set; }
    public int?    VisitsPerDay     { get; private set; }
    public int?    TotalVisits      { get; private set; }
    public int     VisitsUsed       { get; private set; }
    public bool    AllowFreeze      { get; private set; }
    public int     MaxFreezeDays    { get; private set; }
    public int     FreezeDaysUsed   { get; private set; }
    public int     GuestPassesLeft  { get; private set; }
    public bool    AllBranches      { get; private set; }
    public string? AccessFrom       { get; private set; }
    public string? AccessUntil      { get; private set; }
    public string  Status           { get; private set; } = SubscriptionStatus.Active;
    public string? FrozenFrom       { get; private set; }
    public string? CancelledOn      { get; private set; }
    public string? CancelReason     { get; private set; }
    public Guid?   RenewedFromId    { get; private set; }
    public Guid?   SoldByUserId     { get; private set; }
    public string? SoldByName       { get; private set; }
    public string? Notes            { get; private set; }
    public bool    IsDeleted        { get; private set; }
    public DateTime  CreatedAt      { get; private set; }
    public DateTime? UpdatedAt      { get; private set; }

    public void SetEndDate(string endDate) { EndDate = endDate; UpdatedAt = DateTime.UtcNow; }
    public void AddPayment(decimal amount) { AmountPaid += amount; UpdatedAt = DateTime.UtcNow; }
    public void RemovePayment(decimal amount) { AmountPaid = Math.Max(0, AmountPaid - amount); UpdatedAt = DateTime.UtcNow; }
    public void RecordVisit() => VisitsUsed++;
    public void UseClassCredit() { if (ClassCreditsLeft is > 0) ClassCreditsLeft--; }
    public void ReturnClassCredit() { if (ClassCreditsLeft is not null && ClassCreditsLeft < ClassCredits) ClassCreditsLeft++; }
    public void UseGuestPass() { if (GuestPassesLeft > 0) GuestPassesLeft--; }
    public void AdjustPtSessions(int delta) => PtSessionsLeft = Math.Max(0, PtSessionsLeft + delta);

    public void Freeze(string from) { Status = SubscriptionStatus.Frozen; FrozenFrom = from; UpdatedAt = DateTime.UtcNow; }

    /// <summary>Ends a freeze. The days frozen are added to the end date by the caller.</summary>
    public void Unfreeze(int daysFrozen, string newEndDate)
    {
        Status = SubscriptionStatus.Active;
        FrozenFrom = null;
        FreezeDaysUsed += daysFrozen;
        EndDate = newEndDate;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Cancel(string on, string? reason)
    {
        Status = SubscriptionStatus.Cancelled;
        CancelledOn = on;
        CancelReason = Text.OrNull(reason);
        FrozenFrom = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ChangeDiscount(decimal discount) { Discount = discount; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>History of every freeze, so "days frozen" can be checked against the plan's limit.</summary>
public sealed class FreezePeriod
{
    private FreezePeriod() { }
    public FreezePeriod(Guid subscriptionId, string from, string? reason)
    { Id = Guid.NewGuid(); SubscriptionId = subscriptionId; FromDate = from; Reason = Text.OrNull(reason); CreatedAt = DateTime.UtcNow; }

    public Guid    Id             { get; private set; }
    public Guid    SubscriptionId { get; private set; }
    public string  FromDate       { get; private set; } = string.Empty;
    public string? ToDate         { get; private set; }
    public int     Days           { get; private set; }
    public string? Reason         { get; private set; }
    public DateTime CreatedAt     { get; private set; }

    public void End(string to, int days) { ToDate = to; Days = days; }
}

public static class PaymentMethods
{
    public const string Cash = "cash", Card = "card", Bank = "bank_transfer", Online = "online", Cheque = "cheque", Other = "other";
    public static readonly string[] All = [Cash, Card, Bank, Online, Cheque, Other];
}

/// <summary>Money taken from a member. Voided, never deleted, so the till always reconciles.</summary>
public sealed class FitnessPayment
{
    private FitnessPayment() { }

    public FitnessPayment(string receiptNumber, Guid memberId, Guid? subscriptionId, Guid? ptPackageId, Guid? branchId,
        decimal amount, string method, string paidOn, string? reference, string? notes, Guid? byUserId, string? byName)
    {
        Id = Guid.NewGuid();
        ReceiptNumber = receiptNumber;
        MemberId = memberId;
        SubscriptionId = subscriptionId;
        PtPackageId = ptPackageId;
        BranchId = branchId;
        Amount = amount;
        Method = method;
        PaidOn = paidOn;
        Reference = Text.OrNull(reference);
        Notes = Text.OrNull(notes);
        ReceivedByUserId = byUserId;
        ReceivedByName = byName;
        CreatedAt = DateTime.UtcNow;
    }

    public Guid    Id               { get; private set; }
    public string  ReceiptNumber    { get; private set; } = string.Empty;
    public Guid    MemberId         { get; private set; }
    public Guid?   SubscriptionId   { get; private set; }
    public Guid?   PtPackageId      { get; private set; }
    public Guid?   BranchId         { get; private set; }
    public decimal Amount           { get; private set; }
    public string  Method           { get; private set; } = PaymentMethods.Cash;
    public string  PaidOn           { get; private set; } = string.Empty;
    public string? Reference        { get; private set; }
    public string? Notes            { get; private set; }
    public Guid?   ReceivedByUserId { get; private set; }
    public string? ReceivedByName   { get; private set; }
    public bool    IsVoided         { get; private set; }
    public string? VoidReason       { get; private set; }
    public string? VoidedByName     { get; private set; }
    public DateTime? VoidedAt       { get; private set; }
    public DateTime  CreatedAt      { get; private set; }

    public void Void(string reason, string? byName)
    { IsVoided = true; VoidReason = reason.Trim(); VoidedByName = byName; VoidedAt = DateTime.UtcNow; }
}

/// <summary>One visit through the door — or a refused attempt, kept so the desk can see why.</summary>
public sealed class CheckIn
{
    private CheckIn() { }

    public CheckIn(Guid memberId, Guid? subscriptionId, Guid branchId, string date, DateTime at, bool allowed,
        string? denyReason, string method, bool isGuest, string? guestName, Guid? byUserId, string? byName)
    {
        Id = Guid.NewGuid();
        MemberId = memberId;
        SubscriptionId = subscriptionId;
        BranchId = branchId;
        Date = date;
        CheckedInAt = at;
        Allowed = allowed;
        DenyReason = denyReason;
        Method = method;
        IsGuest = isGuest;
        GuestName = Text.OrNull(guestName);
        RecordedByUserId = byUserId;
        RecordedByName = byName;
    }

    public Guid      Id               { get; private set; }
    public Guid      MemberId         { get; private set; }
    public Guid?     SubscriptionId   { get; private set; }
    public Guid      BranchId         { get; private set; }
    /// <summary>Local calendar day of the visit ("yyyy-MM-dd").</summary>
    public string    Date             { get; private set; } = string.Empty;
    public DateTime  CheckedInAt      { get; private set; }
    public DateTime? CheckedOutAt     { get; private set; }
    public bool      Allowed          { get; private set; }
    public string?   DenyReason       { get; private set; }
    /// <summary>desk | card | qr | manual</summary>
    public string    Method           { get; private set; } = "desk";
    public bool      IsGuest          { get; private set; }
    public string?   GuestName        { get; private set; }
    public Guid?     RecordedByUserId { get; private set; }
    public string?   RecordedByName   { get; private set; }

    public void CheckOut(DateTime at) => CheckedOutAt = at;
}

/// <summary>Body measurements taken on a day. BMI is worked out from weight and height.</summary>
public sealed class BodyMeasurement
{
    private BodyMeasurement() { }

    public BodyMeasurement(Guid memberId, string measuredOn, Guid? byTrainerId)
    { Id = Guid.NewGuid(); MemberId = memberId; MeasuredOn = measuredOn; TrainerId = byTrainerId; CreatedAt = DateTime.UtcNow; }

    public Guid     Id            { get; private set; }
    public Guid     MemberId      { get; private set; }
    public Guid?    TrainerId     { get; private set; }
    public string   MeasuredOn    { get; private set; } = string.Empty;
    public decimal? WeightKg      { get; private set; }
    public decimal? HeightCm      { get; private set; }
    public decimal? BodyFatPct    { get; private set; }
    public decimal? MuscleMassKg  { get; private set; }
    public decimal? ChestCm       { get; private set; }
    public decimal? WaistCm       { get; private set; }
    public decimal? HipsCm        { get; private set; }
    public decimal? ArmCm         { get; private set; }
    public decimal? ThighCm       { get; private set; }
    public int?     RestingHeartRate { get; private set; }
    public string?  BloodPressure { get; private set; }
    public string?  Notes         { get; private set; }
    public decimal? Bmi => WeightKg is > 0 && HeightCm is > 0
        ? Math.Round(WeightKg.Value / ((HeightCm.Value / 100m) * (HeightCm.Value / 100m)), 1)
        : null;
    public DateTime CreatedAt     { get; private set; }

    public void Update(string measuredOn, decimal? weight, decimal? height, decimal? fat, decimal? muscle, decimal? chest,
        decimal? waist, decimal? hips, decimal? arm, decimal? thigh, int? rhr, string? bp, string? notes)
    {
        MeasuredOn = measuredOn;
        WeightKg = weight; HeightCm = height; BodyFatPct = fat; MuscleMassKg = muscle;
        ChestCm = chest; WaistCm = waist; HipsCm = hips; ArmCm = arm; ThighCm = thigh;
        RestingHeartRate = rhr; BloodPressure = Text.OrNull(bp); Notes = Text.OrNull(notes);
    }
}

public static class ProgramType
{
    public const string Workout = "workout";
    public const string Diet    = "diet";
    public static readonly string[] All = [Workout, Diet];
}

/// <summary>
/// A workout or diet plan. Templates have no member; assigning one copies it onto the member so
/// later edits to the template do not change a plan already handed out.
/// </summary>
public sealed class FitnessProgram
{
    private FitnessProgram() { }

    public FitnessProgram(string type, string name) { Id = Guid.NewGuid(); Type = type; Name = name.Trim(); CreatedAt = DateTime.UtcNow; }

    public Guid    Id          { get; private set; }
    public string  Type        { get; private set; } = ProgramType.Workout;
    public string  Name        { get; private set; } = string.Empty;
    public string? Goal        { get; private set; }
    public string? Level       { get; private set; }
    public int?    Weeks       { get; private set; }
    public string? Description { get; private set; }
    /// <summary>JSON array of program lines (day, exercise/meal, sets, reps, rest, notes...). Shape is the client's.</summary>
    public string  ItemsJson   { get; private set; } = "[]";
    public Guid?   MemberId    { get; private set; }
    public Guid?   TrainerId   { get; private set; }
    public Guid?   TemplateId  { get; private set; }
    public string? StartDate   { get; private set; }
    public bool    IsActive    { get; private set; } = true;
    public bool    IsDeleted   { get; private set; }
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public void Update(string name, string? goal, string? level, int? weeks, string? description, string itemsJson,
        Guid? trainerId, string? startDate, bool isActive)
    {
        Name = name.Trim();
        Goal = Text.OrNull(goal);
        Level = Text.OrNull(level);
        Weeks = weeks;
        Description = Text.OrNull(description);
        ItemsJson = string.IsNullOrWhiteSpace(itemsJson) ? "[]" : itemsJson;
        TrainerId = trainerId;
        StartDate = Text.OrNull(startDate);
        IsActive = isActive;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetMember(Guid? memberId) => MemberId = memberId;
    public FitnessProgram AssignTo(Guid memberId, Guid? trainerId, string startDate)
    {
        var copy = new FitnessProgram(Type, Name) { MemberId = memberId, TemplateId = Id };
        copy.Update(Name, Goal, Level, Weeks, Description, ItemsJson, trainerId ?? TrainerId, startDate, true);
        return copy;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
