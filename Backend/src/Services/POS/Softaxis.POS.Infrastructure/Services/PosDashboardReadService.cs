using Microsoft.EntityFrameworkCore;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Application.Dashboard;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Enums;
using Softaxis.POS.Infrastructure.Persistence;

namespace Softaxis.POS.Infrastructure.Services;

/// <summary>
/// Every figure is scoped to the caller's tenant by the DbContext's global filter. Soft-delete is
/// applied by hand: the tenant filter replaces any entity-level IsDeleted filter.
/// </summary>
public sealed class PosDashboardReadService(POSDbContext db) : IPosDashboardReadService
{
    /// <summary>The note RefundTransactionCommandHandler writes onto the sale it refunds.</summary>
    private const string RefundedMarker = "Refunded via";

    private const int TopN = 10;

    public async Task<PosOverviewDto> GetOverviewAsync(
        DateTime startUtc, DateTime endUtc, TimeSpan offset, bool hourly, CancellationToken ct = default)
    {
        var length = endUtc - startUtc;

        var current  = await KpisAsync(startUtc, endUtc, ct);
        var previous = await KpisAsync(startUtc - length, startUtc, ct);

        var sales = Sales(InRange(startUtc, endUtc));

        var trend = await TrendAsync(startUtc, endUtc, offset, hourly, ct);

        var payments = await sales
            .SelectMany(t => t.Payments)
            .GroupBy(p => p.Method)
            .Select(g => new { Method = g.Key, Amount = g.Sum(p => p.Amount), Count = g.Count() })
            .ToListAsync(ct);

        // Grouped by (id, name), not by id alone: EF cannot translate an aggregate over a STRING
        // inside a grouped projection (g.Max(li => li.ProductName)), and the whole overview query
        // threw InvalidOperationException because of it — the dashboard 500'd on every call.
        // The name is denormalized onto the line item, so a product renamed between sales yields
        // one row per spelling; they are merged back together in memory below.
        var productRows = await sales
            .SelectMany(t => t.LineItems)
            .GroupBy(li => new { li.ProductId, li.ProductName })
            .Select(g => new
            {
                g.Key.ProductId,
                g.Key.ProductName,
                Quantity = g.Sum(li => li.Quantity),
                Revenue  = g.Sum(li => li.LineTotal),
            })
            .ToListAsync(ct);

        var topProducts = productRows
            .GroupBy(r => r.ProductId)
            .Select(g => new PosTopProductDto(
                g.Key,
                // Most recently-used spelling is not knowable here; the highest-earning one is the
                // most representative, and is stable across runs.
                g.OrderByDescending(r => r.Revenue).First().ProductName ?? "—",
                g.Sum(r => r.Quantity),
                g.Sum(r => r.Revenue)))
            .OrderByDescending(p => p.Revenue)
            .Take(TopN)
            .ToList();

        var cashiers = await sales
            // Projected to an anonymous type, then ordered, then mapped. Ordering by a member of a
            // constructed DTO (OrderByDescending(c => c.Sales) straight off the Select) is not
            // translatable and threw, taking the whole overview down with it.
            .GroupBy(t => t.CashierId)
            .Select(g => new { CashierId = g.Key, Count = g.Count(), Sales = g.Sum(t => t.TotalAmount) })
            .OrderByDescending(x => x.Sales)
            .Take(TopN)
            .ToListAsync(ct);

        // Live state, not range-bound: a dashboard opened now should show who is trading now.
        var openShifts = await db.Sessions.AsNoTracking()
            .Where(s => !s.IsDeleted && (s.Status == SessionStatus.Open || s.Status == SessionStatus.Suspended))
            .OrderBy(s => s.OpenedAt)
            .Select(s => new PosOpenShiftDto(
                s.Id, s.RegisterId, s.CashierId, s.OpenedAt, s.TotalTransactions,
                s.TotalSales - s.TotalRefunds, s.ClientRef != null))
            .ToListAsync(ct);

        var offlineEnabled = await db.PosSettings.AsNoTracking()
            .Where(s => !s.IsDeleted).Select(s => s.OfflineModeEnabled).FirstOrDefaultAsync(ct);

        var tills = offlineEnabled
            ? await db.PosTillStatuses.AsNoTracking()
                .Where(t => !t.IsDeleted && (t.PendingRecords > 0 || t.UnsyncedShifts > 0))
                .OrderBy(t => t.ReportedAt)
                .Select(t => new PosTillBacklogDto(
                    t.DeviceId, t.RegisterId, t.UserName, t.PendingRecords, t.UnsyncedShifts, t.ReportedAt))
                .ToListAsync(ct)
            : [];

        return new PosOverviewDto(
            startUtc.Add(offset).ToString("yyyy-MM-dd"),
            endUtc.Add(offset).AddDays(-1).ToString("yyyy-MM-dd"),
            hourly, current, previous, trend,
            payments.OrderByDescending(p => p.Amount)
                    .Select(p => new PosPaymentMixDto(p.Method.ToString(), p.Amount, p.Count)).ToList(),
            topProducts,
            cashiers.Select(c => new PosCashierDto(c.CashierId, c.Count, c.Sales)).ToList(),
            openShifts, offlineEnabled, tills);
    }

    // ── Definitions (see PosKpisDto) ──────────────────────────────────────────

    private IQueryable<POSTransaction> InRange(DateTime startUtc, DateTime endUtc) =>
        db.Transactions.AsNoTracking()
          .Where(t => !t.IsDeleted && t.CompletedAt >= startUtc && t.CompletedAt < endUtc);

    /// <summary>Sales that brought money in — including ones later refunded (the refund is counted on its own).</summary>
    private static IQueryable<POSTransaction> Sales(IQueryable<POSTransaction> q) =>
        q.Where(t => t.Type == TransactionType.Sale
                  && (t.Status == TransactionStatus.Completed
                      || (t.Status == TransactionStatus.Voided && t.Notes != null && t.Notes.StartsWith(RefundedMarker))));

    private static IQueryable<POSTransaction> Refunds(IQueryable<POSTransaction> q) =>
        q.Where(t => t.Type == TransactionType.Refund && t.Status == TransactionStatus.Completed);

    /// <summary>Sales cancelled outright — never revenue.</summary>
    private static IQueryable<POSTransaction> Voids(IQueryable<POSTransaction> q) =>
        q.Where(t => t.Type == TransactionType.Sale && t.Status == TransactionStatus.Voided
                  && (t.Notes == null || !t.Notes.StartsWith(RefundedMarker)));

    private async Task<PosKpisDto> KpisAsync(DateTime startUtc, DateTime endUtc, CancellationToken ct)
    {
        var range = InRange(startUtc, endUtc);

        var s = await Sales(range)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Gross     = g.Sum(t => t.TotalAmount),
                Count     = g.Count(),
                Discounts = g.Sum(t => t.DiscountAmount),
                Tax       = g.Sum(t => t.TaxAmount),
            })
            .FirstOrDefaultAsync(ct);

        var items = await Sales(range).SelectMany(t => t.LineItems).SumAsync(li => (decimal?)li.Quantity, ct) ?? 0m;

        var r = await Refunds(range)
            .GroupBy(_ => 1)
            .Select(g => new { Amount = g.Sum(t => t.TotalAmount), Count = g.Count() })
            .FirstOrDefaultAsync(ct);

        var v = await Voids(range)
            .GroupBy(_ => 1)
            .Select(g => new { Amount = g.Sum(t => t.TotalAmount), Count = g.Count() })
            .FirstOrDefaultAsync(ct);

        var gross   = s?.Gross ?? 0m;
        var refunds = r?.Amount ?? 0m;
        var count   = s?.Count ?? 0;

        return new PosKpisDto(
            gross, refunds, gross - refunds, count, r?.Count ?? 0, v?.Count ?? 0, v?.Amount ?? 0m,
            count == 0 ? 0m : Math.Round(gross / count, 2),
            items, s?.Discounts ?? 0m, s?.Tax ?? 0m);
    }

    private async Task<IReadOnlyList<PosTrendPointDto>> TrendAsync(
        DateTime startUtc, DateTime endUtc, TimeSpan offset, bool hourly, CancellationToken ct)
    {
        var range = InRange(startUtc, endUtc);

        // Bucketing happens in memory on the LOCAL clock; the range is capped at 92 days, so the
        // projection stays small (two columns per transaction).
        var sales = await Sales(range).Select(t => new { t.CompletedAt, t.TotalAmount }).ToListAsync(ct);
        var refunds = await Refunds(range).Select(t => new { t.CompletedAt, t.TotalAmount }).ToListAsync(ct);

        string Key(DateTime utc)
        {
            var local = utc.Add(offset);
            return hourly ? $"{local.Hour:00}:00" : local.ToString("yyyy-MM-dd");
        }

        // Zero-filled so a quiet hour or day reads as zero, not as a gap the axis silently skips.
        var buckets = new List<string>();
        if (hourly)
            for (var h = 0; h < 24; h++) buckets.Add($"{h:00}:00");
        else
            for (var d = startUtc.Add(offset).Date; d < endUtc.Add(offset).Date; d = d.AddDays(1))
                buckets.Add(d.ToString("yyyy-MM-dd"));

        var saleBy   = sales.GroupBy(x => Key(x.CompletedAt)).ToDictionary(g => g.Key, g => (Sum: g.Sum(x => x.TotalAmount), Count: g.Count()));
        var refundBy = refunds.GroupBy(x => Key(x.CompletedAt)).ToDictionary(g => g.Key, g => g.Sum(x => x.TotalAmount));

        return buckets.Select(b => new PosTrendPointDto(
            b,
            saleBy.TryGetValue(b, out var sv) ? sv.Sum : 0m,
            refundBy.TryGetValue(b, out var rv) ? rv : 0m,
            saleBy.TryGetValue(b, out var sc) ? sc.Count : 0)).ToList();
    }
}
