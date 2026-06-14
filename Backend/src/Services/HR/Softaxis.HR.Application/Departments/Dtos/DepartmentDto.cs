namespace Softaxis.HR.Application.Departments.Dtos;

public sealed record DepartmentDto(
    Guid      Id,
    string    Name,
    string?   Code,
    string?   Description,
    Guid?     ManagerId,
    bool      IsActive,
    int       EmployeeCount,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);
