namespace Softaxis.HR.Domain.Entities;

public sealed class PayrollRun
{
    private PayrollRun() { }

    public PayrollRun(string period, string? notes, string? createdByUserId = null, string? createdByName = null)
    {
        Id              = Guid.NewGuid();
        RunNumber       = $"PR-{period.Replace("-", "")}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        Period          = period;
        Status          = "draft";
        Notes           = notes?.Trim();
        CreatedAt       = DateTime.UtcNow;
        CreatedByUserId = createdByUserId;
        CreatedByName   = createdByName?.Trim();
    }

    public Guid      Id                 { get; private set; }
    public string    RunNumber          { get; private set; } = string.Empty;
    public string    Period             { get; private set; } = string.Empty;
    public decimal   TotalBasicSalary   { get; private set; }
    public decimal   TotalAllowances    { get; private set; }
    public decimal   TotalDeductions    { get; private set; }
    public decimal   TotalNetSalary     { get; private set; }
    public string    Status             { get; private set; } = "draft";
    public string?   Notes              { get; private set; }
    public string?   CreatedByUserId    { get; private set; }
    public string?   CreatedByName      { get; private set; }
    public DateTime? ProcessedAt        { get; private set; }
    public DateTime? PaidAt             { get; private set; }
    public DateTime? RejectedAt         { get; private set; }
    public string?   RejectionReason    { get; private set; }
    public string?   RejectedByName     { get; private set; }
    public DateTime  CreatedAt          { get; private set; }
    public DateTime? UpdatedAt          { get; private set; }
    public bool      IsDeleted          { get; private set; }

    public ICollection<PayrollSlip> Slips { get; private set; } = new List<PayrollSlip>();

    public void Recalculate()
    {
        TotalBasicSalary = Slips.Sum(s => s.BasicSalary);
        TotalAllowances  = Slips.Sum(s => s.Allowances);
        TotalDeductions  = Slips.Sum(s => s.Deductions);
        TotalNetSalary   = Slips.Sum(s => s.NetSalary);
        UpdatedAt        = DateTime.UtcNow;
    }

    public void MarkProcessed()
    {
        Status      = "processed";
        ProcessedAt = DateTime.UtcNow;
        UpdatedAt   = DateTime.UtcNow;
    }

    public void MarkPaid()
    {
        Status    = "paid";
        PaidAt    = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkRejected(string? reason, string? rejectedByName)
    {
        Status           = "rejected";
        RejectionReason  = reason?.Trim();
        RejectedByName   = rejectedByName?.Trim();
        RejectedAt       = DateTime.UtcNow;
        UpdatedAt        = DateTime.UtcNow;
    }

    public void Reopen()
    {
        Status          = "draft";
        RejectionReason = null;
        RejectedByName  = null;
        RejectedAt      = null;
        UpdatedAt       = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public sealed class PayrollSlip
{
    private PayrollSlip() { }

    public PayrollSlip(
        Guid    payrollRunId,
        Guid    employeeId,
        string  employeeName,
        string? jobTitle,
        string? departmentName,
        decimal basicSalary,
        decimal allowances,
        decimal deductions,
        string? notes)
    {
        Id             = Guid.NewGuid();
        PayrollRunId   = payrollRunId;
        EmployeeId     = employeeId;
        EmployeeName   = employeeName.Trim();
        JobTitle       = jobTitle?.Trim();
        DepartmentName = departmentName?.Trim();
        BasicSalary    = basicSalary;
        Allowances     = allowances;
        Deductions     = deductions;
        NetSalary      = basicSalary + allowances - deductions;
        Notes          = notes?.Trim();
    }

    public Guid      Id             { get; private set; }
    public Guid      PayrollRunId   { get; private set; }
    public Guid      EmployeeId     { get; private set; }
    public string    EmployeeName   { get; private set; } = string.Empty;
    public string?   JobTitle       { get; private set; }
    public string?   DepartmentName { get; private set; }
    public decimal   BasicSalary    { get; private set; }
    public decimal   Allowances     { get; private set; }
    public decimal   Deductions     { get; private set; }
    public decimal   NetSalary      { get; private set; }
    public string?   Notes          { get; private set; }
    public DateTime? EmailSentAt    { get; private set; }
    public string?   EmailSentTo    { get; private set; }

    public PayrollRun? PayrollRun { get; private set; }

    public void MarkEmailSent(string email)
    {
        EmailSentTo = email;
        EmailSentAt = DateTime.UtcNow;
    }

    public void Update(decimal allowances, decimal deductions, string? notes)
    {
        Allowances = allowances;
        Deductions = deductions;
        NetSalary  = BasicSalary + allowances - deductions;
        Notes      = notes?.Trim();
    }
}
