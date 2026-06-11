using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Departments.Dtos;

namespace Softaxis.HR.Application.Departments.Queries;

public sealed record GetDepartmentByIdQuery(Guid Id) : IQuery<DepartmentDto>;
