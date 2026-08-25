using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Employees.Dtos;

namespace Softaxis.HR.Application.Employees.Queries;

/// <param name="IncludeInactive">
/// The employee LIST page wants everyone (its status column and filters are meaningless
/// otherwise); the leave/payroll/attendance pickers want active staff only, which stays the default.
/// </param>
public sealed record GetAllEmployeesSimpleQuery(bool IncludeInactive = false)
    : IQuery<IReadOnlyList<EmployeeListItemDto>>;
