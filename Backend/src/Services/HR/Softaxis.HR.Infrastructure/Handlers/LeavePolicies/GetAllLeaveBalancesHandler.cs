using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Common.Dtos;
using Softaxis.HR.Application.LeavePolicies.Dtos;
using Softaxis.HR.Application.LeavePolicies.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.LeavePolicies;

internal sealed class GetAllLeaveBalancesHandler(HrDbContext db)
    : IQueryHandler<GetAllLeaveBalancesQuery, PagedResult<EmployeeLeaveBalancesDto>>
{
    /// <summary>Capped so a hand-edited pageSize cannot ask for the whole headcount.</summary>
    private const int MaxPageSize = 200;

    public async Task<Result<PagedResult<EmployeeLeaveBalancesDto>>> Handle(
        GetAllLeaveBalancesQuery query, CancellationToken ct)
    {
        var year   = query.Year ?? DateTime.UtcNow.Year;
        var prefix = year.ToString();

        var page     = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);

        var policies = (await LeavePolicySeeder.EnsureSeededAsync(db, ct))
            .Where(p => p.IsActive)
            .OrderByDescending(p => p.AnnualEntitlementDays)
            .ThenBy(p => p.LeaveType)
            .ToList();

        var staff = db.Employees
            .AsNoTracking()
            .Where(e => !e.IsDeleted && e.Status == "active");

        if (!string.IsNullOrWhiteSpace(query.Search))
            staff = staff.Where(e => e.FirstName.Contains(query.Search)
                                  || e.LastName.Contains(query.Search)
                                  || e.DepartmentName.Contains(query.Search));

        // Counted before paging so the caller knows how many pages exist.
        var total = await staff.CountAsync(ct);

        var employees = await staff
            .OrderBy(e => e.FirstName).ThenBy(e => e.LastName).ThenBy(e => e.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(e => new { e.Id, e.FirstName, e.LastName, e.DepartmentName })
            .ToListAsync(ct);

        var ids = employees.Select(e => e.Id).ToList();

        // One grouped query for this page rather than per employee — a per-row query would be an
        // N+1 over the headcount. Scoped to the page's ids, so it no longer aggregates leave for
        // employees the caller is not looking at.
        var taken = await db.Leaves
            .AsNoTracking()
            .Where(l => !l.IsDeleted
                        && ids.Contains(l.EmployeeId)
                        && l.StartDate.StartsWith(prefix)
                        && (l.Status == "approved" || l.Status == "pending"))
            .GroupBy(l => new { l.EmployeeId, l.LeaveType, l.Status })
            .Select(g => new { g.Key.EmployeeId, g.Key.LeaveType, g.Key.Status, Days = g.Sum(x => x.TotalDays) })
            .ToListAsync(ct);

        var byEmployee = taken
            .GroupBy(t => t.EmployeeId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var items = employees
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

        return Result.Success(PagedResult<EmployeeLeaveBalancesDto>.Create(items, total, page, pageSize));
    }
}
