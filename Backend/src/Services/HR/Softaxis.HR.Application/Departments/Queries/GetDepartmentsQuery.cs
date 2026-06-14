using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Departments.Dtos;

namespace Softaxis.HR.Application.Departments.Queries;

public sealed record GetDepartmentsQuery(
    string? Search   = null,
    bool?   IsActive = null
) : IQuery<IReadOnlyList<DepartmentDto>>;
