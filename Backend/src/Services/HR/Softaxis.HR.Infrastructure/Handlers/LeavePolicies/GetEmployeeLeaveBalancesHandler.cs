using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.LeavePolicies.Dtos;
using Softaxis.HR.Application.LeavePolicies.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.LeavePolicies;

internal sealed class GetEmployeeLeaveBalancesHandler(HrDbContext db)
    : IQueryHandler<GetEmployeeLeaveBalancesQuery, IReadOnlyList<LeaveBalanceDto>>
{
    public async Task<Result<IReadOnlyList<LeaveBalanceDto>>> Handle(
        GetEmployeeLeaveBalancesQuery query, CancellationToken ct)
    {
        var year   = query.Year ?? DateTime.UtcNow.Year;
        var prefix = year.ToString();

        var policies = await LeavePolicySeeder.EnsureSeededAsync(db, ct);

        // Dates are stored as yyyy-MM-dd strings throughout HR, so the year is a prefix
        // match — which also keeps the filter translatable to SQL.
        var taken = await db.Leaves
            .AsNoTracking()
            .Where(l => !l.IsDeleted
                        && l.EmployeeId == query.EmployeeId
                        && l.StartDate.StartsWith(prefix)
                        && (l.Status == "approved" || l.Status == "pending"))
            .Select(l => new { l.LeaveType, l.TotalDays, l.Status })
            .ToListAsync(ct);

        var items = policies
            .Where(p => p.IsActive)
            .OrderByDescending(p => p.AnnualEntitlementDays)
            .ThenBy(p => p.LeaveType)
            .Select(p =>
            {
                var rows    = taken.Where(t => t.LeaveType == p.LeaveType).ToList();
                var used    = rows.Where(t => t.Status == "approved").Sum(t => t.TotalDays);
                var pending = rows.Where(t => t.Status == "pending").Sum(t => t.TotalDays);
                // Pending requests are held against the balance so an employee cannot
                // book past their entitlement while an earlier request is still awaiting approval.
                var remaining = p.AnnualEntitlementDays - used - pending;
                return new LeaveBalanceDto(
                    p.LeaveType, p.AnnualEntitlementDays, used, pending,
                    remaining < 0 ? 0 : remaining, p.IsPaid, year);
            })
            .ToList();

        return Result.Success<IReadOnlyList<LeaveBalanceDto>>(items);
    }
}
