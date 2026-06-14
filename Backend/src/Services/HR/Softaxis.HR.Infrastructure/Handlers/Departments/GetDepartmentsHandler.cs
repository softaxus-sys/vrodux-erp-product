using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Departments.Dtos;
using Softaxis.HR.Application.Departments.Queries;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Departments;

internal sealed class GetDepartmentsHandler(HrDbContext db)
    : IQueryHandler<GetDepartmentsQuery, IReadOnlyList<DepartmentDto>>
{
    public async Task<Result<IReadOnlyList<DepartmentDto>>> Handle(
        GetDepartmentsQuery query, CancellationToken ct)
    {
        IQueryable<Department> q = db.Departments.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(query.Search))
            q = q.Where(x => x.Name.Contains(query.Search) ||
                             (x.Code != null && x.Code.Contains(query.Search)));

        if (query.IsActive.HasValue)
            q = q.Where(x => x.IsActive == query.IsActive.Value);

        var items = await q
            .OrderBy(x => x.Name)
            .Select(x => new DepartmentDto(
                x.Id, x.Name, x.Code, x.Description, x.ManagerId, x.IsActive,
                x.Employees.Count(e => !e.IsDeleted && e.Status != "terminated"),
                x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<DepartmentDto>>(items);
    }
}
