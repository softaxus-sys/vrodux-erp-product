namespace Softaxis.HR.Domain.Entities;

public sealed class Employee
{
    private Employee() { }

    public Employee(
        string  firstName,
        string  lastName,
        string  email,
        string? phone,
        string? jobTitle,
        Guid?   departmentId,
        string? departmentName,
        string  employmentType,
        decimal basicSalary,
        string  joiningDate,
        Guid?   managerId,
        string? notes)
    {
        Id             = Guid.NewGuid();
        EmployeeNumber = $"EMP-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        FirstName      = firstName.Trim();
        LastName       = lastName.Trim();
        Email          = email.Trim().ToLowerInvariant();
        Phone          = phone?.Trim();
        JobTitle       = jobTitle?.Trim();
        DepartmentId   = departmentId;
        DepartmentName = departmentName?.Trim();
        EmploymentType = employmentType;  // full-time | part-time | contract | intern
        BasicSalary    = basicSalary;
        JoiningDate    = joiningDate;
        Status         = "active";        // active | inactive | terminated
        ManagerId      = managerId;
        Notes          = notes?.Trim();
        CreatedAt      = DateTime.UtcNow;
    }

    public Guid      Id             { get; private set; }
    public string    EmployeeNumber { get; private set; } = string.Empty;
    public string    FirstName      { get; private set; } = string.Empty;
    public string    LastName       { get; private set; } = string.Empty;
    public string    FullName       => $"{FirstName} {LastName}";
    public string    Email          { get; private set; } = string.Empty;
    public string?   Phone          { get; private set; }
    public string?   JobTitle       { get; private set; }
    public Guid?     DepartmentId   { get; private set; }
    public string?   DepartmentName { get; private set; }
    public string    EmploymentType { get; private set; } = "full-time";
    public decimal   BasicSalary    { get; private set; }
    public string    JoiningDate    { get; private set; } = string.Empty;
    public string?   TerminationDate { get; private set; }
    public string    Status         { get; private set; } = "active";
    public Guid?     ManagerId      { get; private set; }
    public string?   Notes          { get; private set; }
    public DateTime  CreatedAt      { get; private set; }
    public DateTime? UpdatedAt      { get; private set; }
    public bool      IsDeleted      { get; private set; }

    public Department?              Department     { get; private set; }
    public ICollection<Leave>       Leaves         { get; private set; } = new List<Leave>();
    public ICollection<AttendanceLog> AttendanceLogs { get; private set; } = new List<AttendanceLog>();

    public void Update(
        string  firstName, string lastName, string email, string? phone,
        string? jobTitle, Guid? departmentId, string? departmentName,
        string  employmentType, decimal basicSalary, string joiningDate,
        Guid?   managerId, string? notes, string status)
    {
        FirstName      = firstName.Trim();
        LastName       = lastName.Trim();
        Email          = email.Trim().ToLowerInvariant();
        Phone          = phone?.Trim();
        JobTitle       = jobTitle?.Trim();
        DepartmentId   = departmentId;
        DepartmentName = departmentName?.Trim();
        EmploymentType = employmentType;
        BasicSalary    = basicSalary;
        JoiningDate    = joiningDate;
        Status         = status;
        ManagerId      = managerId;
        Notes          = notes?.Trim();
        if (status == "terminated") TerminationDate = DateTime.UtcNow.ToString("yyyy-MM-dd");
        UpdatedAt      = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
