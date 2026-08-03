using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Dashboard.Dtos;
using Softaxis.Restaurant.Application.Dashboard.Queries;
using Softaxis.Restaurant.Application.Reports.Dtos;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Dashboard;

internal sealed class GetKitchenDashboardHandler(RestaurantDbContext db)
    : IQueryHandler<GetKitchenDashboardQuery, KitchenDashboardDto>
{
    public async Task<Result<KitchenDashboardDto>> Handle(GetKitchenDashboardQuery query, CancellationToken ct)
    {
        var orders = await db.Orders.AsNoTracking()
            .Where(x => !x.IsDeleted && (x.Status == "sent" || x.Status == "ready")
                && (query.BranchId == null || x.BranchId == query.BranchId))
            .CountAsync(ct);

        var items = await db.OrderItems.AsNoTracking()
            .Where(x => !x.IsDeleted && (x.Status == "pending" || x.Status == "preparing" || x.Status == "ready"))
            .Join(db.Orders.AsNoTracking(), i => i.OrderId, o => o.Id, (i, o) => new { i.Status, o.BranchId })
            .Where(x => query.BranchId == null || x.BranchId == query.BranchId)
            .Select(x => x.Status)
            .ToListAsync(ct);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var todayFrom = ReportAggregation.StartOf(today);
        var todayTo = ReportAggregation.EndOfExclusive(today);

        var raw = await db.OrderItems.AsNoTracking()
            .Where(i => !i.IsDeleted && i.ReadyAt != null && i.CreatedAt >= todayFrom && i.CreatedAt < todayTo)
            .Join(db.Orders.AsNoTracking(), i => i.OrderId, o => o.Id,
                (i, o) => new { i.MenuItemId, i.ItemName, i.CreatedAt, ReadyAt = i.ReadyAt!.Value, o.BranchId })
            .Where(x => query.BranchId == null || x.BranchId == query.BranchId)
            .ToListAsync(ct);

        var byItem = raw.GroupBy(x => x.MenuItemId)
            .Select(g =>
            {
                var minutes = g.Select(x => (x.ReadyAt - x.CreatedAt).TotalMinutes).OrderBy(m => m).ToList();
                var p90Index = Math.Max(0, (int)Math.Ceiling(minutes.Count * 0.9) - 1);
                return new KitchenPrepTimeRow(g.Key, g.First().ItemName, minutes.Count,
                    Math.Round(minutes.Average(), 1), Math.Round(minutes[p90Index], 1));
            })
            .OrderByDescending(r => r.AvgPrepMinutes)
            .Take(5)
            .ToList();

        var dto = new KitchenDashboardDto(
            ActiveTickets: orders,
            PendingItems: items.Count(s => s == "pending"),
            PreparingItems: items.Count(s => s == "preparing"),
            ReadyItems: items.Count(s => s == "ready"),
            AvgPrepMinutesToday: raw.Count == 0 ? 0 : Math.Round(raw.Average(x => (x.ReadyAt - x.CreatedAt).TotalMinutes), 1),
            SlowestItemsToday: byItem);

        return Result.Success(dto);
    }
}
