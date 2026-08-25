namespace Softaxis.HR.Domain.Entities;

public sealed class AttendanceLog
{
    private AttendanceLog() { }

    public AttendanceLog(
        Guid    employeeId,
        string  employeeName,
        string  date,
        string? checkIn,
        string? checkOut,
        decimal? workingHours,
        string  status,
        string? notes,
        int?    lateMinutes = null)
    {
        Id           = Guid.NewGuid();
        EmployeeId   = employeeId;
        EmployeeName = employeeName.Trim();
        Date         = date;           // yyyy-MM-dd
        CheckIn      = checkIn;        // HH:mm
        CheckOut     = checkOut;       // HH:mm
        WorkingHours = workingHours;
        Status       = status;         // present | absent | half-day | remote | holiday | leave
        Notes        = notes?.Trim();
        LateMinutes  = lateMinutes;
        CreatedAt    = DateTime.UtcNow;
    }

    public Guid      Id           { get; private set; }
    public Guid      EmployeeId   { get; private set; }
    public string    EmployeeName { get; private set; } = string.Empty;
    public string    Date         { get; private set; } = string.Empty;
    public string?   CheckIn      { get; private set; }
    public string?   CheckOut     { get; private set; }
    public decimal?  WorkingHours { get; private set; }
    public string    Status       { get; private set; } = string.Empty;
    public string?   Notes        { get; private set; }

    /// <summary>
    /// Minutes past the schedule's grace period at check-in; 0 when on time, null when it could
    /// not be judged (no schedule, or an unreadable time). Snapshotted at check-in rather than
    /// derived on read, so changing office hours never rewrites what already happened.
    /// </summary>
    public int?      LateMinutes  { get; private set; }

    public DateTime  CreatedAt    { get; private set; }
    public DateTime? UpdatedAt    { get; private set; }

    public Employee? Employee { get; private set; }

    public void Update(
        string? checkIn, string? checkOut, decimal? workingHours, string status, string? notes,
        int? lateMinutes = null)
    {
        CheckIn      = checkIn;
        CheckOut     = checkOut;
        WorkingHours = workingHours;
        Status       = status;
        Notes        = notes?.Trim();
        // Only overwritten when a fresh judgement is supplied — an edit that does not touch the
        // arrival time must not silently erase the original verdict.
        LateMinutes  = lateMinutes ?? LateMinutes;
        UpdatedAt    = DateTime.UtcNow;
    }
}
