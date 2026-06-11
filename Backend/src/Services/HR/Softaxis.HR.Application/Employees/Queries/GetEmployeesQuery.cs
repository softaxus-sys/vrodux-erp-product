using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Common.Dtos;
using Softaxis.HR.Application.Employees.Dtos;

namespace Softaxis.HR.Application.Employees.Queries;

public sealed record GetEmployeesQuery(
    int     Page           = 1,
    int     PageSize       = 20,
    string? Search         = null,
    string? Status         = null,
    string? EmploymentType = null,
    Guid?   DepartmentId   = null
) : IQuery<PagedResult<EmployeeDto>>;
