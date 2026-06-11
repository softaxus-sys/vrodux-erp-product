using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Employees.Dtos;
using Softaxis.HR.Application.Employees.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Employees;

internal sealed class GetEmployeesSummaryHandler(HrDbContext db)
    : IQueryHandler<GetEmployeesSummaryQuery, EmployeesSummaryDto>
{
    public async Task<Result<EmployeesSummaryDto>> Handle(GetEmployeesSummaryQuery query, CancellationToken ct)
    {
        var joiningThisMonthPrefix = DateTime.UtcNow.ToString("yyyy-MM");

        var statusCounts = await db.Employees
            .AsNoTracking()
            .GroupBy(x => x.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var total      = statusCounts.Sum(c => c.Count);
        var active     = statusCounts.FirstOrDefault(c => c.Status == "active")?.Count     ?? 0;
        var inactive   = statusCounts.FirstOrDefault(c => c.Status == "inactive")?.Count   ?? 0;
        var terminated = statusCounts.FirstOrDefault(c => c.Status == "terminated")?.Count ?? 0;

        var newHiresThisMonth = await db.Employees
            .AsNoTracking()
            .CountAsync(x => x.JoiningDate.StartsWith(joiningThisMonthPrefix), ct);

        var byDepartment = await db.Employees
            .AsNoTracking()
            .Where(x => x.Status == "active" && x.DepartmentName != null)
            .GroupBy(x => x.DepartmentName!)
            .Select(g => new DepartmentCountDto(g.Key, g.Count()))
            .OrderByDescending(g => g.Count)
            .Take(10)
            .ToListAsync(ct);

        return Result.Success(new EmployeesSummaryDto(
            total, active, inactive, terminated, newHiresThisMonth, byDepartment,
            total, active, byDepartment.Count, newHiresThisMonth, 0, 0));
    }
}
