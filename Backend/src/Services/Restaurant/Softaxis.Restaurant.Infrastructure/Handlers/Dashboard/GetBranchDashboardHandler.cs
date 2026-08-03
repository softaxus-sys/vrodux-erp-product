using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Dashboard.Dtos;
using Softaxis.Restaurant.Application.Dashboard.Queries;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Dashboard;

internal sealed class GetBranchDashboardHandler(RestaurantDbContext db)
    : IQueryHandler<GetBranchDashboardQuery, BranchDashboardDto>
{
    public async Task<Result<BranchDashboardDto>> Handle(GetBranchDashboardQuery query, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var todayFrom = ReportAggregation.StartOf(today);
        var todayTo = ReportAggregation.EndOfExclusive(today);

        var todayOrders = await ReportAggregation.PaidOrdersInRange(db, todayFrom, todayTo, query.BranchId)
            .Select(o => new { o.SubTotal, o.Total })
            .ToListAsync(ct);

        var tableCounts = await db.Tables.AsNoTracking()
            .Where(t => !t.IsDeleted && t.MergedIntoTableId == null && (query.BranchId == null || t.BranchId == query.BranchId))
            .GroupBy(t => t.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var activeOrders = await db.Orders.AsNoTracking()
            .Where(o => !o.IsDeleted && o.Status != "paid" && o.Status != "cancelled" && o.Status != "split"
                && (query.BranchId == null || o.BranchId == query.BranchId))
            .CountAsync(ct);

        int CountOf(string status) => tableCounts.FirstOrDefault(x => x.Status == status)?.Count ?? 0;

        var dto = new BranchDashboardDto(
            BranchId: query.BranchId,
            TodaySales: todayOrders.Sum(o => o.SubTotal),
            TodayOrders: todayOrders.Count,
            TodayNetSales: todayOrders.Sum(o => o.Total),
            TablesAvailable: CountOf("available"),
            TablesOccupied: CountOf("occupied"),
            TablesReserved: CountOf("reserved"),
            TablesCleaning: CountOf("cleaning"),
            ActiveOrders: activeOrders);

        return Result.Success(dto);
    }
}
