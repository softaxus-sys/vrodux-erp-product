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
        string? notes)
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
    public DateTime  CreatedAt    { get; private set; }
    public DateTime? UpdatedAt    { get; private set; }

    public Employee? Employee { get; private set; }

    public void Update(
        string? checkIn, string? checkOut, decimal? workingHours, string status, string? notes)
    {
        CheckIn      = checkIn;
        CheckOut     = checkOut;
        WorkingHours = workingHours;
        Status       = status;
        Notes        = notes?.Trim();
        UpdatedAt    = DateTime.UtcNow;
    }
}
