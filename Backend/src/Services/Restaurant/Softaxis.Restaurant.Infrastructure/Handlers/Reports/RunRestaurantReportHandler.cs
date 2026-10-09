using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Reports.Dtos;
using Softaxis.Restaurant.Application.Reports.Queries;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Reports;

/// <summary>
/// Runs one restaurant report by id for the central Reports hub, in the same tabular shape the
/// retail POS reports use (columns + rows keyed by column name).
///
/// Sales figures count PAID orders only. Days and hours are the caller's local ones: order times are
/// stored in UTC, so the range and every bucket are shifted by the caller's UTC offset.
/// </summary>
internal sealed class RunRestaurantReportHandler(RestaurantDbContext db)
    : IQueryHandler<RunRestaurantReportQuery, TabularReportDto>
{
    private sealed record Ctx(DateTime FromUtc, DateTime ToUtc, TimeSpan Offset, string? OrderType, string? Status)
    {
        public DateTime Local(DateTime utc) => utc + Offset;
        public string Day(DateTime utc) => Local(utc).ToString("yyyy-MM-dd");
        public string Stamp(DateTime utc) => Local(utc).ToString("yyyy-MM-dd HH:mm");
    }

    private sealed record Sale(
        Guid Id, string OrderNumber, string TableNumber, string Waiter, int Covers, string OrderType,
        decimal SubTotal, decimal TaxAmount, decimal DiscountAmount, decimal Total, decimal TipAmount,
        Guid? SessionId, DateTime CreatedAt, DateTime UpdatedAt);

    public async Task<Result<TabularReportDto>> Handle(RunRestaurantReportQuery q, CancellationToken ct)
    {
        var offset = TimeSpan.FromMinutes(Math.Clamp(q.UtcOffsetMinutes, -14 * 60, 14 * 60));
        var orderType = string.IsNullOrWhiteSpace(q.OrderType) || q.OrderType == "all" ? null : q.OrderType;
        var status = string.IsNullOrWhiteSpace(q.Status) || q.Status == "all" ? null : q.Status;
        var c = new Ctx(q.From.ToDateTime(TimeOnly.MinValue) - offset,
                        q.To.AddDays(1).ToDateTime(TimeOnly.MinValue) - offset, offset, orderType, status);

        Task<TabularReportDto>? run = q.ReportId switch
        {
            "restaurant-shift-summary"        => ShiftSummaryAsync(c, ct),
            "restaurant-daily-sales"          => DailySalesAsync(c, ct),
            "restaurant-item-performance"     => ItemPerformanceAsync(c, ct),
            "restaurant-category-sales"       => CategorySalesAsync(c, ct),
            "restaurant-waiter-performance"   => WaiterPerformanceAsync(c, ct),
            "restaurant-payment-analysis"     => PaymentAnalysisAsync(c, ct),
            "restaurant-void-refund"          => VoidRefundAsync(c, ct),
            "restaurant-discount-analysis"    => DiscountAnalysisAsync(c, ct),
            "restaurant-hourly-sales"         => HourlySalesAsync(c, ct),
            "restaurant-order-type"           => OrderTypeAsync(c, ct),
            "restaurant-table-turnover"       => TableTurnoverAsync(c, ct),
            "restaurant-kitchen-prep"         => KitchenPrepAsync(c, ct),
            "restaurant-tax-summary"          => TaxSummaryAsync(c, ct),
            "restaurant-order-register"       => OrderRegisterAsync(c, ct),
            "restaurant-delivery-performance" => DeliveryPerformanceAsync(c, ct),
            "restaurant-tips"                 => TipsAsync(c, ct),
            "restaurant-modifier-sales"       => ModifierSalesAsync(c, ct),
            _ => null,
        };

        return run is null
            ? Result.Failure<TabularReportDto>(Error.Custom("Report.NotFound", $"Unknown restaurant report '{q.ReportId}'."))
            : Result.Success(await run);
    }

    // ── Shared ──────────────────────────────────────────────────────────────────

    private static TabularReportDto Build(string[] cols, IEnumerable<object?[]> rows)
    {
        var list = rows.Select(r =>
        {
            var d = new Dictionary<string, object?>(cols.Length);
            for (var i = 0; i < cols.Length; i++) d[cols[i]] = r[i];
            return d;
        }).ToList();
        return new TabularReportDto(cols, list, list.Count);
    }

    private static decimal R(decimal v) => Math.Round(v, 2);
    private static decimal Pct(decimal part, decimal whole) => whole == 0 ? 0 : Math.Round(part / whole * 100, 1);
    private static decimal Avg(decimal total, int n) => n == 0 ? 0 : Math.Round(total / n, 2);

    private static string TypeLabel(string t) => t switch
    {
        "dine_in" => "Dine-in", "takeaway" => "Takeaway", "delivery" => "Delivery", _ => t,
    };

    /// <summary>Paid orders in the range. A split parent is "paid" with nothing on it — its guests'
    /// bills are the real sales — so empty orders are left out rather than counted twice.</summary>
    private IQueryable<Order> PaidQuery(Ctx c) =>
        db.Orders.AsNoTracking().Where(o => !o.IsDeleted && o.Status == "paid"
            && o.CreatedAt >= c.FromUtc && o.CreatedAt < c.ToUtc
            && (o.SubTotal != 0 || o.Total != 0)
            && (c.OrderType == null || o.OrderType == c.OrderType));

    private async Task<List<Sale>> SalesAsync(Ctx c, CancellationToken ct) =>
        await PaidQuery(c)
            .Select(o => new Sale(o.Id, o.OrderNumber, o.TableNumber, o.Waiter, o.Covers, o.OrderType,
                o.SubTotal, o.TaxAmount, o.DiscountAmount, o.Total, o.TipAmount, o.SessionId, o.CreatedAt, o.UpdatedAt))
            .ToListAsync(ct);

    private sealed class NameRow { public Guid Id { get; set; } public string? Name { get; set; } }

    /// <summary>Staff names by login id — Restaurant stores only the id on voids, discounts and refunds.</summary>
    private async Task<Dictionary<Guid, string>> UserNamesAsync(CancellationToken ct)
    {
        int bypass = TenantAmbient.BypassFilter ? 1 : 0;
        Guid tenant = TenantAmbient.TenantId ?? Guid.Empty;
        var rows = await db.Database
            .SqlQuery<NameRow>($"""
                SELECT u.Id, LTRIM(RTRIM(CONCAT(u.FirstName, ' ', u.LastName))) AS Name
                FROM [identity].[users] u
                WHERE ({bypass} = 1 OR u.TenantId = {tenant})
                """)
            .ToListAsync(ct);
        return rows.ToDictionary(r => r.Id, r => string.IsNullOrWhiteSpace(r.Name) ? "—" : r.Name!);
    }

    private static string Who(Dictionary<Guid, string> names, Guid id) => names.GetValueOrDefault(id, "—");

    // ── Reports ─────────────────────────────────────────────────────────────────

    private async Task<TabularReportDto> ShiftSummaryAsync(Ctx c, CancellationToken ct)
    {
        var shifts = (await PosSessionLedger.GetRecentSessionsAsync(db, 1000, ct))
            .Where(s => s.OpenedAt >= c.FromUtc && s.OpenedAt < c.ToUtc).ToList();
        var ids = shifts.Select(s => s.Id).ToList();

        var orders = await db.Orders.AsNoTracking()
            .Where(o => !o.IsDeleted && o.Status == "paid" && o.SessionId != null && ids.Contains(o.SessionId.Value))
            .Select(o => new { o.Id, SessionId = o.SessionId!.Value, o.SubTotal, o.DiscountAmount, o.TaxAmount, o.TipAmount, o.Total })
            .ToListAsync(ct);
        var orderIds = orders.Select(o => o.Id).ToList();
        var refunds = await db.OrderRefunds.AsNoTracking()
            .Where(r => orderIds.Contains(r.OrderId))
            .Select(r => new { r.OrderId, r.Amount }).ToListAsync(ct);
        var refundByOrder = refunds.GroupBy(r => r.OrderId).ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));
        var byShift = orders.ToLookup(o => o.SessionId);

        string[] cols = ["Opened", "Closed", "Cashier", "Terminal", "Status", "Orders", "Gross Sales", "Discounts", "Tax", "Tips", "Refunds", "Net Sales"];
        return Build(cols, shifts.Select(s =>
        {
            var os = byShift[s.Id].ToList();
            var refunded = os.Sum(o => refundByOrder.GetValueOrDefault(o.Id));
            return new object?[]
            {
                c.Stamp(s.OpenedAt), s.ClosedAt is null ? "—" : c.Stamp(s.ClosedAt.Value), s.CashierName ?? "—", s.RegisterId ?? "—",
                s.Status == 1 ? "Open" : "Closed", os.Count, R(os.Sum(o => o.SubTotal)), R(os.Sum(o => o.DiscountAmount)),
                R(os.Sum(o => o.TaxAmount)), R(os.Sum(o => o.TipAmount)), R(refunded), R(os.Sum(o => o.Total) - refunded),
            };
        }));
    }

    private async Task<TabularReportDto> DailySalesAsync(Ctx c, CancellationToken ct)
    {
        var sales = await SalesAsync(c, ct);
        string[] cols = ["Date", "Orders", "Guests", "Gross Sales", "Discounts", "Tax", "Tips", "Net Sales", "Avg Bill"];
        return Build(cols, sales.GroupBy(s => c.Day(s.CreatedAt)).OrderBy(g => g.Key).Select(g => new object?[]
        {
            g.Key, g.Count(), g.Sum(x => x.Covers), R(g.Sum(x => x.SubTotal)), R(g.Sum(x => x.DiscountAmount)),
            R(g.Sum(x => x.TaxAmount)), R(g.Sum(x => x.TipAmount)), R(g.Sum(x => x.Total)), Avg(g.Sum(x => x.Total), g.Count()),
        }));
    }

    private sealed record Line(Guid MenuItemId, string ItemName, int Quantity, decimal UnitPrice, Guid CategoryId);

    private async Task<List<Line>> LinesAsync(Ctx c, CancellationToken ct) =>
        await (from i in db.OrderItems.AsNoTracking()
               where !i.IsDeleted
               join o in PaidQuery(c) on i.OrderId equals o.Id
               join m in db.MenuItems.AsNoTracking() on i.MenuItemId equals m.Id
               select new Line(i.MenuItemId, i.ItemName, i.Quantity, i.UnitPrice, m.CategoryId))
            .ToListAsync(ct);

    private async Task<Dictionary<Guid, string>> CategoryNamesAsync(CancellationToken ct) =>
        await db.MenuCategories.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct);

    private async Task<TabularReportDto> ItemPerformanceAsync(Ctx c, CancellationToken ct)
    {
        var lines = await LinesAsync(c, ct);
        var cats = await CategoryNamesAsync(ct);
        var total = lines.Sum(l => l.Quantity * l.UnitPrice);
        string[] cols = ["Item", "Category", "Qty Sold", "Revenue", "Avg Price", "% of Sales"];
        return Build(cols, lines.GroupBy(l => l.MenuItemId)
            .Select(g => new { Name = g.First().ItemName, Cat = cats.GetValueOrDefault(g.First().CategoryId, "—"), Qty = g.Sum(x => x.Quantity), Rev = g.Sum(x => x.Quantity * x.UnitPrice) })
            .OrderByDescending(x => x.Rev)
            .Select(x => new object?[] { x.Name, x.Cat, x.Qty, R(x.Rev), Avg(x.Rev, x.Qty), Pct(x.Rev, total) }));
    }

    private async Task<TabularReportDto> CategorySalesAsync(Ctx c, CancellationToken ct)
    {
        var lines = await LinesAsync(c, ct);
        var cats = await CategoryNamesAsync(ct);
        var total = lines.Sum(l => l.Quantity * l.UnitPrice);
        string[] cols = ["Category", "Items Sold", "Different Dishes", "Revenue", "% of Sales"];
        return Build(cols, lines.GroupBy(l => l.CategoryId)
            .Select(g => new { Name = cats.GetValueOrDefault(g.Key, "—"), Qty = g.Sum(x => x.Quantity), Dishes = g.Select(x => x.MenuItemId).Distinct().Count(), Rev = g.Sum(x => x.Quantity * x.UnitPrice) })
            .OrderByDescending(x => x.Rev)
            .Select(x => new object?[] { x.Name, x.Qty, x.Dishes, R(x.Rev), Pct(x.Rev, total) }));
    }

    private async Task<TabularReportDto> WaiterPerformanceAsync(Ctx c, CancellationToken ct)
    {
        // A delivery order keeps the customer's name in the waiter field, so it is not staff performance.
        var sales = (await SalesAsync(c, ct)).Where(s => s.OrderType != "delivery").ToList();
        string[] cols = ["Waiter", "Orders", "Guests", "Revenue", "Tips", "Avg Bill"];
        return Build(cols, sales.GroupBy(s => string.IsNullOrWhiteSpace(s.Waiter) ? "—" : s.Waiter.Trim())
            .OrderByDescending(g => g.Sum(x => x.Total))
            .Select(g => new object?[] { g.Key, g.Count(), g.Sum(x => x.Covers), R(g.Sum(x => x.Total)), R(g.Sum(x => x.TipAmount)), Avg(g.Sum(x => x.Total), g.Count()) }));
    }

    private async Task<TabularReportDto> PaymentAnalysisAsync(Ctx c, CancellationToken ct)
    {
        var pays = await (from p in db.OrderPayments.AsNoTracking()
                          join o in PaidQuery(c) on p.OrderId equals o.Id
                          select new { p.Method, p.Amount }).ToListAsync(ct);
        var total = pays.Sum(p => p.Amount);
        string[] cols = ["Payment Method", "Payments", "Amount", "% of Total", "Avg Payment"];
        return Build(cols, pays.GroupBy(p => p.Method).OrderByDescending(g => g.Sum(x => x.Amount))
            .Select(g => new object?[] { g.Key, g.Count(), R(g.Sum(x => x.Amount)), Pct(g.Sum(x => x.Amount), total), Avg(g.Sum(x => x.Amount), g.Count()) }));
    }

    private async Task<TabularReportDto> VoidRefundAsync(Ctx c, CancellationToken ct)
    {
        var names = await UserNamesAsync(ct);
        var voids = await (from v in db.OrderVoidLogs.AsNoTracking()
                           where v.CreatedAt >= c.FromUtc && v.CreatedAt < c.ToUtc
                           join o in db.Orders.AsNoTracking() on v.OrderId equals o.Id
                           where c.OrderType == null || o.OrderType == c.OrderType
                           select new { v.CreatedAt, o.OrderNumber, v.OrderItemId, v.Reason, v.VoidedByUserId, o.SubTotal }).ToListAsync(ct);
        var itemIds = voids.Where(v => v.OrderItemId != null).Select(v => v.OrderItemId!.Value).ToList();
        var items = await db.OrderItems.AsNoTracking().Where(i => itemIds.Contains(i.Id))
            .Select(i => new { i.Id, i.ItemName, i.Quantity, i.UnitPrice }).ToDictionaryAsync(i => i.Id, ct);
        var refunds = await (from r in db.OrderRefunds.AsNoTracking()
                             where r.CreatedAt >= c.FromUtc && r.CreatedAt < c.ToUtc
                             join o in db.Orders.AsNoTracking() on r.OrderId equals o.Id
                             where c.OrderType == null || o.OrderType == c.OrderType
                             select new { r.CreatedAt, o.OrderNumber, r.Amount, r.Reason, r.Method, r.RefundedByUserId }).ToListAsync(ct);

        var rows = voids.Select(v =>
        {
            var item = v.OrderItemId is { } id && items.TryGetValue(id, out var it) ? it : null;
            return new { v.CreatedAt, Row = new object?[]
            {
                c.Stamp(v.CreatedAt), v.OrderNumber, v.OrderItemId == null ? "Order cancelled" : "Item void",
                item is null ? "—" : $"{item.Quantity} × {item.ItemName}",
                R(item is null ? (v.OrderItemId == null ? v.SubTotal : 0) : item.Quantity * item.UnitPrice),
                v.Reason, Who(names, v.VoidedByUserId),
            } };
        }).Concat(refunds.Select(r => new { r.CreatedAt, Row = new object?[]
        {
            c.Stamp(r.CreatedAt), r.OrderNumber, "Refund", r.Method, R(r.Amount), r.Reason, Who(names, r.RefundedByUserId),
        } }));

        string[] cols = ["Date", "Order", "Type", "Item / Method", "Amount", "Reason", "By"];
        return Build(cols, rows.OrderByDescending(x => x.CreatedAt).Select(x => x.Row));
    }

    private async Task<TabularReportDto> DiscountAnalysisAsync(Ctx c, CancellationToken ct)
    {
        var names = await UserNamesAsync(ct);
        var rows = await (from d in db.OrderDiscounts.AsNoTracking()
                          where d.CreatedAt >= c.FromUtc && d.CreatedAt < c.ToUtc
                          join o in db.Orders.AsNoTracking() on d.OrderId equals o.Id
                          where c.OrderType == null || o.OrderType == c.OrderType
                          orderby d.CreatedAt descending
                          select new { d.CreatedAt, o.OrderNumber, d.Type, d.Amount, d.Reason, d.AppliedByUserId, d.ApprovedByUserId, d.IsVoided, o.SubTotal }).ToListAsync(ct);
        string[] cols = ["Date", "Order", "Type", "Discount", "% of Bill", "Reason", "Applied By", "Approved By", "Status"];
        return Build(cols, rows.Select(d => new object?[]
        {
            c.Stamp(d.CreatedAt), d.OrderNumber, d.Type, R(d.Amount), Pct(d.Amount, d.SubTotal), d.Reason,
            Who(names, d.AppliedByUserId), d.ApprovedByUserId is { } a ? Who(names, a) : "—", d.IsVoided ? "Removed" : "Applied",
        }));
    }

    private async Task<TabularReportDto> HourlySalesAsync(Ctx c, CancellationToken ct)
    {
        var sales = await SalesAsync(c, ct);
        var total = sales.Sum(s => s.Total);
        string[] cols = ["Hour", "Orders", "Guests", "Sales", "Avg Bill", "% of Sales"];
        return Build(cols, sales.GroupBy(s => c.Local(s.CreatedAt).Hour).OrderBy(g => g.Key).Select(g => new object?[]
        {
            $"{g.Key:00}:00 – {(g.Key + 1) % 24:00}:00", g.Count(), g.Sum(x => x.Covers), R(g.Sum(x => x.Total)),
            Avg(g.Sum(x => x.Total), g.Count()), Pct(g.Sum(x => x.Total), total),
        }));
    }

    private async Task<TabularReportDto> OrderTypeAsync(Ctx c, CancellationToken ct)
    {
        var sales = await SalesAsync(c, ct);
        var total = sales.Sum(s => s.Total);
        string[] cols = ["Order Type", "Orders", "Gross Sales", "Discounts", "Tax", "Net Sales", "Avg Bill", "% of Sales"];
        return Build(cols, sales.GroupBy(s => s.OrderType).OrderByDescending(g => g.Sum(x => x.Total)).Select(g => new object?[]
        {
            TypeLabel(g.Key), g.Count(), R(g.Sum(x => x.SubTotal)), R(g.Sum(x => x.DiscountAmount)), R(g.Sum(x => x.TaxAmount)),
            R(g.Sum(x => x.Total)), Avg(g.Sum(x => x.Total), g.Count()), Pct(g.Sum(x => x.Total), total),
        }));
    }

    private async Task<TabularReportDto> TableTurnoverAsync(Ctx c, CancellationToken ct)
    {
        var sales = (await SalesAsync(c, ct)).Where(s => s.OrderType == "dine_in").ToList();
        string[] cols = ["Table", "Times Used", "Guests", "Revenue", "Avg Bill", "Avg Minutes Occupied"];
        return Build(cols, sales.GroupBy(s => s.TableNumber).OrderByDescending(g => g.Count()).Select(g => new object?[]
        {
            g.Key, g.Count(), g.Sum(x => x.Covers), R(g.Sum(x => x.Total)), Avg(g.Sum(x => x.Total), g.Count()),
            Math.Round(g.Average(x => Math.Max(0, (x.UpdatedAt - x.CreatedAt).TotalMinutes)), 0),
        }));
    }

    private async Task<TabularReportDto> KitchenPrepAsync(Ctx c, CancellationToken ct)
    {
        // Only dishes the kitchen marked ready have a timing to report.
        var items = await db.OrderItems.AsNoTracking()
            .Where(i => !i.IsDeleted && i.ReadyAt != null && i.CreatedAt >= c.FromUtc && i.CreatedAt < c.ToUtc)
            .Select(i => new { i.ItemName, i.CreatedAt, ReadyAt = i.ReadyAt!.Value }).ToListAsync(ct);
        string[] cols = ["Item", "Times Prepared", "Avg Minutes", "Fastest", "Slowest"];
        return Build(cols, items.GroupBy(i => i.ItemName)
            .Select(g => new { g.Key, Mins = g.Select(x => Math.Max(0, (x.ReadyAt - x.CreatedAt).TotalMinutes)).ToList() })
            .OrderByDescending(x => x.Mins.Average())
            .Select(x => new object?[] { x.Key, x.Mins.Count, Math.Round(x.Mins.Average(), 1), Math.Round(x.Mins.Min(), 1), Math.Round(x.Mins.Max(), 1) }));
    }

    private async Task<TabularReportDto> TaxSummaryAsync(Ctx c, CancellationToken ct)
    {
        var sales = await SalesAsync(c, ct);
        string[] cols = ["Date", "Orders", "Taxable Amount", "Tax Collected", "Total incl. Tax", "Effective Rate %"];
        return Build(cols, sales.GroupBy(s => c.Day(s.CreatedAt)).OrderBy(g => g.Key).Select(g =>
        {
            var taxable = g.Sum(x => x.SubTotal - x.DiscountAmount);
            var tax = g.Sum(x => x.TaxAmount);
            return new object?[] { g.Key, g.Count(), R(taxable), R(tax), R(g.Sum(x => x.Total)), Pct(tax, taxable) };
        }));
    }

    private async Task<TabularReportDto> OrderRegisterAsync(Ctx c, CancellationToken ct)
    {
        // Every order, not just paid ones — this is the register an auditor walks through.
        var rows = await db.Orders.AsNoTracking()
            .Where(o => !o.IsDeleted && o.CreatedAt >= c.FromUtc && o.CreatedAt < c.ToUtc
                && (c.OrderType == null || o.OrderType == c.OrderType)
                && (c.Status == null || o.Status == c.Status))
            .OrderBy(o => o.CreatedAt)
            .Select(o => new { o.OrderNumber, o.CreatedAt, o.OrderType, o.TableNumber, o.Waiter, o.Status, o.SubTotal, o.DiscountAmount, o.TaxAmount, o.TipAmount, o.Total, o.AmountPaid, o.PaymentMethod })
            .ToListAsync(ct);
        string[] cols = ["Order", "Date", "Type", "Table", "Waiter / Customer", "Status", "Subtotal", "Discount", "Tax", "Tip", "Total", "Paid", "Payment"];
        return Build(cols, rows.Select(o => new object?[]
        {
            o.OrderNumber, c.Stamp(o.CreatedAt), TypeLabel(o.OrderType), o.TableNumber, o.Waiter, o.Status,
            R(o.SubTotal), R(o.DiscountAmount), R(o.TaxAmount), R(o.TipAmount), R(o.Total), R(o.AmountPaid), o.PaymentMethod ?? "—",
        }));
    }

    private async Task<TabularReportDto> DeliveryPerformanceAsync(Ctx c, CancellationToken ct)
    {
        var legs = await (from d in db.DeliveryOrders.AsNoTracking()
                          where !d.IsDeleted && d.CreatedAt >= c.FromUtc && d.CreatedAt < c.ToUtc
                          join o in db.Orders.AsNoTracking() on d.OrderId equals o.Id
                          select new { d.DriverId, d.Status, d.CreatedAt, d.DeliveredAt, d.DeliveryFee, o.Total }).ToListAsync(ct);
        var drivers = await db.Drivers.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        string[] cols = ["Rider", "Deliveries", "Delivered", "Failed", "In Progress", "Avg Minutes", "Delivery Fees", "Order Value"];
        return Build(cols, legs.GroupBy(l => l.DriverId is { } id ? drivers.GetValueOrDefault(id, "—") : "Unassigned")
            .OrderByDescending(g => g.Count()).Select(g =>
            {
                var done = g.Where(x => x.Status == "delivered" && x.DeliveredAt != null).ToList();
                return new object?[]
                {
                    g.Key, g.Count(), g.Count(x => x.Status == "delivered"), g.Count(x => x.Status == "failed"),
                    g.Count(x => x.Status != "delivered" && x.Status != "failed"),
                    done.Count == 0 ? null : Math.Round(done.Average(x => Math.Max(0, (x.DeliveredAt!.Value - x.CreatedAt).TotalMinutes)), 0),
                    R(g.Sum(x => x.DeliveryFee)), R(g.Sum(x => x.Total)),
                };
            }));
    }

    private async Task<TabularReportDto> TipsAsync(Ctx c, CancellationToken ct)
    {
        var sales = (await SalesAsync(c, ct)).Where(s => s.TipAmount > 0).ToList();
        string[] cols = ["Date", "Waiter", "Orders with Tip", "Tips", "Sales", "Tip %"];
        return Build(cols, sales.GroupBy(s => new { Day = c.Day(s.CreatedAt), Waiter = s.OrderType == "delivery" ? "Delivery" : s.Waiter })
            .OrderBy(g => g.Key.Day).ThenByDescending(g => g.Sum(x => x.TipAmount))
            .Select(g => new object?[] { g.Key.Day, g.Key.Waiter, g.Count(), R(g.Sum(x => x.TipAmount)), R(g.Sum(x => x.Total)), Pct(g.Sum(x => x.TipAmount), g.Sum(x => x.Total)) }));
    }

    private async Task<TabularReportDto> ModifierSalesAsync(Ctx c, CancellationToken ct)
    {
        var mods = await (from m in db.OrderItemModifiers.AsNoTracking()
                          join i in db.OrderItems.AsNoTracking() on m.OrderItemId equals i.Id
                          where !i.IsDeleted
                          join o in PaidQuery(c) on i.OrderId equals o.Id
                          select new { m.Name, m.PriceDelta, i.Quantity, i.ItemName }).ToListAsync(ct);
        string[] cols = ["Add-on / Option", "Times Chosen", "Extra Revenue", "Most Chosen With"];
        return Build(cols, mods.GroupBy(m => m.Name).OrderByDescending(g => g.Sum(x => x.Quantity)).Select(g => new object?[]
        {
            g.Key, g.Sum(x => x.Quantity), R(g.Sum(x => x.Quantity * x.PriceDelta)),
            g.GroupBy(x => x.ItemName).OrderByDescending(x => x.Sum(y => y.Quantity)).First().Key,
        }));
    }
}
