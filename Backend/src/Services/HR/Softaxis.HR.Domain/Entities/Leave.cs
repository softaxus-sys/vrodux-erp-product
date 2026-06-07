namespace Softaxis.HR.Domain.Entities;

public sealed class Leave
{
    private Leave() { }

    public Leave(
        Guid    employeeId,
        string  employeeName,
        string  leaveType,
        string  startDate,
        string  endDate,
        decimal totalDays,
        string? reason)
    {
        Id           = Guid.NewGuid();
        LeaveNumber  = $"LV-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        EmployeeId   = employeeId;
        EmployeeName = employeeName.Trim();
        LeaveType    = leaveType;   // annual | sick | maternity | paternity | unpaid | emergency
        StartDate    = startDate;
        EndDate      = endDate;
        TotalDays    = totalDays;
        Reason       = reason?.Trim();
        Status       = "pending";   // pending | approved | rejected | cancelled
        CreatedAt    = DateTime.UtcNow;
    }

    public Guid      Id             { get; private set; }
    public string    LeaveNumber    { get; private set; } = string.Empty;
    public Guid      EmployeeId     { get; private set; }
    public string    EmployeeName   { get; private set; } = string.Empty;
    public string    LeaveType      { get; private set; } = string.Empty;
    public string    StartDate      { get; private set; } = string.Empty;
    public string    EndDate        { get; private set; } = string.Empty;
    public decimal   TotalDays      { get; private set; }
    public string?   Reason         { get; private set; }
    public string    Status         { get; private set; } = "pending";
    public Guid?     ApprovedById   { get; private set; }
    public string?   ApproverNotes  { get; private set; }
    public DateTime? ApprovedAt     { get; private set; }
    public DateTime  CreatedAt      { get; private set; }
    public DateTime? UpdatedAt      { get; private set; }
    public bool      IsDeleted      { get; private set; }

    public Employee? Employee { get; private set; }

    public void Approve(Guid approverId, string? notes)
    {
        Status        = "approved";
        ApprovedById  = approverId;
        ApproverNotes = notes?.Trim();
        ApprovedAt    = DateTime.UtcNow;
        UpdatedAt     = DateTime.UtcNow;
    }

    public void Reject(Guid approverId, string? notes)
    {
        Status        = "rejected";
        ApprovedById  = approverId;
        ApproverNotes = notes?.Trim();
        ApprovedAt    = DateTime.UtcNow;
        UpdatedAt     = DateTime.UtcNow;
    }

    public void Cancel()
    {
        Status    = "cancelled";
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
