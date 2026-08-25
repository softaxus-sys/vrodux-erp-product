namespace Softaxis.HR.Domain.Entities;

/// <summary>
/// The tenant's office hours: when the working day starts and ends, how much lateness is
/// tolerated, which days are working days, and which timezone all of that is expressed in.
///
/// <para>The timezone is part of the schedule rather than assumed, because attendance is stamped
/// from server time (UTC). Without it, a 09:00 arrival in Dubai is recorded as 05:00 and every
/// employee looks four hours early.</para>
///
/// <para>One row per tenant is used today (<see cref="IsDefault"/>). The table takes many so that
/// per-department or per-shift schedules can be added without a migration — assigning schedules
/// to individual employees is deliberately not built yet.</para>
/// </summary>
public sealed class WorkSchedule
{
    private WorkSchedule() { }

    public WorkSchedule(
        string name, string startTime, string endTime, int graceMinutes,
        string workingDays, string timeZoneId, bool isDefault = true)
    {
        Id           = Guid.NewGuid();
        Name         = name.Trim();
        StartTime    = startTime;      // HH:mm, local to TimeZoneId
        EndTime      = endTime;        // HH:mm
        GraceMinutes = Math.Max(0, graceMinutes);
        WorkingDays  = workingDays;    // CSV of DayOfWeek numbers, 0 = Sunday
        TimeZoneId   = timeZoneId;
        IsDefault    = isDefault;
        CreatedAt    = DateTime.UtcNow;
    }

    public Guid      Id           { get; private set; }
    public string    Name         { get; private set; } = string.Empty;
    public string    StartTime    { get; private set; } = "09:00";
    public string    EndTime      { get; private set; } = "18:00";

    /// <summary>Minutes after <see cref="StartTime"/> that still count as on time.</summary>
    public int       GraceMinutes { get; private set; }

    public string    WorkingDays  { get; private set; } = "1,2,3,4,5";
    public string    TimeZoneId   { get; private set; } = "UTC";
    public bool      IsDefault    { get; private set; }
    public bool      IsActive     { get; private set; } = true;
    public DateTime  CreatedAt    { get; private set; }
    public DateTime? UpdatedAt    { get; private set; }
    public bool      IsDeleted    { get; private set; }

    public void Update(string name, string startTime, string endTime, int graceMinutes,
                       string workingDays, string timeZoneId)
    {
        Name         = name.Trim();
        StartTime    = startTime;
        EndTime      = endTime;
        GraceMinutes = Math.Max(0, graceMinutes);
        WorkingDays  = workingDays;
        TimeZoneId   = timeZoneId;
        UpdatedAt    = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; IsActive = false; UpdatedAt = DateTime.UtcNow; }
}
