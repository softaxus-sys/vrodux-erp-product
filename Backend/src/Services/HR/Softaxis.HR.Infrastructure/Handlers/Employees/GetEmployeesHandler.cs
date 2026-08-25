using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Common.Dtos;
using Softaxis.HR.Application.Employees.Dtos;
using Softaxis.HR.Application.Employees.Queries;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Employees;

internal sealed class GetEmployeesHandler(HrDbContext db)
    : IQueryHandler<GetEmployeesQuery, PagedResult<EmployeeDto>>
{
    public async Task<Result<PagedResult<EmployeeDto>>> Handle(GetEmployeesQuery query, CancellationToken ct)
    {
        IQueryable<Employee> q = db.Employees.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(query.Search))
            q = q.Where(x =>
                x.FirstName.Contains(query.Search) ||
                x.LastName.Contains(query.Search)  ||
                x.Email.Contains(query.Search)     ||
                x.EmployeeNumber.Contains(query.Search) ||
                (x.JobTitle != null && x.JobTitle.Contains(query.Search)));

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.Status == query.Status);

        if (!string.IsNullOrWhiteSpace(query.EmploymentType))
            q = q.Where(x => x.EmploymentType == query.EmploymentType);

        if (query.DepartmentId.HasValue)
            q = q.Where(x => x.DepartmentId == query.DepartmentId.Value);

        var total      = await q.CountAsync(ct);
        var totalPages = (int)Math.Ceiling((double)total / query.PageSize);

        // Same rule as GetEmployeeById: one mapper owns the DTO shape, so a new field can never
        // be added to EmployeeDto and silently come back null from here.
        var rows = await q
            .OrderBy(x => x.FirstName).ThenBy(x => x.LastName)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync(ct);

        // Explicit lambda, not a method group: ToDto now has an optional second parameter, and a
        // list read deliberately passes no linked account (it must not join Identity per row).
        var items = rows.Select(e => EmployeeMappings.ToDto(e)).ToList();

        return Result.Success(new PagedResult<EmployeeDto>(
            items, query.Page, query.PageSize, total, totalPages, query.Page < totalPages, query.Page > 1));
    }
}
