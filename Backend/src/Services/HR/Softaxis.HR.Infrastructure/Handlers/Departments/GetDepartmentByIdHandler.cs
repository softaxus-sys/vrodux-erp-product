using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Departments.Dtos;
using Softaxis.HR.Application.Departments.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Departments;

internal sealed class GetDepartmentByIdHandler(HrDbContext db)
    : IQueryHandler<GetDepartmentByIdQuery, DepartmentDto>
{
    public async Task<Result<DepartmentDto>> Handle(
        GetDepartmentByIdQuery query, CancellationToken ct)
    {
        var dept = await db.Departments
            .AsNoTracking()
            .Where(x => x.Id == query.Id)
            .Select(x => new DepartmentDto(
                x.Id, x.Name, x.Code, x.Description, x.ManagerId, x.IsActive,
                x.Employees.Count(e => !e.IsDeleted && e.Status != "terminated"),
                x.CreatedAt, x.UpdatedAt))
            .FirstOrDefaultAsync(ct);

        return dept is null
            ? Result.Failure<DepartmentDto>(Error.NotFoundById("Department", query.Id))
            : Result.Success(dept);
    }
}
