using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Reports.Dtos;
using Softaxis.Restaurant.Application.Reports.Queries;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Reports;

/// <summary>Fraud-signal report — void/discount value grouped by the acting user, scoped by when the
/// void/discount itself happened (not the order's current status — a voided-then-cancelled order
/// still counts, unlike the sales reports which only look at currently-paid orders).</summary>
internal sealed class GetVoidsDiscountsReportHandler(RestaurantDbContext db)
    : IQueryHandler<GetVoidsDiscountsReportQuery, IReadOnlyList<VoidsAndDiscountsRow>>
{
    public async Task<Result<IReadOnlyList<VoidsAndDiscountsRow>>> Handle(GetVoidsDiscountsReportQuery query, CancellationToken ct)
    {
        var from = ReportAggregation.StartOf(query.From);
        var to = ReportAggregation.EndOfExclusive(query.To);

        // Item-level voids — OrderVoidLog carries no value at void time, so the value is recovered
        // from the (now soft-deleted) OrderItem row it points at, which EF still returns here since
        // TenantIsolation overwrites OrderItem's own !IsDeleted filter (this codebase's usual gotcha).
        var itemVoids = await db.OrderVoidLogs.AsNoTracking()
            .Where(v => v.OrderItemId != null && v.CreatedAt >= from && v.CreatedAt < to)
            .Join(db.OrderItems.AsNoTracking(), v => v.OrderItemId!.Value, i => i.Id, (v, i) => new { v.VoidedByUserId, v.OrderId, Value = i.Quantity * i.UnitPrice })
            .Join(db.Orders.AsNoTracking(), x => x.OrderId, o => o.Id, (x, o) => new { x.VoidedByUserId, x.Value, o.BranchId })
            .Where(x => query.BranchId == null || x.BranchId == query.BranchId)
            .Select(x => new { x.VoidedByUserId, x.Value })
            .ToListAsync(ct);

        // Whole-order voids — the order's SubTotal at the time is the closest available "value voided".
        var orderVoids = await db.OrderVoidLogs.AsNoTracking()
            .Where(v => v.OrderItemId == null && v.CreatedAt >= from && v.CreatedAt < to)
            .Join(db.Orders.AsNoTracking(), v => v.OrderId, o => o.Id, (v, o) => new { v.VoidedByUserId, Value = o.SubTotal, o.BranchId })
            .Where(x => query.BranchId == null || x.BranchId == query.BranchId)
            .Select(x => new { x.VoidedByUserId, x.Value })
            .ToListAsync(ct);

        var discounts = await db.OrderDiscounts.AsNoTracking()
            .Where(d => !d.IsVoided && d.CreatedAt >= from && d.CreatedAt < to)
            .Join(db.Orders.AsNoTracking(), d => d.OrderId, o => o.Id, (d, o) => new { d.AppliedByUserId, d.Amount, o.BranchId })
            .Where(x => query.BranchId == null || x.BranchId == query.BranchId)
            .Select(x => new { x.AppliedByUserId, x.Amount })
            .ToListAsync(ct);

        var voidByUser = itemVoids.Select(x => (x.VoidedByUserId, x.Value))
            .Concat(orderVoids.Select(x => (x.VoidedByUserId, x.Value)))
            .GroupBy(x => x.VoidedByUserId)
            .ToDictionary(g => g.Key, g => (Count: g.Count(), Value: g.Sum(x => x.Value)));

        var discByUser = discounts
            .GroupBy(x => x.AppliedByUserId)
            .ToDictionary(g => g.Key, g => (Count: g.Count(), Value: g.Sum(x => x.Amount)));

        var userIds = voidByUser.Keys.Union(discByUser.Keys);

        IReadOnlyList<VoidsAndDiscountsRow> result = userIds
            .Select(id => new VoidsAndDiscountsRow(
                id,
                voidByUser.TryGetValue(id, out var v) ? v.Count : 0,
                voidByUser.TryGetValue(id, out var v2) ? v2.Value : 0,
                discByUser.TryGetValue(id, out var d) ? d.Count : 0,
                discByUser.TryGetValue(id, out var d2) ? d2.Value : 0))
            .OrderByDescending(r => r.VoidValue + r.DiscountValue)
            .ToList();

        return Result.Success(result);
    }
}
