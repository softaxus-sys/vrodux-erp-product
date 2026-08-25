using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.LeavePolicies.Dtos;
using Softaxis.HR.Application.LeavePolicies.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.LeavePolicies;

internal sealed class GetAllLeaveBalancesHandler(HrDbContext db)
    : IQueryHandler<GetAllLeaveBalancesQuery, IReadOnlyList<EmployeeLeaveBalancesDto>>
{
    public async Task<Result<IReadOnlyList<EmployeeLeaveBalancesDto>>> Handle(
        GetAllLeaveBalancesQuery query, CancellationToken ct)
    {
        var year   = query.Year ?? DateTime.UtcNow.Year;
        var prefix = year.ToString();

        var policies = (await LeavePolicySeeder.EnsureSeededAsync(db, ct))
            .Where(p => p.IsActive)
            .OrderByDescending(p => p.AnnualEntitlementDays)
            .ThenBy(p => p.LeaveType)
            .ToList();

        var employees = await db.Employees
            .AsNoTracking()
            .Where(e => !e.IsDeleted && e.Status == "active")
            .Select(e => new { e.Id, e.FirstName, e.LastName, e.DepartmentName })
            .ToListAsync(ct);

        // One grouped query for the whole tenant rather than per employee — this feeds a
        // table of every employee, so a per-row query would be an N+1 over the headcount.
        var taken = await db.Leaves
            .AsNoTracking()
            .Where(l => !l.IsDeleted
                        && l.StartDate.StartsWith(prefix)
                        && (l.Status == "approved" || l.Status == "pending"))
            .GroupBy(l => new { l.EmployeeId, l.LeaveType, l.Status })
            .Select(g => new { g.Key.EmployeeId, g.Key.LeaveType, g.Key.Status, Days = g.Sum(x => x.TotalDays) })
            .ToListAsync(ct);

        var byEmployee = taken
            .GroupBy(t => t.EmployeeId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var items = employees
            .OrderBy(e => e.FirstName).ThenBy(e => e.LastName)
            .Select(e =>
            {
                byEmployee.TryGetValue(e.Id, out var rows);
                rows ??= [];
                var balances = policies.Select(p =>
                {
                    var used    = rows.Where(r => r.LeaveType == p.LeaveType && r.Status == "approved").Sum(r => r.Days);
                    var pending = rows.Where(r => r.LeaveType == p.LeaveType && r.Status == "pending").Sum(r => r.Days);
                    var left    = p.AnnualEntitlementDays - used - pending;
                    return new LeaveBalanceDto(
                        p.LeaveType, p.AnnualEntitlementDays, used, pending,
                        left < 0 ? 0 : left, p.IsPaid, year);
                }).ToList();

                return new EmployeeLeaveBalancesDto(
                    e.Id, $"{e.FirstName} {e.LastName}".Trim(), e.DepartmentName, balances);
            })
            .ToList();

        return Result.Success<IReadOnlyList<EmployeeLeaveBalancesDto>>(items);
    }
}
