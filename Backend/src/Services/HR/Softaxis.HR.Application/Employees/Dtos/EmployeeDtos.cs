namespace Softaxis.HR.Application.Employees.Dtos;

public sealed record EmployeeDto(
    Guid      Id,
    string    EmployeeNumber,
    string    FirstName,
    string    LastName,
    string    FullName,
    string    Email,
    string?   Phone,
    string?   JobTitle,
    Guid?     DepartmentId,
    string?   DepartmentName,
    string    EmploymentType,
    decimal   BasicSalary,
    string    JoiningDate,
    string?   TerminationDate,
    string    Status,
    Guid?     ManagerId,
    string?   Notes,
    DateTime  CreatedAt,
    DateTime? UpdatedAt,
    string?   AvatarData = null,
    string?   Nationality = null,
    string?   EmiratesId = null,
    string?   PassportNumber = null,
    string?   VisaExpiry = null,
    string?   ReportingTo = null,
    string?   BankAccount = null,
    string?   Iban = null,
    string?   MedicalInsurance = null,

    /// <summary>MOHRE Person ID and bank routing code — both required by a WPS salary file.</summary>
    string?   LabourCardNumber = null,
    string?   BankRoutingCode = null,

    Guid?     UserId = null,
    /// <summary>Live state of the linked login, read from Identity. Null when unlinked.</summary>
    LinkedAccountDto? LinkedAccount = null);

/// <summary>
/// Read-only snapshot of the Identity user linked to an employee. HR never stores any of this —
/// it is read through a cross-schema view at query time, so it cannot drift.
/// </summary>
public sealed record LinkedAccountDto(
    Guid      UserId,
    string    Email,
    string    Username,
    string    FullName,
    string    Status,
    bool      EmailVerified,
    DateTime? LastLoginAt);

/// <summary>A login that could be the same person as an employee being created or edited.</summary>
public sealed record UserMatchDto(
    Guid   UserId,
    string Email,
    string Username,
    string FullName,
    string Status,
    /// <summary>Set when this login already belongs to someone else — then it cannot be linked.</summary>
    string? AlreadyLinkedToEmployeeName,

    /// <summary>
    /// True when the address has no login in THIS workspace but is already registered in another
    /// one. A Vrodux login is identified by email across the whole platform, so the address can
    /// neither be linked here nor used to create a second login — a state worth naming, because
    /// otherwise the search reports "not found" and the create then fails as "already registered".
    /// </summary>
    bool RegisteredInAnotherWorkspace = false);

/// <summary>
/// Row shape for the employee list and the employee pickers. Carries the fields those screens
/// actually render — the previous 6-field version left the grid's email, join date and status
/// columns permanently blank because the data simply was not in the response.
/// </summary>
public sealed record EmployeeListItemDto(
    Guid    Id,
    string  EmployeeNumber,
    string  FullName,
    string? JobTitle,
    string? DepartmentName,
    decimal BasicSalary,
    string  FirstName = "",
    string  LastName = "",
    string  Email = "",
    string? Phone = null,
    string  Status = "active",
    string  JoiningDate = "",
    string  EmploymentType = "full-time");

public sealed record DepartmentCountDto(string Department, int Count);

public sealed record EmployeesSummaryDto(
    int Total,
    int Active,
    int Inactive,
    int Terminated,
    int NewHiresThisMonth,
    IReadOnlyList<DepartmentCountDto> ByDepartment,
    int TotalEmployees,
    int ActiveEmployees,
    int Departments,
    int NewThisMonth,
    int OnLeave,
    int Probation);
