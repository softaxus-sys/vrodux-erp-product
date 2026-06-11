using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Leaves.Dtos;
using Softaxis.HR.Application.Leaves.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Leaves;

internal sealed class GetLeavesSummaryHandler(HrDbContext db)
    : IQueryHandler<GetLeavesSummaryQuery, LeavesSummaryDto>
{
    public async Task<Result<LeavesSummaryDto>> Handle(GetLeavesSummaryQuery query, CancellationToken ct)
    {
        var thisMonthPrefix = DateTime.UtcNow.ToString("yyyy-MM");

        var statusCounts = await db.Leaves
            .AsNoTracking()
            .GroupBy(x => x.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var pending  = statusCounts.FirstOrDefault(c => c.Status == "pending")?.Count  ?? 0;
        var approved = statusCounts.FirstOrDefault(c => c.Status == "approved")?.Count ?? 0;
        var rejected = statusCounts.FirstOrDefault(c => c.Status == "rejected")?.Count ?? 0;

        var thisMonthByType = await db.Leaves
            .AsNoTracking()
            .Where(x => x.StartDate.StartsWith(thisMonthPrefix))
            .GroupBy(x => x.LeaveType)
            .Select(g => new LeaveTypeCountDto(g.Key, g.Count()))
            .OrderByDescending(g => g.Count)
            .ToListAsync(ct);

        return Result.Success(new LeavesSummaryDto(
            pending, approved, rejected, thisMonthByType, pending, approved));
    }
}
