using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Employees.Dtos;
using Softaxis.HR.Application.Employees.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Employees;

internal sealed class GetAllEmployeesSimpleHandler(HrDbContext db)
    : IQueryHandler<GetAllEmployeesSimpleQuery, IReadOnlyList<EmployeeListItemDto>>
{
    public async Task<Result<IReadOnlyList<EmployeeListItemDto>>> Handle(GetAllEmployeesSimpleQuery query, CancellationToken ct)
    {
        var items = await db.Employees
            .AsNoTracking()
            .Where(x => x.Status == "active")
            .OrderBy(x => x.FirstName).ThenBy(x => x.LastName)
            .Take(500)
            .Select(x => new EmployeeListItemDto(
                x.Id, x.EmployeeNumber, x.FirstName + " " + x.LastName,
                x.JobTitle, x.DepartmentName, x.BasicSalary))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<EmployeeListItemDto>>(items);
    }
}
