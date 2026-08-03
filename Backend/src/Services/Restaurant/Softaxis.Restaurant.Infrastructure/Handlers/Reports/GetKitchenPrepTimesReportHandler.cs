using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Reports.Dtos;
using Softaxis.Restaurant.Application.Reports.Queries;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Reports;

/// <summary>Only items that actually reached "ready" (ReadyAt set — see Order.MarkReady/Serve cascade
/// and OrderItem.UpdateStatus) are included; items created before this timing was added, or served
/// through a path that never touched status, are naturally absent rather than reported as 0 minutes.</summary>
internal sealed class GetKitchenPrepTimesReportHandler(RestaurantDbContext db)
    : IQueryHandler<GetKitchenPrepTimesReportQuery, IReadOnlyList<KitchenPrepTimeRow>>
{
    public async Task<Result<IReadOnlyList<KitchenPrepTimeRow>>> Handle(GetKitchenPrepTimesReportQuery query, CancellationToken ct)
    {
        var from = ReportAggregation.StartOf(query.From);
        var to = ReportAggregation.EndOfExclusive(query.To);

        var raw = await db.OrderItems.AsNoTracking()
            .Where(i => !i.IsDeleted && i.ReadyAt != null && i.CreatedAt >= from && i.CreatedAt < to)
            .Join(db.Orders.AsNoTracking(), i => i.OrderId, o => o.Id,
                (i, o) => new { i.MenuItemId, i.ItemName, i.CreatedAt, ReadyAt = i.ReadyAt!.Value, o.BranchId })
            .Where(x => query.BranchId == null || x.BranchId == query.BranchId)
            .ToListAsync(ct);

        IReadOnlyList<KitchenPrepTimeRow> result = raw
            .GroupBy(x => x.MenuItemId)
            .Select(g =>
            {
                var minutes = g.Select(x => (x.ReadyAt - x.CreatedAt).TotalMinutes).OrderBy(m => m).ToList();
                var p90Index = Math.Max(0, (int)Math.Ceiling(minutes.Count * 0.9) - 1);
                return new KitchenPrepTimeRow(
                    g.Key, g.First().ItemName, minutes.Count,
                    Math.Round(minutes.Average(), 1), Math.Round(minutes[p90Index], 1));
            })
            .OrderByDescending(r => r.AvgPrepMinutes)
            .ToList();

        return Result.Success(result);
    }
}
