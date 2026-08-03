using Microsoft.EntityFrameworkCore;
using Softaxis.Restaurant.Application.Reports.Dtos;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Common;

/// <summary>Shared query building blocks for the reporting handlers (Epic 8) — avoids repeating the
/// same "paid orders in range, optionally scoped to a branch" filter across every sales-derived
/// report.</summary>
internal static class ReportAggregation
{
    public static IQueryable<Order> PaidOrdersInRange(RestaurantDbContext db, DateTime from, DateTime toExclusive, Guid? branchId) =>
        db.Orders.AsNoTracking().Where(o => !o.IsDeleted && o.Status == "paid"
            && o.CreatedAt >= from && o.CreatedAt < toExclusive
            && (branchId == null || o.BranchId == branchId));

    public static DateTime StartOf(DateOnly date) => date.ToDateTime(TimeOnly.MinValue);

    /// <summary>Exclusive upper bound — the day after <paramref name="date"/> at midnight, so the
    /// range check `&lt; toExclusive` includes every moment of the "to" day.</summary>
    public static DateTime EndOfExclusive(DateOnly date) => date.AddDays(1).ToDateTime(TimeOnly.MinValue);

    /// <summary>Builds the Z/X-report shape for one POS session — shared by GetSessionReportHandler
    /// (the standalone report endpoint) and the cashier dashboard (which embeds the same snapshot for
    /// the acting cashier's current shift). Every order tied to this SessionId counts, not just
    /// currently-paid ones for VoidCount/VoidValue, since a Z-report reconciles the whole shift.</summary>
    public static async Task<SessionReportDto> BuildSessionReportAsync(RestaurantDbContext db, Guid sessionId, CancellationToken ct)
    {
        var statusLabel = await PosSessionLedger.GetStatusLabelAsync(db, sessionId, ct) ?? "unknown";

        var orders = await db.Orders.AsNoTracking()
            .Where(o => !o.IsDeleted && o.SessionId == sessionId)
            .Select(o => new { o.Id, o.Status, o.SubTotal, o.TaxAmount, o.DiscountAmount, o.Total, o.TipAmount })
            .ToListAsync(ct);
        var orderIds = orders.Select(o => o.Id).ToList();

        var paymentBreakdown = await db.OrderPayments.AsNoTracking()
            .Where(p => orderIds.Contains(p.OrderId))
            .GroupBy(p => p.Method)
            .Select(g => new { Method = g.Key, Total = g.Sum(x => x.Amount) })
            .ToListAsync(ct);

        var refundsTotal = await db.OrderRefunds.AsNoTracking()
            .Where(r => orderIds.Contains(r.OrderId))
            .SumAsync(r => r.Amount, ct);

        var voidCount = await db.OrderVoidLogs.AsNoTracking()
            .Where(v => orderIds.Contains(v.OrderId))
            .CountAsync(ct);

        var itemVoidValue = await db.OrderVoidLogs.AsNoTracking()
            .Where(v => v.OrderItemId != null && orderIds.Contains(v.OrderId))
            .Join(db.OrderItems.AsNoTracking(), v => v.OrderItemId!.Value, i => i.Id, (v, i) => i.Quantity * i.UnitPrice)
            .SumAsync(ct);
        var orderVoidValue = await db.OrderVoidLogs.AsNoTracking()
            .Where(v => v.OrderItemId == null && orderIds.Contains(v.OrderId))
            .Join(db.Orders.AsNoTracking(), v => v.OrderId, o => o.Id, (v, o) => o.SubTotal)
            .SumAsync(ct);

        var paidOrders = orders.Where(o => o.Status == "paid").ToList();

        return new SessionReportDto(
            SessionId: sessionId,
            SessionStatus: statusLabel,
            OrderCount: paidOrders.Count,
            GrossSales: paidOrders.Sum(o => o.SubTotal),
            Discounts: paidOrders.Sum(o => o.DiscountAmount),
            Tax: paidOrders.Sum(o => o.TaxAmount),
            Tips: paidOrders.Sum(o => o.TipAmount),
            Refunds: refundsTotal,
            NetSales: paidOrders.Sum(o => o.Total) - refundsTotal,
            VoidCount: voidCount,
            VoidValue: itemVoidValue + orderVoidValue,
            PaymentMethodBreakdown: paymentBreakdown.ToDictionary(x => x.Method, x => x.Total));
    }

    /// <summary>Total void value (item-level + whole-order) in a date range — shared by the
    /// voids/discounts report and the owner dashboard's fraud-signal summary tile.</summary>
    public static async Task<decimal> GetVoidValueInRangeAsync(RestaurantDbContext db, DateTime from, DateTime toExclusive, Guid? branchId, CancellationToken ct)
    {
        var itemVoidValue = await db.OrderVoidLogs.AsNoTracking()
            .Where(v => v.OrderItemId != null && v.CreatedAt >= from && v.CreatedAt < toExclusive)
            .Join(db.OrderItems.AsNoTracking(), v => v.OrderItemId!.Value, i => i.Id, (v, i) => new { v.OrderId, Value = i.Quantity * i.UnitPrice })
            .Join(db.Orders.AsNoTracking(), x => x.OrderId, o => o.Id, (x, o) => new { x.Value, o.BranchId })
            .Where(x => branchId == null || x.BranchId == branchId)
            .SumAsync(x => x.Value, ct);

        var orderVoidValue = await db.OrderVoidLogs.AsNoTracking()
            .Where(v => v.OrderItemId == null && v.CreatedAt >= from && v.CreatedAt < toExclusive)
            .Join(db.Orders.AsNoTracking(), v => v.OrderId, o => o.Id, (v, o) => new { Value = o.SubTotal, o.BranchId })
            .Where(x => branchId == null || x.BranchId == branchId)
            .SumAsync(x => x.Value, ct);

        return itemVoidValue + orderVoidValue;
    }

    /// <summary>Top-N categories by revenue over a range — shared by GetSalesByCategoryReportHandler
    /// and the owner dashboard's weekly snapshot.</summary>
    public static async Task<IReadOnlyList<SalesByCategoryRow>> TopCategoriesAsync(
        RestaurantDbContext db, DateTime from, DateTime toExclusive, Guid? branchId, int take, CancellationToken ct)
    {
        var orders = PaidOrdersInRange(db, from, toExclusive, branchId);

        var lines = await db.OrderItems.AsNoTracking()
            .Where(i => !i.IsDeleted)
            .Join(orders, i => i.OrderId, o => o.Id, (i, _) => i)
            .Join(db.MenuItems.AsNoTracking(), i => i.MenuItemId, m => m.Id, (i, m) => new { i.Quantity, i.UnitPrice, m.CategoryId })
            .GroupBy(x => x.CategoryId)
            .Select(g => new { CategoryId = g.Key, Qty = g.Sum(x => x.Quantity), Revenue = g.Sum(x => x.Quantity * x.UnitPrice) })
            .ToListAsync(ct);

        var categoryNames = await db.MenuCategories.AsNoTracking()
            .Where(c => !c.IsDeleted)
            .ToDictionaryAsync(c => c.Id, c => c.Name, ct);

        return lines
            .Select(l => new SalesByCategoryRow(l.CategoryId, categoryNames.GetValueOrDefault(l.CategoryId, "—"), l.Qty, l.Revenue))
            .OrderByDescending(r => r.Revenue)
            .Take(take)
            .ToList();
    }
}
