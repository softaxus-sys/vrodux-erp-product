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

        var items = await q
            .OrderBy(x => x.FirstName).ThenBy(x => x.LastName)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(x => new EmployeeDto(
                x.Id, x.EmployeeNumber, x.FirstName, x.LastName,
                x.FirstName + " " + x.LastName,
                x.Email, x.Phone, x.JobTitle, x.DepartmentId, x.DepartmentName,
                x.EmploymentType, x.BasicSalary, x.JoiningDate, x.TerminationDate,
                x.Status, x.ManagerId, x.Notes, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        return Result.Success(new PagedResult<EmployeeDto>(
            items, query.Page, query.PageSize, total, totalPages, query.Page < totalPages, query.Page > 1));
    }
}
