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
    DateTime? UpdatedAt);

public sealed record EmployeeListItemDto(
    Guid    Id,
    string  EmployeeNumber,
    string  FullName,
    string? JobTitle,
    string? DepartmentName,
    decimal BasicSalary);

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
