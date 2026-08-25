using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Abstractions;
using Softaxis.HR.Application.Employees.Dtos;
using Softaxis.HR.Application.Employees.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Employees;

internal sealed class GetAllEmployeesSimpleHandler(HrDbContext db, ICurrentUser currentUser)
    : IQueryHandler<GetAllEmployeesSimpleQuery, IReadOnlyList<EmployeeListItemDto>>
{
    /// <summary>
    /// Salary is only returned to callers who are entitled to see it.
    ///
    /// <para>This endpoint exists as a dropdown feed for the leave, attendance and payroll forms,
    /// so it is reachable by people who cannot open the employee directory. It was returning
    /// <c>BasicSalary</c> for every employee regardless — meaning anyone who could reach it could
    /// read the entire payroll. The list still works for the forms; the figure is simply absent
    /// unless the caller may see it.</para>
    /// </summary>
    private bool MaySeeSalary =>
        currentUser.IsSuperAdmin
        || currentUser.HasPermission("hr.employees.view")
        || currentUser.HasPermission("hr.payroll.view")
        || currentUser.HasPermission("hr.payroll.create");

    public async Task<Result<IReadOnlyList<EmployeeListItemDto>>> Handle(GetAllEmployeesSimpleQuery query, CancellationToken ct)
    {
        var q = db.Employees.AsNoTracking().Where(x => !x.IsDeleted);
        if (!query.IncludeInactive) q = q.Where(x => x.Status == "active");

        var items = await q
            .OrderBy(x => x.FirstName).ThenBy(x => x.LastName)
            .Take(500)
            .Select(x => new EmployeeListItemDto(
                x.Id, x.EmployeeNumber, x.FirstName + " " + x.LastName,
                x.JobTitle, x.DepartmentName, MaySeeSalary ? x.BasicSalary : 0m,
                x.FirstName, x.LastName, x.Email, x.Phone,
                x.Status, x.JoiningDate, x.EmploymentType))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<EmployeeListItemDto>>(items);
    }
}
