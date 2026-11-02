namespace Softaxis.Fitness.Domain.Entities;

/// <summary>A gym location. Members check in at a branch; classes, equipment and lockers belong to one.</summary>
public sealed class FitnessBranch
{
    private FitnessBranch() { }

    public FitnessBranch(string name, string? code, string? address, string? phone, string? email,
        string? openingTime, string? closingTime, int? capacity)
    {
        Id = Guid.NewGuid();
        CreatedAt = DateTime.UtcNow;
        Update(name, code, address, phone, email, openingTime, closingTime, capacity, true);
    }

    public Guid    Id          { get; private set; }
    public string  Name        { get; private set; } = string.Empty;
    public string? Code        { get; private set; }
    public string? Address     { get; private set; }
    public string? Phone       { get; private set; }
    public string? Email       { get; private set; }
    /// <summary>"HH:mm", local time. Informational; check-in is not refused outside these hours.</summary>
    public string? OpeningTime { get; private set; }
    public string? ClosingTime { get; private set; }
    /// <summary>How many people the floor holds. Used for the "in the gym now" gauge.</summary>
    public int?    Capacity    { get; private set; }
    public bool    IsActive    { get; private set; } = true;
    public bool    IsDeleted   { get; private set; }
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public void Update(string name, string? code, string? address, string? phone, string? email,
        string? openingTime, string? closingTime, int? capacity, bool isActive)
    {
        Name = name.Trim();
        Code = Text.OrNull(code);
        Address = Text.OrNull(address);
        Phone = Text.OrNull(phone);
        Email = Text.OrNull(email);
        OpeningTime = Text.OrNull(openingTime);
        ClosingTime = Text.OrNull(closingTime);
        Capacity = capacity is > 0 ? capacity : null;
        IsActive = isActive;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public static class PlanCategory
{
    public const string Gym      = "gym";
    public const string Classes  = "classes";
    public const string Combo    = "combo";
    public const string Personal = "personal_training";
    public const string DayPass  = "day_pass";
    public static readonly string[] All = [Gym, Classes, Combo, Personal, DayPass];
}

/// <summary>
/// What a member buys. A subscription copies the plan's figures when it is sold, so changing a plan
/// later never alters what an existing member already paid for.
/// </summary>
public sealed class MembershipPlan
{
    private MembershipPlan() { }

    public MembershipPlan(string name) { Id = Guid.NewGuid(); Name = name.Trim(); CreatedAt = DateTime.UtcNow; }

    public Guid    Id              { get; private set; }
    public string  Name            { get; private set; } = string.Empty;
    public string? Code            { get; private set; }
    public string? Description     { get; private set; }
    public string  Category        { get; private set; } = PlanCategory.Gym;
    /// <summary>Length of the membership in days (30 = monthly). A day pass is 1.</summary>
    public int     DurationDays    { get; private set; } = 30;
    public decimal Price           { get; private set; }
    public decimal JoiningFee      { get; private set; }
    /// <summary>Classes included. Null = unlimited, 0 = none.</summary>
    public int?    ClassCredits    { get; private set; }
    /// <summary>Personal-training sessions included with the plan.</summary>
    public int     PtSessions      { get; private set; }
    /// <summary>Visits allowed per day. Null = unlimited.</summary>
    public int?    VisitsPerDay    { get; private set; }
    /// <summary>Total visits over the whole membership (a "10-visit card"). Null = unlimited.</summary>
    public int?    TotalVisits     { get; private set; }
    public bool    AllowFreeze     { get; private set; } = true;
    public int     MaxFreezeDays   { get; private set; } = 30;
    public int     GuestPasses     { get; private set; }
    /// <summary>When false, the member may only check in at their home branch.</summary>
    public bool    AllBranches     { get; private set; } = true;
    /// <summary>"HH:mm" off-peak window. Null = any time.</summary>
    public string? AccessFrom      { get; private set; }
    public string? AccessUntil     { get; private set; }
    public bool    IsActive        { get; private set; } = true;
    public bool    IsDeleted       { get; private set; }
    public DateTime  CreatedAt     { get; private set; }
    public DateTime? UpdatedAt     { get; private set; }

    public void Update(string name, string? code, string? description, string category, int durationDays,
        decimal price, decimal joiningFee, int? classCredits, int ptSessions, int? visitsPerDay, int? totalVisits,
        bool allowFreeze, int maxFreezeDays, int guestPasses, bool allBranches, string? accessFrom,
        string? accessUntil, bool isActive)
    {
        Name = name.Trim();
        Code = Text.OrNull(code);
        Description = Text.OrNull(description);
        Category = category;
        DurationDays = durationDays;
        Price = price;
        JoiningFee = joiningFee;
        ClassCredits = classCredits;
        PtSessions = ptSessions;
        VisitsPerDay = visitsPerDay;
        TotalVisits = totalVisits;
        AllowFreeze = allowFreeze;
        MaxFreezeDays = allowFreeze ? maxFreezeDays : 0;
        GuestPasses = guestPasses;
        AllBranches = allBranches;
        AccessFrom = Text.OrNull(accessFrom);
        AccessUntil = Text.OrNull(accessUntil);
        IsActive = isActive;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>Rules for the whole workspace. One row per tenant, created on first read.</summary>
public sealed class FitnessSettings
{
    private FitnessSettings() { }

    public static FitnessSettings CreateDefault() => new() { Id = Guid.NewGuid(), CreatedAt = DateTime.UtcNow };

    public Guid    Id                     { get; private set; }
    public string  MemberNumberPrefix     { get; private set; } = "GYM";
    /// <summary>Days after expiry a member may still check in.</summary>
    public int     GraceDays              { get; private set; }
    /// <summary>Allow check-in while the member owes money on a membership.</summary>
    public bool    AllowCheckInWithDues   { get; private set; } = true;
    /// <summary>Refuse check-in until a liability waiver has been recorded.</summary>
    public bool    RequireWaiver          { get; private set; }
    /// <summary>How many days ahead a membership shows as "expiring".</summary>
    public int     ExpiringWithinDays     { get; private set; } = 7;
    /// <summary>A class booking cancelled later than this many hours before the start counts as late.</summary>
    public int     LateCancelHours        { get; private set; } = 2;
    /// <summary>Late cancellation or no-show uses up the class credit.</summary>
    public bool    ChargeCreditForNoShow  { get; private set; } = true;
    /// <summary>How far ahead members may be booked into classes.</summary>
    public int     BookingWindowDays      { get; private set; } = 14;
    /// <summary>Tell staff (bell) about memberships ending soon, once a day.</summary>
    public bool    ExpiryAlertsEnabled    { get; private set; } = true;
    public DateTime  CreatedAt            { get; private set; }
    public DateTime? UpdatedAt            { get; private set; }

    public void Update(string prefix, int graceDays, bool allowWithDues, bool requireWaiver, int expiringWithinDays,
        int lateCancelHours, bool chargeNoShow, int bookingWindowDays, bool expiryAlerts)
    {
        MemberNumberPrefix = prefix.Trim().ToUpperInvariant();
        GraceDays = graceDays;
        AllowCheckInWithDues = allowWithDues;
        RequireWaiver = requireWaiver;
        ExpiringWithinDays = expiringWithinDays;
        LateCancelHours = lateCancelHours;
        ChargeCreditForNoShow = chargeNoShow;
        BookingWindowDays = bookingWindowDays;
        ExpiryAlertsEnabled = expiryAlerts;
        UpdatedAt = DateTime.UtcNow;
    }
}

/// <summary>Remembers the last day staff were alerted, so the daily alert goes out once.</summary>
public sealed class FitnessAlertState
{
    private FitnessAlertState() { }
    public FitnessAlertState(string lastSentOn) { Id = Guid.NewGuid(); LastSentOn = lastSentOn; }
    public Guid   Id         { get; private set; }
    public string LastSentOn { get; private set; } = string.Empty;
    public void Sent(string on) => LastSentOn = on;
}

internal static class Text
{
    public static string? OrNull(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
