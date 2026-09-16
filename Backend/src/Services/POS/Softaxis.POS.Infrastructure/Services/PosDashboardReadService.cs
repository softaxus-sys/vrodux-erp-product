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

        var topProducts = await sales
            .SelectMany(t => t.LineItems)
            .GroupBy(li => li.ProductId)
            .Select(g => new PosTopProductDto(
                g.Key, g.Max(li => li.ProductName), g.Sum(li => li.Quantity), g.Sum(li => li.LineTotal)))
            .OrderByDescending(p => p.Revenue)
            .Take(TopN)
            .ToListAsync(ct);

        var cashiers = await sales
            .GroupBy(t => t.CashierId)
            .Select(g => new PosCashierDto(g.Key, g.Count(), g.Sum(t => t.TotalAmount)))
            .OrderByDescending(c => c.Sales)
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
            topProducts, cashiers, openShifts, offlineEnabled, tills);
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
