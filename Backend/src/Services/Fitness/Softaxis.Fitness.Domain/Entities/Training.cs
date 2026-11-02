namespace Softaxis.Fitness.Domain.Entities;

/// <summary>A coach or instructor. May be linked to a login so they can see their own schedule.</summary>
public sealed class Trainer
{
    private Trainer() { }

    public Trainer(string name) { Id = Guid.NewGuid(); Name = name.Trim(); CreatedAt = DateTime.UtcNow; }

    public Guid    Id             { get; private set; }
    public string  Name           { get; private set; } = string.Empty;
    public string? Phone          { get; private set; }
    public string? Email          { get; private set; }
    public string? Specialties    { get; private set; }
    public string? Certifications { get; private set; }
    public string? Bio            { get; private set; }
    public Guid?   BranchId       { get; private set; }
    public Guid?   LinkedUserId   { get; private set; }
    /// <summary>Charged to the member for one personal-training session, by default.</summary>
    public decimal SessionRate    { get; private set; }
    /// <summary>Share of PT revenue paid to the trainer, as a percentage.</summary>
    public decimal CommissionPct  { get; private set; }
    public string? PhotoData      { get; private set; }
    public bool    IsActive       { get; private set; } = true;
    public bool    IsDeleted      { get; private set; }
    public DateTime  CreatedAt    { get; private set; }
    public DateTime? UpdatedAt    { get; private set; }

    public void Update(string name, string? phone, string? email, string? specialties, string? certifications,
        string? bio, Guid? branchId, Guid? linkedUserId, decimal sessionRate, decimal commissionPct, bool isActive)
    {
        Name = name.Trim();
        Phone = Text.OrNull(phone);
        Email = Text.OrNull(email);
        Specialties = Text.OrNull(specialties);
        Certifications = Text.OrNull(certifications);
        Bio = Text.OrNull(bio);
        BranchId = branchId;
        LinkedUserId = linkedUserId;
        SessionRate = sessionRate;
        CommissionPct = commissionPct;
        IsActive = isActive;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetPhoto(string? data) { PhotoData = Text.OrNull(data); UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>A kind of class — Yoga, Spin, HIIT. Sessions are scheduled from it.</summary>
public sealed class ClassType
{
    private ClassType() { }

    public ClassType(string name) { Id = Guid.NewGuid(); Name = name.Trim(); CreatedAt = DateTime.UtcNow; }

    public Guid    Id              { get; private set; }
    public string  Name            { get; private set; } = string.Empty;
    public string? Description     { get; private set; }
    public string? Level           { get; private set; }
    public int     DurationMinutes { get; private set; } = 60;
    public int     Capacity        { get; private set; } = 20;
    public string? Color           { get; private set; }
    /// <summary>Credits a booking uses. 0 = free with any active membership.</summary>
    public int     CreditCost      { get; private set; } = 1;
    /// <summary>Price for someone booking without credits (drop-in). 0 = not sold on its own.</summary>
    public decimal DropInPrice     { get; private set; }
    public bool    IsActive        { get; private set; } = true;
    public bool    IsDeleted       { get; private set; }
    public DateTime  CreatedAt     { get; private set; }
    public DateTime? UpdatedAt     { get; private set; }

    public void Update(string name, string? description, string? level, int duration, int capacity, string? color,
        int creditCost, decimal dropInPrice, bool isActive)
    {
        Name = name.Trim();
        Description = Text.OrNull(description);
        Level = Text.OrNull(level);
        DurationMinutes = duration;
        Capacity = capacity;
        Color = Text.OrNull(color);
        CreditCost = creditCost;
        DropInPrice = dropInPrice;
        IsActive = isActive;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public static class SessionStatus
{
    public const string Scheduled = "scheduled", Completed = "completed", Cancelled = "cancelled";
}

/// <summary>One scheduled class on a day and time.</summary>
public sealed class ClassSession
{
    private ClassSession() { }

    public ClassSession(ClassType type, Guid branchId, Guid? trainerId, string date, string startTime, string endTime,
        int capacity, string? room)
    {
        Id = Guid.NewGuid();
        ClassTypeId = type.Id;
        ClassName = type.Name;
        BranchId = branchId;
        TrainerId = trainerId;
        Date = date;
        StartTime = startTime;
        EndTime = endTime;
        Capacity = capacity;
        Room = Text.OrNull(room);
        CreditCost = type.CreditCost;
        CreatedAt = DateTime.UtcNow;
    }

    public Guid    Id          { get; private set; }
    public Guid    ClassTypeId { get; private set; }
    public string  ClassName   { get; private set; } = string.Empty;
    public Guid    BranchId    { get; private set; }
    public Guid?   TrainerId   { get; private set; }
    public string  Date        { get; private set; } = string.Empty;
    /// <summary>"HH:mm" local.</summary>
    public string  StartTime   { get; private set; } = string.Empty;
    public string  EndTime     { get; private set; } = string.Empty;
    public int     Capacity    { get; private set; }
    public int     CreditCost  { get; private set; }
    public string? Room        { get; private set; }
    public string? Notes       { get; private set; }
    public string  Status      { get; private set; } = SessionStatus.Scheduled;
    public string? CancelReason { get; private set; }
    /// <summary>Groups sessions created together from a weekly repeat, so they can be found again.</summary>
    public Guid?   SeriesId    { get; private set; }
    public bool    IsDeleted   { get; private set; }
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public void SetSeries(Guid seriesId) => SeriesId = seriesId;

    public void Update(Guid? trainerId, string date, string start, string end, int capacity, string? room, string? notes)
    {
        TrainerId = trainerId; Date = date; StartTime = start; EndTime = end; Capacity = capacity;
        Room = Text.OrNull(room); Notes = Text.OrNull(notes); UpdatedAt = DateTime.UtcNow;
    }

    public void Complete() { Status = SessionStatus.Completed; UpdatedAt = DateTime.UtcNow; }
    public void Cancel(string? reason) { Status = SessionStatus.Cancelled; CancelReason = Text.OrNull(reason); UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public static class BookingStatus
{
    public const string Booked     = "booked";
    public const string Waitlisted = "waitlisted";
    public const string Attended   = "attended";
    public const string NoShow     = "no_show";
    public const string Cancelled  = "cancelled";
    public const string LateCancel = "late_cancel";
}

public sealed class ClassBooking
{
    private ClassBooking() { }

    public ClassBooking(Guid sessionId, Guid memberId, Guid? subscriptionId, bool waitlisted, int waitlistPosition)
    {
        Id = Guid.NewGuid();
        SessionId = sessionId;
        MemberId = memberId;
        SubscriptionId = subscriptionId;
        Status = waitlisted ? BookingStatus.Waitlisted : BookingStatus.Booked;
        WaitlistPosition = waitlisted ? waitlistPosition : null;
        BookedAt = DateTime.UtcNow;
    }

    public Guid     Id               { get; private set; }
    public Guid     SessionId        { get; private set; }
    public Guid     MemberId         { get; private set; }
    public Guid?    SubscriptionId   { get; private set; }
    public string   Status           { get; private set; } = BookingStatus.Booked;
    public int?     WaitlistPosition { get; private set; }
    /// <summary>A class credit was taken for this booking (so it can be returned on cancel).</summary>
    public bool     CreditUsed       { get; private set; }
    public DateTime BookedAt         { get; private set; }
    public DateTime? CancelledAt     { get; private set; }

    public void MarkCreditUsed(bool used) => CreditUsed = used;
    public void SetSubscription(Guid id) => SubscriptionId = id;
    public void Promote() { Status = BookingStatus.Booked; WaitlistPosition = null; }
    public void Attend() => Status = BookingStatus.Attended;
    public void NoShow() => Status = BookingStatus.NoShow;
    public void Cancel(bool late) { Status = late ? BookingStatus.LateCancel : BookingStatus.Cancelled; WaitlistPosition = null; CancelledAt = DateTime.UtcNow; }
}

/// <summary>A block of personal-training sessions sold to a member with one trainer.</summary>
public sealed class PtPackage
{
    private PtPackage() { }

    public PtPackage(Guid memberId, Guid trainerId, string name, int sessions, decimal price, string startDate,
        string? expiresOn, string? notes)
    {
        Id = Guid.NewGuid();
        MemberId = memberId;
        TrainerId = trainerId;
        Name = name.Trim();
        TotalSessions = sessions;
        Price = price;
        StartDate = startDate;
        ExpiresOn = Text.OrNull(expiresOn);
        Notes = Text.OrNull(notes);
        CreatedAt = DateTime.UtcNow;
    }

    public Guid    Id            { get; private set; }
    public Guid    MemberId      { get; private set; }
    public Guid    TrainerId     { get; private set; }
    public string  Name          { get; private set; } = string.Empty;
    public int     TotalSessions { get; private set; }
    public int     UsedSessions  { get; private set; }
    public int     Remaining     => Math.Max(0, TotalSessions - UsedSessions);
    public decimal Price         { get; private set; }
    public decimal AmountPaid    { get; private set; }
    public decimal Balance       => Math.Max(0, Price - AmountPaid);
    public string  StartDate     { get; private set; } = string.Empty;
    public string? ExpiresOn     { get; private set; }
    public string? Notes         { get; private set; }
    public bool    IsCancelled   { get; private set; }
    public bool    IsDeleted     { get; private set; }
    public DateTime  CreatedAt   { get; private set; }
    public DateTime? UpdatedAt   { get; private set; }

    public void UseSession() { UsedSessions++; UpdatedAt = DateTime.UtcNow; }
    public void ReturnSession() { if (UsedSessions > 0) UsedSessions--; UpdatedAt = DateTime.UtcNow; }
    public void AddPayment(decimal amount) { AmountPaid += amount; UpdatedAt = DateTime.UtcNow; }
    public void RemovePayment(decimal amount) { AmountPaid = Math.Max(0, AmountPaid - amount); UpdatedAt = DateTime.UtcNow; }
    public void Cancel() { IsCancelled = true; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public static class PtSessionStatus
{
    public const string Scheduled = "scheduled", Completed = "completed", NoShow = "no_show", Cancelled = "cancelled";
}

public sealed class PtSession
{
    private PtSession() { }

    public PtSession(Guid packageId, Guid memberId, Guid trainerId, Guid? branchId, string date, string startTime,
        int durationMinutes, string? notes)
    {
        Id = Guid.NewGuid();
        PackageId = packageId;
        MemberId = memberId;
        TrainerId = trainerId;
        BranchId = branchId;
        Date = date;
        StartTime = startTime;
        DurationMinutes = durationMinutes;
        Notes = Text.OrNull(notes);
        CreatedAt = DateTime.UtcNow;
    }

    public Guid    Id              { get; private set; }
    public Guid    PackageId       { get; private set; }
    public Guid    MemberId        { get; private set; }
    public Guid    TrainerId       { get; private set; }
    public Guid?   BranchId        { get; private set; }
    public string  Date            { get; private set; } = string.Empty;
    public string  StartTime       { get; private set; } = string.Empty;
    public int     DurationMinutes { get; private set; }
    public string  Status          { get; private set; } = PtSessionStatus.Scheduled;
    public string? Notes           { get; private set; }
    /// <summary>What was done, written by the trainer afterwards.</summary>
    public string? SessionLog      { get; private set; }
    /// <summary>A package session was taken (complete or no-show) and can be returned on reopen.</summary>
    public bool    Counted         { get; private set; }
    public DateTime  CreatedAt     { get; private set; }
    public DateTime? UpdatedAt     { get; private set; }

    public void Reschedule(string date, string start, int duration, string? notes)
    { Date = date; StartTime = start; DurationMinutes = duration; Notes = Text.OrNull(notes); UpdatedAt = DateTime.UtcNow; }

    public void Close(string status, string? log, bool counted)
    { Status = status; SessionLog = Text.OrNull(log); Counted = counted; UpdatedAt = DateTime.UtcNow; }
}
